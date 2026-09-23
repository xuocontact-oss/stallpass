import Link from "next/link"
import { notFound } from "next/navigation"
import { SalesReportForm } from "@/components/sales-report-form"
import { requireVendor } from "@/lib/auth"
import { formatDate, isValidISODate, todayISO } from "@/lib/dates"
import { createClient } from "@/lib/supabase/server"
import { squareConfigured } from "@/lib/square"
import { getLang, getT } from "@/lib/i18n/server"

export const metadata = { title: "Report sales" }

export default async function SalesReportPage({ params, searchParams }: PageProps<"/applications/[id]/sales">) {
  const { vendor } = await requireVendor()
  const { id } = await params
  const { date } = await searchParams
  if (typeof date !== "string" || !isValidISODate(date) || date > todayISO()) notFound()

  const supabase = await createClient()
  const { data: app } = await supabase
    .from("applications")
    .select("id, status, event_dates, markets(name, sales_reporting, sales_fee_percent)")
    .eq("id", id)
    .eq("vendor_id", vendor.id)
    .maybeSingle()
  if (!app || !app.event_dates.includes(date) || !["accepted", "paid"].includes(app.status)) notFound()
  const market = app.markets as unknown as { name: string; sales_reporting: string; sales_fee_percent: number | null }

  const t = await getT()
  const lang = await getLang()
  const [{ data: existing }, { data: square }] = await Promise.all([
    supabase.from("sales_reports").select("*").eq("application_id", id).eq("event_date", date).maybeSingle(),
    supabase.from("my_pos_connections").select("provider").eq("vendor_id", vendor.id).maybeSingle(),
  ])

  return (
    <main className="mx-auto w-full max-w-md space-y-5 px-4 py-6">
      <Link href={`/applications/${id}`} className="text-sm text-muted-foreground">← {t("Back")}</Link>
      <div>
        <h1 className="text-2xl font-bold">{t("How did it go?")}</h1>
        <p className="text-muted-foreground">
          {market.name} · {formatDate(date, { weekday: true, lang })}
        </p>
        {market.sales_reporting === "required" && (
          <p className="mt-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-950">
            {market.sales_fee_percent
              ? t("This market asks every vendor to report sales (they charge {pct}% of sales).", { pct: market.sales_fee_percent })
              : t("This market asks every vendor to report sales.")}
          </p>
        )}
      </div>
      <div className="rounded-xl border bg-background p-4">
        <SalesReportForm applicationId={id} date={date} squareConnected={Boolean(square) && squareConfigured()} existing={existing} />
      </div>
      {!square && squareConfigured() && (
        <p className="text-center text-sm text-muted-foreground">
          {t("Use Square?")} <a href="/api/square/connect" className="font-medium text-primary">{t("Connect it")}</a>{" "}
          {t("and fill this in with one tap next time.")}
        </p>
      )}
    </main>
  )
}
