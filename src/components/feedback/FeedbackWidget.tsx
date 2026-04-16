"use client";

import { submitFeedbackAction, type FeedbackCategory } from "@/actions/feedback";
import { useCallback, useState } from "react";

const CATEGORIES: { id: FeedbackCategory; label: string }[] = [
  { id: "bug", label: "Bug" },
  { id: "feature", label: "Feature request" },
  { id: "question", label: "Question" },
  { id: "compliment", label: "Compliment" },
  { id: "other", label: "Other" },
];

export function FeedbackWidget() {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<FeedbackCategory>("bug");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "err">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);

  const send = useCallback(async () => {
    setStatus("sending");
    setError(null);
    const r = await submitFeedbackAction({
      category,
      message,
      pageUrl: typeof window !== "undefined" ? window.location.href : null,
      userAgent:
        typeof navigator !== "undefined" ? navigator.userAgent : null,
    });
    if (!r.ok) {
      setError(r.error);
      setStatus("err");
      return;
    }
    setStatus("done");
    setMessage("");
  }, [category, message]);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setStatus("idle");
          setError(null);
        }}
        className="fixed bottom-5 right-5 z-[90] hidden h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-gold to-[#b8924f] text-2xl shadow-lg shadow-royal/20 transition hover:opacity-95 md:flex"
        aria-label="Feedback"
      >
        💬
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[95] flex items-end justify-end bg-royal/40 p-4 sm:items-center sm:justify-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="fb-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-royal/15 bg-cream p-6 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <h2
                id="fb-title"
                className="font-serif text-xl font-semibold text-royal"
              >
                Share your thoughts
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg px-2 py-1 font-sans text-sm text-royal/60 hover:bg-white/80"
              >
                Close
              </button>
            </div>

            {status === "done" ? (
              <p className="mt-6 font-sans text-sm text-royal/80">
                Thanks! We read every message.
              </p>
            ) : (
              <>
                <label className="mt-4 block font-sans text-sm font-medium text-royal">
                  Category
                  <select
                    className="mt-1 w-full rounded-lg border-2 border-royal/20 bg-white px-3 py-2 font-sans text-sm text-royal"
                    value={category}
                    onChange={(e) =>
                      setCategory(e.target.value as FeedbackCategory)
                    }
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="mt-4 block font-sans text-sm font-medium text-royal">
                  Message
                  <textarea
                    className="mt-1 min-h-[120px] w-full rounded-lg border-2 border-royal/20 bg-white px-3 py-2 font-sans text-sm text-royal"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    maxLength={5000}
                    placeholder="What happened? What would you like to see?"
                  />
                  <span className="mt-1 block text-xs text-royal/50">
                    {message.length} / 5000
                  </span>
                </label>

                {error ? (
                  <p className="mt-3 font-sans text-sm text-red-700">{error}</p>
                ) : null}

                <button
                  type="button"
                  disabled={status === "sending" || message.trim().length < 5}
                  onClick={() => void send()}
                  className="mt-5 w-full rounded-lg bg-royal py-3 font-serif text-sm font-semibold text-cream transition hover:bg-royal/90 disabled:opacity-50"
                >
                  {status === "sending" ? "Sending…" : "Send feedback"}
                </button>
              </>
            )}

            <p className="mt-4 text-center font-sans text-xs text-royal/45">
              Thanks for helping us improve TripTiles.
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}
