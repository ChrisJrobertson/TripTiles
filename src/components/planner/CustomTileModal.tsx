"use client";

import {
  createCustomTileAction,
  updateCustomTileAction,
  type CreateCustomTileInput,
} from "@/actions/custom-tiles";
import { GROUP_META } from "@/lib/group-meta";
import type { CustomTile } from "@/lib/types";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

const EMOJI_OPTIONS = [
  "🍕",
  "🍔",
  "🌮",
  "🍜",
  "🍣",
  "🍦",
  "🎂",
  "🏰",
  "🎢",
  "🎡",
  "🏖️",
  "🏊",
  "🚣",
  "🎣",
  "🚴",
  "🏛️",
  "⛪",
  "🎭",
  "🎪",
  "🎨",
];

const MODAL_CATEGORY_KEYS = [
  "travel",
  "disney",
  "attractions",
  "sights",
  "dining",
  "activities",
  "excursions",
  "universal",
] as const;

const SWATCHES: { bg: string; label: string }[] = [
  { bg: "#0B1E5C", label: "Royal" },
  { bg: "#C9A961", label: "Gold" },
  { bg: "#FAF8F3", label: "Cream" },
  { bg: "#E63946", label: "Rose" },
  { bg: "#2D5016", label: "Forest" },
  { bg: "#006B9F", label: "Ocean" },
  { bg: "#FFA500", label: "Sunset" },
  { bg: "#7B2D8E", label: "Plum" },
  { bg: "#00A8B5", label: "Teal" },
  { bg: "#1A1A2E", label: "Charcoal" },
  { bg: "#FF69B4", label: "Blush" },
  { bg: "#556B2F", label: "Sage" },
];

function luminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function fgForBg(bg: string): string {
  return luminance(bg) > 0.55 ? "#0B1E5C" : "#FAF8F3";
}

type Props = {
  isOpen: boolean;
  onClose: () => void;
  regionId: string;
  /** Pre-select category when creating (palette group key). */
  initialCategory?: string;
  editingTile?: CustomTile | null;
  /** Remaining creates allowed (0 blocks Add). Ignored when editing. */
  remainingCreates: number;
  /** Show "n / 5 tiles used" for free tier. */
  showFreeTierTileCounter: boolean;
  /** Current total custom tiles (for counter). */
  tilesUsedCount: number;
  freeTierCap?: number;
  onSuccess: (tile: CustomTile, newAchievements: string[]) => void;
};

