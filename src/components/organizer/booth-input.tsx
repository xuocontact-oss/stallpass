"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { setBooth } from "@/actions/organizer"

/** A small "Booth: [A12] Save" box. */
export function BoothInput({ appId, value }: { appId: string; value: string | null }) {
  const router = useRouter()
  const [booth, setBoothValue] = useState(value ?? "")
  const [pending, startTransition] = useTransition()
  const changed = booth.trim() !== (value ?? "")
  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        startTransition(async () => {
          const result = await setBooth(appId, booth)
          if (result?.error) toast.error(result.error)
          else {
            toast.success(result?.success)
            router.refresh()
          }
        })
      }}
    >
      <Input
        aria-label="Booth number"
        value={booth}
        onChange={(e) => setBoothValue(e.target.value)}
        maxLength={20}
        placeholder="Booth #"
        className="h-9 w-24"
      />
      {changed && (
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "…" : "Save"}
        </Button>
      )}
    </form>
  )
}
