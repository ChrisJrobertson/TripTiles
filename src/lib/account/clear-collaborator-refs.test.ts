/**
 * Run: npx tsx src/lib/account/clear-collaborator-refs.test.ts
 */
import assert from "node:assert/strict";
import {
  clearCollaboratorRefsForAccount,
  type CollaboratorCleanupClient,
} from "./clear-collaborator-refs";

function memoryClient(options?: {
  failOn?: "invited_by" | "user_id";
}): {
  client: CollaboratorCleanupClient;
  deleted: Array<{ column: string; value: string }>;
} {
  const deleted: Array<{ column: string; value: string }> = [];
  const failOn = options?.failOn;
  const client: CollaboratorCleanupClient = {
    from(relation: string) {
      assert.equal(relation, "trip_collaborators");
      return {
        delete() {
          return {
            async eq(column, value) {
              if (failOn === column) {
                return { error: { message: `blocked on ${column}` } };
              }
              deleted.push({ column, value });
              return { error: null };
            },
          };
        },
      };
    },
  };
  return { client, deleted };
}

async function run() {
  const empty = await clearCollaboratorRefsForAccount(memoryClient().client, "  ");
  assert.equal(empty.ok, false);

  const { client, deleted } = memoryClient();
  const ok = await clearCollaboratorRefsForAccount(client, " user-a ");
  assert.deepEqual(ok, { ok: true });
  assert.deepEqual(deleted, [
    { column: "invited_by", value: "user-a" },
    { column: "user_id", value: "user-a" },
  ]);

  const invitedFail = await clearCollaboratorRefsForAccount(
    memoryClient({ failOn: "invited_by" }).client,
    "user-a",
  );
  assert.equal(invitedFail.ok, false);
  if (!invitedFail.ok) assert.match(invitedFail.error, /invited_by/);

  const { client: memberClient, deleted: memberDeleted } = memoryClient({
    failOn: "user_id",
  });
  const memberFail = await clearCollaboratorRefsForAccount(memberClient, "user-b");
  assert.equal(memberFail.ok, false);
  assert.deepEqual(memberDeleted, [{ column: "invited_by", value: "user-b" }]);

  console.log("clear-collaborator-refs.test.ts: ok");
}

void run();
