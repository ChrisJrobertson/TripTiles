"use client";

import {
  awardFirstPdfExportAction,
  getPdfExportContextAction,
} from "@/actions/pdf";
import { Button } from "@/components/ui/Button";
import { LogoSpinner } from "@/components/ui/LogoSpinner";
import { TripPDF } from "@/components/pdf/TripPDF";
import { tierLoadFailureUserMessage } from "@/lib/supabase/tier-load-error";
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
  /** Default secondary; use accent when Export should read as the gold CTA next to primary Smart Plan. */
  buttonVariant?: "secondary" | "accent";
  defaultModeOnOpen?: PdfExportMode;
}

export function PdfExportButton({
  tripId,
  disabled,
  buttonId,
  onAchievementKeys,
  buttonLabel = "📄 Export to PDF",
  buttonVariant = "secondary",
  defaultModeOnOpen = "with_notes",
}: Props) {
  const [pdfBusy, setPdfBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [exportMode, setExportMode] = useState<PdfExportMode>(defaultModeOnOpen);

  const runExport = useCallback(
    async (mode: PdfExportMode) => {
      setError(null);
      setPdfBusy(true);
      try {
        const result = await getPdfExportContextAction(tripId);
        if (!result.ok) {
          setError(
            result.error === "PROFILE_TIER_UNAVAILABLE"
              ? tierLoadFailureUserMessage()
              : result.error,
          );
          return;
        }

        const blob = await pdf(
          <TripPDF
            trip={result.trip}
            parks={result.parks}
            customTiles={result.customTiles}
            watermark={result.watermark}
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
          const dateStamp = new Date()
            .toISOString()
            .slice(0, 10)
            .replace(/-/g, "");
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
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setPdfBusy(false);
      }
    },
    [tripId, onAchievementKeys],
  );

  return (
    <div className="inline-flex flex-col items-start">
      <Button
        id={buttonId}
        type="button"
        variant={buttonVariant}
        size="md"
        onClick={() => {
          setExportMode(defaultModeOnOpen);
          setModalOpen(true);
        }}
        disabled={disabled || pdfBusy}
        loading={pdfBusy}
        loadingLabel={buttonLabel}
      >
        {buttonLabel}
      </Button>
      {error ? (
        <p className="mt-2 max-w-xs font-sans text-sm text-red-600">{error}</p>
      ) : null}

      {modalOpen ? (
        <div
          className="pointer-events-auto fixed inset-0 z-[100] flex items-center justify-center bg-royal/40 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pdf-export-title"
        >
          <div className="relative w-full max-w-md rounded-2xl border border-royal/15 bg-cream p-6 shadow-xl">
            {pdfBusy ? (
              <div className="absolute inset-0 z-10 min-h-0">
                <LogoSpinner
                  fullscreen
                  size="lg"
                  label="Building your PDF"
                  fullscreenClassName="z-20"
                />
              </div>
            ) : null}
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
                disabled={pdfBusy}
                className="font-sans text-sm font-medium text-royal/80 hover:text-royal disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void runExport(exportMode)}
                disabled={pdfBusy}
                className="rounded-lg bg-gold px-5 py-2.5 font-sans text-sm font-semibold text-royal shadow-sm transition hover:bg-gold/90 disabled:opacity-50"
              >
                {pdfBusy ? (
                  <span className="inline-flex items-center justify-center gap-2">
                    <LogoSpinner size="sm" className="shrink-0" decorative />
                    Exporting
                  </span>
                ) : (
                  "Export"
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
