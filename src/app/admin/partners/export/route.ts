import { NextResponse, type NextRequest } from "next/server"
import { isAdmin } from "@/lib/auth"
import { isMonth, partnerReport, thisMonth } from "@/lib/partner-report"

/** The partner report as a spreadsheet file (admin only). */
export async function GET(request: NextRequest) {
  if (!(await isAdmin())) return new NextResponse("Not found", { status: 404 })
  const m = request.nextUrl.searchParams.get("month")
  const month = isMonth(m) ? m : thisMonth()
  const rows = await partnerReport(month)
  const cell = (v: string | number | null) => {
    const s = String(v ?? "")
    // Quote everything; neutralise spreadsheet formulas.
    return `"${(/^[=+\-@]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`
  }
  const csv = [
    ["Month", "Partner", "Section", "Deal terms", "Clicks", "Vendors who clicked", "Codes copied", "Said they signed up"],
    ...rows.map((r) => [month, r.name, r.category, r.commission_terms, r.clicks, r.uniqueClickers, r.codeCopies, r.signups]),
  ]
    .map((row) => row.map(cell).join(","))
    .join("\n")
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="stallpass-partners-${month}.csv"`,
    },
  })
}
