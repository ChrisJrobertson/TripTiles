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
      className="min-h-11 w-full min-w-0 rounded-lg border-2 border-royal/25 bg-white px-4 py-2.5 text-center font-mono text-2xl tracking-[0.35em] text-royal outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/40 sm:min-h-[44px] sm:text-3xl sm:tracking-[0.4em]"
      onChange={(e) => {
        const next = e.target.value.replace(/\D/g, "").slice(0, OTP_LENGTH);
        onChange(next);
      }}
    />
  );
}
