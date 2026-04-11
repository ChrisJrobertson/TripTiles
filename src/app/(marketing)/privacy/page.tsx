import { LegalArticle } from "@/components/marketing/LegalArticle";
import { getPublicSiteUrl } from "@/lib/site";
import type { Metadata } from "next";

const site = getPublicSiteUrl() || "https://www.triptiles.app";

export const metadata: Metadata = {
  title: "Privacy policy",
  description:
    "How TripTiles collects, uses, and protects your personal data (UK GDPR).",
  openGraph: {
    title: "Privacy policy · TripTiles",
    description: "TripTiles privacy policy and data protection information.",
    url: `${site}/privacy`,
    siteName: "TripTiles",
    locale: "en_GB",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Privacy policy · TripTiles",
  },
};

export default function PrivacyPage() {
  return (
    <LegalArticle title="Privacy policy">
      <p className="rounded-lg border border-gold/40 bg-white/80 p-4 text-sm text-royal/85">
        <strong className="text-royal">Template notice:</strong> This is a
        template privacy policy. We are a small, pre-launch product and aim for
        substantive compliance with UK GDPR principles. If you have specific
        questions about data handling, email us at{" "}
        <a href="mailto:privacy@triptiles.com">privacy@triptiles.com</a>.
      </p>
      <p className="text-sm text-royal/70">
        <strong>Last updated:</strong> 11 April 2026
      </p>
      <p className="text-sm text-royal/70">
        <strong>Registered address (sole trader):</strong>{" "}
        <span className="rounded bg-royal/5 px-1">
          [YOUR UK REGISTERED ADDRESS – replace in source or ask TripTiles]
        </span>
      </p>

      <section id="who-we-are">
        <h2>1. Who we are</h2>
        <p>
          TripTiles is operated by <strong>Chris Robertson</strong> as a sole
          trader in the United Kingdom. For data protection purposes, Chris
          Robertson is the <strong>data controller</strong> under UK GDPR.
        </p>
        <p>
          Contact for privacy matters:{" "}
          <a href="mailto:privacy@triptiles.com">privacy@triptiles.com</a>
          <br />
          General enquiries:{" "}
          <a href="mailto:hello@triptiles.com">hello@triptiles.com</a>
          <br />
          Website: <a href={site}>{site.replace(/^https?:\/\//, "")}</a>
        </p>
      </section>

      <section id="what-we-collect">
        <h2>2. What data we collect</h2>
        <ul>
          <li>
            <strong>Account data:</strong> email address, password hash (held by
            Supabase Auth), subscription tier, optional display name.
          </li>
          <li>
            <strong>Trip data:</strong> destinations, dates, calendar
            assignments, preferences, notes, and public sharing settings where
            you choose to publish.
          </li>
          <li>
            <strong>Usage data:</strong> AI generation prompts and outputs
            (stored to provide the service), timestamps, and model identifiers.
          </li>
          <li>
            <strong>Payment data:</strong> Payhip transaction references and
            product identifiers. We do not receive or store your full card
            details — Payhip processes card data.
          </li>
          <li>
            <strong>Technical data:</strong> IP address, user agent, essential
            session cookies (httpOnly), and basic analytics from our hosting
            provider (privacy-friendly, no advertising cookies).
          </li>
          <li>
            <strong>Communications:</strong> transactional and scheduled emails
            (e.g. confirmations, trip reminders, collaborator invites) sent via
            Resend.
          </li>
        </ul>
      </section>

      <section id="legal-basis">
        <h2>3. Legal basis (Article 6 UK GDPR)</h2>
        <ul>
          <li>
            <strong>Contract:</strong> processing necessary to run TripTiles for
            you.
          </li>
          <li>
            <strong>Legitimate interests:</strong> securing the service, fraud
            prevention, product improvement, and aggregate analytics where
            proportionate.
          </li>
          <li>
            <strong>Consent:</strong> where we rely on consent (e.g. optional
            marketing — we do not send marketing without opt-in).
          </li>
          <li>
            <strong>Legal obligation:</strong> retaining certain financial
            records for UK tax law (typically up to six years for relevant
            transactions).
          </li>
        </ul>
      </section>

      <section id="how-we-use">
        <h2>4. How we use your data</h2>
        <ul>
          <li>Providing the planner, AI features, PDF export, and sharing.</li>
          <li>Processing upgrades via Payhip.</li>
          <li>
            Sending service emails (account, security, trip lifecycle, invites).
          </li>
          <li>Improving reliability and security; aggregate analytics only.</li>
          <li>Fraud prevention and abuse detection.</li>
        </ul>
      </section>

      <section id="processors">
        <h2>5. Who we share data with (processors)</h2>
        <p>
          We do <strong>not</strong> sell your personal data. We use processors
          who handle data only to provide their services to us:
        </p>
        <ul>
          <li>
            <a href="https://supabase.com/privacy" target="_blank" rel="noreferrer">
              Supabase
            </a>{" "}
            — database and authentication.
          </li>
          <li>
            <a
              href="https://vercel.com/legal/privacy-policy"
              target="_blank"
              rel="noreferrer"
            >
              Vercel
            </a>{" "}
            — hosting and web analytics (privacy-oriented).
          </li>
          <li>
            <a href="https://www.anthropic.com/legal/privacy" target="_blank" rel="noreferrer">
              Anthropic
            </a>{" "}
            — AI processing when you use Smart Plan.
          </li>
          <li>
            <a href="https://resend.com/legal/privacy-policy" target="_blank" rel="noreferrer">
              Resend
            </a>{" "}
            — email delivery.
          </li>
          <li>
            <a href="https://payhip.com/privacy" target="_blank" rel="noreferrer">
              Payhip
            </a>{" "}
            — payment checkout.
          </li>
          <li>
            <a
              href="https://www.booking.com/content/privacy.html"
              target="_blank"
              rel="noreferrer"
            >
              Booking.com
            </a>{" "}
            — if you click our affiliate hotel links, their policy applies on
            their site.
          </li>
          <li>
            <a
              href="https://www.getyourguide.com/privacy/"
              target="_blank"
              rel="noreferrer"
            >
              GetYourGuide
            </a>{" "}
            — if you click our affiliate experience links.
          </li>
        </ul>
      </section>

      <section id="transfers">
        <h2>6. International transfers</h2>
        <p>
          Some processors may process data outside the UK/EEA. Where required, we
          rely on appropriate safeguards such as the UK International Data
          Transfer Agreement / Addendum and Standard Contractual Clauses. Data is
          encrypted in transit (TLS) and protected at rest by our processors.
        </p>
      </section>

      <section id="retention">
        <h2>7. How long we keep data</h2>
        <ul>
          <li>
            <strong>Active accounts:</strong> whilst your account exists and as
            needed to provide the service.
          </li>
          <li>
            <strong>Deleted accounts:</strong> personal data removed within{" "}
            <strong>30 days</strong> of deletion, subject to backups rotating
            out.
          </li>
          <li>
            <strong>Financial records:</strong> up to <strong>six years</strong>{" "}
            where UK law requires retention (metadata only where applicable).
          </li>
          <li>
            <strong>Backups:</strong> may persist for up to{" "}
            <strong>30 days</strong> in routine backup cycles.
          </li>
          <li>
            <strong>Aggregated analytics</strong> without personal identifiers
            may be kept indefinitely.
          </li>
        </ul>
      </section>

      <section id="your-rights">
        <h2>8. Your rights under UK GDPR</h2>
        <p>You may have the right to:</p>
        <ul>
          <li>Access the personal data we hold about you.</li>
          <li>Rectify inaccurate data.</li>
          <li>Erase your data (see account deletion in Settings).</li>
          <li>Restrict processing in certain circumstances.</li>
          <li>Data portability for data you provided (e.g. export).</li>
          <li>Object to processing based on legitimate interests.</li>
          <li>Withdraw consent where processing is consent-based.</li>
        </ul>
        <p>
          To exercise a right, email{" "}
          <a href="mailto:privacy@triptiles.com">privacy@triptiles.com</a>. We
          will respond within <strong>30 days</strong>. You may also complain to
          the ICO:{" "}
          <a href="https://ico.org.uk" target="_blank" rel="noreferrer">
            ico.org.uk
          </a>
          .
        </p>
      </section>

      <section id="cookies">
        <h2>9. Cookies</h2>
        <p>
          We use essential cookies only (session and authentication). We do not
          use non-essential tracking or marketing cookies on TripTiles itself.
          Vercel Analytics does not use cookies in the usual tracking sense.
          See our <a href="/cookies">Cookie policy</a> for details.
        </p>
      </section>

      <section id="children">
        <h2>10. Children</h2>
        <p>
          TripTiles is not directed at children under 13, and we do not knowingly
          collect personal data from children under 13. If you believe a child
          has signed up, contact{" "}
          <a href="mailto:privacy@triptiles.com">privacy@triptiles.com</a>.
        </p>
      </section>

      <section id="security">
        <h2>11. Security</h2>
        <p>
          We use HTTPS, industry-standard password hashing via Supabase, and
          database Row Level Security. We review access and rotate secrets
          periodically.
        </p>
      </section>

      <section id="changes">
        <h2>12. Changes to this policy</h2>
        <p>
          We may update this policy. Material changes will be highlighted on
          this page and, where appropriate, notified by email. The effective date
          is shown at the top.
        </p>
      </section>

      <section id="contact">
        <h2>13. Contact</h2>
        <p>
          <a href="mailto:privacy@triptiles.com">privacy@triptiles.com</a>
        </p>
      </section>
    </LegalArticle>
  );
}
