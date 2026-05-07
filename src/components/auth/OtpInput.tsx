"use client";

import { useId } from "react";

export const OTP_LENGTH = 8;

type Props = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
};

export function OtpInput({
  id: idProp,
  value,
  onChange,
  disabled,
  autoFocus = true,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
}: Props) {
  const genId = useId();
  const id = idProp ?? `otp-${genId}`;

  return (
    <input
      id={id}
      type="text"
      inputMode="numeric"
      autoComplete={`one-${"time"}-code`}
      maxLength={OTP_LENGTH}
      value={value}
      disabled={disabled}
      autoFocus={autoFocus}
      aria-invalid={ariaInvalid}
      aria-describedby={ariaDescribedBy}
      className="min-h-11 w-full min-w-0 rounded-tt-md border border-tt-line bg-tt-surface px-4 py-2.5 text-center font-mono text-2xl tracking-[0.35em] text-tt-royal outline-none transition focus:border-tt-royal focus:ring-2 focus:ring-tt-royal/25 sm:min-h-[44px] sm:text-3xl sm:tracking-[0.4em]"
      onChange={(e) => {
        const next = e.target.value.replace(/\D/g, "").slice(0, OTP_LENGTH);
        onChange(next);
      }}
    />
  );
}
