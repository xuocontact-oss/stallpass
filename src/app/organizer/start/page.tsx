import { redirect } from "next/navigation"
import { CheckCircle2 } from "lucide-react"
import { ActionButton } from "@/components/action-button"
import { becomeOrganizer } from "@/actions/organizer"
import { getProfile, requireUser } from "@/lib/auth"

export const metadata = { title: "For market organizers" }

export default async function OrganizerStartPage({ searchParams }: PageProps<"/organizer/start">) {
  await requireUser()
  const profile = await getProfile()
  const { next } = await searchParams
  const nextPath = typeof next === "string" && next.startsWith("/claim/") ? next : undefined
  if (profile?.is_organizer) redirect(nextPath ?? "/organizer")

  return (
    <main className="mx-auto w-full max-w-lg space-y-5 px-4 py-10">
      <div>
        <p className="text-sm font-medium text-primary">For market organizers</p>
        <h1 className="text-3xl font-bold">Run your market on Stallpass</h1>
        <p className="mt-2 text-muted-foreground">Free for organizers. You can use the same account to sell food too.</p>
      </div>
      <ul className="space-y-2 text-sm">
        {[
          "Every application in one place, with documents already checked",
          "Accept, waitlist or decline in one tap. Vendors are emailed automatically.",
          "Booth list for each date, and one-tap emails to all your vendors",
          "Reply publicly to vendor reviews",
        ].map((b) => (
          <li key={b} className="flex gap-2">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" aria-hidden /> {b}
          </li>
        ))}
      </ul>
      <ActionButton action={becomeOrganizer.bind(null, nextPath)} size="lg" className="w-full" pendingText="Setting up…">
        I run a market
      </ActionButton>
    </main>
  )
}
