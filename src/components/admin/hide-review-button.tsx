"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { setReviewHidden, setShopperReviewHidden } from "@/actions/admin-moderation"

/** Hide (asks for a reason, shown to the reviewer) or restore a review. */
export function HideShopperReviewButton({ id, hidden }: { id: string; hidden: boolean }) {
  return <HideReviewButton id={id} hidden={hidden} action={setShopperReviewHidden} />
}

export function HideReviewButton({
  id,
  hidden,
  action = setReviewHidden,
}: {
  id: string
  hidden: boolean
  action?: typeof setReviewHidden
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  return (
    <Button
      type="button"
      size="sm"
      variant={hidden ? "outline" : "destructive"}
      disabled={pending}
      onClick={() => {
        let reason: string | undefined
        if (!hidden) {
          const r = window.prompt("Why are you hiding this review? (The reviewer will see this.)", "Personal attack / abusive language")
          if (r === null) return
          reason = r
        }
        startTransition(async () => {
          const result = await action(id, !hidden, reason)
          if (result?.error) toast.error(result.error)
          else toast.success(result?.success)
          router.refresh()
        })
      }}
    >
      {pending ? "Working…" : hidden ? "Restore" : "Hide"}
    </Button>
  )
}
