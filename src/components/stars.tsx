import { Star } from "lucide-react"
import { cn } from "@/lib/utils"

/** Read-only stars, e.g. ★★★★☆ for 4.3. */
export function Stars({ value, className }: { value: number | null; className?: string }) {
  const v = value ?? 0
  return (
    <span className={cn("inline-flex items-center", className)} aria-label={value == null ? "No rating" : `${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          aria-hidden
          className={cn("size-4", v >= i - 0.25 ? "fill-amber-400 text-amber-400" : "fill-stone-200 text-stone-200")}
        />
      ))}
    </span>
  )
}
