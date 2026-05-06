"use client";

import { deleteAccountAction } from "@/actions/account";
import { Card } from "@/components/ui/Card";
import { useCallback, useState, useTransition } from "react";

type Props = { email: string };

export function SettingsDangerZoneCard({ email }: Props) {
  const [delOpen, setDelOpen] = useState(false);
  const [delEmail, setDelEmail] = useState("");
  const [delErr, setDelErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const confirmDelete = useCallback(() => {
    setDelErr(null);
    startTransition(async () => {
      const r = await deleteAccountAction({ confirmationEmail: delEmail });
      if (r && "ok" in r && r.ok === false) {
        setDelErr(r.error);
      }
    });
  }, [delEmail]);

  return (
    <Card className="border-2 border-red-200 bg-red-50/40 p-6 shadow-tt-sm">
      <h2 className="font-heading text-lg font-semibold text-red-900 sm:text-xl">
        Danger zone
      </h2>
      <p className="mt-2 font-sans text-sm leading-relaxed text-red-900/90">
        Permanently delete your account, all trips, custom tiles, and data.
        This cannot be undone. Purchases are non-refundable after deletion.
      </p>
      <p className="mt-2 font-sans text-xs text-red-900/75">
        Financial records may be retained for up to six years for UK tax
        purposes without personal identifiers where possible.
      </p>
      {!delOpen ? (
        <button
          type="button"
          onClick={() => {
            setDelOpen(true);
            setDelEmail("");
            setDelErr(null);
          }}
          className="mt-4 rounded-lg bg-red-700 px-4 py-2 font-sans text-sm font-semibold text-white hover:bg-red-800"
        >
          Delete my account
        </button>
      ) : (
        <div className="mt-4 space-y-3">
          <p className="font-sans text-sm font-semibold text-red-900">
            Are you absolutely sure? Type your email to confirm.
          </p>
          <input
            className="w-full rounded-tt-md border border-red-300 bg-tt-surface px-3 py-2 font-sans text-sm shadow-tt-sm"
            placeholder={email}
            value={delEmail}
            onChange={(e) => setDelEmail(e.target.value)}
          />
          {delErr ? (
            <p className="font-sans text-sm text-red-800">{delErr}</p>
          ) : null}
          <button
            type="button"
            disabled={
              pending ||
              delEmail.trim().toLowerCase() !== email.toLowerCase()
            }
            onClick={() => void confirmDelete()}
            className="rounded-lg bg-red-800 px-4 py-2 font-sans text-sm font-semibold text-white disabled:opacity-50"
          >
            Yes, delete everything
          </button>
          <button
            type="button"
            onClick={() => setDelOpen(false)}
            className="ml-3 font-sans text-sm text-tt-royal underline underline-offset-2"
          >
            Cancel
          </button>
        </div>
      )}
    </Card>
  );
}
