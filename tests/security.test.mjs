// Security-rule tests: runs every migration in an in-memory Postgres and checks
// who can see and change what.  Run:  npm run test:security
import { PGlite } from "@electric-sql/pglite"
import fs from "node:fs"

const db = new PGlite()
const q = (s, p) => db.query(s, p)

// Minimal stand-in for Supabase's auth + storage schemas and roles
await db.exec(`
create role anon; create role authenticated; create role service_role bypassrls;
create schema auth;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
alter table storage.objects enable row level security;
grant all on storage.objects to authenticated;
grant usage on schema public, auth, storage to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`)
for (const f of fs.readdirSync("supabase/migrations").sort()) {
  await db.exec(fs.readFileSync(`supabase/migrations/${f}`, "utf8"))
}
console.log("migrations applied OK")

const A = "00000000-0000-0000-0000-00000000000a" // vendor A
const B = "00000000-0000-0000-0000-00000000000b" // vendor B
const ADMIN = "00000000-0000-0000-0000-0000000000ad"
await q(`insert into auth.users values ($1,'a@x.com'),($2,'b@x.com'),($3,'admin@x.com')`, [A, B, ADMIN])
await q(`update public.profiles set is_super_admin = true where id = $1`, [ADMIN])

async function as(uid) {
  await db.exec(`reset role; set request.jwt.claim.sub='${uid}'; set role authenticated;`)
}
async function asAnon() {
  await db.exec(`reset role; set request.jwt.claim.sub=''; set role anon;`)
}

let pass = 0, fail = 0
async function expect(name, fn, shouldWork) {
  try {
    const r = await fn()
    const ok = r === undefined ? true : r
    if (ok === shouldWork) { pass++; console.log("✓", name) }
    else { fail++; console.log("✗", name, "→ got", ok) }
  } catch (e) {
    if (!shouldWork) { pass++; console.log("✓", name, "(blocked:", e.message.slice(0, 60) + ")") }
    else { fail++; console.log("✗", name, "threw", e.message) }
  }
}
const rows = async (sql, p) => (await q(sql, p)).rows

// --- Vendors ---------------------------------------------------------------
await as(A)
const vA = (await rows(`insert into public.vendors(owner_id,business_name,category) values($1,'Taco A','tacos_mexican') returning id`, [A]))[0].id
await as(B)
const vB = (await rows(`insert into public.vendors(owner_id,business_name,category) values($1,'Bakery B','baked_goods') returning id`, [B]))[0].id

await expect("B cannot see A's business", async () => (await rows(`select * from public.vendors where id=$1`, [vA])).length > 0, false)
await expect("B cannot create a business owned by A", async () => { await q(`insert into public.vendors(owner_id,business_name,category) values($1,'x','other')`, [A]) }, false)
await expect("B cannot rename A's business", async () => (await rows(`update public.vendors set business_name='hacked' where id=$1 returning id`, [vA])).length > 0, false)
await expect("B cannot mark own business as sample data", async () => { await q(`update public.vendors set is_sample=true where id=$1`, [vB]) }, false)
await expect("B cannot hand own business to A", async () => { await q(`update public.vendors set owner_id=$1 where id=$2`, [A, vB]) }, false)
await expect("B cannot make self super admin", async () => { await q(`update public.profiles set is_super_admin=true where id=$1`, [B]) }, false)
await expect("B cannot un-suspend self", async () => { await q(`update public.profiles set suspended_at=null where id=$1`, [B]) }, false)
await expect("B can change own name", async () => (await rows(`update public.profiles set full_name='Bee' where id=$1 returning id`, [B])).length === 1, true)
await expect("B cannot see A's profile", async () => (await rows(`select * from public.profiles where id=$1`, [A])).length > 0, false)
await expect("B cannot delete own business (admin only)", async () => (await rows(`delete from public.vendors where id=$1 returning id`, [vB])).length > 0, false)

// --- Documents -------------------------------------------------------------
await as(A)
await expect("A adds a document in own folder", async () => { await q(`insert into public.vendor_documents(vendor_id,doc_type,file_path,file_name,expiration_date) values($1,'health_permit',$2,'permit.pdf','2030-01-01')`, [vA, `${vA}/permit.pdf`]) }, true)
await expect("A cannot point a document at B's folder", async () => { await q(`insert into public.vendor_documents(vendor_id,doc_type,file_path,file_name) values($1,'other',$2,'x.pdf')`, [vA, `${vB}/x.pdf`]) }, false)
await expect("A cannot add a document to B's business", async () => { await q(`insert into public.vendor_documents(vendor_id,doc_type,file_path,file_name) values($1,'other',$2,'x.pdf')`, [vB, `${vB}/x.pdf`]) }, false)
await expect("Expiration can't be before issue date", async () => { await q(`insert into public.vendor_documents(vendor_id,doc_type,file_path,file_name,issue_date,expiration_date) values($1,'other',$2,'x.pdf','2026-05-01','2026-01-01')`, [vA, `${vA}/y.pdf`]) }, false)
await expect("A sees own document", async () => (await rows(`select * from public.vendor_documents`)).length === 1, true)
await expect("A cannot read reminder log", async () => { await q(`select * from public.document_reminders`) }, false)

await as(B)
await expect("B cannot see A's documents", async () => (await rows(`select * from public.vendor_documents`)).length > 0, false)
await expect("B cannot change A's expiry dates", async () => (await rows(`update public.vendor_documents set expiration_date='2099-01-01' returning id`)).length > 0, false)
await expect("B cannot delete A's documents", async () => (await rows(`delete from public.vendor_documents returning id`)).length > 0, false)
await expect("B cannot move own document onto A's business", async () => {
  const d = (await rows(`insert into public.vendor_documents(vendor_id,doc_type,file_path,file_name) values($1,'other',$2,'b.pdf') returning id`, [vB, `${vB}/b.pdf`]))[0].id
  await q(`update public.vendor_documents set vendor_id=$1 where id=$2`, [vA, d])
}, false)

