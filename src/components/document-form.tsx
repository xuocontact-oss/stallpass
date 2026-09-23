"use client"

import { useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { FileUp } from "lucide-react"
import { selectClassName } from "@/components/action-form"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { uploadFile } from "@/components/upload"
import { saveDocument } from "@/actions/documents"
import { DOCUMENT_TYPES, MAX_DOCUMENT_BYTES } from "@/lib/constants"
import type { VendorDocument } from "@/lib/types"

/** Add or edit a document. The file goes straight from the phone to private storage. */
export function DocumentForm({
  vendorId,
  document,
  defaultType,
}: {
  vendorId: string
  document?: VendorDocument
  defaultType?: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [docType, setDocType] = useState(document?.doc_type ?? defaultType ?? "")
  const [fileName, setFileName] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const form = new FormData(e.currentTarget)
    const file = fileRef.current?.files?.[0]
    const text = (name: string) => {
      const v = form.get(name)
      return typeof v === "string" && v.trim() ? v.trim() : null
    }

    startTransition(async () => {
      if (!document && !file) {
        setError("Choose a file to upload (a PDF or a photo of the document).")
        return
      }
      let uploaded: { path: string; name: string } | null = null
      if (file) {
        const up = await uploadFile("vendor-documents", vendorId, file, MAX_DOCUMENT_BYTES)
        if ("error" in up) {
          setError(up.error)
          return
        }
        uploaded = { path: up.path, name: file.name.slice(0, 200) }
      }

      const result = await saveDocument({
        id: document?.id,
        doc_type: docType as never,
        title: text("title"),
        issue_date: text("issue_date"),
        expiration_date: text("expiration_date"),
        notes: text("notes"),
        file: uploaded,
      })
      if (result?.error) {
        setError(result.error)
        return
      }
      toast.success(result?.success ?? "Saved.")
      if (document) {
        setFileName(null)
        if (fileRef.current) fileRef.current.value = ""
        router.refresh()
      } else {
        router.push("/documents")
      }
    })
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="doc_type">What is it?</Label>
        <select
          id="doc_type"
          name="doc_type"
          required
          value={docType}
          onChange={(e) => setDocType(e.target.value)}
          className={selectClassName}
        >
          <option value="" disabled>
            Choose a type…
          </option>
          {DOCUMENT_TYPES.map((t) => (
            <option key={t.key} value={t.key}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="title">
          Name {docType !== "other" && <span className="font-normal text-muted-foreground">(optional)</span>}
        </Label>
        <Input
          id="title"
          name="title"
          maxLength={100}
          defaultValue={document?.title ?? ""}
          required={docType === "other"}
          placeholder={docType === "other" ? "e.g. Fire inspection" : "e.g. LA County permit #12345"}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="file">{document ? "Replace the file" : "File"}</Label>
        <label
          htmlFor="file"
          className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed bg-background p-4 hover:border-primary"
        >
          <FileUp className="size-6 shrink-0 text-primary" aria-hidden />
          <span className="min-w-0 text-sm">
            <span className="block truncate font-medium">
              {fileName ?? (document ? document.file_name : "Take a photo or choose a file")}
            </span>
            <span className="text-muted-foreground">PDF, JPG or PNG, up to 10 MB</span>
          </span>
        </label>
        <input
          ref={fileRef}
          id="file"
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp,image/heic"
          className="sr-only"
          onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="issue_date">Issue date</Label>
          <Input id="issue_date" name="issue_date" type="date" defaultValue={document?.issue_date ?? ""} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="expiration_date">Expiration date</Label>
          <Input
            id="expiration_date"
            name="expiration_date"
            type="date"
            defaultValue={document?.expiration_date ?? ""}
          />
        </div>
      </div>
      <p className="-mt-3 text-xs text-muted-foreground">
        Add the expiration date so we can remind you before it runs out.
      </p>

      <div className="space-y-1.5">
        <Label htmlFor="notes">
          Notes <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Textarea id="notes" name="notes" rows={2} maxLength={500} defaultValue={document?.notes ?? ""} />
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Saving…" : document ? "Save changes" : "Add document"}
      </Button>
    </form>
  )
}
