"use client";

import { copyTextToClipboard } from "@/lib/clipboard-access";
import { useState } from "react";

export function CopyPlanLinkButton({ url }: { url: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="rounded-lg border border-royal/15 bg-white px-3 py-2 font-sans text-xs font-medium text-royal hover:border-gold/40"
      onClick={async () => {
        try {
          await copyTextToClipboard(url);
          setDone(true);
          setTimeout(() => setDone(false), 2000);
        } catch {
          setDone(false);
        }
      }}
    >
      {done ? "Copied" : "Copy link"}
    </button>
  );
}
