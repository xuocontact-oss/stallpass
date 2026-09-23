import Link from "next/link"
import { HideReviewButton, HideShopperReviewButton } from "@/components/admin/hide-review-button"
import { SampleBadge } from "@/components/sample-badge"
import { Stars } from "@/components/stars"
import { requireAdmin } from "@/lib/auth"
import { formatDate } from "@/lib/dates"
import { throwIfError } from "@/lib/form"
import { createClient } from "@/lib/supabase/server"
import { cn } from "@/lib/utils"

export const metadata = { title: "Reviews · Admin" }

type Row = {
  id: string
  application_id: string | null
  event_date: string
  rating_overall: number
  body: string | null
  is_hidden: boolean
  is_sample: boolean
  hidden_reason: string | null
  organizer_reply: string | null
  created_at: string
  vendors: { id: string; business_name: string } | null
  markets: { id: string; name: string; slug: string } | null
}

export default async function AdminReviewsPage({ searchParams }: PageProps<"/admin/reviews">) {
  await requireAdmin()
  const { show, type } = await searchParams
  if (type === "shopper") return <ShopperReviewsAdmin show={typeof show === "string" ? show : undefined} />
  const supabase = await createClient()
  let query = supabase
    .from("reviews")
    .select("id, application_id, event_date, rating_overall, body, is_hidden, is_sample, hidden_reason, organizer_reply, created_at, vendors(id, business_name), markets(id, name, slug)")
    .order("created_at", { ascending: false })
    .limit(200)
  if (show === "hidden") query = query.eq("is_hidden", true)
  const { data, error } = await query
  throwIfError(error, "reviews")
  const rows = (data ?? []) as unknown as Row[]

  return (
    <main className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Vendor reviews</h1>
        <div className="flex gap-3 text-sm">
          <Link href="/admin/reviews?type=shopper" className="text-primary">Shopper reviews →</Link>
          <Link href="/admin/reviews" className={cn(show !== "hidden" && "font-semibold text-primary")}>All</Link>
          <Link href="/admin/reviews?show=hidden" className={cn(show === "hidden" && "font-semibold text-primary")}>Hidden</Link>
        </div>
      </div>
      <ul className="divide-y rounded-xl border bg-background">
        {rows.map((r) => (
          <li key={r.id} id={r.id} className={cn("scroll-mt-20 space-y-1.5 p-4 target:ring-2 target:ring-primary", r.is_hidden && "bg-red-50/50")}>
            <div className="flex flex-wrap items-center gap-2">
              <Stars value={r.rating_overall} />
              <Link href={`/admin/vendors/${r.vendors?.id}`} className="text-sm font-medium text-primary hover:underline">
                {r.vendors?.business_name}
              </Link>
              <span className="text-sm text-muted-foreground">
                on <Link href={`/markets/${r.markets?.slug}#reviews`} className="hover:underline">{r.markets?.name}</Link> (
                {r.application_id ? (
                  <Link href={`/admin/applications/${r.application_id}`} className="hover:underline">{formatDate(r.event_date)}</Link>
                ) : (
                  formatDate(r.event_date)
                )}
                )
              </span>
              {r.is_sample && <SampleBadge />}
              <span className="ml-auto">
                <HideReviewButton id={r.id} hidden={r.is_hidden} />
              </span>
            </div>
            {r.body && <p className="text-sm whitespace-pre-line">{r.body}</p>}
            {r.organizer_reply && <p className="text-sm text-muted-foreground">↳ Organizer: {r.organizer_reply}</p>}
            {r.is_hidden && <p className="text-sm text-destructive">Hidden: {r.hidden_reason ?? "no reason given"}</p>}
          </li>
        ))}
        {rows.length === 0 && <li className="p-4 text-sm text-muted-foreground">No reviews.</li>}
      </ul>
    </main>
  )
}

async function ShopperReviewsAdmin({ show }: { show?: string }) {
  const supabase = await createClient()
  let query = supabase
    .from("shopper_reviews")
    .select("id, visited_on, rating_overall, body, is_hidden, is_sample, hidden_reason, display_name, organizer_reply, created_at, profiles(email), markets(name, slug)")
    .order("created_at", { ascending: false })
    .limit(300)
  if (show === "hidden") query = query.eq("is_hidden", true)
  const { data, error } = await query
  throwIfError(error, "shopper reviews")
  const rows = (data ?? []) as unknown as {
    id: string
    visited_on: string
    rating_overall: number
    body: string | null
    is_hidden: boolean
    is_sample: boolean
    hidden_reason: string | null
    display_name: string | null
    organizer_reply: string | null
    profiles: { email: string } | null
    markets: { name: string; slug: string } | null
  }[]
  return (
    <main className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Shopper reviews</h1>
        <div className="flex gap-3 text-sm">
          <Link href="/admin/reviews" className="text-primary">← Vendor reviews</Link>
          <Link href="/admin/reviews?type=shopper" className={cn(show !== "hidden" && "font-semibold text-primary")}>All</Link>
          <Link href="/admin/reviews?type=shopper&show=hidden" className={cn(show === "hidden" && "font-semibold text-primary")}>Hidden</Link>
        </div>
      </div>
      <ul className="divide-y rounded-xl border bg-background">
        {rows.map((r) => (
          <li key={r.id} id={r.id} className={cn("space-y-1.5 p-4", r.is_hidden && "bg-red-50/50")}>
            <div className="flex flex-wrap items-center gap-2">
              <Stars value={r.rating_overall} />
              <span className="text-sm font-medium">{r.display_name}</span>
              <span className="text-xs text-muted-foreground">({r.profiles?.email})</span>
              <span className="text-sm text-muted-foreground">
                on <Link href={`/markets/${r.markets?.slug}#shopper-reviews`} className="hover:underline">{r.markets?.name}</Link> (visited {formatDate(r.visited_on)})
              </span>
              {r.is_sample && <SampleBadge />}
              <span className="ml-auto">
                <HideShopperReviewButton id={r.id} hidden={r.is_hidden} />
              </span>
            </div>
            {r.body && <p className="text-sm whitespace-pre-line">{r.body}</p>}
            {r.organizer_reply && <p className="text-sm text-muted-foreground">↳ Organizer: {r.organizer_reply}</p>}
            {r.is_hidden && <p className="text-sm text-destructive">Hidden: {r.hidden_reason ?? "no reason given"}</p>}
          </li>
        ))}
        {rows.length === 0 && <li className="p-4 text-sm text-muted-foreground">No shopper reviews.</li>}
      </ul>
    </main>
  )
}
