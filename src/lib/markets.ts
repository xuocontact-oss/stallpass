import { addDays, daysBetween, isValidISODate, weekday } from "./dates.ts"
import type { Market, MarketDate } from "@/lib/types"

/** Center of the map when nothing else is chosen. */
export const DEFAULT_CENTER = { lat: 34.0522, lng: -118.2437 }

export const DISTANCE_OPTIONS = [5, 10, 25, 50, 100] as const
export const MAX_FEE_OPTIONS = [50, 100, 150, 250] as const

export const WHEN_OPTIONS = [
  { key: "", label: "Any upcoming date" },
  { key: "weekend", label: "This weekend" },
  { key: "7", label: "Next 7 days" },
  { key: "30", label: "Next 30 days" },
  { key: "90", label: "Next 3 months" },
  { key: "date", label: "On a specific date" },
] as const

/** Straight-line distance in miles. */
export function distanceMiles(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 3958.8
  const rad = (d: number) => (d * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export function formatMoney(cents: number | null | undefined): string {
  if (cents == null) return ""
  const dollars = cents / 100
  return dollars.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: Number.isInteger(dollars) ? 0 : 2,
  })
}

export type MarketFilters = {
  q: string
  when: string
  on: string
  zip: string
  lat: number | null
  lng: number | null
  miles: number
  category: string
  maxFee: number | null
}

type Params = Record<string, string | string[] | undefined>

function one(params: Params, key: string) {
  const v = params[key]
  return (Array.isArray(v) ? v[0] : v)?.trim() ?? ""
}

/** Reads filters from the page address, ignoring anything invalid. */
export function parseFilters(params: Params): MarketFilters {
  const lat = Number.parseFloat(one(params, "lat"))
  const lng = Number.parseFloat(one(params, "lng"))
  const hasPoint = Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
  const miles = Number.parseInt(one(params, "miles"), 10)
  const maxFee = Number.parseInt(one(params, "maxFee"), 10)
  const when = one(params, "when")
  const on = one(params, "on")
  return {
    q: one(params, "q").slice(0, 100),
    when: WHEN_OPTIONS.some((o) => o.key === when) ? when : "",
    on: isValidISODate(on) ? on : "",
    zip: /^\d{5}$/.test(one(params, "zip")) ? one(params, "zip") : "",
    lat: hasPoint ? lat : null,
    lng: hasPoint ? lng : null,
    miles: (DISTANCE_OPTIONS as readonly number[]).includes(miles) ? miles : 25,
    category: one(params, "category"),
    maxFee: Number.isFinite(maxFee) && maxFee > 0 ? maxFee : null,
  }
}

/**
 * The point distances are measured from: "my location" if shared, else the
 * ZIP code's point (looked up by the caller), else nothing.
 */
export function originFor(
  f: MarketFilters,
  zipPoint: { lat: number; lng: number } | null
): { lat: number; lng: number } | null {
  if (f.lat != null && f.lng != null) return { lat: f.lat, lng: f.lng }
  return zipPoint
}

/** A rough square around a point, for a fast first database filter. */
export function boundingBox(origin: { lat: number; lng: number }, miles: number) {
  const dLat = miles / 69
  const dLng = miles / (69 * Math.max(Math.cos((origin.lat * Math.PI) / 180), 0.01))
  return { minLat: origin.lat - dLat, maxLat: origin.lat + dLat, minLng: origin.lng - dLng, maxLng: origin.lng + dLng }
}

/** First and last day that match the "when" filter, or null for "any upcoming date". */
export function dateRange(f: MarketFilters, today: string): { from: string; to: string } | null {
  switch (f.when) {
    case "weekend": {
      // Today if it's already the weekend, else the coming Saturday; through Sunday.
      const wd = weekday(today)
      const from = wd === 6 || wd === 0 ? today : addDays(today, 6 - wd)
      return { from, to: addDays(today, wd === 0 ? 0 : 7 - wd) }
    }
    case "7":
    case "30":
    case "90":
      return { from: today, to: addDays(today, Number(f.when)) }
    case "date":
      return f.on ? { from: f.on, to: f.on } : null
    default:
      return null
  }
}

export type MarketResult = {
  market: Market
  nextDate: MarketDate | null
  matchingDates: MarketDate[]
  distance: number | null
}

