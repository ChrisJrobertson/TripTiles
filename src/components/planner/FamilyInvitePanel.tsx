"use client";

import {
  inviteCollaboratorAction,
  listTripCollaboratorsAction,
  revokeInviteAction,
  type CollaboratorRole,
} from "@/actions/collaborators";
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
          setMsg("Family invites require the Family plan.");
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
            Family
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
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-royal/40 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl border border-royal/15 bg-cream p-6 shadow-xl">
            <h2 className="font-serif text-lg font-semibold text-royal">
              Invite by email
            </h2>
            <label className="mt-4 block text-xs font-medium text-royal/70">
              Email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-lg border border-royal/20 bg-white px-3 py-2 font-sans text-sm text-royal"
                placeholder="name@example.com"
              />
            </label>
            <label className="mt-3 block text-xs font-medium text-royal/70">
              Role
              <select
                value={role}
                onChange={(e) =>
                  setRole(e.target.value as CollaboratorRole)
                }
                className="mt-1 w-full rounded-lg border border-royal/20 bg-white px-3 py-2 font-sans text-sm text-royal"
              >
                <option value="editor">Editor</option>
                <option value="viewer">Viewer</option>
              </select>
            </label>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-sm font-medium text-royal/75 hover:text-royal"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy || !email.trim()}
                onClick={() => void onInvite()}
                className="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-royal disabled:opacity-50"
              >
                {busy ? "Sending…" : "Send invite"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
