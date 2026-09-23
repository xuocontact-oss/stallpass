/**
 * Imports farmers markets from the USDA Local Food Portal (free, public data).
 *
 *   npm run import:usda -- --state=CA            import California
 *   npm run import:usda -- --state=CA --dry-run  show what would change
 *   npm run import:usda -- --all                 every state (takes a while)
 *   npm run import:usda -- --state=CA --inspect  print one raw record
 *
 * Needs USDA_API_KEY in .env.local (free: usdalocalfoodportal.com → Developers).
 * Safe to run again: markets are matched by their USDA id and updated, never
 * duplicated. Markets an organizer has claimed are never overwritten.
 */
import { createClient } from "@supabase/supabase-js"
import { slugify } from "../src/lib/markets.ts"

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const secretKey = process.env.SUPABASE_SECRET_KEY
const apiKey = process.env.USDA_API_KEY
if (!url || !secretKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in .env.local")
  process.exit(1)
}
if (!apiKey) {
  console.error("Missing USDA_API_KEY in .env.local. Get a free key at https://www.usdalocalfoodportal.com (Developers / API).")
  process.exit(1)
}
const db = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } })

const args = new Map(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=")
    return [k, v ?? "true"] as const
  })
)
const STATES = "AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY PR".split(" ")
const states = args.has("all") ? STATES : [(args.get("state") ?? "").toUpperCase()].filter(Boolean)
if (states.length === 0) {
  console.error("Say which state: --state=CA (or --all)")
  process.exit(1)
}
const dryRun = args.has("dry-run")

type Raw = Record<string, unknown>

/** First non-empty string among several possible field names. */
function pick(r: Raw, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = r[k]
    if (typeof v === "string" && v.trim()) return v.trim()
    if (typeof v === "number") return String(v)
  }
  return null
}

function num(r: Raw, ...keys: string[]): number | null {
  const v = pick(r, ...keys)
  const n = v == null ? NaN : Number.parseFloat(v)
  return Number.isFinite(n) ? n : null
}

/** "123 Main St, Los Angeles, California 90026" → parts. */
function splitAddress(full: string) {
  const zip = full.match(/\b(\d{5})(?:-\d{4})?\s*$/)?.[1] ?? null
  const parts = full.replace(/\b\d{5}(?:-\d{4})?\s*$/, "").split(",").map((p) => p.trim()).filter(Boolean)
  return {
    street: parts[0] ?? full,
    city: parts.length >= 3 ? parts[parts.length - 2] : parts[1] ?? null,
    zip,
  }
}

function webUrl(v: string | null): string | null {
  if (!v) return null
  const s = v.trim()
  if (!s || s.length > 200) return null
  return /^https?:\/\//i.test(s) ? s : `https://${s}`
}

async function fetchState(state: string): Promise<Raw[]> {
  const endpoint = new URL("https://www.usdalocalfoodportal.com/api/farmersmarket/")
  endpoint.searchParams.set("apikey", apiKey!)
  endpoint.searchParams.set("state", state)
  const res = await fetch(endpoint, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; Stallpass market directory import)", Accept: "application/json" },
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`USDA ${state}: HTTP ${res.status} ${text.slice(0, 200)}`)
  if (/apikey error/i.test(text)) throw new Error("USDA says the API key is wrong. Check USDA_API_KEY in .env.local.")
  const body = JSON.parse(text) as { data?: Raw[] } | Raw[]
  return Array.isArray(body) ? body : (body.data ?? [])
}