// --- Storage ---------------------------------------------------------------
await as(A)
await expect("A uploads document file to own folder", async () => { await q(`insert into storage.objects(bucket_id,name) values('vendor-documents',$1)`, [`${vA}/permit.pdf`]) }, true)
await expect("A uploads photo to own folder", async () => { await q(`insert into storage.objects(bucket_id,name) values('vendor-photos',$1)`, [`${vA}/p.jpg`]) }, true)
await as(B)
await expect("B cannot see A's document files", async () => (await rows(`select * from storage.objects where bucket_id='vendor-documents'`)).length > 0, false)
await expect("B cannot upload into A's document folder", async () => { await q(`insert into storage.objects(bucket_id,name) values('vendor-documents',$1)`, [`${vA}/evil.pdf`]) }, false)
await expect("B cannot upload to a junk path", async () => { await q(`insert into storage.objects(bucket_id,name) values('vendor-documents','junk/x.pdf')`) }, false)
await expect("B cannot delete A's files", async () => (await rows(`delete from storage.objects returning id`)).length > 0, false)
await expect("B cannot upload market photos", async () => { await q(`insert into storage.objects(bucket_id,name) values('market-photos','m/x.jpg')`) }, false)
await expect("B cannot add A's photo path to own business", async () => { await q(`insert into public.vendor_photos(vendor_id,path) values($1,$2)`, [vB, `${vA}/p.jpg`]) }, false)

// --- Menu files ------------------------------------------------------------
await as(A)
await expect("A attaches a menu file from own folder", async () => { await q(`update public.vendors set menu_file_path=$1, menu_file_name='menu.pdf' where id=$2`, [`${vA}/menu.pdf`, vA]) }, true)
await expect("A cannot point menu at B's folder", async () => { await q(`update public.vendors set menu_file_path=$1 where id=$2`, [`${vB}/menu.pdf`, vA]) }, false)
await expect("A uploads menu file to own folder", async () => { await q(`insert into storage.objects(bucket_id,name) values('vendor-menus',$1)`, [`${vA}/menu.pdf`]) }, true)
await as(B)
await expect("B cannot upload into A's menu folder", async () => { await q(`insert into storage.objects(bucket_id,name) values('vendor-menus',$1)`, [`${vA}/evil.pdf`]) }, false)
await expect("B cannot delete A's menu file", async () => (await rows(`delete from storage.objects where bucket_id='vendor-menus' returning id`)).length > 0, false)
await expect("B cannot change A's menu", async () => (await rows(`update public.vendors set menu_file_path=null where id=$1 returning id`, [vA])).length > 0, false)

// --- Markets ---------------------------------------------------------------
await as(ADMIN)
const m1 = (await rows(`insert into public.markets(slug,name,address,city,lat,lng,booth_fees) values('m1','Market One','1 Main St','Los Angeles',34.05,-118.25,'[{"label":"10x10","amount_cents":7500},{"label":"Truck","amount_cents":12000}]') returning id, min_booth_fee_cents`))[0]
await expect("Lowest booth fee is worked out automatically", async () => m1.min_booth_fee_cents === 7500, true)
await q(`insert into public.markets(slug,name,address,city,lat,lng,is_published) values('hidden','Hidden','2 Main St','Los Angeles',34.05,-118.25,false)`)
await q(`insert into public.market_dates(market_id,event_date) values($1,'2030-06-01')`, [m1.id])
await q(`insert into public.market_contacts(market_id,contact_email) values($1,'boss@market.com')`, [m1.id])
await expect("Admin sees admin-only contact info", async () => (await rows(`select * from public.market_contacts`)).length === 1, true)
await expect("Admin can read A's documents", async () => (await rows(`select * from public.vendor_documents where vendor_id=$1`, [vA])).length === 1, true)
await expect("Admin can upload market photos", async () => { await q(`insert into storage.objects(bucket_id,name) values('market-photos','m1/x.jpg')`) }, true)

await asAnon()
await expect("Signed-out visitor can browse published markets", async () => (await rows(`select * from public.markets`)).length === 1, true)
await expect("Signed-out visitor sees market dates", async () => (await rows(`select * from public.market_dates`)).length === 1, true)
await expect("Signed-out visitor cannot see market contact emails", async () => (await rows(`select * from public.market_contacts`)).length > 0, false)
await expect("Signed-out visitor cannot see vendors", async () => (await rows(`select * from public.vendors`)).length > 0, false)
await expect("Signed-out visitor cannot see documents", async () => (await rows(`select * from public.vendor_documents`)).length > 0, false)
await expect("Signed-out visitor cannot add markets", async () => { await q(`insert into public.markets(slug,name,address,city,lat,lng) values('x','x','x','x',1,1)`) }, false)

await as(A)
await expect("Vendor cannot see unpublished markets", async () => (await rows(`select * from public.markets where slug='hidden'`)).length > 0, false)
await expect("Vendor cannot add markets", async () => { await q(`insert into public.markets(slug,name,address,city,lat,lng) values('x','x','x','x',1,1)`) }, false)
await expect("Vendor cannot edit markets", async () => (await rows(`update public.markets set name='mine' returning id`)).length > 0, false)
await expect("Vendor cannot add market dates", async () => { await q(`insert into public.market_dates(market_id,event_date) values($1,'2031-01-01')`, [m1.id]) }, false)
await expect("Vendor cannot see market contact emails", async () => (await rows(`select * from public.market_contacts`)).length > 0, false)

