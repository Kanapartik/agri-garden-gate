/**
 * Season planning (B11) — server functions.
 *
 * Plans are farmer-owned advisory documents. They are stored in
 * `farmer_input_plans` against one of the farmer's own parcels, which keeps the
 * existing RLS ownership rules in force, and every write is audited.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PLANNING_DISCLAIMER, type SavedPlanSnapshot } from "@/lib/atap/seasonPlanning";

export interface SavedPlanRow {
  id: string;
  crop: string;
  growth_stage: string;
  area_hectares: number;
  snapshot: SavedPlanSnapshot;
  created_at: string;
  updated_at: string;
}

const ACRES_PER_HECTARE = 2.47105;

export const listSeasonPlans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SavedPlanRow[]> => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("farmer_input_plans")
      .select("id, crop, growth_stage, area_hectares, snapshot, created_at, updated_at")
      .eq("subject_user_id", userId)
      .eq("growth_stage", "season_plan")
      .order("created_at", { ascending: false })
      .limit(25);
    return (data ?? []) as SavedPlanRow[];
  });

export const saveSeasonPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      farmId: string;
      crop: string;
      seasonCode: string;
      cropYear: number;
      acres: number;
      snapshot: SavedPlanSnapshot;
    }) => {
      if (!input.farmId) throw new Error("Choose one of your parcels to save this plan against.");
      if (!input.crop) throw new Error("Choose a crop.");
      if (!(input.acres > 0)) throw new Error("Enter the acres you plan to sow.");
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Ownership check in the handler, not just RLS.
    const { data: parcel } = await supabase
      .from("farm_records")
      .select("id")
      .eq("id", data.farmId)
      .eq("farmer_user_id", userId)
      .maybeSingle();
    if (!parcel) throw new Error("That parcel is not yours.");

    const { data: inserted, error } = await supabase
      .from("farmer_input_plans")
      .insert({
        farm_id: data.farmId,
        subject_user_id: userId,
        created_by_user_id: userId,
        crop: data.crop,
        growth_stage: "season_plan",
        area_hectares: Math.round((data.acres / ACRES_PER_HECTARE) * 1000) / 1000,
        snapshot: {
          ...data.snapshot,
          season_code: data.seasonCode,
          crop_year: data.cropYear,
          disclaimer: PLANNING_DISCLAIMER,
          advisory_only: true,
        },
      } as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    const { writeAuditRow } = await import("@/lib/atap/onboarding.server");
    await writeAuditRow(supabase, {
      actor_user_id: userId,
      action: "farmer.season_plan.save",
      subject_type: "farmer_input_plans",
      subject_id: (inserted as { id: string }).id,
      decision: "allow",
      metadata: {
        crop: data.crop,
        season_code: data.seasonCode,
        crop_year: data.cropYear,
        acres: data.acres,
        advisory_only: true,
      },
    });

    return { ok: true, id: (inserted as { id: string }).id };
  });

export const deleteSeasonPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { planId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("farmer_input_plans")
      .delete()
      .eq("id", data.planId)
      .eq("subject_user_id", userId);
    if (error) throw new Error(error.message);

    const { writeAuditRow } = await import("@/lib/atap/onboarding.server");
    await writeAuditRow(supabase, {
      actor_user_id: userId,
      action: "farmer.season_plan.delete",
      subject_type: "farmer_input_plans",
      subject_id: data.planId,
      decision: "allow",
    });
    return { ok: true };
  });
