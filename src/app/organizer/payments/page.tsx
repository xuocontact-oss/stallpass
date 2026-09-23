import Link from "next/link"
import { CheckCircle2, CreditCard } from "lucide-react"
import { ActionButton } from "@/components/action-button"
import { openStripeDashboard, startStripeOnboarding } from "@/actions/payments"
import { requireOrganizer } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/server"
import { getStripe, stripeIsTestMode, syncPayoutAccount } from "@/lib/stripe"

export const metadata = { title: "Payments" }

export default async function OrganizerPaymentsPage() {
  const { user } = await requireOrganizer()
  const stripe = getStripe()
  const db = createAdminClient()
  const { data: acct } = await db.from("payout_accounts").select("*").eq("user_id", user.id).maybeSingle()
  // Fresh status from Stripe (e.g. just back from Stripe's sign-up).
  if (acct && stripe) await syncPayoutAccount(acct.stripe_account_id).catch(() => null)
  const { data: fresh } = acct ? await db.from("payout_accounts").select("*").eq("user_id", user.id).single() : { data: null }

  return (
    <main className="mx-auto w-full max-w-2xl space-y-5 px-4 py-6">
      <Link href="/organizer" className="text-sm text-muted-foreground">← Your markets</Link>
      <h1 className="text-2xl font-bold">Card payments</h1>
      {stripe && stripeIsTestMode() && (
        <p className="rounded-lg bg-violet-50 p-3 text-sm text-violet-900">
          <strong>Test mode:</strong> no real money moves. Use Stripe&apos;s test details when asked.
        </p>
      )}

      <section className="space-y-3 rounded-xl border bg-background p-4">
        <CreditCard className="size-6 text-primary" aria-hidden />
        {!stripe ? (
          <p className="text-sm text-muted-foreground">Card payments aren&apos;t switched on for Stallpass yet.</p>
        ) : fresh?.charges_enabled ? (
          <>
            <p className="flex items-center gap-2 font-semibold">
              <CheckCircle2 className="size-5 text-emerald-600" /> Ready to take card payments
            </p>
            <p className="text-sm text-muted-foreground">
              Vendors pay booth fees in the app. The money goes to your bank through Stripe, minus a small Stallpass fee.
              Choose &ldquo;Card payments on Stallpass&rdquo; in each market&apos;s payment settings.
            </p>
            <ActionButton variant="outline" action={openStripeDashboard} pendingText="Opening…">
              Open Stripe (payouts & refunds)
            </ActionButton>
          </>
        ) : (
          <>
            <p className="font-semibold">{fresh ? "Finish setting up Stripe" : "Take booth fees by card"}</p>
            <p className="text-sm text-muted-foreground">
              Stripe handles cards and pays you out to your bank. Stallpass never holds your money. Setup takes about 5
              minutes: your details, bank account, and ID.
            </p>
            <ActionButton action={startStripeOnboarding} size="lg" pendingText="Opening Stripe…">
              {fresh ? "Continue Stripe setup" : "Connect Stripe"}
            </ActionButton>
          </>
        )}
      </section>

      <p className="text-sm text-muted-foreground">
        Prefer your own payment page (for example a city payment portal)? You can use that instead: open a market →
        Edit market → &ldquo;How vendors pay&rdquo;.
      </p>
    </main>
  )
}
