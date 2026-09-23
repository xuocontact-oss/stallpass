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

  return (
    <main className="mx-auto w-full max-w-lg space-y-5 px-4 py-6">
      <Link href={`/markets/${market.slug}`} className="text-sm text-muted-foreground">← {market.name}</Link>
      <div>
        <h1 className="text-2xl font-bold">{existing ? "Edit your review" : `How was ${market.name}?`}</h1>
        <p className="text-sm text-muted-foreground">Shown as a shopper review, with your first name and last initial.</p>
      </div>
      {market.organizer_id === user.id ? (
        <p className="rounded-lg bg-muted p-3 text-sm">You run this market, so you can&apos;t review it. You can reply to reviews from your dashboard.</p>
      ) : (
        <ActionForm action={saveShopperReview} className="space-y-5">
          <input type="hidden" name="market_id" value={market.id} />
          <section className="space-y-1 rounded-xl border bg-background p-4">
            <StarInput name="rating_overall" label="Overall" defaultValue={existing?.rating_overall ?? 0} />
            <p className="pt-2 text-xs text-muted-foreground">Optional:</p>
            <StarInput name="rating_variety" label="Variety of vendors" defaultValue={existing?.rating_variety ?? 0} />
            <StarInput name="rating_atmosphere" label="Atmosphere" defaultValue={existing?.rating_atmosphere ?? 0} />
            <StarInput name="rating_prices" label="Prices" defaultValue={existing?.rating_prices ?? 0} />
          </section>
          <section className="space-y-4 rounded-xl border bg-background p-4">
            <div className="space-y-1.5">
              <Label htmlFor="visited_on">When did you go?</Label>
              <Input id="visited_on" name="visited_on" type="date" required max={today} min={addDays(today, -365)} defaultValue={existing?.visited_on ?? today} className="w-44" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="body">Your review (optional)</Label>
              <Textarea
                id="body"
                name="body"
                rows={5}
                maxLength={2000}
                defaultValue={existing?.body ?? ""}
                placeholder="What did you love? Parking, crowds, best stalls, good for kids or dogs…"
              />
              <p className="text-xs text-muted-foreground">Keep it about the market. Reviews with personal attacks or spam are removed.</p>
            </div>
          </section>
          <SubmitButton size="lg" className="w-full" pendingText="Posting…">
            {existing ? "Save review" : "Post review"}
          </SubmitButton>
        </ActionForm>
      )}
      {existing && (
        <ConfirmButton variant="ghost" className="w-full text-destructive" action={deleteShopperReview.bind(null, existing.id)} confirmText="Delete your review?" redirectTo={`/markets/${market.slug}`}>
          Delete review
        </ConfirmButton>
      )}
    </main>
  )
}
