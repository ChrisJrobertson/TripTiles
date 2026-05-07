"use client";

import { AUTH_INPUT_CLASS, AUTH_LABEL_CLASS } from "@/components/auth/auth-field-classes";
import { useCallback, useId, useState } from "react";

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
      <label htmlFor={id} className={AUTH_LABEL_CLASS}>
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
          className={`${AUTH_INPUT_CLASS} pr-12`}
          aria-describedby={showDesc ? descId : undefined}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setVisible((v) => !v)}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-1 font-sans text-xs font-medium text-tt-ink-soft hover:bg-tt-royal-soft hover:text-tt-royal"
          aria-label={visible ? "Hide password" : "Show password"}
        >
          {visible ? "Hide" : "Show"}
        </button>
      </div>
      {showDesc ? (
        <div id={descId} className="mt-1.5 space-y-1">
          {helperText ? (
            <p className="font-sans text-xs text-tt-ink-muted">{helperText}</p>
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
