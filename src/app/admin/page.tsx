import Link from "next/link"
import { ActionForm, SubmitButton } from "@/components/action-form"
import { buttonVariants } from "@/components/ui/button"
import { runRemindersNow } from "@/actions/admin-markets"
import { requireAdmin } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/server"

export const metadata = { title: "Admin" }

export default async function AdminPage() {
  await requireAdmin()
  // Counts across everyone, so this uses full access (after the admin check above).
  const db = createAdminClient()
  const count = async (table: string) =>
    (await db.from(table).select("*", { count: "exact", head: true })).count ?? 0
  const [pendingMarkets, pendingClaims] = await Promise.all([
    db.from("markets").select("*", { count: "exact", head: true }).eq("approval_status", "pending"),
    db.from("market_claims").select("*", { count: "exact", head: true }).eq("status", "pending"),
  ])
  const waiting = (pendingMarkets.count ?? 0) + (pendingClaims.count ?? 0)
  const [vendors, documents, markets, users, applications, reviews] = await Promise.all([
    count("vendors"),
    count("vendor_documents"),
    count("markets"),
    count("profiles"),
    count("applications"),
    count("reviews"),
  ])

  const tiles = [
    { label: "Accounts", value: users, href: "/admin/accounts" },
    { label: "Vendors", value: vendors, href: "/admin/vendors" },
    { label: "Documents", value: documents, href: "/admin/documents" },
    { label: "Markets", value: markets, href: "/admin/markets" },
    { label: "Applications", value: applications, href: "/admin/applications" },
    { label: "Reviews", value: reviews, href: "/admin/reviews" },
  ]

  return (
    <main className="space-y-6">
      <h1 className="text-2xl font-bold">Admin</h1>
      {waiting > 0 && (
        <Link href="/admin/approvals" className="block rounded-xl border-2 border-amber-300 bg-amber-50 p-4 text-amber-950">
          <span className="font-semibold">{waiting} waiting for your approval</span>
          <span className="block text-sm">
            {pendingClaims.count ?? 0} market claim(s) · {pendingMarkets.count ?? 0} new market(s) →
          </span>
        </Link>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {tiles.map((t) => (
          <Link key={t.label} href={t.href} className="rounded-xl border bg-background p-4 transition-colors hover:border-primary/50">
            <div className="text-2xl font-bold">{t.value}</div>
            <div className="text-sm text-muted-foreground">{t.label} →</div>
          </Link>
        ))}
      </div>

      <section className="rounded-xl border bg-background p-4">
        <h2 className="font-semibold">Markets</h2>
        <p className="text-sm text-muted-foreground">Add and edit the markets vendors can browse.</p>
        <div className="mt-3 flex gap-2">
          <Link href="/admin/markets/new" className={buttonVariants()}>Add a market</Link>
          <Link href="/admin/markets" className={buttonVariants({ variant: "outline" })}>All markets</Link>
        </div>
      </section>

      <section className="rounded-xl border bg-background p-4">
        <h2 className="font-semibold">Applications & reviews</h2>
        <p className="text-sm text-muted-foreground">Verify vendor-reported acceptances and hide abusive reviews.</p>
        <div className="mt-3 flex gap-2">
          <Link href="/admin/applications" className={buttonVariants({ variant: "outline" })}>Applications</Link>
          <Link href="/admin/reviews" className={buttonVariants({ variant: "outline" })}>Reviews</Link>
        </div>
      </section>

      <section className="rounded-xl border bg-background p-4">
        <h2 className="font-semibold">Expiry reminder emails</h2>
        <p className="text-sm text-muted-foreground">
          These go out automatically once a day after the app is live. Use this button to run the check
          now while testing. Nobody gets the same reminder twice.
        </p>
        <ActionForm action={runRemindersNow} className="mt-3">
          <SubmitButton variant="outline" pendingText="Checking…">
            Run reminders now
          </SubmitButton>
        </ActionForm>
      </section>
    </main>
  )
}
