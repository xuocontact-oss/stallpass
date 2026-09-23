"use client"

import { useActionState, useEffect, useRef } from "react"
import { useFormStatus } from "react-dom"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import type { ActionState } from "@/lib/form"
import { useT } from "@/lib/i18n/client"

type Action = (state: ActionState, formData: FormData) => Promise<ActionState>

/**
 * A form that runs a server action and shows its result.
 * Errors appear under the form; successes appear as a small pop-up.
 */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess = false,
}: {
  action: Action
  children: React.ReactNode
  className?: string
  resetOnSuccess?: boolean
}) {
  const [state, formAction] = useActionState(action, null)
  const formRef = useRef<HTMLFormElement>(null)
  const { t } = useT()

  useEffect(() => {
    if (state?.success) {
      toast.success(t(state.success))
      if (resetOnSuccess) formRef.current?.reset()
    }
  }, [state, resetOnSuccess, t])

  return (
    <form ref={formRef} action={formAction} className={className}>
      {children}
      {state?.error && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {t(state.error)}
        </p>
      )}
    </form>
  )
}

/** A submit button that shows "Working…" while the action runs. */
export function SubmitButton({
  children,
  pendingText,
  ...props
}: React.ComponentProps<typeof Button> & { pendingText?: string }) {
  const { pending } = useFormStatus()
  const { t } = useT()
  return (
    <Button type="submit" disabled={pending || props.disabled} {...props}>
      {pending ? (pendingText ?? t("Working…")) : children}
    </Button>
  )
}

export const selectClassName =
  "h-10 w-full rounded-lg border border-input bg-background px-2.5 text-base md:text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
