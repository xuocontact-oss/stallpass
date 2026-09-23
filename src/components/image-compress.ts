"use client"

/**
 * Shrinks a photo on the phone before uploading (saves storage and data on the
 * free plans). A 4 MB phone photo becomes a few hundred KB and looks the same
 * on screen. PDFs and anything that can't be read are uploaded unchanged.
 */
export type CompressKind = "photo" | "document" | "menu"

const SETTINGS: Record<CompressKind, { maxSide: number; quality: number }> = {
  photo: { maxSide: 1600, quality: 0.8 }, // booth / food / market photos
  document: { maxSide: 2400, quality: 0.85 }, // permits: must stay readable
  menu: { maxSide: 2000, quality: 0.85 },
}

async function loadImage(file: File): Promise<ImageBitmap | HTMLImageElement> {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" })
  } catch {
    // Some formats (e.g. iPhone HEIC in Safari) decode via an image element instead.
    const url = URL.createObjectURL(file)
    try {
      const img = new Image()
      img.src = url
      await img.decode()
      return img
    } finally {
      URL.revokeObjectURL(url)
    }
  }
}

export async function compressImage(file: File, kind: CompressKind): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file
  const { maxSide, quality } = SETTINGS[kind]
  try {
    const img = await loadImage(file)
    const w = "naturalWidth" in img ? img.naturalWidth : img.width
    const h = "naturalHeight" in img ? img.naturalHeight : img.height
    const scale = Math.min(1, maxSide / Math.max(w, h))
    const canvas = document.createElement("canvas")
    canvas.width = Math.round(w * scale)
    canvas.height = Math.round(h * scale)
    const ctx = canvas.getContext("2d")
    if (!ctx) return file
    ctx.fillStyle = "#fff" // transparent PNGs get a white background, not black
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality))
    if (!blob || blob.size >= file.size) return file // already small: keep the original
    const name = file.name.replace(/\.[^.]+$/, "") + ".jpg"
    return new File([blob], name, { type: "image/jpeg", lastModified: Date.now() })
  } catch (e) {
    console.warn("Couldn't shrink image, uploading the original:", e)
    return file
  }
}
