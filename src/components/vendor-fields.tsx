import { selectClassName } from "@/components/action-form"
import { MenuEditor } from "@/components/menu-editor"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { FOOD_CATEGORIES, isFoodCategory, SETUP_TYPES } from "@/lib/constants"
import { getT } from "@/lib/i18n/server"
import { publicPhotoUrl } from "@/lib/storage"
import type { Vendor } from "@/lib/types"

/** The basics every vendor fills in (used in onboarding and on the profile page). */
export async function VendorBasicFields({ vendor }: { vendor?: Vendor | null }) {
  const t = await getT()
  return (
    <>
      <div className="space-y-1.5">
        <Label htmlFor="business_name">{t("Business name")}</Label>
        <Input id="business_name" name="business_name" defaultValue={vendor?.business_name} required maxLength={100} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="category">{t("What do you mainly sell?")}</Label>
        <select id="category" name="category" defaultValue={vendor?.category ?? ""} required className={selectClassName}>
          <option value="" disabled>
            {t("Choose one…")}
          </option>
          <optgroup label={t("Food & drink")}>
            {FOOD_CATEGORIES.filter((c) => isFoodCategory(c.key) && c.key !== "other").map((c) => (
              <option key={c.key} value={c.key}>
                {t(c.label)}
              </option>
            ))}
          </optgroup>
          <optgroup label={t("Other goods")}>
            {FOOD_CATEGORIES.filter((c) => !isFoodCategory(c.key)).map((c) => (
              <option key={c.key} value={c.key}>
                {t(c.label)}
              </option>
            ))}
          </optgroup>
          <option value="other">{t("Something else")}</option>
        </select>
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">{t("Your setup")}</legend>
        <div className="grid grid-cols-2 gap-2">
          {SETUP_TYPES.map((s) => (
            <label
              key={s.key}
              className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2.5 text-sm has-checked:border-primary has-checked:bg-secondary"
            >
              <input
                type="radio"
                name="setup_type"
                value={s.key}
                defaultChecked={(vendor?.setup_type ?? "tent") === s.key}
                className="accent-primary"
              />
              {t(s.label)}
            </label>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{t("Not food? Pick “Tent / table”.")}</p>
        <div className="flex flex-wrap gap-4 pt-1">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="needs_power" defaultChecked={vendor?.needs_power} className="size-4 accent-primary" />
            {t("I need power")}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="needs_water" defaultChecked={vendor?.needs_water} className="size-4 accent-primary" />
            {t("I need water")}
          </label>
        </div>
      </fieldset>
    </>
  )
}

/** Everything else on the profile page. */
export async function VendorDetailFields({ vendor }: { vendor: Vendor }) {
  const t = await getT()
  const text = (name: keyof Vendor, label: string, props: React.ComponentProps<typeof Input> = {}) => (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{t(label)}</Label>
      <Input id={name} name={name} defaultValue={(vendor[name] as string | null) ?? ""} {...props} />
    </div>
  )
  return (
    <>
      <div className="space-y-1.5">
        <Label htmlFor="description">{t("About your business")}</Label>
        <Textarea
          id="description"
          name="description"
          rows={4}
          maxLength={2000}
          defaultValue={vendor.description ?? ""}
          placeholder={t("What you sell, what makes you special, how long you've been doing markets…")}
        />
      </div>
      <MenuEditor
        vendorId={vendor.id}
        defaultMenu={vendor.menu ?? ""}
        menuFile={
          vendor.menu_file_path
            ? { url: publicPhotoUrl("vendor-menus", vendor.menu_file_path), name: vendor.menu_file_name ?? "Menu" }
            : null
        }
      />
      <div className="space-y-1.5">
        <Label htmlFor="setup_notes">{t("Setup details")}</Label>
        <Textarea
          id="setup_notes"
          name="setup_notes"
          rows={2}
          maxLength={500}
          defaultValue={vendor.setup_notes ?? ""}
          placeholder={t("e.g. 10x10 tent, one 20A outlet, generator available")}
        />
      </div>
      {text("service_area", "Where you'll travel", { placeholder: t("e.g. LA County, up to 30 miles from Echo Park"), maxLength: 200 })}
      {text("phone", "Business phone", { type: "tel", maxLength: 30 })}
      <div className="grid gap-4 sm:grid-cols-2">
        {text("instagram", "Instagram", { placeholder: "@yourbusiness", maxLength: 200 })}
        {text("tiktok", "TikTok", { placeholder: "@yourbusiness", maxLength: 200 })}
        {text("facebook", "Facebook", { placeholder: "facebook.com/yourbusiness", maxLength: 200 })}
        {text("website", "Website", { placeholder: "yourbusiness.com", maxLength: 200 })}
      </div>
    </>
  )
}
