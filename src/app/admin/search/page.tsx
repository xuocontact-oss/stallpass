import Link from "next/link"
import { requireAdmin } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"

export const metadata = { title: "Search · Admin" }

/** One search box for accounts, businesses and markets. */
export default async function AdminSearchPage({ searchParams }: PageProps<"/admin/search">) {
  await requireAdmin()
  const { q } = await searchParams
  const term = typeof q === "string" ? q.trim().slice(0, 100).replace(/[%,()*\\]/g, " ").trim() : ""
  const supabase = await createClient()
  const [accounts, vendors, markets] = term
    ? await Promise.all([
        supabase.from("profiles").select("id, email, full_name, vendors(id)").or(`email.ilike.%${term}%,full_name.ilike.%${term}%`).limit(20),
        supabase.from("vendors").select("id, business_name").ilike("business_name", `%${term}%`).limit(20),
        supabase.from("markets").select("id, name, city, state").or(`name.ilike.%${term}%,city.ilike.%${term}%`).limit(30),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }]

  const section = (title: string, items: { key: string; href: string; label: string; sub?: string }[]) => (
    <section className="space-y-2">
      <h2 className="font-semibold">
        {title} ({items.length})
      </h2>
      {items.length > 0 && (
        <ul className="divide-y rounded-xl border bg-background">
          {items.map((i) => (
            <li key={i.key}>
              <Link href={i.href} className="block p-3 text-sm hover:bg-muted/40">
                <span className="font-medium">{i.label}</span>
                {i.sub && <span className="text-muted-foreground"> · {i.sub}</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )

  return (
    <main className="space-y-5">
      <h1 className="text-2xl font-bold">Search</h1>
      <form>
        <input name="q" defaultValue={term} autoFocus placeholder="Email, name, business or market" className="h-11 w-full rounded-lg border bg-background px-3" />
      </form>
      {term && (
        <>
          {section(
            "Accounts",
            ((accounts.data ?? []) as unknown as { id: string; email: string; full_name: string | null; vendors: { id: string } | null }[]).map((a) => ({
              key: a.id,
              href: a.vendors ? `/admin/vendors/${a.vendors.id}` : `/admin/accounts?q=${encodeURIComponent(a.email)}`,
              label: a.full_name || a.email,
              sub: a.email,
            }))
          )}
          {section(
            "Businesses",
            ((vendors.data ?? []) as { id: string; business_name: string }[]).map((v) => ({ key: v.id, href: `/admin/vendors/${v.id}`, label: v.business_name }))
          )}
          {section(
            "Markets",
            ((markets.data ?? []) as { id: string; name: string; city: string; state: string }[]).map((m) => ({
              key: m.id,
              href: `/admin/markets/${m.id}`,
              label: m.name,
              sub: `${m.city}, ${m.state}`,
            }))
          )}
        </>
      )}
    </main>
  )
}
