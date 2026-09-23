import { ActionForm, SubmitButton, selectClassName } from "@/components/action-form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { saveMarket } from "@/actions/admin-markets"
import { DOCUMENT_TYPES, FOOD_CATEGORIES, MARKET_TYPES } from "@/lib/constants"
import { boothFeesToText } from "@/lib/markets"
import type { ActionState } from "@/lib/form"
import type { Market } from "@/lib/types"

type Contact = { contact_name: string | null; contact_email: string | null; phone: string | null; notes: string | null }

function Field({
  name,
  label,
  hint,
  ...props
}: React.ComponentProps<typeof Input> & { name: string; label: string; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} {...props} />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

function Checkboxes({
  name,
  options,
  selected,
}: {
  name: string
  options: readonly { key: string; label: string }[]
  selected: string[]
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {options.map((o) => (
        <label key={o.key} className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name={name}
            value={o.key}
            defaultChecked={selected.includes(o.key)}
            className="size-4 accent-primary"
          />
          {o.label}
        </label>
      ))}
    </div>
  )
}

type Action = (state: ActionState, formData: FormData) => Promise<ActionState>

/** The market form. Admin mode shows private contact fields; organizers use their own account. */
export function MarketForm({
  market,
  contact,
  action = saveMarket,
  mode = "admin",
  submitLabel,
}: {
  market?: Market
  contact?: Contact | null
  action?: Action
  mode?: "admin" | "organizer"
  submitLabel?: string
}) {
  return (
    <ActionForm action={action} className="space-y-6">
      {market && <input type="hidden" name="id" value={market.id} />}

      <section className="space-y-4 rounded-xl border bg-background p-4">
        <h2 className="font-semibold">Basics</h2>
        <Field name="name" label="Market name" defaultValue={market?.name} required maxLength={120} />
        {market && (
          <Field
            name="slug"
            label="Web address"
            defaultValue={market.slug}
            required
            maxLength={80}
            hint={`Your page: /markets/${market.slug}`}
          />
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="market_type">Type</Label>
            <select id="market_type" name="market_type" defaultValue={market?.market_type ?? "farmers"} className={selectClassName}>
              {MARKET_TYPES.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <Field name="organizer_name" label="Run by" defaultValue={market?.organizer_name ?? ""} maxLength={120} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="description">Description</Label>
          <Textarea id="description" name="description" rows={4} maxLength={4000} defaultValue={market?.description ?? ""} />
        </div>
        <Field
          name="schedule_summary"
          label="Schedule in a few words"
          defaultValue={market?.schedule_summary ?? ""}
          maxLength={200}
          placeholder="Every Sunday, 9am–2pm, year-round"
          hint="Add the actual dates below after saving."
        />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="is_published" defaultChecked={market?.is_published ?? true} className="size-4 accent-primary" />
          Show this market in the directory
        </label>
      </section>

      <section className="space-y-4 rounded-xl border bg-background p-4">
        <h2 className="font-semibold">Location</h2>
        <Field name="address" label="Street address" defaultValue={market?.address} required maxLength={200} />
        <div className="grid grid-cols-6 gap-3">
          <div className="col-span-3">
            <Field name="city" label="City" defaultValue={market?.city} required maxLength={80} />
          </div>
          <div className="col-span-1">
            <Field name="state" label="State" defaultValue={market?.state ?? "CA"} required maxLength={40} />
          </div>
          <div className="col-span-2">
            <Field name="zip" label="ZIP" defaultValue={market?.zip ?? ""} maxLength={12} inputMode="numeric" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field name="lat" label="Latitude" defaultValue={market?.lat ?? ""} inputMode="decimal" />
          <Field name="lng" label="Longitude" defaultValue={market?.lng ?? ""} inputMode="decimal" />
        </div>
        <p className="-mt-2 text-xs text-muted-foreground">
          Leave latitude and longitude blank and we&apos;ll find them from the address. To move the pin,
          clear both boxes and save again.
        </p>
      </section>

      <section className="space-y-4 rounded-xl border bg-background p-4">
        <h2 className="font-semibold">For vendors</h2>
        <div className="space-y-1.5">
          <Label htmlFor="booth_fees">Booth fees (one per line)</Label>
          <Textarea
            id="booth_fees"
            name="booth_fees"
            rows={3}
            defaultValue={market ? boothFeesToText(market.booth_fees) : ""}
            placeholder={"10x10 tent: $75\nFood truck: $150"}
          />
        </div>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Documents vendors must have</legend>
          <Checkboxes
            name="required_doc_types"
            options={DOCUMENT_TYPES.filter((d) => d.key !== "other")}
            selected={market?.required_doc_types ?? ["health_permit", "liability_insurance"]}
          />
        </fieldset>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">
            Food categories wanted <span className="font-normal text-muted-foreground">(none ticked = all welcome)</span>
          </legend>
          <Checkboxes name="categories_wanted" options={FOOD_CATEGORIES} selected={market?.categories_wanted ?? []} />
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field name="application_deadline" label="Application deadline" type="date" defaultValue={market?.application_deadline ?? ""} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="application_notes">Application notes</Label>
          <Textarea id="application_notes" name="application_notes" rows={2} maxLength={1000} defaultValue={market?.application_notes ?? ""} />
        </div>
      </section>

      <section className="space-y-4 rounded-xl border bg-background p-4">
        <div>
          <h2 className="font-semibold">{mode === "admin" ? "Links and contact" : "Links"}</h2>
          {mode === "admin" && (
            <p className="text-xs text-muted-foreground">The contact details are private. Only you see them.</p>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field name="website" label="Website" defaultValue={market?.website ?? ""} maxLength={200} />
          <Field name="instagram" label="Instagram" defaultValue={market?.instagram ?? ""} maxLength={200} />
          {mode === "admin" && (
            <>
              <Field name="contact_name" label="Contact name (private)" defaultValue={contact?.contact_name ?? ""} maxLength={120} />
              <Field name="contact_email" label="Contact email (private)" type="email" defaultValue={contact?.contact_email ?? ""} maxLength={200} />
              <Field name="contact_phone" label="Contact phone (private)" type="tel" defaultValue={contact?.phone ?? ""} maxLength={30} />
            </>
          )}
        </div>
        {mode === "admin" && (
          <div className="space-y-1.5">
            <Label htmlFor="contact_notes">Private notes</Label>
            <Textarea id="contact_notes" name="contact_notes" rows={2} maxLength={1000} defaultValue={contact?.notes ?? ""} />
          </div>
        )}
      </section>

      <SubmitButton size="lg" className="w-full" pendingText="Saving…">
        {submitLabel ?? (market ? "Save market" : "Create market")}
      </SubmitButton>
    </ActionForm>
  )
}
