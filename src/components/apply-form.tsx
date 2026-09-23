"use client"

import { useMemo, useState } from "react"
import { Mail, Send } from "lucide-react"
import { ActionForm, SubmitButton } from "@/components/action-form"
import { DocStatusBadge } from "@/components/doc-status-badge"
import { ReadinessList } from "@/components/readiness-list"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { applyToMarket } from "@/actions/applications"
import { documentTypeLabel } from "@/lib/constants"
import { formatDate, formatTime } from "@/lib/dates"
import { documentStatus } from "@/lib/documents"
import { formatMoney } from "@/lib/markets"
import { checkReadiness, defaultAttachments } from "@/lib/readiness"
import type { Market, MarketDate, Resource, VendorDocument } from "@/lib/types"
import { useT } from "@/lib/i18n/client"

export function ApplyForm({
  market,
  dates,
  docs,
  takenDates,
  today,
  offers,
}: {
  market: Market
  dates: MarketDate[]
  docs: VendorDocument[]
  takenDates: string[]
  today: string
  offers: Record<string, Resource>
}) {
  const [picked, setPicked] = useState<string[]>(() => {
    const first = dates.find((d) => !takenDates.includes(d.event_date))
    return first ? [first.event_date] : []
  })
  const initial = useMemo(
    () => defaultAttachments(checkReadiness(market.required_doc_types, docs, picked, today).items),
    // Only for the first render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )
  const [attached, setAttached] = useState<string[]>(initial)
  const { t, lang } = useT()

  const attachedDocs = docs.filter((d) => attached.includes(d.id))
  const readiness = checkReadiness(market.required_doc_types, attachedDocs, picked, today)
  const deadlinePassed = market.application_deadline != null && market.application_deadline < today

  const toggle = (list: string[], set: (v: string[]) => void, value: string) =>
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value])

  return (
    <ActionForm action={applyToMarket} className="space-y-5">
      <input type="hidden" name="market_id" value={market.id} />

      <section className="space-y-3 rounded-xl border bg-background p-4">
        <h2 className="font-semibold">1. {t("Which dates?")}</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {dates.map((d) => {
            const taken = takenDates.includes(d.event_date)
            return (
              <label
                key={d.id}
                className="flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm has-checked:border-primary has-checked:bg-secondary has-disabled:opacity-50"
              >
                <input
                  type="checkbox"
                  name="dates"
                  value={d.event_date}
                  checked={picked.includes(d.event_date)}
                  disabled={taken || (!picked.includes(d.event_date) && picked.length >= 12)}
                  onChange={() => toggle(picked, setPicked, d.event_date)}
                  className="size-4 accent-primary"
                />
                <span>
                  <span className="font-medium">{formatDate(d.event_date, { weekday: true, lang })}</span>
                  {d.starts_at && <span className="text-muted-foreground"> · {formatTime(d.starts_at)}</span>}
                  {taken && <span className="block text-xs">{t("Already applied")}</span>}
                </span>
              </label>
            )
          })}
        </div>
      </section>

      {market.booth_fees.length > 0 && (
        <section className="space-y-3 rounded-xl border bg-background p-4">
          <h2 className="font-semibold">2. {t("Which booth?")}</h2>
          <div className="space-y-2">
            {market.booth_fees.map((f, i) => (
              <label
                key={f.label}
                className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-sm has-checked:border-primary has-checked:bg-secondary"
              >
                <span className="flex items-center gap-2.5">
                  <input type="radio" name="booth_choice" value={f.label} defaultChecked={i === 0} className="accent-primary" />
                  {f.label}
                </span>
                <span className="font-semibold">{formatMoney(f.amount_cents)}</span>
              </label>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{t("You don't pay anything now. Markets confirm first.")}</p>
        </section>
      )}

      <section className="space-y-3 rounded-xl border bg-background p-4">
        <h2 className="font-semibold">{market.booth_fees.length > 0 ? "3." : "2."} {t("Documents to send")}</h2>
        {market.required_doc_types.length > 0 && <ReadinessList items={readiness.items} offers={offers} />}
        {docs.length > 0 ? (
          <div className="space-y-2 border-t pt-3">
            <p className="text-sm text-muted-foreground">{t("Tick what to attach:")}</p>
            {docs.map((d) => (
              <label key={d.id} className="flex items-center gap-2.5 text-sm">
                <input
                  type="checkbox"
                  name="documents"
                  value={d.id}
                  checked={attached.includes(d.id)}
                  onChange={() => toggle(attached, setAttached, d.id)}
                  className="size-4 accent-primary"
                />
                <span className="min-w-0 flex-1 truncate">
                  {t(documentTypeLabel(d.doc_type))}
                  {d.title && <span className="text-muted-foreground"> · {d.title}</span>}
                  {market.required_doc_types.includes(d.doc_type) && (
                    <span className="ml-1 text-xs text-primary">{t("required")}</span>
                  )}
                </span>
                <DocStatusBadge status={documentStatus(d.expiration_date, today)} />
              </label>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t("You haven't added any documents yet.")}</p>
        )}
      </section>

      <section className="space-y-2 rounded-xl border bg-background p-4">
        <Label htmlFor="note">{t("Note to the market (optional)")}</Label>
        <Textarea
          id="note"
          name="note"
          rows={3}
          maxLength={1000}
          placeholder={t("e.g. We've done 40+ markets in LA and bring our own generator.")}
        />
      </section>

      {deadlinePassed && (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950">
          {t("The application deadline ({date}) has passed. You can still send it, but the market may not accept late applications.", { date: formatDate(market.application_deadline, { lang }) })}
        </p>
      )}

      {!readiness.ready && (
        <label className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-950">
          <input type="checkbox" name="send_anyway" className="mt-0.5 size-4 accent-primary" />
          {t("Some required documents are missing or won't be valid on the event date. Send anyway (the market may turn it down).")}
        </label>
      )}

      <p className="flex items-start gap-2 text-sm text-muted-foreground">
        {market.is_claimed ? (
          <>
            <Send className="mt-0.5 size-4 shrink-0" aria-hidden /> {t("This market is on Stallpass. Your application goes straight to the organizer.")}
          </>
        ) : (
          <>
            <Mail className="mt-0.5 size-4 shrink-0" aria-hidden /> {t("We'll email your application to the market, with your profile and secure links to the documents you ticked. They can reply to you directly.")}
          </>
        )}
      </p>

      <div className="flex flex-col gap-2 sm:flex-row-reverse">
        <SubmitButton size="lg" className="sm:flex-1" name="intent" value="send" pendingText={t("Sending…")} disabled={picked.length === 0}>
          {t("Send application")}
        </SubmitButton>
        <SubmitButton size="lg" variant="outline" name="intent" value="draft" pendingText={t("Saving…")} disabled={picked.length === 0}>
          {t("Save as draft")}
        </SubmitButton>
      </div>
    </ActionForm>
  )
}
