import Link from "next/link"
import { MarketForm } from "@/components/admin/market-form"

export const metadata = { title: "Add market · Admin" }

export default function NewMarketPage() {
  return (
    <main className="space-y-4">
      <Link href="/admin/markets" className="text-sm text-muted-foreground">← Markets</Link>
      <h1 className="text-2xl font-bold">Add a market</h1>
      <MarketForm />
    </main>
  )
}
