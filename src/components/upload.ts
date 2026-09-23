"use client"

import { createClient } from "@/lib/supabase/client"
import { storageFileName } from "@/lib/storage"

/**
 * Uploads a file from the browser straight to Supabase storage, into
 * `<folder>/<random name>`. The storage security rules decide whether this
 * person may write to that folder. Returns the stored path.
 */
export async function uploadFile(
  bucket: "vendor-documents" | "vendor-photos" | "vendor-menus" | "market-photos",
  folder: string,
  file: File,
  maxBytes: number
): Promise<{ path: string } | { error: string }> {
  if (file.size > maxBytes) {
    return { error: `That file is too big. The limit is ${Math.round(maxBytes / 1024 / 1024)} MB.` }
  }
  const path = `${folder}/${storageFileName(file.name)}`
  const supabase = createClient()
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    contentType: file.type || undefined,
    upsert: false,
  })
  if (error) {
    console.error("Upload failed:", error)
    if (/mime|type/i.test(error.message)) {
      return { error: "That kind of file isn't allowed. Use a PDF or a photo (JPG, PNG)." }
    }
    return { error: "The upload didn't work. Check your connection and try again." }
  }
  return { path }
}
