/** Public web address of a photo in a public storage bucket. */
export function publicPhotoUrl(bucket: "vendor-photos" | "vendor-menus" | "market-photos", path: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${bucket}/${path
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`
}

/** A safe storage file name: keeps the extension, drops odd characters. */
export function storageFileName(original: string): string {
  const dot = original.lastIndexOf(".")
  const ext = dot > 0 ? original.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) : ""
  return `${crypto.randomUUID()}${ext ? `.${ext}` : ""}`
}
