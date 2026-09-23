import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"

export const metadata = { title: "Finish later" }

export default function FinishLaterPage() {
  return (
    <main className="mx-auto w-full max-w-md space-y-4 px-4 py-16 text-center">
      <h1 className="text-2xl font-bold">No problem, you&apos;re signed up!</h1>
      <p className="text-muted-foreground">
        We&apos;ll send you one reminder tomorrow. Whenever you&apos;re ready, sign in with your email and you&apos;ll pick up
        where you left off.
      </p>
      <Link href="/onboarding" className={buttonVariants({ size: "lg" })}>Actually, let&apos;s finish now</Link>
    </main>
  )
}
