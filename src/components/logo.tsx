import { cn } from "@/lib/utils"

/** The Stallpass mark (a little market stall with an awning) and wordmark. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={cn("size-9", className)} aria-hidden>
      <rect x="1.5" y="1.5" width="37" height="37" rx="7" fill="#fff" stroke="var(--ink)" strokeWidth="3" />
      <path d="M7 16 L11 8 H29 L33 16 Z" fill="var(--primary)" stroke="var(--ink)" strokeWidth="2" strokeLinejoin="round" />
      <path d="M15.5 8 L14.3 16 M20 8 V16 M24.5 8 L25.7 16" stroke="var(--paper)" strokeWidth="2.4" />
      <path
        d="M7 16 q3.25 4 6.5 0 q3.25 4 6.5 0 q3.25 4 6.5 0 q3.25 4 6.5 0"
        fill="var(--primary)"
        stroke="var(--ink)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M10 20 V32 H30 V20" fill="none" stroke="var(--ink)" strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M17 32 V25 H23 V32" fill="var(--sun)" stroke="var(--ink)" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  )
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <LogoMark />
      <span className="font-heading text-2xl font-extrabold tracking-tight">stallpass</span>
    </span>
  )
}
