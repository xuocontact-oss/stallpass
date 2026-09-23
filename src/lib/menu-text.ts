/**
 * Cleans up text read from a menu photo or PDF into one item per line,
 * like "Carne asada taco – $4.00". Text recognition is never perfect, so the
 * vendor always gets to check and edit the result.
 */

const PRICE = String.raw`\$\s?\d{1,4}(?:\.\d{2})?|\d{1,4}\.\d{2}`

export function tidyMenuText(raw: string): string {
  const lines: string[] = []
  for (const original of raw.replace(/\r/g, "").split("\n")) {
    let line = original
      .replace(/[|~_=*•·]+/g, " ") // stray marks OCR picks up from borders and bullets
      .replace(/\s+/g, " ")
      .trim()
      // "S4.00" at the end is almost always a misread "$4.00"
      .replace(/\bS(\d{1,4}\.\d{2})$/, "$$$1")
      // Dot leaders: "Taco ........ 4.00"
      .replace(/\s*(?:\.{2,}|…+)\s*/g, " – ")

    // "Taco 4.00" / "Taco - $4" / "Taco: $4" → "Taco – $4.00"
    const m = line.match(new RegExp(`^(.*?[A-Za-z].*?)\\s*(?:[-–—:]\\s*)?(${PRICE})$`))
    if (m) {
      const label = m[1].replace(/\s*[-–—:]\s*$/, "").trim()
      const price = m[2].replace(/\s/g, "")
      line = `${label} – ${price.startsWith("$") ? price : `$${price}`}`
    }

    // Keep lines with at least two letters, or a price on its own.
    const letters = (line.match(/[A-Za-z]/g) ?? []).length
    if (letters >= 2 || new RegExp(`^(${PRICE})$`).test(line)) lines.push(line)
    else if (original.trim() === "") lines.push("") // a real gap between sections, not OCR noise
  }
  // Photos often put a gap after every line. Keep gaps only before a new
  // section (a line without a price, like "DRINKS"), never between two items.
  const hasPrice = (l: string | undefined) => !!l && new RegExp(`(${PRICE})$`).test(l)
  const kept = lines.filter((l, i) => {
    if (l !== "") return true
    const next = lines.slice(i + 1).find((x) => x !== "")
    return !hasPrice(next)
  })

  // At most one blank line in a row, none at the ends.
  return kept
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

/** Keeps only lines that end in a price (drops business name, hours, phone numbers…). */
export function onlyPricedLines(text: string): string {
  const priced = new RegExp(`(${PRICE})$`)
  return text
    .split("\n")
    .filter((l) => priced.test(l.trim()))
    .join("\n")
}
