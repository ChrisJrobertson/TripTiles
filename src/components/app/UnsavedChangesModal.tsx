"use client";

import { Button } from "@/components/ui/Button";
import { ModalShell } from "@/components/ui/ModalShell";

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
    <ModalShell
      zClassName="z-[140]"
      overlayClassName="bg-tt-royal/50 backdrop-blur-[1px]"
      maxWidthClass="max-w-md"
      role="dialog"
      aria-modal={true}
      aria-labelledby="unsaved-changes-title"
    >
      <div className="p-5 sm:p-6">
        <h2
          id="unsaved-changes-title"
          className="font-heading text-lg font-semibold text-tt-royal"
        >
          You have unsaved changes
        </h2>
        <p className="mt-2 font-sans text-sm text-tt-royal/75">
          Save and continue, discard changes, or stay on this page.
        </p>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            className="min-h-11"
            onClick={onCancel}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            className="min-h-11"
            onClick={onDiscardChanges}
          >
            Discard changes
          </Button>
          <Button
            type="button"
            variant="primary"
            className="min-h-11"
            onClick={onSaveAndContinue}
          >
            Save and continue
          </Button>
        </div>
      </div>
    </ModalShell>
  );
}
