"use client"

import { useRef, useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Turnstile } from "@/components/turnstile"
import { sendSignInCode, verifySignInCode } from "@/actions/auth"
import { useT } from "@/lib/i18n/client"

/**
 * Sign in with a 6-digit code ("Forgot password?"): type your email, then the
 * code from the email, all on one screen. The email also has a tap-to-sign-in
 * link as a backup.
 */
export function CodeSignIn({
  next,
  market,
  refCode,
  defaultEmail = "",
  buttonLabel,
  large = false,
}: {
  next: string
  market?: string | null
  refCode?: string | null
  defaultEmail?: string
  buttonLabel?: string
  large?: boolean
}) {
  const [stage, setStage] = useState<"email" | "code">("email")
  const [email, setEmail] = useState(defaultEmail)
  const [code, setCode] = useState("")
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)
  const { t } = useT()

  function send(e?: React.FormEvent) {
    e?.preventDefault()
    setError(null)
    const captchaToken = formRef.current
      ? (new FormData(formRef.current).get("cf-turnstile-response") as string | null)
      : null
    startTransition(async () => {
      const r = await sendSignInCode({ email, next, market, ref: refCode, captchaToken })
      if (r?.error) return setError(t(r.error))
      setMessage(r?.email ? t("We emailed a 6-digit code to {email}.", { email: r.email }) : null)
      setStage("code")
    })
  }

  function verify(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const r = await verifySignInCode({ email, code, next, market, ref: refCode })
      if (r?.error) setError(t(r.error))
    })
  }

  const size = large ? "h-12 text-lg" : ""

  if (stage === "code") {
    return (
      <form onSubmit={verify} className="space-y-3">
        <p className="text-sm">{message}</p>
        <div className="space-y-1.5">
          <Label htmlFor="code">{t("6-digit code")}</Label>
          <Input
            id="code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 10))}
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            placeholder="123456"
            className={`${size} tracking-[0.3em]`}
          />
          <p className="text-xs text-muted-foreground">{t("On iPhone, the code often appears above the keyboard. Tap it.")}</p>
        </div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button type="submit" size="lg" className="w-full" disabled={pending || code.length < 6}>
          {pending ? t("Checking…") : t("Continue")}
        </Button>
        <div className="flex justify-between text-sm">
          <button type="button" className="text-muted-foreground" onClick={() => { setStage("email"); setCode("") }}>
            {t("Change email")}
          </button>
          <button type="button" className="font-medium text-primary" disabled={pending} onClick={() => send()}>
            {t("Send a new code")}
          </button>
        </div>
      </form>
    )
  }

  return (
    <form ref={formRef} onSubmit={send} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="email">{t("Email")}</Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          inputMode="email"
          placeholder="you@example.com"
          className={size}
        />
      </div>
      <Turnstile />
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? t("Sending…") : (buttonLabel ?? t("Email me a code"))}
      </Button>
    </form>
  )
}
