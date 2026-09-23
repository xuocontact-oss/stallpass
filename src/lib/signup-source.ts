import "server-only"
import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/server"

/** Cleans a "who signed them up" code like "ak" or "echo-lake-team". */
export function cleanRef(v: string | null | undefined): string | null {
  const s = (v ?? "").toLowerCase().trim()
  return /^[a-z0-9-]{1,40}$/.test(s) ? s : null
}

/**
 * Remembers which market (and whose QR code) a NEW account came from, for the
 * outreach stats. Only the first time, and only for accounts made in the last day.
 */
export async function recordSignupSource(userId: string, marketId: string | null, ref: string | null) {
  const market = marketId && z.uuid().safeParse(marketId).success ? marketId : null
  if (!market && !ref) return
  const db = createAdminClient()
  const since = new Date(Date.now() - 86_400_000).toISOString()
  await db
    .from("profiles")
    .update({ signup_market_id: market, signup_ref: ref })
    .eq("id", userId)
    .is("signup_market_id", null)
    .is("signup_ref", null)
    .gte("created_at", since)
}
