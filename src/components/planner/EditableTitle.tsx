"use client";

import { useCallback, useEffect, useRef, type CSSProperties } from "react";

type Props = {
  value: string;
  onSave: (newValue: string) => void;
  className?: string;
  style?: CSSProperties;
};

export function EditableTitle({ value, onSave, className = "", style }: Props) {
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
      style={style}
      className={`cursor-text border-b border-dashed border-transparent outline-none hover:border-current/40 focus:border-current focus:font-semibold ${className}`}
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
