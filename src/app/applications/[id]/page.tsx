import Link from "next/link"
import { notFound } from "next/navigation"
import { CheckCircle2, ExternalLink, FileText, Star } from "lucide-react"
import { ActionButton } from "@/components/action-button"
import { ApplicationStatusBadge } from "@/components/application-status-badge"
import { ConfirmButton } from "@/components/confirm-button"
import { PaymentBox } from "@/components/payment-box"
import { Stars } from "@/components/stars"
import { buttonVariants } from "@/components/ui/button"
import { deleteDraft, sendApplication, setApplicationStatus } from "@/actions/applications"
import { requireVendor } from "@/lib/auth"
import { documentTypeLabel } from "@/lib/constants"
import { formatDate, todayISO } from "@/lib/dates"
import { createAdminClient, createClient } from "@/lib/supabase/server"
import type { Application, ApplicationDocument, Market, Payment, Review } from "@/lib/types"

export const metadata = { title: "Application" }

const SENT_NOTICES: Record<string, { tone: "good" | "warn"; text: string }> = {
  email: { tone: "good", text: "Sent! We emailed your application to the market. Their reply will come straight to your email." },
  platform: { tone: "good", text: "Sent! The organizer will see it in their Stallpass dashboard." },
  draft: { tone: "good", text: "Draft saved. Send it whenever you're ready." },
  not_sent: {
    tone: "warn",
    text: "Saved, but not sent: we don't have an email for this market yet. Apply through their website or Instagram for now.",
  },
  email_failed: { tone: "warn", text: "Saved, but the email didn't go through. Tap “Send again” below." },
}

