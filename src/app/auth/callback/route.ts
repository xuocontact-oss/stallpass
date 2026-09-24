import { NextResponse, type NextRequest } from "next/server"
import type { EmailOtpType } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
import { safeNextPath } from "@/lib/form"
import { cleanRef, recordSignupSource } from "@/lib/signup-source"
import { markEmailVerified } from "@/lib/verification"

/** The page the sign-in email link opens. It finishes signing the person in. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const next = safeNextPath(searchParams.get("next"))
  const code = searchParams.get("code")
  const tokenHash = searchParams.get("token_hash")
  const type = searchParams.get("type") as EmailOtpType | null

  const supabase = await createClient()
  let userId: string | undefined
  if (code) {
    userId = (await supabase.auth.exchangeCodeForSession(code)).data.user?.id
  } else if (tokenHash && type) {
    userId = (await supabase.auth.verifyOtp({ token_hash: tokenHash, type })).data.user?.id
  }
  const ok = Boolean(userId)
  // Came from a market's QR code? Remember it (new accounts only).
  if (userId) await markEmailVerified(userId) // the link came from their inbox
  if (userId) await recordSignupSource(userId, searchParams.get("m"), cleanRef(searchParams.get("ref")))

  return NextResponse.redirect(new URL(ok ? next : "/login?error=link", origin))
}
