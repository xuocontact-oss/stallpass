import Link from "next/link"
import { List, Map as MapIcon } from "lucide-react"
import { MarketCard } from "@/components/market-card"
import { MarketFiltersForm } from "@/components/market-filters"
import { MarketMapLoader } from "@/components/market-map-loader"
import { cn } from "@/lib/utils"
import { formatDate, todayISO } from "@/lib/dates"
import { getDirectory } from "@/lib/market-data"
import { getProfile } from "@/lib/auth"
import { DEFAULT_CENTER, filterMarkets, formatMoney, originFor, parseFilters } from "@/lib/markets"
import { zipToPoint } from "@/lib/zips"
import { getLang, getT } from "@/lib/i18n/server"

export const metadata = { title: "Find markets" }

export default async function MarketsPage({ searchParams }: PageProps<"/markets">) {
  const params = await searchParams
  const filters = parseFilters(params)
  const view = params.view === "map" ? "map" : "list"
  const today = todayISO()
  // Shoppers who saved a home ZIP see markets near home by default.
  const profile = await getProfile()
  const homeZip = !filters.zip && filters.lat == null && profile?.home_zip ? profile.home_zip : ""
  const zip = filters.zip || homeZip
  const zipPoint = zipToPoint(zip)
  const origin = originFor(filters, zipPoint)
  const directory = await getDirectory(today, {
    origin,
    miles: filters.miles,
    category: filters.category,
    maxFeeDollars: filters.maxFee,
    q: filters.q,
    curatedOnly: true,
  })
  const results = filterMarkets(directory.markets, directory.dates, filters, today, origin)
  const unknownZip = Boolean(filters.zip) && !zipPoint
  const t = await getT()
  const lang = await getLang()

  const viewHref = (v: "list" | "map") => {
    const next = new URLSearchParams()
    for (const [k, val] of Object.entries(params)) if (typeof val === "string" && k !== "view") next.set(k, val)
    if (v === "map") next.set("view", "map")
    const qs = next.toString()
    return qs ? `/markets?${qs}` : "/markets"
  }

  return (
    <main className="mx-auto w-full max-w-3xl space-y-4 px-4 py-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t("Find markets")}</h1>
          <p className="text-sm text-muted-foreground">
            {results.length === 1 ? t("1 market") : t("{n} markets", { n: results.length })}
          </p>
        </div>
        <div className="flex rounded-lg border bg-background p-0.5" role="tablist" aria-label="View">
          {(["list", "map"] as const).map((v) => (
            <Link
              key={v}
              href={viewHref(v)}
              role="tab"
              aria-selected={view === v}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium",
                view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              )}
            >
              {v === "list" ? <List className="size-4" /> : <MapIcon className="size-4" />}
              {v === "list" ? t("List") : t("Map")}
            </Link>
          ))}
        </div>
      </div>

      <MarketFiltersForm key={JSON.stringify(filters)} filters={filters} view={view} defaultZip={homeZip} />

      {results.some((r) => r.market.is_sample) && (
        <p className="text-xs text-muted-foreground">
          {t("Markets marked EXAMPLE are examples showing how Stallpass works, with example reviews. They aren't real events.")}
        </p>
      )}
      {unknownZip && (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950">{t("We don't recognise ZIP code {zip}. Check it and try again.", { zip: filters.zip })}</p>
      )}
      {!origin && !filters.q && (
        <p className="rounded-lg bg-secondary p-3 text-sm">
          {t("Showing markets listed on Stallpass. Enter your ZIP code or tap the location button to find farmers markets near you anywhere in the US.")}
        </p>
      )}
      {origin && (
        <p className="text-sm text-muted-foreground">
          {filters.lat != null
            ? t("Within {miles} miles of your location", { miles: filters.miles })
            : t("Within {miles} miles of ZIP {zip}", { miles: filters.miles, zip })}
          {homeZip && ` (${t("your home ZIP")})`}
        </p>
      )}

      {view === "map" ? (
        <MarketMapLoader
          center={origin ?? (results[0] ? { lat: results[0].market.lat, lng: results[0].market.lng } : DEFAULT_CENTER)}
          origin={origin}
          pins={results.map((r) => ({
            slug: r.market.slug,
            name: r.market.name,
            lat: r.market.lat,
            lng: r.market.lng,
            subtitle: [
              r.market.city,
              r.nextDate ? `${t("Next:")} ${formatDate(r.nextDate.event_date, { lang })}` : null,
              r.market.min_booth_fee_cents != null ? t("from {price}", { price: formatMoney(r.market.min_booth_fee_cents) }) : null,
            ]
              .filter(Boolean)
              .join(" · "),
          }))}
        />
      ) : results.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-background p-6 text-center">
          <p className="font-medium">{t("No markets match those filters")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("Try a wider distance or a different date.")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {results.map((r) => (
            <MarketCard key={r.market.id} result={r} photoPath={directory.coverPhotos.get(r.market.id)}
              rating={directory.ratings.get(r.market.id)}
            />
          ))}
        </div>
      )}
    </main>
  )
}
