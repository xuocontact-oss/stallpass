/**
 * Date helpers. Dates are plain "YYYY-MM-DD" strings (no time of day), and
 * "today" is today in Los Angeles, so a document never flips to "expired" at
 * 5pm because a server somewhere is on UTC time.
 */

export const APP_TIME_ZONE = "America/Los_Angeles"

export function todayISO(timeZone = APP_TIME_ZONE, now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now)
}

function toUTC(iso: string) {
  const [y, m, d] = iso.split("-").map(Number)
  return Date.UTC(y, m - 1, d)
}

/** Whole days from `from` to `to` (negative if `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  return Math.round((toUTC(to) - toUTC(from)) / 86_400_000)
}

export function addDays(iso: string, days: number): string {
  return new Date(toUTC(iso) + days * 86_400_000).toISOString().slice(0, 10)
}

/** Day of week, 0 = Sunday. */
export function weekday(iso: string): number {
  return new Date(toUTC(iso)).getUTCDay()
}

export function isValidISODate(value: string | null | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  return addDays(value, 0) === value
}

/** "Mar 5, 2027" (or "5 mar 2027" with lang: "es") */
export function formatDate(iso: string | null | undefined, opts?: { weekday?: boolean; lang?: "en" | "es" }): string {
  if (!iso) return ""
  return new Date(toUTC(iso)).toLocaleDateString(opts?.lang === "es" ? "es-US" : "en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
    ...(opts?.weekday ? { weekday: "short" } : {}),
  })
}

/** "9:00" or "09:00:00" → "9am" / "9:30am" */
export function formatTime(t: string | null | undefined): string {
  if (!t) return ""
  const [h, m] = t.split(":").map(Number)
  const suffix = h >= 12 ? "pm" : "am"
  const hour = h % 12 === 0 ? 12 : h % 12
  return m ? `${hour}:${String(m).padStart(2, "0")}${suffix}` : `${hour}${suffix}`
}

/** "in 12 days", "tomorrow", "today", "3 days ago" (Spanish with lang: "es") */
export function relativeDays(days: number, lang: "en" | "es" = "en"): string {
  if (lang === "es") {
    if (days === 0) return "hoy"
    if (days === 1) return "mañana"
    if (days === -1) return "ayer"
    return days > 0 ? `en ${days} días` : `hace ${-days} días`
  }
  if (days === 0) return "today"
  if (days === 1) return "tomorrow"
  if (days === -1) return "yesterday"
  return days > 0 ? `in ${days} days` : `${-days} days ago`
}
