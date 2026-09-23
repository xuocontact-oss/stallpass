import { NextResponse, type NextRequest } from "next/server"
import { getOrganizedMarket } from "@/lib/auth"
import { isValidISODate } from "@/lib/dates"
import { marketSalesByDay } from "@/lib/organizer-sales"

const money = (c: number | null) => (c == null ? "" : (c / 100).toFixed(2))
const cell = (v: string | number | null) => {
  const s = String(v ?? "")
  return `"${(/^[=+\-@]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`
}

/** Sales reports as a spreadsheet (organizer of this market only). */
export async function GET(request: NextRequest, ctx: RouteContext<"/organizer/markets/[id]/sales/export">) {
  const { id } = await ctx.params
  const market = await getOrganizedMarket(id)
  if (!market) return new NextResponse("Not found", { status: 404 })
  const date = request.nextUrl.searchParams.get("date")
  const days = await marketSalesByDay(id, date && isValidISODate(date) ? date : undefined)
  const pct = market.sales_fee_percent ? Number(market.sales_fee_percent) : null
  const header = ["Date", "Vendor", "Booth", "Total sales", "Card", "Cash", "Number of sales", "Reported from", ...(pct != null ? [`${pct}% due`] : [])]
  const lines = days.flatMap((d) =>
    d.rows.map((r) => [d.date, r.business, r.booth, money(r.gross), money(r.card), money(r.cash), r.transactions, r.gross == null ? "not reported" : r.source, ...(pct != null ? [r.gross == null ? "" : money(Math.round((r.gross * pct) / 100))] : [])])
  )
  const csv = [header, ...lines].map((row) => row.map(cell).join(",")).join("\n")
  const name = `${market.slug}-sales${date ? `-${date}` : ""}.csv`
  return new NextResponse(csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "no-store" },
  })
}
