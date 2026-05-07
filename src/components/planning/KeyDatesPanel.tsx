"use client";

export type { PlannerKeyDateRow } from "@/lib/planner/key-dates";
export { buildPlannerKeyDateRowsSorted } from "@/lib/planner/key-dates";

import {
  addKeyDateAction,
  mergeSuggestedKeyDatesAction,
  removeKeyDateAction,
  updateKeyDateAction,
} from "@/actions/trip-key-dates";
import { CountdownChip } from "@/components/planning/CountdownChip";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionHeader } from "@/components/ui/SectionHeader";
import {
  applyKeyDatesToPrefs,
  getMergedKeyDatesSorted,
  isAutoManagedKeyDateId,
  tripHasApplicableSuggestedSeeds,
  type DraftKeyDate,
} from "@/lib/planner/key-dates";
import { showToast } from "@/lib/toast";
import type { KeyDate, KeyDateCategory, Trip } from "@/lib/types";
import { useCallback, useMemo, useState } from "react";

type Props = {
  trip: Trip;
  /** Human label for destination (e.g. region short_name) — empty trips use `"your destination"`. */
  regionLabel: string;
  /** From loaded regions catalogue; improves UK-domestic classification for suggested seeds. */
  regionCountryCode?: string | null;
  /** When set, successful writes merge into trip preferences locally (autos never persist here). */
  onTripPatch?: (patch: Partial<Trip>) => void;
  className?: string;
  /** When true, milestones are display-only — no toolbar, forms, merge, edit, or delete. */
  readOnly?: boolean;
  /**
   * Parent already provides the titled card/header (e.g. planner deck tile).
   * Skips wrapping `Card` and the internal `SectionHeader`; keeps Payments-style toolbar + CRUD body.
   */
  embedded?: boolean;
};

const CAT_OPTS: KeyDateCategory[] = ["booking", "admin", "travel", "other"];

function normalizeCategory(cat: string): DraftKeyDate["category"] {
  const c = cat.trim().toLowerCase();
  if (CAT_OPTS.includes(c as KeyDateCategory)) return c as KeyDateCategory;
  return "";
}

