"use client"

import Link from "next/link"
import { CalendarDays, MapPin, Star } from "lucide-react"
import { MarketCover } from "@/components/market-cover"
import { SampleBadge } from "@/components/sample-badge"
import { useT } from "@/lib/i18n/client"
import { marketTypeLabel } from "@/lib/constants"
import { formatDate, formatTime } from "@/lib/dates"
import { formatMoney, type MarketResult } from "@/lib/markets"
import { publicPhotoUrl } from "@/lib/storage"

export function MarketCard({
  result,
  photoPath,
  rating,
}: {
  result: MarketResult
  photoPath?: string
  rating?: { average: number; count: number }
}) {
  const { market, nextDate, matchingDates, distance } = result
  const more = matchingDates.length - 1
  const { t, lang } = useT()

  return (
    <Link
      href={`/markets/${market.slug}`}
      className="flex gap-3 rounded-xl border bg-background p-3 transition-colors hover:border-primary/50"
    >
      <div className="size-20 shrink-0 overflow-hidden rounded-lg bg-secondary sm:size-24">
        {photoPath ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img loading="lazy" decoding="async" src={publicPhotoUrl("market-photos", photoPath)} alt="" className="size-full object-cover" />
        ) : (
          <MarketCover type={market.market_type} name={market.name} className="size-full" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <h3 className="min-w-0 flex-1 leading-tight font-semibold">{market.name}</h3>
          {market.is_sample && <SampleBadge />}
        </div>
        <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
          {t(marketTypeLabel(market.market_type))}
          {rating && (
            <>
              {" · "}
              <Star className="size-3 fill-amber-400 text-amber-400" aria-hidden />
              <span className="font-medium text-foreground">{rating.average.toFixed(1)}</span> ({rating.count})
            </>
          )}
        </p>
        <p className="mt-1.5 flex items-center gap-1 text-sm text-muted-foreground">
          <MapPin className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate">
            {market.city}
            {distance != null && ` · ${distance < 10 ? distance.toFixed(1) : Math.round(distance)} mi`}
          </span>
        </p>
        <p className="mt-0.5 flex items-center gap-1 text-sm">
          <CalendarDays className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          {nextDate ? (
            <span>
              {formatDate(nextDate.event_date, { weekday: true, lang })}
              {nextDate.starts_at && `, ${formatTime(nextDate.starts_at)}`}
              {more > 0 && <span className="text-muted-foreground"> {t("+{n} more", { n: more })}</span>}
            </span>
          ) : (
            <span className="text-muted-foreground">{t("No upcoming dates listed")}</span>
          )}
        </p>
        {market.min_booth_fee_cents != null && (
          <p className="mt-0.5 text-sm font-medium">
            {t("Booths from {price}", { price: formatMoney(market.min_booth_fee_cents) })}
          </p>
        )}
      </div>
    </Link>
  )
}
