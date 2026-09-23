"use client"

import { useActionState, useEffect, useRef } from "react"
import { useFormStatus } from "react-dom"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import type { ActionState } from "@/lib/form"

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

  useEffect(() => {
    if (state?.success) {
      toast.success(state.success)
      if (resetOnSuccess) formRef.current?.reset()
    }
  }, [state, resetOnSuccess])

  return (
    <form ref={formRef} action={formAction} className={className}>
      {children}
      {state?.error && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {state.error}
        </p>
      )}
    </form>
  )
}

/** A submit button that shows "Working…" while the action runs. */
export function SubmitButton({
  children,
  pendingText = "Working…",
  ...props
}: React.ComponentProps<typeof Button> & { pendingText?: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending || props.disabled} {...props}>
      {pending ? pendingText : children}
    </Button>
  )
}

export const selectClassName =
  "h-10 w-full rounded-lg border border-input bg-background px-2.5 text-base md:text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
