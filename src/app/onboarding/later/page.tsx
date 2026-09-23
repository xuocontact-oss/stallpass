import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import { getT } from "@/lib/i18n/server"

export const metadata = { title: "Finish later" }

export default async function FinishLaterPage() {
  const t = await getT()
  return (
    <main className="mx-auto w-full max-w-md space-y-4 px-4 py-16 text-center">
      <h1 className="text-2xl font-bold">{t("No problem, you're signed up!")}</h1>
      <p className="text-muted-foreground">
        {t("We'll send you one reminder tomorrow. Whenever you're ready, sign in with your email and you'll pick up where you left off.")}
      </p>
      <Link href="/onboarding" className={buttonVariants({ size: "lg" })}>{t("Actually, let's finish now")}</Link>
    </main>
  )
}
