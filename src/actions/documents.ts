"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { getMyVendor } from "@/lib/auth"
import { DOCUMENT_TYPES } from "@/lib/constants"
import { isValidISODate } from "@/lib/dates"
import { friendlyDbError, type ActionState } from "@/lib/form"
import { createClient } from "@/lib/supabase/server"

const dateField = z
  .string()
  .nullable()
  .transform((v) => (v ? v.trim() : null))
  .refine((v) => v === null || isValidISODate(v), "Please enter a valid date.")

const documentSchema = z
  .object({
    id: z.uuid().optional(),
    doc_type: z.enum(DOCUMENT_TYPES.map((d) => d.key), { error: "Choose a document type." }),
    title: z
      .string()
      .max(100, "Keep the name under 100 characters.")
      .nullable()
      .transform((v) => v?.trim() || null),
    issue_date: dateField,
    expiration_date: dateField,
    notes: z
      .string()
      .max(500, "Keep notes under 500 characters.")
      .nullable()
      .transform((v) => v?.trim() || null),
    file: z
      .object({ path: z.string().max(300), name: z.string().min(1).max(200) })
      .nullable(),
  })
  .refine((d) => d.doc_type !== "other" || d.title, {
    message: "Give this document a name (for example, “Fire inspection”).",
  })
  .refine((d) => !d.issue_date || !d.expiration_date || d.expiration_date >= d.issue_date, {
    message: "The expiration date can't be before the issue date.",
  })

export type DocumentInput = z.input<typeof documentSchema>

/**
 * Adds or updates a document. The browser uploads the file to private storage
 * first, then calls this with its path.
 */
export async function saveDocument(input: DocumentInput): Promise<ActionState & { id?: string }> {
  const vendor = await getMyVendor()
  if (!vendor) return { error: "Set up your business first." }

  const parsed = documentSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const { id, file, ...fields } = parsed.data

  if (file && !file.path.startsWith(`${vendor.id}/`)) {
    return { error: "That upload didn't work. Please try again." }
  }

  const supabase = await createClient()

  if (!id) {
    if (!file) return { error: "Choose a file to upload." }
    const { data, error } = await supabase
      .from("vendor_documents")
      .insert({ ...fields, vendor_id: vendor.id, file_path: file.path, file_name: file.name })
      .select("id")
      .single()
    if (error) {
      await supabase.storage.from("vendor-documents").remove([file.path])
      return { error: friendlyDbError(error) }
    }
    revalidatePath("/documents")
    revalidatePath("/dashboard")
    return { success: "Document added.", id: data.id }
  }

  const { data: existing } = await supabase
    .from("vendor_documents")
    .select("file_path")
    .eq("id", id)
    .maybeSingle()
  if (!existing) return { error: "Document not found." }

  const { error } = await supabase
    .from("vendor_documents")
    .update({ ...fields, ...(file ? { file_path: file.path, file_name: file.name } : {}) })
    .eq("id", id)
  if (error) {
    if (file) await supabase.storage.from("vendor-documents").remove([file.path])
    return { error: friendlyDbError(error) }
  }
  // The old file is replaced, so remove it.
  if (file && existing.file_path !== file.path) {
    await supabase.storage.from("vendor-documents").remove([existing.file_path])
  }

  revalidatePath("/documents")
  revalidatePath(`/documents/${id}`)
  revalidatePath("/dashboard")
  return { success: "Document saved.", id }
}

export async function deleteDocument(id: string): Promise<ActionState> {
  if (!z.uuid().safeParse(id).success) return { error: "Document not found." }
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("vendor_documents")
    .delete()
    .eq("id", id)
    .select("file_path")
    .maybeSingle()
  if (error) return { error: friendlyDbError(error) }
  if (!data) return { error: "Document not found." }
  await supabase.storage.from("vendor-documents").remove([data.file_path])
  revalidatePath("/documents")
  revalidatePath("/dashboard")
  return { success: "Document deleted." }
}
