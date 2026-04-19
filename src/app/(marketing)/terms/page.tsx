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
        <strong>Last updated:</strong> 11 April 2026
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
        <h2>4. Subscriptions and payments</h2>
        <p>
          Plans include Free, Pro, and Family tiers. Pro and Family are{" "}
          <strong>recurring subscriptions</strong> billed monthly or annually.
          Checkout and billing are processed by Stripe — their terms also apply.
          You can cancel from Settings; paid access remains active until the end
          of your current billing period. VAT is included for UK buyers where
          applicable.
        </p>
      </section>

      <section id="refunds">
        <h2>5. Refunds</h2>
        <p>
          We offer a <strong>30-day money-back guarantee</strong>. Request via{" "}
          <a href="mailto:hello@triptiles.com">hello@triptiles.com</a>. After 30
          days, refunds are considered case-by-case. Refunded accounts revert to
          the Free tier but your trip data generally remains available on Free
          limits.
        </p>
      </section>

      <section id="user-content">
        <h2>6. User content</h2>
        <p>
          You own the trip plans, itineraries, and custom tiles you create. By
          marking a trip public you grant TripTiles a limited licence to display
          it on our services. You retain copyright. We may remove content that
          violates these terms. Public plans may be cloned by design.
        </p>
      </section>

      <section id="ip">
        <h2>7. Intellectual property</h2>
        <p>
          The TripTiles name, branding, design, and software are our property.
          Park information is compiled from public sources. Affiliate links may
          be provided for Booking.com and GetYourGuide (and Amazon where
          applicable).
        </p>
      </section>

      <section id="ai">
        <h2>8. AI-generated content</h2>
        <p>
          AI plans are <strong>suggestions only</strong>, not professional travel
          advice. Crowd patterns, wait times, and schedules may be inaccurate.
          You must verify opening hours and bookings before you travel. AI is
          powered by Anthropic; their terms apply to model use.
        </p>
      </section>

      <section id="warranty">
        <h2>9. Warranty disclaimer</h2>
        <p>
          The service is provided &quot;as is&quot; without warranties of any
          kind to the fullest extent permitted by law. We do not guarantee
          uptime, accuracy, or fitness for a particular purpose.
        </p>
      </section>

      <section id="liability">
        <h2>10. Limitation of liability</h2>
        <p>
          To the extent permitted by UK law, our total liability arising out of
          or in connection with these terms is limited to the amount you paid us
          in the twelve months before the claim. We are not liable for travel
          costs, booking losses, or consequential damages. Nothing excludes
          liability that cannot be limited under UK law.
        </p>
      </section>

      <section id="affiliates">
        <h2>11. Affiliate disclosures</h2>
        <p>
          Some links are affiliate links. We may earn commission when you book
          through them at no extra cost to you. Partners include Booking.com,
          GetYourGuide, and Amazon where applicable.
        </p>
      </section>

      <section id="termination">
        <h2>12. Termination</h2>
        <p>
          You may delete your account in Settings. We may terminate for
          violations. On termination you lose access to paid-tier features; data
          is deleted in line with our Privacy policy (typically within 30 days).
        </p>
      </section>

      <section id="law">
        <h2>13. Governing law</h2>
        <p>
          These terms are governed by the laws of <strong>England and Wales</strong>.
          Disputes are subject to the exclusive jurisdiction of the courts of
          England and Wales.
        </p>
      </section>

      <section id="changes-terms">
        <h2>14. Changes</h2>
        <p>
          We may update these terms. Material changes will be notified where
          appropriate. Continued use after changes may constitute acceptance.
        </p>
      </section>

      <section id="contact-terms">
        <h2>15. Contact</h2>
        <p>
          General:{" "}
          <a href="mailto:hello@triptiles.com">hello@triptiles.com</a>
          <br />
          Data protection:{" "}
          <a href="mailto:privacy@triptiles.com">privacy@triptiles.com</a>
        </p>
      </section>
    </LegalArticle>
  );
}
