import "server-only"
import { createClient } from "@/lib/supabase/server"

/**
 * Records an admin action in the audit log. The database only accepts
 * entries from the admin, written under their own id.
 */
export async function logAdminAction(
  action: string,
  targetType: string,
  targetId: string | null,
  details: Record<string, unknown> = {}
) {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const { error } = await supabase.from("admin_audit_log").insert({
    admin_id: data?.claims?.sub,
    action,
    target_type: targetType,
    target_id: targetId,
    details,
  })
  if (error) console.error("Audit log failed:", error)
}
