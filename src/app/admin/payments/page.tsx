import Link from "next/link"
import { requireAdmin } from "@/lib/auth"
import { formatDate } from "@/lib/dates"
import { throwIfError } from "@/lib/form"
import { formatMoney } from "@/lib/markets"
import { createClient } from "@/lib/supabase/server"
import { cn } from "@/lib/utils"

export const metadata = { title: "Payments · Admin" }

const STATUS_STYLE: Record<string, string> = {
  paid: "bg-emerald-100 text-emerald-800",
  confirmed: "bg-emerald-100 text-emerald-800",
  pending: "bg-stone-100 text-stone-700",
  reported: "bg-amber-100 text-amber-900",
  failed: "bg-red-100 text-red-800",
  rejected: "bg-red-100 text-red-800",
  refunded: "bg-violet-100 text-violet-800",
}

export default async function AdminPaymentsPage() {
  await requireAdmin()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("payments")
    .select("id, application_id, method, status, amount_cents, platform_fee_cents, paid_at, created_at, vendors(id, business_name), markets(id, name)")
    .order("created_at", { ascending: false })
    .limit(300)
  throwIfError(error, "payments")
  const rows = (data ?? []) as unknown as {
    id: string
    application_id: string
    method: string
    status: string
    amount_cents: number | null
    platform_fee_cents: number
    paid_at: string | null
    created_at: string
    vendors: { id: string; business_name: string } | null
    markets: { id: string; name: string } | null
  }[]
  const card = rows.filter((r) => r.method === "stripe" && r.status === "paid")
  const volume = card.reduce((s, r) => s + (r.amount_cents ?? 0), 0)
  const earned = card.reduce((s, r) => s + r.platform_fee_cents, 0)

  return (
    <main className="space-y-4">
      <h1 className="text-2xl font-bold">Payments</h1>
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border bg-background p-4">
          <div className="text-2xl font-bold">{card.length}</div>
          <div className="text-sm text-muted-foreground">Card payments</div>
        </div>
        <div className="rounded-xl border bg-background p-4">
          <div className="text-2xl font-bold">{formatMoney(volume)}</div>
          <div className="text-sm text-muted-foreground">Booth fees paid by card</div>
        </div>
        <div className="rounded-xl border bg-background p-4">
          <div className="text-2xl font-bold">{formatMoney(earned)}</div>
          <div className="text-sm text-muted-foreground">Stallpass fees earned</div>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        Refunds happen in Stripe (the organizer&apos;s dashboard, or yours under Connect → accounts). They show up here
        automatically once the app is online.
      </p>
      <ul className="divide-y rounded-xl border bg-background">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-3 p-4 text-sm">
            <Link href={`/admin/applications/${r.application_id}`} className="min-w-0 flex-1 hover:underline">
              <p className="font-medium">
                {r.vendors?.business_name} → {r.markets?.name}
              </p>
              <p className="text-muted-foreground">
                {r.method === "stripe" ? "Card" : "Market's own link"} · {formatDate((r.paid_at ?? r.created_at).slice(0, 10))}
                {r.method === "stripe" && r.platform_fee_cents > 0 && ` · fee ${formatMoney(r.platform_fee_cents)}`}
              </p>
            </Link>
            <span className="font-semibold">{r.amount_cents != null ? formatMoney(r.amount_cents) : "—"}</span>
            <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", STATUS_STYLE[r.status])}>{r.status}</span>
          </li>
        ))}
        {rows.length === 0 && <li className="p-4 text-sm text-muted-foreground">No payments yet.</li>}
      </ul>
    </main>
  )
}
