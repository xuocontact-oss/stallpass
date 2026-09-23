import { X } from "lucide-react"
import { ActionForm, SubmitButton } from "@/components/action-form"
import { ConfirmButton } from "@/components/confirm-button"
import { PhotoManager } from "@/components/photo-manager"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { addMarketDates, addMarketPhoto, removeMarketDate, removeMarketPhoto } from "@/actions/market-content"
import { formatDate, formatTime } from "@/lib/dates"
import { publicPhotoUrl } from "@/lib/storage"
import type { MarketDate, MarketPhoto } from "@/lib/types"

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

/** Add one date or a repeating schedule, and remove dates. (Admin and organizers.) */
export function MarketDatesEditor({ marketId, dates, today }: { marketId: string; dates: MarketDate[]; today: string }) {
  return (
      <section className="space-y-4 rounded-xl border bg-background p-4">
        <h2 className="font-semibold">Dates</h2>
        <ActionForm action={addMarketDates} resetOnSuccess className="space-y-3">
          <input type="hidden" name="market_id" value={marketId} />
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="from">Date (or first date)</Label>
              <Input id="from" name="from" type="date" required min={today} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="until">Repeat until (optional)</Label>
              <Input id="until" name="until" type="date" min={today} />
            </div>
          </div>
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium">If repeating, on these days</legend>
            <div className="flex flex-wrap gap-2">
              {WEEKDAYS.map((d, i) => (
                <label key={d} className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm has-checked:border-primary has-checked:bg-secondary">
                  <input type="checkbox" name="weekdays" value={i} className="accent-primary" />
                  {d}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="starts_at">Starts</Label>
              <Input id="starts_at" name="starts_at" type="time" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ends_at">Ends</Label>
              <Input id="ends_at" name="ends_at" type="time" />
            </div>
          </div>
          <SubmitButton pendingText="Adding…">Add date(s)</SubmitButton>
        </ActionForm>

        {dates.length ? (
          <ul className="grid gap-2 sm:grid-cols-2">
            {dates.map((d) => (
              <li key={d.id} className="flex items-center justify-between rounded-lg bg-muted/60 py-1 pr-1 pl-3 text-sm">
                <span>
                  {formatDate(d.event_date, { weekday: true })}
                  {d.starts_at && (
                    <span className="text-muted-foreground">
                      {" "}· {formatTime(d.starts_at)}
                      {d.ends_at && `–${formatTime(d.ends_at)}`}
                    </span>
                  )}
                </span>
                <ConfirmButton
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Remove date"
                  action={removeMarketDate.bind(null, d.id)}
                  confirmText={`Remove ${formatDate(d.event_date)}?`}
                >
                  <X />
                </ConfirmButton>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No upcoming dates yet.</p>
        )}
      </section>
  )
}

/** Market photos (admin and organizers). */
export function MarketPhotosEditor({ marketId, photos }: { marketId: string; photos: MarketPhoto[] }) {
  return (
      <section className="space-y-3 rounded-xl border bg-background p-4">
        <h2 className="font-semibold">Photos</h2>
        <PhotoManager
          bucket="market-photos"
          folder={marketId}
          max={8}
          photos={photos.map((p) => ({
            id: p.id,
            url: publicPhotoUrl("market-photos", p.path),
          }))}
          onAdd={addMarketPhoto.bind(null, marketId)}
          onRemove={removeMarketPhoto}
        />
      </section>
  )
}
