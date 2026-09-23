import type { Metadata, Viewport } from "next"
import { Geist } from "next/font/google"
import { SiteFooter } from "@/components/site-footer"
import { BottomSpacer, SiteHeader } from "@/components/site-header"
import { Toaster } from "@/components/ui/sonner"
import "./globals.css"

const geistSans = Geist({ variable: "--font-sans", subsets: ["latin"] })

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: { default: "Stallpass: markets for vendors, makers and shoppers", template: "%s · Stallpass" },
  description:
    "For pop-up food vendors: keep your permits in one place, find markets, read honest vendor reviews and apply fast.",
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#e0592a",
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-muted/40">
        <SiteHeader />
        <div className="flex flex-1 flex-col">{children}</div>
        <SiteFooter />
        <BottomSpacer />
        <Toaster richColors theme="light" position="top-center" />
      </body>
    </html>
  )
}
