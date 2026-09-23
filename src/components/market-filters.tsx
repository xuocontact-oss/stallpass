"use client"

import { useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { LocateFixed, SlidersHorizontal } from "lucide-react"
import { selectClassName } from "@/components/action-form"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { FOOD_CATEGORIES } from "@/lib/constants"
import { DISTANCE_OPTIONS, MAX_FEE_OPTIONS, WHEN_OPTIONS, type MarketFilters } from "@/lib/markets"

/** The directory filters. They live in the page address, so results can be shared or bookmarked. */
export function MarketFiltersForm({
  filters,
  view,
  defaultZip = "",
}: {
  filters: MarketFilters
  view: string
  /** e.g. a shopper's home ZIP, pre-filled when nothing else is set */
  defaultZip?: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [when, setWhen] = useState(filters.when)
  const [zip, setZip] = useState(filters.lat != null ? "" : filters.zip || defaultZip)
  const [point, setPoint] = useState(
    filters.lat != null && filters.lng != null ? { lat: filters.lat, lng: filters.lng } : null
  )
  const [locating, setLocating] = useState(false)
  const [locError, setLocError] = useState<string | null>(null)

  const activeCount = [filters.when, filters.category, filters.maxFee].filter(Boolean).length

  function useMyLocation() {
    setLocError(null)
    if (!navigator.geolocation) {
      setLocError("Your browser can't share location. Type your ZIP code instead.")
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = {
          lat: Math.round(pos.coords.latitude * 1000) / 1000,
          lng: Math.round(pos.coords.longitude * 1000) / 1000,
        }
        setPoint(p)
        setZip("")
        setLocating(false)
        // Show markets near you straight away.
        const params = new URLSearchParams(window.location.search)
        params.delete("zip")
        params.set("lat", String(p.lat))
        params.set("lng", String(p.lng))
        router.push(`${pathname}?${params}`)
      },
      () => {
        setLocError("Couldn't get your location. Type your ZIP code instead.")
        setLocating(false)
      },
      { timeout: 10000 }
    )
  }

  function apply(form: FormData) {
    const params = new URLSearchParams()
    for (const key of ["q", "when", "on", "miles", "category", "maxFee"]) {
      const v = form.get(key)
      if (typeof v === "string" && v.trim()) params.set(key, v.trim())
    }
    if (params.get("when") !== "date") params.delete("on")
    if (zip && /^\d{5}$/.test(zip)) {
      params.set("zip", zip)
    } else if (point) {
      params.set("lat", String(point.lat))
      params.set("lng", String(point.lng))
    }
    if (!params.get("zip") && !params.get("lat")) params.delete("miles")
    if (view === "map") params.set("view", "map")
    router.push(`${pathname}?${params}`)
    setOpen(false)
  }

  return (
    <form action={apply} className="space-y-3">
      <div className="flex gap-2">
        <Input
          inputMode="numeric"
          pattern="\\d{5}"
          maxLength={5}
          value={zip}
          onChange={(e) => {
            setZip(e.target.value.replace(/\D/g, "").slice(0, 5))
            if (e.target.value) setPoint(null)
          }}
          placeholder={point ? "Near me" : "ZIP code"}
          aria-label="ZIP code"
          className="w-28 shrink-0"
        />
        <Button type="button" variant="outline" size="icon-lg" className="size-10 shrink-0" onClick={useMyLocation} aria-label="Use my location" title="Use my location">
          <LocateFixed className={locating ? "animate-pulse" : undefined} />
        </Button>
        <Input name="q" defaultValue={filters.q} placeholder="Market or city name" aria-label="Search" />
      </div>

      {locError && <p className="text-sm text-destructive">{locError}</p>}
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm">Search</Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          <SlidersHorizontal />
          More filters{activeCount > 0 && ` (${activeCount})`}
        </Button>
      </div>

      <div className={open ? "space-y-4 rounded-xl border bg-background p-4" : "hidden"}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="when">When</Label>
            <select id="when" name="when" value={when} onChange={(e) => setWhen(e.target.value)} className={selectClassName}>
              {WHEN_OPTIONS.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </select>
            {when === "date" && (
              <Input name="on" type="date" defaultValue={filters.on} aria-label="Date" className="mt-2" />
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="category">Category</Label>
            <select id="category" name="category" defaultValue={filters.category} className={selectClassName}>
              <option value="">Any category</option>
              {FOOD_CATEGORIES.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="miles">Within</Label>
            <select id="miles" name="miles" defaultValue={String(filters.miles)} disabled={!zip && !point} className={selectClassName}>
              {DISTANCE_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {m} miles
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="maxFee">Booth fee up to</Label>
            <select id="maxFee" name="maxFee" defaultValue={filters.maxFee ? String(filters.maxFee) : ""} className={selectClassName}>
              <option value="">Any fee</option>
              {MAX_FEE_OPTIONS.map((f) => (
                <option key={f} value={f}>
                  ${f}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex gap-2">
          <Button type="submit" className="flex-1">
            Show markets
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setOpen(false)
              router.push(view === "map" ? `${pathname}?view=map` : pathname)
            }}
          >
            Clear
          </Button>
        </div>
      </div>
    </form>
  )
}
