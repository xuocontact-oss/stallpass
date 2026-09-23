import Link from "next/link"
import { notFound } from "next/navigation"
import { Droplets, FileText, Plug } from "lucide-react"
import { ActionButton } from "@/components/action-button"
import { ApplicationStatusBadge } from "@/components/application-status-badge"
import { BoothInput } from "@/components/organizer/booth-input"
import { DecisionPanel } from "@/components/organizer/decision-panel"
import { ReadinessList } from "@/components/readiness-list"
import { confirmExternalPayment } from "@/actions/payments"
import { requireOrganizedMarket } from "@/lib/auth"
import { categoryLabel, documentTypeLabel, setupTypeLabel } from "@/lib/constants"
import { formatDate, todayISO } from "@/lib/dates"
import { formatMoney } from "@/lib/markets"
import { checkReadiness } from "@/lib/readiness"
import { publicPhotoUrl } from "@/lib/storage"
import { createClient } from "@/lib/supabase/server"
import type { Application, ApplicationDocument, Payment, Vendor } from "@/lib/types"

export default async function OrganizerApplicationPage({ params }: PageProps<"/organizer/markets/[id]/applications/[appId]">) {
  const { id, appId } = await params
  const market = await requireOrganizedMarket(id)
  const supabase = await createClient()
  const { data } = await supabase
    .from("applications")
    .select("*")
    .eq("id", appId)
    .eq("market_id", market.id)
    .neq("status", "draft")
    .maybeSingle()
  if (!data) notFound()
  const app = data as Application

  const [{ data: vendorRow }, { data: docs }, { data: photos }, { data: payments }] = await Promise.all([
    supabase.from("vendors").select("*").eq("id", app.vendor_id).single(),
    supabase.from("application_documents").select("*").eq("application_id", app.id).order("doc_type"),
    supabase.from("vendor_photos").select("id, path").eq("vendor_id", app.vendor_id).order("position"),
    supabase.from("payments").select("*").eq("application_id", app.id).order("created_at", { ascending: false }),
  ])
  const pays = (payments ?? []) as Payment[]
  const reported = pays.find((p) => p.status === "reported")
  const done = pays.find((p) => ["paid", "confirmed"].includes(p.status))
  if (!vendorRow) notFound()
  const vendor = vendorRow as Vendor
  const attached = (docs ?? []) as ApplicationDocument[]
  const readiness = checkReadiness(
    market.required_doc_types,
    attached.map((d) => ({ id: d.id, doc_type: d.doc_type, title: d.title, expiration_date: d.expiration_date })),
    app.event_dates,
    todayISO()
  )

  return (
    <main className="space-y-5">
      <Link href={`/organizer/markets/${id}/applications`} className="text-sm text-muted-foreground">← Applications</Link>

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-bold">{vendor.business_name}</h2>
          <p className="text-sm text-muted-foreground">{categoryLabel(vendor.category)}</p>
        </div>
        <ApplicationStatusBadge status={app.status} className="mt-1" />
      </div>

      {(photos ?? []).length > 0 && (
        <div className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4">
          {photos!.map((p) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img loading="lazy" decoding="async" key={p.id} src={publicPhotoUrl("vendor-photos", p.path)} alt="" className="h-40 w-[60%] shrink-0 snap-start rounded-xl object-cover sm:w-[35%]" />
          ))}
        </div>
      )}

      <section className="space-y-1.5 rounded-xl border bg-background p-4 text-sm">
        <p><span className="text-muted-foreground">Dates: </span>{app.event_dates.map((d) => formatDate(d, { weekday: true })).join(", ")}</p>
        {app.booth_choice && <p><span className="text-muted-foreground">Booth type: </span>{app.booth_choice}</p>}
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span><span className="text-muted-foreground">Setup: </span>{setupTypeLabel(vendor.setup_type)}</span>
          {vendor.needs_power && <span className="flex items-center gap-1"><Plug className="size-4" /> Needs power</span>}
          {vendor.needs_water && <span className="flex items-center gap-1"><Droplets className="size-4" /> Needs water</span>}
        </p>
        {vendor.setup_notes && <p className="text-muted-foreground">{vendor.setup_notes}</p>}
        {app.note && <p className="rounded-lg bg-muted/60 p-3 whitespace-pre-line"><span className="font-medium">Note: </span>{app.note}</p>}
      </section>

      <section className="space-y-3 rounded-xl border bg-background p-4">
        <h3 className="font-semibold">{readiness.ready ? "Documents: all good ✓" : "Documents check"}</h3>
        {market.required_doc_types.length > 0 ? (
          <ReadinessList items={readiness.items} />
        ) : (
          <p className="text-sm text-muted-foreground">Your market doesn&apos;t require specific documents.</p>
        )}
        {attached.length > 0 && (
          <ul className="space-y-1.5 border-t pt-3">
            {attached.map((d) => (
              <li key={d.id}>
                <a href={`/applications/${app.id}/documents/${d.id}`} target="_blank" rel="noopener" className="flex items-center gap-2 text-sm text-primary hover:underline">
                  <FileText className="size-4" aria-hidden />
                  Open {documentTypeLabel(d.doc_type)}
                  {d.expiration_date && <span className="text-muted-foreground">· valid until {formatDate(d.expiration_date)}</span>}
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3 rounded-xl border-2 border-primary/30 bg-background p-4">
        <h3 className="font-semibold">Your decision</h3>
        <DecisionPanel appId={app.id} status={app.status} />
        {["accepted", "paid"].includes(app.status) && (
          <div className="flex items-center gap-3 border-t pt-3 text-sm">
            <span className="font-medium">Booth number</span>
            <BoothInput appId={app.id} value={app.booth_number} />
          </div>
        )}
        {app.organizer_note && <p className="text-xs text-muted-foreground">Last message you sent: &ldquo;{app.organizer_note}&rdquo;</p>}
      </section>

      {["accepted", "paid"].includes(app.status) && (
        <section className="space-y-2 rounded-xl border bg-background p-4 text-sm">
          <h3 className="font-semibold">Booth fee</h3>
          {done ? (
            <p className="text-emerald-800">
              Paid{done.amount_cents != null && ` ${formatMoney(done.amount_cents)}`}{" "}
              {done.method === "stripe" ? "by card through Stallpass" : "on your payment page (you confirmed it)"}
              {done.paid_at && ` · ${formatDate(done.paid_at.slice(0, 10))}`}
            </p>
          ) : reported ? (
            <>
              <p>The vendor says they paid on your payment page. Did you receive it?</p>
              <div className="flex gap-2">
                <ActionButton size="sm" action={confirmExternalPayment.bind(null, reported.id, true)}>Yes, received</ActionButton>
                <ActionButton size="sm" variant="outline" action={confirmExternalPayment.bind(null, reported.id, false)}>
                  Not received
                </ActionButton>
              </div>
            </>
          ) : (
            <p className="text-muted-foreground">
              Not paid yet.{" "}
              {market.payment_method === "none" && (
                <Link href={`/organizer/markets/${id}/edit`} className="text-primary">Set up how vendors pay</Link>
              )}
            </p>
          )}
        </section>
      )}

      {vendor.description && (
        <section className="rounded-xl border bg-background p-4">
          <h3 className="mb-2 font-semibold">About</h3>
          <p className="text-sm whitespace-pre-line">{vendor.description}</p>
        </section>
      )}
      {(vendor.menu || vendor.menu_file_path) && (
        <section className="rounded-xl border bg-background p-4">
          <h3 className="mb-2 font-semibold">Menu</h3>
          {vendor.menu && <p className="text-sm whitespace-pre-line">{vendor.menu}</p>}
          {vendor.menu_file_path && (
            <a href={publicPhotoUrl("vendor-menus", vendor.menu_file_path)} target="_blank" rel="noopener" className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary">
              <FileText className="size-4" /> View original menu
            </a>
          )}
        </section>
      )}
      {[vendor.instagram, vendor.website, vendor.tiktok, vendor.facebook, vendor.phone].some(Boolean) && (
        <section className="rounded-xl border bg-background p-4 text-sm">
          <h3 className="mb-2 font-semibold">Contact & online</h3>
          <ul className="space-y-1 text-muted-foreground">
            {vendor.instagram && <li>Instagram: {vendor.instagram}</li>}
            {vendor.tiktok && <li>TikTok: {vendor.tiktok}</li>}
            {vendor.facebook && <li>Facebook: {vendor.facebook}</li>}
            {vendor.website && <li>Website: {vendor.website}</li>}
            {vendor.phone && <li>Phone: {vendor.phone}</li>}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">Decision emails come from Stallpass; vendors can reply straight to you.</p>
        </section>
      )}
    </main>
  )
}
