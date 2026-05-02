import { LegalArticle } from "@/components/marketing/LegalArticle";
import { getPublicSiteUrl } from "@/lib/site";
import type { Metadata } from "next";

const site = getPublicSiteUrl() || "https://www.triptiles.app";

export const metadata: Metadata = {
  title: "Terms of service",
  description: "Terms of use for TripTiles — UK governing law.",
  openGraph: {
    title: "Terms of service · TripTiles",
    description: "TripTiles terms of service.",
    url: `${site}/terms`,
    siteName: "TripTiles",
    locale: "en_GB",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Terms of service · TripTiles",
  },
};

export default function TermsPage() {
  return (
    <LegalArticle title="Terms of service">
      <p className="text-sm text-royal/70">
        <strong>Last updated:</strong> 20 April 2026
      </p>
      <p className="text-sm text-royal/70">
        <strong>Registered address:</strong>{" "}
        <span className="rounded bg-royal/5 px-1">
          [YOUR UK REGISTERED ADDRESS – replace in source or ask TripTiles]
        </span>
      </p>

      <section id="about">
        <h2>1. About TripTiles</h2>
        <p>
          TripTiles is operated by <strong>Chris Robertson</strong> as a sole
          trader in the United Kingdom. The service is provided at{" "}
          <a href={site}>{site.replace(/^https?:\/\//, "")}</a>. By using
          TripTiles you agree to these terms.
        </p>
      </section>

      <section id="account">
        <h2>2. Your account</h2>
        <ul>
          <li>You must be 18 or older, or have parental consent.</li>
          <li>Provide accurate information and keep credentials secure.</li>
          <li>One account per person; do not sell access or share accounts.</li>
        </ul>
      </section>

      <section id="acceptable-use">
        <h2>3. Acceptable use</h2>
        <p>You may use TripTiles to plan trips for yourself, family, friends, or clients where permitted. You must not:</p>
        <ul>
          <li>Abuse the AI (e.g. jailbreaks, illegal content generation).</li>
          <li>Attempt to reverse-engineer or disrupt the service.</li>
          <li>Scrape or republish other users&apos; private trip data.</li>
          <li>Use TripTiles for unlawful purposes or spam invites/shares.</li>
        </ul>
        <p>We may suspend accounts for violations at our discretion.</p>
      </section>

      <section id="payments">
        <h2>4. Payments</h2>

        <h3 className="mt-5 font-serif text-lg font-semibold text-royal">
          Payments and subscriptions
        </h3>
        <p>
          TripTiles offers two paid subscription tiers (Pro and Family), billed
          monthly or annually via Stripe. You can cancel at any time via the
          customer portal in your account settings. On cancellation you retain
          access until the end of your current billing period.
        </p>

        <h2>Cancellation and refunds</h2>
        <p>
          TripTiles is a monthly or annual subscription. You can cancel anytime
          from your Settings page; your subscription will remain active until the
          end of the current billing period, after which it will not renew.
        </p>

        <h3 className="mt-6 font-serif text-lg font-semibold text-royal">
          14-day cooling-off period
        </h3>
        <p>
          Under the UK Consumer Contracts (Information, Cancellation and
          Additional Charges) Regulations 2013, you have the right to cancel your
          subscription within 14 days of purchase for a full refund — provided
          you have not started using the service. By creating a trip, exporting a
          PDF, or generating an AI plan, you waive this right.
        </p>

        <h3 className="mt-6 font-serif text-lg font-semibold text-royal">
          Outside the cooling-off period
        </h3>
        <p>
          Refunds are at our discretion and processed manually. Email
          hello@triptiles.app with your concern. We do not refund partially-used
          billing periods as a matter of course, but we will consider exceptional
          circumstances.
        </p>

        <h3 className="mt-6 font-serif text-lg font-semibold text-royal">
          Annual subscriptions
        </h3>
        <p>
          Annual subscriptions are non-refundable after the 14-day cooling-off
          period except where required by law.
        </p>

        <h3 className="mt-6 font-serif text-lg font-semibold text-royal">
          Price changes
        </h3>
        <p>
          We may change subscription prices with 30 days&apos; advance notice by
          email. Your existing subscription continues at the price you signed up
          at until your next renewal.
        </p>

        <h3 className="mt-6 font-serif text-lg font-semibold text-royal">
          Failed payments
        </h3>
        <p>
          If a renewal payment fails, Stripe will retry automatically over
          approximately 7 days. We will email you if the payment cannot be
          recovered. After that period, your subscription will be cancelled and
          your account will return to the Free tier.
        </p>
      </section>

      <section id="user-content">
        <h2>5. User content</h2>
        <p>
          You own the trip plans, itineraries, and custom tiles you create. By
          marking a trip public you grant TripTiles a limited licence to display
          it on our services. You retain copyright. We may remove content that
          violates these terms. Public plans may be cloned by design.
        </p>
      </section>

      <section id="ip">
        <h2>6. Intellectual property</h2>
        <p>
          The TripTiles name, branding, design, and software are our property.
          Park information is compiled from public sources. Affiliate links may
          be provided for Booking.com and GetYourGuide (and Amazon where
          applicable).
        </p>
      </section>

      <section id="ai">
        <h2>7. AI-generated content</h2>
        <p>
          AI plans are <strong>suggestions only</strong>, not professional travel
          advice. Crowd patterns, wait times, and schedules may be inaccurate.
          You must verify opening hours and bookings before you travel. AI is
          powered by Anthropic; their terms apply to model use.
        </p>
      </section>

      <section id="warranty">
        <h2>8. Warranty disclaimer</h2>
        <p>
          The service is provided &quot;as is&quot; without warranties of any
          kind to the fullest extent permitted by law. We do not guarantee
          uptime, accuracy, or fitness for a particular purpose.
        </p>
      </section>

      <section id="liability">
        <h2>9. Limitation of liability</h2>
        <p>
          To the extent permitted by UK law, our total liability arising out of
          or in connection with these terms is limited to the amount you paid us
          in the twelve months before the claim. We are not liable for travel
          costs, booking losses, or consequential damages. Nothing excludes
          liability that cannot be limited under UK law.
        </p>
      </section>

      <section id="affiliates">
        <h2>10. Affiliate disclosures</h2>
        <p>
          Some links are affiliate links. We may earn commission when you book
          through them at no extra cost to you. Partners include Booking.com,
          GetYourGuide, and Amazon where applicable.
        </p>
      </section>

      <section id="termination">
        <h2>11. Termination</h2>
        <p>
          You may delete your account in Settings. We may terminate for
          violations. On termination you lose access to paid-tier features; data
          is deleted in line with our Privacy policy (typically within 30 days).
        </p>
      </section>

      <section id="law">
        <h2>12. Governing law</h2>
        <p>
          These terms are governed by the laws of <strong>England and Wales</strong>.
          Disputes are subject to the exclusive jurisdiction of the courts of
          England and Wales.
        </p>
      </section>

      <section id="changes-terms">
        <h2>13. Changes</h2>
        <p>
          We may update these terms. Material changes will be notified where
          appropriate. Continued use after changes may constitute acceptance.
        </p>
      </section>

      <section id="contact-terms">
        <h2>14. Contact</h2>
        <p>
          General:{" "}
          <a href="mailto:hello@triptiles.app">hello@triptiles.app</a>
          <br />
          Data protection:{" "}
          <a href="mailto:privacy@triptiles.app">privacy@triptiles.app</a>
        </p>
      </section>
    </LegalArticle>
  );
}
