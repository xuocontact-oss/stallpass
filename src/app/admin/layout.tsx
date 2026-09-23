import Link from "next/link"
import { requireAdmin } from "@/lib/auth"

/** Every /admin page checks on the server that you're the super admin. */
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await requireAdmin()
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6">
      <nav className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-medium">
        <span className="rounded bg-foreground px-2 py-0.5 text-xs text-background">ADMIN</span>
        <Link href="/admin" className="hover:text-primary">Overview</Link>
        <Link href="/admin/approvals" className="hover:text-primary">Approvals</Link>
        <Link href="/admin/accounts" className="hover:text-primary">Accounts</Link>
        <Link href="/admin/vendors" className="hover:text-primary">Vendors</Link>
        <Link href="/admin/documents" className="hover:text-primary">Documents</Link>
        <Link href="/admin/markets" className="hover:text-primary">Markets</Link>
        <Link href="/admin/applications" className="hover:text-primary">Applications</Link>
        <Link href="/admin/reviews" className="hover:text-primary">Reviews</Link>
        <Link href="/admin/payments" className="hover:text-primary">Payments</Link>
        <Link href="/admin/resources" className="hover:text-primary">Start hub</Link>
        <Link href="/admin/partners" className="hover:text-primary">Partners</Link>
        <Link href="/admin/settings" className="hover:text-primary">Settings</Link>
        <Link href="/admin/audit" className="hover:text-primary">Audit log</Link>
        <Link href="/admin/search" className="hover:text-primary">Search</Link>
      </nav>
      {children}
    </div>
  )
}
