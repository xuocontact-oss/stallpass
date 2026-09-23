import { Apple, Flower2, Moon, Shirt, Sparkles, Store, Tent, Truck } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * A colorful cover for markets without photos: color and icon depend on the
 * kind of market, with a light pattern so listings look alive.
 */
const THEMES: Record<string, { from: string; to: string; Icon: typeof Store }> = {
  farmers: { from: "#16a34a", to: "#84cc16", Icon: Apple },
  night: { from: "#312e81", to: "#7c3aed", Icon: Moon },
  food_truck: { from: "#ea580c", to: "#f59e0b", Icon: Truck },
  popup: { from: "#db2777", to: "#f97316", Icon: Tent },
  festival: { from: "#dc2626", to: "#f59e0b", Icon: Sparkles },
  craft: { from: "#0d9488", to: "#22d3ee", Icon: Flower2 },
  flea: { from: "#92400e", to: "#d97706", Icon: Shirt },
  other: { from: "#e0592a", to: "#f59e0b", Icon: Store },
}

export function MarketCover({ type, name, className, iconClassName }: { type: string; name: string; className?: string; iconClassName?: string }) {
  const theme = THEMES[type] ?? THEMES.other
  // A small twist per market so neighbours don't look identical.
  const angle = [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % 90
  const { Icon } = theme
  return (
    <div
      className={cn("relative grid place-items-center overflow-hidden", className)}
      style={{ background: `linear-gradient(${120 + angle}deg, ${theme.from}, ${theme.to})` }}
      aria-hidden
    >
      <div
        className="absolute inset-0 opacity-20"
        style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1.5px, transparent 0)", backgroundSize: "14px 14px" }}
      />
      <Icon className={cn("relative size-9 text-white drop-shadow", iconClassName)} strokeWidth={1.75} />
    </div>
  )
}
