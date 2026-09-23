"use client"

import { useState } from "react"
import Link from "next/link"
import { ActionForm, SubmitButton } from "@/components/action-form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { savePaymentSettings } from "@/actions/payments"
import type { Market } from "@/lib/types"

/** "How do vendors pay?" for a market (organizer and admin). */
export function PaymentSettingsForm({ market, stripeReady, showStripe }: { market: Market; stripeReady: boolean; showStripe: boolean }) {
  const [method, setMethod] = useState(market.payment_method)
  const options = [
    { key: "none", label: "I'll tell accepted vendors how to pay", hint: "Cash, Venmo, invoice… Add instructions below." },
    ...(showStripe
      ? [{ key: "stripe", label: "Card payments on Stallpass", hint: stripeReady ? "Vendors pay in the app; Stripe pays you out." : "Connect Stripe first." }]
      : []),
    { key: "external_link", label: "My own payment link", hint: "For example a city payment portal, Square or PayPal page." },
  ] as const

  return (
    <ActionForm action={savePaymentSettings} className="space-y-4 rounded-xl border bg-background p-4">
      <input type="hidden" name="market_id" value={market.id} />
      <h2 className="font-semibold">How vendors pay the booth fee</h2>
      <div className="space-y-2">
        {options.map((o) => (
          <label
            key={o.key}
            className="flex items-start gap-2.5 rounded-lg border p-3 text-sm has-checked:border-primary has-checked:bg-secondary has-disabled:opacity-60"
          >
            <input
              type="radio"
              name="payment_method"
              value={o.key}
              checked={method === o.key}
              disabled={o.key === "stripe" && !stripeReady}
              onChange={() => setMethod(o.key as Market["payment_method"])}
              className="mt-0.5 accent-primary"
            />
            <span>
              <span className="block font-medium">{o.label}</span>
              <span className="text-muted-foreground">{o.hint}</span>
              {o.key === "stripe" && !stripeReady && (
                <Link href="/organizer/payments" className="ml-1 font-medium text-primary">
                  Connect Stripe
                </Link>
              )}
            </span>
          </label>
        ))}
      </div>
      {method === "external_link" && (
        <div className="space-y-1.5">
          <Label htmlFor="payment_link">Payment link</Label>
          <Input id="payment_link" name="payment_link" type="url" defaultValue={market.payment_link ?? ""} placeholder="https://…" required maxLength={500} />
        </div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="payment_instructions">Instructions for vendors (optional)</Label>
        <Textarea
          id="payment_instructions"
          name="payment_instructions"
          rows={2}
          maxLength={1000}
          defaultValue={market.payment_instructions ?? ""}
          placeholder="e.g. Pay within 7 days of acceptance. Put your business name in the notes."
        />
      </div>
      <SubmitButton pendingText="Saving…">Save payment settings</SubmitButton>
    </ActionForm>
  )
}
