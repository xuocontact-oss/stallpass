import Link from "next/link"
import { notFound } from "next/navigation"
import { CheckCircle2 } from "lucide-react"
import { ActionForm, SubmitButton } from "@/components/action-form"
import { buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { submitClaim } from "@/actions/organizer"
import { getProfile, getUser } from "@/lib/auth"
import { VerifyEmailBox } from "@/components/verify-email-box"
import { todayISO } from "@/lib/dates"
import { getMarketBySlug, MIN_VENDOR_COUNT_SHOWN, vendorCountFor } from "@/lib/market-data"
import { createClient } from "@/lib/supabase/server"

export const metadata = { title: "Claim your market" }

const BENEFITS = [
  "Every application in one place, with permits and insurance already checked",
  "Accept, waitlist or decline in one tap, and message all your vendors",
  "Booth lists for every date",
  "Reply publicly to vendor reviews",
]

/** Where "Claim this market" leads (from the market page and from application emails). */
export default async function ClaimPage({ params }: PageProps<"/claim/[slug]">) {
  const { slug } = await params
  const data = await getMarketBySlug(slug, todayISO())
  if (!data || data.market.is_sample) notFound()
  const { market } = data
  const user = await getUser()
  const vendorCount = await vendorCountFor(market.id)
  const profile = await getProfile()

  let existing: { status: string } | null = null
  if (user) {
    const supabase = await createClient()
    const { data: claim } = await supabase
      .from("market_claims")
      .select("status")
      .eq("market_id", market.id)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    existing = claim
  }

  return (
    <main className="mx-auto w-full max-w-lg space-y-5 px-4 py-10">
      <div>
        <p className="text-sm font-medium text-primary">For market organizers</p>
        <h1 className="text-3xl font-bold">Claim {market.name}</h1>
        <p className="mt-2 text-muted-foreground">
          {vendorCount >= MIN_VENDOR_COUNT_SHOWN
            ? `Free. ${vendorCount} vendors who sell at ${market.name} already use Stallpass.`
            : "Free. Vendors are already applying to your market here."}
        </p>
      </div>
      <ul className="space-y-2">
        {BENEFITS.map((b) => (
          <li key={b} className="flex gap-2 text-sm">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" aria-hidden /> {b}
          </li>
        ))}
      </ul>

      {market.is_claimed ? (
        <p className="rounded-lg bg-muted p-3 text-sm">
          {market.organizer_id === user?.id ? (
            <>
              You run this market. <Link href={`/organizer/markets/${market.id}`} className="font-medium text-primary">Open your dashboard</Link>
            </>
          ) : (
            "This market already has an organizer on Stallpass."
          )}
        </p>
      ) : !user ? (
        <Link href={`/login?next=${encodeURIComponent(`/claim/${market.slug}`)}`} className={buttonVariants({ size: "lg", className: "w-full" })}>
          Sign in to claim
        </Link>
      ) : existing?.status === "pending" ? (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950">
          We&apos;re checking your claim. We&apos;ll email you once it&apos;s approved.{" "}
          <Link href="/organizer" className="font-medium">See your claims</Link>
        </p>
      ) : user && !profile?.email_verified_at ? (
        <VerifyEmailBox email={user.email ?? ""} reason="Verify your email to claim this market. We'll use it to reach you about the claim." />
      ) : (
        <ActionForm action={submitClaim} className="space-y-4 rounded-xl border bg-background p-4">
          {existing?.status === "rejected" && (
            <p className="text-sm text-destructive">Your last claim wasn&apos;t approved. You can try again with more details.</p>
          )}
          <input type="hidden" name="market_id" value={market.id} />
          <div className="space-y-1.5">
            <Label htmlFor="role">Your role at the market</Label>
            <Input id="role" name="role" required maxLength={100} placeholder="e.g. Market manager, owner" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="evidence_url">A link that shows it&apos;s yours (optional)</Label>
            <Input id="evidence_url" name="evidence_url" maxLength={300} placeholder="Market website or Instagram that lists your email" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="message">Anything else? (optional)</Label>
            <Textarea id="message" name="message" rows={3} maxLength={1000} placeholder="Best way to confirm it's you, e.g. email us from the market's official address." />
          </div>
          <p className="text-xs text-muted-foreground">We check every claim by hand so nobody can take over a market that isn&apos;t theirs.</p>
          <SubmitButton size="lg" className="w-full" pendingText="Sending…">
            Send claim
          </SubmitButton>
        </ActionForm>
      )}
    </main>
  )
}
