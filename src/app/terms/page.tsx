import Link from "next/link"
import { LegalPage } from "@/components/legal-page"
import { CONTACT_EMAIL, LEGAL_NAME, SITE_NAME } from "@/lib/site"

export const metadata = { title: "Terms of Service" }

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service">
      <p>
        These terms are an agreement between you and {LEGAL_NAME} (&ldquo;{SITE_NAME}&rdquo;, &ldquo;we&rdquo;) about using
        the {SITE_NAME} website and app. By creating an account or using {SITE_NAME}, you agree to them. If you don&apos;t
        agree, please don&apos;t use {SITE_NAME}.
      </p>

      <h2>1. What {SITE_NAME} does</h2>
      <p>
        {SITE_NAME} helps vendors keep their business documents in one place, find markets and apply to them, and helps
        market organizers receive and manage applications. Shoppers can find markets and review them. We are a tool that
        connects vendors and markets. We don&apos;t run markets, and we aren&apos;t a party to any agreement between a
        vendor and a market.
      </p>

      <h2>2. Your account</h2>
      <ul>
        <li>You must be at least 18 to create an account.</li>
        <li>Give accurate information and keep it up to date. You&apos;re responsible for everything done with your account.</li>
        <li>Keep access to your email secure; signing in works through links we email you.</li>
        <li>One person or business per account. Don&apos;t impersonate anyone.</li>
      </ul>

      <h2>3. Vendors</h2>
      <ul>
        <li>
          Documents you upload (permits, licenses, insurance certificates) must be genuine, current and yours. Uploading
          forged or altered documents will get your account closed and may be reported.
        </li>
        <li>
          Our &ldquo;readiness check&rdquo; compares the dates and document types you enter with what a market lists. It
          doesn&apos;t verify that a document is genuine or legally sufficient. You&apos;re responsible for holding every
          permit and license you need.
        </li>
        <li>When you apply to a market, you allow us to share your profile and the documents you choose with that market.</li>
        <li>Whether you&apos;re accepted, where you&apos;re placed, and the market&apos;s rules are up to each market.</li>
      </ul>

      <h2>4. Market organizers</h2>
      <ul>
        <li>Only claim or list markets you&apos;re authorized to manage. We check claims, and may remove markets or access.</li>
        <li>Keep your listing accurate (dates, fees, requirements), and treat applicants fairly and lawfully.</li>
        <li>Use vendors&apos; information and documents only to evaluate and manage their participation in your market.</li>
      </ul>

      <h2>5. Market listings</h2>
      <p>
        Some listings come from public sources such as the USDA National Farmers Market Directory, and may be out of date.
        Check with a market before relying on its details.
      </p>

      <h2>6. Payments</h2>
      <ul>
        <li>
          Card payments for booth fees are processed by Stripe, and money goes to the market organizer&apos;s Stripe
          account. By paying, you also agree to Stripe&apos;s terms. {SITE_NAME} charges organizers a service fee on card
          payments made through {SITE_NAME}, shown in the app.
        </li>
        <li>
          Some markets use their own payment pages. Those payments happen outside {SITE_NAME}, and we aren&apos;t
          responsible for them.
        </li>
        <li>Refunds and cancellations are between the vendor and the market, under the market&apos;s policy.</li>
      </ul>

      <h2>7. Reviews and content you post</h2>
      <ul>
        <li>
          Reviews must follow our <Link href="/review-guidelines" className="underline">Review Guidelines</Link>. We may
          remove content that doesn&apos;t.
        </li>
        <li>
          You keep ownership of what you post. You give us a free, worldwide license to host, show and share it as part of
          running {SITE_NAME} (for example, showing your review on a market&apos;s page, or your profile to markets you
          apply to).
        </li>
      </ul>

      <h2>8. Things you must not do</h2>
      <ul>
        <li>Break the law, or help anyone else break it.</li>
        <li>Post false, misleading, abusive, hateful or spam content, or fake reviews.</li>
        <li>Harass other users, or use their information for anything other than the reason they shared it.</li>
        <li>Try to get into accounts or data that aren&apos;t yours, or interfere with how {SITE_NAME} works.</li>
        <li>Scrape or copy {SITE_NAME} in bulk without our permission.</li>
      </ul>

      <h2>9. Guides and partner offers</h2>
      <p>
        Our guides (such as the Start guide) are general information, not legal, tax or insurance advice. Rules differ by
        city and change. Some businesses we list are partners that pay us when you sign up. See our{" "}
        <Link href="/partners" className="underline">partner disclosure</Link>. Your dealings with any business you find
        through {SITE_NAME} are between you and that business.
      </p>

      <h2>10. Suspending or closing accounts</h2>
      <p>
        We may suspend or close accounts that break these terms or put other users at risk. You can delete your account at
        any time from your Account page.
      </p>

      <h2>11. Disclaimers</h2>
      <p>
        {SITE_NAME} is provided &ldquo;as is&rdquo;. We work hard to keep it running and accurate, but we don&apos;t
        promise it will always be available, error-free, or that any market or vendor will perform as described. We
        aren&apos;t responsible for the conduct of markets, vendors, shoppers or other businesses.
      </p>

      <h2>12. Limitation of liability</h2>
      <p>
        To the extent the law allows, {LEGAL_NAME} won&apos;t be liable for indirect or consequential losses (such as lost
        sales or profits), and our total liability for any claim is limited to the greater of $100 or the fees you paid us
        in the 12 months before the claim.
      </p>

      <h2>13. Changes and law</h2>
      <p>
        We may update these terms; if the changes are important we&apos;ll tell you in the app or by email. These terms are
        governed by the laws of the State of California.
      </p>

      <h2>14. Contact</h2>
      <p>
        Questions? Email <a href={`mailto:${CONTACT_EMAIL}`} className="underline">{CONTACT_EMAIL}</a>.
      </p>
    </LegalPage>
  )
}
