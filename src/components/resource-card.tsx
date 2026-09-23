import { BadgeCheck, ExternalLink, Handshake } from "lucide-react"
import { ActionButton } from "@/components/action-button"
import { PromoCode } from "@/components/promo-code"
import { SampleBadge } from "@/components/sample-badge"
import { reportPartnerSignup } from "@/actions/partners"
import type { Resource } from "@/lib/types"

/** One Start-hub listing. Links go through /go/<id> so partner clicks are counted. */
export function ResourceCard({ r, page = "start", signedIn = false }: { r: Resource; page?: string; signedIn?: boolean }) {
  return (
    <div className={r.is_partner ? "rounded-lg border border-primary/40 bg-background p-3" : "rounded-lg border bg-background p-3"}>
      <div className="flex flex-wrap items-center gap-2">
        {r.url || r.is_partner ? (
          <a href={`/go/${r.id}?from=${page}`} target="_blank" rel="noopener nofollow sponsored" className="font-medium hover:underline">
            {r.name}
          </a>
        ) : (
          <span className="font-medium">{r.name}</span>
        )}
        {r.is_official && (
          <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-medium text-sky-800">
            <BadgeCheck className="size-3" /> Official
          </span>
        )}
        {r.is_partner && (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
            <Handshake className="size-3" /> Partner
          </span>
        )}
        {r.is_featured && !r.is_partner && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-900">Featured</span>
        )}
        {r.is_sample && <SampleBadge />}
      </div>
      {r.description && <p className="mt-1 text-sm text-muted-foreground">{r.description}</p>}

      {r.is_partner && (r.promo_text || r.promo_code) && (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-md bg-primary/5 p-2 text-sm">
          {r.promo_text && <span className="font-medium">{r.promo_text}</span>}
          {r.promo_code && <PromoCode resourceId={r.id} code={r.promo_code} page={page} />}
        </div>
      )}

      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {r.area && <span>{r.area}</span>}
        {r.price_note && <span className="font-medium text-foreground">{r.price_note}</span>}
        {(r.url || r.is_partner) && (
          <a href={`/go/${r.id}?from=${page}`} target="_blank" rel="noopener nofollow sponsored" className="inline-flex items-center gap-1 font-medium text-primary">
            <ExternalLink className="size-3" /> Visit
          </a>
        )}
        {r.is_partner && signedIn && (
          <ActionButton size="sm" variant="ghost" className="h-6 px-1.5 text-xs" action={reportPartnerSignup.bind(null, r.id)}>
            I signed up
          </ActionButton>
        )}
      </div>
      {r.is_partner && (
        <p className="mt-1.5 text-[11px] text-muted-foreground">Stallpass may earn a commission if you sign up. It doesn&apos;t change your price.</p>
      )}
    </div>
  )
}
