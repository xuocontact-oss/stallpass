/**
 * Sample data for local testing.  Run:  npm run seed
 *
 * Creates sample vendor accounts (password below) with documents, and sample
 * markets around Los Angeles. Everything is marked as SAMPLE in the app.
 * Safe to run again: it removes the previous sample data first and never
 * touches anything else.
 *
 * DEVELOPMENT ONLY. Do not run this against your live database.
 */
import { createClient } from "@supabase/supabase-js"
import { addDays, todayISO } from "../src/lib/dates.ts"
import { repeatingDates } from "../src/lib/markets.ts"

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const secretKey = process.env.SUPABASE_SECRET_KEY
if (!url || !secretKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in .env.local")
  process.exit(1)
}
// Safety lock: sample data only ever goes into a TEST project.
const site = process.env.NEXT_PUBLIC_SITE_URL ?? ""
if (!site.startsWith("http://localhost") && process.env.ALLOW_SAMPLE_DATA !== "yes") {
  console.error(
    `Refusing to add sample data: NEXT_PUBLIC_SITE_URL is "${site}", which looks like a live site.\n` +
      "Sample data is only for your test project. (If this really is a test project, run with ALLOW_SAMPLE_DATA=yes.)"
  )
  process.exit(1)
}

const db = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } })

const PASSWORD = "stallpass-demo-2026"
const today = todayISO()

/** Waits for a Supabase call and stops the script with a clear message if it failed. */
async function must<R extends { data: unknown; error: { message: string } | null }>(
  p: PromiseLike<R>,
  what: string
): Promise<NonNullable<R["data"]>> {
  const { data, error } = await p
  if (error) throw new Error(`${what}: ${error.message}`)
  return data as NonNullable<R["data"]>
}

