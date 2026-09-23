import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

const SIGNED_IN_ONLY = ["/dashboard", "/documents", "/profile", "/onboarding", "/admin", "/applications", "/organizer", "/account"]

/**
 * Runs before every page request. It keeps the login session fresh and sends
 * signed-out visitors to the login page. (Real permission checks happen on the
 * server and in the database, not here.)
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
          Object.entries(headers ?? {}).forEach(([key, value]) =>
            response.headers.set(key, value)
          )
        },
      },
    }
  )

  const { data } = await supabase.auth.getClaims()
  const signedIn = Boolean(data?.claims)
  const path = request.nextUrl.pathname

  if (!signedIn && SIGNED_IN_ONLY.some((p) => path === p || path.startsWith(`${p}/`))) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    url.search = `?next=${encodeURIComponent(path)}`
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|api/|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
}
