"use client";

type Props = {
  isOpen: boolean;
  onSaveAndContinue: () => void;
  onDiscardChanges: () => void;
  onCancel: () => void;
};

export function UnsavedChangesModal({
  isOpen,
  onSaveAndContinue,
  onDiscardChanges,
  onCancel,
}: Props) {
  if (!isOpen) return null;
  return (
    <div
      className="fixed inset-0 z-[140] flex items-center justify-center bg-royal/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="unsaved-changes-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-royal/15 bg-cream p-5 shadow-xl">
        <h2
          id="unsaved-changes-title"
          className="font-serif text-lg font-semibold text-royal"
        >
          You have unsaved changes
        </h2>
        <p className="mt-2 font-sans text-sm text-royal/75">
          Save and continue, discard changes, or stay on this page.
        </p>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[44px] rounded-lg border border-royal/20 bg-white px-4 py-2 font-sans text-sm font-medium text-royal"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onDiscardChanges}
            className="min-h-[44px] rounded-lg border border-red-200 bg-red-50 px-4 py-2 font-sans text-sm font-semibold text-red-800"
          >
            Discard changes
          </button>
          <button
            type="button"
            onClick={onSaveAndContinue}
            className="min-h-[44px] rounded-lg bg-royal px-4 py-2 font-sans text-sm font-semibold text-cream"
          >
            Save and continue
          </button>
        </div>
      </div>
    </div>
  );
}
