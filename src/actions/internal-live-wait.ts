"use server";

import { isInternalStaffEmail } from "@/lib/auth/internal-staff";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getCurrentUser } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type UpsertLiveWaitMappingInput = {
  provider: string;
  externalParkId: string;
  externalAttractionId?: string | null;
  parkId: string;
  attractionId?: string | null;
  externalName?: string | null;
  mappingConfidence?: number | null;
};

type ActionResult = {
  ok: boolean;
  message: string;
};

function cleanText(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

function cleanOptionalText(value: string | null | undefined): string | null {
  const clean = cleanText(value);
  return clean ? clean : null;
}

async function assertInternalStaff(): Promise<ActionResult | null> {
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, message: "Sign in is required." };
  }
  if (!isInternalStaffEmail(user.email)) {
    return { ok: false, message: "Internal staff access is required." };
  }
  return null;
}

export async function upsertLiveWaitProviderMappingAction(
  input: UpsertLiveWaitMappingInput,
): Promise<ActionResult> {
  const authError = await assertInternalStaff();
  if (authError) return authError;

  const provider = cleanText(input.provider);
  const externalParkId = cleanText(input.externalParkId);
  const externalAttractionId = cleanText(input.externalAttractionId);
  const parkId = cleanText(input.parkId);
  const attractionId = cleanOptionalText(input.attractionId);
  const externalName = cleanOptionalText(input.externalName);
  const confidence =
    input.mappingConfidence == null ? null : Number(input.mappingConfidence);

  if (!provider) return { ok: false, message: "Provider is required." };
  if (!externalParkId) {
    return { ok: false, message: "External park id is required." };
  }
  if (!parkId) return { ok: false, message: "TripTiles park is required." };
  if (confidence != null && (!Number.isFinite(confidence) || confidence < 0 || confidence > 1)) {
    return { ok: false, message: "Confidence must be between 0 and 1." };
  }

  const supabase = createServiceRoleClient();

  const { data: park, error: parkError } = await supabase
    .from("parks")
    .select("id")
    .eq("id", parkId)
    .maybeSingle();
  if (parkError) return { ok: false, message: parkError.message };
  if (!park) return { ok: false, message: "TripTiles park was not found." };

  if (attractionId) {
    if (!externalAttractionId) {
      return {
        ok: false,
        message: "External attraction id is required for ride mappings.",
      };
    }

    const { data: attraction, error: attractionError } = await supabase
      .from("attractions")
      .select("id, park_id")
      .eq("id", attractionId)
      .maybeSingle();
    if (attractionError) return { ok: false, message: attractionError.message };
    if (!attraction) {
      return { ok: false, message: "TripTiles attraction was not found." };
    }
    if ((attraction as { park_id?: string | null }).park_id !== parkId) {
      return {
        ok: false,
        message: "Selected attraction does not belong to the selected park.",
      };
    }
  }

  const { error } = await supabase.from("live_wait_provider_mappings").upsert(
    {
      provider,
      external_park_id: externalParkId,
      external_attraction_id: externalAttractionId,
      park_id: parkId,
      attraction_id: attractionId,
      external_name: externalName,
      mapping_confidence: confidence,
    },
    { onConflict: "provider,external_park_id,external_attraction_id" },
  );

  if (error) return { ok: false, message: error.message };

  revalidatePath("/internal/live-wait");
  return {
    ok: true,
    message: attractionId
      ? "Ride mapping saved. The next live-wait ingest will resolve this row."
      : "Park-level mapping saved. Suggestions can now use this park by default.",
  };
}
