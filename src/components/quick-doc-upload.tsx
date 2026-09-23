"use client"

import { useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { CheckCircle2, FileUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { uploadFile } from "@/components/upload"
import { saveDocument } from "@/actions/documents"
import { MAX_DOCUMENT_BYTES } from "@/lib/constants"
import { formatDate } from "@/lib/dates"
import { useT } from "@/lib/i18n/client"

/**
 * One document slot in the setup: "Health permit: [take photo / choose file]
 * [expires on] [Save]", or a tick once it's uploaded.
 */
export function QuickDocUpload({
  vendorId,
  docType,
  label,
  hint,
  uploaded,
}: {
  vendorId: string
  docType: string
  label: string
  hint?: string
  uploaded: { file_name: string; expiration_date: string | null } | null
}) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [expires, setExpires] = useState("")
  const [noExpiry, setNoExpiry] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [replacing, setReplacing] = useState(false)
  const { t, lang } = useT()

  if (uploaded && !replacing) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3">
        <CheckCircle2 className="size-6 shrink-0 text-emerald-600" aria-hidden />
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-medium">{label}</p>
          <p className="truncate text-muted-foreground">
            {uploaded.file_name}
            {uploaded.expiration_date ? ` · ${t("expires")} ${formatDate(uploaded.expiration_date, { lang })}` : ""}
          </p>
        </div>
        <button type="button" onClick={() => setReplacing(true)} className="text-sm font-medium text-primary">
          {t("Add another")}
        </button>
      </div>
    )
  }

  function save() {
    setError(null)
    const file = fileRef.current?.files?.[0]
    if (!file) return setError(t("Take a photo or choose a file first."))
    if (!expires && !noExpiry) return setError(t("Add the expiration date, or tick “Doesn't expire”."))
    startTransition(async () => {
      const up = await uploadFile("vendor-documents", vendorId, file, MAX_DOCUMENT_BYTES, "document")
      if ("error" in up) return setError(t(up.error))
      const result = await saveDocument({
        doc_type: docType as never,
        title: null,
        issue_date: null,
        expiration_date: noExpiry ? null : expires,
        notes: null,
        file: { path: up.path, name: file.name.slice(0, 200) },
      })
      if (result?.error) return setError(t(result.error))
      toast.success(t("{doc} saved.", { doc: label }))
      setReplacing(false)
      setFileName(null)
      setExpires("")
      router.refresh()
    })
  }

  return (
    <div className="space-y-3 rounded-xl border bg-background p-3">
      <div>
        <p className="font-medium">{label}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed p-3 hover:border-primary">
        <FileUp className="size-5 shrink-0 text-primary" aria-hidden />
        <span className="min-w-0 truncate text-sm">{fileName ?? t("Take a photo or choose a file (PDF, JPG, PNG)")}</span>
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp,image/heic"
          className="sr-only"
          onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
        />
      </label>
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor={`exp-${docType}`} className="text-xs">
            {t("Expires on")}
          </Label>
          <Input
            id={`exp-${docType}`}
            type="date"
            value={expires}
            disabled={noExpiry}
            onChange={(e) => setExpires(e.target.value)}
            className="h-9 w-40"
          />
        </div>
        <label className="flex h-9 items-center gap-2 text-sm">
          <input type="checkbox" checked={noExpiry} onChange={(e) => setNoExpiry(e.target.checked)} className="size-4 accent-primary" />
          {t("Doesn't expire")}
        </label>
        <Button type="button" size="sm" className="ml-auto h-9" onClick={save} disabled={pending}>
          {pending ? t("Uploading…") : t("Save")}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {replacing && (
        <button type="button" onClick={() => setReplacing(false)} className="text-xs text-muted-foreground">
          {t("Cancel")}
        </button>
      )}
    </div>
  )
}
