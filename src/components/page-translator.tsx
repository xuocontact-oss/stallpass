"use client"

import { useEffect } from "react"

declare global {
  interface Window {
    googleTranslateElementInit?: () => void
    google?: { translate?: { TranslateElement: new (opts: Record<string, unknown>, id: string) => unknown } }
  }
}

/**
 * "Other language": Google's free page translator (100+ languages), shown as a
 * small bar. The page translator edits text directly, which can confuse React,
 * so we make those edits harmless first (a well-known fix).
 */
export function PageTranslator() {
  useEffect(() => {
    const proto = Node.prototype as unknown as {
      removeChild: <T extends Node>(child: T) => T
      insertBefore: <T extends Node>(node: T, ref: Node | null) => T
      __patched?: boolean
    }
    if (!proto.__patched) {
      const removeChild = proto.removeChild
      proto.removeChild = function <T extends Node>(this: Node, child: T): T {
        if (child.parentNode !== this) return child
        return removeChild.call(this, child) as T
      }
      const insertBefore = proto.insertBefore
      proto.insertBefore = function <T extends Node>(this: Node, node: T, ref: Node | null): T {
        if (ref && ref.parentNode !== this) return node
        return insertBefore.call(this, node, ref) as T
      }
      proto.__patched = true
    }
    window.googleTranslateElementInit = () => {
      if (window.google?.translate) {
        new window.google.translate.TranslateElement({ pageLanguage: "en", autoDisplay: false }, "page-translator")
      }
    }
    if (!document.getElementById("google-translate-script")) {
      const s = document.createElement("script")
      s.id = "google-translate-script"
      s.src = "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit"
      s.async = true
      document.body.appendChild(s)
    }
  }, [])

  return (
    <div className="border-b bg-secondary px-4 py-2 text-sm print:hidden">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2">
        <span className="text-muted-foreground">Translate this page:</span>
        <div id="page-translator" />
      </div>
    </div>
  )
}
