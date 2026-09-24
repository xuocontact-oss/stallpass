import Link from "next/link"
import { ArrowRight, Plus } from "lucide-react"
import { DocStatusBadge } from "@/components/doc-status-badge"
import { MarketCard } from "@/components/market-card"
import { buttonVariants } from "@/components/ui/button"
import { getProfile, requireVendor } from "@/lib/auth"
import { VerifyEmailBox } from "@/components/verify-email-box"
import { commonDocTypes, DOCUMENT_TYPES, documentTypeLabel } from "@/lib/constants"
import { addDays, daysBetween, formatDate, relativeDays, todayISO } from "@/lib/dates"
import { compareByUrgency, documentStatus, summarizeDocuments } from "@/lib/documents"
import { getDirectory } from "@/lib/market-data"
import { filterMarkets, parseFilters } from "@/lib/markets"
import { createClient } from "@/lib/supabase/server"
import { vendorSetupProgress } from "@/lib/setup-progress"
import { getMyDocuments } from "@/lib/vendor-data"
import { cn } from "@/lib/utils"
import { getLang, getT } from "@/lib/i18n/server"

export const metadata = { title: "Home" }

export default async function DashboardPage() {
  const { user, vendor } = await requireVendor()
  const profile = await getProfile()
  const t = await getT()
  const lang = await getLang()
  const today = todayISO()
  const supabase = await createClient()
  const [docs, directory, { data: apps }] = await Promise.all([
    getMyDocuments(vendor.id),
    getDirectory(today, { curatedOnly: true }),
    supabase.from("applications").select("id, status, event_dates, markets(name, sales_reporting)").eq("vendor_id", vendor.id),
  ])
  const { data: myReports } = await supabase.from("sales_reports").select("application_id, event_date").eq("vendor_id", vendor.id)
  const reportedKeys = new Set((myReports ?? []).map((r) => `${r.application_id}:${r.event_date}`))
  const salesToReport = ((apps ?? []) as unknown as { id: string; status: string; event_dates: string[]; markets: { name: string; sales_reporting: string } | null }[])
    .filter((a) => ["accepted", "paid"].includes(a.status) && a.markets && a.markets.sales_reporting !== "off")
    .flatMap((a) =>
      a.event_dates
        .filter((d) => d <= today && d >= addDays(today, -30) && !reportedKeys.has(`${a.id}:${d}`))
        .map((d) => ({ appId: a.id, date: d, market: a.markets!.name, required: a.markets!.sales_reporting === "required" }))
    )
    .sort((x, y) => y.date.localeCompare(x.date))
  const upcomingApps = ((apps ?? []) as unknown as { status: string; event_dates: string[] }[]).filter(
    (a) => a.status !== "cancelled" && (a.event_dates as string[]).some((d) => d >= today)
  )
  const appCounts = {
    waiting: upcomingApps.filter((a) => ["submitted", "waitlisted"].includes(a.status)).length,
    accepted: upcomingApps.filter((a) => ["accepted", "paid"].includes(a.status)).length,
    drafts: upcomingApps.filter((a) => a.status === "draft").length,
  }

  const counts = summarizeDocuments(docs, today)
  const attention = docs
    .filter((d) => ["expired", "expiring"].includes(documentStatus(d.expiration_date, today)))
    .sort(compareByUrgency)
  const haveTypes = new Set(docs.map((d) => d.doc_type))
  const expected = commonDocTypes(vendor.category)
  const missing = DOCUMENT_TYPES.filter((t) => expected.includes(t.key) && !haveTypes.has(t.key))

  const upcoming = filterMarkets(directory.markets, directory.dates, parseFilters({ when: "30" }), today)
    .filter((r) => r.nextDate)
    .slice(0, 3)

  const setup = vendorSetupProgress(vendor, docs)

  const tiles = [
    { label: "Valid", value: counts.valid + counts.no_expiry, className: "text-emerald-700", href: "/documents?status=valid" },
    { label: "Expiring soon", value: counts.expiring, className: "text-amber-700", href: "/documents?status=expiring" },
    { label: "Expired", value: counts.expired, className: "text-red-700", href: "/documents?status=expired" },
  ]

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6">
      <div>
        <h1 className="text-2xl font-bold">
          {t("Hi, {name}", { name: vendor.business_name })}
        </h1>
        <p className="text-muted-foreground">
          {t("Here's where things stand.")}
        </p>
      </div>

      {!profile?.email_verified_at && <VerifyEmailBox email={user.email ?? ""} />}
      {!profile?.has_password && (
        <Link href="/account/password?next=/dashboard" className="flex items-center justify-between gap-3 rounded-xl border bg-background p-4">
          <span>
            <span className="block font-semibold">{t("Set a password")}</span>
            <span className="text-sm text-muted-foreground">{t("So you can sign in with your email and password next time.")}</span>
          </span>
          <ArrowRight className="size-5 shrink-0 text-primary" aria-hidden />
        </Link>
      )}

      {!setup.complete && (
        <Link href={`/onboarding?step=${setup.nextStep}`} className="block rounded-xl border-2 border-primary/40 bg-background p-4">
          <div className="flex items-center justify-between gap-3">
            <span>
              <span className="block font-semibold">{t("Finish setting up your business")}</span>
              <span className="text-sm text-muted-foreground">
                {t("{n} of 3 done · next: {step}", {
                  n: setup.stepsDone,
                  step: t(setup.items.find((i) => !i.done)?.label ?? "", { done: setup.docsDone, total: setup.docsTotal }).toLowerCase(),
                })}
              </span>
            </span>
            <ArrowRight className="size-5 shrink-0 text-primary" aria-hidden />
          </div>
          <div className="mt-3 grid grid-cols-3 gap-1.5">
            {setup.items.map((i) => (
              <div key={i.label} className={cn("h-1.5 rounded-full", i.done ? "bg-primary" : "bg-muted")} />
            ))}
          </div>
        </Link>
      )}
      {docs.length < 3 && (
        <p className="text-sm">
          {t("First time selling at markets?")}{" "}
          <Link href="/start" className="font-medium text-primary">
            {t("Check out our quick start guide →")}
          </Link>
        </p>
      )}

      <section className="rounded-xl border bg-background p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">{t("Your documents")}</h2>
          <Link href="/documents" className="text-sm font-medium text-primary">
            {t("See all")}
          </Link>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {tiles.map((tile) => (
            <Link key={tile.label} href={tile.href} className="rounded-lg bg-muted/60 p-3 text-center">
              <div className={cn("text-2xl font-bold", tile.value > 0 && tile.className)}>{tile.value}</div>
              <div className="text-xs text-muted-foreground">{t(tile.label)}</div>
            </Link>
          ))}
        </div>

        {attention.length > 0 && (
          <ul className="mt-4 divide-y">
            {attention.map((d) => (
              <li key={d.id}>
                <Link href={`/documents/${d.id}`} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{d.title || t(documentTypeLabel(d.doc_type))}</div>
                    <div className="text-sm text-muted-foreground">
                      {daysBetween(today, d.expiration_date!) < 0 ? t("Expired") : t("Expires")}{" "}
                      {formatDate(d.expiration_date, { lang })} ({relativeDays(daysBetween(today, d.expiration_date!), lang)})
                    </div>
                  </div>
                  <DocStatusBadge status={documentStatus(d.expiration_date, today)} />
                </Link>
              </li>
            ))}
          </ul>
        )}

        {missing.length > 0 && (
          <div className="mt-4 rounded-lg border border-dashed p-3">
            <p className="text-sm font-medium">{t("Most markets ask for these. You haven't added:")}</p>
            <ul className="mt-1 text-sm text-muted-foreground">
              {missing.map((m) => (
                <li key={m.key}>• {t(m.label)}</li>
              ))}
            </ul>
            <Link href="/documents/new" className={cn(buttonVariants({ size: "sm" }), "mt-3")}>
              <Plus /> {t("Add a document")}
            </Link>
          </div>
        )}
      </section>

      {salesToReport.length > 0 && (
        <section className="space-y-2 rounded-xl border-2 border-amber-300 bg-background p-4">
          <h2 className="font-semibold">{t("Report your sales")}</h2>
          <ul className="space-y-2">
            {salesToReport.slice(0, 5).map((r) => (
              <li key={`${r.appId}${r.date}`}>
                <Link href={`/applications/${r.appId}/sales?date=${r.date}`} className="flex items-center justify-between gap-2 text-sm">
                  <span>
                    {r.market} · {formatDate(r.date, { weekday: true, lang })}
                    {r.required && <span className="ml-1 text-xs text-amber-700">({t("required")})</span>}
                  </span>
                  <span className="font-medium text-primary">{t("Report →")}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {upcomingApps.length > 0 && (
        <section className="rounded-xl border bg-background p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">{t("Your applications")}</h2>
            <Link href="/applications" className="text-sm font-medium text-primary">{t("See all")}</Link>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {[
              { label: "Accepted", value: appCounts.accepted, href: "/applications?status=accepted" },
              { label: "Waiting", value: appCounts.waiting, href: "/applications?status=waiting" },
              { label: "Drafts", value: appCounts.drafts, href: "/applications?status=draft" },
            ].map((tile) => (
              <Link key={tile.label} href={tile.href} className="rounded-lg bg-muted/60 p-3 text-center">
                <div className="text-2xl font-bold">{tile.value}</div>
                <div className="text-xs text-muted-foreground">{t(tile.label)}</div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">{t("Markets in the next 30 days")}</h2>
          <Link href="/markets" className="text-sm font-medium text-primary">
            {t("Browse all")}
          </Link>
        </div>
        {upcoming.length === 0 ? (
          <p className="rounded-xl border bg-background p-4 text-sm text-muted-foreground">
            {t("No markets with dates in the next 30 days yet.")}
          </p>
        ) : (
          upcoming.map((r) => (
            <MarketCard key={r.market.id} result={r} photoPath={directory.coverPhotos.get(r.market.id)}
              rating={directory.ratings.get(r.market.id)}
            />
          ))
        )}
      </section>
    </main>
  )
}
