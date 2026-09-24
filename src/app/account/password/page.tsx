import { ActionForm, SubmitButton } from "@/components/action-form"
import { Label } from "@/components/ui/label"
import { PasswordInput } from "@/components/password-input"
import { setPassword } from "@/actions/auth"
import { getProfile, requireUser } from "@/lib/auth"
import { safeNextPath } from "@/lib/form"
import { getT } from "@/lib/i18n/server"

export const metadata = { title: "Set your password" }

/** Set or change the password. "Forgot password?" also lands here after the emailed code. */
export default async function PasswordPage({ searchParams }: PageProps<"/account/password">) {
  const user = await requireUser()
  const profile = await getProfile()
  const { next } = await searchParams
  const t = await getT()
  const goTo = safeNextPath(typeof next === "string" ? next : null)

  return (
    <main className="mx-auto w-full max-w-sm space-y-5 px-4 py-10">
      <div>
        <h1 className="text-2xl font-bold">{profile?.has_password ? t("Change your password") : t("Set your password")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("For {email}. Next time, sign in with your email and this password.", { email: user.email ?? "" })}
        </p>
      </div>
      <ActionForm action={setPassword} className="space-y-4 rounded-xl border bg-background p-4">
        <input type="hidden" name="next" value={goTo} />
        <div className="space-y-1.5">
          <Label htmlFor="password">{t("New password")}</Label>
          <PasswordInput id="password" name="password" required minLength={8} maxLength={72} autoComplete="new-password" autoFocus className="h-12 text-lg" />
          <p className="text-xs text-muted-foreground">{t("At least 8 characters.")}</p>
        </div>
        <SubmitButton size="lg" className="w-full" pendingText={t("Saving…")}>
          {t("Save password")}
        </SubmitButton>
      </ActionForm>
    </main>
  )
}
