"use client";

import { updateProfileEmailMarketingOptOutAction } from "@/actions/profile-preferences";
import { useState, useTransition } from "react";

type Props = {
  initialOptOut: boolean;
};

export function EmailPreferencesSettings({ initialOptOut }: Props) {
  const [optOut, setOptOut] = useState(initialOptOut);
  const [pending, startTransition] = useTransition();

  return (
    <div id="email-preferences" className="mt-6 scroll-mt-24">
      <label className="flex min-h-[44px] cursor-pointer items-start gap-3 rounded-lg border border-royal/12 bg-cream/50 px-3 py-3">
        <input
          type="checkbox"
          className="mt-1 h-5 w-5 shrink-0 rounded border-royal/35 accent-royal"
          checked={optOut}
          disabled={pending}
          onChange={(e) => {
            const next = e.target.checked;
            setOptOut(next);
            startTransition(async () => {
              const res = await updateProfileEmailMarketingOptOutAction(next);
              if (!res.ok) setOptOut(!next);
            });
          }}
        />
        <span>
          <span className="font-sans text-sm font-semibold text-royal">
            Opt out of marketing-style emails
          </span>
          <span className="mt-1 block font-sans text-xs leading-relaxed text-royal/65">
            When ticked, we won&apos;t send trip milestone reminder emails or
            similar promotional messages. Transactional mail (password resets,
            receipts) may still be sent.
          </span>
        </span>
      </label>
    </div>
  );
}
