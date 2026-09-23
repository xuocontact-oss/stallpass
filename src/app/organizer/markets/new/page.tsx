import Link from "next/link"
import { MarketForm } from "@/components/admin/market-form"
import { createOrganizerMarket } from "@/actions/organizer"
import { requireOrganizer } from "@/lib/auth"

export const metadata = { title: "Add your market" }

export default async function NewOrganizerMarketPage() {
  const { profile } = await requireOrganizer()
  return (
    <main className="mx-auto w-full max-w-2xl space-y-4 px-4 py-6">
      <Link href="/organizer" className="text-sm text-muted-foreground">← Your markets</Link>
      <div>
        <h1 className="text-2xl font-bold">Add your market</h1>
        <p className="text-sm text-muted-foreground">
          {profile.is_trusted_organizer
            ? "You're a trusted organizer, so it goes live as soon as you save."
            : "We check new listings before they go live (usually within a day). You can add dates and photos right after saving."}
        </p>
      </div>
      <MarketForm action={createOrganizerMarket} mode="organizer" submitLabel="Save market" />
    </main>
  )
}