// --- Applications (Phase 2) ------------------------------------------------
const O = "00000000-0000-0000-0000-0000000000cc" // an organizer
await db.exec(`reset role; set request.jwt.claim.sub=''`)
await q(`insert into auth.users values ($1,'o@x.com')`, [O])
const m2 = (await rows(`insert into public.markets(slug,name,address,city,lat,lng,organizer_id,approval_status) values('m2','Claimed Market','3 Main St','Los Angeles',34.05,-118.25,$1,'approved') returning id`, [O]))[0].id
await as(A)
const past = "2020-06-01", future = "2099-06-01"
const appA = (await rows(`insert into public.applications(vendor_id,market_id,event_dates,status) values($1,$2,$3,'submitted') returning id`, [vA, m1.id, [past, future]]))[0].id
const appA2 = (await rows(`insert into public.applications(vendor_id,market_id,event_dates,status) values($1,$2,$3,'submitted') returning id`, [vA, m2, [past]]))[0].id
await expect("A cannot create an application already marked accepted", async () => { await q(`insert into public.applications(vendor_id,market_id,event_dates,status) values($1,$2,$3,'accepted')`, [vA, m1.id, [future]]) }, false)
await expect("A cannot apply to an unpublished market", async () => {
  await db.exec(`reset role; set request.jwt.claim.sub=''`); const hid = (await rows(`select id from public.markets where slug='hidden'`))[0].id; await as(A)
  await q(`insert into public.applications(vendor_id,market_id,event_dates) values($1,$2,$3)`, [vA, hid, [future]])
}, false)
await expect("A cannot set status directly", async () => { await q(`update public.applications set status='accepted' where id=$1`, [appA]) }, false)
await expect("A cannot verify own acceptance", async () => { await q(`select public.admin_verify_application($1,true)`, [appA]) }, false)
await expect("A cannot review before being accepted", async () => { await q(`insert into public.reviews(vendor_id,market_id,application_id,event_date,rating_foot_traffic,rating_organization,rating_value,rating_overall) values($1,$2,$3,$4,5,5,5,5)`, [vA, m1.id, appA, past]) }, false)
await expect("A self-reports accepted (market not on Stallpass)", async () => { await q(`select public.vendor_set_application_status($1,'accepted')`, [appA]) }, true)
await expect("Self-reported acceptance can't review until verified", async () => { await q(`insert into public.reviews(vendor_id,market_id,application_id,event_date,rating_foot_traffic,rating_organization,rating_value,rating_overall) values($1,$2,$3,$4,5,5,5,5)`, [vA, m1.id, appA, past]) }, false)
await expect("A cannot self-accept at a market on Stallpass", async () => { await q(`select public.vendor_set_application_status($1,'accepted')`, [appA2]) }, false)
await expect("A can cancel at a market on Stallpass", async () => { await q(`select public.vendor_set_application_status($1,'cancelled')`, [appA2]) }, true)

await as(B)
await expect("B cannot see A's applications", async () => (await rows(`select * from public.applications`)).length > 0, false)
await expect("B cannot apply as A", async () => { await q(`insert into public.applications(vendor_id,market_id,event_dates) values($1,$2,$3)`, [vA, m1.id, [future]]) }, false)
await expect("B cannot change A's application status", async () => { await q(`select public.vendor_set_application_status($1,'declined')`, [appA]) }, false)
await expect("B cannot delete A's application", async () => (await rows(`delete from public.applications returning id`)).length > 0, false)

await as(O)
await expect("Organizer sees applications to own market", async () => (await rows(`select * from public.applications where market_id=$1`, [m2])).length === 1, true)
await expect("Organizer can't see applications to other markets", async () => (await rows(`select * from public.applications where market_id=$1`, [m1.id])).length > 0, false)
await expect("Organizer can't see vendor's private document vault", async () => (await rows(`select * from public.vendor_documents`)).length > 0, false)

await as(ADMIN)
await expect("Admin verifies A's acceptance", async () => { await q(`select public.admin_verify_application($1,true)`, [appA]) }, true)
await expect("Verification is written to the audit log", async () => (await rows(`select * from public.admin_audit_log where action='verify_application'`)).length === 1, true)

// --- Reviews -----------------------------------------------------------------
const review = (vendor, market, app, day) => q(`insert into public.reviews(vendor_id,market_id,application_id,event_date,rating_foot_traffic,rating_organization,rating_value,rating_overall,body) values($1,$2,$3,$4,4,3,5,4,'Solid crowd') returning id`, [vendor, market, app, day])
await as(B)
await expect("B cannot review using A's application", async () => { await review(vB, m1.id, appA, past) }, false)
await expect("B cannot post a review as A", async () => { await review(vA, m1.id, appA, past) }, false)
await as(A)
await expect("A cannot review a date that hasn't happened", async () => { await review(vA, m1.id, appA, future) }, false)
await expect("A cannot review a date not in the application", async () => { await review(vA, m1.id, appA, "2020-07-01") }, false)
await expect("A cannot point the review at another market", async () => { await review(vA, m2, appA, past) }, false)
let revA
await expect("Verified vendor reviews a past event", async () => { revA = (await review(vA, m1.id, appA, past)).rows[0].id }, true)
await expect("Only one review per vendor per event", async () => { await review(vA, m1.id, appA, past) }, false)
await expect("Reviewer name is hidden unless chosen", async () => (await rows(`select reviewer_name from public.reviews where id=$1`, [revA]))[0].reviewer_name === null, true)
await expect("A can edit own review", async () => (await rows(`update public.reviews set body='Great' where id=$1 returning id`, [revA])).length === 1, true)
await expect("A cannot write the organizer's reply", async () => { await q(`update public.reviews set organizer_reply='fake' where id=$1`, [revA]) }, false)
await expect("A cannot un-hide or hide reviews", async () => { await q(`update public.reviews set is_hidden=true where id=$1`, [revA]) }, false)
await expect("A cannot fake the reviewer name", async () => { await q(`update public.reviews set reviewer_name='Someone Else' where id=$1`, [revA]) }, false)

