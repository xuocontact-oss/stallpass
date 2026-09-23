import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ActionForm, SubmitButton } from "@/components/action-form"
import { ConfirmButton } from "@/components/confirm-button"
import { StarInput } from "@/components/star-input"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { deleteShopperReview, saveShopperReview } from "@/actions/shopper"
import { getUser } from "@/lib/auth"
import { addDays, todayISO } from "@/lib/dates"
import { getMarketBySlug } from "@/lib/market-data"
import { createClient } from "@/lib/supabase/server"
import { getT } from "@/lib/i18n/server"

export const metadata = { title: "Review a market" }

/** A shopper's review of a market (anyone signed in). */
export default async function ShopperReviewPage({ params }: PageProps<"/markets/[slug]/review">) {
  const { slug } = await params
  const user = await getUser()
  if (!user) redirect(`/login?next=${encodeURIComponent(`/markets/${slug}/review`)}`)
  const today = todayISO()
  const data = await getMarketBySlug(slug, today)
  if (!data || data.market.is_sample) notFound()
  const { market } = data
  const supabase = await createClient()
  const { data: existing } = await supabase
    .from("shopper_reviews")
    .select("*")
    .eq("market_id", market.id)
    .eq("user_id", user.id)
    .maybeSingle()
  const t = await getT()

  return (
    <main className="mx-auto w-full max-w-lg space-y-5 px-4 py-6">
      <Link href={`/markets/${market.slug}`} className="text-sm text-muted-foreground">← {market.name}</Link>
      <div>
        <h1 className="text-2xl font-bold">{existing ? t("Edit your review") : t("How was {market}?", { market: market.name })}</h1>
        <p className="text-sm text-muted-foreground">{t("Shown as a shopper review, with your first name and last initial.")}</p>
      </div>
      {market.organizer_id === user.id ? (
        <p className="rounded-lg bg-muted p-3 text-sm">{t("You run this market, so you can't review it. You can reply to reviews from your dashboard.")}</p>
      ) : (
        <ActionForm action={saveShopperReview} className="space-y-5">
          <input type="hidden" name="market_id" value={market.id} />
          <section className="space-y-1 rounded-xl border bg-background p-4">
            <StarInput name="rating_overall" label={t("Overall")} defaultValue={existing?.rating_overall ?? 0} />
            <p className="pt-2 text-xs text-muted-foreground">{t("Optional:")}</p>
            <StarInput name="rating_variety" label={t("Variety of vendors")} defaultValue={existing?.rating_variety ?? 0} />
            <StarInput name="rating_atmosphere" label={t("Atmosphere")} defaultValue={existing?.rating_atmosphere ?? 0} />
            <StarInput name="rating_prices" label={t("Prices")} defaultValue={existing?.rating_prices ?? 0} />
          </section>
          <section className="space-y-4 rounded-xl border bg-background p-4">
            <div className="space-y-1.5">
              <Label htmlFor="visited_on">{t("When did you go?")}</Label>
              <Input id="visited_on" name="visited_on" type="date" required max={today} min={addDays(today, -365)} defaultValue={existing?.visited_on ?? today} className="w-44" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="body">{t("Your review (optional)")}</Label>
              <Textarea
                id="body"
                name="body"
                rows={5}
                maxLength={2000}
                defaultValue={existing?.body ?? ""}
                placeholder={t("What did you love? Parking, crowds, best stalls, good for kids or dogs…")}
              />
              <p className="text-xs text-muted-foreground">{t("Keep it about the market. Reviews with personal attacks or spam are removed.")}</p>
            </div>
          </section>
          <SubmitButton size="lg" className="w-full" pendingText={t("Posting…")}>
            {existing ? t("Save review") : t("Post review")}
          </SubmitButton>
        </ActionForm>
      )}
      {existing && (
        <ConfirmButton variant="ghost" className="w-full text-destructive" action={deleteShopperReview.bind(null, existing.id)} confirmText={t("Delete your review?")} redirectTo={`/markets/${market.slug}`}>
          {t("Delete review")}
        </ConfirmButton>
      )}
    </main>
  )
}
