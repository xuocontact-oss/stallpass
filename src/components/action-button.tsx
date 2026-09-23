"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import type { ActionState } from "@/lib/form"
import { useT } from "@/lib/i18n/client"

/** A button that runs a server action and shows the result (no "are you sure?"). */
export function ActionButton({
  action,
  children,
  pendingText,
  ...props
}: Omit<React.ComponentProps<typeof Button>, "action"> & {
  action: () => Promise<ActionState>
  pendingText?: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const { t } = useT()
  return (
    <Button
      type="button"
      disabled={pending || props.disabled}
      onClick={() =>
        startTransition(async () => {
          const result = await action()
          if (result?.error) toast.error(t(result.error))
          else if (result?.success) toast.success(t(result.success))
          router.refresh()
        })
      }
      {...props}
    >
      {pending ? (pendingText ?? t("Working…")) : children}
    </Button>
  )
}
