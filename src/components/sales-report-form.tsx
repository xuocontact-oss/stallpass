"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { ActionForm, SubmitButton } from "@/components/action-form"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { fillSalesFromSquare, saveSalesReport } from "@/actions/sales"
import { useT } from "@/lib/i18n/client"

const toDollars = (cents: number | null | undefined) => (cents == null ? "" : (cents / 100).toFixed(cents % 100 ? 2 : 0))

/** Report a market day's sales: type them in, or fill from Square. */
export function SalesReportForm({
  applicationId,
  date,
  squareConnected,
  existing,
}: {
  applicationId: string
  date: string
  squareConnected: boolean
  existing: { gross_sales_cents: number; card_sales_cents: number | null; cash_sales_cents: number | null; transactions: number | null; notes: string | null } | null
}) {
  const [gross, setGross] = useState(toDollars(existing?.gross_sales_cents))
  const [card, setCard] = useState(toDollars(existing?.card_sales_cents))
  const [cash, setCash] = useState(toDollars(existing?.cash_sales_cents))
  const [count, setCount] = useState(existing?.transactions?.toString() ?? "")
  const [source, setSource] = useState<"manual" | "square">("manual")
  const [pending, startTransition] = useTransition()
  const { t } = useT()

  function fromSquare() {
    startTransition(async () => {
      const r = await fillSalesFromSquare(applicationId, date)
      if (r.error || !r.sales) return void toast.error(t(r.error ?? "Couldn't get your Square sales."))
      const s = r.sales
      if (s.count === 0) {
        toast.message(t("Square shows no sales that day. If you took cash or used another reader, type the totals in."))
        return
      }
      setGross(toDollars(s.gross))
      setCard(toDollars(s.card))
      setCash(toDollars(s.cash))
      setCount(String(s.count))
      setSource("square")
      toast.success(t("Filled in from Square. Add any cash you didn't ring up, then submit."))
    })
  }

  return (
    <ActionForm action={saveSalesReport} className="space-y-4">
      <input type="hidden" name="application_id" value={applicationId} />
      <input type="hidden" name="event_date" value={date} />
      <input type="hidden" name="source" value={source} />
      {squareConnected && (
        <Button type="button" variant="outline" className="w-full" onClick={fromSquare} disabled={pending}>
          {pending ? t("Asking Square…") : t("Fill in from Square")}
        </Button>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="gross">{t("Total sales ($)")}</Label>
        <Input id="gross" name="gross" inputMode="decimal" required value={gross} onChange={(e) => { setGross(e.target.value); setSource("manual") }} placeholder="845" className="h-12 text-lg" />
        <p className="text-xs text-muted-foreground">{t("Before tips. Include cash and card.")}</p>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="card" className="text-xs">{t("Card ($)")}</Label>
          <Input id="card" name="card" inputMode="decimal" value={card} onChange={(e) => setCard(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cash" className="text-xs">{t("Cash ($)")}</Label>
          <Input id="cash" name="cash" inputMode="decimal" value={cash} onChange={(e) => setCash(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="transactions" className="text-xs">{t("# of sales")}</Label>
          <Input id="transactions" name="transactions" inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value)} />
        </div>
      </div>
      <p className="-mt-2 text-xs text-muted-foreground">{t("Card, cash and number of sales are optional.")}</p>
      <div className="space-y-1.5">
        <Label htmlFor="notes">{t("Notes (optional)")}</Label>
        <Textarea id="notes" name="notes" rows={2} maxLength={500} defaultValue={existing?.notes ?? ""} placeholder={t("e.g. Rained after noon")} />
      </div>
      <SubmitButton size="lg" className="w-full" pendingText={t("Sending…")}>
        {existing ? t("Update my report") : t("Send my sales report")}
      </SubmitButton>
      <p className="text-xs text-muted-foreground">{t("Only this market's organizer sees your numbers.")}</p>
    </ActionForm>
  )
}
