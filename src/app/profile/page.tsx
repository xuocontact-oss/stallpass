import { ActionForm, SubmitButton } from "@/components/action-form"
import { ConfirmButton } from "@/components/confirm-button"
import { MyMarketsPicker } from "@/components/my-markets-picker"
import { buttonVariants } from "@/components/ui/button"
import { disconnectSquareAction } from "@/actions/sales"
import { squareConfigured } from "@/lib/square"
import { PhotoManager } from "@/components/photo-manager"
import { SampleBadge } from "@/components/sample-badge"
import { VendorBasicFields, VendorDetailFields } from "@/components/vendor-fields"
import { addVendorPhoto, removeVendorPhoto, updateVendor } from "@/actions/vendor"
import { requireVendor } from "@/lib/auth"
import { MAX_VENDOR_PHOTOS } from "@/lib/constants"
import { publicPhotoUrl } from "@/lib/storage"
import { createClient } from "@/lib/supabase/server"
import { getMyPhotos } from "@/lib/vendor-data"

export const metadata = { title: "Business profile" }

export default async function ProfilePage({ searchParams }: PageProps<"/profile">) {
  const { square: squareResult } = await searchParams
  const { vendor } = await requireVendor()
  const photos = await getMyPhotos(vendor.id)
  const supabase = await createClient()
  const { data: mine } = await supabase.from("vendor_markets").select("markets(id, name, city, state)").eq("vendor_id", vendor.id)
  const { data: squareConn } = await supabase.from("my_pos_connections").select("business_name, created_at").eq("provider", "square").maybeSingle()
  const sellsAt = ((mine ?? []) as unknown as { markets: { id: string; name: string; city: string; state: string } | null }[])
    .map((r) => r.markets)
    .filter((m): m is { id: string; name: string; city: string; state: string } => m !== null)

  return (
    <main className="mx-auto w-full max-w-2xl space-y-5 px-4 py-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          Business profile {vendor.is_sample && <SampleBadge />}
        </h1>
        <p className="text-sm text-muted-foreground">
          Markets see this when you apply, so make it look good.
        </p>
      </div>

      <section className="space-y-3 rounded-xl border bg-background p-4">
        <div>
          <h2 className="font-semibold">Photos</h2>
          <p className="text-sm text-muted-foreground">
            Your booth or truck, your food, your setup. Up to {MAX_VENDOR_PHOTOS}.
          </p>
        </div>
        <PhotoManager
          bucket="vendor-photos"
          folder={vendor.id}
          max={MAX_VENDOR_PHOTOS}
          photos={photos.map((p) => ({ id: p.id, url: publicPhotoUrl("vendor-photos", p.path) }))}
          onAdd={addVendorPhoto}
          onRemove={removeVendorPhoto}
        />
      </section>

      <section id="connected-apps" className="scroll-mt-20 space-y-3 rounded-xl border bg-background p-4">
        <div>
          <h2 className="font-semibold">Connected apps</h2>
          <p className="text-sm text-muted-foreground">Connect your card reader to fill in sales reports with one tap. We can only read your sales totals, never move money.</p>
        </div>
        {squareResult === "connected" && <p className="rounded-lg bg-emerald-50 p-2.5 text-sm text-emerald-900">Square connected!</p>}
        {squareResult === "declined" && <p className="rounded-lg bg-muted p-2.5 text-sm">Square wasn&apos;t connected.</p>}
        {squareResult === "failed" && <p className="rounded-lg bg-red-50 p-2.5 text-sm text-red-900">Connecting Square didn&apos;t work. Please try again.</p>}
        {squareResult === "unavailable" && <p className="rounded-lg bg-muted p-2.5 text-sm">Square connection isn&apos;t switched on yet.</p>}
        <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
          <span className="text-sm">
            <span className="block font-medium">Square</span>
            <span className="text-muted-foreground">
              {squareConn ? `Connected${squareConn.business_name ? ` to ${squareConn.business_name}` : ""}` : "Not connected"}
            </span>
          </span>
          {squareConn ? (
            <ConfirmButton size="sm" variant="ghost" action={disconnectSquareAction} confirmText="Disconnect Square?">
              Disconnect
            </ConfirmButton>
          ) : squareConfigured() ? (
            <a href="/api/square/connect" className={buttonVariants({ size: "sm" })}>Connect</a>
          ) : (
            <span className="text-xs text-muted-foreground">Coming soon</span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">Clover, SumUp and Shopify coming later.</p>
      </section>

      <section className="space-y-3 rounded-xl border bg-background p-4">
        <div>
          <h2 className="font-semibold">Markets you sell at</h2>
          <p className="text-sm text-muted-foreground">Organizers only see how many vendors listed their market, never who.</p>
        </div>
        <MyMarketsPicker selected={sellsAt} />
      </section>

      <ActionForm action={updateVendor} className="space-y-5 rounded-xl border bg-background p-4">
        <VendorBasicFields vendor={vendor} />
        <VendorDetailFields vendor={vendor} />
        <SubmitButton size="lg" className="w-full" pendingText="Saving…">
          Save profile
        </SubmitButton>
      </ActionForm>
    </main>
  )
}
