/**
 * Resolves Supabase URL and browser-safe key from env.
 * Supports legacy anon key and newer publishable key names.
 */
export function getSupabaseUrl(): string | undefined {
  const u = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  return u || undefined;
}

export function getSupabaseAnonKey(): string | undefined {
  const k =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  return k || undefined;
}
