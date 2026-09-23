import Link from "next/link"
import { ChevronRight, Plus } from "lucide-react"
import { DocStatusBadge } from "@/components/doc-status-badge"
import { buttonVariants } from "@/components/ui/button"
import { requireVendor } from "@/lib/auth"
import { commonDocTypes, DOCUMENT_TYPES, documentTypeLabel } from "@/lib/constants"
import { daysBetween, formatDate, relativeDays, todayISO } from "@/lib/dates"
import { compareByUrgency, documentStatus } from "@/lib/documents"
import { getMyDocuments } from "@/lib/vendor-data"
import { cn } from "@/lib/utils"
import { getLang, getT } from "@/lib/i18n/server"

export const metadata = { title: "Documents" }

const FILTERS = [
  { key: "", label: "All" },
  { key: "valid", label: "Valid" },
  { key: "expiring", label: "Expiring soon" },
  { key: "expired", label: "Expired" },
]

export default async function DocumentsPage({ searchParams }: PageProps<"/documents">) {
  const { vendor } = await requireVendor()
  const { status } = await searchParams
  const t = await getT()
  const lang = await getLang()
  const active = FILTERS.find((f) => f.key === status)?.key ?? ""
  const today = todayISO()
  const allDocs = (await getMyDocuments(vendor.id)).sort(compareByUrgency)
  const docs = allDocs.filter((d) => {
    if (!active) return true
    const s = documentStatus(d.expiration_date, today)
    return active === "valid" ? s === "valid" || s === "no_expiry" : s === active
  })
  const haveTypes = new Set(allDocs.map((d) => d.doc_type))
  const expected = commonDocTypes(vendor.category)
  const missing = DOCUMENT_TYPES.filter((t) => expected.includes(t.key) && !haveTypes.has(t.key))

  return (
    <main className="mx-auto w-full max-w-3xl space-y-5 px-4 py-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t("Documents")}</h1>
          <p className="text-sm text-muted-foreground">{t("Private. Only you can see these.")}</p>
        </div>
        <Link href="/documents/new" className={buttonVariants()}>
          <Plus /> {t("Add")}
        </Link>
      </div>

      {allDocs.length > 0 && (
        <nav className="-mx-4 flex gap-2 overflow-x-auto px-4" aria-label="Filter">
          {FILTERS.map((f) => (
            <Link
              key={f.key}
              href={f.key ? `/documents?status=${f.key}` : "/documents"}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1.5 text-sm",
                active === f.key ? "border-primary bg-primary text-primary-foreground" : "bg-background"
              )}
            >
              {t(f.label)}
            </Link>
          ))}
        </nav>
      )}

      {allDocs.length > 0 && docs.length === 0 ? (
        <p className="rounded-xl border bg-background p-4 text-sm text-muted-foreground">{t("No documents with that status.")}</p>
      ) : docs.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-background p-6 text-center">
          <p className="font-medium">{t("No documents yet")}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("Snap a photo of your health permit to get started. We'll remind you before it expires.")}
          </p>
          <Link href="/documents/new" className={buttonVariants({ size: "lg", className: "mt-4" })}>
            <Plus /> {t("Add your first document")}
          </Link>
        </div>
      ) : (
        <ul className="divide-y rounded-xl border bg-background">
          {docs.map((d) => {
            const status = documentStatus(d.expiration_date, today)
            const days = d.expiration_date ? daysBetween(today, d.expiration_date) : null
            return (
              <li key={d.id}>
                <Link href={`/documents/${d.id}`} className="flex items-center gap-3 p-4 hover:bg-muted/40">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{t(documentTypeLabel(d.doc_type))}</div>
                    {d.title && <div className="truncate text-sm">{d.title}</div>}
                    <div className="text-sm text-muted-foreground">
                      {d.expiration_date
                        ? `${days! < 0 ? t("Expired") : t("Expires")} ${formatDate(d.expiration_date, { lang })} (${relativeDays(days!, lang)})`
                        : t("No expiration date")}
                    </div>
                  </div>
                  <DocStatusBadge status={status} />
                  <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            )
          })}
        </ul>
      )}

      {missing.length > 0 && allDocs.length > 0 && !active && (
        <div className="rounded-xl border border-dashed bg-background p-4">
          <p className="text-sm font-medium">{t("Commonly required, not added yet:")}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {missing.map((m) => (
              <Link
                key={m.key}
                href={`/documents/new?type=${m.key}`}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                <Plus /> {t(m.label)}
              </Link>
            ))}
          </div>
        </div>
      )}
    </main>
  )
}
