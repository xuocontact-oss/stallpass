/**
 * Fixed lists. The database has the same keys (supabase/migrations); a test
 * checks the two stay in step.
 */

export const FOOD_CATEGORIES = [
  { key: "tacos_mexican", label: "Tacos & Mexican" },
  { key: "bbq_grill", label: "BBQ & grill" },
  { key: "asian", label: "Asian" },
  { key: "burgers_sandwiches", label: "Burgers & sandwiches" },
  { key: "pizza_italian", label: "Pizza & Italian" },
  { key: "mediterranean", label: "Mediterranean & Middle Eastern" },
  { key: "seafood", label: "Seafood" },
  { key: "vegan", label: "Vegan & plant-based" },
  { key: "baked_goods", label: "Baked goods & desserts" },
  { key: "frozen_treats", label: "Ice cream & frozen treats" },
  { key: "coffee_drinks", label: "Coffee & drinks" },
  { key: "produce", label: "Produce & farm goods" },
  { key: "packaged", label: "Packaged foods (jams, sauces, snacks)" },
  { key: "clothing", label: "Clothing & accessories" },
  { key: "jewelry", label: "Jewelry" },
  { key: "art", label: "Art & prints" },
  { key: "crafts", label: "Crafts & handmade goods" },
  { key: "vintage", label: "Vintage & thrift" },
  { key: "beauty", label: "Beauty, candles & body care" },
  { key: "plants", label: "Plants & flowers" },
  { key: "home_goods", label: "Home goods & decor" },
  { key: "other", label: "Other" },
] as const

/** Categories that aren't food: no health permit or food handler card needed. */
export const NON_FOOD_CATEGORIES: readonly string[] = [
  "clothing",
  "jewelry",
  "art",
  "crafts",
  "vintage",
  "beauty",
  "plants",
  "home_goods",
]

export const isFoodCategory = (key: string | null | undefined) => !NON_FOOD_CATEGORIES.includes(key ?? "")

/** Documents most markets ask for, depending on what the vendor sells. */
export function commonDocTypes(category: string | null | undefined): string[] {
  return isFoodCategory(category)
    ? ["health_permit", "liability_insurance", "business_license", "sellers_permit", "food_handler_card"]
    : ["liability_insurance", "business_license", "sellers_permit"]
}

export const DOCUMENT_TYPES = [
  { key: "health_permit", label: "Health permit" },
  { key: "liability_insurance", label: "Liability insurance (COI)" },
  { key: "business_license", label: "Business license" },
  { key: "sellers_permit", label: "Seller's permit" },
  { key: "food_handler_card", label: "Food handler card" },
  { key: "other", label: "Other" },
] as const

export const SETUP_TYPES = [
  { key: "tent", label: "Tent / table" },
  { key: "truck", label: "Food truck" },
  { key: "trailer", label: "Trailer" },
  { key: "cart", label: "Cart" },
] as const

export const MARKET_TYPES = [
  { key: "farmers", label: "Farmers market" },
  { key: "night", label: "Night market" },
  { key: "food_truck", label: "Food truck event" },
  { key: "popup", label: "Pop-up market" },
  { key: "festival", label: "Festival" },
  { key: "craft", label: "Craft & makers fair" },
  { key: "flea", label: "Flea & vintage market" },
  { key: "other", label: "Other" },
] as const

function labeler(list: readonly { key: string; label: string }[]) {
  const map = new Map(list.map((i) => [i.key, i.label]))
  return (key: string | null | undefined) => (key ? (map.get(key) ?? key) : "")
}

export const categoryLabel = labeler(FOOD_CATEGORIES)
export const documentTypeLabel = labeler(DOCUMENT_TYPES)
export const setupTypeLabel = labeler(SETUP_TYPES)
export const marketTypeLabel = labeler(MARKET_TYPES)

/** Largest upload sizes (the storage buckets enforce the same limits). */
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024
export const MAX_VENDOR_PHOTOS = 8
export const MAX_MENU_BYTES = 10 * 1024 * 1024

export const APPLICATION_STATUSES = [
  { key: "draft", label: "Draft", className: "bg-stone-100 text-stone-700" },
  { key: "submitted", label: "Sent", className: "bg-sky-100 text-sky-800" },
  { key: "accepted", label: "Accepted", className: "bg-emerald-100 text-emerald-800" },
  { key: "waitlisted", label: "Waitlisted", className: "bg-amber-100 text-amber-900" },
  { key: "declined", label: "Declined", className: "bg-red-100 text-red-800" },
  { key: "paid", label: "Paid", className: "bg-emerald-600 text-white" },
  { key: "cancelled", label: "Cancelled", className: "bg-stone-200 text-stone-600" },
] as const

export const applicationStatusLabel = labeler(APPLICATION_STATUSES)

export const SALES_RANGES = [
  { key: "under_300", label: "Under $300" },
  { key: "300_700", label: "$300–700" },
  { key: "700_1500", label: "$700–1,500" },
  { key: "1500_plus", label: "$1,500+" },
] as const

export const salesRangeLabel = labeler(SALES_RANGES)

export const RATING_FIELDS = [
  { key: "rating_foot_traffic", label: "Foot traffic" },
  { key: "rating_organization", label: "Organization" },
  { key: "rating_value", label: "Value for booth fee" },
  { key: "rating_overall", label: "Overall" },
] as const

/** Applications a vendor can send per day (stops accidental spam to markets). */
export const MAX_APPLICATIONS_PER_DAY = 20
/** How long the secure link in an application email works. */
export const SHARE_LINK_DAYS = 14
