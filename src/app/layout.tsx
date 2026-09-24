import type { Metadata, Viewport } from "next"
import { Bricolage_Grotesque, Instrument_Sans } from "next/font/google"
import { SiteFooter } from "@/components/site-footer"
import { BottomSpacer, SiteHeader } from "@/components/site-header"
import { Toaster } from "@/components/ui/sonner"
import { cookies } from "next/headers"
import { LanguagePicker } from "@/components/language-picker"
import { LANG_PICKED_COOKIE } from "@/lib/i18n/core"
import { LangProvider } from "@/lib/i18n/client"
import { getLang } from "@/lib/i18n/server"
import "./globals.css"

const bodyFont = Instrument_Sans({ variable: "--font-sans", subsets: ["latin"] })
const displayFont = Bricolage_Grotesque({ variable: "--font-display", subsets: ["latin"], weight: ["600", "700", "800"] })

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: { default: "Stallpass: markets for vendors, makers and shoppers", template: "%s · Stallpass" },
  description:
    "For pop-up food vendors: keep your permits in one place, find markets, read honest vendor reviews and apply fast.",
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f4eee2",
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const lang = await getLang()
  const jar = await cookies()
  const hasChosen = jar.has(LANG_PICKED_COOKIE)
  return (
    <html lang={lang} className={`${bodyFont.variable} ${displayFont.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-paper">
        <LangProvider lang={lang}>
          <SiteHeader />
          <div className="flex flex-1 flex-col">{children}</div>
          <SiteFooter />
          <BottomSpacer />
          <LanguagePicker hasChosen={hasChosen} />
        </LangProvider>
        <Toaster richColors theme="light" position="top-center" />
      </body>
    </html>
  )
}
