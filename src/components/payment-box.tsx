import { CheckCircle2, CreditCard, ExternalLink } from "lucide-react"
import { ActionButton } from "@/components/action-button"
import { reportExternalPayment, startBoothPayment } from "@/actions/payments"
import { formatDate } from "@/lib/dates"
import { boothFeeTotal } from "@/lib/fees"
import { formatMoney } from "@/lib/markets"
import type { Application, Market, Payment } from "@/lib/types"

/** What the vendor sees about paying the booth fee on an accepted application. */
export function PaymentBox({
  app,
  market,
  payments,
  stripeReady,
}: {
  app: Application
  market: Market
  payments: Payment[]
  stripeReady: boolean
}) {
  const fee = boothFeeTotal(market.booth_fees, app.booth_choice, app.event_dates.length)
  const done = payments.find((p) => ["paid", "confirmed"].includes(p.status))
  const reported = payments.find((p) => p.status === "reported")
  const rejected = payments.find((p) => p.status === "rejected")

  if (app.status === "paid" || done) {
    return (
      <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
        <p className="flex items-center gap-2 font-semibold">
          <CheckCircle2 className="size-5 text-emerald-600" /> Booth fee paid
        </p>
        {done && (
          <p className="mt-1">
            {done.amount_cents != null && `${formatMoney(done.amount_cents)} · `}
            {done.method === "stripe" ? "Paid by card" : "Paid on the market's payment page"}
            {done.paid_at && ` · ${formatDate(done.paid_at.slice(0, 10))}`}
            {done.method === "stripe" && ` · Receipt #${done.id.slice(0, 8).toUpperCase()}`}
          </p>
        )}
      </section>
    )
  }
  if (app.status !== "accepted") return null

  return (
    <section className="space-y-3 rounded-xl border-2 border-primary/30 bg-background p-4">
      <h2 className="flex items-center gap-2 font-semibold">
        <CreditCard className="size-5 text-primary" aria-hidden /> Pay your booth fee
      </h2>
      {fee && (
        <p className="text-sm">
          {fee.label}: {formatMoney(fee.perDate)}
          {app.event_dates.length > 1 && ` × ${app.event_dates.length} dates`} ={" "}
          <span className="font-semibold">{formatMoney(fee.total)}</span>
        </p>
      )}
      {market.payment_instructions && <p className="text-sm whitespace-pre-line text-muted-foreground">{market.payment_instructions}</p>}

      {market.payment_method === "stripe" && stripeReady && fee ? (
        <ActionButton action={startBoothPayment.bind(null, app.id)} size="lg" className="w-full" pendingText="Opening secure checkout…">
          Pay {formatMoney(fee.total)} by card
        </ActionButton>
      ) : market.payment_method === "external_link" && market.payment_link ? (
        reported ? (
          <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950">
            You told us you paid. Waiting for the organizer to confirm.
          </p>
        ) : (
          <div className="space-y-2">
            {rejected && (
              <p className="text-sm text-destructive">The organizer couldn&apos;t find your payment. Check with them, then try again.</p>
            )}
            <a
              href={market.payment_link}
              target="_blank"
              rel="noopener nofollow"
              className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary px-5 text-base font-medium text-primary-foreground"
            >
              <ExternalLink className="size-5" /> Pay on {market.name}&apos;s payment page
            </a>
            <ActionButton action={reportExternalPayment.bind(null, app.id)} variant="outline" className="w-full" pendingText="Saving…">
              I&apos;ve paid
            </ActionButton>
            <p className="text-xs text-muted-foreground">
              This opens the market&apos;s own payment page. Stallpass doesn&apos;t see or handle that payment.
            </p>
          </div>
        )
      ) : (
        <p className="text-sm text-muted-foreground">
          {market.payment_instructions ? "" : "The market will tell you how to pay."}
        </p>
      )}
    </section>
  )
}
