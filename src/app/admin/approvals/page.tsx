import Link from "next/link"
import { ExternalLink } from "lucide-react"
import { ActionButton } from "@/components/action-button"
import { PromptButton } from "@/components/prompt-button"
import { decideClaim, reviewMarket } from "@/actions/admin-moderation"
import { requireAdmin } from "@/lib/auth"
import { marketTypeLabel } from "@/lib/constants"
import { formatDate } from "@/lib/dates"
import { throwIfError } from "@/lib/form"
import { createClient } from "@/lib/supabase/server"

export const metadata = { title: "Approvals · Admin" }

type PendingMarket = {
  id: string
  name: string
  market_type: string
  city: string
  address: string
  website: string | null
  instagram: string | null
  description: string | null
  created_at: string
  profiles: { email: string; full_name: string | null } | null
}

type PendingClaim = {
  id: string
  role: string
  message: string | null
  evidence_url: string | null
  created_at: string
  markets: { id: string; name: string; slug: string; website: string | null; instagram: string | null } | null
  profiles: { email: string; full_name: string | null } | null
}

function link(v: string) {
  return /^https?:\/\//i.test(v) ? v : `https://${v}`
}

export default async function AdminApprovalsPage() {
  await requireAdmin()
  const supabase = await createClient()
  const [{ data: markets, error: e1 }, { data: claims, error: e2 }] = await Promise.all([
    supabase
      .from("markets")
      .select("id, name, market_type, city, address, website, instagram, description, created_at, profiles!markets_organizer_id_fkey(email, full_name)")
      .eq("approval_status", "pending")
      .order("created_at"),
    supabase
      .from("market_claims")
      .select("id, role, message, evidence_url, created_at, markets(id, name, slug, website, instagram), profiles!market_claims_user_id_fkey(email, full_name)")
      .eq("status", "pending")
      .order("created_at"),
  ])
  throwIfError(e1, "pending markets")
  throwIfError(e2, "claims")
  const pendingMarkets = (markets ?? []) as unknown as PendingMarket[]
  const pendingClaims = (claims ?? []) as unknown as PendingClaim[]

  return (
    <main className="space-y-8">
      <h1 className="text-2xl font-bold">Approvals</h1>

      <section className="space-y-2">
        <h2 className="font-semibold">Claims on existing markets ({pendingClaims.length})</h2>
        <p className="text-sm text-muted-foreground">
          Check the person really runs the market, e.g. their email matches the market&apos;s website, or email the
          market&apos;s official address to confirm.
        </p>
        {pendingClaims.length === 0 ? (
          <p className="rounded-xl border bg-background p-4 text-sm text-muted-foreground">No claims waiting.</p>
        ) : (
          <ul className="divide-y rounded-xl border bg-background">
            {pendingClaims.map((c) => (
              <li key={c.id} className="space-y-2 p-4 text-sm">
                <p>
                  <span className="font-medium">{c.profiles?.full_name || c.profiles?.email}</span>{" "}
                  <span className="text-muted-foreground">({c.profiles?.email})</span> wants to manage{" "}
                  <Link href={`/admin/markets/${c.markets?.id}`} className="font-medium text-primary hover:underline">{c.markets?.name}</Link>
                </p>
                <p><span className="text-muted-foreground">Role: </span>{c.role}</p>
                {c.evidence_url && (
                  <p>
                    <span className="text-muted-foreground">Proof: </span>
                    <a href={link(c.evidence_url)} target="_blank" rel="noopener nofollow" className="text-primary hover:underline">{c.evidence_url}</a>
                  </p>
                )}
                {c.message && <p className="whitespace-pre-line text-muted-foreground">&ldquo;{c.message}&rdquo;</p>}
                <p className="text-xs text-muted-foreground">
                  Market&apos;s own links: {[c.markets?.website, c.markets?.instagram].filter(Boolean).join(" · ") || "none on file"} · asked{" "}
                  {formatDate(c.created_at.slice(0, 10))}
                </p>
                <div className="flex gap-2 pt-1">
                  <ActionButton size="sm" action={decideClaim.bind(null, c.id, true, undefined)}>Approve claim</ActionButton>
                  <PromptButton size="sm" variant="outline" action={decideClaim.bind(null, c.id, false)} question="Reason (the person will see this):" defaultReason="We couldn't confirm you run this market.">
                    Reject
                  </PromptButton>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">New markets from organizers ({pendingMarkets.length})</h2>
        {pendingMarkets.length === 0 ? (
          <p className="rounded-xl border bg-background p-4 text-sm text-muted-foreground">No markets waiting.</p>
        ) : (
          <ul className="divide-y rounded-xl border bg-background">
            {pendingMarkets.map((m) => (
              <li key={m.id} className="space-y-2 p-4 text-sm">
                <p className="flex flex-wrap items-center gap-2">
                  <Link href={`/admin/markets/${m.id}`} className="font-medium text-primary hover:underline">{m.name}</Link>
                  <span className="text-muted-foreground">
                    {marketTypeLabel(m.market_type)} · {m.address}, {m.city}
                  </span>
                </p>
                <p className="text-muted-foreground">
                  By {m.profiles?.full_name || m.profiles?.email} ({m.profiles?.email}) · {formatDate(m.created_at.slice(0, 10))}
                </p>
                {m.description && <p className="line-clamp-3 whitespace-pre-line">{m.description}</p>}
                <p className="flex flex-wrap gap-3">
                  {m.website && <a href={link(m.website)} target="_blank" rel="noopener nofollow" className="inline-flex items-center gap-1 text-primary"><ExternalLink className="size-3.5" /> Website</a>}
                  {m.instagram && <span className="text-muted-foreground">Instagram: {m.instagram}</span>}
                </p>
                <div className="flex gap-2 pt-1">
                  <ActionButton size="sm" action={reviewMarket.bind(null, m.id, true, undefined)}>Approve</ActionButton>
                  <PromptButton size="sm" variant="outline" action={reviewMarket.bind(null, m.id, false)} question="Reason (the organizer will see this):" defaultReason="Please add a real address and a link to the market's website or Instagram.">
                    Reject
                  </PromptButton>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