await expect("Business name is never published, even if chosen", async () => (await rows(`update public.reviews set show_business_name=true where id=$1 returning reviewer_name`, [revA]))[0].reviewer_name === null, true)
await as(O)
await expect("Organizer of another market cannot reply", async () => { await q(`select public.reply_to_review($1,'hi')`, [revA]) }, false)
await db.exec(`reset role; set request.jwt.claim.sub=''`); await q(`update public.markets set organizer_id=$1 where id=$2`, [O, m1.id])
await as(O)
await expect("Market's organizer can reply publicly", async () => { await q(`select public.reply_to_review($1,'Thanks for coming!')`, [revA]) }, true)
await expect("Organizer cannot see who wrote reviews of own market", async () => (await rows(`select vendor_id from public.reviews`)).length > 0, false)
await expect("Organizer sees the review text publicly", async () => (await rows(`select * from public.market_reviews where market_id=$1`, [m1.id])).length === 1, true)

await asAnon()
await expect("Public can read reviews", async () => (await rows(`select * from public.market_reviews`)).length === 1, true)
await expect("Public review has no vendor id", async () => !("vendor_id" in (await rows(`select * from public.market_reviews`))[0]), true)
await expect("Public cannot read the reviews table directly", async () => { await q(`select * from public.reviews`) }, false)
await expect("Public cannot call admin functions", async () => { await q(`select public.admin_set_review_hidden($1,true,'x')`, [revA]) }, false)

await as(B)
await expect("B cannot hide reviews", async () => { await q(`select public.admin_set_review_hidden($1,true,'x')`, [revA]) }, false)
await expect("B cannot read the audit log", async () => (await rows(`select * from public.admin_audit_log`)).length > 0, false)
await expect("B cannot write to the audit log", async () => { await q(`insert into public.admin_audit_log(admin_id,action,target_type) values($1,'x','y')`, [B]) }, false)
await as(ADMIN)
await expect("Admin hides an abusive review", async () => { await q(`select public.admin_set_review_hidden($1,true,'Personal attack')`, [revA]) }, true)
await expect("Admin cannot edit the audit log", async () => (await rows(`update public.admin_audit_log set action='x' returning id`)).length > 0, false)
await asAnon()
await expect("Hidden review disappears from public", async () => (await rows(`select * from public.market_reviews`)).length === 0, true)
await as(A)
await expect("Reviewer still sees own hidden review", async () => (await rows(`select * from public.reviews where id=$1`, [revA])).length === 1, true)

// --- Application documents -----------------------------------------------
await db.exec(`reset role; set request.jwt.claim.sub=''`)
await q(`insert into public.application_documents(application_id,doc_type,file_path,file_name) values($1,'health_permit',$2,'p.pdf')`, [appA, `${vA}/applications/${appA}/p.pdf`])
await as(O)
await expect("Organizer sees documents attached to own market's application", async () => (await rows(`select * from public.application_documents`)).length === 1, true)
await as(B)
await expect("B cannot see A's attached documents", async () => (await rows(`select * from public.application_documents`)).length > 0, false)
await as(A)
await expect("A cannot add fake attached documents", async () => { await q(`insert into public.application_documents(application_id,doc_type,file_path,file_name) values($1,'other','x','x')`, [appA]) }, false)

// --- Organizers (Phase 3) ---------------------------------------------------
const O2 = "00000000-0000-0000-0000-0000000000dd" // a second organizer
const C = "00000000-0000-0000-0000-0000000000ee" // someone claiming a market
await db.exec(`reset role; set request.jwt.claim.sub=''`)
await q(`insert into auth.users values ($1,'o2@x.com'),($2,'c@x.com')`, [O2, C])
const m3 = (await rows(`insert into public.markets(slug,name,address,city,lat,lng,approval_status) values('m3','Unclaimed','4 Main St','Los Angeles',34.05,-118.25,'approved') returning id`))[0].id
const newMarket = (uid, slug) => q(`insert into public.markets(slug,name,address,city,lat,lng,organizer_id) values($1,'New','5 Main','LA',34,-118,$2) returning id, approval_status`, [slug, uid])

await as(O2)
await expect("Non-organizer account cannot create markets", async () => { await newMarket(O2, "n0") }, false)
await expect("Anyone can say they run a market", async () => { await q(`update public.profiles set is_organizer=true where id=$1`, [O2]) }, true)
await expect("Organizer cannot make self trusted", async () => { await q(`update public.profiles set is_trusted_organizer=true where id=$1`, [O2]) }, false)
await expect("Organizer cannot create a market for someone else", async () => { await newMarket(O, "n1") }, false)
let pend
await expect("New organizer's market starts pending", async () => { const r = (await newMarket(O2, "n2")).rows[0]; pend = r.id; return r.approval_status === "pending" }, true)
await expect("Organizer cannot approve own market", async () => { await q(`update public.markets set approval_status='approved' where id=$1`, [pend]) }, false)
await expect("Organizer cannot call the admin approval", async () => { await q(`select public.admin_review_market($1,true,null)`, [pend]) }, false)
await expect("Organizer sees own pending market", async () => (await rows(`select * from public.markets where id=$1`, [pend])).length === 1, true)
await expect("Organizer adds dates to own market", async () => { await q(`insert into public.market_dates(market_id,event_date) values($1,'2099-01-01')`, [pend]) }, true)
await expect("Organizer uploads photo to own market folder", async () => { await q(`insert into storage.objects(bucket_id,name) values('market-photos',$1)`, [`${pend}/a.jpg`]) }, true)
await expect("Organizer cannot upload to another market's folder", async () => { await q(`insert into storage.objects(bucket_id,name) values('market-photos',$1)`, [`${m2}/a.jpg`]) }, false)
await expect("Organizer cannot edit another organizer's market", async () => (await rows(`update public.markets set name='mine' where id=$1 returning id`, [m2])).length > 0, false)
await expect("Organizer cannot add dates to another's market", async () => { await q(`insert into public.market_dates(market_id,event_date) values($1,'2099-01-01')`, [m2]) }, false)
await expect("Organizer cannot hand own market to someone else", async () => { await q(`update public.markets set organizer_id=$1 where id=$2`, [O, pend]) }, false)
await asAnon()
await expect("Public cannot see a pending market", async () => (await rows(`select * from public.markets where id=$1`, [pend])).length > 0, false)
await expect("Public cannot see a pending market's dates", async () => (await rows(`select * from public.market_dates where market_id=$1`, [pend])).length > 0, false)
await as(B)
await expect("Vendor cannot apply to a pending market", async () => { await q(`insert into public.applications(vendor_id,market_id,event_dates) values($1,$2,$3)`, [vB, pend, ["2099-01-01"]]) }, false)

