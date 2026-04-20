"use client";

import {
  awardFirstPdfExportAction,
  getPdfExportContextAction,
} from "@/actions/pdf";
import { TripPDF } from "@/components/pdf/TripPDF";
import { pdf } from "@react-pdf/renderer";
import { useCallback, useState } from "react";

export type PdfExportMode = "with_notes" | "clean_printable" | "payments_schedule";

interface Props {
  tripId: string;
  disabled?: boolean;
  /** For programmatic click from "More" menu */
  buttonId?: string;
  onAchievementKeys?: (keys: string[]) => void;
  buttonLabel?: string;
  defaultModeOnOpen?: PdfExportMode;
}

export function PdfExportButton({
  tripId,
  disabled,
  buttonId,
  onAchievementKeys,
  buttonLabel = "📄 Export to PDF",
  defaultModeOnOpen = "with_notes",
}: Props) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [exportMode, setExportMode] = useState<PdfExportMode>(defaultModeOnOpen);

  const runExport = useCallback(
    async (mode: PdfExportMode) => {
      setIsGenerating(true);
      setError(null);
      try {
        const result = await getPdfExportContextAction(tripId);
        if (!result.ok) {
          setError(
            result.error === "PROFILE_TIER_UNAVAILABLE"
              ? "Could not load your plan. Refresh the page or sign in again."
              : result.error,
          );
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
            bookingAffiliateLinks={
              mode === "with_notes" ? result.bookingLinks : undefined
            }
            includeNotes={mode === "with_notes"}
            exportMode={mode}
            budgetItems={result.budgetItems}
            checklistItems={result.checklistItems}
            tripPayments={result.tripPayments}
            temperatureUnit={result.temperatureUnit}
          />,
        ).toBlob();

        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        const safeTripName = result.trip.adventure_name.replace(/[^a-z0-9]/gi, "_");
        if (mode === "payments_schedule") {
          const dateStamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
          link.download = `${safeTripName}-payments-${dateStamp}.pdf`;
        } else {
          link.download = `${safeTripName}_triptiles.pdf`;
        }
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        const ach = await awardFirstPdfExportAction();
        if (ach.ok && ach.justEarned) {
          onAchievementKeys?.(["first_pdf_export"]);
        }

        setModalOpen(false);
        setIsGenerating(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
        setIsGenerating(false);
      }
    },
    [tripId, onAchievementKeys],
  );

  return (
    <div className="inline-flex flex-col items-start">
      <button
        id={buttonId}
        type="button"
        onClick={() => {
          setExportMode(defaultModeOnOpen);
          setModalOpen(true);
        }}
        disabled={disabled || isGenerating}
        className="rounded-lg bg-royal px-4 py-2.5 font-serif text-sm font-bold text-gold shadow-sm transition hover:bg-royal/90 disabled:opacity-50"
      >
        {isGenerating ? "Generating PDF…" : buttonLabel}
      </button>
      {error ? (
        <p className="mt-2 max-w-xs font-sans text-sm text-red-600">{error}</p>
      ) : null}

      {modalOpen ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-royal/40 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pdf-export-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-royal/15 bg-cream p-6 shadow-xl">
            <h2
              id="pdf-export-title"
              className="font-serif text-xl font-semibold text-royal"
            >
              Export PDF
            </h2>
            <p className="mt-2 font-sans text-sm text-royal/70">
              Pick an export layout for your trip plans.
            </p>

            <fieldset className="mt-5 space-y-3 font-sans text-sm text-royal">
              <legend className="sr-only">PDF content</legend>
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-royal/15 bg-white px-3 py-2.5 has-[:checked]:border-gold/60 has-[:checked]:ring-1 has-[:checked]:ring-gold/40">
                <input
                  type="radio"
                  name="pdf-notes"
                  className="mt-0.5 accent-royal"
                  checked={exportMode === "with_notes"}
                  onChange={() => setExportMode("with_notes")}
                />
                <span>
                  <span className="font-semibold">With notes and tips</span>
                  <span className="mt-0.5 block text-royal/65">
                    Strategy summary, per-day tips, and booking links
                  </span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-royal/15 bg-white px-3 py-2.5 has-[:checked]:border-gold/60 has-[:checked]:ring-1 has-[:checked]:ring-gold/40">
                <input
                  type="radio"
                  name="pdf-notes"
                  className="mt-0.5 accent-royal"
                  checked={exportMode === "clean_printable"}
                  onChange={() => setExportMode("clean_printable")}
                />
                <span>
                  <span className="font-semibold">Clean printable version</span>
                  <span className="mt-0.5 block text-royal/65">
                    Cover and calendar only — perfect for the fridge
                  </span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-royal/15 bg-white px-3 py-2.5 has-[:checked]:border-gold/60 has-[:checked]:ring-1 has-[:checked]:ring-gold/40">
                <input
                  type="radio"
                  name="pdf-notes"
                  className="mt-0.5 accent-royal"
                  checked={exportMode === "payments_schedule"}
                  onChange={() => setExportMode("payments_schedule")}
                />
                <span>
                  <span className="font-semibold">Payments schedule</span>
                  <span className="mt-0.5 block text-royal/65">
                    Single-page table of payment dates, totals, and due countdowns
                  </span>
                </span>
              </label>
            </fieldset>

            <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                disabled={isGenerating}
                className="font-sans text-sm font-medium text-royal/80 hover:text-royal disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void runExport(exportMode)}
                disabled={isGenerating}
                className="rounded-lg bg-gold px-5 py-2.5 font-sans text-sm font-semibold text-royal shadow-sm transition hover:bg-gold/90 disabled:opacity-50"
              >
                {isGenerating ? "Exporting…" : "Export"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
