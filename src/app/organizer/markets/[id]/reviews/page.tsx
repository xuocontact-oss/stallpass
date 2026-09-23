import { ActionForm, SubmitButton } from "@/components/action-form"
import { ReviewSummaryBox } from "@/components/review-list"
import { Stars } from "@/components/stars"
import { Textarea } from "@/components/ui/textarea"
import { replyToReview, replyToShopperReview } from "@/actions/organizer"
import { categoryLabel, salesRangeLabel } from "@/lib/constants"
import { formatDate } from "@/lib/dates"
import { summarizeReviews } from "@/lib/reviews"
import { createClient } from "@/lib/supabase/server"
import type { PublicReview, ShopperReview } from "@/lib/types"

export default async function OrganizerReviewsPage({ params }: PageProps<"/organizer/markets/[id]/reviews">) {
  const { id } = await params
  const supabase = await createClient()
  const { data } = await supabase.from("market_reviews").select("*").eq("market_id", id).order("event_date", { ascending: false })
  const reviews = (data ?? []) as PublicReview[]
  const { data: sdata } = await supabase.from("market_shopper_reviews").select("*").eq("market_id", id).order("visited_on", { ascending: false })
  const shopperReviews = (sdata ?? []) as ShopperReview[]

  return (
    <main className="space-y-5">
      <h2 className="text-lg font-semibold">From vendors</h2>
      <p className="text-sm text-muted-foreground">
        Reviews come only from vendors who worked your market. They&apos;re anonymous. Your replies are public.
      </p>
      {reviews.length === 0 ? (
        <p className="rounded-xl border bg-background p-4 text-sm text-muted-foreground">No reviews yet.</p>
      ) : (
        <>
          <section className="rounded-xl border bg-background p-4">
            <ReviewSummaryBox summary={summarizeReviews(reviews)} />
          </section>
          <ul className="space-y-3">
            {reviews.map((r) => (
              <li key={r.id} className="space-y-2 rounded-xl border bg-background p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Stars value={r.rating_overall} />
                  <span className="text-sm font-medium">Verified vendor · {categoryLabel(r.reviewer_category)}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatDate(r.event_date)} · Foot traffic {r.rating_foot_traffic}/5 · Organization {r.rating_organization}/5 · Value{" "}
                  {r.rating_value}/5{r.sales_range && ` · Sales ${salesRangeLabel(r.sales_range)}`}
                </p>
                {r.body && <p className="text-sm whitespace-pre-line">{r.body}</p>}
                <ActionForm action={replyToReview} className="space-y-2 border-t pt-3">
                  <input type="hidden" name="review_id" value={r.id} />
                  <Textarea
                    name="reply"
                    rows={2}
                    maxLength={2000}
                    defaultValue={r.organizer_reply ?? ""}
                    placeholder="Reply publicly (optional). Keep it friendly and helpful."
                    aria-label="Your public reply"
                  />
                  <SubmitButton size="sm" variant="outline" pendingText="Saving…">
                    {r.organizer_reply ? "Update reply" : "Post reply"}
                  </SubmitButton>
                </ActionForm>
              </li>
            ))}
          </ul>
        </>
      )}

      <h2 className="pt-4 text-lg font-semibold">From shoppers ({shopperReviews.length})</h2>
      {shopperReviews.length === 0 ? (
        <p className="rounded-xl border bg-background p-4 text-sm text-muted-foreground">No shopper reviews yet.</p>
      ) : (
        <ul className="space-y-3">
          {shopperReviews.map((r) => (
            <li key={r.id} className="space-y-2 rounded-xl border bg-background p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Stars value={r.rating_overall} />
                <span className="text-sm font-medium">{r.display_name}</span>
                <span className="text-xs text-muted-foreground">visited {formatDate(r.visited_on)}</span>
              </div>
              {r.body && <p className="text-sm whitespace-pre-line">{r.body}</p>}
              <ActionForm action={replyToShopperReview} className="space-y-2 border-t pt-3">
                <input type="hidden" name="review_id" value={r.id} />
                <Textarea name="reply" rows={2} maxLength={2000} defaultValue={r.organizer_reply ?? ""} placeholder="Reply publicly (optional)" aria-label="Your public reply" />
                <SubmitButton size="sm" variant="outline" pendingText="Saving…">
                  {r.organizer_reply ? "Update reply" : "Post reply"}
                </SubmitButton>
              </ActionForm>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
