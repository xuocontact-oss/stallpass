import type { MetadataRoute } from "next"

/** Lets people "Add to Home Screen" and open Stallpass like an app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Stallpass",
    short_name: "Stallpass",
    description: "For pop-up vendors and markets: permits, markets, applications and reviews.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#e0592a",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  }
}
