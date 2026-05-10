function userInitialLetter(displayName: string | null | undefined, email: string): string {
  const d = displayName?.trim();
  const src = d || email.trim();
  if (!src) return "?";
  return src[0]!.toUpperCase();
}

export function UserAvatarInitial({
  email,
  displayName,
  className = "",
}: {
  email: string;
  displayName?: string | null;
  className?: string;
}) {
  const letter = userInitialLetter(displayName, email);
  const d = displayName?.trim();
  const e = email.trim();
  const title = d && e ? `${d} (${e})` : d || e;
  return (
    <span
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#8b74ff] via-[#6c4cff] to-[#4f36b8] font-sans text-xs font-semibold uppercase text-white shadow-sm ring-2 ring-white sm:h-9 sm:w-9 sm:text-sm ${className}`.trim()}
      title={title}
      aria-hidden
    >
      {letter}
    </span>
  );
}
