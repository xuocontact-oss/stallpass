import Link from "next/link"
import { redirect } from "next/navigation"
import { CheckCircle2, Circle, ShoppingBasket, Store, Tent } from "lucide-react"
import { ActionForm, SubmitButton } from "@/components/action-form"
import { MenuEditor } from "@/components/menu-editor"
import { PhotoManager } from "@/components/photo-manager"
import { QuickDocUpload } from "@/components/quick-doc-upload"
import { buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { MyMarketsPicker } from "@/components/my-markets-picker"
import { VendorBasicFields } from "@/components/vendor-fields"
import { addVendorPhoto, removeVendorPhoto, saveVendorBasics, saveVendorDetails } from "@/actions/vendor"
import { getMyVendor, getProfile, requireUser } from "@/lib/auth"
import { commonDocTypes, documentTypeLabel, isFoodCategory, MAX_VENDOR_PHOTOS } from "@/lib/constants"
import { todayISO } from "@/lib/dates"
import { documentStatus } from "@/lib/documents"
import { vendorSetupProgress } from "@/lib/setup-progress"
import { publicPhotoUrl } from "@/lib/storage"
import { createClient } from "@/lib/supabase/server"
import { getMyDocuments, getMyPhotos } from "@/lib/vendor-data"
import { cn } from "@/lib/utils"
import type { T } from "@/lib/i18n/core"
import { getT } from "@/lib/i18n/server"

export const metadata = { title: "Set up your business" }

const STEP_NAMES = ["You & your business", "Business details", "Documents", "All set"]

const DOC_HINTS: Record<string, string> = {
  health_permit: "From your city or county health department (or your cottage food registration).",
  liability_insurance: "Your certificate of insurance (COI). Most markets want $1M general liability.",
  business_license: "Your city business license or business tax registration.",
  sellers_permit: "Your California seller's permit from the CDTFA.",
  food_handler_card: "Food handler card (or food manager certificate).",
}

function Progress({ step, t }: { step: number; t: T }) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>
          {t("Step {n} of 4", { n: step })} · <span className="font-medium text-foreground">{t(STEP_NAMES[step - 1])}</span>
        </span>
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {[1, 2, 3, 4].map((n) => (
          <div key={n} className={cn("h-1.5 rounded-full", n <= step ? "bg-primary" : "bg-muted")} />
        ))}
      </div>
    </div>
  )
}

