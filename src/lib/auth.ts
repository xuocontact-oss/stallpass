import "server-only"
import { cache } from "react"
import { notFound, redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import type { Market, Vendor } from "@/lib/types"

export type Profile = {
  id: string
  email: string
  full_name: string | null
  is_super_admin: boolean
  is_organizer: boolean
  is_trusted_organizer: boolean
  is_shopper: boolean
  home_zip: string | null
  suspended_at: string | null
  suspension_reason: string | null
  email_verified_at: string | null
  has_password: boolean
}

/** The signed-in user, verified with Supabase, or null. */
export const getUser = cache(async () => {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  if (!data?.claims) return null
  return { id: data.claims.sub, email: String(data.claims.email ?? "") }
})

/** For signed-in pages. Suspended accounts are sent to a notice page. */
export async function requireUser() {
  const user = await getUser()
  if (!user) redirect("/login")
  const profile = await getProfile()
  if (profile?.suspended_at) redirect("/suspended")
  return user
}

export const getProfile = cache(async (): Promise<Profile | null> => {
  const user = await getUser()
  if (!user) return null
  const supabase = await createClient()
  const { data } = await supabase
    .from("profiles")
    .select("id, email, full_name, is_super_admin, is_organizer, is_trusted_organizer, is_shopper, home_zip, suspended_at, suspension_reason, email_verified_at, has_password")
    .eq("id", user.id)
    .maybeSingle()
  return data
})

/** The signed-in person's vendor business, or null if they haven't made one. */
export const getMyVendor = cache(async (): Promise<Vendor | null> => {
  const user = await getUser()
  if (!user) return null
  const supabase = await createClient()
  const { data } = await supabase.from("vendors").select("*").eq("owner_id", user.id).maybeSingle()
  return data
})

/** For vendor pages: sends people without a business to onboarding first. */
export async function requireVendor() {
  const user = await requireUser()
  const vendor = await getMyVendor()
  if (!vendor) redirect("/onboarding")
  return { user, vendor }
}

/**
 * For admin pages and actions. Checked on the server every time; the database
 * checks it again with its own security rules. Non-admins get a plain 404.
 */
export async function requireAdmin() {
  await requireUser()
  const profile = await getProfile()
  if (!profile?.is_super_admin || profile.suspended_at) notFound()
  return profile
}

/** Same check for server actions, returning an error instead of a 404. */
export async function isAdmin() {
  const profile = await getProfile()
  return Boolean(profile?.is_super_admin && !profile.suspended_at)
}

/** For organizer pages: signed in and has said they run a market. */
export async function requireOrganizer() {
  const user = await requireUser()
  const profile = await getProfile()
  if (!profile?.is_organizer) redirect("/organizer/start")
  return { user, profile }
}

/**
 * The market, if the signed-in person is its organizer; otherwise a 404.
 * (The admin can see every market, so ownership is checked explicitly.)
 */
export const requireOrganizedMarket = cache(async (marketId: string): Promise<Market> => {
  const user = await requireUser()
  if (!/^[0-9a-f-]{36}$/i.test(marketId)) notFound()
  const supabase = await createClient()
  const { data } = await supabase
    .from("markets")
    .select("*")
    .eq("id", marketId)
    .eq("organizer_id", user.id)
    .maybeSingle()
  if (!data) notFound()
  return data as Market
})

/** Same check for server actions: the market, or null. */
export async function getOrganizedMarket(marketId: string): Promise<Market | null> {
  const user = await getUser()
  if (!user || !/^[0-9a-f-]{36}$/i.test(marketId)) return null
  const supabase = await createClient()
  const { data } = await supabase
    .from("markets")
    .select("*")
    .eq("id", marketId)
    .eq("organizer_id", user.id)
    .maybeSingle()
  return data as Market | null
}
