import "server-only"
import nodemailer, { type Transporter } from "nodemailer"
import { Resend } from "resend"

export type EmailResult = { ok: true } | { ok: false; skipped?: boolean; error: string }

/**
 * Sends one email: through your email account (SMTP_* settings, e.g. Gmail),
 * or Resend (RESEND_API_KEY). With neither set, the email is printed in the
 * terminal instead, so everything still works while testing.
 *
 * TEST MODE: if EMAIL_TEST_RECIPIENT is set, EVERY email goes to that address
 * instead of the real recipient (marked "[TEST → real address]"). Resend can
 * only deliver to your own address until you verify a domain, and this also
 * stops test emails reaching real markets. Remove it when you go live.
 */
export async function sendEmail(msg: {
  to: string
  subject: string
  html: string
  text: string
  replyTo?: string
}): Promise<EmailResult> {
  const testRecipient = process.env.EMAIL_TEST_RECIPIENT?.trim()
  const to = testRecipient || msg.to
  const subject = testRecipient ? `[TEST → ${msg.to}] ${msg.subject}` : msg.subject

  const from = process.env.EMAIL_FROM || "Stallpass <onboarding@resend.dev>"

  // Option 1: any email account via SMTP (e.g. Gmail with an app password).
  if (process.env.SMTP_HOST) {
    try {
      await smtp().sendMail({
        from,
        to,
        subject,
        html: msg.html,
        text: msg.text,
        ...(msg.replyTo ? { replyTo: msg.replyTo } : {}),
      })
      return { ok: true }
    } catch (e) {
      console.error("Email (SMTP) failed:", e)
      return { ok: false, error: e instanceof Error ? e.message : "Email failed" }
    }
  }

  // Option 2: Resend (needs your own domain to email other people).
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.log(`\n[email NOT sent: email isn't set up]\nTo: ${to}\nSubject: ${subject}\n\n${msg.text}\n`)
    return { ok: false, skipped: true, error: "Email isn't set up yet." }
  }

  const resend = new Resend(apiKey)
  const { error } = await resend.emails.send({
    from,
    to,
    subject,
    html: msg.html,
    text: msg.text,
    ...(msg.replyTo ? { replyTo: msg.replyTo } : {}),
  })
  if (error) {
    console.error("Email failed:", error)
    return { ok: false, error: error.message }
  }
  return { ok: true }
}

let transport: Transporter | null = null
function smtp() {
  transport ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 465),
    secure: Number(process.env.SMTP_PORT || 465) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  })
  return transport
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

export function siteUrl(path = ""): string {
  return `${(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "")}${path}`
}

/** Simple, readable email wrapper. `bodyHtml` must already be escaped. */
export function emailLayout(bodyHtml: string, button?: { label: string; url: string }): string {
  const btn = button
    ? `<p style="margin:24px 0"><a href="${escapeHtml(button.url)}" style="background:#1f6b3f;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">${escapeHtml(button.label)}</a></p>`
    : ""
  return `<!doctype html><html><body style="margin:0;background:#faf7f4;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1c1917">
<div style="max-width:560px;margin:0 auto;padding:24px">
<p style="font-weight:700;font-size:18px;color:#1f6b3f;margin:0 0 16px">Stallpass</p>
<div style="background:#fff;border-radius:12px;padding:24px;font-size:15px;line-height:1.55">${bodyHtml}${btn}</div>
<p style="font-size:12px;color:#78716c;margin-top:16px">Sent by Stallpass, the app for pop-up food vendors and markets.</p>
</div></body></html>`
}
