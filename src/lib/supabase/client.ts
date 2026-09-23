import { createBrowserClient } from "@supabase/ssr"

/**
 * Supabase client for the BROWSER, acting as the signed-in user.
 * Used only for uploading files straight to storage (so big files don't pass
 * through our server). Row Level Security decides where uploads may go.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  )
}
