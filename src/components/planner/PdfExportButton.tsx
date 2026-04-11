"use client";

import {
  awardFirstPdfExportAction,
  getPdfExportContextAction,
} from "@/actions/pdf";
import { TripPDF } from "@/components/pdf/TripPDF";
import { pdf } from "@react-pdf/renderer";
import { useState } from "react";

interface Props {
  tripId: string;
  disabled?: boolean;
  /** For programmatic click from "More" menu */
  buttonId?: string;
  onAchievementKeys?: (keys: string[]) => void;
}

export function PdfExportButton({
  tripId,
  disabled,
  buttonId,
  onAchievementKeys,
}: Props) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async () => {
    setIsGenerating(true);
    setError(null);
    try {
      const result = await getPdfExportContextAction(tripId);
      if (!result.ok) {
        setError(result.error);
        setIsGenerating(false);
        return;
      }

      const blob = await pdf(
        <TripPDF
          trip={result.trip}
          parks={result.parks}
          customTiles={result.customTiles}
          watermark={result.watermark}
          design={result.design}
          familyName={result.familyName}
          bookingAffiliateLinks={result.bookingLinks}
        />,
      ).toBlob();

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${result.trip.adventure_name.replace(/[^a-z0-9]/gi, "_")}_triptiles.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      const ach = await awardFirstPdfExportAction();
      if (ach.ok && ach.justEarned) {
        onAchievementKeys?.(["first_pdf_export"]);
      }

      setIsGenerating(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setIsGenerating(false);
    }
  };

  return (
    <div className="inline-flex flex-col items-start">
      <button
        id={buttonId}
        type="button"
        onClick={() => void handleExport()}
        disabled={disabled || isGenerating}
        className="rounded-lg bg-royal px-4 py-2.5 font-serif text-sm font-bold text-gold shadow-sm transition hover:bg-royal/90 disabled:opacity-50"
      >
        {isGenerating ? "Generating PDF…" : "📄 Export to PDF"}
      </button>
      {error ? (
        <p className="mt-2 max-w-xs font-sans text-sm text-red-600">{error}</p>
      ) : null}
    </div>
  );
}
