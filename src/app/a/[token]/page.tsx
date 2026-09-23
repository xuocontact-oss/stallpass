import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Droplets, FileText, Plug } from "lucide-react"
import { categoryLabel, documentTypeLabel, setupTypeLabel } from "@/lib/constants"
import { formatDate, todayISO } from "@/lib/dates"
import { documentStatus } from "@/lib/documents"
import { DocStatusBadge } from "@/components/doc-status-badge"
import { findSharedApplication } from "@/lib/share"
import { publicPhotoUrl } from "@/lib/storage"
import type { ApplicationDocument, Market, Vendor } from "@/lib/types"

export const metadata: Metadata = { title: "Vendor application", robots: { index: false, follow: false } }

function link(value: string) {
  return /^https?:\/\//i.test(value) ? value : `https://${value}`
}

/** What a market (not yet on Stallpass) sees from the link in the application email. */
export default async function SharedApplicationPage({ params }: PageProps<"/a/[token]">) {
  const { token } = await params
  const found = await findSharedApplication(token)
  if (!found) notFound()
  const { app, expired, db } = found

  if (expired) {
    return (
      <main className="mx-auto w-full max-w-lg px-4 py-16 text-center">
        <h1 className="text-xl font-bold">This link has expired</h1>
        <p className="mt-2 text-muted-foreground">
          For privacy, application links only work for a limited time. Reply to the vendor&apos;s email to ask for
          their documents again.
        </p>
      </main>
    )
  }

  const [{ data: vendor }, { data: market }, { data: photos }, { data: docs }] = await Promise.all([
    db.from("vendors").select("*").eq("id", app.vendor_id).single(),
    db.from("markets").select("name, slug").eq("id", app.market_id).single(),
    db.from("vendor_photos").select("path").eq("vendor_id", app.vendor_id).order("position"),
    db.from("application_documents").select("*").eq("application_id", app.id).order("doc_type"),
  ])
  if (!vendor || !market) notFound()
  const v = vendor as Vendor
  const m = market as Pick<Market, "name" | "slug">
  const today = todayISO()
  const socials = [
    ["Instagram", v.instagram],
    ["TikTok", v.tiktok],
    ["Facebook", v.facebook],
    ["Website", v.website],
  ].filter(([, val]) => val) as [string, string][]

  return (
    <main className="mx-auto w-full max-w-2xl space-y-5 px-4 py-6">
      <div>
        <p className="text-sm font-medium text-primary">Application to {m.name}</p>
        <h1 className="text-3xl font-bold">{v.business_name}</h1>
        <p className="text-muted-foreground">{categoryLabel(v.category)}</p>
      </div>

      {(photos ?? []).length > 0 && (
        <div className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4">
          {photos!.map((p) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img loading="lazy" decoding="async" key={p.path} src={publicPhotoUrl("vendor-photos", p.path)} alt="" className="h-48 w-[75%] shrink-0 snap-start rounded-xl object-cover sm:w-[45%]" />
          ))}
        </div>
      )}

      <section className="space-y-2 rounded-xl border bg-background p-4 text-sm">
        <p>
          <span className="text-muted-foreground">Dates requested: </span>
          {app.event_dates.map((d) => formatDate(d, { weekday: true })).join(", ")}
        </p>
        {app.booth_choice && (
          <p>
            <span className="text-muted-foreground">Booth: </span>
            {app.booth_choice}
          </p>
        )}
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>
            <span className="text-muted-foreground">Setup: </span>
            {setupTypeLabel(v.setup_type)}
          </span>
          {v.needs_power && (
            <span className="flex items-center gap-1"><Plug className="size-4" /> Needs power</span>
          )}
          {v.needs_water && (
            <span className="flex items-center gap-1"><Droplets className="size-4" /> Needs water</span>
          )}
        </p>
        {v.setup_notes && <p className="text-muted-foreground">{v.setup_notes}</p>}
        {app.note && (
          <p className="rounded-lg bg-muted/60 p-3 whitespace-pre-line">
            <span className="font-medium">Note: </span>
            {app.note}
          </p>
        )}
      </section>

      <section className="rounded-xl border bg-background p-4">
        <h2 className="mb-2 font-semibold">Documents</h2>
        {(docs ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No documents attached.</p>
        ) : (
          <ul className="divide-y">
            {(docs as ApplicationDocument[]).map((d) => (
              <li key={d.id}>
                <a href={`/a/${token}/documents/${d.id}`} target="_blank" rel="noopener" className="flex items-center gap-3 py-2.5 text-sm">
                  <FileText className="size-5 shrink-0 text-primary" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{documentTypeLabel(d.doc_type)}</span>
                    <span className="text-muted-foreground">
                      {d.title ? `${d.title} · ` : ""}
                      {d.expiration_date ? `Valid until ${formatDate(d.expiration_date)}` : "No expiry date"}
                    </span>
                  </span>
                  <DocStatusBadge status={documentStatus(d.expiration_date, today)} />
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      {v.description && (
        <section className="rounded-xl border bg-background p-4">
          <h2 className="mb-2 font-semibold">About</h2>
          <p className="text-sm whitespace-pre-line">{v.description}</p>
        </section>
      )}

      {(v.menu || v.menu_file_path) && (
        <section className="rounded-xl border bg-background p-4">
          <h2 className="mb-2 font-semibold">Menu</h2>
          {v.menu && <p className="text-sm whitespace-pre-line">{v.menu}</p>}
          {v.menu_file_path && (
            <a href={publicPhotoUrl("vendor-menus", v.menu_file_path)} target="_blank" rel="noopener" className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary">
              <FileText className="size-4" /> View original menu
            </a>
          )}
        </section>
      )}

      {(socials.length > 0 || v.phone) && (
        <section className="rounded-xl border bg-background p-4 text-sm">
          <h2 className="mb-2 font-semibold">Find them online</h2>
          <ul className="space-y-1">
            {socials.map(([label, val]) => (
              <li key={label}>
                <span className="text-muted-foreground">{label}: </span>
                <a href={link(label === "Instagram" && !val.includes("instagram.com") ? `instagram.com/${val.replace(/^@/, "")}` : val)} target="_blank" rel="noopener nofollow" className="text-primary">
                  {val}
                </a>
              </li>
            ))}
            {v.phone && <li><span className="text-muted-foreground">Phone: </span>{v.phone}</li>}
          </ul>
        </section>
      )}

      <p className="text-center text-xs text-muted-foreground">
        Link expires {formatDate(app.share_expires_at!.slice(0, 10))}. To reply, answer the vendor&apos;s email.
      </p>
    </main>
  )
}
