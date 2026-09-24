import type { MetadataRoute } from "next"
import { createClient } from "@supabase/supabase-js"

const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "")

export const revalidate = 86400 // rebuild once a day

/** Tells Google about every public market page. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  const markets: { slug: string; updated_at: string }[] = []
  // Without database settings (e.g. a build before they're added), list just the fixed pages.
  let db: ReturnType<typeof createClient> | null = null
  try {
    if (url && key) db = createClient(url, key, { auth: { persistSession: false } })
  } catch (e) {
    console.error("Sitemap: bad database settings, listing fixed pages only.", e)
  }
  for (let from = 0; db && from < 45000; from += 1000) {
    const { data } = await db
      .from("markets")
      .select("slug, updated_at")
      .eq("is_published", true)
      .eq("approval_status", "approved")
      .eq("is_sample", false)
      .range(from, from + 999)
    markets.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  const pages = ["", "/markets", "/start", "/terms", "/privacy", "/review-guidelines", "/partners"]
  return [
    ...pages.map((p) => ({ url: `${SITE}${p}`, changeFrequency: "weekly" as const, priority: p === "" ? 1 : 0.6 })),
    ...markets.map((m) => ({ url: `${SITE}/markets/${m.slug}`, lastModified: m.updated_at, changeFrequency: "weekly" as const, priority: 0.8 })),
  ]
}
