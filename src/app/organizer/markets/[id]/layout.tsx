import Link from "next/link"
import { ExternalLink } from "lucide-react"
import { MarketApprovalBadge } from "@/components/market-approval-badge"
import { OrganizerTabs } from "@/components/organizer-tabs"
import { requireOrganizedMarket } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"

/** Every organizer market page checks on the server that you run this market. */
export default async function OrganizerMarketLayout({ children, params }: LayoutProps<"/organizer/markets/[id]">) {
  const { id } = await params
  const market = await requireOrganizedMarket(id)
  const supabase = await createClient()
  const { count } = await supabase
    .from("applications")
    .select("id", { count: "exact", head: true })
    .eq("market_id", id)
    .eq("status", "submitted")

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-6">
      <Link href="/organizer" className="text-sm text-muted-foreground">← Your markets</Link>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">{market.name}</h1>
        <div className="flex items-center gap-3">
          <MarketApprovalBadge status={market.approval_status} published={market.is_published} />
          {market.approval_status === "approved" && (
            <Link href={`/markets/${market.slug}`} className="flex items-center gap-1 text-sm text-primary">
              <ExternalLink className="size-4" /> Public page
            </Link>
          )}
        </div>
      </div>
      {market.approval_status === "pending" && (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950">
          Stallpass is checking this listing. It&apos;s not public yet; you can keep adding dates and photos.
        </p>
      )}
      {market.approval_status === "rejected" && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-900">
          This listing wasn&apos;t approved{market.rejection_reason ? `: ${market.rejection_reason}` : "."} Fix it under
          &ldquo;Edit market&rdquo; and save to send it back for review.
        </p>
      )}
      <OrganizerTabs marketId={market.id} newCount={count ?? 0} />
      {children}
    </div>
  )
}
