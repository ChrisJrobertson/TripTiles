"use client";

import { useCallback, useId, useState } from "react";

const inputClass =
  "min-h-12 w-full rounded-lg border-2 border-royal/25 bg-white px-4 pr-12 text-base text-royal outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/40";

type Props = {
  id?: string;
  label: string;
  helperText?: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  required?: boolean;
  minLength?: number;
  /** When true, show caps-lock hint when Caps Lock is on. */
  showCapsHint?: boolean;
};

export function PasswordField({
  id: idProp,
  label,
  helperText,
  value,
  onChange,
  autoComplete,
  required,
  minLength,
  showCapsHint = true,
}: Props) {
  const genId = useId();
  const id = idProp ?? `${genId}-pw`;
  const [visible, setVisible] = useState(false);
  const [capsOn, setCapsOn] = useState(false);
  const descId = `${id}-desc`;

  const onKey = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!showCapsHint) return;
      try {
        setCapsOn(e.getModifierState("CapsLock"));
      } catch {
        setCapsOn(false);
      }
    },
    [showCapsHint],
  );

  const showDesc = Boolean(helperText) || (showCapsHint && capsOn);

  return (
    <div>
      <label
        htmlFor={id}
        className="mb-2 block font-serif text-sm font-medium text-royal"
      >
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name="password"
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          required={required}
          minLength={minLength}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKey}
          className={inputClass}
          aria-describedby={showDesc ? descId : undefined}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setVisible((v) => !v)}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-1 font-sans text-xs font-medium text-royal/60 hover:bg-royal/5 hover:text-royal"
          aria-label={visible ? "Hide password" : "Show password"}
        >
          {visible ? "Hide" : "Show"}
        </button>
      </div>
      {showDesc ? (
        <div id={descId} className="mt-1.5 space-y-1">
          {helperText ? (
            <p className="font-sans text-xs text-royal/55">{helperText}</p>
          ) : null}
          {showCapsHint && capsOn ? (
            <p
              className="font-sans text-xs font-medium text-amber-800"
              role="status"
            >
              Caps lock is on
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
