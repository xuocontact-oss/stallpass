import Link from "next/link"
import { CONTACT_EMAIL, SITE_NAME } from "@/lib/site"

export function SiteFooter() {
  return (
    <footer className="mt-10 border-t bg-background">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-6 text-sm text-muted-foreground">
        <span>© {new Date().getFullYear()} {SITE_NAME}</span>
        <Link href="/start" className="hover:text-foreground">Start guide</Link>
        <Link href="/terms" className="hover:text-foreground">Terms</Link>
        <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
        <Link href="/review-guidelines" className="hover:text-foreground">Review guidelines</Link>
        <Link href="/partners" className="hover:text-foreground">How we make money</Link>
        <a href={`mailto:${CONTACT_EMAIL}`} className="hover:text-foreground">Contact</a>
      </div>
    </footer>
  )
}
