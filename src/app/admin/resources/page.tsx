import Link from "next/link"
import { ExternalLink } from "lucide-react"
import { ResourceForm } from "@/components/admin/resource-form"
import { SampleBadge } from "@/components/sample-badge"
import { requireAdmin } from "@/lib/auth"
import { formatDate } from "@/lib/dates"
import { RESOURCE_CATEGORY_LABELS } from "@/lib/start-guide"
import { createClient } from "@/lib/supabase/server"
import type { Resource } from "@/lib/types"

export const metadata = { title: "Start hub · Admin" }

export default async function AdminResourcesPage() {
  await requireAdmin()
  const supabase = await createClient()
  const { data } = await supabase.from("resources").select("*").order("category").order("position")
  const resources = (data ?? []) as Resource[]
  const groups = Object.keys(RESOURCE_CATEGORY_LABELS).filter((c) => resources.some((r) => r.category === c))

  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Start hub resources</h1>
        <Link href="/admin/partners" className="text-sm font-medium text-primary">Partner report →</Link>
        <Link href="/start" className="flex items-center gap-1 text-sm text-primary">
          <ExternalLink className="size-4" /> View Start page
        </Link>
      </div>
      <p className="text-sm text-muted-foreground">
        Links shown to new vendors on the Start page. Re-check official links now and then; agencies move pages. Replace the
        SAMPLE kitchens with real ones in your area.
      </p>
      {groups.map((c) => (
        <section key={c} className="space-y-2">
          <h2 className="font-semibold">{RESOURCE_CATEGORY_LABELS[c]}</h2>
          <ul className="divide-y rounded-xl border bg-background">
            {resources
              .filter((r) => r.category === c)
              .map((r) => (
                <li key={r.id}>
                  <Link href={`/admin/resources/${r.id}`} className="flex flex-wrap items-center gap-2 p-3 text-sm hover:bg-muted/40">
                    <span className="font-medium">{r.name}</span>
                    {r.is_sample && <SampleBadge />}
                    {!r.is_published && <span className="rounded-full bg-stone-200 px-2 py-0.5 text-xs">Hidden</span>}
                    {r.is_featured && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs">Featured</span>}
                    {r.is_partner && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">Partner</span>}
                    <span className="ml-auto text-xs text-muted-foreground">
                      {r.last_checked ? `checked ${formatDate(r.last_checked)}` : "never checked"}
                    </span>
                  </Link>
                </li>
              ))}
          </ul>
        </section>
      ))}
      <section className="space-y-2">
        <h2 className="font-semibold">Add a resource</h2>
        <ResourceForm />
      </section>
    </main>
  )
}
