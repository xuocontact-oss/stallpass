"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { MailCheck } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { sendVerifyCode, verifyEmailCode } from "@/actions/auth"
import { useT } from "@/lib/i18n/client"

/** "Verify your email": emails a 6-digit code and checks it, right here. */
export function VerifyEmailBox({ email, reason }: { email: string; reason?: string }) {
  const [sent, setSent] = useState(false)
  const [code, setCode] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const router = useRouter()
  const { t } = useT()

  function send() {
    setError(null)
    startTransition(async () => {
      const r = await sendVerifyCode()
      if (r?.error) return setError(t(r.error))
      setSent(true)
    })
  }

  function verify(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const r = await verifyEmailCode(code)
      if (r?.error) return setError(t(r.error))
      toast.success(t("Email verified. Thanks!"))
      router.refresh()
    })
  }

  return (
    <section className="space-y-3 rounded-xl border-2 border-amber-300 bg-amber-50 p-4 text-amber-950">
      <p className="flex items-center gap-2 font-semibold">
        <MailCheck className="size-5" aria-hidden /> {t("Verify your email")}
      </p>
      <p className="text-sm">{t(reason ?? "Confirm your email so markets can reply to you. It takes 30 seconds.")}</p>
      {!sent ? (
        <Button type="button" onClick={send} disabled={pending} className="w-full sm:w-auto">
          {pending ? t("Sending…") : t("Email me a code at {email}", { email })}
        </Button>
      ) : (
        <form onSubmit={verify} className="space-y-2">
          <p className="text-sm">{t("We emailed a 6-digit code to {email}.", { email })}</p>
          <div className="flex gap-2">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 10))}
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              placeholder="123456"
              aria-label={t("6-digit code")}
              className="h-11 bg-white text-lg tracking-[0.3em]"
            />
            <Button type="submit" className="h-11" disabled={pending || code.length < 6}>
              {pending ? t("Checking…") : t("Verify")}
            </Button>
          </div>
          <button type="button" onClick={send} disabled={pending} className="text-sm font-medium underline">
            {t("Send a new code")}
          </button>
        </form>
      )}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </section>
  )
}
