import { ActionForm, SubmitButton } from "@/components/action-form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { updateFeeSettings, updateSettings } from "@/actions/admin-moderation"
import { requireAdmin } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"

export const metadata = { title: "Settings · Admin" }

export default async function AdminSettingsPage() {
  await requireAdmin()
  const supabase = await createClient()
  const { data: s } = await supabase.from("platform_settings").select("*").eq("id", 1).single()

  return (
    <main className="space-y-5">
      <h1 className="text-2xl font-bold">Settings</h1>
      <section className="space-y-4 rounded-xl border bg-background p-4">
        <div>
          <h2 className="font-semibold">When new markets skip approval</h2>
          <p className="text-sm text-muted-foreground">
            New markets from organizers wait for your approval, unless the organizer is <strong>trusted</strong> (set on
            the Accounts page) or already runs an approved market with at least this rating from this many reviews.
          </p>
        </div>
        <ActionForm action={updateSettings} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="auto_approve_min_rating">Minimum rating (1–5)</Label>
              <Input id="auto_approve_min_rating" name="auto_approve_min_rating" type="number" step="0.1" min="1" max="5" defaultValue={s?.auto_approve_min_rating ?? 4} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="auto_approve_min_reviews">Minimum reviews</Label>
              <Input id="auto_approve_min_reviews" name="auto_approve_min_reviews" type="number" min="1" max="1000" defaultValue={s?.auto_approve_min_reviews ?? 5} />
            </div>
          </div>
          <SubmitButton pendingText="Saving…">Save</SubmitButton>
        </ActionForm>
        <p className="rounded-lg bg-muted/60 p-3 text-sm text-muted-foreground">
          <strong>AI listing check:</strong> not set up yet. Later, an AI assistant can review new listings and approve
          the obvious ones for you.
        </p>
      </section>
      <section className="space-y-4 rounded-xl border bg-background p-4">
        <div>
          <h2 className="font-semibold">Stallpass fee on card payments</h2>
          <p className="text-sm text-muted-foreground">
            Taken from each booth fee paid by card in the app (the organizer receives the rest). Payments on a market&apos;s own
            link aren&apos;t charged.
          </p>
        </div>
        <ActionForm action={updateFeeSettings} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="platform_fee_percent">Percent (%)</Label>
              <Input id="platform_fee_percent" name="platform_fee_percent" type="number" step="0.01" min="0" max="50" defaultValue={s?.platform_fee_percent ?? 5} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="platform_fee_flat_dollars">Plus a flat fee ($)</Label>
              <Input id="platform_fee_flat_dollars" name="platform_fee_flat_dollars" type="number" step="0.01" min="0" max="100" defaultValue={((s?.platform_fee_flat_cents ?? 0) / 100).toFixed(2)} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Example: a $100 booth fee → Stallpass keeps {`$${(((Number(s?.platform_fee_percent ?? 5) / 100) * 100) + (s?.platform_fee_flat_cents ?? 0) / 100).toFixed(2)}`}. Stripe&apos;s own card fee comes out of the organizer&apos;s share.
          </p>
          <SubmitButton pendingText="Saving…">Save fee</SubmitButton>
        </ActionForm>
      </section>
    </main>
  )
}
