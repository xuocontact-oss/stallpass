import Link from "next/link"
import { CheckCircle2, ChevronDown, Circle } from "lucide-react"
import { ResourceCard } from "@/components/resource-card"
import { buttonVariants } from "@/components/ui/button"
import { getMyVendor } from "@/lib/auth"
import { documentTypeLabel } from "@/lib/constants"
import { todayISO } from "@/lib/dates"
import { documentStatus } from "@/lib/documents"
import { COMMON_SECTIONS, FAQ, RESOURCE_CATEGORY_LABELS, suggestedTrack, TRACKS, trackSteps } from "@/lib/start-guide"
import { createClient } from "@/lib/supabase/server"
import type { Resource } from "@/lib/types"
import { cn } from "@/lib/utils"
import { getMyDocuments } from "@/lib/vendor-data"
import { getT } from "@/lib/i18n/server"

export const metadata = {
  title: "Start selling at LA markets",
  description:
    "Step-by-step for new vendors (food, food trucks, packaged food, clothing, crafts and more): permits, insurance, shared kitchens, and what to bring.",
}

/** The all-in-one guide for anyone who's never sold at a market before. */
export default async function StartPage({ searchParams }: PageProps<"/start">) {
  const { track: trackParam } = await searchParams
  const supabase = await createClient()
  const { data } = await supabase
    .from("resources")
    .select("*")
    .eq("is_published", true)
    .order("is_partner", { ascending: false })
    .order("is_featured", { ascending: false })
    .order("position")
  const resources = (data ?? []) as Resource[]

  const vendor = await getMyVendor()
  const today = todayISO()
  const have = new Set<string>()
  if (vendor) {
    for (const d of await getMyDocuments(vendor.id)) {
      if (documentStatus(d.expiration_date, today) !== "expired") have.add(d.doc_type)
    }
  }

  const t = await getT()
  const track =
    TRACKS.find((tr) => tr.key === trackParam) ??
    (vendor ? TRACKS.find((tr) => tr.key === suggestedTrack(vendor.category, vendor.setup_type)) : undefined)
  const steps = track ? trackSteps(track) : []
  const docSteps = steps.filter((s) => s.docType)
  const done = new Set(docSteps.filter((s) => have.has(s.docType!)).map((s) => s.docType)).size
  const docTotal = new Set(docSteps.map((s) => s.docType)).size
  const kitchens = resources.filter((r) => r.category === "kitchen")
  const supplies = resources.filter((r) => r.category === "supplies")

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6">
      <div>
        <p className="text-sm font-medium text-primary">{t("New to markets?")}</p>
        <h1 className="text-2xl font-bold sm:text-3xl">{t("Start selling at LA markets")}</h1>
        <p className="mt-1 text-muted-foreground">
          {t("Food, clothing, crafts, art or anything else: here's exactly what you need, in order, with links to get it done.")}
        </p>
      </div>

      <section className="space-y-2">
        <h2 className="font-semibold">{t("What will you sell?")}</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {TRACKS.map((tr) => (
            <Link
              key={tr.key}
              href={`/start?track=${tr.key}#steps`}
              scroll={false}
              className={cn(
                "rounded-xl border bg-background p-3 transition-colors",
                track?.key === tr.key ? "border-primary bg-secondary ring-1 ring-primary" : "hover:border-primary/50"
              )}
            >
              <span className="block font-semibold">{t(tr.label)}</span>
              <span className="block text-sm text-muted-foreground">{t(tr.examples)}</span>
            </Link>
          ))}
        </div>
      </section>

      {track && (
        <section id="steps" className="scroll-mt-20 space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <h2 className="text-lg font-semibold">{t("Your steps:")} {t(track.label).toLowerCase()}</h2>
            {vendor ? (
              <span className="text-sm text-muted-foreground">
                {t("{done} of {total} documents uploaded", { done, total: docTotal })}
              </span>
            ) : (
              <Link href={`/login?next=${encodeURIComponent(`/start?track=${track.key}`)}`} className="text-sm font-medium text-primary">
                {t("Join free to track your progress")}
              </Link>
            )}
          </div>
          {vendor && docTotal > 0 && (
            <div className="h-2.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${(done / docTotal) * 100}%` }} />
            </div>
          )}

          <ol className="space-y-3">
            {steps.map((step, i) => {
              const isDone = step.docType ? have.has(step.docType) : false
              const stepResources = resources.filter((r) => step.resourceCategories.includes(r.category) && r.category !== "kitchen")
              const showKitchens = step.resourceCategories.includes("kitchen")
              return (
                <li key={step.key}>
                  <details className="group rounded-xl border bg-background" open={!isDone && i < 2}>
                    <summary className="flex cursor-pointer list-none items-start gap-3 p-4">
                      {isDone ? (
                        <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-emerald-600" aria-label={t("Done")} />
                      ) : (
                        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-secondary text-sm font-semibold">{i + 1}</span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold">{t(step.title)}</span>
                        <span className="text-sm text-muted-foreground">{t(step.summary)}</span>
                      </span>
                      <ChevronDown className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
                    </summary>
                    <div className="space-y-3 border-t px-4 pt-3 pb-4">
                      <ul className="space-y-1.5 text-sm">
                        {step.details.map((d) => (
                          <li key={d} className="flex gap-2">
                            <Circle className="mt-1.5 size-2 shrink-0 fill-current text-muted-foreground" aria-hidden />
                            {t(d)}
                          </li>
                        ))}
                      </ul>
                      {stepResources.length > 0 && (
                        <div className="space-y-2">
                          {stepResources.map((r) => (
                            <ResourceCard key={r.id} r={r} signedIn={Boolean(vendor)} />
                          ))}
                        </div>
                      )}
                      {showKitchens && kitchens.length > 0 && (
                        <a href="#kitchens" className="inline-block text-sm font-medium text-primary">
                          {t("See {n} shared kitchens below ↓", { n: kitchens.length })}
                        </a>
                      )}
                      {step.docType && vendor && (
                        <Link
                          href={isDone ? "/documents" : `/documents/new?type=${step.docType}`}
                          className={buttonVariants({ variant: isDone ? "outline" : "default", size: "sm" })}
                        >
                          {isDone
                            ? t("{doc} uploaded ✓", { doc: t(documentTypeLabel(step.docType)) })
                            : t("Upload your {doc}", { doc: t(documentTypeLabel(step.docType)).toLowerCase() })}
                        </Link>
                      )}
                    </div>
                  </details>
                </li>
              )
            })}
          </ol>
        </section>
      )}

      {!track && (
        <p className="rounded-xl border border-dashed bg-background p-4 text-sm text-muted-foreground">
          {t("Pick what you'll sell above to see your step-by-step list.")}
        </p>
      )}

      {track && ["prepared", "truck", "packaged"].includes(track.key) && kitchens.length > 0 && (
        <section id="kitchens" className="scroll-mt-20 space-y-2">
          <h2 className="text-lg font-semibold">{t(RESOURCE_CATEGORY_LABELS.kitchen)}</h2>
          <p className="text-sm text-muted-foreground">{t("Rent prep space by the hour or day, or a commissary for your truck.")}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {kitchens.map((r) => (
              <ResourceCard key={r.id} r={r} signedIn={Boolean(vendor)} />
            ))}
          </div>
        </section>
      )}

      {COMMON_SECTIONS.map((section) => (
        <details key={section.key} className="group rounded-xl border bg-background" open={section.key === "kit"}>
          <summary className="flex cursor-pointer list-none items-center justify-between p-4 font-semibold">
            {t(section.title)}
            <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <ul className="space-y-1.5 border-t px-4 pt-3 pb-4 text-sm">
            {section.items.map((item) => (
              <li key={item} className="flex gap-2">
                <Circle className="mt-1.5 size-2 shrink-0 fill-current text-muted-foreground" aria-hidden />
                {t(item)}
              </li>
            ))}
          </ul>
          {section.key === "kit" && supplies.length > 0 && (
            <div className="space-y-2 px-4 pb-4">
              {supplies.map((r) => (
                <ResourceCard key={r.id} r={r} signedIn={Boolean(vendor)} />
              ))}
            </div>
          )}
        </details>
      ))}

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">{t("Common questions")}</h2>
        {FAQ.map((f) => (
          <details key={f.q} className="group rounded-xl border bg-background">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 font-medium">
              {t(f.q)}
              <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
            </summary>
            <p className="border-t px-4 pt-3 pb-4 text-sm">{t(f.a)}</p>
          </details>
        ))}
      </section>

      <div className="rounded-xl bg-secondary p-4 text-sm">
        <p className="font-semibold">{t("Ready?")}</p>
        <p className="mt-1">
          {vendor
            ? t("Upload each document as you get it, then find a market and tap Quick apply.")
            : t("Join free: keep your permits in one place, get reminders before they expire, and apply to markets in a couple of taps.")}
        </p>
        <Link href={vendor ? "/markets" : "/login?next=/start"} className={buttonVariants({ size: "sm", className: "mt-3" })}>
          {vendor ? t("Find markets") : t("Join free")}
        </Link>
      </div>

      <p className="text-xs text-muted-foreground">
        {t("General information for the LA area, not legal advice. Rules differ by city and change, so confirm with the agency before you apply. Stallpass doesn't endorse listed businesses; partners are labeled.")}
      </p>
    </main>
  )
}
