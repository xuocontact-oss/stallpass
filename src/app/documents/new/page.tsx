import Link from "next/link"
import { DocumentForm } from "@/components/document-form"
import { requireVendor } from "@/lib/auth"
import { DOCUMENT_TYPES } from "@/lib/constants"

export const metadata = { title: "Add a document" }

export default async function NewDocumentPage({ searchParams }: PageProps<"/documents/new">) {
  const { vendor } = await requireVendor()
  const { type } = await searchParams
  const defaultType = DOCUMENT_TYPES.find((t) => t.key === type)?.key

  return (
    <main className="mx-auto w-full max-w-lg space-y-5 px-4 py-6">
      <Link href="/documents" className="text-sm text-muted-foreground">
        ← Documents
      </Link>
      <h1 className="text-2xl font-bold">Add a document</h1>
      <div className="rounded-xl border bg-background p-4">
        <DocumentForm vendorId={vendor.id} defaultType={defaultType} />
      </div>
    </main>
  )
}
