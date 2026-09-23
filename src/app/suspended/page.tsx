import { redirect } from "next/navigation"
import { signOut } from "@/actions/auth"
import { Button } from "@/components/ui/button"
import { getProfile } from "@/lib/auth"

export const metadata = { title: "Account suspended" }

export default async function SuspendedPage() {
  const profile = await getProfile()
  if (!profile?.suspended_at) redirect("/")
  return (
    <main className="mx-auto w-full max-w-md space-y-4 px-4 py-16 text-center">
      <h1 className="text-2xl font-bold">Your account is suspended</h1>
      <p className="text-muted-foreground">
        {profile.suspension_reason ? `Reason: ${profile.suspension_reason}. ` : ""}
        If you think this is a mistake, reply to any Stallpass email and we&apos;ll take a look.
      </p>
      <form action={signOut}>
        <Button type="submit" variant="outline">Sign out</Button>
      </form>
    </main>
  )
}
