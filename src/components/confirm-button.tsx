"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import type { ActionState } from "@/lib/form"
import { useT } from "@/lib/i18n/client"

/** A button that asks "are you sure?" and then runs a server action. */
export function ConfirmButton({
  action,
  confirmText,
  redirectTo,
  children,
  ...props
}: Omit<React.ComponentProps<typeof Button>, "action"> & {
  action: () => Promise<ActionState>
  confirmText: string
  redirectTo?: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const { t } = useT()
  return (
    <Button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!window.confirm(confirmText)) return
        startTransition(async () => {
          const result = await action()
          if (result?.error) toast.error(t(result.error))
          else {
            if (result?.success) toast.success(t(result.success))
            if (redirectTo) router.push(redirectTo)
            else router.refresh()
          }
        })
      }}
      {...props}
    >
      {pending ? t("Working…") : children}
    </Button>
  )
}
