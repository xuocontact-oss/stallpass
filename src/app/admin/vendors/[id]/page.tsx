import Link from "next/link"
import { notFound } from "next/navigation"
import { ExternalLink } from "lucide-react"
import { ApplicationStatusBadge } from "@/components/application-status-badge"
import { DocStatusBadge } from "@/components/doc-status-badge"
import { SampleBadge } from "@/components/sample-badge"
import { Stars } from "@/components/stars"
import { requireAdmin } from "@/lib/auth"
import { categoryLabel, documentTypeLabel, setupTypeLabel } from "@/lib/constants"
import { formatDate, todayISO } from "@/lib/dates"
import { documentStatus } from "@/lib/documents"
import { createClient } from "@/lib/supabase/server"
import { publicPhotoUrl } from "@/lib/storage"
import type { Vendor, VendorDocument } from "@/lib/types"

export const metadata = { title: "Vendor · Admin" }

export default async function AdminVendorPage({ params }: PageProps<"/admin/vendors/[id]">) {
  await requireAdmin()
  const { id } = await params
  const supabase = await createClient()
  const { data } = await supabase
    .from("vendors")
    .select("*, profiles!vendors_owner_id_fkey(email, full_name, created_at)")
    .eq("id", id)
    .maybeSingle()
  if (!data) notFound()
  const vendor = data as Vendor & { profiles: { email: string; full_name: string | null; created_at: string } }
  const today = todayISO()

  const [{ data: docs }, { data: apps }, { data: reviews }, { data: photos }] = await Promise.all([
    supabase.from("vendor_documents").select("*").eq("vendor_id", id).order("expiration_date"),
    supabase
      .from("applications")
      .select("id, status, event_dates, markets(name)")
      .eq("vendor_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("reviews")
      .select("id, event_date, rating_overall, is_hidden, markets(name)")
      .eq("vendor_id", id)
      .order("event_date", { ascending: false }),
    supabase.from("vendor_photos").select("id, path").eq("vendor_id", id).order("position"),
  ])

  return (
    <main className="space-y-5">
      <Link href="/admin/vendors" className="text-sm text-muted-foreground">← Vendors</Link>
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          {vendor.business_name} {vendor.is_sample && <SampleBadge />}
        </h1>
        <p className="text-sm text-muted-foreground">
          {categoryLabel(vendor.category)} · {setupTypeLabel(vendor.setup_type)} ·{" "}
          {vendor.profiles.full_name ? `${vendor.profiles.full_name}, ` : ""}
          <a href={`mailto:${vendor.profiles.email}`} className="text-primary">{vendor.profiles.email}</a>
          {vendor.phone && ` · ${vendor.phone}`} · joined {formatDate(vendor.profiles.created_at.slice(0, 10))}
        </p>
      </div>

      {(photos ?? []).length > 0 && (
        <div className="flex gap-2 overflow-x-auto">
          {photos!.map((p) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={p.id} src={publicPhotoUrl("vendor-photos", p.path)} alt="" className="size-24 shrink-0 rounded-lg object-cover" />
          ))}
        </div>
      )}

      {vendor.description && <p className="rounded-xl border bg-background p-4 text-sm whitespace-pre-line">{vendor.description}</p>}

      <section className="rounded-xl border bg-background p-4">
        <h2 className="mb-2 font-semibold">Documents ({docs?.length ?? 0})</h2>
        <ul className="divide-y">
          {((docs ?? []) as VendorDocument[]).map((d) => (
            <li key={d.id}>
              <a href={`/documents/${d.id}/file`} target="_blank" rel="noopener" className="flex items-center gap-3 py-2.5 text-sm hover:underline">
                <span className="min-w-0 flex-1">
                  {documentTypeLabel(d.doc_type)}
                  {d.title && <span className="text-muted-foreground"> · {d.title}</span>}
                  <span className="block text-muted-foreground">
                    {d.expiration_date ? `Expires ${formatDate(d.expiration_date)}` : "No expiry"}
                  </span>
                </span>
                <DocStatusBadge status={documentStatus(d.expiration_date, today)} />
                <ExternalLink className="size-4 text-muted-foreground" aria-hidden />
              </a>
            </li>
          ))}
          {docs?.length === 0 && <li className="py-2 text-sm text-muted-foreground">None.</li>}
        </ul>
      </section>

      <section className="rounded-xl border bg-background p-4">
        <h2 className="mb-2 font-semibold">Applications ({apps?.length ?? 0})</h2>
        <ul className="divide-y">
          {((apps ?? []) as unknown as { id: string; status: string; event_dates: string[]; markets: { name: string } | null }[]).map((a) => (
            <li key={a.id}>
              <Link href={`/admin/applications/${a.id}`} className="flex items-center gap-3 py-2.5 text-sm hover:underline">
                <span className="min-w-0 flex-1">
                  {a.markets?.name}
                  <span className="block text-muted-foreground">{a.event_dates.map((d) => formatDate(d)).join(", ")}</span>
                </span>
                <ApplicationStatusBadge status={a.status} />
              </Link>
            </li>
          ))}
          {apps?.length === 0 && <li className="py-2 text-sm text-muted-foreground">None.</li>}
        </ul>
      </section>

      <section className="rounded-xl border bg-background p-4">
        <h2 className="mb-2 font-semibold">Reviews written ({reviews?.length ?? 0})</h2>
        <p className="mb-2 text-xs text-muted-foreground">Only you can see who wrote these.</p>
        <ul className="divide-y">
          {((reviews ?? []) as unknown as { id: string; event_date: string; rating_overall: number; is_hidden: boolean; markets: { name: string } | null }[]).map((r) => (
            <li key={r.id}>
              <Link href={`/admin/reviews#${r.id}`} className="flex items-center gap-3 py-2.5 text-sm hover:underline">
                <span className="min-w-0 flex-1">
                  {r.markets?.name} <span className="text-muted-foreground">· {formatDate(r.event_date)}</span>
                </span>
                {r.is_hidden && <span className="text-xs text-destructive">Hidden</span>}
                <Stars value={r.rating_overall} />
              </Link>
            </li>
          ))}
          {reviews?.length === 0 && <li className="py-2 text-sm text-muted-foreground">None.</li>}
        </ul>
      </section>
    </main>
  )
}