await as(ADMIN)
await expect("Admin rejects with a reason", async () => { await q(`select public.admin_review_market($1,false,'Looks like a duplicate')`, [pend]) }, true)
await as(O2)
await expect("Organizer editing a rejected market sends it back for review", async () => (await rows(`update public.markets set name='Fixed' where id=$1 returning approval_status`, [pend]))[0].approval_status === "pending", true)
await as(ADMIN)
await expect("Admin approves", async () => { await q(`select public.admin_review_market($1,true,null)`, [pend]) }, true)
await asAnon()
await expect("Approved market is public", async () => (await rows(`select * from public.markets where id=$1`, [pend])).length === 1, true)
await as(O2)
await expect("Organizer cannot delete an approved market", async () => (await rows(`delete from public.markets where id=$1 returning id`, [pend])).length > 0, false)
const pend2 = (await newMarket(O2, "n3")).rows[0].id
await expect("Organizer can delete own pending market", async () => (await rows(`delete from public.markets where id=$1 returning id`, [pend2])).length === 1, true)

// Auto-approval: trusted flag, or a good track record
await as(B)
await expect("Non-admin cannot trust an organizer", async () => { await q(`select public.admin_set_trusted_organizer($1,true)`, [O2]) }, false)
await expect("Non-admin cannot read settings", async () => (await rows(`select * from public.platform_settings`)).length > 0, false)
await expect("Non-admin cannot change settings", async () => (await rows(`update public.platform_settings set auto_approve_min_reviews=1 returning id`)).length > 0, false)
await as(ADMIN)
await expect("Admin trusts organizer O2", async () => { await q(`select public.admin_set_trusted_organizer($1,true)`, [O2]) }, true)
await as(O2)
await expect("Trusted organizer's new market goes live", async () => (await newMarket(O2, "n4")).rows[0].approval_status === "approved", true)
await db.exec(`reset role; set request.jwt.claim.sub=''`)
await q(`update public.profiles set is_organizer=true where id=$1`, [O])
await q(`insert into public.reviews(vendor_id,market_id,event_date,rating_foot_traffic,rating_organization,rating_value,rating_overall) values($1,$2,'2020-01-01',5,5,5,5)`, [vB, m2])
await as(O)
await expect("Organizer with too few reviews still needs approval", async () => (await newMarket(O, "n5")).rows[0].approval_status === "pending", true)
await as(ADMIN)
await expect("Admin lowers the review threshold", async () => (await rows(`update public.platform_settings set auto_approve_min_reviews=1 returning id`)).length === 1, true)
await as(O)
await expect("Organizer with a good track record goes live", async () => (await newMarket(O, "n6")).rows[0].approval_status === "approved", true)

// Claims
await as(C)
await expect("Can't claim a market that already has an organizer", async () => { await q(`insert into public.market_claims(market_id,user_id,role) values($1,$2,'Owner')`, [m2, C]) }, false)
await expect("Can't claim on someone else's behalf", async () => { await q(`insert into public.market_claims(market_id,user_id,role) values($1,$2,'Owner')`, [m3, B]) }, false)
let claimC
await expect("Claim an unclaimed market", async () => { claimC = (await rows(`insert into public.market_claims(market_id,user_id,role) values($1,$2,'Market manager') returning id`, [m3, C]))[0].id }, true)
await expect("Claimer cannot approve own claim", async () => { await q(`select public.admin_decide_claim($1,true,null)`, [claimC]) }, false)
await expect("Claimer cannot mark claim approved", async () => { await q(`update public.market_claims set status='approved' where id=$1`, [claimC]) }, false)
await as(B)
const claimB = (await rows(`insert into public.market_claims(market_id,user_id,role) values($1,$2,'Owner') returning id`, [m3, B]))[0].id
await expect("Others can't see my claim", async () => (await rows(`select * from public.market_claims where id=$1`, [claimC])).length > 0, false)
await as(ADMIN)
await expect("Admin approves C's claim", async () => { await q(`select public.admin_decide_claim($1,true,null)`, [claimC]) }, true)
await expect("Claimer now organizes the market", async () => (await rows(`select organizer_id from public.markets where id=$1`, [m3]))[0].organizer_id === C, true)
await expect("Competing claim was turned down", async () => (await rows(`select status from public.market_claims where id=$1`, [claimB]))[0].status === "rejected", true)
await expect("Claim decision is logged", async () => (await rows(`select * from public.admin_audit_log where action='approve_claim'`)).length === 1, true)

