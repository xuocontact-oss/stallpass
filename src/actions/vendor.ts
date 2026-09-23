"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"
import { getMyVendor, getUser } from "@/lib/auth"
import { FOOD_CATEGORIES, MAX_VENDOR_PHOTOS, SETUP_TYPES } from "@/lib/constants"
import { formText, friendlyDbError, type ActionState } from "@/lib/form"
import { createClient } from "@/lib/supabase/server"

const optional = (max: number) => z.string().max(max, `Keep this under ${max} characters.`).nullable()

const vendorSchema = z.object({
  business_name: z
    .string({ error: "Enter your business name." })
    .min(1, "Enter your business name.")
    .max(100, "Keep the business name under 100 characters."),
  category: z.enum(FOOD_CATEGORIES.map((c) => c.key), { error: "Choose a food category." }),
  setup_type: z.enum(SETUP_TYPES.map((s) => s.key), { error: "Choose your setup." }),
  needs_power: z.boolean(),
  needs_water: z.boolean(),
  description: optional(2000),
  menu: optional(4000),
  setup_notes: optional(500),
  phone: optional(30),
  instagram: optional(200),
  facebook: optional(200),
  tiktok: optional(200),
  website: optional(200),
  service_area: optional(200),
})

function readVendorForm(formData: FormData) {
  return vendorSchema.safeParse({
    business_name: formText(formData, "business_name"),
    category: formText(formData, "category"),
    setup_type: formText(formData, "setup_type") ?? "tent",
    needs_power: formData.get("needs_power") === "on",
    needs_water: formData.get("needs_water") === "on",
    description: formText(formData, "description"),
    menu: formText(formData, "menu"),
    setup_notes: formText(formData, "setup_notes"),
    phone: formText(formData, "phone"),
    instagram: formText(formData, "instagram"),
    facebook: formText(formData, "facebook"),
    tiktok: formText(formData, "tiktok"),
    website: formText(formData, "website"),
    service_area: formText(formData, "service_area"),
  })
}

export async function updateVendor(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const vendor = await getMyVendor()
  if (!vendor) return { error: "Set up your business first." }

  const parsed = readVendorForm(formData)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const supabase = await createClient()
  const { error } = await supabase.from("vendors").update(parsed.data).eq("id", vendor.id)
  if (error) return { error: friendlyDbError(error) }

  revalidatePath("/profile")
  revalidatePath("/dashboard")
  return { success: "Profile saved." }
}

/** Records a photo the browser already uploaded to storage. */
export async function addVendorPhoto(path: string): Promise<ActionState> {
  const vendor = await getMyVendor()
  if (!vendor) return { error: "Set up your business first." }
  if (typeof path !== "string" || !path.startsWith(`${vendor.id}/`) || path.length > 300) {
    return { error: "That upload didn't work. Please try again." }
  }

  const supabase = await createClient()
  const { count } = await supabase
    .from("vendor_photos")
    .select("id", { count: "exact", head: true })
    .eq("vendor_id", vendor.id)
  if ((count ?? 0) >= MAX_VENDOR_PHOTOS) {
    await supabase.storage.from("vendor-photos").remove([path])
    return { error: `You can have up to ${MAX_VENDOR_PHOTOS} photos. Remove one first.` }
  }

  const { error } = await supabase
    .from("vendor_photos")
    .insert({ vendor_id: vendor.id, path, position: count ?? 0 })
  if (error) {
    await supabase.storage.from("vendor-photos").remove([path])
    return { error: friendlyDbError(error) }
  }
  revalidatePath("/profile")
  return { success: "Photo added." }
}

export async function removeVendorPhoto(photoId: string): Promise<ActionState> {
  if (!z.uuid().safeParse(photoId).success) return { error: "Photo not found." }
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("vendor_photos")
    .delete()
    .eq("id", photoId)
    .select("path")
    .maybeSingle()
  if (error) return { error: friendlyDbError(error) }
  if (!data) return { error: "Photo not found." }
  await supabase.storage.from("vendor-photos").remove([data.path])
  revalidatePath("/profile")
  return { success: "Photo removed." }
}

