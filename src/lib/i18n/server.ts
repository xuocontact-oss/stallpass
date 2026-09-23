import "server-only"
import { cache } from "react"
import { cookies } from "next/headers"
import { isLang, LANG_COOKIE, makeT, type Lang } from "./core"

/** The visitor's chosen language (from the language pop-up), English by default. */
export const getLang = cache(async (): Promise<Lang> => {
  const v = (await cookies()).get(LANG_COOKIE)?.value
  return isLang(v) ? v : "en"
})

export async function getT() {
  return makeT(await getLang())
}
