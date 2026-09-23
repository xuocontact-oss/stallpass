"use client"

import Link from "next/link"
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react"
import { documentTypeLabel } from "@/lib/constants"
import { formatDate } from "@/lib/dates"
import { PromoCode } from "@/components/promo-code"
import type { ReadinessItem } from "@/lib/readiness"
import type { Resource } from "@/lib/types"
import { useT } from "@/lib/i18n/client"

/** ✅ / ⚠️ / ❌ list of a market's required documents vs. the vendor's vault. */
export function ReadinessList({ items, offers = {} }: { items: ReadinessItem[]; offers?: Record<string, Resource> }) {
  const { t, lang } = useT()
  return (
    <ul className="space-y-2">
      {items.map((i) => {
        const doc = i.document
        const fixHref = doc ? `/documents/${doc.id}` : `/documents/new?type=${i.docType}`
        return (
          <li key={i.docType} className="flex items-start gap-2.5 text-sm">
            {i.status === "ready" ? (
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" aria-label={t("Ready")} />
            ) : i.status === "expires_before_event" ? (
              <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-500" aria-label={t("Expires before the event")} />
            ) : (
              <XCircle className="mt-0.5 size-5 shrink-0 text-red-600" aria-label={t("Missing or expired")} />
            )}
            <div className="min-w-0 flex-1">
              <p className="font-medium">{t(documentTypeLabel(i.docType))}</p>
              {(() => {
                const offer = i.status !== "ready" ? offers[i.docType] : undefined
                if (!offer) return null
                return (
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 rounded-md bg-primary/5 p-2 text-xs">
                    <span>
                      {t("Need one?")}{" "}
                      <a href={`/go/${offer.id}?from=readiness`} target="_blank" rel="noopener nofollow sponsored" className="font-medium text-primary hover:underline">
                        {offer.name}
                      </a>
                      {offer.promo_text && ` · ${offer.promo_text}`}
                    </span>
                    {offer.promo_code && <PromoCode resourceId={offer.id} code={offer.promo_code} page="readiness" />}
                    <span className="w-full text-[10px] text-muted-foreground">{t("Partner. Stallpass may earn a commission.")}</span>
                  </div>
                )
              })()}
              <p className="text-muted-foreground">
                {i.status === "ready" &&
                  (doc?.expiration_date ? t("Valid until {date}", { date: formatDate(doc.expiration_date, { lang }) }) : t("On file"))}
                {i.status === "expires_before_event" && t("Expires {date}, before the event", { date: formatDate(doc!.expiration_date, { lang }) })}
                {i.status === "expired" && t("Expired {date}", { date: formatDate(doc!.expiration_date, { lang }) })}
                {i.status === "missing" && t("Not in your documents yet")}
              </p>
            </div>
            {i.status !== "ready" && (
              <Link href={fixHref} className="shrink-0 text-sm font-medium text-primary">
                {i.status === "missing" ? t("Add") : t("Renew")}
              </Link>
            )}
          </li>
        )
      })}
    </ul>
  )
}
