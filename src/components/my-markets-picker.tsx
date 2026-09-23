"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Plus, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { addMyMarket, removeMyMarket, searchMarketsForPicker } from "@/actions/vendor"

type M = { id: string; name: string; city: string; state: string }

/** "Markets you already sell at": search, tap to add, x to remove. */
export function MyMarketsPicker({ selected }: { selected: M[] }) {
  const router = useRouter()
  const [q, setQ] = useState("")
  const [results, setResults] = useState<M[]>([])
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    const t = setTimeout(async () => setResults(q.trim().length >= 2 ? await searchMarketsForPicker(q) : []), 250)
    return () => clearTimeout(t)
  }, [q])

  const run = (fn: () => Promise<{ error?: string; success?: string } | null>) =>
    startTransition(async () => {
      const r = await fn()
      if (r?.error) toast.error(r.error)
      router.refresh()
    })

  const chosen = new Set(selected.map((m) => m.id))
  return (
    <div className="space-y-3">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.map((m) => (
            <span key={m.id} className="inline-flex items-center gap-1 rounded-full bg-secondary py-1 pr-1 pl-3 text-sm">
              {m.name}
              <button type="button" aria-label={`Remove ${m.name}`} disabled={pending} onClick={() => run(() => removeMyMarket(m.id))} className="grid size-6 place-items-center rounded-full hover:bg-background">
                <X className="size-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a market or city" aria-label="Search markets" />
      {results.length > 0 && (
        <ul className="divide-y rounded-lg border bg-background">
          {results.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                disabled={pending || chosen.has(m.id)}
                onClick={() => run(async () => { const r = await addMyMarket(m.id); setQ(""); return r })}
                className="flex w-full items-center gap-2 p-2.5 text-left text-sm hover:bg-muted/40 disabled:opacity-50"
              >
                <Plus className="size-4 text-primary" aria-hidden />
                <span className="font-medium">{m.name}</span>
                <span className="text-muted-foreground">
                  {m.city}, {m.state}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
