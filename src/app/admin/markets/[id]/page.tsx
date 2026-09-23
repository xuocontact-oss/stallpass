import Link from "next/link"
import { notFound } from "next/navigation"
import { ExternalLink, Trash2 } from "lucide-react"
import { MarketForm } from "@/components/admin/market-form"
import { ActionButton } from "@/components/action-button"
import { ConfirmButton } from "@/components/confirm-button"
import { PaymentSettingsForm } from "@/components/payment-settings-form"
import { SalesSettingsForm } from "@/components/sales-settings-form"
import { PromptButton } from "@/components/prompt-button"
import { reviewMarket } from "@/actions/admin-moderation"
import { MarketDatesEditor, MarketPhotosEditor } from "@/components/market-content-editor"
import { SampleBadge } from "@/components/sample-badge"
import { buttonVariants } from "@/components/ui/button"
import { deleteMarket } from "@/actions/admin-markets"
import { requireAdmin } from "@/lib/auth"
import { todayISO } from "@/lib/dates"
import { createClient } from "@/lib/supabase/server"
import type { Market, MarketDate, MarketPhoto } from "@/lib/types"

export const metadata = { title: "Edit market · Admin" }

export default async function EditMarketPage({ params, searchParams }: PageProps<"/admin/markets/[id]">) {
  await requireAdmin()
  const { id } = await params
  const { created } = await searchParams
  const supabase = await createClient()
  const { data: market } = await supabase.from("markets").select("*").eq("id", id).maybeSingle()
  if (!market) notFound()
  const today = todayISO()

  const [{ data: contact }, { data: dates }, { data: photos }] = await Promise.all([
    supabase.from("market_contacts").select("*").eq("market_id", id).maybeSingle(),
    supabase.from("market_dates").select("*").eq("market_id", id).gte("event_date", today).order("event_date"),
    supabase.from("market_photos").select("*").eq("market_id", id).order("position"),
  ])
  const m = market as Market

  return (
    <main className="space-y-5">
      <Link href="/admin/markets" className="text-sm text-muted-foreground">← Markets</Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          {m.name} {m.is_sample && <SampleBadge />}
        </h1>
        <Link href={`/markets/${m.slug}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
          <ExternalLink /> View public page
        </Link>
      </div>
      {m.approval_status !== "approved" && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          <span>
            {m.approval_status === "pending" ? "Waiting for your approval." : `Rejected: ${m.rejection_reason ?? "no reason given"}`}
          </span>
          <span className="flex gap-2">
            <ActionButton size="sm" action={reviewMarket.bind(null, m.id, true, undefined)}>Approve</ActionButton>
            {m.approval_status === "pending" && (
              <PromptButton size="sm" variant="outline" action={reviewMarket.bind(null, m.id, false)} question="Reason (the organizer will see this):">
                Reject
              </PromptButton>
            )}
          </span>
        </div>
      )}
      {created && (
        <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">
          Market created. Now add its dates and photos below.
        </p>
      )}

      <MarketDatesEditor marketId={m.id} dates={(dates as MarketDate[] | null) ?? []} today={today} />
      <MarketPhotosEditor marketId={m.id} photos={(photos as MarketPhoto[] | null) ?? []} />

      <PaymentSettingsForm market={m} stripeReady={false} showStripe={false} />
      <SalesSettingsForm market={m} />
      <MarketForm market={m} contact={contact} />

      <ConfirmButton
        variant="destructive"
        className="w-full"
        action={deleteMarket.bind(null, m.id)}
        confirmText={`Delete ${m.name}, all its dates and photos? This can't be undone.`}
        redirectTo="/admin/markets"
      >
        <Trash2 /> Delete market
      </ConfirmButton>
    </main>
  )
}