// A tiny one-page PDF that clearly says it's a sample.
function samplePdf(title: string): Uint8Array {
  const text = `SAMPLE DOCUMENT - ${title} - not a real permit`.replace(/[()\\]/g, "")
  const stream = `BT /F1 14 Tf 50 740 Td (${text}) Tj ET`
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ]
  let out = "%PDF-1.4\n"
  const offsets: number[] = []
  objs.forEach((o, i) => {
    offsets.push(out.length)
    out += `${i + 1} 0 obj\n${o}\nendobj\n`
  })
  const xref = out.length
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`
  out += offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
  return new TextEncoder().encode(out)
}

// ---------------------------------------------------------------------------
// Sample vendors
// ---------------------------------------------------------------------------

type SampleDoc = { type: string; title?: string; expiresInDays: number | null }

const VENDORS: {
  email: string
  name: string
  vendor: Record<string, unknown>
  docs: SampleDoc[]
}[] = [
  {
    email: "demo-tacos@example.com",
    name: "Maria (sample)",
    vendor: {
      business_name: "Sample: La Esquina Tacos",
      category: "tacos_mexican",
      setup_type: "truck",
      needs_power: false,
      needs_water: true,
      description: "Family taco truck since 2019. Handmade tortillas, carne asada and al pastor off the trompo.",
      menu: "Carne asada taco – $4\nAl pastor taco – $4\nQuesabirria (3) – $14\nHorchata – $5",
      setup_notes: "22 ft truck, own generator, needs 30 ft of frontage",
      instagram: "@laesquina.sample",
      service_area: "LA County",
    },
    // A mix so the dashboard shows every status.
    docs: [
      { type: "health_permit", title: "LA County mobile food permit", expiresInDays: 200 },
      { type: "liability_insurance", title: "COI – $1M general liability", expiresInDays: 12 },
      { type: "business_license", expiresInDays: -20 },
      { type: "food_handler_card", title: "Maria", expiresInDays: 5 },
    ],
  },
  {
    email: "demo-bakery@example.com",
    name: "Sam (sample)",
    vendor: {
      business_name: "Sample: Golden Hour Bakery",
      category: "baked_goods",
      setup_type: "tent",
      description: "Sourdough, croissants and seasonal fruit galettes baked the morning of every market.",
      menu: "Country sourdough – $12\nCroissant – $5\nSeasonal galette – $7",
      instagram: "@goldenhour.sample",
      service_area: "Westside and South Bay",
    },
    docs: [
      { type: "health_permit", expiresInDays: 300 },
      { type: "liability_insurance", expiresInDays: 150 },
      { type: "sellers_permit", expiresInDays: null },
      { type: "food_handler_card", expiresInDays: 400 },
    ],
  },
  {
    email: "demo-coffee@example.com",
    name: "Alex (sample)",
    vendor: {
      business_name: "Sample: Night Owl Coffee Cart",
      category: "coffee_drinks",
      setup_type: "cart",
      needs_power: true,
      description: "Espresso cart with oat-milk lattes and cold brew on tap.",
      service_area: "Eastside, Pasadena",
    },
    docs: [{ type: "health_permit", expiresInDays: 25 }],
  },
  {
    email: "demo-bbq@example.com",
    name: "Dre (sample)",
    vendor: {
      business_name: "Sample: Smoke Signal BBQ",
      category: "bbq_grill",
      setup_type: "trailer",
      needs_power: false,
      description: "Texas-style brisket and ribs from an offset smoker trailer.",
      service_area: "LA and Orange County",
    },
    docs: [
      { type: "health_permit", expiresInDays: 180 },
      { type: "liability_insurance", expiresInDays: 240 },
    ],
  },
  {
    email: "demo-vegan@example.com",
    name: "Priya (sample)",
    vendor: {
      business_name: "Sample: Green Plate Kitchen",
      category: "vegan",
      setup_type: "tent",
      needs_power: true,
      description: "Plant-based bowls and wraps.",
      service_area: "Westside, Eastside",
    },
    docs: [{ type: "health_permit", expiresInDays: 90 }],
  },
  {
    email: "demo-dumplings@example.com",
    name: "Kevin (sample)",
    vendor: {
      business_name: "Sample: Dumpling Bros",
      category: "asian",
      setup_type: "tent",
      needs_power: true,
      description: "Hand-folded pork and chive dumplings, pan-fried to order.",
      service_area: "San Gabriel Valley",
    },
    docs: [{ type: "health_permit", expiresInDays: 120 }],
  },
  {
    email: "demo-icecream@example.com",
    name: "Lina (sample)",
    vendor: {
      business_name: "Sample: Paleta Paradise",
      category: "frozen_treats",
      setup_type: "cart",
      description: "Fresh fruit paletas and ice cream sandwiches.",
      service_area: "All over LA",
    },
    docs: [{ type: "health_permit", expiresInDays: 210 }],
  },
]

VENDORS.push({
  email: "demo-vintage@example.com",
  name: "Jess (sample)",
  vendor: {
    business_name: "Sample: Thread & Thrift Vintage",
    category: "vintage",
    setup_type: "tent",
    description: "Hand-picked 70s–90s denim, band tees and jackets. Racks, mirror and a changing tent.",
    menu: "Vintage denim – $35–$65\nBand tees – $20–$45\nJackets – $40–$120",
    instagram: "@threadandthrift.sample",
    service_area: "All of LA",
  },
  docs: [
    { type: "sellers_permit", expiresInDays: null },
    { type: "liability_insurance", title: "COI – $1M general + product liability", expiresInDays: 220 },
    { type: "business_license", expiresInDays: 18 },
  ],
})

const ORGANIZER = { email: "demo-organizer@example.com", name: "Jordan (sample organizer)" }
// Sample shoppers who review markets (names shown as "Maria G.").
const SHOPPERS = [
  { email: "demo-shopper@example.com", name: "Maria Gonzalez", zip: "90026" },
  { email: "demo-shopper2@example.com", name: "Tom Becker", zip: "91101" },
]
// A newer organizer whose claim and new market are waiting for admin approval.
const ORGANIZER2 = { email: "demo-organizer2@example.com", name: "Riley (sample organizer)" }
// The one sample market that is "on Stallpass" (claimed by the sample organizer).
const CLAIMED_SLUG = "sample-dtla-night-bazaar"

// ---------------------------------------------------------------------------
// Sample markets (fictional; locations are real neighborhoods)
// ---------------------------------------------------------------------------

const STD_DOCS = ["health_permit", "liability_insurance"]

const MARKETS: {
  slug: string
  name: string
  market_type: string
  organizer_name: string
  address: string
  city: string
  zip: string
  lat: number
  lng: number
  schedule_summary: string
  description: string
  weekdays: number[]
  starts_at: string
  ends_at: string
  fees: [string, number][]
  required: string[]
  categories: string[]
  deadlineInDays?: number
}[] = [
  {
    slug: "sample-echo-lake-sunday-market",
    name: "Echo Lake Sunday Market",
    market_type: "farmers",
    organizer_name: "Eastside Markets Co. (sample)",
    address: "1632 Bellevue Ave",
    city: "Los Angeles",
    zip: "90026",
    lat: 34.0781,
    lng: -118.2606,
    schedule_summary: "Every Sunday, 9am–2pm",
    description: "Neighborhood farmers market by the lake, about 60 vendors and steady family foot traffic all morning.",
    weekdays: [0],
    starts_at: "09:00",
    ends_at: "14:00",
    fees: [["10x10 tent", 65], ["Hot food tent", 85]],
    required: [...STD_DOCS, "sellers_permit"],
    categories: ["produce", "baked_goods", "coffee_drinks", "packaged"],
  },
  {
    slug: "sample-dtla-night-bazaar",
    name: "DTLA Night Bazaar",
    market_type: "night",
    organizer_name: "Arts District Nights (sample)",
    address: "800 E 4th Pl",
    city: "Los Angeles",
    zip: "90013",
    lat: 34.0434,
    lng: -118.2359,
    schedule_summary: "Fridays, 6pm–11pm",
    description: "Big night market in the Arts District with DJs, 120+ vendors and a young crowd that comes hungry.",
    weekdays: [5],
    starts_at: "18:00",
    ends_at: "23:00",
    fees: [["10x10 tent", 150], ["Food truck", 250]],
    required: [...STD_DOCS, "business_license"],
    categories: ["tacos_mexican", "asian", "bbq_grill", "frozen_treats", "coffee_drinks"],
    deadlineInDays: 10,
  },
  {
    slug: "sample-santa-monica-pier-pop-up",
    name: "Ocean Park Pop-Up",
    market_type: "popup",
    organizer_name: "Westside Pop-Ups (sample)",
    address: "2600 Barnard Way",
    city: "Santa Monica",
    zip: "90405",
    lat: 34.0012,
    lng: -118.4839,
    schedule_summary: "Saturdays, 10am–4pm",
    description: "Beachside pop-up with lots of tourists and weekend bike traffic. Great for grab-and-go food.",
    weekdays: [6],
    starts_at: "10:00",
    ends_at: "16:00",
    fees: [["10x10 tent", 120]],
    required: STD_DOCS,
    categories: [],
  },
  {
    slug: "sample-pasadena-craft-and-food-fair",
    name: "Old Town Pasadena Food Fair",
    market_type: "farmers",
    organizer_name: "Arroyo Events (sample)",
    address: "100 W Colorado Blvd",
    city: "Pasadena",
    zip: "91105",
    lat: 34.1456,
    lng: -118.1514,
    schedule_summary: "Saturdays, 8am–1pm",
    description: "Well-organized market with an early crowd of regulars. Organizer sends load-in maps the week before.",
    weekdays: [6],
    starts_at: "08:00",
    ends_at: "13:00",
    fees: [["10x10 tent", 75], ["10x20 tent", 140]],
    required: [...STD_DOCS, "food_handler_card"],
    categories: ["produce", "baked_goods", "packaged", "vegan", "mediterranean"],
  },
  {
    slug: "sample-long-beach-food-truck-fridays",
    name: "Long Beach Truck Fridays",
    market_type: "food_truck",
    organizer_name: "Harbor Truck Collective (sample)",
    address: "5000 E 2nd St",
    city: "Long Beach",
    zip: "90803",
    lat: 33.7598,
    lng: -118.1409,
    schedule_summary: "Fridays, 5pm–9pm",
    description: "15–20 trucks, picnic tables and live music. Trucks only.",
    weekdays: [5],
    starts_at: "17:00",
    ends_at: "21:00",
    fees: [["Food truck", 60]],
    required: [...STD_DOCS, "business_license"],
    categories: ["tacos_mexican", "bbq_grill", "burgers_sandwiches", "asian", "seafood"],
  },
  {
    slug: "sample-burbank-weekend-market",
    name: "Magnolia Park Weekend Market",
    market_type: "popup",
    organizer_name: "Valley Vendors (sample)",
    address: "3200 W Magnolia Blvd",
    city: "Burbank",
    zip: "91505",
    lat: 34.1682,
    lng: -118.3405,
    schedule_summary: "1st and 3rd Sunday, 10am–3pm",
    description: "Vintage shops plus food vendors on a closed-off street. Relaxed and friendly.",
    weekdays: [0],
    starts_at: "10:00",
    ends_at: "15:00",
    fees: [["10x10 tent", 55]],
    required: STD_DOCS,
    categories: [],
  },
  {
    slug: "sample-culver-city-twilight-market",
    name: "Culver City Twilight Market",
    market_type: "night",
    organizer_name: "Culver Nights (sample)",
    address: "9300 Culver Blvd",
    city: "Culver City",
    zip: "90232",
    lat: 34.0236,
    lng: -118.3945,
    schedule_summary: "Thursdays, 4pm–9pm",
    description: "After-work crowd from the studios and offices nearby. Dinner food does best.",
    weekdays: [4],
    starts_at: "16:00",
    ends_at: "21:00",
    fees: [["10x10 tent", 90], ["Food truck", 175]],
    required: [...STD_DOCS, "business_license", "sellers_permit"],
    categories: ["asian", "mediterranean", "pizza_italian", "vegan", "frozen_treats"],
  },
  {
    slug: "sample-sgv-lantern-night-market",
    name: "San Gabriel Lantern Night Market",
    market_type: "night",
    organizer_name: "SGV Night Markets (sample)",
    address: "250 S Mission Dr",
    city: "San Gabriel",
    zip: "91776",
    lat: 34.0967,
    lng: -118.1067,
    schedule_summary: "Saturdays, 5pm–11pm (summer and fall)",
    description: "Huge crowds and long lines. Bring double the inventory you think you need.",
    weekdays: [6],
    starts_at: "17:00",
    ends_at: "23:00",
    fees: [["10x10 tent", 200], ["Food truck", 300]],
    required: [...STD_DOCS, "business_license", "food_handler_card"],
    categories: ["asian", "frozen_treats", "coffee_drinks", "bbq_grill"],
    deadlineInDays: 20,
  },
  {
    slug: "sample-torrance-farmers-market",
    name: "Del Amo Farmers Market",
    market_type: "farmers",
    organizer_name: "South Bay Growers (sample)",
    address: "2200 Crenshaw Blvd",
    city: "Torrance",
    zip: "90501",
    lat: 33.8303,
    lng: -118.3272,
    schedule_summary: "Tuesdays and Saturdays, 8am–1pm",
    description: "Classic certified farmers market with a small prepared-food section.",
    weekdays: [2, 6],
    starts_at: "08:00",
    ends_at: "13:00",
    fees: [["10x10 tent", 45]],
    required: [...STD_DOCS, "sellers_permit"],
    categories: ["produce", "baked_goods", "packaged"],
  },
  {
    slug: "sample-sherman-oaks-summer-festival",
    name: "Valley Summer Food Fest",
    market_type: "festival",
    organizer_name: "Valley Vendors (sample)",
    address: "14300 Ventura Blvd",
    city: "Sherman Oaks",
    zip: "91423",
    lat: 34.1522,
    lng: -118.4449,
    schedule_summary: "One weekend only",
    description: "Two-day festival with ticketed entry, 8,000+ visitors expected. Vendors must stay both days.",
    weekdays: [],
    starts_at: "11:00",
    ends_at: "20:00",
    fees: [["10x10 tent (both days)", 450], ["Food truck (both days)", 650]],
    required: [...STD_DOCS, "business_license", "sellers_permit", "food_handler_card"],
    categories: [],
    deadlineInDays: 14,
  },
  {
    slug: "sample-anaheim-packing-district-pop-up",
    name: "Anaheim Packing Yard Pop-Up",
    market_type: "popup",
    organizer_name: "OC Makers (sample)",
    address: "440 S Anaheim Blvd",
    city: "Anaheim",
    zip: "92805",
    lat: 33.8319,
    lng: -117.9118,
    schedule_summary: "Last Sunday of the month, 11am–5pm",
    description: "Monthly pop-up in a historic packing-house lawn. Great for desserts and drinks.",
    weekdays: [0],
    starts_at: "11:00",
    ends_at: "17:00",
    fees: [["10x10 tent", 100]],
    required: STD_DOCS,
    categories: ["baked_goods", "frozen_treats", "coffee_drinks", "packaged"],
  },
  {
    slug: "sample-silver-lake-makers-market",
    name: "Silver Lake Makers Market",
    market_type: "craft",
    organizer_name: "Eastside Makers (sample)",
    address: "3200 Sunset Blvd",
    city: "Los Angeles",
    zip: "90026",
    lat: 34.0877,
    lng: -118.2721,
    schedule_summary: "2nd Saturday of the month, 11am–5pm",
    description: "Handmade goods, art, jewelry and vintage, with a couple of coffee and dessert vendors. Shoppers come to browse and buy gifts.",
    weekdays: [6],
    starts_at: "11:00",
    ends_at: "17:00",
    fees: [["10x10 booth", 85], ["Half booth (6ft table)", 50]],
    required: ["liability_insurance", "sellers_permit"],
    categories: ["clothing", "jewelry", "art", "crafts", "vintage", "beauty", "home_goods", "coffee_drinks", "baked_goods"],
  },
  {
    slug: "sample-long-beach-flea",
    name: "Long Beach Vintage Flea",
    market_type: "flea",
    organizer_name: "Harbor Flea Co. (sample)",
    address: "4901 E Conant St",
    city: "Long Beach",
    zip: "90808",
    lat: 33.8197,
    lng: -118.1427,
    schedule_summary: "3rd Sunday of the month, 6:30am–2pm",
    description: "Huge monthly vintage and antiques flea with serious collectors who arrive at dawn. Clothing and furniture sell well.",
    weekdays: [0],
    starts_at: "06:30",
    ends_at: "14:00",
    fees: [["Standard space", 75], ["Corner space", 100]],
    required: ["sellers_permit"],
    categories: ["vintage", "clothing", "home_goods", "art", "jewelry"],
  },
  {
    slug: "sample-hollywood-rooftop-market",
    name: "Hollywood Rooftop Market",
    market_type: "night",
    organizer_name: "Sunset Social (sample)",
    address: "6200 Hollywood Blvd",
    city: "Los Angeles",
    zip: "90028",
    lat: 34.1016,
    lng: -118.3252,
    schedule_summary: "Wednesdays, 6pm–10pm",
    description: "Small, curated rooftop market. 25 vendors max, no trucks.",
    weekdays: [3],
    starts_at: "18:00",
    ends_at: "22:00",
    fees: [["6ft table", 80]],
    required: STD_DOCS,
    categories: ["vegan", "baked_goods", "coffee_drinks", "mediterranean"],
  },
]

// Some markets only run on certain weeks.
function datesFor(m: (typeof MARKETS)[number]): string[] {
  const end = addDays(today, 84) // next 12 weeks
  if (m.weekdays.length === 0) {
    const sat = repeatingDates(addDays(today, 21), addDays(today, 28), [6])[0]
    return [sat, addDays(sat, 1)]
  }
  // Past 10 weeks too, so there are events to review.
  const all = repeatingDates(addDays(today, -70), end, m.weekdays)
  if (m.slug.includes("burbank")) {
    return all.filter((d) => {
      const day = Number(d.slice(8, 10))
      return day <= 7 || (day >= 15 && day <= 21)
    })
  }
  if (m.slug.includes("makers")) return all.filter((d) => { const day = Number(d.slice(8, 10)); return day >= 8 && day <= 14 })
  if (m.slug.includes("flea")) return all.filter((d) => { const day = Number(d.slice(8, 10)); return day >= 15 && day <= 21 })
  if (m.slug.includes("anaheim")) {
    return all.filter((d) => addDays(d, 7).slice(5, 7) !== d.slice(5, 7))
  }
  return all
}

// ---------------------------------------------------------------------------

/** Every file under a storage folder, including sub-folders. */
async function listAll(bucket: string, folder: string): Promise<string[]> {
  const { data } = await db.storage.from(bucket).list(folder, { limit: 1000 })
  const out: string[] = []
  for (const f of data ?? []) {
    const path = `${folder}/${f.name}`
    if (f.id) out.push(path)
    else out.push(...(await listAll(bucket, path))) // a folder
  }
  return out
}

async function removeOldSampleData() {
  const emails = new Set([...VENDORS.map((v) => v.email), ORGANIZER.email, ORGANIZER2.email, ...SHOPPERS.map((x) => x.email)])
  const { data: users } = await db.auth.admin.listUsers({ perPage: 1000 })
  for (const u of users?.users ?? []) {
    if (!u.email || !emails.has(u.email)) continue
    const { data: vendor } = await db.from("vendors").select("id").eq("owner_id", u.id).maybeSingle()
    if (vendor) {
      for (const bucket of ["vendor-documents", "vendor-photos", "vendor-menus"]) {
        const files = await listAll(bucket, vendor.id)
        if (files.length) await db.storage.from(bucket).remove(files)
      }
    }
    await must(db.auth.admin.deleteUser(u.id), `delete ${u.email}`)
  }
  await must(db.from("markets").delete().eq("is_sample", true), "delete sample markets")
  await must(db.from("resources").delete().eq("is_sample", true), "delete sample resources")
}

async function main() {
  console.log("Removing old sample data…")
  await removeOldSampleData()

  const vendorIds = new Map<string, string>()
  const vendorDocs = new Map<string, { id: string; doc_type: string; title: string | null; file_path: string; file_name: string; issue_date: string | null; expiration_date: string | null }[]>()
  const marketIds = new Map<string, string>()
  const marketDates = new Map<string, string[]>()

  console.log("Creating sample vendors…")
  for (const v of VENDORS) {
    const { user } = await must(
      db.auth.admin.createUser({ email: v.email, password: PASSWORD, email_confirm: true }),
      `create ${v.email}`
    )
    await must(db.from("profiles").update({ full_name: v.name }).eq("id", user!.id), "profile")
    const vendor = await must(
      db.from("vendors").insert({ ...v.vendor, owner_id: user!.id, is_sample: true }).select("id").single(),
      `vendor ${v.email}`
    )
    vendorIds.set(v.email, vendor.id)
    vendorDocs.set(v.email, [])
    for (const d of v.docs) {
      const path = `${vendor.id}/${crypto.randomUUID()}.pdf`
      await must(
        db.storage.from("vendor-documents").upload(path, samplePdf(d.title ?? d.type), { contentType: "application/pdf" }),
        "upload"
      )
      const expires = d.expiresInDays == null ? null : addDays(today, d.expiresInDays)
      const doc = await must(
        db
          .from("vendor_documents")
          .insert({
            vendor_id: vendor.id,
            doc_type: d.type,
            title: d.title ?? null,
            file_path: path,
            file_name: `sample-${d.type.replace(/_/g, "-")}.pdf`,
            issue_date: expires ? addDays(expires, -365) : addDays(today, -200),
            expiration_date: expires,
          })
          .select("id, doc_type, title, file_path, file_name, issue_date, expiration_date")
          .single(),
        "document"
      )
      vendorDocs.get(v.email)!.push(doc)
    }
    console.log(`  ${v.email}`)
  }

  console.log("Creating sample markets…")
  for (const m of MARKETS) {
    const market = await must(
      db
        .from("markets")
        .insert({
          slug: m.slug,
          name: m.name,
          market_type: m.market_type,
          organizer_name: m.organizer_name,
          address: m.address,
          city: m.city,
          state: "CA",
          zip: m.zip,
          lat: m.lat,
          lng: m.lng,
          schedule_summary: m.schedule_summary,
          description: `${m.description}\n\n(Sample market for testing. Not a real event.)`,
          booth_fees: m.fees.map(([label, dollars]) => ({ label, amount_cents: dollars * 100 })),
          required_doc_types: m.required,
          categories_wanted: m.categories,
          application_deadline: m.deadlineInDays ? addDays(today, m.deadlineInDays) : null,
          is_sample: true,
          approval_status: "approved",
        })
        .select("id")
        .single(),
      `market ${m.name}`
    )
    await must(
      db.from("market_contacts").insert({
        market_id: market.id,
        contact_name: "Sample Organizer",
        contact_email: `organizer+${m.slug}@example.com`,
      }),
      "contact"
    )
    const dates = datesFor(m)
    marketIds.set(m.slug, market.id)
    marketDates.set(m.slug, dates)
    if (dates.length) {
      await must(
        db.from("market_dates").insert(
          dates.map((d) => ({ market_id: market.id, event_date: d, starts_at: m.starts_at, ends_at: m.ends_at }))
        ),
        "dates"
      )
    }
    console.log(`  ${m.name} (${dates.length} dates)`)
  }

  // --- Sample organizer (claims one market) ---------------------------------
  const { user: organizer } = await must(
    db.auth.admin.createUser({ email: ORGANIZER.email, password: PASSWORD, email_confirm: true }),
    "create organizer"
  )
  await must(db.from("profiles").update({ full_name: ORGANIZER.name, is_organizer: true }).eq("id", organizer!.id), "organizer profile")
  await must(db.from("markets").update({ organizer_id: organizer!.id }).eq("slug", CLAIMED_SLUG), "claim market")

  // --- Applications and reviews ----------------------------------------------
  const past = (slug: string, n: number) => marketDates.get(slug)!.filter((d) => d < today).reverse()[n]
  const future = (slug: string, n: number) => marketDates.get(slug)!.filter((d) => d >= today)[n]

  async function apply(opts: {
    vendor: string
    market: string
    dates: (string | undefined)[]
    status: string
    source?: "vendor" | "organizer" | "admin"
    verified?: boolean
    via?: "platform" | "email" | null
    attach?: boolean
    booth?: string
  }) {
    const dates = opts.dates.filter(Boolean) as string[]
    if (!dates.length) return null
    const vendorId = vendorIds.get(opts.vendor)!
    const sent = opts.status !== "draft"
    const app = await must(
      db
        .from("applications")
        .insert({
          vendor_id: vendorId,
          market_id: marketIds.get(opts.market)!,
          status: opts.status,
          status_source: opts.source ?? "vendor",
          event_dates: dates.sort(),
          booth_choice: null,
          note: opts.vendor === "demo-tacos@example.com" ? "We bring our own generator and can stay late for cleanup." : null,
          delivered_via: sent ? (opts.via ?? "email") : null,
          emailed_at: sent && (opts.via ?? "email") === "email" ? new Date().toISOString() : null,
          share_token: sent && (opts.via ?? "email") === "email" ? crypto.randomUUID().replace(/-/g, "") : null,
          share_expires_at: sent ? addDays(today, 14) : null,
          verified_at: opts.verified ? new Date().toISOString() : null,
          booth_number: opts.booth ?? null,
          submitted_at: sent ? new Date(Date.now() - 20 * 86_400_000).toISOString() : null,
        })
        .select("id")
        .single(),
      "application"
    )
    if (opts.attach) {
      for (const doc of vendorDocs.get(opts.vendor)!) {
        const copyPath = `${vendorId}/applications/${app.id}/${crypto.randomUUID()}.pdf`
        await must(db.storage.from("vendor-documents").copy(doc.file_path, copyPath), "copy document")
        await must(
          db.from("application_documents").insert({
            application_id: app.id,
            source_document_id: doc.id,
            doc_type: doc.doc_type,
            title: doc.title,
            file_path: copyPath,
            file_name: doc.file_name,
            issue_date: doc.issue_date,
            expiration_date: doc.expiration_date,
          }),
          "attach document"
        )
      }
    }
    return app.id as string
  }

  console.log("Creating sample applications…")
  const T = "demo-tacos@example.com"
  // The taco truck shows every kind of application.
  const echo = await apply({ vendor: T, market: "sample-echo-lake-sunday-market", dates: [past("sample-echo-lake-sunday-market", 1), future("sample-echo-lake-sunday-market", 1)], status: "accepted", verified: true, attach: true })
  await apply({ vendor: T, market: CLAIMED_SLUG, dates: [future(CLAIMED_SLUG, 1), future(CLAIMED_SLUG, 2)], status: "submitted", via: "platform", attach: true })
  await apply({ vendor: T, market: "sample-santa-monica-pier-pop-up", dates: [future("sample-santa-monica-pier-pop-up", 2)], status: "waitlisted", attach: true })
  await apply({ vendor: T, market: "sample-culver-city-twilight-market", dates: [future("sample-culver-city-twilight-market", 0)], status: "declined" })
  await apply({ vendor: T, market: "sample-long-beach-food-truck-fridays", dates: [past("sample-long-beach-food-truck-fridays", 0), future("sample-long-beach-food-truck-fridays", 0)], status: "accepted", attach: true }) // waits for admin verification
  await apply({ vendor: T, market: "sample-pasadena-craft-and-food-fair", dates: [future("sample-pasadena-craft-and-food-fair", 3)], status: "draft" })

  // What the sample organizer sees for DTLA Night Bazaar.
  const D = CLAIMED_SLUG
  await apply({ vendor: "demo-bbq@example.com", market: D, dates: [future(D, 1)], status: "submitted", via: "platform", attach: true })
  await apply({ vendor: "demo-coffee@example.com", market: D, dates: [future(D, 1), future(D, 2)], status: "submitted", via: "platform", attach: true })
  await apply({ vendor: "demo-icecream@example.com", market: D, dates: [future(D, 1)], status: "accepted", source: "organizer", via: "platform", attach: true, booth: "B4" })
  await apply({ vendor: "demo-vegan@example.com", market: D, dates: [future(D, 1), future(D, 2)], status: "accepted", source: "organizer", via: "platform", attach: true, booth: "A1" })
  await apply({ vendor: "demo-dumplings@example.com", market: D, dates: [future(D, 1)], status: "waitlisted", source: "organizer", via: "platform", attach: true })
  await apply({ vendor: "demo-bakery@example.com", market: D, dates: [future(D, 2)], status: "declined", source: "organizer", via: "platform", attach: true })

  // Payments: DTLA uses its own (sample) payment link; the organizer confirms "I've paid".
  await must(
    db
      .from("markets")
      .update({
        payment_method: "external_link",
        payment_link: "https://example.com/pay/dtla-night-bazaar-sample",
        payment_instructions: "Pay within 7 days of acceptance. Put your business name in the notes. (Sample link, goes nowhere.)",
      })
      .eq("slug", D),
    "dtla payment"
  )
  await must(
    db
      .from("markets")
      .update({ payment_method: "external_link", payment_link: "https://example.com/pay/echo-lake-sample" })
      .eq("slug", "sample-echo-lake-sunday-market"),
    "echo payment"
  )
  for (const [email, status] of [["demo-icecream@example.com", "confirmed"], ["demo-vegan@example.com", "reported"]] as const) {
    const { data: app } = await db
      .from("applications")
      .select("id, vendor_id, market_id")
      .eq("vendor_id", vendorIds.get(email)!)
      .eq("market_id", marketIds.get(D)!)
      .eq("status", "accepted")
      .single()
    if (!app) continue
    await must(
      db.from("payments").insert({
        application_id: app.id,
        market_id: app.market_id,
        vendor_id: app.vendor_id,
        method: "external_link",
        status,
        description: "Paid on the market's own payment page",
        paid_at: status === "confirmed" ? new Date().toISOString() : null,
      }),
      "payment"
    )
    if (status === "confirmed") await must(db.from("applications").update({ status: "paid" }).eq("id", app.id), "mark paid")
  }

  // Sample shared kitchens for the Start page (replace with real ones in Admin → Start hub).
  await must(
    db.from("resources").insert([
      { category: "kitchen", name: "Eastside Shared Kitchen", description: "Hourly prep space with walk-in fridge and dish station. Health-permit paperwork help included.", area: "Boyle Heights", price_note: "$25/hr · $180/day", is_sample: true, position: 1, is_partner: true, promo_text: "First 2 hours free for Stallpass vendors", promo_code: "STALLPASS2HR" },
      { category: "insurance", name: "Market Shield Insurance", description: "$1M general liability for food vendors, with free additional-insured certificates for every market.", area: "Online", price_note: "from $25/month", is_sample: true, position: 0, is_partner: true, promo_text: "15% off your first year", promo_code: "STALL15" },
      { category: "kitchen", name: "Valley Commissary & Truck Parking", description: "Commissary for food trucks and carts: overnight parking, water, grease disposal, prep tables.", area: "Van Nuys", price_note: "$450/month", is_sample: true, position: 2 },
      { category: "supplies", name: "LA Canopy & Booth Supply", description: "Fire-marshal-approved 10x10 canopies, leg weights, tables and display racks. Rent or buy.", area: "Commerce", price_note: "Canopy + weights from $189", is_sample: true, position: 1, is_partner: true, promo_text: "10% off your first canopy", promo_code: "STALLTENT10" },
      { category: "kitchen", name: "Westside Kitchen Co-op", description: "Bakery ovens and prep stations by the hour, weekend overnight slots available.", area: "Culver City", price_note: "$30/hr", is_sample: true, position: 3 },
    ], { defaultToNull: false }),
    "sample kitchens"
  )
  // Private deal terms + some example activity for the partner report.
  const { data: partners } = await db.from("resources").select("id, name").eq("is_sample", true).eq("is_partner", true)
  for (const p of partners ?? []) {
    await must(
      db.from("resource_partner_details").insert({
        resource_id: p.id,
        referral_url: `https://example.com/partner/${p.name.toLowerCase().replace(/[^a-z]+/g, "-")}?ref=stallpass`,
        commission_terms: p.name.includes("Insurance") ? "$20 per policy sold (sample deal)" : "$15 per new member (sample deal)",
        contact_name: "Sample Partner Contact",
        contact_email: "partners@example.com",
      }),
      "partner details"
    )
    const events = [...Array(14)].map((_, i) => ({ resource_id: p.id, event: "click", page: i % 3 ? "start" : "readiness" }))
    events.push(...[...Array(5)].map(() => ({ resource_id: p.id, event: "code_copy", page: "start" })))
    await must(db.from("resource_events").insert(events), "partner events")
  }

  // A second organizer: one claim and one brand-new market, both waiting for the admin.
  const { user: organizer2 } = await must(
    db.auth.admin.createUser({ email: ORGANIZER2.email, password: PASSWORD, email_confirm: true }),
    "create organizer 2"
  )
  await must(db.from("profiles").update({ full_name: ORGANIZER2.name, is_organizer: true }).eq("id", organizer2!.id), "organizer 2 profile")
  await must(
    db.from("market_claims").insert({
      market_id: marketIds.get("sample-echo-lake-sunday-market")!,
      user_id: organizer2!.id,
      role: "Market manager",
      evidence_url: "instagram.com/echolakesundaymarket.sample",
      message: "I've managed this market since 2021. Happy to confirm from our official email.",
    }),
    "claim"
  )
  const venice = await must(
    db
      .from("markets")
      .insert({
        slug: "sample-venice-boardwalk-night-market",
        name: "Venice Boardwalk Night Market",
        market_type: "night",
        organizer_name: "Riley (sample organizer)",
        organizer_id: organizer2!.id,
        created_by: organizer2!.id,
        address: "1800 Ocean Front Walk",
        city: "Venice",
        state: "CA",
        zip: "90291",
        lat: 33.985,
        lng: -118.4726,
        schedule_summary: "First Friday of the month, 6pm–10pm",
        description: "New monthly night market on the boardwalk.\n\n(Sample market for testing. Not a real event.)",
        booth_fees: [{ label: "10x10 tent", amount_cents: 9000 }],
        required_doc_types: ["health_permit", "liability_insurance"],
        is_sample: true,
        approval_status: "pending",
      })
      .select("id")
      .single(),
    "pending market"
  )
  await must(
    db.from("market_dates").insert(
      repeatingDates(today, addDays(today, 90), [5])
        .filter((d) => Number(d.slice(8, 10)) <= 7)
        .map((d) => ({ market_id: venice.id, event_date: d, starts_at: "18:00", ends_at: "22:00" }))
    ),
    "pending market dates"
  )

  type R = [vendor: string, market: string, pastIndex: number, ratings: [number, number, number, number], sales: string | null, body: string, extra?: { reply?: string; hidden?: string }]
  const REVIEWS: R[] = [
    [T, "sample-echo-lake-sunday-market", 1, [5, 4, 5, 5], "1500_plus", "Families all morning and a line from 10 to 1. Load-in was easy with a truck spot on Bellevue. Will be back every month."],
    ["demo-bakery@example.com", "sample-echo-lake-sunday-market", 0, [5, 5, 4, 5], "700_1500", "Steady crowd from open to close. Sold out of croissants by noon. Manager walks the row twice to check on everyone."],
    ["demo-coffee@example.com", "sample-echo-lake-sunday-market", 2, [4, 5, 4, 4], "300_700", "Good spot for coffee: people linger. Power drop was right where they promised."],
    ["demo-vegan@example.com", "sample-echo-lake-sunday-market", 3, [4, 4, 3, 4], null, "Nice crowd, a bit slow after 12:30."],
    ["demo-bbq@example.com", CLAIMED_SLUG, 0, [5, 3, 3, 4], "1500_plus", "Huge crowds and we sold out by 9:30, but load-in was chaos. Plan to arrive two hours early.", { reply: "Thanks Dre! We've added a second load-in lane on 4th Pl starting next month." }],
    ["demo-dumplings@example.com", CLAIMED_SLUG, 1, [4, 2, 3, 3], "700_1500", "Good sales but our spot changed the day before and we ended up next to the DJ. Hard to talk to customers.", { reply: "Sorry about that, Kevin. Spots are now locked 5 days ahead and sent with the load-in map." }],
    ["demo-icecream@example.com", CLAIMED_SLUG, 0, [5, 4, 4, 5], "1500_plus", "Best night of the month for us. Late crowd wants dessert."],
    ["demo-coffee@example.com", "sample-santa-monica-pier-pop-up", 0, [3, 4, 2, 3], "under_300", "Mostly tourists who already ate. Fee is steep for the traffic we got."],
    ["demo-icecream@example.com", "sample-santa-monica-pier-pop-up", 1, [5, 4, 5, 5], "700_1500", "Beach plus sunshine plus paletas. Easy money on hot days."],
    ["demo-bakery@example.com", "sample-pasadena-craft-and-food-fair", 0, [5, 5, 5, 5], "1500_plus", "Best-run market we do. Load-in map a week ahead, quiet hours respected, regulars who pre-order."],
    ["demo-vegan@example.com", "sample-pasadena-craft-and-food-fair", 1, [4, 5, 4, 4], "700_1500", "Great organization. Early crowd is more produce shoppers than lunch."],
    ["demo-bbq@example.com", "sample-long-beach-food-truck-fridays", 0, [4, 4, 5, 4], "700_1500", "Chill vibe and a cheap fee. Families come for the music."],
    ["demo-dumplings@example.com", "sample-long-beach-food-truck-fridays", 1, [3, 3, 4, 3], "300_700", "Too many Asian trucks on the same night, split the crowd."],
    ["demo-vegan@example.com", "sample-culver-city-twilight-market", 0, [4, 4, 3, 4], "300_700", "After-work crowd is real, but it's over by 8."],
    ["demo-dumplings@example.com", "sample-culver-city-twilight-market", 1, [1, 1, 1, 1], null, "The organizer is a complete idiot and so is everyone who works there.", { hidden: "Personal attack" }],
    ["demo-dumplings@example.com", "sample-sgv-lantern-night-market", 0, [5, 3, 4, 5], "1500_plus", "Craziest crowd in LA. Bring double inventory and a second person for the line."],
    ["demo-icecream@example.com", "sample-sgv-lantern-night-market", 1, [5, 3, 4, 4], "1500_plus", "Amazing sales, but the fee went up twice this season with little notice."],
    ["demo-bbq@example.com", "sample-sgv-lantern-night-market", 2, [4, 2, 3, 3], "700_1500", "Parking for trailers is a nightmare. Sales were fine."],
    ["demo-bakery@example.com", "sample-torrance-farmers-market", 0, [3, 5, 4, 3], "300_700", "Very well run, just a smaller crowd than we hoped."],
    ["demo-coffee@example.com", "sample-hollywood-rooftop-market", 0, [2, 3, 2, 2], "under_300", "Small crowd and hard to find the elevator. Nice view though."],
    ["demo-vegan@example.com", "sample-hollywood-rooftop-market", 1, [4, 5, 3, 4], "300_700", "Curated and friendly. Works if your food photographs well."],
    ["demo-vintage@example.com", "sample-silver-lake-makers-market", 0, [4, 5, 4, 4], "700_1500", "Gift shoppers with money to spend. Denim and jackets sold best. Organizer keeps booths well spaced."],
    ["demo-vintage@example.com", "sample-long-beach-flea", 0, [5, 3, 4, 4], "1500_plus", "Collectors show up at 6am with flashlights. Bring change and price everything. Parking to unload is tight."],
  ]

  console.log("Creating sample reviews…")
  let reviewCount = 0
  for (const [vendor, market, idx, [ft, org, val, overall], sales, body, extra] of REVIEWS) {
    const day = past(market, idx)
    if (!day) continue
    const appId =
      vendor === T && market === "sample-echo-lake-sunday-market"
        ? echo
        : await apply({ vendor, market, dates: [day], status: "accepted", source: "admin", verified: true })
    if (!appId) continue
    await must(
      db.from("reviews").insert({
        vendor_id: vendorIds.get(vendor)!,
        market_id: marketIds.get(market)!,
        application_id: appId,
        event_date: day,
        rating_foot_traffic: ft,
        rating_organization: org,
        rating_value: val,
        rating_overall: overall,
        sales_range: sales,
        body,
        is_sample: true,
        organizer_reply: extra?.reply ?? null,
        organizer_reply_at: extra?.reply ? new Date().toISOString() : null,
        is_hidden: Boolean(extra?.hidden),
        hidden_reason: extra?.hidden ?? null,
        hidden_at: extra?.hidden ? new Date().toISOString() : null,
      }),
      `review ${market}`
    )
    reviewCount++
  }
  console.log(`  ${reviewCount} reviews`)

  // Sales reports: DTLA asks vendors to report (6% of sales); most sample vendors have.
  await must(db.from("markets").update({ sales_reporting: "required", sales_fee_percent: 6 }).eq("slug", CLAIMED_SLUG), "sales settings")
  const { data: pastApps } = await db
    .from("applications")
    .select("id, vendor_id, market_id, event_dates")
    .eq("market_id", marketIds.get(CLAIMED_SLUG)!)
    .in("status", ["accepted", "paid"])
  let salesCount = 0
  for (const [i, a] of (pastApps ?? []).entries()) {
    for (const d of a.event_dates.filter((x: string) => x < today)) {
      if (i % 4 === 3) continue // leave a few unreported, so "Remind" has someone to remind
      const gross = 60000 + ((i * 37 + d.charCodeAt(9) * 13) % 140) * 1000
      await must(
        db.from("sales_reports").insert({
          application_id: a.id,
          market_id: a.market_id,
          vendor_id: a.vendor_id,
          event_date: d,
          gross_sales_cents: gross,
          card_sales_cents: Math.round(gross * 0.78),
          cash_sales_cents: gross - Math.round(gross * 0.78),
          transactions: Math.round(gross / 1400),
          source: i % 2 ? "square" : "manual",
        }),
        "sales report"
      )
      salesCount++
    }
  }
  console.log(`  ${salesCount} sample sales reports`)

  console.log("Creating sample shoppers and shopper reviews…")
  const SHOPPER_REVIEWS: [number, string, number, [number, number | null, number | null, number | null], string][] = [
    [0, "sample-echo-lake-sunday-market", 6, [5, 4, 5, 4], "Our Sunday ritual. Great bread and coffee, and the kids love the lake. Get there before 10 for parking."],
    [1, "sample-echo-lake-sunday-market", 13, [4, 4, 5, 3], "Lovely atmosphere, a bit pricey but the produce is excellent."],
    [0, "sample-dtla-night-bazaar", 9, [4, 5, 5, 3], "So much food! Long lines for the popular stalls. Go hungry and bring friends to share."],
    [1, "sample-pasadena-craft-and-food-fair", 4, [5, 4, 4, 4], "Well organized and easy to walk around. Nice mix of farmers and prepared food."],
    [0, "sample-silver-lake-makers-market", 20, [5, 5, 5, 3], "Found so many gifts here. Great jewelry and vintage."],
    [1, "sample-hollywood-rooftop-market", 11, [2, 2, 3, 2], "Hard to find and only a handful of stalls when we went. Nice view though."],
  ]
  const shopperIds: string[] = []
  for (const sh of SHOPPERS) {
    const { user } = await must(
      db.auth.admin.createUser({ email: sh.email, password: PASSWORD, email_confirm: true }),
      `create ${sh.email}`
    )
    await must(db.from("profiles").update({ full_name: sh.name, is_shopper: true, home_zip: sh.zip }).eq("id", user!.id), "shopper profile")
    shopperIds.push(user!.id)
  }
  for (const [who, slug, daysAgo, [overall, variety, atmosphere, prices], body] of SHOPPER_REVIEWS) {
    await must(
      db.from("shopper_reviews").insert({
        market_id: marketIds.get(slug)!,
        user_id: shopperIds[who],
        visited_on: addDays(today, -daysAgo),
        rating_overall: overall,
        rating_variety: variety,
        rating_atmosphere: atmosphere,
        rating_prices: prices,
        body,
        is_sample: true,
      }),
      "shopper review"
    )
  }
  console.log(`  ${SHOPPER_REVIEWS.length} shopper reviews`)

  console.log(`\nDone! Sample logins (password: ${PASSWORD}):`)
  for (const v of VENDORS) console.log(`  ${v.email}`)
  console.log(`  ${ORGANIZER.email} (organizer of DTLA Night Bazaar)`)
  console.log(`  ${ORGANIZER2.email} (organizer with a claim and a new market waiting for approval)`)
  for (const sh of SHOPPERS) console.log(`  ${sh.email} (shopper, home ZIP ${sh.zip})`)
}

main().catch((e) => {
  console.error("\nSeed failed:", e.message)
  process.exit(1)
})
