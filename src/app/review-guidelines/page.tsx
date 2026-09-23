import { LegalPage } from "@/components/legal-page"
import { CONTACT_EMAIL, SITE_NAME } from "@/lib/site"

export const metadata = { title: "Review Guidelines" }

export default function ReviewGuidelinesPage() {
  return (
    <LegalPage title="Review Guidelines">
      <p>Honest reviews help vendors choose markets and help shoppers find good ones. Please keep them useful and fair.</p>
      <h2>Two kinds of reviews</h2>
      <ul>
        <li>
          <strong>Vendor reviews</strong> come only from vendors who were accepted and worked the market on that date. They
          appear as &ldquo;Verified vendor&rdquo;, and market organizers can&apos;t see who wrote them.
        </li>
        <li><strong>Shopper reviews</strong> come from signed-in shoppers, one per market, and show a first name and last initial.</li>
      </ul>
      <h2>Do</h2>
      <ul>
        <li>Write about your own, recent experience.</li>
        <li>Be specific: crowds, organization, load-in, parking, prices, what sold well.</li>
        <li>Keep it about the market, not about individuals.</li>
      </ul>
      <h2>Don&apos;t</h2>
      <ul>
        <li>Post personal attacks, insults, threats, hate speech or harassment.</li>
        <li>Share private information (phone numbers, addresses, anything personal about someone).</li>
        <li>Review a market you run or are paid by, or post fake reviews for or against anyone.</li>
        <li>Offer or accept anything in exchange for a review.</li>
        <li>Post spam, ads or links.</li>
      </ul>
      <h2>Moderation</h2>
      <p>
        We may hide reviews that break these guidelines and tell the writer why. Organizers can reply publicly but
        can&apos;t edit or remove reviews. Think a review breaks the rules? Email{" "}
        <a href={`mailto:${CONTACT_EMAIL}`} className="underline">{CONTACT_EMAIL}</a>. {SITE_NAME} doesn&apos;t remove reviews
        just because they&apos;re negative.
      </p>
    </LegalPage>
  )
}
