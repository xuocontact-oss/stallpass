"use client"

import { useT } from "@/lib/i18n/client"

/** Marks example content so nobody mistakes it for a real market or vendor. */
export function SampleBadge() {
  const { t } = useT()
  return (
    <span
      title={t("Example content to show how Stallpass works. Not a real business or event.")}
      className="inline-flex items-center shrink-0 rounded-md border-2 border-ink bg-white px-1.5 py-0.5 text-[10px] font-bold tracking-wider uppercase"
    >
      {t("Example")}
    </span>
  )
}
