"use client"

import { useEffect, useRef } from "react"

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string
      remove: (id: string) => void
    }
  }
}

const SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"

/**
 * Cloudflare's free "I'm not a robot" check. Adds a hidden
 * "cf-turnstile-response" field to the surrounding form. Shows nothing until
 * NEXT_PUBLIC_TURNSTILE_SITE_KEY is set.
 */
export function Turnstile() {
  const ref = useRef<HTMLDivElement>(null)
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

  useEffect(() => {
    if (!siteKey || !ref.current) return
    let widgetId: string | undefined
    const el = ref.current
    const render = () => {
      if (window.turnstile && el && !widgetId) widgetId = window.turnstile.render(el, { sitekey: siteKey, theme: "light", size: "flexible" })
    }
    if (window.turnstile) render()
    else {
      let s = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT}"]`)
      if (!s) {
        s = document.createElement("script")
        s.src = SCRIPT
        s.async = true
        document.head.appendChild(s)
      }
      s.addEventListener("load", render)
    }
    return () => {
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId)
    }
  }, [siteKey])

  if (!siteKey) return null
  return <div ref={ref} className="min-h-[65px]" />
}
