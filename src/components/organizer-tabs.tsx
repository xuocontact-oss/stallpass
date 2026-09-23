"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

export function OrganizerTabs({ marketId, newCount }: { marketId: string; newCount: number }) {
  const pathname = usePathname()
  const base = `/organizer/markets/${marketId}`
  const tabs = [
    { href: base, label: "Overview", exact: true },
    { href: `${base}/applications`, label: newCount ? `Applications (${newCount})` : "Applications" },
    { href: `${base}/reviews`, label: "Reviews" },
    { href: `${base}/edit`, label: "Edit market" },
  ]
  return (
    <nav className="-mx-4 flex gap-1 overflow-x-auto border-b px-4">
      {tabs.map((t) => {
        const active = t.exact ? pathname === t.href : pathname.startsWith(t.href)
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium",
              active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
          </Link>
        )
      })}
    </nav>
  )
}