export default async function OnboardingPage({ searchParams }: PageProps<"/onboarding">) {
  const user = await requireUser()
  const params = await searchParams
  const profile = await getProfile()
  const vendor = await getMyVendor()
  const requested = Number(params.step)
  const joinMarket = typeof params.m === "string" && /^[0-9a-f-]{36}$/i.test(params.m) ? params.m : null
  const t = await getT()

  // Step 0: vendor or organizer?
  if (!vendor && !requested) {
    return (
      <main className="mx-auto w-full max-w-lg space-y-5 px-4 py-8">
        <div>
          <h1 className="text-2xl font-bold">{t("Welcome to Stallpass!")}</h1>
          <p className="text-muted-foreground">{t("What brings you here?")}</p>
        </div>
        <Link href="/onboarding?step=1" className="flex items-center gap-4 rounded-xl border-2 bg-background p-4 hover:border-primary">
          <Tent className="size-8 shrink-0 text-primary" aria-hidden />
          <span>
            <span className="block font-semibold">{t("I sell at markets")}</span>
            <span className="text-sm text-muted-foreground">{t("Food, drinks, clothing, crafts, art… Set up your vendor profile.")}</span>
          </span>
        </Link>
        <Link href="/organizer/start" className="flex items-center gap-4 rounded-xl border-2 bg-background p-4 hover:border-primary">
          <Store className="size-8 shrink-0 text-primary" aria-hidden />
          <span>
            <span className="block font-semibold">{t("I run a market")}</span>
            <span className="text-sm text-muted-foreground">{t("Claim or add your market and manage vendor applications.")}</span>
          </span>
        </Link>
        <Link href="/onboarding/shopper" className="flex items-center gap-4 rounded-xl border-2 bg-background p-4 hover:border-primary">
          <ShoppingBasket className="size-8 shrink-0 text-primary" aria-hidden />
          <span>
            <span className="block font-semibold">{t("I'm a shopper")}</span>
            <span className="text-sm text-muted-foreground">{t("Find farmers markets and night markets near you, and share reviews.")}</span>
          </span>
        </Link>
        {profile?.is_organizer && (
          <p className="text-center text-sm">
            <Link href="/organizer" className="text-primary">{t("Back to your markets")}</Link>
          </p>
        )}
      </main>
    )
  }

  const supabase = await createClient()
  // Came back through a market's QR code with a business already? Add that market.
  if (vendor && joinMarket) {
    await supabase
      .from("vendor_markets")
      .upsert({ vendor_id: vendor.id, market_id: joinMarket }, { onConflict: "vendor_id,market_id", ignoreDuplicates: true })
  }
  const [docs, photos, myMarkets] = vendor
    ? await Promise.all([
        getMyDocuments(vendor.id),
        getMyPhotos(vendor.id),
        supabase.from("vendor_markets").select("markets(id, name, city, state)").eq("vendor_id", vendor.id).then((r) => r.data ?? []),
      ])
    : [[], [], []]
  const sellsAt = (myMarkets as unknown as { markets: { id: string; name: string; city: string; state: string } | null }[])
    .map((r) => r.markets)
    .filter((m): m is { id: string; name: string; city: string; state: string } => m !== null)
  const progress = vendorSetupProgress(vendor, docs)
  // Bare /onboarding with a business already: continue where they left off.
  if (vendor && !requested) redirect(`/onboarding?step=${progress.nextStep}`)
  const step = vendor ? Math.min(Math.max(requested || 1, 1), 4) : 1

  return (
    <main className="mx-auto w-full max-w-lg space-y-5 px-4 py-6">
      <Progress step={step} t={t} />

      {step === 1 && (
        <>
          <div>
            <h1 className="text-2xl font-bold">{vendor ? t("You & your business") : t("Let's set up your business")}</h1>
            <p className="text-sm text-muted-foreground">
              {t("Markets see this when you apply.")}{" "}
              <Link href="/start" className="font-medium text-primary">
                {t("First time selling at markets? Check out our quick start guide →")}
              </Link>
            </p>
          </div>
          <ActionForm action={saveVendorBasics} className="space-y-5 rounded-xl border bg-background p-4">
            {joinMarket && <input type="hidden" name="m" value={joinMarket} />}
            <fieldset className="space-y-4">
              <legend className="mb-2 font-semibold">{t("About you (the owner)")}</legend>
              <div className="space-y-1.5">
                <Label htmlFor="full_name">{t("Your full name")}</Label>
                <Input id="full_name" name="full_name" required maxLength={100} autoComplete="name" defaultValue={profile?.full_name ?? ""} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">{t("Phone number")}</Label>
                <Input id="phone" name="phone" type="tel" required maxLength={30} autoComplete="tel" placeholder="(213) 555-0123" defaultValue={vendor?.phone ?? ""} />
                <p className="text-xs text-muted-foreground">{t("Shared with markets you apply to, so they can reach you on the day.")}</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">{t("Email")}</Label>
                <Input id="email" value={user.email} disabled readOnly />
                <p className="text-xs text-muted-foreground">{t("Your login. Markets reply to this address.")}</p>
              </div>
            </fieldset>
            <fieldset className="space-y-4 border-t pt-4">
              <legend className="mb-2 pt-4 font-semibold">{t("Your business")}</legend>
              <VendorBasicFields vendor={vendor} />
            </fieldset>
            <SubmitButton size="lg" className="w-full" pendingText={t("Saving…")}>
              {t("Save and continue")}
            </SubmitButton>
          </ActionForm>
          {!vendor && (
            <p className="text-center text-sm">
              <Link href="/onboarding/later" className="text-muted-foreground">{t("Busy right now? Finish later")}</Link>
            </p>
          )}
        </>
      )}

      {step === 2 && vendor && (
        <>
          <div>
            <h1 className="text-2xl font-bold">{t("Business details")}</h1>
            <p className="text-sm text-muted-foreground">{t("A good description and photos get you accepted more often.")}</p>
          </div>
          <section className="space-y-3 rounded-xl border bg-background p-4">
            <div>
              <h2 className="font-semibold">{t("Photos")}</h2>
              <p className="text-sm text-muted-foreground">
                {isFoodCategory(vendor.category) ? t("Your booth or truck, your food, your setup.") : t("Your booth, your products, your setup.")}
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
          <section className="space-y-3 rounded-xl border bg-background p-4">
            <div>
              <h2 className="font-semibold">{t("Markets you already sell at")}</h2>
              <p className="text-sm text-muted-foreground">{t("Helps us get your markets on Stallpass. Other vendors and organizers only ever see a count, never your name.")}</p>
            </div>
            <MyMarketsPicker selected={sellsAt} />
          </section>
          <ActionForm action={saveVendorDetails} className="space-y-5 rounded-xl border bg-background p-4">
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
              <Label htmlFor="setup_notes">{t("Setup details (optional)")}</Label>
              <Input id="setup_notes" name="setup_notes" maxLength={500} defaultValue={vendor.setup_notes ?? ""} placeholder={t("e.g. 10x10 tent, 2 tables, needs one outlet")} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {(
                [
                  ["instagram", "Instagram", "@yourbusiness"],
                  ["website", "Website", "yourbusiness.com"],
                  ["tiktok", "TikTok", "@yourbusiness"],
                  ["facebook", "Facebook", "facebook.com/yourbusiness"],
                ] as const
              ).map(([name, label, ph]) => (
                <div key={name} className="space-y-1.5">
                  <Label htmlFor={name}>{label}</Label>
                  <Input id={name} name={name} maxLength={200} placeholder={ph} defaultValue={vendor[name] ?? ""} />
                </div>
              ))}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="service_area">{t("Where you'll travel")}</Label>
              <Input id="service_area" name="service_area" maxLength={200} placeholder={t("e.g. LA County, up to 30 miles from Echo Park")} defaultValue={vendor.service_area ?? ""} />
            </div>
            <div className="flex items-center gap-3">
              <Link href="/onboarding?step=1" className={buttonVariants({ variant: "ghost" })}>{t("Back")}</Link>
              <SubmitButton size="lg" className="flex-1" pendingText={t("Saving…")}>
                {t("Save and continue")}
              </SubmitButton>
            </div>
          </ActionForm>
          <p className="text-center text-sm">
            <Link href="/onboarding?step=3" className="text-muted-foreground">{t("Skip for now")}</Link>
          </p>
        </>
      )}

      {step === 3 && vendor && (
        <>
          <div>
            <h1 className="text-2xl font-bold">{t("Your documents")}</h1>
            <p className="text-sm text-muted-foreground">
              {t("Upload what you have now. They stay private until you apply, and we'll remind you before anything expires.")}
            </p>
          </div>
          <div className="space-y-3">
            {commonDocTypes(vendor.category).map((type) => {
              const latest = docs
                .filter((d) => d.doc_type === type && documentStatus(d.expiration_date, todayISO()) !== "expired")
                .sort((a, b) => (b.expiration_date ?? "9999").localeCompare(a.expiration_date ?? "9999"))[0]
              return (
                <QuickDocUpload
                  key={type}
                  vendorId={vendor.id}
                  docType={type}
                  label={t(documentTypeLabel(type))}
                  hint={t(DOC_HINTS[type] ?? "")}
                  uploaded={latest ? { file_name: latest.file_name, expiration_date: latest.expiration_date } : null}
                />
              )
            })}
          </div>
          <p className="text-sm text-muted-foreground">
            {t("Something else a market asked for (fire inspection, etc.)? Add it any time under Docs.")}
          </p>
          <div className="flex items-center gap-3">
            <Link href="/onboarding?step=2" className={buttonVariants({ variant: "ghost" })}>{t("Back")}</Link>
            <Link href="/onboarding?step=4" className={buttonVariants({ size: "lg", className: "flex-1" })}>
              {progress.docsDone === progress.docsTotal ? t("Continue") : t("Continue (finish later)")}
            </Link>
          </div>
        </>
      )}

      {step === 4 && vendor && (
        <>
          <div>
            <h1 className="text-2xl font-bold">{progress.complete ? t("You're all set! 🎉") : t("Nearly there")}</h1>
            <p className="text-sm text-muted-foreground">
              {progress.complete
                ? t("Your profile and documents are ready. Time to find markets.")
                : t("You can start browsing markets now and finish the rest any time.")}
            </p>
          </div>
          <ul className="space-y-2 rounded-xl border bg-background p-4">
            {progress.items.map((item) => (
              <li key={item.label} className="flex items-center gap-2 text-sm">
                {item.done ? (
                  <CheckCircle2 className="size-5 text-emerald-600" aria-label="Done" />
                ) : (
                  <Circle className="size-5 text-muted-foreground" aria-label="Not done" />
                )}
                <span className={cn("flex-1", item.done && "text-muted-foreground")}>{t(item.label, { done: progress.docsDone, total: progress.docsTotal })}</span>
                {!item.done && (
                  <Link href={`/onboarding?step=${item.step}`} className="font-medium text-primary">
                    {t("Finish")}
                  </Link>
                )}
              </li>
            ))}
          </ul>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link href="/markets" className={buttonVariants({ size: "lg", className: "flex-1" })}>{t("Find markets")}</Link>
            <Link href="/dashboard" className={buttonVariants({ size: "lg", variant: "outline", className: "flex-1" })}>
              {t("Go to my dashboard")}
            </Link>
          </div>
        </>
      )}
    </main>
  )
}
