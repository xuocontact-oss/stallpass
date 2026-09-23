import "server-only"
import { createServerClient } from "@supabase/ssr"
import { createClient as createPlainClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"

/**
 * Supabase client that acts AS THE SIGNED-IN USER.
 * Every query goes through Row Level Security, so it can only see and change
 * what that user is allowed to. Use this for almost everything.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Pages can't set cookies; the proxy refreshes the session instead.
          }
        },
      },
    }
  )
}

/**
 * Supabase client with FULL ACCESS that skips Row Level Security.
 * Only for trusted server code (webhooks, admin panel) after checking
 * permissions yourself. Never use it with unchecked user input.
 */
export function createAdminClient() {
  return createPlainClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}
