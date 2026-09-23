"use server"

import { redirect } from "next/navigation"
import { getUser } from "@/lib/auth"
import { deleteAccountCompletely } from "@/lib/account-deletion"
import { formText, type ActionState } from "@/lib/form"
import { createClient } from "@/lib/supabase/server"

/** "Delete my account": the person must type DELETE to confirm. */
export async function deleteMyAccount(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getUser()
  if (!user) return { error: "Please sign in again." }
  if (formText(formData, "confirm") !== "DELETE") return { error: "Type DELETE (in capitals) to confirm." }
  try {
    await deleteAccountCompletely(user.id)
  } catch (e) {
    console.error("Account deletion failed:", e)
    return { error: "Something went wrong. Please try again, or email us and we'll delete it for you." }
  }
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect("/?deleted=1")
}
