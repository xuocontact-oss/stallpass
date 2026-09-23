import Link from "next/link"
import { ActionButton } from "@/components/action-button"
import { ApplicationStatusBadge } from "@/components/application-status-badge"
import { verifyApplication } from "@/actions/admin-moderation"
import { requireAdmin } from "@/lib/auth"
import { formatDate } from "@/lib/dates"
import { throwIfError } from "@/lib/form"
import { createClient } from "@/lib/supabase/server"

export const metadata = { title: "Applications · Admin" }

type Row = {
  id: string
  status: string
  status_source: string
  verified_at: string | null
  event_dates: string[]
  delivered_via: string | null
  created_at: string
  vendors: { id: string; business_name: string; is_sample: boolean } | null
  markets: { id: string; name: string; slug: string; is_claimed: boolean } | null
}

export default async function AdminApplicationsPage() {
  await requireAdmin()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("applications")
    .select("id, status, status_source, verified_at, event_dates, delivered_via, created_at, vendors(id, business_name, is_sample), markets(id, name, slug, is_claimed)")
    .neq("status", "draft")
    .order("created_at", { ascending: false })
    .limit(200)
  throwIfError(error, "applications")
  const rows = (data ?? []) as unknown as Row[]
  const toVerify = rows.filter((r) => ["accepted", "paid"].includes(r.status) && r.status_source === "vendor" && !r.verified_at)

  const row = (r: Row, showVerify: boolean) => (
    <li key={r.id} className="flex flex-wrap items-center gap-3 p-4">
      <Link href={`/admin/applications/${r.id}`} className="min-w-0 flex-1 hover:underline">
        <p className="font-medium">
          {r.vendors?.business_name} → {r.markets?.name}
        </p>
        <p className="text-sm text-muted-foreground">
          {r.event_dates.map((d) => formatDate(d)).join(", ")} · {r.delivered_via ?? "not sent"}
          {r.status_source === "vendor" && ["accepted", "paid"].includes(r.status) && (r.verified_at ? " · verified ✓" : " · reported by vendor")}
        </p>
      </Link>
      <ApplicationStatusBadge status={r.status} />
      {showVerify ? (
        <ActionButton size="sm" action={verifyApplication.bind(null, r.id, true)}>
          Verify
        </ActionButton>
      ) : (
        r.verified_at && (
          <ActionButton size="sm" variant="ghost" action={verifyApplication.bind(null, r.id, false)}>
            Un-verify
          </ActionButton>
        )
      )}
    </li>
  )

  return (
    <main className="space-y-6">
      <h1 className="text-2xl font-bold">Applications</h1>
      <section className="space-y-2">
        <h2 className="font-semibold">Waiting for verification ({toVerify.length})</h2>
        <p className="text-sm text-muted-foreground">
          These vendors say a market (not on Stallpass) accepted them. Verify to let them review. If unsure, ask the
          vendor to forward the acceptance email.
        </p>
        {toVerify.length === 0 ? (
          <p className="rounded-xl border bg-background p-4 text-sm text-muted-foreground">Nothing to verify.</p>
        ) : (
          <ul className="divide-y rounded-xl border bg-background">{toVerify.map((r) => row(r, true))}</ul>
        )}
      </section>
      <section className="space-y-2">
        <h2 className="font-semibold">All recent applications</h2>
        <ul className="divide-y rounded-xl border bg-background">{rows.map((r) => row(r, false))}</ul>
      </section>
    </main>
  )
}
