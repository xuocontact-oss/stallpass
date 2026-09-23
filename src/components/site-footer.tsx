import Link from "next/link"
import { getT } from "@/lib/i18n/server"
import { CONTACT_EMAIL, SITE_NAME } from "@/lib/site"

export async function SiteFooter() {
  const t = await getT()
  return (
    <footer className="mt-10 border-t bg-background print:hidden">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-6 text-sm text-muted-foreground">
        <span>© {new Date().getFullYear()} {SITE_NAME}</span>
        <Link href="/start" className="hover:text-foreground">{t("Start guide")}</Link>
        <Link href="/terms" className="hover:text-foreground">{t("Terms")}</Link>
        <Link href="/privacy" className="hover:text-foreground">{t("Privacy")}</Link>
        <Link href="/review-guidelines" className="hover:text-foreground">{t("Review guidelines")}</Link>
        <Link href="/partners" className="hover:text-foreground">{t("How we make money")}</Link>
        <a href={`mailto:${CONTACT_EMAIL}`} className="hover:text-foreground">{t("Contact")}</a>
      </div>
    </footer>
  )
}
