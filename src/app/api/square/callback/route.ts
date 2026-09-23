import { NextResponse, type NextRequest } from "next/server"
import { getMyVendor } from "@/lib/auth"
import { saveSquareConnection } from "@/lib/square"

/** Square sends the vendor back here after they approve (or decline). */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const back = new URL("/profile", request.nextUrl.origin)
  const expected = request.cookies.get("sq_state")?.value
  const vendor = await getMyVendor()

  let result = "failed"
  if (params.get("error")) result = "declined"
  else if (vendor && expected && params.get("state") === expected && params.get("code")) {
    try {
      await saveSquareConnection(vendor.id, params.get("code")!)
      result = "connected"
    } catch (e) {
      console.error("Square connect failed:", e)
    }
  }
  back.searchParams.set("square", result)
  back.hash = "connected-apps"
  const res = NextResponse.redirect(back)
  res.cookies.delete("sq_state")
  return res
}
