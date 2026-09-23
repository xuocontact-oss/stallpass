import { ActionForm, SubmitButton, selectClassName } from "@/components/action-form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { saveResource } from "@/actions/admin-resources"
import { RESOURCE_CATEGORY_LABELS } from "@/lib/start-guide"
import type { Resource } from "@/lib/types"

type PartnerDetails = {
  referral_url: string | null
  commission_terms: string | null
  contact_name: string | null
  contact_email: string | null
  notes: string | null
}

export function ResourceForm({ resource, partner }: { resource?: Resource; partner?: PartnerDetails | null }) {
  return (
    <ActionForm action={saveResource} className="space-y-4 rounded-xl border bg-background p-4">
      {resource && <input type="hidden" name="id" value={resource.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="category">Section</Label>
          <select id="category" name="category" defaultValue={resource?.category ?? "kitchen"} className={selectClassName}>
            {Object.entries(RESOURCE_CATEGORY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" required maxLength={120} defaultValue={resource?.name} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" name="description" rows={3} maxLength={1000} defaultValue={resource?.description ?? ""} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="url">Link</Label>
        <Input id="url" name="url" type="url" maxLength={500} placeholder="https://…" defaultValue={resource?.url ?? ""} />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="area">Area</Label>
          <Input id="area" name="area" maxLength={80} placeholder="e.g. Eastside, LA County" defaultValue={resource?.area ?? ""} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="price_note">Price</Label>
          <Input id="price_note" name="price_note" maxLength={120} placeholder="e.g. $25/hr · $180/day" defaultValue={resource?.price_note ?? ""} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="last_checked">Last checked</Label>
          <Input id="last_checked" name="last_checked" type="date" defaultValue={resource?.last_checked ?? ""} />
        </div>
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="is_published" defaultChecked={resource?.is_published ?? true} className="size-4 accent-primary" /> Show on Start page
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="is_official" defaultChecked={resource?.is_official} className="size-4 accent-primary" /> Official (government)
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="is_featured" defaultChecked={resource?.is_featured} className="size-4 accent-primary" /> Featured (shown first)
        </label>
        <label className="flex items-center gap-2">
          Order <Input name="position" type="number" min={0} max={999} defaultValue={resource?.position ?? 0} className="h-8 w-20" />
        </label>
      </div>
      <details className="rounded-lg border p-3" open={resource?.is_partner}>
        <summary className="cursor-pointer text-sm font-semibold">Partner deal (you earn per referral)</summary>
        <div className="mt-3 space-y-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="is_partner" defaultChecked={resource?.is_partner} className="size-4 accent-primary" />
            This is a paying partner (shows a &ldquo;Partner&rdquo; badge, the offer, and a commission notice)
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="promo_text">Offer vendors see</Label>
              <Input id="promo_text" name="promo_text" maxLength={200} placeholder="10% off your first policy" defaultValue={resource?.promo_text ?? ""} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="promo_code">Promo code</Label>
              <Input id="promo_code" name="promo_code" maxLength={40} placeholder="STALLPASS10" defaultValue={resource?.promo_code ?? ""} />
            </div>
          </div>
          <p className="text-xs font-medium text-muted-foreground">Private: only you see these</p>
          <div className="space-y-1.5">
            <Label htmlFor="referral_url">Tracking link from the partner</Label>
            <Input id="referral_url" name="referral_url" type="url" maxLength={1000} placeholder="https://partner.com/?ref=stallpass" defaultValue={partner?.referral_url ?? ""} />
            <p className="text-xs text-muted-foreground">Clicks go here instead of the normal link, so the partner can credit you.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="commission_terms">Deal terms</Label>
            <Input id="commission_terms" name="commission_terms" maxLength={500} placeholder="$25 per policy sold, paid monthly" defaultValue={partner?.commission_terms ?? ""} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="contact_name">Partner contact</Label>
              <Input id="contact_name" name="contact_name" maxLength={120} defaultValue={partner?.contact_name ?? ""} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contact_email">Contact email</Label>
              <Input id="contact_email" name="contact_email" type="email" maxLength={200} defaultValue={partner?.contact_email ?? ""} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="partner_notes">Notes</Label>
            <Textarea id="partner_notes" name="partner_notes" rows={2} maxLength={1000} defaultValue={partner?.notes ?? ""} />
          </div>
        </div>
      </details>
      <SubmitButton pendingText="Saving…">{resource ? "Save" : "Add resource"}</SubmitButton>
    </ActionForm>
  )
}
