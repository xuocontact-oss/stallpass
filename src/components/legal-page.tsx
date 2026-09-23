import { LEGAL_UPDATED } from "@/lib/site"

/** Readable layout for the Terms, Privacy and guideline pages. */
export function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <h1 className="text-3xl font-bold">{title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">Last updated {LEGAL_UPDATED}</p>
      <div className="mt-6 space-y-4 text-[15px] leading-relaxed [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1.5">
        {children}
      </div>
    </main>
  )
}
