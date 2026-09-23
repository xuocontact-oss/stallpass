import { MessageSquareReply } from "lucide-react"
import { SampleBadge } from "@/components/sample-badge"
import { Stars } from "@/components/stars"
import { categoryLabel, salesRangeLabel, SALES_RANGES } from "@/lib/constants"
import { formatDate } from "@/lib/dates"
import type { ReviewSummary } from "@/lib/reviews"
import type { PublicReview, ShopperReview } from "@/lib/types"

export function ReviewSummaryBox({ summary }: { summary: ReviewSummary }) {
  const rows = [
    { label: "Foot traffic", value: summary.footTraffic },
    { label: "Organization", value: summary.organization },
    { label: "Value for booth fee", value: summary.value },
  ]
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <div className="flex items-center gap-2">
          <span className="text-3xl font-bold">{summary.overall?.toFixed(1)}</span>
          <div>
            <Stars value={summary.overall} />
            <p className="text-xs text-muted-foreground">
              {summary.count} vendor review{summary.count === 1 ? "" : "s"}
            </p>
          </div>
        </div>
        <dl className="mt-3 space-y-1 text-sm">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center justify-between gap-2">
              <dt className="text-muted-foreground">{r.label}</dt>
              <dd className="flex items-center gap-1.5">
                <Stars value={r.value} /> <span className="w-6 text-right tabular-nums">{r.value?.toFixed(1)}</span>
              </dd>
            </div>
          ))}
        </dl>
      </div>
      {summary.salesCount > 0 && (
        <div>
          <p className="text-sm font-medium">How sales went</p>
          <p className="text-xs text-muted-foreground">
            From {summary.salesCount} vendor{summary.salesCount === 1 ? "" : "s"} who shared
          </p>
          <div className="mt-2 space-y-1.5">
            {SALES_RANGES.map((s) => {
              const n = summary.sales[s.key]
              const pct = Math.round((n / summary.salesCount) * 100)
              return (
                <div key={s.key} className="flex items-center gap-2 text-sm">
                  <span className="w-24 shrink-0 text-muted-foreground">{s.label}</span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-9 text-right tabular-nums">{pct}%</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export function ReviewList({ reviews }: { reviews: PublicReview[] }) {
  return (
    <ul className="divide-y">
      {reviews.map((r) => (
        <li key={r.id} className="space-y-2 py-4 first:pt-0 last:pb-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Stars value={r.rating_overall} />
            <span className="text-sm font-medium">
              {r.reviewer_name ?? `Verified vendor${r.reviewer_category ? ` · ${categoryLabel(r.reviewer_category)}` : ""}`}
            </span>
            {r.is_sample && <SampleBadge />}
          </div>
          <p className="text-xs text-muted-foreground">
            Worked the {formatDate(r.event_date)} market
            {r.sales_range && ` · Sales: ${salesRangeLabel(r.sales_range)}`}
          </p>
          <p className="text-xs text-muted-foreground">
            Foot traffic {r.rating_foot_traffic}/5 · Organization {r.rating_organization}/5 · Value {r.rating_value}/5
          </p>
          {r.body && <p className="text-sm whitespace-pre-line">{r.body}</p>}
          {r.organizer_reply && (
            <div className="ml-3 flex gap-2 rounded-lg bg-muted/60 p-3 text-sm">
              <MessageSquareReply className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
              <div>
                <p className="font-medium">Reply from the organizer</p>
                <p className="whitespace-pre-line">{r.organizer_reply}</p>
              </div>
            </div>
          )}
        </li>
      ))}
    </ul>
  )
}

/** Shopper reviews of a market (separate from verified vendor reviews). */
export function ShopperReviewList({ reviews }: { reviews: ShopperReview[] }) {
  return (
    <ul className="divide-y">
      {reviews.map((r) => (
        <li key={r.id} className="space-y-1.5 py-4 first:pt-0 last:pb-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Stars value={r.rating_overall} />
            <span className="text-sm font-medium">{r.display_name ?? "Shopper"}</span>
            {r.is_sample && <SampleBadge />}
          </div>
          <p className="text-xs text-muted-foreground">
            Visited {formatDate(r.visited_on)}
            {r.rating_variety && ` · Variety ${r.rating_variety}/5`}
            {r.rating_atmosphere && ` · Atmosphere ${r.rating_atmosphere}/5`}
            {r.rating_prices && ` · Prices ${r.rating_prices}/5`}
          </p>
          {r.body && <p className="text-sm whitespace-pre-line">{r.body}</p>}
          {r.organizer_reply && (
            <div className="ml-3 flex gap-2 rounded-lg bg-muted/60 p-3 text-sm">
              <MessageSquareReply className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
              <div>
                <p className="font-medium">Reply from the organizer</p>
                <p className="whitespace-pre-line">{r.organizer_reply}</p>
              </div>
            </div>
          )}
        </li>
      ))}
    </ul>
  )
}
