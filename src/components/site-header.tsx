import Link from "next/link"
import { LayoutGrid, LogOut, Shield, UserRound } from "lucide-react"
import { signOut } from "@/actions/auth"
import { DesktopNav, MobileTabBar } from "@/components/app-nav"
import { buttonVariants } from "@/components/ui/button"
import { LanguageButton } from "@/components/language-picker"
import { getMyVendor, getProfile } from "@/lib/auth"
import { getT } from "@/lib/i18n/server"

export async function SiteHeader() {
  const profile = await getProfile()
  const vendor = profile ? await getMyVendor() : null
  const admin = Boolean(profile?.is_super_admin && !profile.suspended_at)
  const t = await getT()

  return (
    <>
      <header className="sticky top-0 z-[1000] border-b bg-background/95 backdrop-blur print:hidden">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4">
          <Link
            href={vendor ? "/dashboard" : profile?.is_organizer ? "/organizer" : profile?.is_shopper ? "/markets" : "/"}
            className="flex items-center gap-2 font-bold text-lg"
          >
            <span className="grid size-7 place-items-center rounded-lg bg-primary text-sm text-primary-foreground">
              S
            </span>
            Stallpass
          </Link>
          {vendor && <DesktopNav />}
          <div className="ml-auto flex items-center gap-1">
            <LanguageButton />
            {!vendor && !profile?.is_organizer && (
              <>
                <Link href="/start" className={buttonVariants({ variant: "ghost", className: "hidden sm:inline-flex" })}>
                  {t("Get started")}
                </Link>
                <Link href="/markets" className={buttonVariants({ variant: "ghost" })}>
                  {t("Markets")}
                </Link>
              </>
            )}
            {profile?.is_organizer && (
              <Link href="/organizer" className={buttonVariants({ variant: "ghost" })}>
                <LayoutGrid /> <span className="hidden sm:inline">Organizer</span>
              </Link>
            )}
            {admin && (
              <Link href="/admin" className={buttonVariants({ variant: "ghost" })}>
                <Shield /> <span className="hidden sm:inline">Admin</span>
              </Link>
            )}
            {profile && (
              <Link href="/account" className={buttonVariants({ variant: "ghost" })}>
                <UserRound /> <span className="hidden sm:inline">{t("Account")}</span>
              </Link>
            )}
            {profile ? (
              <form action={signOut}>
                <button
                  type="submit"
                  className={buttonVariants({ variant: "ghost" })}
                  aria-label={t("Sign out")}
                >
                  <LogOut /> <span className="hidden sm:inline">{t("Sign out")}</span>
                </button>
              </form>
            ) : (
              <>
                <Link href="/login" className={buttonVariants({ variant: "ghost", className: "hidden sm:inline-flex" })}>
                  {t("Sign in")}
                </Link>
                <Link href="/login?next=/onboarding" className={buttonVariants()}>
                  {t("Sign up")}
                </Link>
              </>
            )}
          </div>
        </div>
      </header>
      {vendor && <MobileTabBar />}
    </>
  )
}

/** Adds room at the bottom so the phone tab bar never covers content. */
export async function BottomSpacer() {
  return (await getMyVendor()) ? <div className="h-20 md:hidden" aria-hidden /> : null
}
