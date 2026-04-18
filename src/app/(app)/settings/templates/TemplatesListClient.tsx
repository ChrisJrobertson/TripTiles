"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

type Row = {
  id: string;
  name: string;
  is_seed: boolean;
  created_at: string;
};

export function TemplatesListClient({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [list, setList] = useState(rows);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const onDelete = useCallback(
    async (id: string) => {
      if (!confirm("Delete this template?")) return;
      setBusyId(id);
      try {
        const res = await fetch(`/api/day-templates/${id}`, {
          method: "DELETE",
        });
        if (!res.ok) return;
        setList((prev) => prev.filter((r) => r.id !== id));
        router.refresh();
      } finally {
        setBusyId(null);
      }
    },
    [router],
  );

  const startRename = (r: Row) => {
    if (r.is_seed) return;
    setRenamingId(r.id);
    setRenameDraft(r.name);
  };

  const cancelRename = () => {
    setRenamingId(null);
    setRenameDraft("");
  };

  const saveRename = useCallback(async () => {
    if (!renamingId) return;
    const name = renameDraft.trim();
    if (!name) return;
    setBusyId(renamingId);
    try {
      const res = await fetch(`/api/day-templates/${renamingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as { template?: { id: string; name: string } };
      if (data.template) {
        setList((prev) =>
          prev.map((r) =>
            r.id === renamingId ? { ...r, name: data.template!.name } : r,
          ),
        );
      }
      cancelRename();
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }, [renamingId, renameDraft, router]);

  if (list.length === 0) {
    return (
      <li className="px-4 py-6 font-sans text-sm text-royal/65">
        No templates yet — open a day in the planner and use Save as template.
      </li>
    );
  }

  return (
    <>
      {list.map((r) => (
        <li
          key={r.id}
          className="flex flex-col gap-2 px-4 py-4 sm:flex-row sm:items-start sm:justify-between"
        >
          <div className="min-w-0 flex-1">
            {renamingId === r.id ? (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  className="min-h-11 w-full max-w-md rounded-lg border border-royal/20 bg-white px-3 font-sans text-sm text-royal"
                  value={renameDraft}
                  onChange={(e) => setRenameDraft(e.target.value)}
                  maxLength={120}
                  aria-label="Template name"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="min-h-11 rounded-lg bg-royal px-3 font-sans text-xs font-semibold text-cream disabled:opacity-50"
                    disabled={busyId === r.id || !renameDraft.trim()}
                    onClick={() => void saveRename()}
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    className="min-h-11 rounded-lg border border-royal/20 bg-white px-3 font-sans text-xs font-medium text-royal"
                    onClick={cancelRename}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p className="font-sans text-sm font-semibold text-royal">
                  {r.name}
                </p>
                <p className="font-sans text-xs text-royal/55">
                  {new Date(r.created_at).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                  {r.is_seed ? (
                    <span className="ml-2 rounded bg-gold/25 px-2 py-0.5 text-[0.65rem] font-semibold uppercase text-royal">
                      Seed
                    </span>
                  ) : null}
                </p>
              </>
            )}
          </div>
          {renamingId !== r.id ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="min-h-11 rounded-lg border border-royal/20 bg-white px-3 font-sans text-xs font-semibold text-royal disabled:opacity-40"
                disabled={r.is_seed || busyId === r.id}
                onClick={() => startRename(r)}
              >
                Rename
              </button>
              <button
                type="button"
                className="min-h-11 rounded-lg border border-red-200 bg-white px-3 font-sans text-xs font-semibold text-red-800 disabled:opacity-40"
                disabled={r.is_seed || busyId === r.id}
                onClick={() => void onDelete(r.id)}
              >
                Delete
              </button>
            </div>
          ) : null}
        </li>
      ))}
    </>
  );
}
