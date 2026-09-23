"use client"

import dynamic from "next/dynamic"

/** The map only works in the browser, so load it there. */
export const MarketMapLoader = dynamic(() => import("@/components/market-map"), {
  ssr: false,
  loading: () => <div className="h-[65vh] min-h-[360px] w-full animate-pulse rounded-xl bg-muted" />,
})
