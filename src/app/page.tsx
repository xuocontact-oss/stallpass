import Image from "next/image"
import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowRight } from "lucide-react"
import { MarketCover } from "@/components/market-cover"
import { SampleBadge } from "@/components/sample-badge"
import { buttonVariants } from "@/components/ui/button"
import { getMyVendor, getProfile } from "@/lib/auth"
import { marketTypeLabel } from "@/lib/constants"
import { formatDate, todayISO } from "@/lib/dates"
import { getLang, getT } from "@/lib/i18n/server"
import { getDirectory } from "@/lib/market-data"
import { filterMarkets, formatMoney, parseFilters } from "@/lib/markets"
import { cn } from "@/lib/utils"
import heroPhoto from "@/assets/photos/hero-burgers.jpg"
import makersPhoto from "@/assets/photos/craft-stall.jpg"
import growersPhoto from "@/assets/photos/plant-stall.jpg"
import trucksPhoto from "@/assets/photos/taco-truck.jpg"
import nightTruckPhoto from "@/assets/photos/truck-night.jpg"

const FEATURES = [
  {
    title: "All your paperwork in one place",
    text: "Permits, insurance, licenses. Upload once and see at a glance what's valid.",
  },
  {
    title: "Never miss an expiry",
    text: "We email you 30 days and 7 days before anything expires.",
  },
  {
    title: "Find markets near you",
    text: "Farmers markets, night markets, craft fairs and flea markets by date, distance, category and booth fee.",
  },
  {
    title: "Honest reviews from vendors",
    text: "Foot traffic, organization and real sales, from people who've actually worked the market.",
  },
]

const KINDS = [
  { photo: trucksPhoto, title: "Food trucks & carts", text: "Commissary, mobile permit, fire check: step by step.", track: "truck" },
  { photo: makersPhoto, title: "Clothing, crafts & makers", text: "Seller's permit, insurance and the markets that fit your goods.", track: "goods" },
  { photo: growersPhoto, title: "Food, farms & plants", text: "Health permits, shared kitchens and cottage food, explained.", track: "prepared" },
]

const TICKER = ["Farmers markets", "Night markets", "Food truck nights", "Craft fairs", "Flea & vintage", "Pop-ups"]

