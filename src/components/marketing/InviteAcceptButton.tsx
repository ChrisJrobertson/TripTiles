"use client";

import { acceptInviteAction } from "@/actions/collaborators";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  token: string;
  isAuthed: boolean;
};

export function InviteAcceptButton({ token, isAuthed }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onAccept = async () => {
    if (!isAuthed) {
      router.push(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);
      return;
    }
    setBusy(true);
    setError(null);
    const r = await acceptInviteAction(token);
    setBusy(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    router.replace("/planner");
    router.refresh();
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        onClick={() => void onAccept()}
        disabled={busy}
        className="inline-flex min-h-12 min-w-[200px] items-center justify-center rounded-lg bg-gold px-8 py-3 font-sans text-base font-bold text-royal shadow-sm transition hover:bg-gold/90 disabled:opacity-60"
      >
        {busy ? "Joining…" : "Accept invite"}
      </button>
      {error ? (
        <p className="text-center font-sans text-sm text-red-600">{error}</p>
      ) : null}
    </div>
  );
}
