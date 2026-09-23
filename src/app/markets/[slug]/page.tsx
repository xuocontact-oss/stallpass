import Link from "next/link"
import { notFound } from "next/navigation"
import { CalendarDays, ExternalLink, FileCheck2, MapPin, Users } from "lucide-react"
import { ApplicationStatusBadge } from "@/components/application-status-badge"
import { ReadinessList } from "@/components/readiness-list"
import { ReviewList, ReviewSummaryBox, ShopperReviewList } from "@/components/review-list"
import { SampleBadge } from "@/components/sample-badge"
import { Stars } from "@/components/stars"
import { buttonVariants } from "@/components/ui/button"
import { categoryLabel, documentTypeLabel, marketTypeLabel } from "@/lib/constants"
import { getMyVendor, getUser } from "@/lib/auth"
import { daysBetween, formatDate, formatTime, todayISO } from "@/lib/dates"
import { getMarketBySlug, MIN_VENDOR_COUNT_SHOWN, vendorCountFor } from "@/lib/market-data"
import { formatMoney } from "@/lib/markets"
import { getPartnerOffers } from "@/lib/partners"
import { checkReadiness } from "@/lib/readiness"
import { summarizeReviews } from "@/lib/reviews"
import { publicPhotoUrl } from "@/lib/storage"
import { createClient } from "@/lib/supabase/server"
import { getMyDocuments } from "@/lib/vendor-data"

export async function generateMetadata({ params }: PageProps<"/markets/[slug]">) {
  const { slug } = await params
  const data = await getMarketBySlug(slug, todayISO())
  if (!data) return { title: "Market" }
  const m = data.market
  return {
    title: `${m.name}, ${m.city}`,
    description: [m.schedule_summary, `${m.market_type === "farmers" ? "Farmers market" : "Market"} in ${m.city}, ${m.state}.`, "Dates, booth fees, requirements and reviews."]
      .filter(Boolean)
      .join(" "),
  }
}

function externalUrl(value: string) {
  return /^https?:\/\//i.test(value) ? value : `https://${value}`
}

function instagramUrl(value: string) {
  return /instagram\.com/i.test(value) ? externalUrl(value) : `https://instagram.com/${value.replace(/^@/, "")}`
}

