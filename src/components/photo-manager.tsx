"use client"

import { useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ImagePlus, X } from "lucide-react"
import { uploadFile } from "@/components/upload"
import { MAX_PHOTO_BYTES } from "@/lib/constants"
import type { ActionState } from "@/lib/form"

/** A grid of photos with "add" and "remove". Used for vendors and markets. */
export function PhotoManager({
  bucket,
  folder,
  photos,
  max,
  onAdd,
  onRemove,
}: {
  bucket: "vendor-photos" | "market-photos"
  folder: string
  photos: { id: string; url: string }[]
  max: number
  onAdd: (path: string) => Promise<ActionState>
  onRemove: (id: string) => Promise<ActionState>
}) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [pending, startTransition] = useTransition()
  const [busyId, setBusyId] = useState<string | null>(null)

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).slice(0, Math.max(0, max - photos.length))
    e.target.value = ""
    if (files.length === 0) return
    startTransition(async () => {
      for (const file of files) {
        const up = await uploadFile(bucket, folder, file, MAX_PHOTO_BYTES, "photo")
        if ("error" in up) {
          toast.error(up.error)
          continue
        }
        const result = await onAdd(up.path)
        if (result?.error) toast.error(result.error)
      }
      router.refresh()
    })
  }

  function remove(id: string) {
    setBusyId(id)
    startTransition(async () => {
      const result = await onRemove(id)
      if (result?.error) toast.error(result.error)
      setBusyId(null)
      router.refresh()
    })
  }

  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {photos.map((p) => (
        <div key={p.id} className="relative aspect-square overflow-hidden rounded-lg bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img loading="lazy" decoding="async" src={p.url} alt="" className="size-full object-cover" />
          <button
            type="button"
            onClick={() => remove(p.id)}
            disabled={pending}
            aria-label="Remove photo"
            className="absolute top-1 right-1 grid size-8 place-items-center rounded-full bg-black/60 text-white disabled:opacity-50"
          >
            {busyId === p.id ? "…" : <X className="size-4" />}
          </button>
        </div>
      ))}
      {photos.length < max && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={pending}
          className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-dashed bg-background text-sm text-muted-foreground hover:border-primary disabled:opacity-50"
        >
          <ImagePlus className="size-6" aria-hidden />
          {pending && !busyId ? "Uploading…" : "Add photo"}
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="sr-only"
        onChange={onPick}
      />
    </div>
  )
}
