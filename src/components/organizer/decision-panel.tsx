"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { decideApplication } from "@/actions/organizer"

/** Accept / waitlist / decline, with an optional message to the vendor. */
export function DecisionPanel({ appId, status }: { appId: string; status: string }) {
  const router = useRouter()
  const [message, setMessage] = useState("")
  const [notify, setNotify] = useState(true)
  const [pending, startTransition] = useTransition()
  const locked = status === "paid" || status === "cancelled"

  function decide(next: "accepted" | "waitlisted" | "declined") {
    if (next === "declined" && !window.confirm("Decline this vendor?")) return
    startTransition(async () => {
      const result = await decideApplication(appId, next, message, notify)
      if (result?.error) toast.error(result.error)
      else {
        toast.success(result?.success)
        setMessage("")
        router.refresh()
      }
    })
  }

  if (locked) {
    return (
      <p className="text-sm text-muted-foreground">
        This application is {status === "paid" ? "paid" : "cancelled by the vendor"}, so it can&apos;t be changed.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="decision-message">Message to the vendor (optional)</Label>
        <Textarea
          id="decision-message"
          rows={2}
          maxLength={1000}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="e.g. Load-in starts at 3pm from the 4th Pl entrance."
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} className="size-4 accent-primary" />
        Email the vendor about my decision
      </label>
      <div className="grid grid-cols-3 gap-2">
        <Button type="button" disabled={pending || status === "accepted"} onClick={() => decide("accepted")}>
          Accept
        </Button>
        <Button type="button" variant="outline" disabled={pending || status === "waitlisted"} onClick={() => decide("waitlisted")}>
          Waitlist
        </Button>
        <Button type="button" variant="destructive" disabled={pending || status === "declined"} onClick={() => decide("declined")}>
          Decline
        </Button>
      </div>
    </div>
  )
}
