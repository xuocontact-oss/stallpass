import Link from "next/link"
import { redirect } from "next/navigation"
import { BellRing, FileCheck2, MapPin, MessageSquareQuote } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { getMyVendor, getProfile } from "@/lib/auth"
import { getT } from "@/lib/i18n/server"

const FEATURES = [
  {
    icon: FileCheck2,
    title: "All your paperwork in one place",
    text: "Permits, insurance, licenses. Upload once and see at a glance what's valid.",
  },
  {
    icon: BellRing,
    title: "Never miss an expiry",
    text: "We email you 30 days and 7 days before anything expires.",
  },
  {
    icon: MapPin,
    title: "Find markets near you",
    text: "Farmers markets, night markets, craft fairs and flea markets by date, distance, category and booth fee.",
  },
  {
    icon: MessageSquareQuote,
    title: "Honest reviews from vendors",
    text: "Foot traffic, organization and real sales, from people who've actually worked the market.",
  },
]

export default async function HomePage({ searchParams }: PageProps<"/">) {
  const { deleted } = await searchParams
  if (await getMyVendor()) redirect("/dashboard")
  const profile = await getProfile()
  if (profile?.is_organizer) redirect("/organizer")
  if (profile?.is_shopper) redirect("/markets")
  const t = await getT()

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:py-16">
      {deleted && (
        <p className="mb-6 rounded-lg bg-muted p-3 text-sm">{t("Your account and data have been deleted. Sorry to see you go!")}</p>
      )}
      <section className="max-w-2xl">
        <p className="mb-3 text-sm font-semibold text-primary">{t("For pop-up vendors: food trucks, makers, clothing, art & more")}</p>
        <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl">
          {t("Your permits, your markets, your next booth, all in one place.")}
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          {t("Stallpass is free for vendors. Keep your documents ready, find markets worth your time, and apply without filling in the same form again and again.")}
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link href="/login?next=/onboarding" className={buttonVariants({ size: "lg" })}>
            {t("Join free as a vendor")}
          </Link>
          <Link href="/markets" className={buttonVariants({ size: "lg", variant: "outline" })}>
            {t("Browse markets")}
          </Link>
          <Link href="/start" className={buttonVariants({ size: "lg", variant: "ghost" })}>
            {t("New? How to get started →")}
          </Link>
        </div>
      </section>

      <section className="mt-14 grid gap-4 sm:grid-cols-2">
        {FEATURES.map(({ icon: Icon, title, text }) => (
          <div key={title} className="rounded-xl border bg-background p-5">
            <Icon className="size-6 text-primary" aria-hidden />
            <h2 className="mt-3 font-semibold">{t(title)}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t(text)}</p>
          </div>
        ))}
      </section>

      <p className="mt-10 text-sm text-muted-foreground">
        {t("Run a market?")}{" "}
        <Link href="/organizer/start" className="font-medium text-primary">
          {t("Get organizer tools, free")}
        </Link>
      </p>
    </main>
  )
}
