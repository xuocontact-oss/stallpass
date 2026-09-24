"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { formText, safeNextPath, type ActionState } from "@/lib/form"
import { getUser } from "@/lib/auth"
import { cleanRef, recordSignupSource } from "@/lib/signup-source"
import { markEmailVerified, markHasPassword } from "@/lib/verification"

const emailSchema = z.email("Please enter a valid email address.")

/**
 * "Forgot password?": emails a 6-digit code (and a tap-to-sign-in link) to an
 * existing account. New accounts are made with a password instead.
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
    options: { emailRedirectTo: callback.toString(), captchaToken: input.captchaToken ?? undefined, shouldCreateUser: false },
  })

  if (error) {
    if (/captcha/i.test(error.message)) return { error: "Please complete the \"I'm not a robot\" check, then try again." }
    if (/signups? not allowed|user not found/i.test(error.message)) {
      return { error: "We couldn't find an account with that email. Create one instead." }
    }
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
  await markEmailVerified(data.user.id) // the code came from their inbox
  await recordSignupSource(data.user.id, input.market ?? null, cleanRef(input.ref))
  redirect(safeNextPath(input.next))
}

const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters for your password.")
  .max(72, "That password is too long (72 characters max).")

/**
 * Create an account with email + password. They're signed in straight away and
 * verify their email later (before sending applications or reviews).
 * If the Supabase project still requires confirming emails first, we fall back
 * to asking for the 6-digit code it emails.
 */
export async function signUpWithPassword(input: {
  email: string
  password: string
  next?: string
  market?: string | null
  ref?: string | null
  captchaToken?: string | null
}): Promise<ActionState & { needsCode?: boolean; exists?: boolean }> {
  const email = emailSchema.safeParse(input.email?.trim().toLowerCase())
  if (!email.success) return { error: email.error.issues[0].message }
  const password = passwordSchema.safeParse(input.password ?? "")
  if (!password.success) return { error: password.error.issues[0].message }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    email: email.data,
    password: password.data,
    options: {
      emailRedirectTo: `${siteUrl}/auth/callback?next=${encodeURIComponent(safeNextPath(input.next))}`,
      captchaToken: input.captchaToken ?? undefined,
    },
  })
  if (error) {
    if (/captcha/i.test(error.message)) return { error: "Please complete the \"I'm not a robot\" check, then try again." }
    if (/already|exists/i.test(error.message) || error.code === "user_already_exists") {
      return { error: "You already have an account with that email. Sign in instead.", exists: true }
    }
    if (error.code === "weak_password") return { error: "Pick a stronger password: at least 8 characters, not something common." }
    if (error.status === 429) return { error: "Too many tries. Wait a minute and try again." }
    console.error("Sign-up error:", error)
    return { error: "Something went wrong creating your account. Please try again." }
  }
  // An existing, unconfirmed email comes back as a user with no identities.
  if (data.user && data.user.identities?.length === 0) {
    return { error: "You already have an account with that email. Sign in instead.", exists: true }
  }
  if (data.user) {
    await markHasPassword(data.user.id)
    await recordSignupSource(data.user.id, input.market ?? null, cleanRef(input.ref))
  }
  if (!data.session) return { needsCode: true, success: `We emailed a 6-digit code to ${email.data}.` }
  redirect(safeNextPath(input.next))
}

/** Emails a 6-digit code to the signed-in person, to confirm their email. */
export async function sendVerifyCode(): Promise<ActionState> {
  const user = await getUser()
  if (!user?.email) return { error: "Please sign in again." }
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithOtp({ email: user.email, options: { shouldCreateUser: false } })
  if (error) {
    if (error.status === 429) return { error: "Too many emails sent recently. Wait a minute and try again." }
    console.error("Verify email error:", error)
    return { error: "We couldn't send the email. Please try again." }
  }
  return { success: user.email }
}

/** Checks the code from sendVerifyCode and marks the email as verified. */
export async function verifyEmailCode(code: string): Promise<ActionState> {
  const user = await getUser()
  if (!user?.email) return { error: "Please sign in again." }
  const token = (code ?? "").replace(/\D/g, "")
  if (!/^\d{6,10}$/.test(token)) return { error: "Enter the code from the email." }
  const supabase = await createClient()
  const { data, error } = await supabase.auth.verifyOtp({ email: user.email, token, type: "email" })
  if (error || data.user?.id !== user.id) {
    return { error: "That code didn't work. It may have expired. Check it, or send a new one." }
  }
  await markEmailVerified(user.id)
  revalidatePath("/", "layout")
  return { success: "Email verified. Thanks!" }
}

/** Set or change the password (also how "forgot password" finishes). */
export async function setPassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getUser()
  if (!user) return { error: "Please sign in again." }
  const password = passwordSchema.safeParse(formData.get("password") ?? "")
  if (!password.success) return { error: password.error.issues[0].message }
  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password: password.data })
  if (error) {
    if (error.code === "same_password") return { error: "That's already your password. Pick a new one." }
    if (error.code === "weak_password") return { error: "Pick a stronger password: at least 8 characters, not something common." }
    if (/reauth/i.test(error.message)) return { error: "For safety, sign in with an emailed code first, then set your password." }
    console.error("Set password error:", error)
    return { error: "Something went wrong. Please try again." }
  }
  await markHasPassword(user.id)
  redirect(safeNextPath(formText(formData, "next")))
}

/** Email + password sign-in. */
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
