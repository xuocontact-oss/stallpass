"use client"

import { useRef, useState, useTransition } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PasswordInput } from "@/components/password-input"
import { Turnstile } from "@/components/turnstile"
import { signUpWithPassword, verifySignInCode } from "@/actions/auth"
import { useT } from "@/lib/i18n/client"

const looksLikeEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s.trim())

/**
 * Create an account: email + password, and you're in. Email is verified later
 * (before applying). Built for a phone at a market booth: big boxes, the email
 * echoed back large so typos get caught.
 */
export function SignUpForm({
  next,
  market,
  refCode,
  buttonLabel,
  large = false,
}: {
  next: string
  market?: string | null
  refCode?: string | null
  buttonLabel?: string
  large?: boolean
}) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [code, setCode] = useState("")
  const [stage, setStage] = useState<"form" | "code">("form")
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [exists, setExists] = useState(false)
  const [pending, startTransition] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)
  const { t } = useT()
  const size = large ? "h-12 text-lg" : ""

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setExists(false)
    const captchaToken = formRef.current ? (new FormData(formRef.current).get("cf-turnstile-response") as string | null) : null
    startTransition(async () => {
      const r = await signUpWithPassword({ email, password, next, market, ref: refCode, captchaToken })
      if (r?.error) {
        setError(t(r.error))
        setExists(Boolean(r.exists))
        return
      }
      if (r?.needsCode) {
        setMessage(t("We emailed a 6-digit code to {email}.", { email: email.trim().toLowerCase() }))
        setStage("code")
      }
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
        </div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button type="submit" size="lg" className="w-full" disabled={pending || code.length < 6}>
          {pending ? t("Checking…") : t("Continue")}
        </Button>
      </form>
    )
  }

  return (
    <form ref={formRef} onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="su-email">{t("Email")}</Label>
        <Input
          id="su-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          inputMode="email"
          autoCapitalize="none"
          placeholder="you@example.com"
          className={size}
        />
        {looksLikeEmail(email) && (
          <p className="rounded-lg bg-secondary px-3 py-2 text-sm">
            {t("Is this right?")} <span className="block text-base font-semibold break-all">{email.trim().toLowerCase()}</span>
          </p>
        )}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="su-password">{t("Create a password")}</Label>
        <PasswordInput
          id="su-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          maxLength={72}
          autoComplete="new-password"
          className={size}
        />
        <p className="text-xs text-muted-foreground">{t("At least 8 characters.")}</p>
      </div>
      <Turnstile />
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}{" "}
          {exists && (
            <Link href={`/login?mode=signin&next=${encodeURIComponent(next)}&email=${encodeURIComponent(email.trim())}`} className="font-medium underline">
              {t("Sign in")}
            </Link>
          )}
        </p>
      )}
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? t("Creating your account…") : (buttonLabel ?? t("Create account"))}
      </Button>
      <p className="text-xs text-muted-foreground">
        {t("By continuing you agree to our")} <Link href="/terms" className="underline">{t("Terms")}</Link> {t("and")}{" "}
        <Link href="/privacy" className="underline">{t("Privacy Policy")}</Link>.
      </p>
    </form>
  )
}