export function CustomTileModal({
  isOpen,
  onClose,
  regionId,
  initialCategory = "dining",
  editingTile,
  remainingCreates,
  showFreeTierTileCounter,
  tilesUsedCount,
  freeTierCap = 5,
  onSuccess,
}: Props) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [icon, setIcon] = useState<string | null>(null);
  const [parkGroup, setParkGroup] = useState<string>("dining");
  const [bg, setBg] = useState("#0B1E5C");
  const [fg, setFg] = useState("#C9A961");
  const [saveLibrary, setSaveLibrary] = useState(false);
  const [notes, setNotes] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [tierError, setTierError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setFieldError(null);
    setTierError(null);
    if (editingTile) {
      setParkGroup(editingTile.park_group);
      setName(editingTile.name);
      setIcon(editingTile.icon);
      setBg(editingTile.bg_colour);
      setFg(editingTile.fg_colour);
      setSaveLibrary(editingTile.save_to_library);
      setNotes(editingTile.notes ?? "");
    } else {
      const defaultBg = "#0B1E5C";
      setName("");
      setIcon(null);
      setParkGroup(initialCategory);
      setBg(defaultBg);
      setFg(fgForBg(defaultBg));
      setSaveLibrary(false);
      setNotes("");
    }
  }, [isOpen, editingTile, initialCategory]);

  function pickSwatch(hex: string) {
    setBg(hex);
    setFg(fgForBg(hex));
  }

  if (!isOpen) return null;

  const title = editingTile ? "Edit tile" : "Add a custom tile";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFieldError(null);
    setTierError(null);
    if (submitting) return;

    const region_ids = saveLibrary ? [] : [regionId];

    setSubmitting(true);
    try {
      if (editingTile) {
        const res = await updateCustomTileAction(editingTile.id, {
          name,
          park_group: parkGroup,
          bg_colour: bg,
          fg_colour: fg,
          region_ids,
          save_to_library: saveLibrary,
          icon,
          notes: notes.trim() || null,
        });
        if (!res.ok) {
          if (res.error === "NOT_AUTHED") {
            router.push("/login?next=/planner");
            return;
          }
          setFieldError(res.message);
          return;
        }
        onSuccess(res.tile, []);
        onClose();
        return;
      }

      const payload: CreateCustomTileInput = {
        name,
        park_group: parkGroup,
        bg_colour: bg,
        fg_colour: fg,
        region_ids,
        save_to_library: saveLibrary,
        icon,
        notes: notes.trim() || null,
        address: null,
        url: null,
      };

      const res = await createCustomTileAction(payload);
      if (!res.ok) {
        if (res.error === "NOT_AUTHED") {
          router.push("/login?next=/planner");
          return;
        }
        if (res.error === "TIER_LIMIT") {
          setTierError(
            "You've used all 5 custom tiles on the free plan. Upgrade to Pro for unlimited custom tiles.",
          );
          return;
        }
        if (res.error === "VALIDATION") {
          setFieldError(res.message);
          return;
        }
        setFieldError("Something went wrong — try again.");
        return;
      }
      onSuccess(res.tile, res.newAchievements);
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-royal/40 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="custom-tile-title"
    >
      <div className="max-h-[min(90vh,40rem)] w-full max-w-lg overflow-y-auto rounded-2xl border border-royal/15 bg-cream p-6 shadow-xl">
        <h2
          id="custom-tile-title"
          className="font-serif text-xl font-semibold text-royal"
        >
          {title}
        </h2>
        <p className="mt-2 font-sans text-sm leading-relaxed text-royal/75">
          Add a place, activity, or attraction to your trip that isn&apos;t in our
          built-in list.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <div>
            <p className="mb-2 font-sans text-xs font-semibold uppercase tracking-wide text-royal/60">
              Icon (optional)
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setIcon(null)}
                className={`rounded-lg border-2 px-2 py-1.5 text-xs font-medium ${
                  icon === null
                    ? "border-gold bg-white"
                    : "border-royal/20 bg-white/80"
                }`}
              >
                None
              </button>
              {EMOJI_OPTIONS.map((em) => (
                <button
                  key={em}
                  type="button"
                  onClick={() => setIcon(em)}
                  className={`rounded-lg border-2 px-2 py-1.5 text-lg leading-none ${
                    icon === em
                      ? "border-gold bg-white"
                      : "border-royal/20 bg-white/80"
                  }`}
                  aria-label={`Icon ${em}`}
                >
                  {em}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="font-sans text-sm font-medium text-royal">
              Name <span className="text-red-600">*</span>
            </label>
            <input
              required
              maxLength={40}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Nonna's Pizza Napoli"
              className="mt-1 w-full rounded-lg border border-royal/25 bg-white px-3 py-2.5 text-base text-royal"
            />
            <p className="mt-1 text-right font-sans text-xs text-royal/50">
              {name.length}/40
            </p>
          </div>

          <div>
            <p className="mb-2 font-sans text-sm font-medium text-royal">
              Category <span className="text-red-600">*</span>
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {MODAL_CATEGORY_KEYS.map((key) => {
                const meta = GROUP_META[key];
                const selected = parkGroup === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setParkGroup(key)}
                    className={`rounded-lg border-2 px-2 py-2 text-center font-sans text-xs font-medium transition ${
                      selected
                        ? "border-gold bg-gold/25 text-royal"
                        : "border-royal/20 bg-white text-royal hover:border-royal/40"
                    }`}
                  >
                    {meta?.label ?? key}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="mb-2 font-sans text-sm font-medium text-royal">
              Colour <span className="text-red-600">*</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {SWATCHES.map((s) => (
                <button
                  key={s.bg}
                  type="button"
                  title={s.label}
                  onClick={() => pickSwatch(s.bg)}
                  className={`h-9 w-9 rounded-full border-2 ${
                    bg === s.bg ? "border-gold ring-2 ring-gold/50" : "border-white"
                  }`}
                  style={{ backgroundColor: s.bg }}
                  aria-label={s.label}
                />
              ))}
            </div>
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-royal/15 bg-white/60 px-3 py-2">
            <input
              type="checkbox"
              checked={saveLibrary}
              onChange={(e) => setSaveLibrary(e.target.checked)}
              className="mt-1"
            />
            <span>
              <span className="font-sans text-sm font-semibold text-royal">
                Save to library
              </span>
              <span className="mt-0.5 block font-sans text-xs text-royal/65">
                Pin this tile so it appears on every trip you plan
              </span>
            </span>
          </label>

          <div>
            <label className="font-sans text-sm font-medium text-royal">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              maxLength={200}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Best margherita in Naples — Aunt Carla says"
              rows={3}
              className="mt-1 w-full rounded-lg border border-royal/25 bg-white px-3 py-2 font-sans text-sm text-royal"
            />
            <p className="mt-1 text-right font-sans text-xs text-royal/50">
              {notes.length}/200
            </p>
          </div>

          {tierError ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 font-sans text-sm text-amber-950">
              <p>{tierError}</p>
              <Link
                href="/pricing"
                className="mt-2 inline-block rounded-lg bg-royal px-4 py-2 text-sm font-semibold text-cream"
              >
                Upgrade to Pro
              </Link>
            </div>
          ) : null}

          {fieldError ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 font-sans text-sm text-red-800">
              {fieldError}
            </p>
          ) : null}

          {showFreeTierTileCounter ? (
            <p className="font-sans text-sm text-royal/80">
              {tilesUsedCount} / {freeTierCap} tiles used
            </p>
          ) : null}

          <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-royal/25 bg-white px-4 py-2.5 font-sans text-sm font-medium text-royal"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || (!editingTile && remainingCreates <= 0)}
              className="rounded-lg bg-gradient-to-r from-gold to-[#b8924f] px-5 py-2.5 font-serif text-sm font-semibold text-royal shadow disabled:opacity-50"
            >
              {submitting
                ? "Saving…"
                : editingTile
                  ? "Save changes"
                  : "Add tile"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
