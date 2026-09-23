import "server-only"
import { cache } from "react"
import { addDays } from "@/lib/dates"
import { boundingBox } from "@/lib/markets"
import { throwIfError } from "@/lib/form"
import { createClient } from "@/lib/supabase/server"
import type { Market, MarketDate, MarketPhoto, PublicReview, ShopperReview } from "@/lib/types"

export type DirectoryQuery = {
  /** Only markets within `miles` of this point (fast box filter; exact distance is checked after). */
  origin?: { lat: number; lng: number } | null
  miles?: number
  category?: string
  maxFeeDollars?: number | null
  q?: string
  /** Without a location or search, only show markets added on Stallpass (not all imported ones). */
  curatedOnly?: boolean
  limit?: number
}

const IN_CHUNK = 200

async function inChunks<T>(ids: string[], load: (chunk: string[]) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const out: T[] = []
  for (let i = 0; i < ids.length; i += IN_CHUNK) {
    const { data, error } = await load(ids.slice(i, i + IN_CHUNK))
    throwIfError(error, "market details")
    out.push(...(data ?? []))
  }
  return out
}

/**
 * Published markets matching the filters, with their dates for the next year,
 * a cover photo and average vendor rating. The database does the heavy
 * filtering, so this stays fast with thousands of imported markets.
 */
export const getDirectory = cache(async (today: string, query: DirectoryQuery = {}) => {
  const supabase = await createClient()
  let mq = supabase.from("markets").select("*").eq("is_published", true).eq("approval_status", "approved")
  if (query.origin) {
    const box = boundingBox(query.origin, query.miles ?? 25)
    mq = mq.gte("lat", box.minLat).lte("lat", box.maxLat).gte("lng", box.minLng).lte("lng", box.maxLng)
  } else if (query.curatedOnly && !query.q) {
    mq = mq.eq("source", "stallpass")
  }
  if (query.category) mq = mq.or(`categories_wanted.cs.{${query.category}},categories_wanted.eq.{}`)
  if (query.maxFeeDollars) mq = mq.or(`min_booth_fee_cents.lte.${query.maxFeeDollars * 100},min_booth_fee_cents.is.null`)
  if (query.q) {
    const term = query.q.replace(/[%,()*\\]/g, " ").trim()
    if (term) mq = mq.or(`name.ilike.%${term}%,city.ilike.%${term}%`)
  }
  const { data: marketRows, error } = await mq.order("source").order("name").limit(query.limit ?? 600)
  throwIfError(error, "markets")
  const markets = (marketRows ?? []) as Market[]
  const ids = markets.map((m) => m.id)

  const [dates, photos, reviews] = await Promise.all([
    inChunks<MarketDate>(ids, (c) =>
      supabase
        .from("market_dates")
        .select("*")
        .in("market_id", c)
        .gte("event_date", today)
        .lte("event_date", addDays(today, 365))
        .order("event_date")
    ),
    inChunks<{ market_id: string; path: string }>(ids, (c) =>
      supabase.from("market_photos").select("market_id, path, position").in("market_id", c).order("position")
    ),
    inChunks<{ market_id: string; rating_overall: number }>(ids, (c) =>
      supabase.from("market_reviews").select("market_id, rating_overall").in("market_id", c)
    ),
  ])

  const coverPhotos = new Map<string, string>()
  for (const p of photos) if (!coverPhotos.has(p.market_id)) coverPhotos.set(p.market_id, p.path)

  // Average vendor rating per market, for the market cards.
  const ratings = new Map<string, { total: number; count: number }>()
  for (const r of reviews) {
    const cur = ratings.get(r.market_id) ?? { total: 0, count: 0 }
    ratings.set(r.market_id, { total: cur.total + r.rating_overall, count: cur.count + 1 })
  }

  return {
    markets,
    dates,
    coverPhotos,
    ratings: new Map([...ratings].map(([id, r]) => [id, { average: Math.round((r.total / r.count) * 10) / 10, count: r.count }])),
  }
})

export async function getMarketBySlug(slug: string, today: string) {
  const supabase = await createClient()
  const { data: market, error } = await supabase.from("markets").select("*").eq("slug", slug).maybeSingle()
  throwIfError(error, "the market")
  if (!market) return null

  const [dates, photos, reviews, shopperReviews] = await Promise.all([
    supabase
      .from("market_dates")
      .select("*")
      .eq("market_id", market.id)
      .gte("event_date", today)
      .order("event_date")
      .limit(12),
    supabase.from("market_photos").select("*").eq("market_id", market.id).order("position"),
    supabase
      .from("market_reviews")
      .select("*")
      .eq("market_id", market.id)
      .order("event_date", { ascending: false })
      .limit(100),
    supabase
      .from("market_shopper_reviews")
      .select("*")
      .eq("market_id", market.id)
      .order("visited_on", { ascending: false })
      .limit(100),
  ])
  throwIfError(shopperReviews.error, "shopper reviews")
  throwIfError(dates.error, "market dates")
  throwIfError(photos.error, "market photos")
  throwIfError(reviews.error, "reviews")
  return {
    market: market as Market,
    dates: (dates.data ?? []) as MarketDate[],
    photos: (photos.data ?? []) as MarketPhoto[],
    reviews: (reviews.data ?? []) as PublicReview[],
    shopperReviews: (shopperReviews.data ?? []) as ShopperReview[],
  }
}
