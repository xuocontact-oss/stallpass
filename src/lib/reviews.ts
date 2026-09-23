import type { PublicReview, SalesRange } from "./types.ts"

export type ReviewSummary = {
  count: number
  overall: number | null
  footTraffic: number | null
  organization: number | null
  value: number | null
  sales: Record<SalesRange, number>
  salesCount: number
}

const avg = (nums: number[]) => (nums.length ? Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10 : null)

/** Averages (to one decimal) and how sales went, for a market's reviews. */
export function summarizeReviews(reviews: Pick<PublicReview, "rating_overall" | "rating_foot_traffic" | "rating_organization" | "rating_value" | "sales_range">[]): ReviewSummary {
  const sales: Record<SalesRange, number> = { under_300: 0, "300_700": 0, "700_1500": 0, "1500_plus": 0 }
  for (const r of reviews) if (r.sales_range) sales[r.sales_range]++
  return {
    count: reviews.length,
    overall: avg(reviews.map((r) => r.rating_overall)),
    footTraffic: avg(reviews.map((r) => r.rating_foot_traffic)),
    organization: avg(reviews.map((r) => r.rating_organization)),
    value: avg(reviews.map((r) => r.rating_value)),
    sales,
    salesCount: Object.values(sales).reduce((a, b) => a + b, 0),
  }
}
