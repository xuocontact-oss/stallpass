import Link from "next/link"
import QRCode from "qrcode"
import { selectClassName } from "@/components/action-form"
import { PrintButton } from "@/components/print-button"
import { buttonVariants } from "@/components/ui/button"
import { requireAdmin } from "@/lib/auth"
import { siteUrl } from "@/lib/email"
import { cleanRef } from "@/lib/signup-source"
import { createClient } from "@/lib/supabase/server"

export const metadata = { title: "Outreach · Admin" }

type SignupRow = { signup_market_id: string | null; created_at: string; vendors: { id: string } | null }

/** Sign-ups per market, and how many went on to set up a business. */
function signupsByMarket(rows: SignupRow[]) {
  const byMarket = new Map<string, { total: number; vendors: number; last30: number }>()
  const since = Date.now() - 30 * 86_400_000
  for (const p of rows) {
    const key = p.signup_market_id ?? "none"
    const cur = byMarket.get(key) ?? { total: 0, vendors: 0, last30: 0 }
    cur.total++
    if (p.vendors) cur.vendors++
    if (new Date(p.created_at).getTime() > since) cur.last30++
    byMarket.set(key, cur)
  }
  return byMarket
}

/**
 * Walking markets: make a QR card / NFC link for a market, and see which
 * markets your sign-ups come from and how many vendors each market has.
 */
