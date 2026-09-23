import Link from "next/link"
import { notFound } from "next/navigation"
import { ResourceForm } from "@/components/admin/resource-form"
import { ConfirmButton } from "@/components/confirm-button"
import { deleteResource } from "@/actions/admin-resources"
import { requireAdmin } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import type { Resource } from "@/lib/types"

export const metadata = { title: "Edit resource · Admin" }

export default async function AdminResourcePage({ params }: PageProps<"/admin/resources/[id]">) {
  await requireAdmin()
  const { id } = await params
  const supabase = await createClient()
  const { data } = await supabase.from("resources").select("*").eq("id", id).maybeSingle()
  if (!data) notFound()
  const r = data as Resource
  const { data: partner } = await supabase.from("resource_partner_details").select("*").eq("resource_id", id).maybeSingle()
  return (
    <main className="space-y-4">
      <Link href="/admin/resources" className="text-sm text-muted-foreground">← Start hub</Link>
      <h1 className="text-2xl font-bold">{r.name}</h1>
      <ResourceForm resource={r} partner={partner} />
      {r.is_partner && (
        <Link href={`/admin/partners?resource=${r.id}`} className="text-sm font-medium text-primary">See this partner&apos;s clicks and sign-ups →</Link>
      )}
      <ConfirmButton variant="destructive" className="w-full" action={deleteResource.bind(null, r.id)} confirmText={`Delete ${r.name}?`} redirectTo="/admin/resources">
        Delete
      </ConfirmButton>
    </main>
  )
}
