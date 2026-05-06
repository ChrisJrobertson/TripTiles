"use client";

import {
  inviteCollaboratorAction,
  listTripCollaboratorsAction,
  revokeInviteAction,
  type CollaboratorRole,
} from "@/actions/collaborators";
import { Button } from "@/components/ui/Button";
import { ModalShell } from "@/components/ui/ModalShell";
import { getTierConfig } from "@/lib/tiers";
import type { UserTier } from "@/lib/types";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Props = {
  tripId: string;
  userTier: UserTier;
};

export function FamilyInvitePanel({ tripId, userTier }: Props) {
  const canShare = getTierConfig(userTier).features.family_sharing;
  const [rows, setRows] = useState<
    Array<{
      id: string;
      invited_email: string;
      role: string;
      status: string;
      user_id: string | null;
    }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<CollaboratorRole>("editor");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const r = await listTripCollaboratorsAction(tripId);
    if (r.ok) setRows(r.rows);
    setLoading(false);
  }, [tripId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onInvite = async () => {
    if (!canShare) return;
    setBusy(true);
    setMsg(null);
    const r = await inviteCollaboratorAction({
      tripId,
      email,
      role,
    });
    setBusy(false);
    if (!r.ok) {
      if (r.error === "TIER_LIMIT") {
        setMsg("Family invites require a Family plan.");
      } else {
        setMsg(r.error);
      }
      return;
    }
    setEmail("");
    setModalOpen(false);
    void refresh();
  };

  const onRevoke = async (id: string) => {
    const r = await revokeInviteAction(id);
    if (r.ok) void refresh();
  };

  return (
    <div className="rounded-xl border border-royal/10 bg-white px-4 py-3 font-sans text-sm text-royal shadow-sm">
      <p className="font-sans text-xs font-semibold text-royal/70">
        Family members
      </p>
      {!canShare ? (
        <p className="mt-2 text-xs leading-relaxed text-royal/70">
          Invite partners and grandparents on{" "}
          <Link href="/pricing" className="font-semibold text-gold underline">
            Family plan
          </Link>
          .
        </p>
      ) : null}

      {loading ? (
        <p className="mt-2 text-xs text-royal/55">Loading…</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-cream/80 px-2 py-1.5 text-xs"
            >
              <span className="truncate">{row.invited_email}</span>
              <span className="text-royal/55">
                {row.role} · {row.status}
              </span>
              {row.status === "pending" || row.status === "accepted" ? (
                <button
                  type="button"
                  onClick={() => void onRevoke(row.id)}
                  className="text-red-600 hover:underline"
                >
                  Remove
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        disabled={!canShare}
        onClick={() => {
          setMsg(null);
          setModalOpen(true);
        }}
        className="mt-3 w-full rounded-lg border border-royal/15 bg-royal py-2 text-xs font-semibold text-cream transition hover:bg-royal/90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Invite family member
      </button>
      {msg ? <p className="mt-2 text-xs text-red-600">{msg}</p> : null}

      {modalOpen ? (
        <ModalShell
          zClassName="z-[125]"
          overlayClassName="bg-tt-royal/50 backdrop-blur-[1px]"
          maxWidthClass="max-w-md"
          panelClassName="p-6"
          role="dialog"
          aria-modal={true}
          aria-labelledby="family-invite-title"
          onClick={(e) => e.target === e.currentTarget && setModalOpen(false)}
        >
            <h2
              id="family-invite-title"
              className="font-heading text-lg font-semibold text-tt-royal"
            >
              Invite by email
            </h2>
            <label className="mt-4 block text-xs font-medium text-tt-royal/70">
              Email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-tt-md border border-tt-line bg-white px-3 py-2 font-sans text-sm text-tt-royal"
                placeholder="name@example.com"
              />
            </label>
            <label className="mt-3 block text-xs font-medium text-tt-royal/70">
              Role
              <select
                value={role}
                onChange={(e) =>
                  setRole(e.target.value as CollaboratorRole)
                }
                className="mt-1 w-full rounded-tt-md border border-tt-line bg-white px-3 py-2 font-sans text-sm text-tt-royal"
              >
                <option value="editor">Editor</option>
                <option value="viewer">Viewer</option>
              </select>
            </label>
            <div className="mt-6 flex justify-end gap-3 border-t border-tt-line-soft pt-4">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="accent"
                disabled={busy || !email.trim()}
                loading={busy}
                loadingLabel="Sending…"
                onClick={() => void onInvite()}
              >
                Send invite
              </Button>
            </div>
        </ModalShell>
      ) : null}
    </div>
  );
}
