"use client"

import { useEffect } from "react"
import Link from "next/link"
import { Button, buttonVariants } from "@/components/ui/button"

/** Shown instead of a blank screen if a page breaks. */
export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <h1 className="text-2xl font-bold">Something went wrong</h1>
      <p className="text-muted-foreground">
        Sorry about that. Try again, and if it keeps happening, let us know what you were doing.
        {error.digest && <span className="mt-2 block text-xs">Error code: {error.digest}</span>}
      </p>
      <div className="flex gap-2">
        <Button onClick={() => retry()}>Try again</Button>
        <Link href="/" className={buttonVariants({ variant: "outline" })}>Go home</Link>
      </div>
    </main>
  )
}