/**
 * Applies the directory filters. `dates` must be upcoming dates only.
 * Markets with no upcoming dates still show when no date filter is set.
 */
export function filterMarkets(
  markets: Market[],
  dates: MarketDate[],
  f: MarketFilters,
  today: string,
  origin: { lat: number; lng: number } | null = originFor(f, null)
): MarketResult[] {
  const byMarket = new Map<string, MarketDate[]>()
  for (const d of [...dates].sort((a, b) => a.event_date.localeCompare(b.event_date))) {
    if (daysBetween(today, d.event_date) < 0) continue
    const list = byMarket.get(d.market_id) ?? []
    list.push(d)
    byMarket.set(d.market_id, list)
  }

  const range = dateRange(f, today)
  const q = f.q.toLowerCase()

  const results: MarketResult[] = []
  for (const market of markets) {
    const upcoming = byMarket.get(market.id) ?? []
    const matchingDates = range
      ? upcoming.filter((d) => d.event_date >= range.from && d.event_date <= range.to)
      : upcoming
    if (range && matchingDates.length === 0) continue

    if (q) {
      const haystack = `${market.name} ${market.city} ${market.organizer_name ?? ""}`.toLowerCase()
      if (!haystack.includes(q)) continue
    }

    // Markets that list no categories welcome everyone.
    if (
      f.category &&
      market.categories_wanted.length > 0 &&
      !market.categories_wanted.includes(f.category)
    ) {
      continue
    }

    if (f.maxFee != null && market.min_booth_fee_cents != null) {
      if (market.min_booth_fee_cents > f.maxFee * 100) continue
    }

    const distance = origin ? distanceMiles(origin, market) : null
    if (distance != null && distance > f.miles) continue

    results.push({ market, nextDate: matchingDates[0] ?? null, matchingDates, distance })
  }

  return results.sort((a, b) => {
    if (a.distance != null && b.distance != null && a.distance !== b.distance) {
      return a.distance - b.distance
    }
    const ad = a.nextDate?.event_date ?? "9999"
    const bd = b.nextDate?.event_date ?? "9999"
    return ad.localeCompare(bd) || a.market.name.localeCompare(b.market.name)
  })
}

/** Makes a web-address-friendly name: "Silver Lake Night Market" → "silver-lake-night-market". */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "")
}

/**
 * Dates for a repeating market: every chosen weekday between two dates.
 * Capped at 104 dates (two years of weekly markets).
 */
export function repeatingDates(from: string, to: string, weekdays: number[]): string[] {
  const out: string[] = []
  if (!isValidISODate(from) || !isValidISODate(to) || weekdays.length === 0) return out
  for (let d = from; d <= to && out.length < 104; d = addDays(d, 1)) {
    if (weekdays.includes(weekday(d))) out.push(d)
  }
  return out
}

/**
 * Reads booth fees typed one per line, like "10x10 tent: $75" or "Food truck | 150".
 * Returns an error message for the first line it can't understand.
 */
export function parseBoothFees(
  text: string
): { fees: { label: string; amount_cents: number }[] } | { error: string } {
  const fees: { label: string; amount_cents: number }[] = []
  for (const raw of text.split("\n")) {
    const line = raw.trim()
    if (!line) continue
    const m = line.match(/^(.+?)\s*[:|\-–]\s*\$?\s*([\d,]+(?:\.\d{1,2})?)\s*$/)
    if (!m) return { error: `Couldn't read the booth fee “${line}”. Use “Label: $75”.` }
    const amount = Math.round(Number.parseFloat(m[2].replace(/,/g, "")) * 100)
    if (!Number.isFinite(amount) || amount < 0 || amount > 10_000_00) {
      return { error: `The amount in “${line}” doesn't look right.` }
    }
    fees.push({ label: m[1].trim().slice(0, 60), amount_cents: amount })
  }
  if (fees.length > 10) return { error: "Up to 10 booth fees, please." }
  return { fees }
}

export function boothFeesToText(fees: { label: string; amount_cents: number }[]): string {
  return fees.map((f) => `${f.label}: $${(f.amount_cents / 100).toFixed(f.amount_cents % 100 ? 2 : 0)}`).join("\n")
}
