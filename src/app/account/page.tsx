import Link from "next/link"
import { ActionForm, SubmitButton } from "@/components/action-form"
import { ConfirmButton } from "@/components/confirm-button"
import { Stars } from "@/components/stars"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { deleteMyAccount } from "@/actions/account"
import { deleteShopperReview, saveShopperProfile } from "@/actions/shopper"
import { buttonVariants } from "@/components/ui/button"
import { getProfile, requireUser } from "@/lib/auth"
import { formatDate } from "@/lib/dates"
import { createClient } from "@/lib/supabase/server"

export const metadata = { title: "Your account" }

export default async function AccountPage() {
  const user = await requireUser()
  const profile = await getProfile()
  const supabase = await createClient()
  const { data: reviews } = await supabase
    .from("shopper_reviews")
    .select("id, visited_on, rating_overall, is_hidden, hidden_reason, markets(name, slug)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  return (
    <main className="mx-auto w-full max-w-lg space-y-5 px-4 py-6">
      <h1 className="text-2xl font-bold">Your account</h1>
      <ActionForm action={saveShopperProfile} className="space-y-4 rounded-xl border bg-background p-4">
        <div className="space-y-1.5">
          <Label htmlFor="full_name">Name</Label>
          <Input id="full_name" name="full_name" required maxLength={100} defaultValue={profile?.full_name ?? ""} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="home_zip">Home ZIP code</Label>
          <Input id="home_zip" name="home_zip" inputMode="numeric" pattern="\d{5}" maxLength={5} defaultValue={profile?.home_zip ?? ""} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" value={user.email} disabled readOnly />
        </div>
        <SubmitButton pendingText="Saving…">Save</SubmitButton>
      </ActionForm>

      <section className="space-y-2">
        <h2 className="font-semibold">Your market reviews</h2>
        {(reviews ?? []).length === 0 ? (
          <p className="rounded-xl border bg-background p-4 text-sm text-muted-foreground">
            None yet. Visited a market? <Link href="/markets" className="text-primary">Find it and leave a review</Link>.
          </p>
        ) : (
          <ul className="divide-y rounded-xl border bg-background">
            {(reviews as unknown as { id: string; visited_on: string; rating_overall: number; is_hidden: boolean; hidden_reason: string | null; markets: { name: string; slug: string } }[]).map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 p-4 text-sm">
                <Link href={`/markets/${r.markets.slug}/review`} className="min-w-0 flex-1 hover:underline">
                  <p className="font-medium">{r.markets.name}</p>
                  <p className="text-muted-foreground">Visited {formatDate(r.visited_on)}</p>
                  {r.is_hidden && <p className="text-destructive">Hidden by Stallpass{r.hidden_reason ? `: ${r.hidden_reason}` : ""}</p>}
                </Link>
                <Stars value={r.rating_overall} />
                <ConfirmButton size="sm" variant="ghost" action={deleteShopperReview.bind(null, r.id)} confirmText="Delete this review?">
                  Delete
                </ConfirmButton>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3 rounded-xl border bg-background p-4">
        <h2 className="font-semibold">Your data</h2>
        <a href="/account/export" className={buttonVariants({ variant: "outline", size: "sm" })}>
          Download my data
        </a>
        <details className="rounded-lg border border-destructive/30 p-3">
          <summary className="cursor-pointer text-sm font-medium text-destructive">Delete my account</summary>
          <ActionForm action={deleteMyAccount} className="mt-3 space-y-3">
            <p className="text-sm">
              This permanently deletes your account, business profile, documents, applications and reviews. It can&apos;t be
              undone. Markets you run stay listed without you.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="confirm">Type DELETE to confirm</Label>
              <Input id="confirm" name="confirm" autoComplete="off" className="w-40" />
            </div>
            <SubmitButton variant="destructive" pendingText="Deleting…">
              Permanently delete my account
            </SubmitButton>
          </ActionForm>
        </details>
      </section>
    </main>
  )
}
