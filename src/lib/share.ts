import "server-only"
import { createAdminClient } from "@/lib/supabase/server"
import type { Application } from "@/lib/types"

/**
 * Looks up an application by the secret link in the market's email.
 * Returns null when the link is wrong or has expired. Uses full access
 * because the market isn't signed in: the long random token IS the permission.
 */
export async function findSharedApplication(token: string) {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null
  const db = createAdminClient()
  const { data } = await db.from("applications").select("*").eq("share_token", token).maybeSingle()
  if (!data) return null
  const app = data as Application
  const expired = !app.share_expires_at || new Date(app.share_expires_at) < new Date()
  return { app, expired, db }
}
