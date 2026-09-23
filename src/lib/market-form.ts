import "server-only"
import { z } from "zod"
import { DOCUMENT_TYPES, FOOD_CATEGORIES, MARKET_TYPES } from "@/lib/constants"
import { isValidISODate } from "@/lib/dates"
import { formText } from "@/lib/form"
import { geocodeAddress } from "@/lib/geocode"
import { parseBoothFees, slugify } from "@/lib/markets"

const optional = (max: number) => z.string().max(max, `Keep this under ${max} characters.`).nullable()

const marketSchema = z.object({
  name: z.string({ error: "Enter the market name." }).min(1, "Enter the market name.").max(120),
  slug: z
    .string()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "The web address can only use a-z, 0-9 and dashes.")
    .max(80),
  market_type: z.enum(MARKET_TYPES.map((t) => t.key)),
  organizer_name: optional(120),
  website: optional(200),
  instagram: optional(200),
  address: z.string({ error: "Enter the street address." }).min(1).max(200),
  city: z.string({ error: "Enter the city." }).min(1).max(80),
  state: z.string().min(1).max(40),
  zip: optional(12),
  description: optional(4000),
  schedule_summary: optional(200),
  categories_wanted: z.array(z.enum(FOOD_CATEGORIES.map((c) => c.key))),
  required_doc_types: z.array(z.enum(DOCUMENT_TYPES.map((d) => d.key))),
  application_deadline: z
    .string()
    .nullable()
    .refine((v) => v === null || isValidISODate(v), "Please enter a valid deadline date."),
  application_notes: optional(1000),
  is_published: z.boolean(),
})

const contactSchema = z.object({
  contact_name: optional(120),
  contact_email: z.email("The contact email doesn't look right.").max(200).nullable(),
  phone: optional(30),
  notes: optional(1000),
})

export type MarketRow = z.infer<typeof marketSchema> & {
  booth_fees: { label: string; amount_cents: number }[]
  lat: number
  lng: number
}
export type ContactRow = z.infer<typeof contactSchema>

function coordinate(value: string | null, min: number, max: number) {
  if (!value) return null
  const n = Number.parseFloat(value)
  return Number.isFinite(n) && n >= min && n <= max ? n : undefined
}

/**
 * Reads and checks the market form (used by the admin and by organizers).
 * Looks the address up on the map when no coordinates are given.
 */
export async function parseMarketForm(
  formData: FormData
): Promise<{ row: MarketRow; contact: ContactRow } | { error: string }> {
  const name = formText(formData, "name") ?? ""
  const parsed = marketSchema.safeParse({
    name,
    slug: formText(formData, "slug") ?? slugify(name),
    market_type: formText(formData, "market_type") ?? "farmers",
    organizer_name: formText(formData, "organizer_name"),
    website: formText(formData, "website"),
    instagram: formText(formData, "instagram"),
    address: formText(formData, "address"),
    city: formText(formData, "city"),
    state: formText(formData, "state") ?? "CA",
    zip: formText(formData, "zip"),
    description: formText(formData, "description"),
    schedule_summary: formText(formData, "schedule_summary"),
    categories_wanted: formData.getAll("categories_wanted"),
    required_doc_types: formData.getAll("required_doc_types"),
    application_deadline: formText(formData, "application_deadline"),
    application_notes: formText(formData, "application_notes"),
    is_published: formData.get("is_published") === "on",
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const contact = contactSchema.safeParse({
    contact_name: formText(formData, "contact_name"),
    contact_email: formText(formData, "contact_email"),
    phone: formText(formData, "contact_phone"),
    notes: formText(formData, "contact_notes"),
  })
  if (!contact.success) return { error: contact.error.issues[0].message }

  const fees = parseBoothFees(formText(formData, "booth_fees") ?? "")
  if ("error" in fees) return { error: fees.error }

  let lat = coordinate(formText(formData, "lat"), -90, 90)
  let lng = coordinate(formText(formData, "lng"), -180, 180)
  if (lat === undefined || lng === undefined) return { error: "Latitude/longitude don't look right." }
  if (lat === null || lng === null) {
    const m = parsed.data
    const hit = await geocodeAddress(`${m.address}, ${m.city}, ${m.state} ${m.zip ?? ""}`)
    if (!hit) {
      return {
        error:
          "Couldn't find that address on the map. Check it, or fill in latitude and longitude yourself (in Google Maps, right-click the spot and click the numbers to copy them).",
      }
    }
    lat = hit.lat
    lng = hit.lng
  }

  return { row: { ...parsed.data, booth_fees: fees.fees, lat, lng }, contact: contact.data }
}
