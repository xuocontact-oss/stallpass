import { ImageResponse } from "next/og"

export const alt = "Stallpass: find markets, keep permits ready, apply fast"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

/** The preview picture when someone shares a Stallpass link. */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", background: "#fbf6f2", display: "flex", flexDirection: "column", justifyContent: "center", padding: 80 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ width: 80, height: 80, borderRadius: 18, background: "#c7402b", color: "white", fontSize: 52, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>S</div>
          <div style={{ fontSize: 56, fontWeight: 800, color: "#1c1917" }}>Stallpass</div>
        </div>
        <div style={{ marginTop: 40, fontSize: 64, fontWeight: 800, color: "#1c1917", lineHeight: 1.1, maxWidth: 1000 }}>
          Find markets. Keep your permits ready. Apply in a tap.
        </div>
        <div style={{ marginTop: 28, fontSize: 32, color: "#78716c" }}>For food vendors, food trucks, makers and market organizers</div>
      </div>
    ),
    size
  )
}