function toMarket(r: Raw, state: string) {
  const id = pick(r, "listing_id", "listingid", "id", "FMID")
  const name = pick(r, "listing_name", "listingname", "MarketName", "name")
  const lat = num(r, "location_y", "latitude", "y", "lat")
  const lng = num(r, "location_x", "longitude", "x", "lng", "lon")
  if (!id || !name || lat == null || lng == null || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null

  const fullAddress = pick(r, "location_address", "address", "street") ?? ""
  const split = splitAddress(fullAddress)
  const city = pick(r, "location_city", "city") ?? split.city ?? "Unknown"
  const zip = pick(r, "location_zipcode", "zip", "zipcode") ?? split.zip
  const season = Object.keys(r)
    .filter((k) => /^season\d?(date|time)?$/i.test(k) || /schedule/i.test(k))
    .map((k) => pick(r, k))
    .filter(Boolean)
    .join(" · ")
    .slice(0, 200)
  const desc = pick(r, "listing_desc", "brief_desc", "description")

  return {
    source: "usda" as const,
    source_id: id,
    name: name.slice(0, 120),
    market_type: "farmers" as const,
    address: (split.street || city).slice(0, 200),
    city: city.slice(0, 80),
    state,
    zip: zip && /^\d{5}$/.test(zip) ? zip : null,
    lat,
    lng,
    website: webUrl(pick(r, "media_website", "website")),
    instagram: pick(r, "media_instagram", "instagram")?.slice(0, 200) ?? null,
    schedule_summary: season || null,
    description: [
      desc?.slice(0, 3500),
      "Listing from the USDA National Farmers Market Directory. Details may be out of date, so check with the market before you go.",
    ]
      .filter(Boolean)
      .join("\n\n"),
    contact_email: pick(r, "contact_email", "email"),
    is_published: true,
    approval_status: "approved" as const,
    source_updated_at: new Date().toISOString(),
  }
}

/** The market row without the contact email (that goes in a private table). */
function marketRow(m: NonNullable<ReturnType<typeof toMarket>>) {
  const row: Partial<typeof m> = { ...m }
  delete row.contact_email
  return row
}

async function main() {
  // Every web address already in use (read in pages; the database returns 1,000 at a time).
  const taken = new Set<string>()
  for (let from = 0; ; from += 1000) {
    const { data } = await db.from("markets").select("slug").range(from, from + 999)
    for (const r of data ?? []) taken.add(r.slug as string)
    if (!data || data.length < 1000) break
  }
  const uniqueSlug = (base: string) => {
    let slug = base.slice(0, 72) || "market"
    for (let n = 2; taken.has(slug); n++) slug = `${base.slice(0, 72)}-${n}`
    taken.add(slug)
    return slug
  }

  let added = 0
  let updated = 0
  let skipped = 0
  for (const state of states) {
    const raw = await fetchState(state)
    if (args.has("inspect")) {
      console.log(`${state}: ${raw.length} records. First one:\n`, JSON.stringify(raw[0], null, 2))
      continue
    }
    const markets = raw.map((r) => toMarket(r, state)).filter((m): m is NonNullable<typeof m> => m !== null)
    skipped += raw.length - markets.length

    const existing = new Map<string, { source_id: string; organizer_id: string | null }>()
    const sourceIds = markets.map((m) => m.source_id)
    for (let i = 0; i < sourceIds.length; i += 200) {
      const { data } = await db
        .from("markets")
        .select("source_id, organizer_id")
        .eq("source", "usda")
        .in("source_id", sourceIds.slice(i, i + 200))
      for (const e of data ?? []) existing.set(e.source_id as string, e as { source_id: string; organizer_id: string | null })
    }

    const toInsert = markets.filter((m) => !existing.has(m.source_id))
    const toUpdate = markets.filter((m) => {
      const e = existing.get(m.source_id)
      return e && !e.organizer_id // never overwrite a claimed market
    })
    console.log(`${state}: ${raw.length} from USDA → ${toInsert.length} new, ${toUpdate.length} to refresh`)
    if (dryRun) continue

    for (let i = 0; i < toInsert.length; i += 200) {
      const batch = toInsert.slice(i, i + 200)
      const rows = batch.map((m) => ({ ...marketRow(m), slug: uniqueSlug(slugify(`${m.name} ${m.city} ${m.state}`)) }))
      const { data, error } = await db.from("markets").insert(rows).select("id, source_id")
      if (error) throw new Error(`Insert failed (${state}): ${error.message}`)
      const ids = new Map((data ?? []).map((d) => [d.source_id as string, d.id as string]))
      const contacts = batch
        .filter((m) => m.contact_email && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(m.contact_email) && ids.has(m.source_id))
        .map((m) => ({ market_id: ids.get(m.source_id)!, contact_email: m.contact_email!.slice(0, 200) }))
      if (contacts.length) await db.from("market_contacts").upsert(contacts)
      added += batch.length
    }
    for (const m of toUpdate) {
      const { error } = await db.from("markets").update(marketRow(m)).eq("source", "usda").eq("source_id", m.source_id)
      if (error) throw new Error(`Update failed (${m.name}): ${error.message}`)
      updated++
    }
  }
  if (!args.has("inspect")) {
    console.log(`\nDone${dryRun ? " (dry run, nothing saved)" : ""}: ${added} added, ${updated} refreshed, ${skipped} skipped (missing name or location).`)
  }
}

main().catch((e) => {
  console.error("\nImport failed:", e.message)
  process.exit(1)
})