export function KeyDatesPanel({
  trip,
  regionLabel,
  regionCountryCode = null,
  onTripPatch,
  className = "",
  readOnly = false,
  embedded = false,
}: Props) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [mergeBusy, setMergeBusy] = useState(false);
  const [formIcon, setFormIcon] = useState("📌");
  const [formTitle, setFormTitle] = useState("");
  const [formDate, setFormDate] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formCat, setFormCat] = useState<string>("");

  const mergedRows = useMemo(
    () => getMergedKeyDatesSorted(trip),
    [trip],
  );

  const showSuggested = tripHasApplicableSuggestedSeeds(
    trip,
    regionCountryCode,
  );

  const applyPrefsRows = useCallback(
    (rows: KeyDate[]) => {
      if (!onTripPatch) return;
      const prefs = trip.preferences;
      const base =
        prefs && typeof prefs === "object" && !Array.isArray(prefs)
          ? { ...(prefs as Record<string, unknown>) }
          : {};
      onTripPatch({
        preferences: applyKeyDatesToPrefs(base, rows),
      });
    },
    [onTripPatch, trip.preferences],
  );

  const resetForm = () => {
    setFormIcon("📌");
    setFormTitle("");
    setFormDate("");
    setFormDesc("");
    setFormCat("");
  };

  const startAdd = () => {
    resetForm();
    setEditingId(null);
    setAdding(true);
    setDeleteConfirmId(null);
  };

  const startEdit = (k: KeyDate) => {
    if (isAutoManagedKeyDateId(k.id)) return;
    setAdding(false);
    setEditingId(k.id);
    setDeleteConfirmId(null);
    setFormIcon(k.icon);
    setFormTitle(k.title);
    setFormDate(k.date);
    setFormDesc(k.description ?? "");
    setFormCat(k.category ?? "");
  };

  const cancelForm = () => {
    setAdding(false);
    setEditingId(null);
    resetForm();
  };

  const formActive = adding || editingId !== null;

  const onSave = async () => {
    const draft: DraftKeyDate = {
      icon: formIcon,
      title: formTitle,
      date: formDate,
      description: formDesc.trim() || undefined,
      category: normalizeCategory(formCat),
    };
    setBusy(true);
    if (editingId) {
      const r = await updateKeyDateAction(trip.id, editingId, draft);
      setBusy(false);
      if (!r.ok) {
        showToast(r.error, { type: "error" });
        return;
      }
      applyPrefsRows(r.key_dates);
      showToast("Key date updated", {
        type: "success",
        debounceKey: "key-date-write",
        debounceMs: 500,
      });
      cancelForm();
      return;
    }
    const r = await addKeyDateAction(trip.id, draft);
    setBusy(false);
    if (!r.ok) {
      showToast(r.error, { type: "error" });
      return;
    }
    applyPrefsRows(r.key_dates);
    showToast("Key date added", {
      type: "success",
      debounceKey: "key-date-write",
      debounceMs: 500,
    });
    cancelForm();
  };

  const onConfirmDelete = async (id: string) => {
    setBusy(true);
    const r = await removeKeyDateAction(trip.id, id);
    setBusy(false);
    if (!r.ok) {
      showToast(r.error, { type: "error" });
      return;
    }
    applyPrefsRows(r.key_dates);
    showToast("Key date removed", {
      type: "success",
      debounceKey: "key-date-write",
      debounceMs: 500,
    });
    setDeleteConfirmId(null);
  };

  const onMergeSuggested = async () => {
    setMergeBusy(true);
    const r = await mergeSuggestedKeyDatesAction(trip.id);
    setMergeBusy(false);
    if (!r.ok) {
      showToast(r.error, { type: "error" });
      return;
    }
    applyPrefsRows(r.key_dates);
    showToast("Suggested milestones added", {
      type: "success",
      debounceKey: "key-date-merge",
      debounceMs: 600,
    });
  };

  const listBody = (
    <ul className={`space-y-3 ${readOnly ? className : ""}`.trim()}>
      {mergedRows.map((row) => {
        const isAuto = isAutoManagedKeyDateId(row.id);
        const isEditing = editingId === row.id;
        if (!readOnly && isEditing) return null;
        const delOpen = deleteConfirmId === row.id;
        return (
          <li
            key={`${row.id}-${row.date}`}
            className={`rounded-tt-lg border border-tt-line bg-tt-surface px-3 py-3 shadow-tt-sm sm:px-4 ${
              isAuto ? "border-l-4 border-l-tt-line/70" : ""
            }`}
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start gap-2">
                  <span className="text-lg leading-none" aria-hidden>
                    {row.icon}
                  </span>
                  <div className="min-w-0">
                    <p className="font-sans text-sm font-semibold text-tt-ink">
                      {row.title}
                      {isAuto ? (
                        <span className="ml-2 font-meta text-[10px] font-semibold uppercase tracking-wide text-tt-ink-soft">
                          From trip dates
                        </span>
                      ) : null}
                    </p>
                    {row.description ? (
                      <p className="mt-1 font-sans text-xs italic leading-snug text-tt-ink-soft">
                        {row.description}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
                <CountdownChip
                  targetDate={row.date}
                  label={`${row.title}: ${row.date}`}
                  treatPastAsMilestone
                />
                {!readOnly && onTripPatch && !isAuto ? (
                  <>
                    {!delOpen ? (
                      <>
                        <button
                          type="button"
                          onClick={() => startEdit(row)}
                          disabled={busy || formActive || mergeBusy}
                          className="min-h-[44px] min-w-[5rem] rounded-lg border border-royal/20 bg-cream px-3 py-2 text-sm font-semibold text-royal transition hover:bg-cream/80 disabled:opacity-50"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          disabled={busy || formActive || mergeBusy}
                          onClick={() => {
                            setDeleteConfirmId(row.id);
                            setAdding(false);
                            setEditingId(null);
                          }}
                          className="min-h-[44px] rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800 transition hover:bg-red-100 disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </>
                    ) : (
                      <span className="flex flex-wrap items-center gap-2 text-sm text-royal/80">
                        <span>Remove this milestone?</span>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void onConfirmDelete(row.id)}
                          className="min-h-[44px] rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white"
                        >
                          Yes, delete
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => setDeleteConfirmId(null)}
                          className="min-h-[44px] rounded-lg border border-royal/20 px-3 py-2 text-sm font-medium"
                        >
                          No
                        </button>
                      </span>
                    )}
                  </>
                ) : null}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );

  if (readOnly) {
    return listBody;
  }

  const toolbarBtns =
    formActive ? null : (
      <div className="flex flex-wrap gap-2 sm:justify-end">
        <Button type="button" onClick={startAdd}>
          Add key date
        </Button>
        {showSuggested ? (
          <Button
            type="button"
            variant="secondary"
            disabled={mergeBusy || busy}
            onClick={() => void onMergeSuggested()}
          >
            Add suggested defaults
          </Button>
        ) : null}
      </div>
    );

  const inner = (
    <div
      className={`space-y-6 font-sans text-tt-ink ${className}`.trim()}
    >
      {embedded ? (
        toolbarBtns ? (
          <div className="flex flex-wrap items-center justify-end gap-2">
            {toolbarBtns}
          </div>
        ) : null
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <SectionHeader
            title="Key dates & booking windows"
            subtitle={`Important calendar dates before you travel — customised for ${regionLabel}.`}
            icon="📅"
            className="min-w-0 flex-1"
          />
          {toolbarBtns}
        </div>
      )}

      {formActive ? (
        <Card variant="default" className="p-4">
          <p className="font-heading text-sm font-semibold text-tt-royal">
            {editingId ? "Edit key date" : "New key date"}
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm sm:col-span-1">
              <span className="font-medium text-tt-ink-muted">Icon</span>
              <input
                value={formIcon}
                onChange={(e) => setFormIcon(e.target.value)}
                maxLength={30}
                className="min-h-11 rounded-tt-md border border-tt-line bg-tt-surface px-3 py-2 text-tt-ink"
                placeholder="e.g. 🎟️"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm sm:col-span-1">
              <span className="font-medium text-tt-ink-muted">Date</span>
              <input
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                className="min-h-11 rounded-tt-md border border-tt-line bg-tt-surface px-3 py-2 text-tt-ink"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              <span className="font-medium text-tt-ink-muted">Title</span>
              <input
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                maxLength={200}
                className="min-h-11 rounded-tt-md border border-tt-line bg-tt-surface px-3 py-2 text-tt-ink"
                placeholder="e.g. Pay villa balance"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              <span className="font-medium text-tt-ink-muted">
                Notes (optional)
              </span>
              <textarea
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
                maxLength={300}
                rows={2}
                className="rounded-tt-md border border-tt-line bg-tt-surface px-3 py-2 text-sm text-tt-ink"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              <span className="font-medium text-tt-ink-muted">
                Category (optional)
              </span>
              <select
                value={formCat}
                onChange={(e) => setFormCat(e.target.value)}
                className="min-h-11 max-w-xs rounded-tt-md border border-tt-line bg-tt-surface px-3 py-2 text-tt-ink"
              >
                <option value="">— None —</option>
                <option value="booking">Booking</option>
                <option value="admin">Admin</option>
                <option value="travel">Travel</option>
                <option value="other">Other</option>
              </select>
            </label>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="accent"
              disabled={
                busy || !formTitle.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(formDate)
              }
              onClick={() => void onSave()}
            >
              Save
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={cancelForm}
            >
              Cancel
            </Button>
          </div>
        </Card>
      ) : null}

      {mergedRows.length === 0 && !formActive ? (
        <EmptyState
          icon="📅"
          title="No milestones yet"
          description={`Track booking windows for ${regionLabel}. Add reminders here or load suggested milestones for your region.`}
          action={
            <div className="flex flex-col items-center gap-2">
              <Button onClick={startAdd}>Add a key date →</Button>
              {showSuggested ? (
                <Button
                  variant="secondary"
                  disabled={mergeBusy || busy}
                  onClick={() => void onMergeSuggested()}
                >
                  Add suggested defaults
                </Button>
              ) : null}
            </div>
          }
        />
      ) : null}

      {mergedRows.length > 0 ? listBody : null}
    </div>
  );

  if (embedded) {
    return inner;
  }

  return (
    <Card
      as="section"
      variant="subtle"
      className={`p-4 backdrop-blur-md sm:p-5 ${className}`.trim()}
      aria-labelledby="key-dates-heading"
    >
      {inner}
    </Card>
  );
}
