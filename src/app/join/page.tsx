import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { BellRing, FileCheck2, Star } from "lucide-react"
import { CodeSignIn } from "@/components/code-sign-in"
import { getMyVendor, getUser } from "@/lib/auth"
import { cleanRef } from "@/lib/signup-source"
import { createClient } from "@/lib/supabase/server"

export const metadata: Metadata = {
  title: "Join Stallpass free",
  description: "Keep your permits in one place, get reminders before they expire, and apply to markets in two taps.",
}

/**
 * Where market QR codes and NFC cards lead: /join?m=<market>&ref=<who>.
 * Built for signing up at a booth in about two minutes on the vendor's phone.
 */
export default async function JoinPage({ searchParams }: PageProps<"/join">) {
  const params = await searchParams
  const slug = typeof params.m === "string" ? params.m.slice(0, 80) : ""
  const ref = cleanRef(typeof params.ref === "string" ? params.ref : null)

  const supabase = await createClient()
  const { data: market } = slug
    ? await supabase.from("markets").select("id, name").eq("slug", slug).maybeSingle()
    : { data: null }
  const next = `/onboarding?step=1${market ? `&m=${market.id}` : ""}`

  // Already signed in? Skip straight ahead.
  if (await getUser()) {
    redirect((await getMyVendor()) ? `/onboarding?step=2${market ? `&m=${market.id}` : ""}` : next)
  }

  return (
    <main className="mx-auto w-full max-w-md space-y-6 px-4 py-8">
      <div>
        {market && <p className="text-sm font-semibold text-primary">Hi from {market.name}! 👋</p>}
        <h1 className="mt-1 text-3xl leading-tight font-bold">Your permits, markets and applications, all in one place.</h1>
        <p className="mt-2 text-muted-foreground">Free for vendors. Takes about 2 minutes.</p>
      </div>

      <ul className="space-y-3 text-sm">
        <li className="flex gap-3">
          <FileCheck2 className="size-6 shrink-0 text-primary" aria-hidden />
          <span><span className="font-semibold">Snap your permits and insurance once.</span> Apply to any market in two taps.</span>
        </li>
        <li className="flex gap-3">
          <BellRing className="size-6 shrink-0 text-primary" aria-hidden />
          <span><span className="font-semibold">Never get caught out.</span> We remind you before anything expires.</span>
        </li>
        <li className="flex gap-3">
          <Star className="size-6 shrink-0 text-primary" aria-hidden />
          <span><span className="font-semibold">Find markets worth your time,</span> with honest reviews and real sales ranges from other vendors.</span>
        </li>
      </ul>

      <div className="rounded-2xl border-2 border-primary/30 bg-background p-4">
        <CodeSignIn next={next} market={market?.id ?? null} refCode={ref} buttonLabel="Get started" large />
      </div>
    </main>
  )
}
