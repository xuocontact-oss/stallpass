import Link from "next/link"
import { ExternalLink } from "lucide-react"
import { DocStatusBadge } from "@/components/doc-status-badge"
import { requireAdmin } from "@/lib/auth"
import { documentTypeLabel } from "@/lib/constants"
import { formatDate, todayISO } from "@/lib/dates"
import { documentStatus, type DocStatus } from "@/lib/documents"
import { throwIfError } from "@/lib/form"
import { createClient } from "@/lib/supabase/server"
import { cn } from "@/lib/utils"

export const metadata = { title: "Documents · Admin" }

const FILTERS: { key: string; label: string }[] = [
  { key: "", label: "All" },
  { key: "expiring", label: "Expiring soon" },
  { key: "expired", label: "Expired" },
]

export default async function AdminDocumentsPage({ searchParams }: PageProps<"/admin/documents">) {
  await requireAdmin()
  const { status } = await searchParams
  const today = todayISO()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("vendor_documents")
    .select("id, doc_type, title, expiration_date, vendors(id, business_name)")
    .order("expiration_date", { ascending: true, nullsFirst: false })
    .limit(500)
  throwIfError(error, "documents")
  const rows = ((data ?? []) as unknown as {
    id: string
    doc_type: string
    title: string | null
    expiration_date: string | null
    vendors: { id: string; business_name: string } | null
  }[])
    .map((d) => ({ ...d, status: documentStatus(d.expiration_date, today) as DocStatus }))
    .filter((d) => !status || d.status === status)

  return (
    <main className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Documents</h1>
        <div className="flex gap-3 text-sm">
          {FILTERS.map((f) => (
            <Link key={f.key} href={f.key ? `/admin/documents?status=${f.key}` : "/admin/documents"} className={cn((status ?? "") === f.key && "font-semibold text-primary")}>
              {f.label}
            </Link>
          ))}
        </div>
      </div>
      <ul className="divide-y rounded-xl border bg-background">
        {rows.map((d) => (
          <li key={d.id} className="flex items-center gap-3 p-4">
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                {documentTypeLabel(d.doc_type)}
                {d.title && <span className="font-normal text-muted-foreground"> · {d.title}</span>}
              </p>
              <p className="text-sm text-muted-foreground">
                <Link href={`/admin/vendors/${d.vendors?.id}`} className="text-primary hover:underline">{d.vendors?.business_name}</Link>
                {" · "}
                {d.expiration_date ? `expires ${formatDate(d.expiration_date)}` : "no expiry"}
              </p>
            </div>
            <DocStatusBadge status={d.status} />
            <a href={`/documents/${d.id}/file`} target="_blank" rel="noopener" aria-label="Open file" className="text-muted-foreground hover:text-primary">
              <ExternalLink className="size-4" />
            </a>
          </li>
        ))}
        {rows.length === 0 && <li className="p-4 text-sm text-muted-foreground">No documents.</li>}
      </ul>
    </main>
  )
}
