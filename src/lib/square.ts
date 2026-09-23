import "server-only"
import { siteUrl } from "@/lib/email"
import { createAdminClient } from "@/lib/supabase/server"
import { zonedDayRange } from "@/lib/timezones"
import { decryptToken, encryptToken } from "@/lib/token-crypto"

/**
 * Square connection (read-only): vendors connect once, then Stallpass can fill
 * in a market day's sales from their Square payments. We only ask Square for
 * permission to READ payments and the business name.
 *
 * Settings: SQUARE_APPLICATION_ID, SQUARE_APPLICATION_SECRET,
 * SQUARE_ENVIRONMENT ("sandbox" for testing, "production" when live),
 * TOKEN_ENCRYPTION_KEY.
 */

const SQUARE_VERSION = "2025-01-23"
const SCOPES = ["PAYMENTS_READ", "MERCHANT_PROFILE_READ"]

export function squareConfigured() {
  return Boolean(process.env.SQUARE_APPLICATION_ID && process.env.SQUARE_APPLICATION_SECRET && process.env.TOKEN_ENCRYPTION_KEY)
}

function base() {
  return process.env.SQUARE_ENVIRONMENT === "production" ? "https://connect.squareup.com" : "https://connect.squareupsandbox.com"
}

export function squareRedirectUri() {
  return siteUrl("/api/square/callback")
}

export function squareAuthorizeUrl(state: string) {
  const url = new URL(`${base()}/oauth2/authorize`)
  url.searchParams.set("client_id", process.env.SQUARE_APPLICATION_ID!)
  url.searchParams.set("scope", SCOPES.join(" "))
  url.searchParams.set("session", "false")
  url.searchParams.set("state", state)
  url.searchParams.set("redirect_uri", squareRedirectUri())
  return url.toString()
}

type TokenResponse = {
  access_token: string
  refresh_token?: string
  expires_at?: string
  merchant_id: string
}

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(`${base()}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Square-Version": SQUARE_VERSION },
    body: JSON.stringify({
      client_id: process.env.SQUARE_APPLICATION_ID,
      client_secret: process.env.SQUARE_APPLICATION_SECRET,
      ...body,
    }),
  })
  const json = await res.json()
  if (!res.ok || !json.access_token) throw new Error(`Square token error: ${JSON.stringify(json.errors ?? json).slice(0, 300)}`)
  return json as TokenResponse
}

async function squareGet(path: string, accessToken: string) {
  const res = await fetch(`${base()}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}`, "Square-Version": SQUARE_VERSION, Accept: "application/json" },
  })
  const json = await res.json()
  if (!res.ok) throw new Error(`Square error: ${JSON.stringify(json.errors ?? json).slice(0, 300)}`)
  return json
}

/** Finishes "Connect Square": swaps Square's one-time code for tokens and saves them encrypted. */
export async function saveSquareConnection(vendorId: string, code: string) {
  const token = await tokenRequest({ code, grant_type: "authorization_code", redirect_uri: squareRedirectUri() })
  let businessName: string | null = null
  try {
    const m = await squareGet(`/v2/merchants/${encodeURIComponent(token.merchant_id)}`, token.access_token)
    businessName = m.merchant?.business_name ?? null
  } catch {
    // The name is just a nice-to-have.
  }
  const db = createAdminClient()
  const { error } = await db.from("pos_connections").upsert({
    vendor_id: vendorId,
    provider: "square",
    merchant_id: token.merchant_id,
    business_name: businessName,
    access_token_enc: encryptToken(token.access_token),
    refresh_token_enc: token.refresh_token ? encryptToken(token.refresh_token) : null,
    expires_at: token.expires_at ?? null,
    updated_at: new Date().toISOString(),
  })
  if (error) throw new Error(error.message)
}

/** A working access token, refreshed first if it's close to expiring. */
async function accessTokenFor(vendorId: string): Promise<string | null> {
  const db = createAdminClient()
  const { data } = await db
    .from("pos_connections")
    .select("access_token_enc, refresh_token_enc, expires_at")
    .eq("vendor_id", vendorId)
    .eq("provider", "square")
    .maybeSingle()
  if (!data) return null
  const expiresSoon = data.expires_at && new Date(data.expires_at).getTime() - Date.now() < 7 * 86_400_000
  if (expiresSoon && data.refresh_token_enc) {
    const token = await tokenRequest({ grant_type: "refresh_token", refresh_token: decryptToken(data.refresh_token_enc) })
    await db
      .from("pos_connections")
      .update({
        access_token_enc: encryptToken(token.access_token),
        refresh_token_enc: token.refresh_token ? encryptToken(token.refresh_token) : data.refresh_token_enc,
        expires_at: token.expires_at ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("vendor_id", vendorId)
      .eq("provider", "square")
    return token.access_token
  }
  return decryptToken(data.access_token_enc)
}

export type DaySales = { gross: number; card: number; cash: number; count: number }

/**
 * Totals of a vendor's completed Square payments on one local day, in cents.
 * Tips are left out (markets usually want sales without tips) and refunds are
 * subtracted.
 */
export async function squareSalesForDay(vendorId: string, date: string, timeZone: string): Promise<DaySales | null> {
  const token = await accessTokenFor(vendorId)
  if (!token) return null
  const { start, end } = zonedDayRange(date, timeZone)
  const totals: DaySales = { gross: 0, card: 0, cash: 0, count: 0 }
  let cursor: string | undefined
  for (let page = 0; page < 50; page++) {
    const qs = new URLSearchParams({ begin_time: start, end_time: end, sort_order: "ASC", limit: "100" })
    if (cursor) qs.set("cursor", cursor)
    const json = await squareGet(`/v2/payments?${qs}`, token)
    for (const p of json.payments ?? []) {
      if (p.status !== "COMPLETED") continue
      const amount = (p.amount_money?.amount ?? 0) - (p.refunded_money?.amount ?? 0)
      totals.gross += amount
      totals.count++
      if (p.source_type === "CASH") totals.cash += amount
      else totals.card += amount
    }
    cursor = json.cursor
    if (!cursor) break
  }
  return totals
}

/** "Disconnect Square": tells Square to cancel our access, then forgets the tokens. */
export async function disconnectSquare(vendorId: string) {
  const db = createAdminClient()
  const { data } = await db
    .from("pos_connections")
    .select("access_token_enc")
    .eq("vendor_id", vendorId)
    .eq("provider", "square")
    .maybeSingle()
  if (data) {
    try {
      await fetch(`${base()}/oauth2/revoke`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Square-Version": SQUARE_VERSION,
          Authorization: `Client ${process.env.SQUARE_APPLICATION_SECRET}`,
        },
        body: JSON.stringify({ client_id: process.env.SQUARE_APPLICATION_ID, access_token: decryptToken(data.access_token_enc) }),
      })
    } catch (e) {
      console.error("Square revoke failed (removing locally anyway):", e)
    }
  }
  await db.from("pos_connections").delete().eq("vendor_id", vendorId).eq("provider", "square")
}
