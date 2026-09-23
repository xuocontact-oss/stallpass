"use server"

import { z } from "zod"
import { getUser } from "@/lib/auth"
import type { ActionState } from "@/lib/form"
import { logResourceEvent } from "@/lib/partners"
import { createClient } from "@/lib/supabase/server"

async function isPartner(id: string) {
  if (!z.uuid().safeParse(id).success) return false
  const supabase = await createClient()
  const { data } = await supabase.from("resources").select("is_partner").eq("id", id).maybeSingle()
  return Boolean(data?.is_partner)
}

export async function recordCodeCopy(resourceId: string, page?: string): Promise<ActionState> {
  if (await isPartner(resourceId)) await logResourceEvent(resourceId, "code_copy", page)
  return null
}

export async function reportPartnerSignup(resourceId: string): Promise<ActionState> {
  if (!(await getUser())) return { error: "Sign in first so we can note it on your account." }
  if (!(await isPartner(resourceId))) return { error: "Not found." }
  await logResourceEvent(resourceId, "signup_reported", "button")
  return { success: "Thanks for letting us know!" }
}
