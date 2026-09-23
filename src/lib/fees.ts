import type { BoothFee } from "./types.ts"

/**
 * What the vendor owes for an application: the chosen booth's fee for each
 * date they applied for. Falls back to the cheapest booth if none was chosen.
 * Returns null when the market hasn't listed a fee.
 */
export function boothFeeTotal(
  fees: BoothFee[],
  boothChoice: string | null,
  dateCount: number
): { perDate: number; total: number; label: string } | null {
  const fee = fees.find((f) => f.label === boothChoice) ?? [...fees].sort((a, b) => a.amount_cents - b.amount_cents)[0]
  if (!fee || dateCount < 1) return null
  return { perDate: fee.amount_cents, total: fee.amount_cents * dateCount, label: fee.label }
}

/** Stallpass's cut: a percentage plus a flat amount, never more than the payment itself. */
export function platformFee(amountCents: number, percent: number, flatCents: number): number {
  const fee = Math.round((amountCents * percent) / 100) + flatCents
  return Math.max(0, Math.min(fee, amountCents))
}

/** "$1,234.50" / "1234.5" / "" → cents (null if blank or not a number). */
export function parseDollars(input: string | null | undefined): number | null {
  const s = (input ?? "").replace(/[$,\s]/g, "")
  if (!s) return null
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return NaN
  return Math.round(Number.parseFloat(s) * 100)
}
