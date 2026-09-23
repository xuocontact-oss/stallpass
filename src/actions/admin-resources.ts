"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"
import { logAdminAction } from "@/lib/audit"
import { isAdmin } from "@/lib/auth"
import { isValidISODate } from "@/lib/dates"
import { formText, friendlyDbError, type ActionState } from "@/lib/form"
import { RESOURCE_CATEGORY_LABELS } from "@/lib/start-guide"
import { createClient } from "@/lib/supabase/server"

const schema = z.object({
  category: z.enum(Object.keys(RESOURCE_CATEGORY_LABELS) as [string, ...string[]]),
  name: z.string({ error: "Give it a name." }).min(1, "Give it a name.").max(120),
  description: z.string().max(1000).nullable(),
  url: z
    .string()
    .max(500)
    .regex(/^https?:\/\/\S+$/i, "The link must start with https://")
    .nullable(),
  area: z.string().max(80).nullable(),
  price_note: z.string().max(120).nullable(),
  is_official: z.boolean(),
  is_featured: z.boolean(),
  is_published: z.boolean(),
  position: z.coerce.number().int().min(0).max(999),
  last_checked: z.string().nullable().refine((v) => v === null || isValidISODate(v), "Pick a valid date."),
  is_partner: z.boolean(),
  promo_code: z.string().max(40, "Keep the code under 40 characters.").nullable(),
  promo_text: z.string().max(200, "Keep the offer under 200 characters.").nullable(),
})

const partnerSchema = z.object({
  referral_url: z.string().max(1000).regex(/^https?:\/\/\S+$/i, "The tracking link must start with https://").nullable(),
  commission_terms: z.string().max(500).nullable(),
  contact_name: z.string().max(120).nullable(),
  contact_email: z.email("The partner contact email doesn't look right.").max(200).nullable(),
  notes: z.string().max(1000).nullable(),
})

export async function saveResource(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await isAdmin())) return { error: "Only the admin can do that." }
  const id = formText(formData, "id")
  if (id && !z.uuid().safeParse(id).success) return { error: "Resource not found." }
  const parsed = schema.safeParse({
    category: formText(formData, "category"),
    name: formText(formData, "name"),
    description: formText(formData, "description"),
    url: formText(formData, "url"),
    area: formText(formData, "area"),
    price_note: formText(formData, "price_note"),
    is_official: formData.get("is_official") === "on",
    is_featured: formData.get("is_featured") === "on",
    is_published: formData.get("is_published") === "on",
    position: formText(formData, "position") ?? 0,
    last_checked: formText(formData, "last_checked"),
    is_partner: formData.get("is_partner") === "on",
    promo_code: formText(formData, "promo_code"),
    promo_text: formText(formData, "promo_text"),
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const partner = partnerSchema.safeParse({
    referral_url: formText(formData, "referral_url"),
    commission_terms: formText(formData, "commission_terms"),
    contact_name: formText(formData, "contact_name"),
    contact_email: formText(formData, "contact_email"),
    notes: formText(formData, "partner_notes"),
  })
  if (!partner.success) return { error: partner.error.issues[0].message }

  const supabase = await createClient()
  const query = id
    ? supabase.from("resources").update(parsed.data).eq("id", id).select("id").single()
    : supabase.from("resources").insert(parsed.data).select("id").single()
  const { data, error } = await query
  if (error) return { error: friendlyDbError(error) }
  const { error: pError } = await supabase
    .from("resource_partner_details")
    .upsert({ resource_id: data.id, ...partner.data, updated_at: new Date().toISOString() })
  if (pError) return { error: friendlyDbError(pError) }
  await logAdminAction(id ? "update_resource" : "create_resource", "resource", data.id, { name: parsed.data.name })
  revalidatePath("/start")
  revalidatePath("/admin/resources")
  if (!id) redirect("/admin/resources")
  return { success: "Saved." }
}

export async function deleteResource(id: string): Promise<ActionState> {
  if (!(await isAdmin())) return { error: "Only the admin can do that." }
  if (!z.uuid().safeParse(id).success) return { error: "Resource not found." }
  const supabase = await createClient()
  const { error } = await supabase.from("resources").delete().eq("id", id)
  if (error) return { error: friendlyDbError(error) }
  await logAdminAction("delete_resource", "resource", id)
  revalidatePath("/start")
  revalidatePath("/admin/resources")
  return { success: "Deleted." }
}
