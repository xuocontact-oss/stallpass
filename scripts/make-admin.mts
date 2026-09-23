/**
 * Makes an account the super admin.  Run:  npm run make-admin -- you@example.com
 * (Sign in to the app once with that email first, so the account exists.)
 */
import { createClient } from "@supabase/supabase-js"

const email = process.argv[2]?.trim().toLowerCase()
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const secretKey = process.env.SUPABASE_SECRET_KEY
if (!url || !secretKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in .env.local")
  process.exit(1)
}
if (!email) {
  console.error("Usage: npm run make-admin -- you@example.com")
  process.exit(1)
}

const db = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } })
const { data, error } = await db
  .from("profiles")
  .update({ is_super_admin: true })
  .eq("email", email)
  .select("email")
if (error) {
  console.error("Failed:", error.message)
  process.exit(1)
}
if (!data?.length) {
  console.error(`No account for ${email}. Sign in to the app once with that email, then run this again.`)
  process.exit(1)
}
console.log(`${email} is now the super admin. Refresh the app to see the Admin link.`)
