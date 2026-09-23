import { LegalPage } from "@/components/legal-page"
import { SITE_NAME } from "@/lib/site"

export const metadata = { title: "How we make money" }

export default function PartnersDisclosurePage() {
  return (
    <LegalPage title="How we make money">
      <p>{SITE_NAME} is free for vendors and shoppers. Here&apos;s how we pay the bills, in plain English:</p>
      <ul>
        <li>
          <strong>Booth-fee payments:</strong> when a vendor pays a booth fee by card through {SITE_NAME}, we keep a small
          percentage and the rest goes to the market. Payments on a market&apos;s own payment page don&apos;t earn us anything.
        </li>
        <li>
          <strong>Partners:</strong> some businesses we list (such as insurance providers, shared kitchens and booth
          suppliers) pay us a commission or referral fee when you sign up through our link or use our promo code. They&apos;re
          always marked <strong>&ldquo;Partner&rdquo;</strong>. It doesn&apos;t change the price you pay, and partners
          don&apos;t decide what our guides say.
        </li>
        <li><strong>Featured listings:</strong> some listings may be marked &ldquo;Featured&rdquo; because a business paid to appear first.</li>
      </ul>
      <p>Official government resources in our guides are never paid placements.</p>
    </LegalPage>
  )
}
