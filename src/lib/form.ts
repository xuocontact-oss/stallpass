/** What every form action returns: an error to show, or a success message. */
export type ActionState = { error?: string; success?: string } | null

/** Only allow redirects to paths inside this app (blocks "open redirect" tricks). */
export function safeNextPath(next: string | null | undefined, fallback = "/dashboard"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return fallback
  }
  return next
}

/** Reads a trimmed text field from a form; empty strings become null. */
export function formText(formData: FormData, name: string): string | null {
  const value = formData.get(name)
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed === "" ? null : trimmed
}

/** Turns database errors into something a person can understand. */
export function friendlyDbError(error: { message: string; code?: string }): string {
  if (error.code === "42501" || /row-level security/i.test(error.message)) {
    return "You don't have permission to do that (or the account is read-only)."
  }
  if (error.code === "23505") return "That already exists."
  if (error.code === "23514") return "Some of the values aren't allowed. Check the lengths and try again."
  if (error.code === "P0001") return error.message // our own friendly messages from SQL
  console.error("Database error:", error)
  return "Something went wrong. Please try again."
}

/**
 * For pages: stop and show the error page if a database read failed,
 * instead of quietly showing an empty list.
 */
export function throwIfError(error: { message: string } | null, what: string) {
  if (error) throw new Error(`Couldn't load ${what}: ${error.message}`)
}
