import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <h1 className="text-2xl font-bold">We couldn&apos;t find that page</h1>
      <p className="text-muted-foreground">
        The link may be mistyped, or the page may have moved or be private to another account.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <Link href="/" className={buttonVariants()}>Go home</Link>
        <Link href="/markets" className={buttonVariants({ variant: "outline" })}>Find markets</Link>
        <Link href="/start" className={buttonVariants({ variant: "outline" })}>Get started guide</Link>
      </div>
    </main>
  )
}
