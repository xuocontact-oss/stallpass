import Link from "next/link"
import { LegalPage } from "@/components/legal-page"
import { CONTACT_EMAIL, LEGAL_NAME, SITE_NAME } from "@/lib/site"

export const metadata = { title: "Privacy Policy" }

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy">
      <p>
        This explains what information {LEGAL_NAME} (&ldquo;{SITE_NAME}&rdquo;) collects, why, who we share it with, and
        your choices. The short version: we use your information to run {SITE_NAME}, we share it with markets only when you
        apply, and <strong>we don&apos;t sell your personal information</strong>.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li><strong>Account details:</strong> your email address, name, and (for vendors) phone number.</li>
        <li><strong>Business details:</strong> business name, what you sell, description, menu or product list, photos, social links and setup needs.</li>
        <li><strong>Documents you upload:</strong> permits, licenses, insurance certificates and similar files, with the dates you enter.</li>
        <li><strong>Activity:</strong> markets you apply to, application status, messages from organizers, reviews you write, and payment records.</li>
        <li><strong>Sales reports:</strong> the sales totals you report for market days. If you connect Square, we read your payment totals (read-only) to fill these in. We can&apos;t move money or see card numbers.</li>
        <li><strong>Location:</strong> a home ZIP code if you give one. If you tap &ldquo;near me&rdquo;, your browser shares your approximate location for that search only; we don&apos;t store it.</li>
        <li><strong>Partner clicks:</strong> when you click a partner link or copy a promo code, we record that it happened (and your account, if you&apos;re signed in) so we can be paid by the partner.</li>
        <li><strong>Technical data:</strong> the cookies needed to keep you signed in, and basic logs (such as IP address and browser) used for security and fixing problems. We don&apos;t use advertising trackers.</li>
      </ul>

      <h2>How we use it</h2>
      <ul>
        <li>To run your account and the features you use: storing documents, reminding you before they expire, applications, reviews and payments.</li>
        <li>To send you emails you need (sign-in links, reminders, application updates, receipts).</li>
        <li>To keep {SITE_NAME} safe: preventing spam, fraud and abuse.</li>
        <li>To improve {SITE_NAME}.</li>
      </ul>

      <h2>Who we share it with</h2>
      <ul>
        <li>
          <strong>Markets you apply to</strong> receive your business profile, contact details and the documents you choose to
          attach. Markets not yet on {SITE_NAME} get this by email, with a secure link that expires after 14 days.
        </li>
        <li><strong>A market&apos;s organizer</strong> sees the sales reports you submit for their market. We may use sales figures combined and anonymized across many vendors (never your individual numbers) to show typical sales ranges and to improve {SITE_NAME}.</li>
        <li>
          <strong>The public</strong> sees reviews. Vendor reviews are shown as &ldquo;Verified vendor&rdquo; with no name;
          shopper reviews show your first name and last initial.
        </li>
        <li>
          <strong>Service providers</strong> who run parts of {SITE_NAME} for us: Supabase (database and file storage),
          Netlify (hosting), Stripe (card payments), Square (only if you connect it), our email provider, Cloudflare (bot
          protection) and OpenStreetMap (map images). They may only use your information to provide their service.
        </li>
        <li><strong>When the law requires it</strong>, or to protect people&apos;s safety or rights.</li>
      </ul>
      <p>We don&apos;t sell or &ldquo;share&rdquo; personal information for advertising.</p>

      <h2>How long we keep it</h2>
      <p>
        We keep your information while your account is open. When you delete your account, we delete your profile,
        documents, photos, applications and reviews. Some records (such as payment records) may be kept longer where the
        law requires.
      </p>

      <h2>Your choices and rights</h2>
      <ul>
        <li>
          <strong>See and download your data:</strong> Account → &ldquo;Download my data&rdquo;.
        </li>
        <li><strong>Correct it:</strong> edit your profile, business details and documents at any time.</li>
        <li><strong>Delete it:</strong> Account → &ldquo;Delete my account&rdquo;.</li>
        <li>
          California residents have these rights under the California Consumer Privacy Act (CCPA), and won&apos;t be treated
          differently for using them. You can also email us to make a request.
        </li>
      </ul>

      <h2>Security</h2>
      <p>
        Documents are stored privately; only you, markets you apply to, and our admin can open them, through links that
        expire after 60 seconds. Access to data is restricted by account at the database level.
      </p>

      <h2>Children</h2>
      <p>{SITE_NAME} is for people 18 and over. We don&apos;t knowingly collect information from children.</p>

      <h2>Changes</h2>
      <p>We&apos;ll post any changes here and tell you about important ones.</p>

      <h2>Contact</h2>
      <p>
        Email <a href={`mailto:${CONTACT_EMAIL}`} className="underline">{CONTACT_EMAIL}</a>. See also our{" "}
        <Link href="/terms" className="underline">Terms</Link>.
      </p>
    </LegalPage>
  )
}
