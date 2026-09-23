/** Shapes of the database rows the app uses. Keep in step with supabase/migrations. */

export type SetupType = "tent" | "truck" | "trailer" | "cart"

export type Vendor = {
  id: string
  owner_id: string
  business_name: string
  category: string
  description: string | null
  menu: string | null
  menu_file_path: string | null
  menu_file_name: string | null
  setup_type: SetupType
  needs_power: boolean
  needs_water: boolean
  setup_notes: string | null
  phone: string | null
  instagram: string | null
  facebook: string | null
  tiktok: string | null
  website: string | null
  service_area: string | null
  is_sample: boolean
  created_at: string
  updated_at: string
}

export type VendorPhoto = { id: string; vendor_id: string; path: string; position: number }

export type VendorDocument = {
  id: string
  vendor_id: string
  doc_type: string
  title: string | null
  file_path: string
  file_name: string
  issue_date: string | null
  expiration_date: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type MarketType = "farmers" | "night" | "food_truck" | "popup" | "festival" | "craft" | "flea" | "other"

export type BoothFee = { label: string; amount_cents: number }

export type Market = {
  id: string
  slug: string
  name: string
  market_type: MarketType
  organizer_name: string | null
  organizer_id: string | null
  is_claimed: boolean
  website: string | null
  instagram: string | null
  address: string
  city: string
  state: string
  zip: string | null
  lat: number
  lng: number
  description: string | null
  schedule_summary: string | null
  booth_fees: BoothFee[]
  min_booth_fee_cents: number | null
  categories_wanted: string[]
  required_doc_types: string[]
  application_deadline: string | null
  application_notes: string | null
  is_published: boolean
  is_sample: boolean
  approval_status: "pending" | "approved" | "rejected"
  source: "stallpass" | "usda"
  source_id: string | null
  sales_reporting: "off" | "optional" | "required"
  sales_report_due_days: number
  sales_fee_percent: number | null
  payment_method: "none" | "stripe" | "external_link"
  payment_link: string | null
  payment_instructions: string | null
  rejection_reason: string | null
  created_by: string | null
  approved_at: string | null
  created_at: string
  updated_at: string
}

export type MarketDate = {
  id: string
  market_id: string
  event_date: string
  starts_at: string | null
  ends_at: string | null
  note: string | null
}

export type MarketPhoto = { id: string; market_id: string; path: string; position: number }

export type ApplicationStatus =
  | "draft"
  | "submitted"
  | "accepted"
  | "waitlisted"
  | "declined"
  | "paid"
  | "cancelled"

export type Application = {
  id: string
  vendor_id: string
  market_id: string
  status: ApplicationStatus
  status_source: "vendor" | "organizer" | "admin"
  event_dates: string[]
  booth_choice: string | null
  note: string | null
  delivered_via: "platform" | "email" | "not_sent" | null
  emailed_at: string | null
  share_token: string | null
  share_expires_at: string | null
  verified_at: string | null
  verified_by: string | null
  booth_number: string | null
  organizer_note: string | null
  submitted_at: string | null
  status_changed_at: string
  created_at: string
  updated_at: string
}

export type ApplicationDocument = {
  id: string
  application_id: string
  source_document_id: string | null
  doc_type: string
  title: string | null
  file_path: string
  file_name: string
  issue_date: string | null
  expiration_date: string | null
}

export type SalesRange = "under_300" | "300_700" | "700_1500" | "1500_plus"

/** A review as the public sees it (no vendor id). */
export type PublicReview = {
  id: string
  market_id: string
  event_date: string
  rating_foot_traffic: number
  rating_organization: number
  rating_value: number
  rating_overall: number
  sales_range: SalesRange | null
  body: string | null
  reviewer_name: string | null
  reviewer_category: string | null
  organizer_reply: string | null
  organizer_reply_at: string | null
  is_sample: boolean
  created_at: string
}

export type Review = PublicReview & {
  vendor_id: string
  application_id: string | null
  show_business_name: boolean
  is_hidden: boolean
  hidden_reason: string | null
  hidden_at: string | null
  updated_at: string
}

export type MarketClaim = {
  id: string
  market_id: string
  user_id: string
  role: string
  message: string | null
  evidence_url: string | null
  status: "pending" | "approved" | "rejected"
  rejection_reason: string | null
  decided_at: string | null
  created_at: string
}

export type Payment = {
  id: string
  application_id: string
  market_id: string
  vendor_id: string
  method: "stripe" | "external_link"
  status: "pending" | "paid" | "failed" | "refunded" | "reported" | "confirmed" | "rejected"
  amount_cents: number | null
  platform_fee_cents: number
  description: string | null
  paid_at: string | null
  created_at: string
}

export type Resource = {
  id: string
  category: string
  name: string
  description: string | null
  url: string | null
  area: string | null
  price_note: string | null
  is_official: boolean
  is_featured: boolean
  is_published: boolean
  is_sample: boolean
  position: number
  last_checked: string | null
  is_partner: boolean
  promo_code: string | null
  promo_text: string | null
}

/** A shopper's review of a market, as the public sees it. */
export type ShopperReview = {
  id: string
  market_id: string
  visited_on: string
  rating_overall: number
  rating_variety: number | null
  rating_atmosphere: number | null
  rating_prices: number | null
  body: string | null
  display_name: string | null
  organizer_reply: string | null
  organizer_reply_at: string | null
  is_sample: boolean
  created_at: string
}
