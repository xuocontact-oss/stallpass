import "server-only"
import { createAdminClient } from "@/lib/supabase/server"

async function listAll(bucket: string, folder: string): Promise<string[]> {
  const db = createAdminClient()
  const { data } = await db.storage.from(bucket).list(folder, { limit: 1000 })
  const out: string[] = []
  for (const f of data ?? []) {
    const path = `${folder}/${f.name}`
    if (f.id) out.push(path)
    else out.push(...(await listAll(bucket, path)))
  }
  return out
}

/**
 * Permanently deletes an account: their files first (documents, photos,
 * menus), then the login, which removes their business, documents,
 * applications and reviews with it. Markets they ran stay listed, without an
 * organizer. Call only after checking permission.
 */
export async function deleteAccountCompletely(userId: string) {
  const db = createAdminClient()
  const { data: vendor } = await db.from("vendors").select("id").eq("owner_id", userId).maybeSingle()
  if (vendor) {
    for (const bucket of ["vendor-documents", "vendor-photos", "vendor-menus"]) {
      const files = await listAll(bucket, vendor.id)
      for (let i = 0; i < files.length; i += 100) await db.storage.from(bucket).remove(files.slice(i, i + 100))
    }
  }
  const { error } = await db.auth.admin.deleteUser(userId)
  if (error) throw new Error(error.message)
}
