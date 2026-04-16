"use server";

import { sendTemplatedEmail } from "@/lib/email/send";
import { getCurrentTier } from "@/lib/entitlements";
import {
  isTierLoadFailure,
  tierLoadFailureUserMessage,
} from "@/lib/supabase/tier-load-error";
import { getPublicSiteUrl } from "@/lib/site";
import { getTierConfig } from "@/lib/tiers";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type CollaboratorRole = "editor" | "viewer";

export async function listTripCollaboratorsAction(tripId: string): Promise<
  | {
      ok: true;
      rows: Array<{
        id: string;
        invited_email: string;
        role: string;
        status: string;
        user_id: string | null;
      }>;
    }
  | { ok: false; error: string }
> {
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false, error: "Not signed in." };

    const supabase = await createClient();
    const { data: trip } = await supabase
      .from("trips")
      .select("id")
      .eq("id", tripId)
      .eq("owner_id", user.id)
      .maybeSingle();
    if (!trip) return { ok: false, error: "Trip not found." };

    const { data, error } = await supabase
      .from("trip_collaborators")
      .select("id, invited_email, role, status, user_id")
      .eq("trip_id", tripId)
      .order("created_at", { ascending: true });

    if (error) return { ok: false, error: error.message };
    return {
      ok: true,
      rows: (data ?? []) as Array<{
        id: string;
        invited_email: string;
        role: string;
        status: string;
        user_id: string | null;
      }>,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Unknown error",
    };
  }
}

export async function inviteCollaboratorAction(input: {
  tripId: string;
  email: string;
  role: CollaboratorRole;
}): Promise<{ ok: true; collaboratorId: string } | { ok: false; error: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false, error: "Not signed in." };

    const tier = await getCurrentTier();
    const cfg = getTierConfig(tier);
    if (!cfg.features.family_sharing) {
      return { ok: false, error: "TIER_LIMIT" };
    }

    const email = input.email.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      return { ok: false, error: "Invalid email." };
    }

    const supabase = await createClient();
    const { data: trip, error: tripErr } = await supabase
      .from("trips")
      .select("id, adventure_name")
      .eq("id", input.tripId)
      .eq("owner_id", user.id)
      .maybeSingle();

    if (tripErr || !trip) return { ok: false, error: "Trip not found." };

    const token = crypto.randomUUID();
    const { data: inserted, error: insErr } = await supabase
      .from("trip_collaborators")
      .insert({
        trip_id: input.tripId,
        user_id: null,
        invited_email: email,
        invited_by: user.id,
        role: input.role,
        status: "pending",
        invite_token: token,
        invite_sent_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (insErr || !inserted?.id) {
      return { ok: false, error: insErr?.message ?? "Insert failed." };
    }

    const site = (getPublicSiteUrl() || "https://www.triptiles.app").replace(
      /\/$/,
      "",
    );
    const inviteUrl = `${site}/invite/${token}`;

    const { data: inviter } = await supabase
      .from("profiles")
      .select("display_name, email")
      .eq("id", user.id)
      .maybeSingle();
    const inviterDisplayName =
      (inviter &&
        typeof inviter === "object" &&
        "display_name" in inviter &&
        typeof inviter.display_name === "string" &&
        inviter.display_name.trim()) ||
      (inviter &&
        typeof inviter === "object" &&
        "email" in inviter &&
        typeof inviter.email === "string" &&
        inviter.email.trim()) ||
      "A TripTiles member";

    const adventureName =
      trip && typeof trip === "object" && "adventure_name" in trip
        ? String(trip.adventure_name ?? "A trip")
        : "A trip";

    const sendResult = await sendTemplatedEmail({
      to: email,
      template: "invite",
      data: {
        inviterDisplayName,
        adventureName,
        inviteUrl,
      },
    });

    if (!sendResult.ok) {
      await supabase.from("trip_collaborators").delete().eq("id", inserted.id);
      return { ok: false, error: sendResult.error };
    }

    revalidatePath("/planner");
    return { ok: true, collaboratorId: String(inserted.id) };
  } catch (e) {
    if (isTierLoadFailure(e)) {
      return {
        ok: false,
        error: `${tierLoadFailureUserMessage()} Then try inviting again.`,
      };
    }
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Unknown error",
    };
  }
}

export async function acceptInviteAction(
  token: string,
): Promise<
  { ok: true; tripId: string; already: boolean } | { ok: false; error: string }
> {
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false, error: "Not signed in." };

    const supabase = await createClient();
    const { data: row, error: findErr } = await supabase
      .from("trip_collaborators")
      .select("id, trip_id, status")
      .eq("invite_token", token.trim())
      .maybeSingle();

    if (findErr || !row) return { ok: false, error: "INVALID_INVITE" };

    const r = row as { id: string; trip_id: string; status: string };
    if (r.status === "accepted") {
      return { ok: true, tripId: r.trip_id, already: true };
    }
    if (r.status !== "pending") {
      return { ok: false, error: "Invite is no longer valid." };
    }

    const { error } = await supabase
      .from("trip_collaborators")
      .update({
        user_id: user.id,
        status: "accepted",
        accepted_at: new Date().toISOString(),
      })
      .eq("id", r.id);

    if (error) return { ok: false, error: error.message };
    revalidatePath("/planner");
    return { ok: true, tripId: r.trip_id, already: false };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Unknown error",
    };
  }
}

export async function revokeInviteAction(
  collaboratorId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false, error: "Not signed in." };

    const supabase = await createClient();
    const { data: col, error: cErr } = await supabase
      .from("trip_collaborators")
      .select("trip_id")
      .eq("id", collaboratorId)
      .maybeSingle();

    if (cErr || !col || typeof col !== "object" || !("trip_id" in col)) {
      return { ok: false, error: "Not found." };
    }

    const { data: trip } = await supabase
      .from("trips")
      .select("owner_id")
      .eq("id", String(col.trip_id))
      .maybeSingle();

    if (!trip || (trip as { owner_id: string }).owner_id !== user.id) {
      return { ok: false, error: "Not allowed." };
    }

    const { error } = await supabase
      .from("trip_collaborators")
      .update({ status: "revoked" })
      .eq("id", collaboratorId);

    if (error) return { ok: false, error: error.message };
    revalidatePath("/planner");
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Unknown error",
    };
  }
}