export default async function HomePage({ searchParams }: PageProps<"/">) {
  const { deleted } = await searchParams
  if (await getMyVendor()) redirect("/dashboard")
  const profile = await getProfile()
  if (profile?.is_organizer) redirect("/organizer")
  if (profile?.is_shopper) redirect("/markets")
  const t = await getT()
  const lang = await getLang()

  const today = todayISO()
  const directory = await getDirectory(today, { curatedOnly: true })
  const upcoming = filterMarkets(directory.markets, directory.dates, parseFilters({ when: "30" }), today)
    .filter((r) => r.nextDate)
    .slice(0, 3)

  return (
    <main className="flex-1">
      {deleted && (
        <p className="mx-auto mt-6 max-w-6xl rounded-lg bg-muted p-3 text-sm">{t("Your account and data have been deleted. Sorry to see you go!")}</p>
      )}

      {/* Hero */}
      <section className="mx-auto grid max-w-6xl gap-10 px-4 pt-10 pb-14 sm:pt-16 lg:grid-cols-12 lg:items-center">
        <div className="space-y-6 lg:col-span-7">
          <span className="inline-block rounded-full border-2 border-ink bg-white px-3 py-1 text-xs font-bold tracking-wider uppercase">
            {t("Free for vendors · Los Angeles")}
          </span>
          <h1 className="text-5xl leading-[0.95] sm:text-7xl">
            {t("Get legal.")}
            <br />
            {t("Get in.")}
            <br />
            <span className="text-primary">{t("Get selling.")}</span>
          </h1>
          <p className="max-w-xl text-lg sm:text-xl">
            {t("Permits, insurance and applications for pop-up food, makers and market vendors. Keep every document in one place and apply to markets in two taps.")}
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/login?next=/onboarding" className={buttonVariants({ size: "lg", className: "h-14 px-7 text-lg" })}>
              {t("Join free as a vendor")}
            </Link>
            <Link href="/markets" className={buttonVariants({ size: "lg", variant: "outline", className: "h-14 px-7 text-lg" })}>
              {t("Browse markets")}
            </Link>
          </div>
          <Link href="/start" className="inline-flex items-center gap-1 font-semibold underline-offset-4 hover:underline">
            {t("New to markets? Start here")} <ArrowRight className="size-4" />
          </Link>
        </div>

        <div className="relative lg:col-span-5">
          <div className="relative aspect-[4/5] overflow-hidden rounded-2xl border-2 border-ink poster-shadow sm:aspect-[4/3] lg:aspect-[4/5]">
            <Image src={heroPhoto} alt={t("Burgers being made on green checkered paper at a market stall")} fill priority placeholder="blur" sizes="(max-width: 1024px) 100vw, 480px" className="object-cover" />
          </div>
          <div className="absolute -bottom-6 -left-2 w-64 rotate-[-3deg] rounded-xl border-2 border-ink bg-white p-4 poster-shadow sm:-left-6 sm:w-72">
            <p className="font-heading text-lg font-extrabold">{t("Your documents")}</p>
            <ul className="mt-2 space-y-1.5 text-sm">
              <li className="flex justify-between border-b border-dashed pb-1.5">
                <span>{t("Health permit")}</span>
                <span className="font-bold text-leaf">{t("Valid").toUpperCase()}</span>
              </li>
              <li className="flex justify-between border-b border-dashed pb-1.5">
                <span>{t("Seller's permit")}</span>
                <span className="font-bold text-leaf">{t("Valid").toUpperCase()}</span>
              </li>
              <li className="flex justify-between">
                <span>{t("Insurance")}</span>
                <span className="font-bold text-destructive">{t("5 days left").toUpperCase()}</span>
              </li>
            </ul>
          </div>
          <span className="absolute -top-4 right-3 rotate-[4deg] rounded-full border-2 border-ink bg-sun px-4 py-2 text-sm font-bold">
            {t("We remind you before it runs out")}
          </span>
        </div>
      </section>

      {/* Ticker */}
      <div className="overflow-hidden border-y-2 border-ink bg-ink py-3 text-paper" aria-hidden>
        <div className="flex w-max animate-[ticker_40s_linear_infinite] gap-8 motion-reduce:animate-none font-heading text-lg font-bold whitespace-nowrap">
          {[...TICKER, ...TICKER, ...TICKER].map((k, i) => (
            <span key={i} className="flex items-center gap-8">
              {t(k)} <span className="text-sun">✦</span>
            </span>
          ))}
        </div>
      </div>

      {/* Upcoming markets */}
      {upcoming.length > 0 && (
        <section className="mx-auto max-w-6xl space-y-6 px-4 py-14">
          <div className="flex items-end justify-between gap-4">
            <h2 className="text-3xl sm:text-4xl">{t("Coming up near you")}</h2>
            <Link href="/markets" className="shrink-0 font-bold underline-offset-4 hover:underline">
              {t("See all markets")} →
            </Link>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {upcoming.map(({ market, nextDate }) => (
              <Link
                key={market.id}
                href={`/markets/${market.slug}`}
                className="group overflow-hidden rounded-2xl border-2 border-ink bg-white transition-transform hover:-translate-y-1 hover:poster-shadow"
              >
                <div className="relative">
                  <MarketCover type={market.market_type} name={market.name} sample={market.is_sample} sizes="(max-width: 768px) 100vw, 380px" className="h-44 border-b-2 border-ink" />
                  <span className="absolute bottom-3 left-3 rounded-md border-2 border-ink bg-white px-2 py-0.5 text-xs font-bold uppercase">
                    {t(marketTypeLabel(market.market_type))}
                  </span>
                </div>
                <div className="space-y-1.5 p-4">
                  <div className="flex items-start gap-2">
                    <h3 className="flex-1 text-xl leading-tight font-extrabold">{market.name}</h3>
                    {market.is_sample && <SampleBadge />}
                  </div>
                  <p className="text-sm">
                    {market.city}
                    {nextDate && ` · ${formatDate(nextDate.event_date, { weekday: true, lang })}`}
                  </p>
                  {market.min_booth_fee_cents != null && (
                    <span className="inline-block rounded-md border-2 border-ink bg-sun px-2 py-0.5 text-xs font-bold">
                      {t("Booths from {price}", { price: formatMoney(market.min_booth_fee_cents) })}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Every kind of vendor */}
      <section className={cn("border-t-2 border-ink bg-white", upcoming.length === 0 && "border-t-0")}>
        <div className="mx-auto max-w-6xl space-y-6 px-4 py-14">
          <div className="max-w-2xl space-y-2">
            <h2 className="text-3xl sm:text-4xl">{t("Built for every kind of vendor")}</h2>
            <p className="text-lg text-muted-foreground">{t("First market or fiftieth, we'll show you exactly what you need.")}</p>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {KINDS.map((k) => (
              <Link key={k.track} href={`/start?track=${k.track}#steps`} className="group block">
                <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border-2 border-ink">
                  <Image src={k.photo} alt="" fill placeholder="blur" sizes="(max-width: 768px) 100vw, 380px" className="object-cover transition-transform duration-500 group-hover:scale-105" />
                </div>
                <h3 className="mt-3 flex items-center gap-1 text-xl font-extrabold">
                  {t(k.title)} <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" />
                </h3>
                <p className="text-muted-foreground">{t(k.text)}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* What you get */}
      <section className="mx-auto max-w-6xl px-4 py-14">
        <h2 className="mb-8 text-3xl sm:text-4xl">{t("What Stallpass does for you")}</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          {FEATURES.map(({ title, text }, i) => (
            <div key={title} className="flex gap-4 rounded-2xl border-2 border-ink bg-white p-5">
              <span className="font-heading text-4xl leading-none font-extrabold text-primary">{String(i + 1).padStart(2, "0")}</span>
              <div>
                <h3 className="text-xl font-extrabold">{t(title)}</h3>
                <p className="mt-1 text-muted-foreground">{t(text)}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-10 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
          <Link href="/login?next=/onboarding" className={buttonVariants({ size: "lg", className: "h-14 px-7 text-lg" })}>
            {t("Join free as a vendor")}
          </Link>
          <span className="text-muted-foreground">{t("Free for vendors. Takes about 2 minutes.")}</span>
        </div>
      </section>

      {/* Organizers */}
      <section className="border-t-2 border-ink bg-ink text-paper">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-14 md:grid-cols-2 md:items-center">
          <div className="space-y-4">
            <h2 className="text-3xl sm:text-4xl">{t("Run a market?")}</h2>
            <p className="text-lg text-paper/80">
              {t("Get applications with permits already attached, confirm payments, and collect sales reports. Free for organizers.")}
            </p>
            <Link href="/organizer/start" className={buttonVariants({ size: "lg", className: "h-12 border-paper bg-sun text-ink hover:bg-sun" })}>
              {t("Get organizer tools, free")}
            </Link>
          </div>
          <div className="relative aspect-[16/10] overflow-hidden rounded-2xl border-2 border-paper">
            <Image src={nightTruckPhoto} alt={t("A food truck lit up at a night market")} fill placeholder="blur" sizes="(max-width: 768px) 100vw, 560px" className="object-cover" />
          </div>
        </div>
      </section>
    </main>
  )
}
