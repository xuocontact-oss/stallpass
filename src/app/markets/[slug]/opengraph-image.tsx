import { ImageResponse } from "next/og"
import { createClient } from "@supabase/supabase-js"

export const alt = "Market on Stallpass"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

/** Preview picture for a market link: its name, city and schedule. */
export default async function MarketOgImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false },
  })
  const { data: m } = await db.from("markets").select("name, city, state, schedule_summary").eq("slug", slug).maybeSingle()
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", background: "#fbf6f2", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 80 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 36, fontWeight: 700, color: "#1f6b3f" }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: "#1f6b3f", color: "white", fontSize: 36, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>S</div>
          Stallpass
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 76, fontWeight: 800, color: "#1c1917", lineHeight: 1.05 }}>{m?.name ?? "Market"}</div>
          {m && <div style={{ marginTop: 20, fontSize: 38, color: "#57534e" }}>{`${m.city}, ${m.state}${m.schedule_summary ? ` · ${m.schedule_summary}` : ""}`}</div>}
        </div>
        <div style={{ fontSize: 30, color: "#78716c" }}>Dates, booth fees and reviews from vendors & shoppers</div>
      </div>
    ),
    size
  )
}
