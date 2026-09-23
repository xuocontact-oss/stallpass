import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { SampleBadge } from "@/components/sample-badge"
import { requireAdmin } from "@/lib/auth"
import { categoryLabel } from "@/lib/constants"
import { throwIfError } from "@/lib/form"
import { createClient } from "@/lib/supabase/server"

export const metadata = { title: "Vendors · Admin" }

export default async function AdminVendorsPage({ searchParams }: PageProps<"/admin/vendors">) {
  await requireAdmin()
  const { q } = await searchParams
  const search = typeof q === "string" ? q.trim().slice(0, 100).replace(/[%,()]/g, "") : ""
  const supabase = await createClient()
  let query = supabase
    .from("vendors")
    .select("id, business_name, category, is_sample, profiles!vendors_owner_id_fkey(email), vendor_documents(count), applications(count)")
    .order("business_name")
    .limit(300)
  if (search) query = query.ilike("business_name", `%${search}%`)
  const { data, error } = await query
  throwIfError(error, "vendors")
  const rows = (data ?? []) as unknown as {
    id: string
    business_name: string
    category: string
    is_sample: boolean
    profiles: { email: string } | null
    vendor_documents: { count: number }[]
    applications: { count: number }[]
  }[]

  return (
    <main className="space-y-4">
      <h1 className="text-2xl font-bold">Vendors</h1>
      <form>
        <input name="q" defaultValue={search} placeholder="Search business name" className="h-10 w-full rounded-lg border bg-background px-3" />
      </form>
      <ul className="divide-y rounded-xl border bg-background">
        {rows.map((v) => (
          <li key={v.id}>
            <Link href={`/admin/vendors/${v.id}`} className="flex items-center gap-3 p-4 hover:bg-muted/40">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 font-medium">
                  <span className="truncate">{v.business_name}</span> {v.is_sample && <SampleBadge />}
                </p>
                <p className="truncate text-sm text-muted-foreground">
                  {categoryLabel(v.category)} · {v.profiles?.email} · {v.vendor_documents[0]?.count ?? 0} docs ·{" "}
                  {v.applications[0]?.count ?? 0} applications
                </p>
              </div>
              <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        ))}
        {rows.length === 0 && <li className="p-4 text-sm text-muted-foreground">No vendors found.</li>}
      </ul>
    </main>
  )
}
