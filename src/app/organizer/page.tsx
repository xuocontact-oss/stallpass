import Link from "next/link"
import { ChevronRight, Plus, Search } from "lucide-react"
import { ConfirmButton } from "@/components/confirm-button"
import { MarketApprovalBadge } from "@/components/market-approval-badge"
import { withdrawClaim } from "@/actions/organizer"
import { requireOrganizer } from "@/lib/auth"
import { formatDate } from "@/lib/dates"
import { createClient } from "@/lib/supabase/server"
import type { Market, MarketClaim } from "@/lib/types"

export const metadata = { title: "Organizer" }

export default async function OrganizerHomePage({ searchParams }: PageProps<"/organizer">) {
  const { user } = await requireOrganizer()
  const { claimed } = await searchParams
  const supabase = await createClient()
  const [{ data: markets }, { data: claims }, { data: newApps }] = await Promise.all([
    supabase.from("markets").select("*").eq("organizer_id", user.id).order("name"),
    supabase
      .from("market_claims")
      .select("*, markets(name, slug)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase.from("applications").select("market_id, markets!inner(organizer_id)").eq("status", "submitted").eq("markets.organizer_id", user.id),
  ])
  const newCount = new Map<string, number>()
  for (const a of newApps ?? []) newCount.set(a.market_id, (newCount.get(a.market_id) ?? 0) + 1)
  const myMarkets = (markets ?? []) as Market[]
  const myClaims = (claims ?? []) as (MarketClaim & { markets: { name: string; slug: string } | null })[]

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6">
      <h1 className="text-2xl font-bold">Your markets</h1>
      {claimed && (
        <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">
          Thanks! We&apos;ll check your claim and email you when it&apos;s approved, usually within a day.
        </p>
      )}

      {myMarkets.length > 0 ? (
        <ul className="divide-y rounded-xl border bg-background">
          {myMarkets.map((m) => {
            const n = newCount.get(m.id) ?? 0
            return (
              <li key={m.id}>
                <Link href={`/organizer/markets/${m.id}`} className="flex items-center gap-3 p-4 hover:bg-muted/40">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{m.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {m.city}
                      {n > 0 && <span className="font-medium text-primary"> · {n} new application{n > 1 ? "s" : ""}</span>}
                    </p>
                  </div>
                  <MarketApprovalBadge status={m.approval_status} published={m.is_published} />
                  <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed bg-background p-5 text-sm text-muted-foreground">
          No markets yet. Claim your market if it&apos;s already listed on Stallpass, or add it.
        </p>
      )}

      <Link href="/organizer/payments" className="flex items-center justify-between rounded-xl border bg-background p-4 text-sm hover:border-primary/50">
        <span>
          <span className="block font-medium">Card payments</span>
          <span className="text-muted-foreground">Connect Stripe to take booth fees in the app</span>
        </span>
        <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
      </Link>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link href="/markets" className="rounded-xl border bg-background p-4 hover:border-primary/50">
          <Search className="size-5 text-primary" aria-hidden />
          <p className="mt-2 font-medium">Claim a listed market</p>
          <p className="text-sm text-muted-foreground">Find your market and tap &ldquo;Claim this market&rdquo;. We verify it&apos;s yours.</p>
        </Link>
        <Link href="/organizer/markets/new" className="rounded-xl border bg-background p-4 hover:border-primary/50">
          <Plus className="size-5 text-primary" aria-hidden />
          <p className="mt-2 font-medium">Add a new market</p>
          <p className="text-sm text-muted-foreground">Not listed yet? Add it. New listings are checked before they go live.</p>
        </Link>
      </div>

      {myClaims.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-semibold">Your claims</h2>
          <ul className="divide-y rounded-xl border bg-background">
            {myClaims.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-3 p-4 text-sm">
                <div className="min-w-0 flex-1">
                  <Link href={`/markets/${c.markets?.slug}`} className="font-medium hover:underline">{c.markets?.name}</Link>
                  <p className="text-muted-foreground">
                    Asked {formatDate(c.created_at.slice(0, 10))}
                    {c.status === "rejected" && c.rejection_reason && ` · ${c.rejection_reason}`}
                  </p>
                </div>
                <span
                  className={
                    c.status === "approved"
                      ? "rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs text-emerald-800"
                      : c.status === "rejected"
                        ? "rounded-full bg-red-100 px-2.5 py-0.5 text-xs text-red-800"
                        : "rounded-full bg-amber-100 px-2.5 py-0.5 text-xs text-amber-900"
                  }
                >
                  {c.status === "pending" ? "Being checked" : c.status === "approved" ? "Approved" : "Not approved"}
                </span>
                {c.status === "pending" && (
                  <ConfirmButton size="sm" variant="ghost" action={withdrawClaim.bind(null, c.id)} confirmText="Withdraw this claim?">
                    Withdraw
                  </ConfirmButton>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-sm text-muted-foreground">
        Want to sell food too? <Link href="/onboarding" className="font-medium text-primary">Set up a vendor profile</Link>
      </p>
    </main>
  )
}
