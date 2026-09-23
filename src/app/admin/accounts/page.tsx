import Link from "next/link"
import { ActionButton } from "@/components/action-button"
import { PromptButton } from "@/components/prompt-button"
import { adminDeleteAccount, setSuspended, setTrustedOrganizer } from "@/actions/admin-moderation"
import { requireAdmin } from "@/lib/auth"
import { formatDate } from "@/lib/dates"
import { throwIfError } from "@/lib/form"
import { createClient } from "@/lib/supabase/server"

export const metadata = { title: "Accounts · Admin" }

type Row = {
  id: string
  email: string
  full_name: string | null
  is_super_admin: boolean
  is_organizer: boolean
  is_trusted_organizer: boolean
  suspended_at: string | null
  suspension_reason: string | null
  created_at: string
  vendors: { id: string; business_name: string } | null
  markets: { id: string }[]
}

export default async function AdminAccountsPage({ searchParams }: PageProps<"/admin/accounts">) {
  await requireAdmin()
  const { q } = await searchParams
  const search = typeof q === "string" ? q.trim().slice(0, 100) : ""
  const supabase = await createClient()
  let query = supabase
    .from("profiles")
    .select("id, email, full_name, is_super_admin, is_organizer, is_trusted_organizer, is_shopper, suspended_at, suspension_reason, created_at, vendors(id, business_name), markets!markets_organizer_id_fkey(id)")
    .order("created_at", { ascending: false })
    .limit(300)
  if (search) query = query.or(`email.ilike.%${search.replace(/[%,()]/g, "")}%,full_name.ilike.%${search.replace(/[%,()]/g, "")}%`)
  const { data, error } = await query
  throwIfError(error, "accounts")
  const rows = (data ?? []) as unknown as Row[]

  return (
    <main className="space-y-4">
      <h1 className="text-2xl font-bold">Accounts</h1>
      <form className="flex gap-2">
        <input name="q" defaultValue={search} placeholder="Search email or name" className="h-10 flex-1 rounded-lg border bg-background px-3" />
      </form>
      <ul className="divide-y rounded-xl border bg-background">
        {rows.map((r) => {
          const inner = (
            <>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{r.full_name || r.email}</p>
                <p className="truncate text-sm text-muted-foreground">
                  {r.email} · joined {formatDate(r.created_at.slice(0, 10))}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap justify-end gap-1.5 text-xs">
                {r.is_super_admin && <span className="rounded-full bg-foreground px-2 py-0.5 text-background">Admin</span>}
                {r.suspended_at && (
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-red-800">
                    Suspended{r.suspension_reason ? `: ${r.suspension_reason}` : ""}
                  </span>
                )}
                {r.is_organizer && (
                  <span className="rounded-full bg-sky-100 px-2 py-0.5 text-sky-800">
                    Organizer{r.markets.length ? ` · ${r.markets.length} market${r.markets.length > 1 ? "s" : ""}` : ""}
                    {r.is_trusted_organizer && " · trusted ✓"}
                  </span>
                )}
                {r.vendors ? (
                  <span className="rounded-full bg-secondary px-2 py-0.5">Vendor: {r.vendors.business_name}</span>
                ) : (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">No business yet</span>
                )}
              </div>
            </>
          )
          return (
            <li key={r.id}>
              {r.vendors ? (
                <Link href={`/admin/vendors/${r.vendors.id}`} className="flex items-center gap-3 p-4 hover:bg-muted/40">{inner}</Link>
              ) : (
                <div className="flex items-center gap-3 p-4">{inner}</div>
              )}
              <div className="-mt-2 flex flex-wrap justify-end gap-1 px-4 pb-3">
                {r.is_organizer && (
                  <ActionButton size="sm" variant="ghost" action={setTrustedOrganizer.bind(null, r.id, !r.is_trusted_organizer)}>
                    {r.is_trusted_organizer ? "Remove trusted" : "Make trusted organizer"}
                  </ActionButton>
                )}
                {!r.is_super_admin &&
                  (r.suspended_at ? (
                    <ActionButton size="sm" variant="ghost" action={setSuspended.bind(null, r.id, false, undefined)}>
                      Unsuspend
                    </ActionButton>
                  ) : (
                    <PromptButton size="sm" variant="ghost" className="text-destructive" action={setSuspended.bind(null, r.id, true)} question="Why are you suspending this account? (They'll see this.)">
                      Suspend
                    </PromptButton>
                  ))}
                {!r.is_super_admin && (
                  <PromptButton
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    action={adminDeleteAccount.bind(null, r.id)}
                    question={`PERMANENTLY delete ${r.email} and all their data? Type a reason to confirm (e.g. "user request").`}
                  >
                    Delete
                  </PromptButton>
                )}
              </div>
            </li>
          )
        })}
        {rows.length === 0 && <li className="p-4 text-sm text-muted-foreground">No accounts found.</li>}
      </ul>
    </main>
  )
}
