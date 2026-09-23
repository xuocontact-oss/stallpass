"use server"

import { redirect } from "next/navigation"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { formText, safeNextPath, type ActionState } from "@/lib/form"
import { cleanRef, recordSignupSource } from "@/lib/signup-source"

const emailSchema = z.email("Please enter a valid email address.")

/**
 * Step 1 of signing in (or up): emails a 6-digit code (and a sign-in link, for
 * anyone who prefers tapping). Creates the account on first use.
 */
export async function sendSignInCode(input: {
  email: string
  next?: string
  market?: string | null
  ref?: string | null
  captchaToken?: string | null
}): Promise<ActionState & { email?: string }> {
  const parsed = emailSchema.safeParse(input.email?.trim().toLowerCase())
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const next = safeNextPath(input.next)
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
  const callback = new URL(`${siteUrl}/auth/callback`)
  callback.searchParams.set("next", next)
  if (input.market && z.uuid().safeParse(input.market).success) callback.searchParams.set("m", input.market)
  const ref = cleanRef(input.ref)
  if (ref) callback.searchParams.set("ref", ref)

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data,
    options: { emailRedirectTo: callback.toString(), captchaToken: input.captchaToken ?? undefined },
  })

  if (error) {
    if (/captcha/i.test(error.message)) return { error: "Please complete the \"I'm not a robot\" check, then try again." }
    if (error.status === 429) return { error: "Too many emails sent recently. Wait a minute and try again." }
    console.error("Sign-in email error:", error)
    return { error: "We couldn't send the email. Check the address and try again." }
  }
  return { success: `We emailed a 6-digit code to ${parsed.data}.`, email: parsed.data }
}

/** Step 2: the 6-digit code from the email. Signs them in right here. */
export async function verifySignInCode(input: {
  email: string
  code: string
  next?: string
  market?: string | null
  ref?: string | null
}): Promise<ActionState> {
  const email = input.email?.trim().toLowerCase()
  const token = (input.code ?? "").replace(/\D/g, "")
  if (!emailSchema.safeParse(email).success) return { error: "Start again with your email." }
  if (!/^\d{6,10}$/.test(token)) return { error: "Enter the code from the email." }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.verifyOtp({ email, token, type: "email" })
  if (error || !data.user) {
    return { error: "That code didn't work. It may have expired. Check it, or send a new one." }
  }
  await recordSignupSource(data.user.id, input.market ?? null, cleanRef(input.ref))
  redirect(safeNextPath(input.next))
}

/** Password sign-in (used by the demo accounts; optional for everyone else). */
export async function signInWithPassword(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const email = formText(formData, "email")?.toLowerCase() ?? ""
  const password = formText(formData, "password") ?? ""
  if (!emailSchema.safeParse(email).success || !password) {
    return { error: "Enter your email and password." }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
    options: { captchaToken: formText(formData, "cf-turnstile-response") ?? undefined },
  })
  if (error) {
    if (/captcha/i.test(error.message)) return { error: "Please complete the \"I'm not a robot\" check, then try again." }
    return { error: "Wrong email or password." }
  }

  redirect(safeNextPath(formText(formData, "next")))
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect("/")
}
