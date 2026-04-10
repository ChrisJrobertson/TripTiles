"use client";

import { useCallback, useEffect, useRef } from "react";

type Props = {
  value: string;
  onSave: (newValue: string) => void;
  className?: string;
};

export function EditableTitle({ value, onSave, className = "" }: Props) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el.textContent !== value) el.textContent = value;
  }, [value]);

  const commit = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const next = el.textContent?.trim() ?? "";
    onSave(next.length ? next : value);
  }, [onSave, value]);

  return (
    <span
      ref={ref}
      role="textbox"
      tabIndex={0}
      title="Click to edit"
      contentEditable
      suppressContentEditableWarning
      className={`cursor-text border-b border-dashed border-transparent outline-none hover:border-royal/40 focus:border-royal focus:font-semibold ${className}`}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          (e.target as HTMLElement).blur();
        }
      }}
    >
      {value}
    </span>
  );
}
