"use server";

import { awardAchievementAction } from "@/actions/achievements";
import { currentUserCanCreateCustomTile } from "@/lib/entitlements";
import {
  isTierLoadFailure,
  tierLoadFailureUserMessage,
} from "@/lib/supabase/tier-load-error";
import { getUserCustomTiles } from "@/lib/db/custom-tiles";
import { GROUP_ORDER } from "@/lib/group-meta";
import { getParkIdFromSlotValue } from "@/lib/assignment-slots";
import type { Assignments, Assignment, CustomTile } from "@/lib/types";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

const HEX = /^#[0-9A-Fa-f]{6}$/;
const VALID_GROUPS = new Set<string>(GROUP_ORDER);

function newCustomTileId(): string {
  const raw = crypto.randomUUID().replace(/-/g, "");
  return `ct_${raw.slice(0, 12)}`;
}

function stripTileFromAssignments(
  assignments: Assignments,
  tileId: string,
): Assignments {
  const out: Assignments = {};
  for (const [day, slots] of Object.entries(assignments)) {
    if (!slots || typeof slots !== "object") continue;
    const next: Assignment = {};
    for (const slot of ["am", "pm", "lunch", "dinner"] as const) {
      const v = slots[slot];
      if (getParkIdFromSlotValue(v) === tileId) continue;
      if (v !== undefined) next[slot] = v;
    }
    if (Object.keys(next).length > 0) out[day] = next;
  }
  return out;
}

export type CreateCustomTileInput = {
  name: string;
  park_group: string;
  bg_colour: string;
  fg_colour: string;
  region_ids: string[];
  save_to_library?: boolean;
  icon?: string | null;
  notes?: string | null;
  address?: string | null;
  url?: string | null;
};

export type UpdateCustomTileInput = Partial<
  Pick<
    CreateCustomTileInput,
    | "name"
    | "park_group"
    | "bg_colour"
    | "fg_colour"
    | "region_ids"
    | "save_to_library"
    | "icon"
    | "notes"
    | "address"
    | "url"
  >
>;

function validateTileInput(
  input: CreateCustomTileInput | UpdateCustomTileInput,
  partial: boolean,
): { ok: true } | { ok: false; message: string } {
  if ("name" in input && input.name !== undefined) {
    const n = input.name.trim();
    if (n.length < 1 || n.length > 40) {
      return { ok: false, message: "Name must be 1–40 characters." };
    }
  } else if (!partial) {
    return { ok: false, message: "Name is required." };
  }

  if ("park_group" in input && input.park_group !== undefined) {
    if (!VALID_GROUPS.has(input.park_group)) {
      return { ok: false, message: "Invalid category." };
    }
  } else if (!partial) {
    return { ok: false, message: "Category is required." };
  }

  if ("bg_colour" in input && input.bg_colour !== undefined) {
    if (!HEX.test(input.bg_colour)) {
      return { ok: false, message: "Background colour must be a #RRGGBB hex value." };
    }
  } else if (!partial) {
    return { ok: false, message: "Colours are required." };
  }

  if ("fg_colour" in input && input.fg_colour !== undefined) {
    if (!HEX.test(input.fg_colour)) {
      return { ok: false, message: "Text colour must be a #RRGGBB hex value." };
    }
  } else if (!partial) {
    return { ok: false, message: "Colours are required." };
  }

  if ("notes" in input && input.notes != null && input.notes.length > 200) {
    return { ok: false, message: "Notes must be at most 200 characters." };
  }

  if (!partial && "save_to_library" in input && "region_ids" in input) {
    const st = (input as CreateCustomTileInput).save_to_library ?? false;
    const rids = (input as CreateCustomTileInput).region_ids;
    if (
      !st &&
      (!rids?.length || !rids.some((x) => String(x).trim().length > 0))
    ) {
      return {
        ok: false,
        message: "Pick a destination region or enable Save to library.",
      };
    }
  }

  return { ok: true };
}

export async function createCustomTileAction(
  input: CreateCustomTileInput,
): Promise<
  | { ok: true; tile: CustomTile; newAchievements: string[] }
  | {
      ok: false;
      error: "NOT_AUTHED" | "TIER_LIMIT" | "VALIDATION" | "DB_ERROR";
      message: string;
    }