export default async function AdminOutreachPage({ searchParams }: PageProps<"/admin/outreach">) {
  await requireAdmin()
  const params = await searchParams
  const slug = typeof params.m === "string" ? params.m : ""
  const ref = cleanRef(typeof params.ref === "string" ? params.ref : null) ?? ""
  const supabase = await createClient()

  const [{ data: markets }, { data: counts }, { data: signups }] = await Promise.all([
    supabase.from("markets").select("id, name, slug, city, state, is_claimed").eq("approval_status", "approved").eq("source", "stallpass").order("name").limit(500),
    supabase.from("market_vendor_counts").select("market_id, vendor_count").order("vendor_count", { ascending: false }).limit(50),
    supabase.from("profiles").select("signup_market_id, signup_ref, created_at, vendors(id)").or("signup_market_id.not.is.null,signup_ref.not.is.null").limit(5000),
  ])

  const chosen = (markets ?? []).find((m) => m.slug === slug)
  const joinUrl = siteUrl(`/join?${new URLSearchParams({ ...(chosen ? { m: chosen.slug } : {}), ...(ref ? { ref } : {}) })}`)
  const qrSvg = await QRCode.toString(joinUrl, { type: "svg", margin: 1, color: { dark: "#1c1917", light: "#ffffff" } })

  const byMarket = signupsByMarket((signups ?? []) as unknown as SignupRow[])
  const nameOf = new Map((markets ?? []).map((m) => [m.id, m]))

  return (
    <main className="space-y-6">
      <h1 className="text-2xl font-bold print:hidden">Outreach</h1>

      <section className="space-y-3 rounded-xl border bg-background p-4 print:hidden">
        <h2 className="font-semibold">Make a QR card for a market</h2>
        <form className="flex flex-wrap items-end gap-3">
          <label className="min-w-56 flex-1 space-y-1 text-sm">
            <span className="font-medium">Market</span>
            <select name="m" defaultValue={slug} className={selectClassName}>
              <option value="">No market (general card)</option>
              {(markets ?? []).map((m) => (
                <option key={m.id} value={m.slug}>
                  {m.name} ({m.city})
                </option>
              ))}
            </select>
          </label>
          <label className="w-40 space-y-1 text-sm">
            <span className="font-medium">Your code (optional)</span>
            <input name="ref" defaultValue={ref} placeholder="e.g. ak" className="h-10 w-full rounded-lg border bg-background px-3" />
          </label>
          <button type="submit" className={buttonVariants()}>Make card</button>
        </form>
        <p className="text-xs text-muted-foreground">
          &ldquo;Your code&rdquo; lets you (or helpers) see whose sign-ups are whose. Letters, numbers and dashes.
        </p>
      </section>

      {/* The card itself prints on its own. */}
      <section className="mx-auto w-full max-w-sm rounded-2xl border-2 border-primary bg-white p-6 text-center text-stone-900 print:border-4">
        <p className="text-sm font-bold tracking-wide text-primary uppercase">Stallpass · free for vendors</p>
        <h2 className="mt-2 text-2xl leading-tight font-bold">{chosen ? `Selling at ${chosen.name}?` : "Sell at markets?"}</h2>
        <p className="mt-1 text-sm">Your permits in one place, expiry reminders, and apply to markets in 2 taps.</p>
        <div className="mx-auto mt-4 w-56" dangerouslySetInnerHTML={{ __html: qrSvg }} />
        <p className="mt-3 text-sm font-semibold">Scan with your camera · or tap your phone here</p>
        <p className="mt-1 text-xs break-all text-stone-500">{joinUrl}</p>
      </section>

      <div className="flex flex-wrap justify-center gap-2 print:hidden">
        <PrintButton />
        <a href={joinUrl} target="_blank" rel="noopener" className={buttonVariants({ variant: "outline" })}>Open the join page</a>
      </div>
      <p className="mx-auto max-w-md text-center text-xs text-muted-foreground print:hidden">
        <strong>NFC:</strong> get NTAG215 stickers or cards, open the free &ldquo;NFC Tools&rdquo; app → Write → Add a record →
        URL → paste the link above → Write, then hold the sticker to your phone.
      </p>

      <section className="space-y-2 print:hidden">
        <h2 className="font-semibold">Sign-ups by market</h2>
        <div className="overflow-x-auto rounded-xl border bg-background">
          <table className="w-full text-sm">
            <thead className="border-b text-left text-muted-foreground">
              <tr>
                <th className="p-3 font-medium">Where they signed up</th>
                <th className="p-3 text-right font-medium">Last 30 days</th>
                <th className="p-3 text-right font-medium">All time</th>
                <th className="p-3 text-right font-medium">Set up a business</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {[...byMarket.entries()]
                .sort((a, b) => b[1].total - a[1].total)
                .map(([id, c]) => (
                  <tr key={id}>
                    <td className="p-3">{id === "none" ? "General card (no market)" : (nameOf.get(id)?.name ?? "Other market")}</td>
                    <td className="p-3 text-right tabular-nums">{c.last30}</td>
                    <td className="p-3 text-right tabular-nums">{c.total}</td>
                    <td className="p-3 text-right tabular-nums">{c.vendors}</td>
                  </tr>
                ))}
              {byMarket.size === 0 && (
                <tr>
                  <td className="p-3 text-muted-foreground" colSpan={4}>No QR sign-ups yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-2 print:hidden">
        <h2 className="font-semibold">Vendors per market (your pitch list for organizers)</h2>
        <p className="text-sm text-muted-foreground">How many vendors say they sell at each market. Unclaimed markets with lots of vendors are the ones to pitch.</p>
        <ul className="divide-y rounded-xl border bg-background">
          {(counts ?? []).map((c) => {
            const m = nameOf.get(c.market_id)
            return (
              <li key={c.market_id} className="flex items-center gap-3 p-3 text-sm">
                <span className="w-10 text-right text-lg font-bold tabular-nums">{c.vendor_count}</span>
                <Link href={m ? `/markets/${m.slug}` : "#"} className="min-w-0 flex-1 font-medium hover:underline">
                  {m?.name ?? "Imported market"}
                </Link>
                {m?.is_claimed ? (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">On Stallpass</span>
                ) : (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900">Not claimed: pitch them</span>
                )}
              </li>
            )
          })}
          {(counts ?? []).length === 0 && <li className="p-3 text-sm text-muted-foreground">No vendors have listed markets yet.</li>}
        </ul>
      </section>
    </main>
  )
}
