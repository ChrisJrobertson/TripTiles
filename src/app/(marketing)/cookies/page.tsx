import { LegalArticle } from "@/components/marketing/LegalArticle";
import { getPublicSiteUrl } from "@/lib/site";
import type { Metadata } from "next";

const site = getPublicSiteUrl() || "https://www.triptiles.app";

export const metadata: Metadata = {
  title: "Cookie policy",
  description: "How TripTiles uses cookies — essential only.",
  openGraph: {
    title: "Cookie policy · TripTiles",
    description: "TripTiles uses minimal essential cookies.",
    url: `${site}/cookies`,
    siteName: "TripTiles",
    locale: "en_GB",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Cookie policy · TripTiles",
  },
};

export default function CookiesPage() {
  return (
    <LegalArticle title="Cookie policy">
      <p className="text-sm text-royal/70">
        <strong>Last updated:</strong> 11 April 2026
      </p>
      <p>
        TripTiles uses the <strong>minimum cookies</strong> required to provide
        our service.
      </p>
      <section id="essential">
        <h2>Essential cookies</h2>
        <ul>
          <li>
            <strong>Supabase session cookies (sb-*):</strong> keep you signed in
            securely.
          </li>
          <li>
            <strong>tt_sess:</strong> anonymous session identifier for affiliate
            click tracking (httpOnly).
          </li>
        </ul>
      </section>
      <section id="what-we-do-not-use">
        <h2>What we do not use</h2>
        <ul>
          <li>No marketing cookies.</li>
          <li>No third-party advertising cookies.</li>
          <li>No Google Analytics.</li>
          <li>
            Vercel Web Analytics and Speed Insights are configured to be
            privacy-friendly and do not rely on non-essential cookies for core
            operation.
          </li>
        </ul>
      </section>
      <section id="browser">
        <h2>Your browser</h2>
        <p>
          You can disable cookies in your browser settings, but TripTiles will
          not function correctly — you will not be able to stay signed in.
        </p>
      </section>
      <section id="banner">
        <h2>Cookie banner</h2>
        <p>
          We do not use a cookie consent banner because we do not set
          non-essential cookies that require consent under UK GDPR for the
          categories described above. If we introduce optional analytics or
          marketing cookies in future, we will update this policy and obtain
          consent where required.
        </p>
      </section>
    </LegalArticle>
  );
}
