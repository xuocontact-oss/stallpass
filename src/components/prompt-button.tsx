"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import type { ActionState } from "@/lib/form"

/** A button that asks for a short reason, then runs a server action with it. */
export function PromptButton({
  action,
  question,
  defaultReason = "",
  children,
  ...props
}: Omit<React.ComponentProps<typeof Button>, "action"> & {
  action: (reason: string) => Promise<ActionState>
  question: string
  defaultReason?: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  return (
    <Button
      type="button"
      disabled={pending}
      onClick={() => {
        const reason = window.prompt(question, defaultReason)
        if (reason === null) return
        startTransition(async () => {
          const result = await action(reason)
          if (result?.error) toast.error(result.error)
          else toast.success(result?.success)
          router.refresh()
        })
      }}
      {...props}
    >
      {pending ? "Working…" : children}
    </Button>
  )
}