// Organizer decisions on applications
await as(B)
const appB = (await rows(`insert into public.applications(vendor_id,market_id,event_dates,status) values($1,$2,$3,'submitted') returning id`, [vB, m2, ["2020-06-01"]]))[0].id
await as(O2)
await expect("Other organizer cannot accept it", async () => { await q(`select public.organizer_set_application_status($1,'accepted',null)`, [appB]) }, false)
await expect("Other organizer cannot see the applicant's profile", async () => (await rows(`select * from public.vendors where id=$1`, [vB])).length > 0, false)
await as(B)
await expect("Vendor cannot use organizer tools", async () => { await q(`select public.organizer_set_application_status($1,'accepted',null)`, [appB]) }, false)
await as(O)
await expect("Organizer sees applicant's profile", async () => (await rows(`select * from public.vendors where id=$1`, [vB])).length === 1, true)
await expect("Organizer still can't open applicant's private vault", async () => (await rows(`select * from public.vendor_documents where vendor_id=$1`, [vB])).length > 0, false)
await expect("Organizer accepts", async () => { await q(`select public.organizer_set_application_status($1,'accepted','See you there!')`, [appB]) }, true)
await expect("Organizer assigns a booth", async () => { await q(`select public.organizer_set_booth($1,'A12')`, [appB]) }, true)
await expect("Organizer cannot reopen a cancelled application", async () => { await q(`select public.organizer_set_application_status($1,'accepted',null)`, [appA2]) }, false)
await expect("Organizer records a message to own vendors", async () => { await q(`insert into public.organizer_messages(market_id,sent_by,subject,body) values($1,$2,'Load-in','Arrive by 4pm')`, [m2, O]) }, true)
await expect("Organizer cannot record messages for another market", async () => { await q(`insert into public.organizer_messages(market_id,sent_by,subject,body) values($1,$2,'x','y')`, [pend, O]) }, false)
await as(B)
await expect("Vendor sees booth number and organizer acceptance", async () => { const r = (await rows(`select booth_number, status_source from public.applications where id=$1`, [appB]))[0]; return r.booth_number === "A12" && r.status_source === "organizer" }, true)
await expect("Organizer-accepted vendor can review right away (no admin step)", async () => { await q(`insert into public.reviews(vendor_id,market_id,application_id,event_date,rating_foot_traffic,rating_organization,rating_value,rating_overall) values($1,$2,$3,'2020-06-01',4,4,4,4)`, [vB, m2, appB]) }, true)
await expect("Vendor cannot read organizer messages", async () => (await rows(`select * from public.organizer_messages`)).length > 0, false)

// --- Payments (Phase 4) -------------------------------------------------------
await db.exec(`reset role; set request.jwt.claim.sub=''`)
await q(`update public.markets set payment_method='external_link', payment_link='https://pay.example.com/m2' where id=$1`, [m2])
await q(`insert into public.payments(application_id,market_id,vendor_id,method,status,amount_cents) values($1,$2,$3,'stripe','failed',7500)`, [appB, m2, vB])
await as(B)
await expect("Vendor sees own payment", async () => (await rows(`select * from public.payments where vendor_id=$1`, [vB])).length === 1, true)
await expect("Vendor cannot create a payment directly", async () => { await q(`insert into public.payments(application_id,market_id,vendor_id,method,status) values($1,$2,$3,'stripe','paid')`, [appB, m2, vB]) }, false)
await expect("Vendor cannot mark a payment paid", async () => (await rows(`update public.payments set status='paid' returning id`)).length > 0, false)
await expect("Vendor cannot read payout accounts", async () => (await rows(`select * from public.payout_accounts`)).length > 0, false)
let payB
await expect("Accepted vendor reports paying on the market's link", async () => { payB = (await rows(`select public.vendor_report_external_payment($1) id`, [appB]))[0].id }, true)
await expect("Can't report the same payment twice", async () => { await q(`select public.vendor_report_external_payment($1)`, [appB]) }, false)
await expect("Reporting doesn't mark it paid by itself (organizer confirms)", async () => (await rows(`select status from public.applications where id=$1`, [appB]))[0].status === "accepted", true)
await expect("Vendor cannot confirm own payment", async () => { await q(`select public.organizer_confirm_payment($1,true)`, [payB]) }, false)
await expect("Vendor cannot mark a Stallpass market's application paid", async () => { await q(`select public.vendor_set_application_status($1,'paid')`, [appB]) }, false)
await as(A)
await expect("Other vendor cannot see B's payments", async () => (await rows(`select * from public.payments where vendor_id=$1`, [vB])).length > 0, false)
await expect("Other vendor cannot report payment for B", async () => { await q(`select public.vendor_report_external_payment($1)`, [appB]) }, false)
await as(O2)
await expect("Other organizer cannot see the payment", async () => (await rows(`select * from public.payments where market_id=$1`, [m2])).length > 0, false)
await expect("Other organizer cannot confirm it", async () => { await q(`select public.organizer_confirm_payment($1,true)`, [payB]) }, false)
await expect("Organizer cannot set the platform fee", async () => (await rows(`update public.platform_settings set platform_fee_percent=0 returning id`)).length > 0, false)
await as(O)
await expect("Market's organizer sees payments", async () => (await rows(`select * from public.payments where market_id=$1`, [m2])).length === 2, true)
await expect("Organizer cannot edit payment amounts", async () => (await rows(`update public.payments set amount_cents=1 returning id`)).length > 0, false)
await expect("Organizer confirms the payment", async () => { await q(`select public.organizer_confirm_payment($1,true)`, [payB]) }, true)
await expect("Application is now paid", async () => (await rows(`select status from public.applications where id=$1`, [appB]))[0].status === "paid", true)
await expect("Payment links must be https", async () => { await q(`update public.markets set payment_link='http://evil.example' where id=$1`, [m2]) }, false)
await as(ADMIN)
await expect("Admin sets the platform fee", async () => (await rows(`update public.platform_settings set platform_fee_percent=3.5 returning id`)).length === 1, true)
await expect("Admin sees all payments", async () => (await rows(`select * from public.payments`)).length === 2, true)

// Unclaimed market: vendor-reported payment counts as paid
await db.exec(`reset role; set request.jwt.claim.sub=''`)
const m4 = (await rows(`insert into public.markets(slug,name,address,city,lat,lng,approval_status,payment_method,payment_link) values('m4','City Market','6 Main St','LA',34,-118,'approved','external_link','https://city.example/pay') returning id`))[0].id
await as(A)
const appA4 = (await rows(`insert into public.applications(vendor_id,market_id,event_dates) values($1,$2,$3) returning id`, [vA, m4, ["2099-02-01"]]))[0].id
await expect("Can't pay before being accepted", async () => { await q(`select public.vendor_report_external_payment($1)`, [appA4]) }, false)
await q(`select public.vendor_set_application_status($1,'accepted')`, [appA4])
await expect("Report payment at a city market", async () => { await q(`select public.vendor_report_external_payment($1)`, [appA4]) }, true)
await expect("City-market payment counts as paid", async () => (await rows(`select status from public.applications where id=$1`, [appA4]))[0].status === "paid", true)
await expect("Paid can't be cancelled by the vendor", async () => { await q(`select public.vendor_set_application_status($1,'cancelled')`, [appA4]) }, false)

