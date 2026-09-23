import { ActionButton } from "@/components/action-button"
import { ConfirmButton } from "@/components/confirm-button"
import { addExampleContent, removeExampleContent } from "@/actions/admin-moderation"
import { requireAdmin } from "@/lib/auth"
import { demoContentStatus } from "@/lib/demo-content"

export const metadata = { title: "Example content · Admin" }

/** Show vendors what Stallpass looks like before real markets join, then remove it in one tap. */
export default async function AdminDemoPage() {
  await requireAdmin()
  const status = await demoContentStatus()
  const on = status.markets > 0
  return (
    <main className="space-y-5">
      <h1 className="text-2xl font-bold">Example content</h1>
      <section className="space-y-3 rounded-xl border bg-background p-4 text-sm">
        <p>
          Adds a set of <strong>example markets</strong> around LA with vendor ratings, &ldquo;how sales went&rdquo;,
          shopper reviews and example Start-hub listings, so vendors you sign up can see everything Stallpass offers.
        </p>
        <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
          <li>Everything is labeled <strong>EXAMPLE</strong>, and the directory explains what that means (required by law for fake reviews).</li>
          <li>Real vendors can&apos;t apply to, review, claim or list example markets, and they&apos;re hidden from Google.</li>
          <li>Real vendors&apos; accounts, documents and applications are never touched by adding or removing examples.</li>
        </ul>
        <p className="font-medium">
          Right now: {on ? `${status.markets} example markets, ${status.reviews} vendor reviews, ${status.shopperReviews} shopper reviews.` : "no example content."}
        </p>
        <div className="flex flex-wrap gap-2">
          {!on && <ActionButton action={addExampleContent} pendingText="Adding… (about a minute)">Add example content</ActionButton>}
          {on && (
            <ConfirmButton
              variant="destructive"
              action={removeExampleContent}
              confirmText="Remove ALL example markets, reviews and listings? Real vendors stay."
            >
              Remove all example content
            </ConfirmButton>
          )}
        </div>
      </section>
    </main>
  )
}
