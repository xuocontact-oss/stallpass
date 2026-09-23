import { redirect } from "next/navigation"
import { Turnstile } from "@/components/turnstile"
import { ActionForm, SubmitButton } from "@/components/action-form"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { signInWithPassword } from "@/actions/auth"
import { CodeSignIn } from "@/components/code-sign-in"
import { getUser } from "@/lib/auth"
import { getT } from "@/lib/i18n/server"
import { safeNextPath } from "@/lib/form"

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams
  const next = safeNextPath(typeof params.next === "string" ? params.next : null)
  const email = typeof params.email === "string" ? params.email : ""
  if (await getUser()) redirect(next)
  const t = await getT()

  return (
    <main className="flex flex-1 items-start justify-center px-4 py-10 sm:items-center">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">{t("Sign up or sign in")}</CardTitle>
          <CardDescription>
            {t("Enter your email and we'll send a 6-digit code. New here? That creates your free account.")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {params.error === "link" && (
            <p role="alert" className="text-sm text-destructive">
              {t("That sign-in link didn't work (it may have expired, or been opened in a different browser). Please request a new one.")}
            </p>
          )}

          <CodeSignIn next={next} defaultEmail={email} />

          <Separator />

          <details className="text-sm">
            <summary className="cursor-pointer text-muted-foreground">
              {t("Sign in with a password instead")}
            </summary>
            <ActionForm action={signInWithPassword} className="mt-3 space-y-3">
              <input type="hidden" name="next" value={next} />
              <div className="space-y-1.5">
                <Label htmlFor="pw-email">{t("Email")}</Label>
                <Input id="pw-email" name="email" type="email" defaultValue={email} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">{t("Password")}</Label>
                <Input id="password" name="password" type="password" required />
              </div>
              <Turnstile />
              <SubmitButton variant="outline" className="w-full" pendingText={t("Signing in…")}>
                {t("Sign in")}
              </SubmitButton>
            </ActionForm>
          </details>
        </CardContent>
      </Card>
    </main>
  )
}