// --- Resources ------------------------------------------------------------------
await as(ADMIN)
await q(`insert into public.resources(category,name,url) values('insurance','Insurer','https://ins.example'),('kitchen','Hidden kitchen',null)`)
await q(`update public.resources set is_published=false where name='Hidden kitchen'`)
await asAnon()
await expect("Public reads published resources", async () => (await rows(`select * from public.resources where name='Insurer'`)).length === 1, true)
await expect("Public can't see unpublished resources", async () => (await rows(`select * from public.resources where name='Hidden kitchen'`)).length > 0, false)
await expect("Public cannot add resources", async () => { await q(`insert into public.resources(category,name) values('other','Spam')`) }, false)
await as(B)
await expect("Vendor cannot add resources", async () => { await q(`insert into public.resources(category,name) values('other','Spam')`) }, false)
await expect("Vendor cannot feature a resource", async () => (await rows(`update public.resources set is_featured=true returning id`)).length > 0, false)
await expect("Resource links must be web addresses", async () => { await db.exec(`reset role; set request.jwt.claim.sub=''`); await q(`insert into public.resources(category,name,url) values('other','x','javascript:alert(1)')`) }, false)

// --- Partners -------------------------------------------------------------------
await as(ADMIN)
const partnerId = (await rows(`insert into public.resources(category,name,is_partner,promo_code,promo_text) values('insurance','Partner Insurer',true,'STALL10','10% off') returning id`))[0].id
await expect("Admin saves private partner terms", async () => { await q(`insert into public.resource_partner_details(resource_id,referral_url,commission_terms) values($1,'https://partner.example/?ref=stallpass','$20 per signup')`, [partnerId]) }, true)
await asAnon()
await expect("Public sees the promo code", async () => (await rows(`select promo_code from public.resources where id=$1`, [partnerId]))[0].promo_code === "STALL10", true)
await expect("Public cannot see commission terms", async () => { await q(`select * from public.resource_partner_details`) }, false)
await expect("Public cannot log fake clicks", async () => { await q(`insert into public.resource_events(resource_id,event) values($1,'click')`, [partnerId]) }, false)
await as(B)
await expect("Vendor cannot see commission terms", async () => (await rows(`select * from public.resource_partner_details`)).length > 0, false)
await expect("Vendor cannot log fake signups", async () => { await q(`insert into public.resource_events(resource_id,event,user_id) values($1,'signup_reported',$2)`, [partnerId, B]) }, false)
await expect("Vendor cannot read click stats", async () => (await rows(`select * from public.resource_events`)).length > 0, false)
await as(O)
await expect("Organizer cannot see commission terms", async () => (await rows(`select * from public.resource_partner_details`)).length > 0, false)
await db.exec(`reset role; set request.jwt.claim.sub=''`)
await q(`insert into public.resource_events(resource_id,event,user_id) values($1,'signup_reported',$2)`, [partnerId, B])
await expect("Same person can't report signing up twice", async () => { await q(`insert into public.resource_events(resource_id,event,user_id) values($1,'signup_reported',$2)`, [partnerId, B]) }, false)
await as(ADMIN)
await expect("Admin reads partner stats", async () => (await rows(`select * from public.resource_events where resource_id=$1`, [partnerId])).length === 1, true)

