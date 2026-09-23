import { ActionForm, SubmitButton } from "@/components/action-form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { saveShopperProfile } from "@/actions/shopper"
import { getProfile, requireUser } from "@/lib/auth"
import { getT } from "@/lib/i18n/server"

export const metadata = { title: "Welcome, shopper" }

export default async function ShopperSetupPage() {
  await requireUser()
  const profile = await getProfile()
  const t = await getT()
  return (
    <main className="mx-auto w-full max-w-lg space-y-5 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold">{t("Find markets near you")}</h1>
        <p className="text-muted-foreground">{t("Two quick questions and you're in.")}</p>
      </div>
      <ActionForm action={saveShopperProfile} className="space-y-4 rounded-xl border bg-background p-4">
        <input type="hidden" name="from" value="onboarding" />
        <div className="space-y-1.5">
          <Label htmlFor="full_name">{t("Your name")}</Label>
          <Input id="full_name" name="full_name" required maxLength={100} autoComplete="name" defaultValue={profile?.full_name ?? ""} />
          <p className="text-xs text-muted-foreground">{t("Reviews show your first name and last initial, like “Maria G.”")}</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="home_zip">{t("Home ZIP code")}</Label>
          <Input id="home_zip" name="home_zip" inputMode="numeric" pattern="\d{5}" maxLength={5} autoComplete="postal-code" placeholder="90026" defaultValue={profile?.home_zip ?? ""} />
          <p className="text-xs text-muted-foreground">{t("So we can show markets near you first. You can change it any time.")}</p>
        </div>
        <SubmitButton size="lg" className="w-full" pendingText={t("Saving…")}>
          {t("Show me markets")}
        </SubmitButton>
      </ActionForm>
    </main>
  )
}