/** Attaches a menu photo/PDF the browser already uploaded (replacing any old one). */
export async function setMenuFile(path: string, fileName: string): Promise<ActionState> {
  const vendor = await getMyVendor()
  if (!vendor) return { error: "Set up your business first." }
  if (typeof path !== "string" || !path.startsWith(`${vendor.id}/`) || path.length > 300) {
    return { error: "That upload didn't work. Please try again." }
  }
  const name = String(fileName ?? "menu").slice(0, 200)

  const supabase = await createClient()
  const { error } = await supabase
    .from("vendors")
    .update({ menu_file_path: path, menu_file_name: name })
    .eq("id", vendor.id)
  if (error) {
    await supabase.storage.from("vendor-menus").remove([path])
    return { error: friendlyDbError(error) }
  }
  if (vendor.menu_file_path && vendor.menu_file_path !== path) {
    await supabase.storage.from("vendor-menus").remove([vendor.menu_file_path])
  }
  revalidatePath("/profile")
  return { success: "Menu file uploaded." }
}

export async function removeMenuFile(): Promise<ActionState> {
  const vendor = await getMyVendor()
  if (!vendor) return { error: "Set up your business first." }
  if (!vendor.menu_file_path) return { success: "Menu file removed." }

  const supabase = await createClient()
  const { error } = await supabase
    .from("vendors")
    .update({ menu_file_path: null, menu_file_name: null })
    .eq("id", vendor.id)
  if (error) return { error: friendlyDbError(error) }
  await supabase.storage.from("vendor-menus").remove([vendor.menu_file_path])
  revalidatePath("/profile")
  return { success: "Menu file removed." }
}

// ---------------------------------------------------------------------------
// Step-by-step setup (onboarding)
// ---------------------------------------------------------------------------

const basicsSchema = z.object({
  full_name: z.string({ error: "Enter your name." }).min(1, "Enter your name.").max(100),
  phone: z
    .string({ error: "Enter a phone number." })
    .max(30)
    .regex(/^[0-9+().\-\s]{7,30}$/, "Enter a phone number, like (213) 555-0123."),
  business_name: vendorSchema.shape.business_name,
  category: vendorSchema.shape.category,
  setup_type: vendorSchema.shape.setup_type,
  needs_power: z.boolean(),
  needs_water: z.boolean(),
})

/** Setup step 1: owner + business basics. Creates the business the first time. */
export async function saveVendorBasics(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getUser()
  if (!user) return { error: "Please sign in again." }
  const parsed = basicsSchema.safeParse({
    full_name: formText(formData, "full_name"),
    phone: formText(formData, "phone"),
    business_name: formText(formData, "business_name"),
    category: formText(formData, "category"),
    setup_type: formText(formData, "setup_type") ?? "tent",
    needs_power: formData.get("needs_power") === "on",
    needs_water: formData.get("needs_water") === "on",
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const { full_name, ...business } = parsed.data

  const supabase = await createClient()
  const { error: pError } = await supabase.from("profiles").update({ full_name }).eq("id", user.id)
  if (pError) return { error: friendlyDbError(pError) }

  const existing = await getMyVendor()
  const { error } = existing
    ? await supabase.from("vendors").update(business).eq("id", existing.id)
    : await supabase.from("vendors").insert({ ...business, owner_id: user.id })
  if (error) return { error: friendlyDbError(error) }

  revalidatePath("/", "layout")
  redirect("/onboarding?step=2")
}

const detailsSchema = z.object({
  description: z.string().max(2000, "Keep the description under 2,000 characters.").nullable(),
  menu: z.string().max(4000, "Keep the menu under 4,000 characters.").nullable(),
  setup_notes: z.string().max(500).nullable(),
  instagram: z.string().max(200).nullable(),
  tiktok: z.string().max(200).nullable(),
  facebook: z.string().max(200).nullable(),
  website: z.string().max(200).nullable(),
  service_area: z.string().max(200).nullable(),
})

/** Setup step 2: description, menu, links. */
export async function saveVendorDetails(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const vendor = await getMyVendor()
  if (!vendor) redirect("/onboarding")
  const parsed = detailsSchema.safeParse({
    description: formText(formData, "description"),
    menu: formText(formData, "menu"),
    setup_notes: formText(formData, "setup_notes"),
    instagram: formText(formData, "instagram"),
    tiktok: formText(formData, "tiktok"),
    facebook: formText(formData, "facebook"),
    website: formText(formData, "website"),
    service_area: formText(formData, "service_area"),
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const supabase = await createClient()
  const { error } = await supabase.from("vendors").update(parsed.data).eq("id", vendor.id)
  if (error) return { error: friendlyDbError(error) }
  revalidatePath("/", "layout")
  redirect("/onboarding?step=3")
}
