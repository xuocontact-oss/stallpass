"use server"

import { redirect } from "next/navigation"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { formText, safeNextPath, type ActionState } from "@/lib/form"

const emailSchema = z.email("Please enter a valid email address.")

/** Emails a one-click sign-in link. Also creates the account on first use. */
export async function sendMagicLink(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = emailSchema.safeParse(formText(formData, "email")?.toLowerCase())
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const next = safeNextPath(formText(formData, "next"))
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data,
    options: {
      emailRedirectTo: `${siteUrl}/auth/callback?next=${encodeURIComponent(next)}`,
      captchaToken: formText(formData, "cf-turnstile-response") ?? undefined,
    },
  })

  if (error) {
    if (/captcha/i.test(error.message)) return { error: "Please complete the \"I'm not a robot\" check, then try again." }
    if (error.status === 429) {
      return { error: "Too many emails sent recently. Wait a few minutes and try again." }
    }
    console.error("Magic link error:", error)
    return { error: "We couldn't send the email. Please try again." }
  }
  return { success: `Check ${parsed.data} for your sign-in link.` }
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
