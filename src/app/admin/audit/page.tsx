import Link from "next/link"
import { requireAdmin } from "@/lib/auth"
import { throwIfError } from "@/lib/form"
import { createClient } from "@/lib/supabase/server"

export const metadata = { title: "Audit log · Admin" }

const LABELS: Record<string, string> = {
  verify_application: "Verified an acceptance",
  unverify_application: "Removed a verification",
  hide_review: "Hid a vendor review",
  restore_review: "Restored a vendor review",
  hide_shopper_review: "Hid a shopper review",
  restore_shopper_review: "Restored a shopper review",
  approve_market: "Approved a new market",
  reject_market: "Rejected a new market",
  approve_claim: "Approved a market claim",
  reject_claim: "Rejected a market claim",
  trust_organizer: "Made an organizer trusted",
  untrust_organizer: "Removed trusted organizer",
  suspend_user: "Suspended an account",
  unsuspend_user: "Unsuspended an account",
  delete_account: "Deleted an account",
  create_market: "Created a market",
  update_market: "Edited a market",
  delete_market: "Deleted a market",
  add_market_dates: "Added market dates",
  run_reminders: "Ran expiry reminders",
  update_settings: "Changed approval settings",
  update_platform_fee: "Changed the platform fee",
  create_resource: "Added a Start hub resource",
  update_resource: "Edited a Start hub resource",
  delete_resource: "Deleted a Start hub resource",
  add_demo_content: "Added example content",
  remove_demo_content: "Removed example content",
}

function targetLink(type: string, id: string | null) {
  if (!id) return null
  if (type === "market") return `/admin/markets/${id}`
  if (type === "application") return `/admin/applications/${id}`
  if (type === "review") return `/admin/reviews#${id}`
  if (type === "shopper_review") return `/admin/reviews?type=shopper#${id}`
  if (type === "resource") return `/admin/resources/${id}`
  if (type === "market_claim") return "/admin/approvals"
  return null
}

/** Every admin action, newest first. Nobody (not even the admin) can edit this list. */
export default async function AdminAuditPage({ searchParams }: PageProps<"/admin/audit">) {
  await requireAdmin()
  const { page } = await searchParams
  const pageNum = Math.max(1, Number(page) || 1)
  const perPage = 100
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("admin_audit_log")
    .select("id, action, target_type, target_id, details, created_at, profiles(email)")
    .order("created_at", { ascending: false })
    .range((pageNum - 1) * perPage, pageNum * perPage - 1)
  throwIfError(error, "the audit log")
  const rows = (data ?? []) as unknown as {
    id: string
    action: string
    target_type: string
    target_id: string | null
    details: Record<string, unknown>
    created_at: string
    profiles: { email: string } | null
  }[]

  return (
    <main className="space-y-4">
      <h1 className="text-2xl font-bold">Audit log</h1>
      <p className="text-sm text-muted-foreground">Every admin action is recorded here automatically and can&apos;t be edited or deleted.</p>
      <ul className="divide-y rounded-xl border bg-background">
        {rows.map((r) => {
          const href = targetLink(r.target_type, r.target_id)
          const detail = Object.entries(r.details ?? {})
            .filter(([, v]) => v != null && v !== "")
            .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
            .join(" · ")
          return (
            <li key={r.id} className="p-3 text-sm">
              <div className="flex flex-wrap items-center gap-x-2">
                <span className="font-medium">{LABELS[r.action] ?? r.action}</span>
                {href && (
                  <Link href={href} className="text-primary hover:underline">
                    open
                  </Link>
                )}
                <span className="ml-auto text-xs text-muted-foreground">
                  {new Date(r.created_at).toLocaleString("en-US", { timeZone: "America/Los_Angeles", dateStyle: "medium", timeStyle: "short" })}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                by {r.profiles?.email ?? "deleted admin"}
                {detail && ` · ${detail}`}
              </p>
            </li>
          )
        })}
        {rows.length === 0 && <li className="p-4 text-sm text-muted-foreground">Nothing yet.</li>}
      </ul>
      <div className="flex gap-4 text-sm">
        {pageNum > 1 && <Link href={`/admin/audit?page=${pageNum - 1}`} className="text-primary">← Newer</Link>}
        {rows.length === perPage && <Link href={`/admin/audit?page=${pageNum + 1}`} className="text-primary">Older →</Link>}
      </div>
    </main>
  )
}