export default async function MarketPage({ params, searchParams }: PageProps<"/markets/[slug]">) {
  const { slug } = await params
  const reviewedNow = Boolean((await searchParams).reviewed)
  const today = todayISO()
  const data = await getMarketBySlug(slug, today)
  if (!data) notFound()
  const { market, dates, photos, reviews, shopperReviews } = data
  const vendorCount = await vendorCountFor(market.id)
  const summary = summarizeReviews(reviews)
  const shopperAvg = shopperReviews.length
    ? Math.round((shopperReviews.reduce((s, r) => s + r.rating_overall, 0) / shopperReviews.length) * 10) / 10
    : null

  // For signed-in vendors: are my documents ready, and have I applied already?
  const user = await getUser()
  const vendor = user ? await getMyVendor() : null
  let readiness = null
  let offers = {}
  let myApplications: { id: string; status: string; event_dates: string[] }[] = []
  if (vendor) {
    const docs = await getMyDocuments(vendor.id)
    readiness = checkReadiness(market.required_doc_types, docs, dates[0] ? [dates[0].event_date] : [], today)
    if (!readiness.ready) offers = await getPartnerOffers()
    const supabase = await createClient()
    const { data: apps } = await supabase
      .from("applications")
      .select("id, status, event_dates")
      .eq("vendor_id", vendor.id)
      .eq("market_id", market.id)
      .order("created_at", { ascending: false })
    myApplications = apps ?? []
  }
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${market.address}, ${market.city}, ${market.state}`
  )}`
  const deadlineDays = market.application_deadline ? daysBetween(today, market.application_deadline) : null

  return (
    <main className="mx-auto w-full max-w-3xl space-y-5 px-4 py-6">
      <Link href="/markets" className="text-sm text-muted-foreground">
        ← All markets
      </Link>

      {photos.length > 0 && (
        <div className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          {photos.map((p) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img loading="lazy" decoding="async"
              key={p.id}
              src={publicPhotoUrl("market-photos", p.path)}
              alt=""
              className="h-52 w-[85%] shrink-0 snap-start rounded-xl object-cover sm:h-64 sm:w-[60%]"
            />
          ))}
        </div>
      )}

      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-primary">{marketTypeLabel(market.market_type)}</span>
          {market.is_sample && <SampleBadge />}
        </div>
        <h1 className="mt-1 text-3xl font-bold">{market.name}</h1>
        {market.organizer_name && <p className="text-muted-foreground">by {market.organizer_name}</p>}
        {summary.count > 0 && (
          <a href="#reviews" className="mt-1 flex items-center gap-1.5 text-sm">
            <Stars value={summary.overall} />
            <span className="font-medium">{summary.overall?.toFixed(1)}</span>
            <span className="text-muted-foreground">({summary.count} vendor reviews)</span>
          </a>
        )}
        {market.schedule_summary && <p className="mt-2 font-medium">{market.schedule_summary}</p>}
        {vendorCount >= MIN_VENDOR_COUNT_SHOWN && (
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-sm font-medium">
            <Users className="size-4 text-primary" aria-hidden /> {vendorCount} vendors here use Stallpass
          </p>
        )}
      </div>

      <section className="rounded-xl border-2 border-primary/30 bg-background p-4">
        {!user ? (
          <>
            <h2 className="font-semibold">Want a spot here?</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Join free to check you have the right documents and apply in a couple of taps.
            </p>
            <Link
              href={`/login?next=${encodeURIComponent(`/markets/${market.slug}/apply`)}`}
              className={buttonVariants({ size: "lg", className: "mt-3 w-full" })}
            >
              Sign in to apply
            </Link>
          </>
        ) : !vendor ? (
          <p className="text-sm">
            Want to sell here?{" "}
            <Link href="/onboarding?step=1" className="font-medium text-primary">
              Set up a vendor profile to apply
            </Link>
          </p>
        ) : (
          <>
            <h2 className="font-semibold">
              {readiness!.items.length === 0
                ? "No documents required"
                : readiness!.ready
                  ? "You have everything this market needs ✓"
                  : "Before you apply"}
            </h2>
            {readiness!.items.length > 0 && (
              <div className="mt-3">
                <ReadinessList items={readiness!.items} offers={offers} />
              </div>
            )}
            {myApplications.length > 0 && (
              <div className="mt-4 space-y-1.5 border-t pt-3">
                <p className="text-sm font-medium">Your applications here</p>
                {myApplications.map((a) => (
                  <Link key={a.id} href={`/applications/${a.id}`} className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate">{a.event_dates.map((d) => formatDate(d)).join(", ")}</span>
                    <ApplicationStatusBadge status={a.status} />
                  </Link>
                ))}
              </div>
            )}
            {dates.length > 0 ? (
              <Link href={`/markets/${market.slug}/apply`} className={buttonVariants({ size: "lg", className: "mt-4 w-full" })}>
                Quick apply
              </Link>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">No upcoming dates to apply for yet.</p>
            )}
          </>
        )}
      </section>

      <a href={mapsUrl} target="_blank" rel="noopener" className="flex items-start gap-2 rounded-xl border bg-background p-4">
        <MapPin className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
        <span>
          {market.address}
          <br />
          {market.city}, {market.state} {market.zip}
          <span className="mt-1 block text-sm font-medium text-primary">Open in Google Maps</span>
        </span>
      </a>

      {market.description && (
        <section className="rounded-xl border bg-background p-4">
          <h2 className="mb-2 font-semibold">About</h2>
          <p className="whitespace-pre-line text-sm leading-relaxed">{market.description}</p>
        </section>
      )}

      <section className="rounded-xl border bg-background p-4">
        <h2 className="mb-3 flex items-center gap-2 font-semibold">
          <CalendarDays className="size-5 text-primary" aria-hidden /> Upcoming dates
        </h2>
        {dates.length === 0 ? (
          <p className="text-sm text-muted-foreground">No upcoming dates listed yet.</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {dates.map((d) => (
              <li key={d.id} className="rounded-lg bg-muted/60 px-3 py-2 text-sm">
                <span className="font-medium">{formatDate(d.event_date, { weekday: true })}</span>
                {d.starts_at && (
                  <span className="text-muted-foreground">
                    {" "}
                    · {formatTime(d.starts_at)}
                    {d.ends_at && `–${formatTime(d.ends_at)}`}
                  </span>
                )}
                {d.note && <span className="block text-xs text-muted-foreground">{d.note}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border bg-background p-4">
        <h2 className="mb-3 font-semibold">Booth fees</h2>
        {market.booth_fees.length === 0 ? (
          <p className="text-sm text-muted-foreground">Not listed. Contact the market.</p>
        ) : (
          <ul className="divide-y text-sm">
            {market.booth_fees.map((f, i) => (
              <li key={i} className="flex justify-between py-2">
                <span>{f.label}</span>
                <span className="font-semibold">{formatMoney(f.amount_cents)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border bg-background p-4">
        <h2 className="mb-3 flex items-center gap-2 font-semibold">
          <FileCheck2 className="size-5 text-primary" aria-hidden /> What you&apos;ll need to apply
        </h2>
        {market.required_doc_types.length === 0 ? (
          <p className="text-sm text-muted-foreground">No specific documents listed.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {market.required_doc_types.map((t) => (
              <li key={t}>• {documentTypeLabel(t)}</li>
            ))}
          </ul>
        )}
        {market.application_deadline && (
          <p className="mt-3 text-sm">
            <span className="font-medium">Application deadline:</span> {formatDate(market.application_deadline)}
            {deadlineDays != null && deadlineDays < 0 && <span className="text-destructive"> (passed)</span>}
          </p>
        )}
        {market.sales_reporting === "required" && (
          <p className="mt-2 text-sm">
            <span className="font-medium">Sales reports:</span> vendors report their sales after each market day
            {market.sales_fee_percent ? ` (the market charges ${market.sales_fee_percent}% of sales)` : ""}.
          </p>
        )}
        {market.application_notes && (
          <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{market.application_notes}</p>
        )}
      </section>

      <section className="rounded-xl border bg-background p-4">
        <h2 className="mb-3 font-semibold">Looking for</h2>
        {market.categories_wanted.length === 0 ? (
          <p className="text-sm text-muted-foreground">All kinds of food vendors welcome.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {market.categories_wanted.map((c) => (
              <span key={c} className="rounded-full bg-secondary px-3 py-1 text-sm">
                {categoryLabel(c)}
              </span>
            ))}
          </div>
        )}
      </section>

      <section id="shopper-reviews" className="scroll-mt-20 rounded-xl border bg-background p-4">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="font-semibold">Reviews from shoppers</h2>
            {shopperAvg != null && (
              <p className="mt-0.5 flex items-center gap-1.5 text-sm">
                <Stars value={shopperAvg} /> <span className="font-medium">{shopperAvg.toFixed(1)}</span>
                <span className="text-muted-foreground">({shopperReviews.length})</span>
              </p>
            )}
          </div>
          <Link href={`/markets/${market.slug}/review`} className={buttonVariants({ size: "sm", variant: "outline" })}>
            Write a review
          </Link>
        </div>
        {reviewedNow && <p className="mb-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">Thanks! Your review is posted.</p>}
        {shopperReviews.length === 0 ? (
          <p className="text-sm text-muted-foreground">Been here? Be the first to review it.</p>
        ) : (
          <ShopperReviewList reviews={shopperReviews} />
        )}
      </section>

      {!market.is_claimed && (
        <p className="text-center text-sm text-muted-foreground">
          Run this market?{" "}
          <Link href={`/claim/${market.slug}`} className="font-medium text-primary">
            Claim it for free
          </Link>
        </p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        {market.website && (
          <a href={externalUrl(market.website)} target="_blank" rel="noopener nofollow" className={buttonVariants({ variant: "outline" })}>
            <ExternalLink /> Market website
          </a>
        )}
        {market.instagram && (
          <a
            href={instagramUrl(market.instagram)}
            target="_blank"
            rel="noopener nofollow"
            className={buttonVariants({ variant: "outline" })}
          >
            <ExternalLink /> Instagram
          </a>
        )}
      </div>

      <section id="reviews" className="rounded-xl border bg-background p-4">
        <h2 className="font-semibold">Reviews from vendors</h2>
        <p className="mb-3 text-xs text-muted-foreground">Only from vendors who were accepted and worked the market.</p>
        {reviews.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No vendor reviews yet.
          </p>
        ) : (
          <div className="space-y-5">
            <ReviewSummaryBox summary={summary} />
            <ReviewList reviews={reviews} />
          </div>
        )}
      </section>
    </main>
  )
}
