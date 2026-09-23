import Link from "next/link"
import { notFound } from "next/navigation"
import { ActionForm, SubmitButton } from "@/components/action-form"
import { ConfirmButton } from "@/components/confirm-button"
import { StarInput } from "@/components/star-input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { deleteReview, saveReview } from "@/actions/reviews"
import { requireVendor } from "@/lib/auth"
import { RATING_FIELDS, SALES_RANGES } from "@/lib/constants"
import { formatDate, isValidISODate, todayISO } from "@/lib/dates"
import { createClient } from "@/lib/supabase/server"
import { getLang, getT } from "@/lib/i18n/server"
import type { Application, Market, Review } from "@/lib/types"

export const metadata = { title: "Review" }

export default async function ReviewPage({ params, searchParams }: PageProps<"/applications/[id]/review">) {
  const { vendor } = await requireVendor()
  const { id } = await params
  const { date } = await searchParams
  if (typeof date !== "string" || !isValidISODate(date)) notFound()

  const supabase = await createClient()
  const { data } = await supabase
    .from("applications")
    .select("*, markets(name, slug)")
    .eq("id", id)
    .eq("vendor_id", vendor.id)
    .maybeSingle()
  if (!data) notFound()
  const app = data as Application & { markets: Pick<Market, "name" | "slug"> }
  if (!app.event_dates.includes(date) || date > todayISO()) notFound()

  const { data: existing } = await supabase
    .from("reviews")
    .select("*")
    .eq("application_id", app.id)
    .eq("event_date", date)
    .maybeSingle()
  const review = existing as Review | null
  const t = await getT()
  const lang = await getLang()

  return (
    <main className="mx-auto w-full max-w-lg space-y-5 px-4 py-6">
      <Link href={`/applications/${app.id}`} className="text-sm text-muted-foreground">
        ← {t("Back")}
      </Link>
      <div>
        <h1 className="text-2xl font-bold">{review ? t("Edit your review") : t("How was it?")}</h1>
        <p className="text-muted-foreground">
          {app.markets.name} · {formatDate(date, { weekday: true, lang })}
        </p>
      </div>

      <ActionForm action={saveReview} className="space-y-5">
        <input type="hidden" name="application_id" value={app.id} />
        <input type="hidden" name="event_date" value={date} />
        {review && <input type="hidden" name="review_id" value={review.id} />}

        <section className="space-y-1 rounded-xl border bg-background p-4">
          {RATING_FIELDS.map((f) => (
            <StarInput key={f.key} name={f.key} label={t(f.label)} defaultValue={review?.[f.key] ?? 0} />
          ))}
        </section>

        <section className="space-y-2 rounded-xl border bg-background p-4">
          <p className="text-sm font-medium">
            {t("How did sales go?")} <span className="font-normal text-muted-foreground">({t("optional")})</span>
          </p>
          <p className="text-xs text-muted-foreground">{t("Helps other vendors decide. Never shown with your name.")}</p>
          <div className="grid grid-cols-2 gap-2">
            {SALES_RANGES.map((s) => (
              <label key={s.key} className="flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm has-checked:border-primary has-checked:bg-secondary">
                <input type="radio" name="sales_range" value={s.key} defaultChecked={review?.sales_range === s.key} className="accent-primary" />
                {t(s.label)}
              </label>
            ))}
          </div>
        </section>

        <section className="space-y-2 rounded-xl border bg-background p-4">
          <Label htmlFor="body">{t("Your review (optional)")}</Label>
          <Textarea
            id="body"
            name="body"
            rows={5}
            maxLength={3000}
            defaultValue={review?.body ?? ""}
            placeholder={t("Crowd, load-in, parking, how the organizer ran things, what sold well…")}
          />
          <p className="text-xs text-muted-foreground">{t("Keep it honest and about the market. Personal attacks get removed.")}</p>
        </section>

        <p className="rounded-lg bg-muted/60 p-3 text-sm text-muted-foreground">
          {t("Your review is posted as “Verified vendor”. Market organizers never see who wrote it.")}
        </p>

        <SubmitButton size="lg" className="w-full" pendingText={t("Posting…")}>
          {review ? t("Save review") : t("Post review")}
        </SubmitButton>
      </ActionForm>

      {review && (
        <ConfirmButton
          variant="ghost"
          className="w-full text-destructive"
          action={deleteReview.bind(null, review.id)}
          confirmText={t("Delete your review?")}
          redirectTo={`/applications/${app.id}`}
        >
          {t("Delete review")}
        </ConfirmButton>
      )}
    </main>
  )
}
