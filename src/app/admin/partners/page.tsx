import Link from "next/link"
import { Download } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { requireAdmin } from "@/lib/auth"
import { isMonth, partnerReport, thisMonth } from "@/lib/partner-report"
import { RESOURCE_CATEGORY_LABELS } from "@/lib/start-guide"

export const metadata = { title: "Partners · Admin" }

function shiftMonth(month: string, by: number) {
  const [y, m] = month.split("-").map(Number)
  const d = new Date(Date.UTC(y, m - 1 + by, 1))
  return d.toISOString().slice(0, 7)
}

export default async function AdminPartnersPage({ searchParams }: PageProps<"/admin/partners">) {
  await requireAdmin()
  const { month: m, resource } = await searchParams
  const month = isMonth(m) ? m : thisMonth()
  const rows = (await partnerReport(month)).filter((r) => typeof resource !== "string" || r.id === resource)
  const label = new Date(`${month}-01T12:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })

  return (
    <main className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Partner report</h1>
        <a href={`/admin/partners/export?month=${month}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
          <Download /> Download {label} (CSV)
        </a>
      </div>
      <div className="flex items-center gap-3 text-sm">
        <Link href={`/admin/partners?month=${shiftMonth(month, -1)}`} className="text-primary">← Previous</Link>
        <span className="font-semibold">{label}</span>
        {month < thisMonth() && <Link href={`/admin/partners?month=${shiftMonth(month, 1)}`} className="text-primary">Next →</Link>}
      </div>
      <p className="text-sm text-muted-foreground">
        Use these numbers to check the partner&apos;s own report before they pay you. &ldquo;Signed up&rdquo; is what vendors told us;
        the partner&apos;s tracking link or code is the official count.
      </p>
      {rows.length === 0 ? (
        <p className="rounded-xl border bg-background p-4 text-sm text-muted-foreground">
          No partners yet. Mark a resource as a partner in <Link href="/admin/resources" className="text-primary">Start hub</Link>.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-background">
          <table className="w-full text-sm">
            <thead className="border-b text-left text-muted-foreground">
              <tr>
                <th className="p-3 font-medium">Partner</th>
                <th className="p-3 text-right font-medium">Clicks</th>
                <th className="p-3 text-right font-medium">Vendors who clicked</th>
                <th className="p-3 text-right font-medium">Codes copied</th>
                <th className="p-3 text-right font-medium">Said they signed up</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="p-3">
                    <Link href={`/admin/resources/${r.id}`} className="font-medium hover:underline">{r.name}</Link>
                    <div className="text-xs text-muted-foreground">
                      {RESOURCE_CATEGORY_LABELS[r.category]}
                      {r.commission_terms && ` · ${r.commission_terms}`}
                    </div>
                  </td>
                  <td className="p-3 text-right tabular-nums">{r.clicks}</td>
                  <td className="p-3 text-right tabular-nums">{r.uniqueClickers}</td>
                  <td className="p-3 text-right tabular-nums">{r.codeCopies}</td>
                  <td className="p-3 text-right font-semibold tabular-nums">{r.signups}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  )
}
