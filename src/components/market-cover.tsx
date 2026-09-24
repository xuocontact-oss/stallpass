import Image, { type StaticImageData } from "next/image"
import farmersCrowd from "@/assets/photos/farmers-crowd.jpg"
import farmersMarket from "@/assets/photos/farmers-market.jpg"
import nightCooking from "@/assets/photos/night-market-cooking.jpg"
import nightCrowd from "@/assets/photos/night-market-crowd.jpg"
import nightNoodles from "@/assets/photos/night-market-noodles.jpg"
import plantStall from "@/assets/photos/plant-stall.jpg"
import streetwear from "@/assets/photos/streetwear-vendor.jpg"
import tacoTruck from "@/assets/photos/taco-truck.jpg"
import truckLine from "@/assets/photos/truck-line.jpg"
import truckNight from "@/assets/photos/truck-night.jpg"
import { cn } from "@/lib/utils"

/**
 * Cover for markets without their own photos: a market awning in the colour of
 * the kind of market. Example markets get a stock photo so the demo looks real
 * (real markets never get a photo that isn't theirs).
 */
const STRIPES: Record<string, { a: string; b: string }> = {
  farmers: { a: "#2f6b3a", b: "#e3eedf" },
  night: { a: "#1b1a17", b: "#3a3830" },
  food_truck: { a: "#c7402b", b: "#f9e3de" },
  popup: { a: "#f2c94c", b: "#fff6da" },
  festival: { a: "#c7402b", b: "#fff6da" },
  craft: { a: "#1f6f78", b: "#dcefef" },
  flea: { a: "#8a5a2b", b: "#f3e6d6" },
  other: { a: "#c7402b", b: "#f4eee2" },
}

const PHOTOS: Record<string, StaticImageData[]> = {
  farmers: [farmersCrowd, farmersMarket, plantStall],
  night: [nightCooking, nightNoodles, nightCrowd],
  food_truck: [tacoTruck, truckLine, truckNight],
  popup: [streetwear, farmersMarket, plantStall],
  festival: [farmersMarket, truckLine, nightCrowd],
  craft: [plantStall, streetwear],
  flea: [streetwear, plantStall],
  other: [farmersMarket, streetwear],
}

export function MarketCover({
  type,
  name = "",
  sample = false,
  className,
  sizes = "200px",
  priority = false,
}: {
  type: string
  name?: string
  sample?: boolean
  className?: string
  sizes?: string
  priority?: boolean
}) {
  if (sample) {
    // Pick by name so neighbouring markets of the same kind look different.
    const list = PHOTOS[type] ?? PHOTOS.other
    const photo = list[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % list.length]
    return (
      <div className={cn("relative overflow-hidden", className)}>
        <Image src={photo} alt="" fill sizes={sizes} priority={priority} placeholder="blur" className="object-cover" />
      </div>
    )
  }
  const s = STRIPES[type] ?? STRIPES.other
  return (
    <div className={cn("relative overflow-hidden", className)} aria-hidden>
      <div className="absolute inset-0" style={{ background: `repeating-linear-gradient(90deg, ${s.a} 0 28px, ${s.b} 28px 56px)` }} />
      {/* Scalloped awning edge */}
      <div
        className="absolute inset-x-0 bottom-0 h-3"
        style={{ background: `radial-gradient(circle at 14px 0, transparent 13px, var(--paper) 14px) 0 0 / 28px 12px repeat-x` }}
      />
    </div>
  )
}
