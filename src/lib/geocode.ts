import "server-only"

/**
 * Turns a street address into map coordinates using OpenStreetMap's free
 * lookup service. Only used when the admin saves a market (a few times a day),
 * which is well inside its fair-use rules.
 */
export async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  const url = new URL("https://nominatim.openstreetmap.org/search")
  url.searchParams.set("q", address)
  url.searchParams.set("format", "json")
  url.searchParams.set("limit", "1")
  url.searchParams.set("countrycodes", "us")
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Stallpass/0.1 (market directory admin)" },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    const [hit] = (await res.json()) as { lat: string; lon: string }[]
    if (!hit) return null
    return { lat: Number.parseFloat(hit.lat), lng: Number.parseFloat(hit.lon) }
  } catch {
    return null
  }
}