// --- Shoppers ---------------------------------------------------------------------
const S = "00000000-0000-0000-0000-0000000000f1", S2 = "00000000-0000-0000-0000-0000000000f2"
await db.exec(`reset role; set request.jwt.claim.sub=''`)
await q(`insert into auth.users values ($1,'s@x.com'),($2,'s2@x.com')`, [S, S2])
await q(`update public.profiles set full_name='Maria Gonzalez Lopez' where id=$1`, [S])
await as(S)
await expect("Shopper can set home ZIP and shopper flag", async () => { await q(`update public.profiles set is_shopper=true, home_zip='90026' where id=$1`, [S]) }, true)
await expect("Home ZIP must be 5 digits", async () => { await q(`update public.profiles set home_zip='abc' where id=$1`, [S]) }, false)
let srId
await expect("Shopper reviews a market", async () => { await db.exec(`reset role; set request.jwt.claim.sub=''`); await as(S); const r = (await q(`insert into public.shopper_reviews(market_id,user_id,visited_on,rating_overall,body) values($1,$2,current_date - 3,4,'Nice market') returning id, display_name`, [m1.id, S])).rows[0]; srId = r.id; return r.display_name === "Maria G." }, true)
await expect("Only one review per market per shopper", async () => { await q(`insert into public.shopper_reviews(market_id,user_id,visited_on,rating_overall) values($1,$2,current_date - 1,5)`, [m1.id, S]) }, false)
await expect("Can't review a future visit", async () => { await q(`insert into public.shopper_reviews(market_id,user_id,visited_on,rating_overall) values($1,$2,current_date + 5,5)`, [m2, S]) }, false)
await expect("Can't review as someone else", async () => { await q(`insert into public.shopper_reviews(market_id,user_id,visited_on,rating_overall) values($1,$2,current_date - 1,5)`, [m2, S2]) }, false)
await expect("Can't review a pending market", async () => { await db.exec(`reset role; set request.jwt.claim.sub=''`); const pm = (await q(`insert into public.markets(slug,name,address,city,lat,lng) values('pend-s','P','x','LA',34,-118) returning id`)).rows[0].id; await as(S); await q(`insert into public.shopper_reviews(market_id,user_id,visited_on,rating_overall) values($1,$2,current_date - 1,5)`, [pm, S]) }, false)
await expect("Shopper can't fake the display name", async () => (await rows(`update public.shopper_reviews set display_name='Chef Gordon' where id=$1 returning id`, [srId])).length > 0, false)
await expect("Shopper can't un-hide their own review", async () => { await q(`update public.shopper_reviews set is_hidden=false where id=$1`, [srId]) }, false)
await expect("Shopper can't write the organizer reply", async () => { await q(`update public.shopper_reviews set organizer_reply='x' where id=$1`, [srId]) }, false)
// spam brake: 5 a day
await db.exec(`reset role; set request.jwt.claim.sub=''`)
const extra = []
for (let i = 0; i < 5; i++) extra.push((await q(`insert into public.markets(slug,name,address,city,lat,lng,approval_status) values($1,'M','x','LA',34,-118,'approved') returning id`, [`spam-${i}`])).rows[0].id)
await as(S2)
let madeIt = 0
for (const mk of extra) { try { await q(`insert into public.shopper_reviews(market_id,user_id,visited_on,rating_overall) values($1,$2,current_date - 1,5)`, [mk, S2]); madeIt++ } catch {} }
await expect("No more than 5 shopper reviews a day", async () => madeIt === 5, true)
await expect("The 6th review that day is blocked", async () => { await q(`insert into public.shopper_reviews(market_id,user_id,visited_on,rating_overall) values($1,$2,current_date - 1,5)`, [m2, S2]) }, false)
await as(O)
await expect("Organizer can't review own market as a shopper", async () => { await q(`insert into public.shopper_reviews(market_id,user_id,visited_on,rating_overall) values($1,$2,current_date - 1,5)`, [m2, O]) }, false)
await expect("Organizer can't see who wrote shopper reviews", async () => (await rows(`select user_id from public.shopper_reviews`)).length > 0, false)
await expect("Organizer replies to a shopper review of own market", async () => { await q(`select public.reply_to_shopper_review($1,'Thanks for visiting!')`, [srId]) }, true)
await as(O2)
await expect("Other organizer can't reply", async () => { await q(`select public.reply_to_shopper_review($1,'x')`, [srId]) }, false)
await asAnon()
await expect("Public reads shopper reviews", async () => (await rows(`select * from public.market_shopper_reviews where id=$1`, [srId])).length === 1, true)
await expect("Public shopper review has no user id", async () => !("user_id" in (await rows(`select * from public.market_shopper_reviews where id=$1`, [srId]))[0]), true)
await expect("Public can't read the shopper reviews table", async () => { await q(`select * from public.shopper_reviews`) }, false)
await expect("Signed-out visitors can't post shopper reviews", async () => { await q(`insert into public.shopper_reviews(market_id,user_id,visited_on,rating_overall) values($1,$2,current_date - 1,5)`, [m2, S]) }, false)
await as(B)
await expect("Non-admin can't hide shopper reviews", async () => { await q(`select public.admin_set_shopper_review_hidden($1,true,'x')`, [srId]) }, false)
await as(ADMIN)
await expect("Admin hides a shopper review", async () => { await q(`select public.admin_set_shopper_review_hidden($1,true,'Spam')`, [srId]) }, true)
await asAnon()
await expect("Hidden shopper review disappears", async () => (await rows(`select * from public.market_shopper_reviews where id=$1`, [srId])).length === 0, true)
await as(B)
await expect("Vendor can't mark a market as USDA-imported", async () => { await q(`update public.markets set source='usda' where id=$1`, [m2]) }, false)

// --- Suspensions -----------------------------------------------------------------
await as(B)
await expect("Non-admin can't suspend anyone", async () => { await q(`select public.admin_set_suspended($1,true,'x')`, [A]) }, false)
await as(ADMIN)
await expect("Admin can't suspend themselves", async () => { await q(`select public.admin_set_suspended($1,true,'x')`, [ADMIN]) }, false)
await expect("Admin suspends vendor B", async () => { await q(`select public.admin_set_suspended($1,true,'Fake documents')`, [B]) }, true)
await expect("Suspension is in the audit log", async () => (await rows(`select * from public.admin_audit_log where action='suspend_user'`)).length === 1, true)
await as(B)
await expect("Suspended vendor can't apply to markets", async () => { await q(`insert into public.applications(vendor_id,market_id,event_dates) values($1,$2,$3)`, [vB, m1.id, ["2099-03-01"]]) }, false)
await expect("Suspended user can't post shopper reviews", async () => { await q(`insert into public.shopper_reviews(market_id,user_id,visited_on,rating_overall) values($1,$2,current_date - 1,5)`, [m3, B]) }, false)
await expect("Suspended user can't claim markets", async () => { await db.exec(`reset role; set request.jwt.claim.sub=''`); const mm = (await q(`insert into public.markets(slug,name,address,city,lat,lng,approval_status) values('susp-claim','M','x','LA',34,-118,'approved') returning id`)).rows[0].id; await as(B); await q(`insert into public.market_claims(market_id,user_id,role) values($1,$2,'Owner')`, [mm, B]) }, false)
await expect("Suspended user can't unsuspend themselves", async () => { await q(`update public.profiles set suspended_at=null where id=$1`, [B]) }, false)
await as(ADMIN)
await q(`select public.admin_set_suspended($1,true,'Abuse')`, [O])
await as(O)
await expect("Suspended organizer loses control of their market", async () => { await q(`select public.organizer_set_booth($1,'Z9')`, [appB]) }, false)
await as(ADMIN)
await expect("Admin unsuspends", async () => { await q(`select public.admin_set_suspended($1,false,null)`, [B]); await q(`select public.admin_set_suspended($1,false,null)`, [O]) }, true)
await as(O)
await expect("Unsuspended organizer is back in control", async () => { await q(`select public.organizer_set_booth($1,'Z9')`, [appB]) }, true)

// --- Suspended admin loses powers -----------------------------------------
await db.exec(`reset role; set request.jwt.claim.sub=''`)
await q(`update public.profiles set suspended_at=now() where id=$1`, [ADMIN])
await as(ADMIN)
await expect("Suspended admin cannot edit markets", async () => (await rows(`update public.markets set name='x' returning id`)).length > 0, false)

console.log(`\n${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
