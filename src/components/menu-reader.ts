"use client"

/**
 * Reads the text from a menu photo or PDF, right in the browser (free, and
 * the file never goes to anyone else).
 * - PDFs made on a computer already contain text, so we just read it.
 * - Photos and scanned PDFs go through text recognition (Tesseract), which
 *   downloads its language data the first time it's used.
 */

const MAX_PDF_PAGES = 3

export async function readMenuText(file: File, onProgress: (message: string) => void): Promise<string> {
  if (file.type === "application/pdf") return readPdf(file, onProgress)
  return recognize([file], onProgress)
}

async function readPdf(file: File, onProgress: (message: string) => void): Promise<string> {
  onProgress("Opening PDF…")
  const pdfjs = await import("pdfjs-dist")
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise
  const pageCount = Math.min(pdf.numPages, MAX_PDF_PAGES)

  // 1) Text already in the PDF
  let text = ""
  for (let n = 1; n <= pageCount; n++) {
    const content = await (await pdf.getPage(n)).getTextContent()
    for (const item of content.items) {
      if ("str" in item) text += item.str + (item.hasEOL ? "\n" : " ")
    }
    text += "\n\n"
  }
  if ((text.match(/[A-Za-z]/g) ?? []).length >= 20) return text

  // 2) A scanned PDF: turn each page into a picture and read that.
  const images: HTMLCanvasElement[] = []
  for (let n = 1; n <= pageCount; n++) {
    const page = await pdf.getPage(n)
    const viewport = page.getViewport({ scale: 2 })
    const canvas = document.createElement("canvas")
    canvas.width = viewport.width
    canvas.height = viewport.height
    await page.render({ canvas, viewport }).promise
    images.push(canvas)
  }
  return recognize(images, onProgress)
}

async function recognize(images: (File | HTMLCanvasElement)[], onProgress: (message: string) => void) {
  onProgress("Getting ready (the first time takes a little longer)…")
  const { createWorker } = await import("tesseract.js")
  let page = 0
  const worker = await createWorker("eng", 1, {
    logger: (m) => {
      if (m.status === "recognizing text") {
        const pageLabel = images.length > 1 ? ` page ${page + 1} of ${images.length},` : ""
        onProgress(`Reading your menu…${pageLabel} ${Math.round(m.progress * 100)}%`)
      }
    },
  })
  try {
    const parts: string[] = []
    for (; page < images.length; page++) {
      const { data } = await worker.recognize(images[page])
      parts.push(data.text)
    }
    return parts.join("\n\n")
  } finally {
    await worker.terminate()
  }
}
