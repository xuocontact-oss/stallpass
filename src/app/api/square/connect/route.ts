import { randomBytes } from "node:crypto"
import { NextResponse, type NextRequest } from "next/server"
import { getMyVendor } from "@/lib/auth"
import { squareAuthorizeUrl, squareConfigured } from "@/lib/square"

/** "Connect Square": sends the vendor to Square to approve read-only access. */
export async function GET(request: NextRequest) {
  const back = new URL("/profile", request.nextUrl.origin)
  if (!squareConfigured()) {
    back.searchParams.set("square", "unavailable")
    return NextResponse.redirect(back)
  }
  const vendor = await getMyVendor()
  if (!vendor) return NextResponse.redirect(new URL("/login?next=/profile", request.nextUrl.origin))

  // A random "state" proves the reply from Square belongs to this browser.
  const state = randomBytes(24).toString("base64url")
  const res = NextResponse.redirect(squareAuthorizeUrl(state))
  res.cookies.set("sq_state", state, { httpOnly: true, secure: request.nextUrl.protocol === "https:", sameSite: "lax", maxAge: 600, path: "/" })
  return res
}
