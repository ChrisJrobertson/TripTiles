function emailInitialLetter(email: string): string {
  const m = email.trim();
  if (!m) return "?";
  return m[0]!.toUpperCase();
}

export function UserAvatarInitial({
  email,
  className = "",
}: {
  email: string;
  className?: string;
}) {
  const letter = emailInitialLetter(email);
  return (
    <span
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#8b74ff] via-[#6c4cff] to-[#4f36b8] font-sans text-xs font-semibold uppercase text-white shadow-sm ring-2 ring-white sm:h-9 sm:w-9 sm:text-sm ${className}`.trim()}
      title={email}
      aria-hidden
    >
      {letter}
    </span>
  );
}