> {
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, error: "NOT_AUTHED", message: "Not signed in." };
  }

  const v = validateTileInput(input, false);
  if (!v.ok) {
    return { ok: false, error: "VALIDATION", message: v.message };
  }

  let canCreateCustomTile: boolean;
  try {
    canCreateCustomTile = await currentUserCanCreateCustomTile();
  } catch (e) {
    if (isTierLoadFailure(e)) {
      return {
        ok: false,
        error: "DB_ERROR",
        message: tierLoadFailureUserMessage(),
      };
    }
    throw e;
  }

  if (!canCreateCustomTile) {
    return {
      ok: false,
      error: "TIER_LIMIT",
      message:
        "You've reached your custom tile limit for your plan. Upgrade for more.",
    };
  }

  const supabase = await createClient();
  const existing = await getUserCustomTiles(user.id);
  const countBefore = existing.length;

  const id = newCustomTileId();
  const now = new Date().toISOString();
  const row = {
    id,
    user_id: user.id,
    name: input.name.trim(),
    park_group: input.park_group,
    bg_colour: input.bg_colour,
    fg_colour: input.fg_colour,
    region_ids: input.region_ids,
    save_to_library: input.save_to_library ?? false,
    icon: input.icon ?? null,
    notes: input.notes?.trim() || null,
    address: input.address?.trim() || null,
    url: input.url?.trim() || null,
    trips_used_count: 0,
    created_at: now,
    updated_at: now,
  };

  const { data, error } = await supabase
    .from("custom_tiles")
    .insert(row)
    .select("*")
    .single();

  if (error) {
    return { ok: false, error: "DB_ERROR", message: error.message };
  }

  const tile = data as CustomTile;
  const total = countBefore + 1;
  const newAchievements: string[] = [];

  if (countBefore === 0) {
    const a = await awardAchievementAction("first_custom_tile");
    if (a.ok && a.justEarned) newAchievements.push("first_custom_tile");
  }
  if (total === 10) {
    const a = await awardAchievementAction("custom_tiles_10");
    if (a.ok && a.justEarned) newAchievements.push("custom_tiles_10");
  }
  if (total === 25) {
    const a = await awardAchievementAction("custom_tiles_25");
    if (a.ok && a.justEarned) newAchievements.push("custom_tiles_25");
  }

  revalidatePath("/planner");
  return { ok: true, tile, newAchievements };
}

export async function updateCustomTileAction(
  id: string,
  updates: UpdateCustomTileInput,
): Promise<
  | { ok: true; tile: CustomTile }
  | {
      ok: false;
      error: "NOT_AUTHED" | "VALIDATION" | "DB_ERROR";
      message: string;
    }
> {
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, error: "NOT_AUTHED", message: "Not signed in." };
  }

  const v = validateTileInput(updates, true);
  if (!v.ok) {
    return { ok: false, error: "VALIDATION", message: v.message };
  }

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (updates.name !== undefined) patch.name = updates.name.trim();
  if (updates.park_group !== undefined) patch.park_group = updates.park_group;
  if (updates.bg_colour !== undefined) patch.bg_colour = updates.bg_colour;
  if (updates.fg_colour !== undefined) patch.fg_colour = updates.fg_colour;
  if (updates.region_ids !== undefined) patch.region_ids = updates.region_ids;
  if (updates.save_to_library !== undefined) {
    patch.save_to_library = updates.save_to_library;
  }
  if (updates.icon !== undefined) patch.icon = updates.icon;
  if (updates.notes !== undefined) {
    patch.notes = updates.notes?.trim() || null;
  }
  if (updates.address !== undefined) {
    patch.address = updates.address?.trim() || null;
  }
  if (updates.url !== undefined) patch.url = updates.url?.trim() || null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("custom_tiles")
    .update(patch)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("*")
    .maybeSingle();

  if (error) {
    return { ok: false, error: "DB_ERROR", message: error.message };
  }
  if (!data) {
    return { ok: false, error: "DB_ERROR", message: "Tile not found." };
  }

  revalidatePath("/planner");
  return { ok: true, tile: data as CustomTile };
}

export async function deleteCustomTileAction(
  id: string,
): Promise<
  | { ok: true }
  | { ok: false; error: "NOT_AUTHED" | "DB_ERROR"; message: string }
> {
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, error: "NOT_AUTHED", message: "Not signed in." };
  }

  const supabase = await createClient();

  const { data: trips, error: tErr } = await supabase
    .from("trips")
    .select("id, assignments")
    .eq("owner_id", user.id);

  if (tErr) {
    return { ok: false, error: "DB_ERROR", message: tErr.message };
  }

  for (const t of trips ?? []) {
    const ass = (t.assignments ?? {}) as Assignments;
    const cleaned = stripTileFromAssignments(ass, id);
    if (JSON.stringify(cleaned) === JSON.stringify(ass)) continue;
    const { error: uErr } = await supabase
      .from("trips")
      .update({
        assignments: cleaned,
        updated_at: new Date().toISOString(),
      })
      .eq("id", t.id)
      .eq("owner_id", user.id);
    if (uErr) {
      return { ok: false, error: "DB_ERROR", message: uErr.message };
    }
  }

  const { error: dErr } = await supabase
    .from("custom_tiles")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (dErr) {
    return { ok: false, error: "DB_ERROR", message: dErr.message };
  }

  revalidatePath("/planner");
  return { ok: true };
}
