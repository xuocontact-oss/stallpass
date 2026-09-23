import Link from "next/link"
import { Plus } from "lucide-react"
import { MarketApprovalBadge } from "@/components/market-approval-badge"
import { SampleBadge } from "@/components/sample-badge"
import { buttonVariants } from "@/components/ui/button"
import { requireAdmin } from "@/lib/auth"
import { throwIfError } from "@/lib/form"
import { createClient } from "@/lib/supabase/server"

export const metadata = { title: "Markets · Admin" }

export default async function AdminMarketsPage() {
  await requireAdmin()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("markets")
    .select("id, name, city, is_published, is_sample, is_claimed, approval_status, market_dates(count)")
    .order("name")
  throwIfError(error, "markets")

  return (
    <main className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Markets</h1>
        <Link href="/admin/markets/new" className={buttonVariants()}>
          <Plus /> Add a market
        </Link>
      </div>
      <ul className="divide-y rounded-xl border bg-background">
        {(data ?? []).map((m) => (
          <li key={m.id}>
            <Link href={`/admin/markets/${m.id}`} className="flex items-center gap-3 p-4 hover:bg-muted/40">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 font-medium">
                  {m.name} {m.is_sample && <SampleBadge />}
                </div>
                <div className="text-sm text-muted-foreground">
                  {m.city} · {(m.market_dates as unknown as { count: number }[])[0]?.count ?? 0} dates
                  {m.is_claimed ? " · claimed" : ""}
                </div>
              </div>
              <MarketApprovalBadge status={m.approval_status} published={m.is_published} />
            </Link>
          </li>
        ))}
        {data?.length === 0 && <li className="p-4 text-sm text-muted-foreground">No markets yet.</li>}
      </ul>
    </main>
  )
}
