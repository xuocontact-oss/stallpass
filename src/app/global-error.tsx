"use client"

/** Last-resort error screen (if even the main layout fails). Kept dependency-free. */
export default function GlobalError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "4rem 1rem", textAlign: "center" }}>
        <h1>Something went wrong</h1>
        <p>Sorry! Please try again in a moment.</p>
        <button onClick={() => retry()} style={{ padding: "0.6rem 1.2rem", marginTop: "1rem" }}>
          Try again
        </button>
      </body>
    </html>
  )
}
