import { commonDocTypes } from "./constants.ts"
import type { Vendor, VendorDocument } from "./types.ts"

/**
 * How far a vendor has got through setup, for the setup pages and the
 * "Finish setting up" banner on the dashboard.
 */
export function vendorSetupProgress(
  vendor: Pick<Vendor, "category" | "phone" | "description" | "menu"> | null,
  docs: Pick<VendorDocument, "doc_type">[]
) {
  const expected = commonDocTypes(vendor?.category)
  const have = new Set(docs.map((d) => d.doc_type))
  const docsDone = expected.filter((t) => have.has(t)).length
  const items = [
    { label: "Owner & business basics", done: Boolean(vendor?.phone), step: 1 },
    { label: "Description and menu or product list", done: Boolean(vendor?.description && vendor?.menu), step: 2 },
    { label: `Documents (${docsDone} of ${expected.length})`, done: docsDone === expected.length, step: 3 },
  ]
  const firstUndone = items.find((i) => !i.done)
  return {
    items,
    docsDone,
    docsTotal: expected.length,
    complete: !firstUndone,
    stepsDone: items.filter((i) => i.done).length,
    nextStep: firstUndone ? firstUndone.step : 4,
  }
}
