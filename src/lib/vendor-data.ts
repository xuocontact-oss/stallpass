import "server-only"
import { createClient } from "@/lib/supabase/server"
import { throwIfError } from "@/lib/form"
import type { VendorDocument, VendorPhoto } from "@/lib/types"

export async function getMyDocuments(vendorId: string): Promise<VendorDocument[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("vendor_documents")
    .select("*")
    .eq("vendor_id", vendorId)
    .order("expiration_date", { ascending: true, nullsFirst: false })
  throwIfError(error, "your documents")
  return data ?? []
}

export async function getMyPhotos(vendorId: string): Promise<VendorPhoto[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("vendor_photos")
    .select("*")
    .eq("vendor_id", vendorId)
    .order("position")
  throwIfError(error, "your photos")
  return data ?? []
}
