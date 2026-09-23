import { ActionForm, SubmitButton } from "@/components/action-form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { saveSalesSettings } from "@/actions/sales"
import type { Market } from "@/lib/types"

/** Does this market collect vendor sales reports? */
export function SalesSettingsForm({ market }: { market: Market }) {
  return (
    <ActionForm action={saveSalesSettings} className="space-y-4 rounded-xl border bg-background p-4">
      <input type="hidden" name="market_id" value={market.id} />
      <div>
        <h2 className="font-semibold">Sales reports from vendors</h2>
        <p className="text-sm text-muted-foreground">
          Vendors get a reminder after each market day. They can type totals in or fill them from Square.
        </p>
      </div>
      <div className="space-y-2">
        {[
          { key: "off", label: "Don't collect sales" },
          { key: "optional", label: "Ask vendors (optional)" },
          { key: "required", label: "Required after every market day" },
        ].map((o) => (
          <label key={o.key} className="flex items-center gap-2.5 rounded-lg border p-3 text-sm has-checked:border-primary has-checked:bg-secondary">
            <input type="radio" name="sales_reporting" value={o.key} defaultChecked={market.sales_reporting === o.key} className="accent-primary" />
            {o.label}
          </label>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="sales_report_due_days">Days to report</Label>
          <Input id="sales_report_due_days" name="sales_report_due_days" type="number" min={1} max={30} defaultValue={market.sales_report_due_days} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sales_fee_percent">% of sales you charge (optional)</Label>
          <Input id="sales_fee_percent" name="sales_fee_percent" type="number" step="0.1" min={0} max={50} defaultValue={market.sales_fee_percent ?? ""} placeholder="e.g. 6" />
        </div>
      </div>
      <SubmitButton pendingText="Saving…">Save</SubmitButton>
    </ActionForm>
  )
}
