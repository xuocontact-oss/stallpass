import { daysBetween } from "./dates.ts"

export type ReadinessStatus = "ready" | "expires_before_event" | "expired" | "missing"

export type ReadinessDoc = {
  id: string
  doc_type: string
  title: string | null
  expiration_date: string | null
}

export type ReadinessItem = {
  docType: string
  status: ReadinessStatus
  document: ReadinessDoc | null
}

/**
 * Compares a vendor's documents with what a market requires. A document must
 * stay valid through the LAST event date the vendor is applying for.
 */
export function checkReadiness(
  requiredTypes: string[],
  docs: ReadinessDoc[],
  eventDates: string[],
  today: string
): { items: ReadinessItem[]; ready: boolean } {
  const lastEvent = eventDates.length ? [...eventDates].sort().at(-1)! : today

  const items = requiredTypes.map((docType): ReadinessItem => {
    // Best copy: one that never expires, else the one that lasts longest.
    const best = docs
      .filter((d) => d.doc_type === docType)
      .sort((a, b) => {
        if (!a.expiration_date) return -1
        if (!b.expiration_date) return 1
        return b.expiration_date.localeCompare(a.expiration_date)
      })[0]

    if (!best) return { docType, status: "missing", document: null }
    if (best.expiration_date && daysBetween(today, best.expiration_date) < 0) {
      return { docType, status: "expired", document: best }
    }
    if (best.expiration_date && best.expiration_date < lastEvent) {
      return { docType, status: "expires_before_event", document: best }
    }
    return { docType, status: "ready", document: best }
  })

  return { items, ready: items.every((i) => i.status === "ready") }
}

/** The documents to attach by default: the best copy of each required type. */
export function defaultAttachments(items: ReadinessItem[]): string[] {
  return items.flatMap((i) => (i.document && i.status !== "expired" ? [i.document.id] : []))
}
