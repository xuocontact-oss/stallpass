import { Trash2 } from "lucide-react"
import { MarketForm } from "@/components/admin/market-form"
import { ConfirmButton } from "@/components/confirm-button"
import { PaymentSettingsForm } from "@/components/payment-settings-form"
import { MarketDatesEditor, MarketPhotosEditor } from "@/components/market-content-editor"
import { deleteOrganizerMarket, updateOrganizerMarket } from "@/actions/organizer"
import { requireOrganizedMarket } from "@/lib/auth"
import { todayISO } from "@/lib/dates"
import { createClient } from "@/lib/supabase/server"
import type { MarketDate, MarketPhoto } from "@/lib/types"

export default async function OrganizerEditMarketPage({ params, searchParams }: PageProps<"/organizer/markets/[id]/edit">) {
  const { id } = await params
  const { created } = await searchParams
  const market = await requireOrganizedMarket(id)
  const today = todayISO()
  const supabase = await createClient()
  const [{ data: dates }, { data: photos }, { data: acct }] = await Promise.all([
    supabase.from("market_dates").select("*").eq("market_id", id).gte("event_date", today).order("event_date"),
    supabase.from("market_photos").select("*").eq("market_id", id).order("position"),
    supabase.from("payout_accounts").select("charges_enabled").eq("user_id", market.organizer_id!).maybeSingle(),
  ])

  return (
    <main className="space-y-5">
      {created === "approved" && (
        <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">Your market is live! Add dates and photos below.</p>
      )}
      {created === "pending" && (
        <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">
          Saved! We&apos;ll check it and email you when it&apos;s live. Meanwhile, add dates and photos below.
        </p>
      )}
      <MarketDatesEditor marketId={market.id} dates={(dates ?? []) as MarketDate[]} today={today} />
      <MarketPhotosEditor marketId={market.id} photos={(photos ?? []) as MarketPhoto[]} />
      <PaymentSettingsForm market={market} stripeReady={Boolean(acct?.charges_enabled)} showStripe={Boolean(process.env.STRIPE_SECRET_KEY)} />
      <MarketForm market={market} action={updateOrganizerMarket} mode="organizer" />
      {market.approval_status !== "approved" && (
        <ConfirmButton
          variant="destructive"
          className="w-full"
          action={deleteOrganizerMarket.bind(null, market.id)}
          confirmText={`Delete ${market.name}? This can't be undone.`}
          redirectTo="/organizer"
        >
          <Trash2 /> Delete this listing
        </ConfirmButton>
      )}
    </main>
  )
}
