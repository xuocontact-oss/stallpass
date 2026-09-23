import Link from "next/link"
import { notFound } from "next/navigation"
import { FileText } from "lucide-react"
import { ActionButton } from "@/components/action-button"
import { ApplicationStatusBadge } from "@/components/application-status-badge"
import { Stars } from "@/components/stars"
import { verifyApplication } from "@/actions/admin-moderation"
import { requireAdmin } from "@/lib/auth"
import { documentTypeLabel } from "@/lib/constants"
import { formatDate } from "@/lib/dates"
import { createClient } from "@/lib/supabase/server"
import type { Application, ApplicationDocument } from "@/lib/types"

export const metadata = { title: "Application · Admin" }

const SOURCE: Record<string, string> = {
  vendor: "Reported by the vendor",
  organizer: "Set by the organizer on Stallpass",
  admin: "Set by admin",
}

export default async function AdminApplicationPage({ params }: PageProps<"/admin/applications/[id]">) {
  await requireAdmin()
  const { id } = await params
  const supabase = await createClient()
  const { data } = await supabase
    .from("applications")
    .select("*, vendors(id, business_name), markets(id, name, slug, is_claimed)")
    .eq("id", id)
    .maybeSingle()
  if (!data) notFound()
  const app = data as Application & {
    vendors: { id: string; business_name: string }
    markets: { id: string; name: string; slug: string; is_claimed: boolean }
  }
  const [{ data: docs }, { data: reviews }] = await Promise.all([
    supabase.from("application_documents").select("*").eq("application_id", id).order("doc_type"),
    supabase.from("reviews").select("id, event_date, rating_overall, is_hidden").eq("application_id", id),
  ])
  const needsVerify = ["accepted", "paid"].includes(app.status) && app.status_source === "vendor"

  return (
    <main className="space-y-5">
      <Link href="/admin/applications" className="text-sm text-muted-foreground">← Applications</Link>
      <div className="flex items-start justify-between gap-3">
        <h1 className="text-2xl font-bold">
          <Link href={`/admin/vendors/${app.vendors.id}`} className="hover:underline">{app.vendors.business_name}</Link>
          <span className="text-muted-foreground"> → </span>
          <Link href={`/admin/markets/${app.markets.id}`} className="hover:underline">{app.markets.name}</Link>
        </h1>
        <ApplicationStatusBadge status={app.status} className="mt-2" />
      </div>

      <section className="space-y-1.5 rounded-xl border bg-background p-4 text-sm">
        <p><span className="text-muted-foreground">Dates: </span>{app.event_dates.map((d) => formatDate(d, { weekday: true })).join(", ")}</p>
        {app.booth_choice && <p><span className="text-muted-foreground">Booth: </span>{app.booth_choice}</p>}
        {app.note && <p className="whitespace-pre-line"><span className="text-muted-foreground">Note: </span>{app.note}</p>}
        <p><span className="text-muted-foreground">Status: </span>{SOURCE[app.status_source]}{app.verified_at && `, verified ${formatDate(app.verified_at.slice(0, 10))}`}</p>
        <p>
          <span className="text-muted-foreground">Delivered: </span>
          {app.delivered_via === "platform" && "To the organizer on Stallpass"}
          {app.delivered_via === "email" && (app.emailed_at ? `By email, ${formatDate(app.emailed_at.slice(0, 10))}` : "Email not sent yet")}
          {app.delivered_via === "not_sent" && "Not sent (no market contact email)"}
          {!app.delivered_via && "Draft"}
        </p>
        {app.share_token && (
          <a href={`/a/${app.share_token}`} target="_blank" rel="noopener" className="inline-block font-medium text-primary">
            Open the market&apos;s view →
          </a>
        )}
      </section>

      {needsVerify && (
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-background p-4">
          <p className="text-sm">
            {app.verified_at ? "Verified: the vendor can review this market." : "The vendor says they were accepted. Verify to let them review."}
          </p>
          <ActionButton action={verifyApplication.bind(null, app.id, !app.verified_at)} variant={app.verified_at ? "outline" : "default"}>
            {app.verified_at ? "Un-verify" : "Verify"}
          </ActionButton>
        </section>
      )}

      <section className="rounded-xl border bg-background p-4">
        <h2 className="mb-2 font-semibold">Documents sent</h2>
        <ul className="space-y-1.5">
          {((docs ?? []) as ApplicationDocument[]).map((d) => (
            <li key={d.id}>
              <a href={`/applications/${app.id}/documents/${d.id}`} target="_blank" rel="noopener" className="flex items-center gap-2 text-sm hover:underline">
                <FileText className="size-4 text-muted-foreground" aria-hidden />
                {documentTypeLabel(d.doc_type)}
                {d.expiration_date && <span className="text-muted-foreground">· valid until {formatDate(d.expiration_date)}</span>}
              </a>
            </li>
          ))}
          {docs?.length === 0 && <li className="text-sm text-muted-foreground">None.</li>}
        </ul>
      </section>

      {(reviews ?? []).length > 0 && (
        <section className="rounded-xl border bg-background p-4">
          <h2 className="mb-2 font-semibold">Reviews from this application</h2>
          <ul className="space-y-1.5">
            {reviews!.map((r) => (
              <li key={r.id}>
                <Link href={`/admin/reviews#${r.id}`} className="flex items-center gap-2 text-sm hover:underline">
                  {formatDate(r.event_date)} <Stars value={r.rating_overall} />
                  {r.is_hidden && <span className="text-xs text-destructive">Hidden</span>}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  )
}
