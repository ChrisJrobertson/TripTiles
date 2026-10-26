/** Case-insensitive match used before an account deletion proceeds. */
export function accountDeletionEmailMatches(
  accountEmail: string,
  confirmation: string,
): boolean {
  const expected = accountEmail.trim().toLowerCase();
  const provided = confirmation.trim().toLowerCase();
  return expected.length > 0 && expected === provided;
}
