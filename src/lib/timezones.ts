/** Rough US time zone for a market's state (good enough for "sales that day"). */
const ZONES: Record<string, string> = {
  CA: "America/Los_Angeles", WA: "America/Los_Angeles", OR: "America/Los_Angeles", NV: "America/Los_Angeles",
  AZ: "America/Phoenix",
  CO: "America/Denver", UT: "America/Denver", NM: "America/Denver", MT: "America/Denver", WY: "America/Denver", ID: "America/Boise",
  TX: "America/Chicago", OK: "America/Chicago", KS: "America/Chicago", NE: "America/Chicago", SD: "America/Chicago", ND: "America/Chicago",
  MN: "America/Chicago", IA: "America/Chicago", MO: "America/Chicago", AR: "America/Chicago", LA: "America/Chicago", MS: "America/Chicago",
  AL: "America/Chicago", TN: "America/Chicago", WI: "America/Chicago", IL: "America/Chicago",
  AK: "America/Anchorage", HI: "Pacific/Honolulu", PR: "America/Puerto_Rico",
}

export function stateTimeZone(state: string | null | undefined): string {
  return ZONES[(state ?? "").toUpperCase()] ?? (state ? "America/New_York" : "America/Los_Angeles")
}

/** Minutes the time zone is ahead of UTC at a given moment (e.g. LA in summer: -420). */
function offsetMinutes(timeZone: string, at: Date): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(at)
      .map((p) => [p.type, p.value])
  )
  const asUTC = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second)
  return Math.round((asUTC - at.getTime()) / 60000)
}

/** The UTC moment of local midnight at the start of a date (handles daylight-saving days). */
function localMidnight(y: number, m: number, d: number, timeZone: string): number {
  const naive = Date.UTC(y, m - 1, d)
  const first = naive - offsetMinutes(timeZone, new Date(naive)) * 60000
  return naive - offsetMinutes(timeZone, new Date(first)) * 60000
}

/** The start and end (UTC) of a calendar day in a time zone, e.g. for "sales on 2026-10-04 in LA". */
export function zonedDayRange(date: string, timeZone: string): { start: string; end: string } {
  const [y, m, d] = date.split("-").map(Number)
  return {
    start: new Date(localMidnight(y, m, d, timeZone)).toISOString(),
    end: new Date(localMidnight(y, m, d + 1, timeZone)).toISOString(),
  }
}
