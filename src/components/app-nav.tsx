"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ClipboardList, FileText, House, MapPin, Store } from "lucide-react"
import { cn } from "@/lib/utils"
import { useT } from "@/lib/i18n/client"

const LINKS = [
  { href: "/dashboard", label: "Home", icon: House },
  { href: "/documents", label: "Docs", icon: FileText },
  { href: "/markets", label: "Markets", icon: MapPin },
  { href: "/applications", label: "Applied", icon: ClipboardList },
  { href: "/profile", label: "Profile", icon: Store },
]

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

/** Links along the top on computers. */
export function DesktopNav() {
  const pathname = usePathname()
  const { t } = useT()
  return (
    <nav className="hidden items-center gap-1 md:flex">
      {LINKS.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className={cn(
            "rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground",
            isActive(pathname, l.href) && "bg-secondary text-foreground"
          )}
        >
          {t(l.label)}
        </Link>
      ))}
    </nav>
  )
}

/** Thumb-friendly tab bar along the bottom on phones. */
export function MobileTabBar() {
  const pathname = usePathname()
  const { t } = useT()
  return (
    <nav className="fixed inset-x-0 bottom-0 z-[1000] border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <div className="mx-auto grid max-w-md grid-cols-5">
        {LINKS.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium text-muted-foreground",
                active && "text-primary"
              )}
            >
              <Icon className="size-5" aria-hidden />
              {t(label)}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
