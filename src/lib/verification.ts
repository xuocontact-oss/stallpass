import "server-only"
import { createAdminClient } from "@/lib/supabase/server"

/**
 * Email verification. People sign up with a password and get in straight away;
 * they prove the email is theirs (a 6-digit code) before anything reaches other
 * people. Only the server sets these flags.
 */

export async function markEmailVerified(userId: string) {
  await createAdminClient()
    .from("profiles")
    .update({ email_verified_at: new Date().toISOString() })
    .eq("id", userId)
    .is("email_verified_at", null)
}

export async function markHasPassword(userId: string) {
  await createAdminClient().from("profiles").update({ has_password: true }).eq("id", userId)
}

export async function isEmailVerified(userId: string) {
  const { data } = await createAdminClient().from("profiles").select("email_verified_at").eq("id", userId).maybeSingle()
  return Boolean(data?.email_verified_at)
}

export const VERIFY_FIRST = "Verify your email first, so markets can reply to you."
