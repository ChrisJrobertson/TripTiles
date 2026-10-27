/**
 * `trip_collaborators.invited_by` references `profiles(id)` with no ON DELETE
 * action. Deleting an auth user therefore fails when that user has sent
 * invitations, including invitations on trips that would otherwise cascade.
 *
 * Clear those rows (and the departing user's membership rows) before
 * `auth.admin.deleteUser`. Do not delete other users' trips.
 */

export type CollaboratorCleanupClient = {
  from: (relation: string) => {
    delete: () => {
      eq: (
        column: string,
        value: string,
      ) => PromiseLike<{ error: { message: string } | null }>;
    };
  };
};

export async function clearCollaboratorRefsForAccount(
  admin: CollaboratorCleanupClient,
  userId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const id = userId.trim();
  if (!id) return { ok: false, error: "Missing user id" };

  const invited = await admin
    .from("trip_collaborators")
    .delete()
    .eq("invited_by", id);
  if (invited.error) return { ok: false, error: invited.error.message };

  const member = await admin
    .from("trip_collaborators")
    .delete()
    .eq("user_id", id);
  if (member.error) return { ok: false, error: member.error.message };

  return { ok: true };
}
