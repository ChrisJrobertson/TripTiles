"use client";

import { updateDisplayNameAction } from "@/actions/account";
import { Card } from "@/components/ui/Card";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Button } from "@/components/ui/Button";
import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";

type Props = {
  email: string;
  displayName: string | null;
  createdAt: string | null;
};

export function SettingsProfileCard({
  email,
  displayName: initialName,
  createdAt,
}: Props) {
  const router = useRouter();
  const [name, setName] = useState(initialName ?? "");
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const saveName = useCallback(() => {
    setMsg(null);
    startTransition(async () => {
      const r = await updateDisplayNameAction({ displayName: name });
      if (!r.ok) {
        setMsg(r.error);
        return;
      }
      setDirty(false);
      setMsg("Saved.");
      router.refresh();
    });
  }, [name, router]);

  const created =
    createdAt &&
    new Date(createdAt).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

  return (
    <Card className="p-6">
      <SectionHeader compact title="Profile" />
      <div className="mt-4 space-y-4 font-sans text-sm">
        <label className="block text-tt-royal">
          Display name
          <input
            className="mt-1 w-full rounded-tt-md border border-tt-line bg-tt-surface px-3 py-2 shadow-tt-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tt-royal"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setDirty(true);
            }}
          />
        </label>
        <p className="text-tt-royal/70">
          <span className="font-medium text-tt-royal">Email</span>{" "}
          <span className="select-all">{email}</span> (read-only)
        </p>
        {created ? (
          <p className="text-tt-royal/70">
            <span className="font-medium text-tt-royal">Member since</span>{" "}
            {created}
          </p>
        ) : null}
        <p className="font-sans text-xs text-tt-royal/55">
          Plan and receipts live under{" "}
          <span className="font-medium text-tt-royal">Subscription</span>.
        </p>
        {dirty ? (
          <Button
            type="button"
            disabled={pending}
            variant="accent"
            onClick={() => void saveName()}
          >
            Save changes
          </Button>
        ) : null}
        {msg ? <p className="text-sm text-tt-royal/80">{msg}</p> : null}
      </div>
    </Card>
  );
}