export default async function ApplicationPage({ params, searchParams }: PageProps<"/applications/[id]">) {
  const { vendor } = await requireVendor()
  const { id } = await params
  const { sent, reviewed, payment } = await searchParams
  const supabase = await createClient()

  const { data } = await supabase
    .from("applications")
    .select("*, markets(*)")
    .eq("id", id)
    .eq("vendor_id", vendor.id)
    .maybeSingle()
  if (!data) notFound()
  const app = data as Application & { markets: Market }
  const market = app.markets
  const today = todayISO()

  const [{ data: docs }, { data: reviews }, { data: payments }] = await Promise.all([
    supabase.from("application_documents").select("*").eq("application_id", app.id).order("doc_type"),
    supabase.from("reviews").select("*").eq("application_id", app.id),
    supabase.from("payments").select("*").eq("application_id", app.id).order("created_at", { ascending: false }),
  ])
  // Is the organizer set up for card payments? (Checked with full access; only a yes/no is used.)
  let stripeReady = false
  if (market.payment_method === "stripe" && market.organizer_id && process.env.STRIPE_SECRET_KEY) {
    const { data: acct } = await createAdminClient()
      .from("payout_accounts")
      .select("charges_enabled")
      .eq("user_id", market.organizer_id)
      .maybeSingle()
    stripeReady = Boolean(acct?.charges_enabled)
  }
  const attached = (docs ?? []) as ApplicationDocument[]
  const myReviews = (reviews ?? []) as Review[]

  const notice = typeof sent === "string" ? SENT_NOTICES[sent] : null
  const confirmedAccepted =
    ["accepted", "paid"].includes(app.status) && (app.status_source !== "vendor" || app.verified_at != null)
  const pastDates = app.event_dates.filter((d) => d <= today)
  const canReport = !market.is_claimed && ["submitted", "accepted", "waitlisted", "declined", "paid"].includes(app.status)
  const shareActive = app.share_token && app.share_expires_at && new Date(app.share_expires_at) > new Date()

  return (
    <main className="mx-auto w-full max-w-2xl space-y-5 px-4 py-6">
      <Link href="/applications" className="text-sm text-muted-foreground">
        ← Applications
      </Link>

      {notice && (
        <p className={notice.tone === "good" ? "rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900" : "rounded-lg bg-amber-50 p-3 text-sm text-amber-950"}>
          {notice.text}
        </p>
      )}
      {reviewed && <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">Thanks! Your review is live.</p>}
      {payment === "success" && <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">Payment received! We emailed your receipt.</p>}
      {payment === "processing" && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950">Your payment is processing. We&apos;ll update this page when Stripe confirms it.</p>}
      {payment === "cancelled" && <p className="rounded-lg bg-muted p-3 text-sm">Payment cancelled. Nothing was charged.</p>}

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href={`/markets/${market.slug}`} className="text-2xl font-bold hover:underline">
            {market.name}
          </Link>
          <p className="text-sm text-muted-foreground">{market.city}</p>
        </div>
        <ApplicationStatusBadge status={app.status} className="mt-1.5" />
      </div>

      <section className="space-y-2 rounded-xl border bg-background p-4 text-sm">
        <p>
          <span className="text-muted-foreground">Dates: </span>
          {app.event_dates.map((d) => formatDate(d, { weekday: true })).join(", ")}
        </p>
        {app.booth_choice && (
          <p>
            <span className="text-muted-foreground">Booth: </span>
            {app.booth_choice}
          </p>
        )}
        {app.booth_number && (
          <p>
            <span className="text-muted-foreground">Your booth number: </span>
            <span className="font-semibold">{app.booth_number}</span>
          </p>
        )}
        {app.note && <p className="whitespace-pre-line"><span className="text-muted-foreground">Your note: </span>{app.note}</p>}
        {app.organizer_note && (
          <p className="rounded-lg bg-secondary p-3 whitespace-pre-line">
            <span className="font-medium">From the organizer: </span>
            {app.organizer_note}
          </p>
        )}
        <p className="text-muted-foreground">
          {app.status === "draft" && "Draft, not sent yet."}
          {app.delivered_via === "platform" && `Sent to the organizer on Stallpass ${app.submitted_at ? formatDate(app.submitted_at.slice(0, 10)) : ""}.`}
          {app.delivered_via === "email" &&
            (app.emailed_at ? `Emailed to the market ${formatDate(app.emailed_at.slice(0, 10))}.` : "The email hasn't gone through yet.")}
          {app.delivered_via === "not_sent" && "Not sent: no email address on file for this market."}
        </p>
        {shareActive && (
          <a href={`/a/${app.share_token}`} target="_blank" rel="noopener" className="inline-flex items-center gap-1 font-medium text-primary">
            <ExternalLink className="size-4" /> See what the market sees
          </a>
        )}
      </section>

      <PaymentBox app={app} market={market} payments={(payments ?? []) as Payment[]} stripeReady={stripeReady} />

      {app.status === "draft" && (
        <div className="flex gap-2">
          <ActionButton action={sendApplication.bind(null, app.id)} size="lg" className="flex-1" pendingText="Sending…">
            Send now
          </ActionButton>
          <ConfirmButton variant="outline" size="lg" action={deleteDraft.bind(null, app.id)} confirmText="Delete this draft?" redirectTo="/applications">
            Delete
          </ConfirmButton>
        </div>
      )}
      {app.status === "submitted" && app.delivered_via === "email" && !app.emailed_at && (
        <ActionButton action={sendApplication.bind(null, app.id)} size="lg" className="w-full" pendingText="Sending…">
          Send again
        </ActionButton>
      )}

      {canReport && (
        <section className="space-y-3 rounded-xl border bg-background p-4">
          <div>
            <h2 className="font-semibold">What did the market say?</h2>
            <p className="text-sm text-muted-foreground">
              This market isn&apos;t on Stallpass yet, so keep track here when they reply.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {(["accepted", "waitlisted", "declined"] as const).map((s) => (
              <ActionButton
                key={s}
                variant={app.status === s ? "default" : "outline"}
                action={setApplicationStatus.bind(null, app.id, s)}
                disabled={app.status === s}
              >
                {s === "accepted" ? "Accepted" : s === "waitlisted" ? "Waitlisted" : "Declined"}
              </ActionButton>
            ))}
          </div>
          {["accepted", "paid"].includes(app.status) && market.payment_method !== "external_link" && (
            <ActionButton
              variant={app.status === "paid" ? "default" : "outline"}
              className="w-full"
              action={setApplicationStatus.bind(null, app.id, app.status === "paid" ? "accepted" : "paid")}
            >
              {app.status === "paid" ? "✓ Booth fee paid (tap to undo)" : "I've paid the booth fee"}
            </ActionButton>
          )}
          {app.status === "accepted" && app.status_source === "vendor" && !app.verified_at && (
            <p className="text-sm text-muted-foreground">
              Nice! Stallpass will confirm your acceptance so you can review this market after the event.
            </p>
          )}
        </section>
      )}

      {attached.length > 0 && (
        <section className="rounded-xl border bg-background p-4">
          <h2 className="mb-2 font-semibold">Documents sent</h2>
          <ul className="space-y-1.5">
            {attached.map((d) => (
              <li key={d.id}>
                <a href={`/applications/${app.id}/documents/${d.id}`} target="_blank" rel="noopener" className="flex items-center gap-2 text-sm hover:underline">
                  <FileText className="size-4 text-muted-foreground" aria-hidden />
                  {documentTypeLabel(d.doc_type)}
                  {d.expiration_date && <span className="text-muted-foreground">· valid until {formatDate(d.expiration_date)}</span>}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {pastDates.length > 0 && ["accepted", "paid"].includes(app.status) && (
        <section className="space-y-3 rounded-xl border bg-background p-4">
          <h2 className="flex items-center gap-2 font-semibold">
            <Star className="size-5 text-amber-400" aria-hidden /> Review this market
          </h2>
          {!confirmedAccepted ? (
            <p className="text-sm text-muted-foreground">
              You can review once your acceptance is confirmed. This keeps reviews honest: only vendors who really worked
              the market can post.
            </p>
          ) : (
            <ul className="space-y-2">
              {pastDates.map((d) => {
                const review = myReviews.find((r) => r.event_date === d)
                return (
                  <li key={d} className="flex items-center justify-between gap-2 text-sm">
                    <span>{formatDate(d, { weekday: true })}</span>
                    {review ? (
                      <Link href={`/applications/${app.id}/review?date=${d}`} className="flex items-center gap-2">
                        <CheckCircle2 className="size-4 text-emerald-600" aria-hidden />
                        <Stars value={review.rating_overall} />
                        <span className="font-medium text-primary">Edit</span>
                      </Link>
                    ) : (
                      <Link href={`/applications/${app.id}/review?date=${d}`} className={buttonVariants({ size: "sm" })}>
                        Write a review
                      </Link>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
          {myReviews.some((r) => r.is_hidden) && (
            <p className="text-sm text-destructive">
              One of your reviews was hidden by Stallpass
              {myReviews.find((r) => r.is_hidden)?.hidden_reason ? `: ${myReviews.find((r) => r.is_hidden)?.hidden_reason}` : "."}
            </p>
          )}
        </section>
      )}

      {!["cancelled", "draft", "paid", "declined"].includes(app.status) && (
        <ConfirmButton
          variant="ghost"
          className="w-full text-destructive"
          action={setApplicationStatus.bind(null, app.id, "cancelled")}
          confirmText={`Cancel your application to ${market.name}? ${market.is_claimed ? "The organizer will see it's cancelled." : "Also let the market know by replying to their email."}`}
        >
          Cancel application
        </ConfirmButton>
      )}
    </main>
  )
}
