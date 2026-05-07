"use client";

import { acceptInviteAction } from "@/actions/collaborators";
import { Button } from "@/components/ui/Button";
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
      <Button
        type="button"
        variant="primary"
        size="lg"
        className="min-w-[200px]"
        loading={busy}
        loadingLabel="Joining…"
        onClick={() => void onAccept()}
      >
        Accept invite
      </Button>
      {error ? (
        <p className="text-center font-sans text-sm text-red-600">{error}</p>
      ) : null}
    </div>
  );
}
