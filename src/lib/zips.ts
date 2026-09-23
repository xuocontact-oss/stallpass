import "server-only"
import centroids from "@/data/zip-centroids.json"

/**
 * US ZIP code → map point (center of the ZIP area), from the free US Census
 * "ZCTA gazetteer" file (2024). About 33,800 ZIP codes.
 */
const table = centroids as unknown as Record<string, [number, number]>

export function zipToPoint(zip: string | null | undefined): { lat: number; lng: number } | null {
  if (!zip || !/^\d{5}$/.test(zip)) return null
  const hit = table[zip]
  return hit ? { lat: hit[0], lng: hit[1] } : null
}
