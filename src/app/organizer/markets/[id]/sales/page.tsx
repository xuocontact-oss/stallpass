import { Download } from "lucide-react"
import { ActionButton } from "@/components/action-button"
import { SalesSettingsForm } from "@/components/sales-settings-form"
import { buttonVariants } from "@/components/ui/button"
import { remindMissingSales } from "@/actions/sales"
import { requireOrganizedMarket } from "@/lib/auth"
import { formatDate } from "@/lib/dates"
import { formatMoney } from "@/lib/markets"
import { marketSalesByDay } from "@/lib/organizer-sales"

export default async function OrganizerSalesPage({ params }: PageProps<"/organizer/markets/[id]/sales">) {
  const { id } = await params
  const market = await requireOrganizedMarket(id)
  const days = await marketSalesByDay(id)
  const pct = market.sales_fee_percent ? Number(market.sales_fee_percent) : null

  return (
    <main className="space-y-5">
      {market.sales_reporting === "off" && (
        <p className="rounded-lg bg-secondary p-3 text-sm">Sales reports are off for this market. Turn them on below.</p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Sales by market day</h2>
        {days.length > 0 && (
          <a href={`/organizer/markets/${id}/sales/export`} className={buttonVariants({ variant: "outline", size: "sm" })}>
            <Download /> Download all (CSV)
          </a>
        )}
      </div>
      {days.length === 0 ? (
        <p className="rounded-xl border bg-background p-4 text-sm text-muted-foreground">No past market days with accepted vendors yet.</p>
      ) : (
        <ul className="space-y-3">
          {days.map((d) => (
            <li key={d.date} className="space-y-3 rounded-xl border bg-background p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-semibold">{formatDate(d.date, { weekday: true })}</p>
                <p className="text-sm">
                  <span className="text-lg font-bold">{formatMoney(d.totalCents)}</span>
                  <span className="text-muted-foreground"> · {d.reported} of {d.accepted} reported</span>
                  {pct != null && <span className="text-muted-foreground"> · your {pct}%: {formatMoney(Math.round((d.totalCents * pct) / 100))}</span>}
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="py-1 pr-2 font-medium">Vendor</th>
                      <th className="py-1 pr-2 text-right font-medium">Sales</th>
                      <th className="py-1 pr-2 text-right font-medium">Card</th>
                      <th className="py-1 pr-2 text-right font-medium">Cash</th>
                      {pct != null && <th className="py-1 text-right font-medium">{pct}% due</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {d.rows.map((r) => (
                      <tr key={r.applicationId}>
                        <td className="py-1.5 pr-2">
                          {r.business}
                          {r.booth && <span className="text-muted-foreground"> · #{r.booth}</span>}
                          {r.source === "square" && <span className="ml-1 text-xs text-muted-foreground">(Square)</span>}
                        </td>
                        <td className="py-1.5 pr-2 text-right tabular-nums">{r.gross != null ? formatMoney(r.gross) : <span className="text-amber-700">not yet</span>}</td>
                        <td className="py-1.5 pr-2 text-right tabular-nums text-muted-foreground">{r.card != null ? formatMoney(r.card) : ""}</td>
                        <td className="py-1.5 pr-2 text-right tabular-nums text-muted-foreground">{r.cash != null ? formatMoney(r.cash) : ""}</td>
                        {pct != null && <td className="py-1.5 text-right tabular-nums">{r.gross != null ? formatMoney(Math.round((r.gross * pct) / 100)) : ""}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap gap-2">
                {d.reported < d.accepted && (
                  <ActionButton size="sm" variant="outline" action={remindMissingSales.bind(null, id, d.date)}>
                    Remind {d.accepted - d.reported} who haven&apos;t reported
                  </ActionButton>
                )}
                <a href={`/organizer/markets/${id}/sales/export?date=${d.date}`} className={buttonVariants({ variant: "ghost", size: "sm" })}>
                  <Download /> This day (CSV)
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}
      <SalesSettingsForm market={market} />
    </main>
  )
}
