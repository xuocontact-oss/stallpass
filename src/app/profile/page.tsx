import { ActionForm, SubmitButton } from "@/components/action-form"
import { PhotoManager } from "@/components/photo-manager"
import { SampleBadge } from "@/components/sample-badge"
import { VendorBasicFields, VendorDetailFields } from "@/components/vendor-fields"
import { addVendorPhoto, removeVendorPhoto, updateVendor } from "@/actions/vendor"
import { requireVendor } from "@/lib/auth"
import { MAX_VENDOR_PHOTOS } from "@/lib/constants"
import { publicPhotoUrl } from "@/lib/storage"
import { getMyPhotos } from "@/lib/vendor-data"

export const metadata = { title: "Business profile" }

export default async function ProfilePage() {
  const { vendor } = await requireVendor()
  const photos = await getMyPhotos(vendor.id)

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
