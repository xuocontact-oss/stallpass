import Link from "next/link"
import { notFound } from "next/navigation"
import { ExternalLink, Trash2 } from "lucide-react"
import { ConfirmButton } from "@/components/confirm-button"
import { DocStatusBadge } from "@/components/doc-status-badge"
import { DocumentForm } from "@/components/document-form"
import { buttonVariants } from "@/components/ui/button"
import { deleteDocument } from "@/actions/documents"
import { requireVendor } from "@/lib/auth"
import { documentTypeLabel } from "@/lib/constants"
import { todayISO } from "@/lib/dates"
import { documentStatus } from "@/lib/documents"
import { createClient } from "@/lib/supabase/server"
import type { VendorDocument } from "@/lib/types"

export const metadata = { title: "Document" }

export default async function DocumentPage({ params }: PageProps<"/documents/[id]">) {
  const { vendor } = await requireVendor()
  const { id } = await params
  const supabase = await createClient()
  const { data } = await supabase
    .from("vendor_documents")
    .select("*")
    .eq("id", id)
    .eq("vendor_id", vendor.id)
    .maybeSingle()
  if (!data) notFound()
  const doc = data as VendorDocument

  return (
    <main className="mx-auto w-full max-w-lg space-y-5 px-4 py-6">
      <Link href="/documents" className="text-sm text-muted-foreground">
        ← Documents
      </Link>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">{documentTypeLabel(doc.doc_type)}</h1>
          {doc.title && <p className="text-muted-foreground">{doc.title}</p>}
        </div>
        <DocStatusBadge status={documentStatus(doc.expiration_date, todayISO())} className="mt-1.5" />
      </div>

      <a
        href={`/documents/${doc.id}/file`}
        target="_blank"
        rel="noopener"
        className={buttonVariants({ variant: "outline", size: "lg", className: "w-full" })}
      >
        <ExternalLink /> Open {doc.file_name}
      </a>

      <div className="rounded-xl border bg-background p-4">
        <h2 className="mb-4 font-semibold">Edit or renew</h2>
        <DocumentForm vendorId={vendor.id} document={doc} />
      </div>

      <ConfirmButton
        variant="destructive"
        className="w-full"
        action={deleteDocument.bind(null, doc.id)}
        confirmText="Delete this document and its file? This can't be undone."
        redirectTo="/documents"
      >
        <Trash2 /> Delete document
      </ConfirmButton>
    </main>
  )
}
