import Link from "next/link"
import { redirect } from "next/navigation"
import { Turnstile } from "@/components/turnstile"
import { ActionForm, SubmitButton } from "@/components/action-form"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PasswordInput } from "@/components/password-input"
import { SignUpForm } from "@/components/sign-up-form"
import { signInWithPassword } from "@/actions/auth"
import { CodeSignIn } from "@/components/code-sign-in"
import { getUser } from "@/lib/auth"
import { getT } from "@/lib/i18n/server"
import { safeNextPath } from "@/lib/form"
import { cn } from "@/lib/utils"

export const metadata = { title: "Sign in" }

type Mode = "signup" | "signin" | "forgot"

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams
  const next = safeNextPath(typeof params.next === "string" ? params.next : null)
  const email = typeof params.email === "string" ? params.email : ""
  if (await getUser()) redirect(next)
  const t = await getT()
  // "Sign up" buttons send people to onboarding; everyone else is probably signing in.
  const mode: Mode =
    params.mode === "signup" || params.mode === "signin" || params.mode === "forgot"
      ? params.mode
      : next.startsWith("/onboarding")
        ? "signup"
        : "signin"
  const href = (m: Mode) => `/login?mode=${m}&next=${encodeURIComponent(next)}${email ? `&email=${encodeURIComponent(email)}` : ""}`

  return (
    <main className="flex flex-1 items-start justify-center px-4 py-10 sm:items-center">
      <Card className="w-full max-w-sm">
        {mode !== "forgot" && (
          <div className="mx-4 grid grid-cols-2 rounded-full bg-muted p-1 text-sm font-semibold" role="tablist">
            {(["signup", "signin"] as const).map((m) => (
              <Link
                key={m}
                href={href(m)}
                role="tab"
                aria-selected={mode === m}
                replace
                className={cn(
                  "rounded-full py-2 text-center transition-colors",
                  mode === m ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {m === "signup" ? t("Create account") : t("Sign in")}
              </Link>
            ))}
          </div>
        )}
        <CardHeader>
          <CardTitle className="text-xl">
            {mode === "signup" ? t("Join Stallpass free") : mode === "signin" ? t("Welcome back") : t("Forgot your password?")}
          </CardTitle>
          <CardDescription>
            {mode === "signup"
              ? t("Takes a minute. You'll confirm your email later, before you apply to markets.")
              : mode === "signin"
                ? t("Sign in with your email and password.")
                : t("We'll email you a 6-digit code. Enter it and you can set a new password.")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {params.error === "link" && (
            <p role="alert" className="text-sm text-destructive">
              {t("That sign-in link didn't work (it may have expired, or been opened in a different browser). Please request a new one.")}
            </p>
          )}

          {mode === "signup" && <SignUpForm next={next} />}

          {mode === "signin" && (
            <ActionForm action={signInWithPassword} className="space-y-3">
              <input type="hidden" name="next" value={next} />
              <div className="space-y-1.5">
                <Label htmlFor="pw-email">{t("Email")}</Label>
                <Input id="pw-email" name="email" type="email" defaultValue={email} required autoComplete="email" autoCapitalize="none" />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-baseline justify-between">
                  <Label htmlFor="password">{t("Password")}</Label>
                  <Link href={href("forgot")} className="text-xs font-medium text-primary">
                    {t("Forgot password?")}
                  </Link>
                </div>
                <PasswordInput id="password" name="password" required autoComplete="current-password" />
              </div>
              <Turnstile />
              <SubmitButton size="lg" className="w-full" pendingText={t("Signing in…")}>
                {t("Sign in")}
              </SubmitButton>
              <p className="text-center text-xs text-muted-foreground">
                {t("Joined with just a code before?")}{" "}
                <Link href={href("forgot")} className="font-medium text-primary">{t("Sign in with a code")}</Link>
              </p>
            </ActionForm>
          )}

          {mode === "forgot" && (
            <>
              <CodeSignIn next={`/account/password?next=${encodeURIComponent(next)}`} defaultEmail={email} />
              <Link href={href("signin")} className="block text-center text-sm text-muted-foreground">
                ← {t("Back to sign in")}
              </Link>
            </>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
