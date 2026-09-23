import type { MetadataRoute } from "next"

const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "")

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Private or personal pages never need to be in Google.
      disallow: ["/admin", "/organizer", "/dashboard", "/documents", "/applications", "/profile", "/account", "/onboarding", "/a/", "/go/", "/api/", "/login", "/suspended"],
    },
    sitemap: `${SITE}/sitemap.xml`,
  }
}
