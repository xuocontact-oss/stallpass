import Link from "next/link"
import { notFound } from "next/navigation"
import { ApplyForm } from "@/components/apply-form"
import { getProfile, requireVendor } from "@/lib/auth"
import { VerifyEmailBox } from "@/components/verify-email-box"
import { getT } from "@/lib/i18n/server"
import { todayISO } from "@/lib/dates"
import { getMarketBySlug } from "@/lib/market-data"
import { getPartnerOffers } from "@/lib/partners"
import { createClient } from "@/lib/supabase/server"
import { getMyDocuments } from "@/lib/vendor-data"

export const metadata = { title: "Quick apply" }

export default async function ApplyPage({ params }: PageProps<"/markets/[slug]/apply">) {
  const { user, vendor } = await requireVendor()
  const profile = await getProfile()
  const { slug } = await params
  const today = todayISO()
  const data = await getMarketBySlug(slug, today)
  if (!data || (data.market.is_sample && !vendor.is_sample)) notFound()
  const { market, dates } = data

  const supabase = await createClient()
  const [docs, { data: existing }, offers] = await Promise.all([
    getMyDocuments(vendor.id),
    supabase
      .from("applications")
      .select("event_dates")
      .eq("vendor_id", vendor.id)
      .eq("market_id", market.id)
      .in("status", ["submitted", "accepted", "waitlisted", "paid"]),
    getPartnerOffers(),
  ])
  const takenDates = (existing ?? []).flatMap((a) => a.event_dates as string[])
  const t = await getT()

  return (
    <main className="mx-auto w-full max-w-2xl space-y-5 px-4 py-6">
      <Link href={`/markets/${market.slug}`} className="text-sm text-muted-foreground">
        ← {market.name}
      </Link>
      <div>
        <h1 className="text-2xl font-bold">{t("Apply to {market}", { market: market.name })}</h1>
        <p className="text-sm text-muted-foreground">{t("As {name}", { name: vendor.business_name })}</p>
      </div>
      {!profile?.email_verified_at && (
        <VerifyEmailBox email={user.email ?? ""} reason="Verify your email before you apply, so the market can reply to you. You can still fill this in and save it as a draft." />
      )}
      {dates.length === 0 ? (
        <p className="rounded-xl border bg-background p-4 text-sm">{t("This market has no upcoming dates to apply for.")}</p>
      ) : (
        <ApplyForm market={market} dates={dates} docs={docs} takenDates={takenDates} today={today} offers={offers} />
      )}
    </main>
  )
}
