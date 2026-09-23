import { daysBetween } from "./dates.ts"

/** A document counts as "expiring soon" this many days before it expires. */
export const EXPIRING_SOON_DAYS = 30

export type DocStatus = "valid" | "expiring" | "expired" | "no_expiry"

export function documentStatus(expirationDate: string | null, today: string): DocStatus {
  if (!expirationDate) return "no_expiry"
  const days = daysBetween(today, expirationDate)
  if (days < 0) return "expired"
  if (days <= EXPIRING_SOON_DAYS) return "expiring"
  return "valid"
}

export const STATUS_LABELS: Record<DocStatus, string> = {
  valid: "Valid",
  expiring: "Expiring soon",
  expired: "Expired",
  no_expiry: "No expiry date",
}

/** Which reminder email (if any) is due for a document expiring in `daysLeft` days. */
export function reminderKindFor(daysLeft: number): "30_day" | "7_day" | null {
  if (daysLeft < 0) return null
  if (daysLeft <= 7) return "7_day"
  if (daysLeft <= 30) return "30_day"
  return null
}

/** Counts per status, for the dashboard. */
export function summarizeDocuments(docs: { expiration_date: string | null }[], today: string) {
  const counts: Record<DocStatus, number> = { valid: 0, expiring: 0, expired: 0, no_expiry: 0 }
  for (const d of docs) counts[documentStatus(d.expiration_date, today)]++
  return counts
}

/** Sort order for lists: problems first, then soonest expiry. */
export function compareByUrgency(
  a: { expiration_date: string | null },
  b: { expiration_date: string | null }
) {
  if (!a.expiration_date) return b.expiration_date ? 1 : 0
  if (!b.expiration_date) return -1
  return a.expiration_date.localeCompare(b.expiration_date)
}
