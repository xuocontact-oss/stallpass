"use client"

import { useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { FileText, ScanText, Trash2, TriangleAlert, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { readMenuText } from "@/components/menu-reader"
import { uploadFile } from "@/components/upload"
import { removeMenuFile, setMenuFile } from "@/actions/vendor"
import { MAX_MENU_BYTES } from "@/lib/constants"
import { useT } from "@/lib/i18n/client"
import { onlyPricedLines, tidyMenuText } from "@/lib/menu-text"

const MAX_MENU_CHARS = 4000

/**
 * The menu part of the profile form. Vendors can type their menu, upload a
 * photo/PDF of it, or both, and have the text read from the upload.
 * The typed menu is saved with the rest of the profile ("Save profile").
 */
export function MenuEditor({
  vendorId,
  defaultMenu,
  menuFile,
}: {
  vendorId: string
  defaultMenu: string
  menuFile: { url: string; name: string } | null
}) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const localFile = useRef<File | null>(null)
  const [menu, setMenu] = useState(defaultMenu)
  const [status, setStatus] = useState<string | null>(null)
  const [found, setFound] = useState<string | null>(null)
  const [checked, setChecked] = useState(false)
  const [pending, startTransition] = useTransition()
  const [reading, setReading] = useState(false)
  const { t } = useT()

  const isPdf = menuFile ? /\.pdf$/i.test(menuFile.name) || /\.pdf$/i.test(menuFile.url) : false
  const busy = pending || reading

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    startTransition(async () => {
      setStatus(t("Uploading…"))
      const up = await uploadFile("vendor-menus", vendorId, file, MAX_MENU_BYTES, "menu")
      if ("error" in up) {
        setStatus(null)
        toast.error(t(up.error))
        return
      }
      const result = await setMenuFile(up.path, file.name)
      setStatus(null)
      if (result?.error) {
        toast.error(t(result.error))
        return
      }
      localFile.current = file
      toast.success(t("Menu uploaded. Tap “Read the text” to fill in your written menu."))
      router.refresh()
    })
  }

  async function readText() {
    if (!menuFile) return
    setReading(true)
    setFound(null)
    try {
      let file = localFile.current
      if (!file) {
        setStatus(t("Opening your menu…"))
        const blob = await (await fetch(menuFile.url)).blob()
        file = new File([blob], menuFile.name, { type: blob.type || (isPdf ? "application/pdf" : "image/jpeg") })
      }
      const text = tidyMenuText(await readMenuText(file, (m) => setStatus(t(m.replace(/ \d+%.*$/, "")) + (m.match(/ \d+%.*$/)?.[0] ?? "")))).slice(0, MAX_MENU_CHARS)
      if (!text) {
        toast.error(t("We couldn't find any words. Try a clearer, straight-on photo, or type your menu in."))
      } else {
        // Always let them review first: it reads EVERYTHING on the page.
        setChecked(false)
        setFound(text)
      }
    } catch (err) {
      console.error("Menu reading failed:", err)
      toast.error(t("Couldn't read that file. You can still type your menu in."))
    } finally {
      setStatus(null)
      setReading(false)
    }
  }

  function remove() {
    if (!window.confirm(t("Remove the menu file? Your written menu stays."))) return
    startTransition(async () => {
      const result = await removeMenuFile()
      if (result?.error) toast.error(t(result.error))
      else {
        localFile.current = null
        toast.success(t("Menu file removed."))
        router.refresh()
      }
    })
  }

  function applyFound(mode: "replace" | "add") {
    const text = found?.trim()
    if (!text || !checked) return
    setMenu(mode === "replace" ? text : `${menu.trim()}\n\n${text}`.slice(0, MAX_MENU_CHARS))
    setFound(null)
    toast.success(t("Added to your menu. Tap Save profile to keep it."))
  }

  return (
    <div className="space-y-3">
      <div>
        <Label htmlFor="menu">{t("Menu or product list")}</Label>
        <p className="text-sm text-muted-foreground">
          {t("What you sell and your prices. Type it in, or upload a photo or PDF (like your menu or price list) and we'll read the text for you. The upload is optional.")}
        </p>
      </div>

      {menuFile ? (
        <div className="flex items-center gap-3 rounded-lg border bg-muted/40 p-3">
          <a href={menuFile.url} target="_blank" rel="noopener" className="shrink-0">
            {isPdf ? (
              <div className="grid size-16 place-items-center rounded-md bg-background">
                <FileText className="size-7 text-primary" aria-hidden />
              </div>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img loading="lazy" decoding="async" src={menuFile.url} alt={t("Your menu")} className="size-16 rounded-md object-cover" />
            )}
          </a>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{menuFile.name}</p>
            <p className="text-xs text-muted-foreground">{t("Markets will see this file with your profile.")}</p>
            <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
              <button type="button" onClick={() => inputRef.current?.click()} disabled={busy} className="text-sm font-medium text-primary disabled:opacity-50">
                {t("Replace")}
              </button>
              <button type="button" onClick={remove} disabled={busy} className="flex items-center gap-1 text-sm font-medium text-destructive disabled:opacity-50">
                <Trash2 className="size-3.5" /> {t("Remove")}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="flex w-full items-center gap-3 rounded-lg border border-dashed bg-background p-4 text-left hover:border-primary disabled:opacity-50"
        >
          <Upload className="size-6 shrink-0 text-primary" aria-hidden />
          <span className="text-sm">
            <span className="block font-medium">{t("Upload a menu photo or PDF (optional)")}</span>
            <span className="text-muted-foreground">{t("JPG, PNG or PDF, up to 10 MB")}</span>
          </span>
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        className="sr-only"
        onChange={onPick}
      />

      {menuFile && (
        <Button type="button" variant="outline" className="w-full" onClick={readText} disabled={busy}>
          <ScanText /> {reading ? t("Reading…") : t("Read the text from my menu")}
        </Button>
      )}
      {status && (
        <p className="text-sm text-muted-foreground" role="status">
          {status}
        </p>
      )}

      {found !== null && (
        <div className="space-y-3 rounded-lg border border-primary/40 bg-secondary p-3">
          <div className="flex gap-2 rounded-md bg-amber-50 p-2.5 text-sm text-amber-950">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden />
            <p>
              <span className="font-semibold">{t("Check this before using it.")}</span>{" "}
              {t("We read all the text on your file, including things like your business name, hours, address or phone number. Delete anything that isn't a menu item, and fix any words or prices we got wrong.")}
            </p>
          </div>

          <Label htmlFor="found-text">{t("What we read (you can edit it here)")}</Label>
          <Textarea
            id="found-text"
            rows={8}
            maxLength={MAX_MENU_CHARS}
            value={found}
            onChange={(e) => setFound(e.target.value)}
            className="bg-background"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              const priced = onlyPricedLines(found)
              if (!priced) toast.error(t("No lines with prices found. Edit the text by hand instead."))
              else setFound(priced)
            }}
          >
            {t("Keep only lines with a price")}
          </Button>

          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              className="mt-0.5 size-4 accent-primary"
            />
            {t("I've checked this and removed anything that isn't a menu item.")}
          </label>

          <div className="flex flex-wrap gap-2">
            {menu.trim() ? (
              <>
                <Button type="button" size="sm" disabled={!checked} onClick={() => applyFound("replace")}>
                  {t("Replace my menu")}
                </Button>
                <Button type="button" size="sm" variant="outline" disabled={!checked} onClick={() => applyFound("add")}>
                  {t("Add below my menu")}
                </Button>
              </>
            ) : (
              <Button type="button" size="sm" disabled={!checked} onClick={() => applyFound("replace")}>
                {t("Use this as my menu")}
              </Button>
            )}
            <Button type="button" size="sm" variant="ghost" onClick={() => setFound(null)}>
              {t("Cancel")}
            </Button>
          </div>
        </div>
      )}

      <Textarea
        id="menu"
        name="menu"
        rows={8}
        maxLength={MAX_MENU_CHARS}
        value={menu}
        onChange={(e) => setMenu(e.target.value)}
        placeholder={"Carne asada taco – $4\nAl pastor taco – $4\nHorchata – $5"}
      />
      <p className="text-xs text-muted-foreground">
        {t("Text reading isn't perfect, so check the menu over. Changes are saved when you tap Save profile.")}
      </p>
    </div>
  )
}
