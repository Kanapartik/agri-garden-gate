import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { InputCategory, InfestationKind } from "@/lib/atap/practice";
import type { Locale } from "@/lib/i18n";

/* -------------------------------------------------------------- types */

export interface ParcelBrief {
  id: string;
  label: string;
  plotRef: string;
  primaryCrop: string | null;
  areaAcres: number | null;
  areaHectares: number;
  soilTypes: string[];
  soilBasis: "inferred_from_location" | "lab_tested";
}

export interface PracticeWorkspace {
  userId: string;
  locale: Locale;
  parcels: ParcelBrief[];
  modules: Array<{
    id: string;
    code: string;
    stage: string;
    stageLabel: string;
    title: string;
    summary: string;
    cropTags: string[];
    sourceAttribution: string | null;
    completed: number;
    total: number;
    complete: boolean;
    completedKeys: string[];
    lessons: Array<{
      id: string;
      lessonKey: string;
      title: string;
      body: string;
      doNotes: string[];
      dontNotes: string[];
    }>;
  }>;
}

/* ---------------------------------------------------------- workspace */

export const getPracticeWorkspace = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { locale?: string; subjectUserId?: string } | undefined) => input ?? {})
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { normalizeLocale } = await import("@/lib/i18n");
    const { loadModules, loadProgress } = await import("@/lib/atap/practice.server");
    const { moduleProgress, PRACTICE_STAGE_LABEL, isPracticeStage } = await import(
      "@/lib/atap/practice"
    );
    const { listParcels } = await import("@/lib/atap/intelligence.server");

    const locale = normalizeLocale(data.locale);
    // Assisted use is allowed only through RLS: a subject other than the caller
    // resolves to rows the caller may already read, nothing more.
    const subjectUserId = data.subjectUserId?.trim() || userId;

    const [modules, progress, parcels] = await Promise.all([
      loadModules(supabase, locale),
      loadProgress(supabase, subjectUserId),
      listParcels(supabase),
    ]);

    return {
      userId,
      locale,
      parcels: parcels.map((p) => {
        const acres = p.area_acres ?? null;
        return {
          id: p.id,
          label: p.label,
          plotRef: p.plot_ref,
          primaryCrop: p.primary_crop,
          areaAcres: acres,
          areaHectares: acres === null ? 1 : Math.round((acres / 2.47105) * 100) / 100,
          soilTypes: [],
          soilBasis: "inferred_from_location" as const,
        };
      }),
      modules: modules.map((m) => {
        const keys = progress.filter((p) => p.moduleId === m.id).map((p) => p.lessonKey);
        const prog = moduleProgress(m.lessons, keys);
        return {
          id: m.id,
          code: m.code,
          stage: m.stage,
          stageLabel: isPracticeStage(m.stage) ? PRACTICE_STAGE_LABEL[m.stage] : m.stage,
          title: m.title,
          summary: m.summary,
          cropTags: m.cropTags,
          sourceAttribution: m.sourceAttribution,
          completed: prog.completed,
          total: prog.total,
          complete: prog.complete,
          completedKeys: prog.completedKeys,
          lessons: m.lessons.map((l) => ({
            id: l.id,
            lessonKey: l.lessonKey,
            title: l.title,
            body: l.body,
            doNotes: l.doNotes,
            dontNotes: l.dontNotes,
          })),
        };
      }),
    } satisfies PracticeWorkspace;
  });

export const setLessonProgress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { moduleId: string; lessonKey: string; done: boolean }) => {
    if (!input?.moduleId || !input?.lessonKey) throw new Error("lesson_reference_required");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.done) {
      const { error } = await supabase.from("practice_progress").insert({
        subject_user_id: userId,
        module_id: data.moduleId,
        lesson_key: data.lessonKey,
      } as never);
      // A repeat tick is not an error; progress is idempotent.
      if (error && !error.message.includes("duplicate key")) throw new Error(error.message);
    } else {
      const { error } = await supabase
        .from("practice_progress")
        .delete()
        .eq("subject_user_id", userId)
        .eq("module_id", data.moduleId)
        .eq("lesson_key", data.lessonKey);
      if (error) throw new Error(error.message);
    }
    return { ok: true, done: data.done };
  });

/* ------------------------------------------------------ input advisor */

export const getInputAdvisor = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (
      input:
        | {
            locale?: string;
            crop?: string;
            growthStage?: string;
            mode?: InputCategory;
            areaHectares?: number;
            infestationQuery?: string;
            infestationKind?: InfestationKind;
            infestationId?: string;
          }
        | undefined,
    ) => input ?? {},
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { normalizeLocale } = await import("@/lib/i18n");
    const {
      loadProducts,
      loadRecommendations,
      loadInfestations,
      loadTreatments,
      loadInputListings,
    } = await import("@/lib/atap/practice.server");
    const { buildNutrientPlan, compareModes, matchInfestations, matchSellerListings, treatmentOptions } =
      await import("@/lib/atap/practice");

    const locale = normalizeLocale(data.locale);
    const mode: InputCategory = data.mode === "organic" ? "organic" : "conventional";
    const areaHectares =
      Number.isFinite(data.areaHectares) && (data.areaHectares as number) > 0
        ? (data.areaHectares as number)
        : 1;

    const [products, recommendations, infestations, treatments, listings] = await Promise.all([
      loadProducts(supabase),
      loadRecommendations(supabase),
      loadInfestations(supabase),
      loadTreatments(supabase),
      loadInputListings(supabase),
    ]);

    const crops = [...new Set(recommendations.map((r) => r.crop))].sort();
    const crop = data.crop && crops.includes(data.crop) ? data.crop : (crops[0] ?? "Paddy");
    const stages = [
      ...new Set(recommendations.filter((r) => r.crop === crop).map((r) => r.growthStage)),
    ];
    const growthStage =
      data.growthStage && stages.includes(data.growthStage) ? data.growthStage : (stages[0] ?? "basal");

    const planArgs = { crop, growthStage, areaHectares, recommendations, products };
    const plan = buildNutrientPlan({ ...planArgs, mode });
    const comparison = compareModes(
      buildNutrientPlan({ ...planArgs, mode: "conventional" }),
      buildNutrientPlan({ ...planArgs, mode: "organic" }),
    );

    const matches = matchInfestations(infestations, {
      crop,
      kind: data.infestationKind ?? null,
      query: data.infestationQuery ?? null,
    });
    const selected = matches.find((m) => m.id === data.infestationId) ?? matches[0] ?? null;
    const options = selected
      ? treatmentOptions({
          infestationId: selected.id,
          treatments,
          products,
          areaHectares,
          mode,
        })
      : [];

    return {
      locale,
      crop,
      crops,
      growthStage,
      stages,
      mode,
      areaHectares,
      plan: {
        ...plan,
        lines: plan.lines.map((l) => ({
          ...l,
          sellers: matchSellerListings(listings, l.product),
        })),
      },
      comparison,
      infestations: matches,
      selectedInfestationId: selected?.id ?? null,
      treatmentOptions: options.map((o) => ({
        ...o,
        sellers: matchSellerListings(listings, o.product),
      })),
    };
  });

export const saveInputPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      farmId: string;
      crop: string;
      growthStage: string;
      mode: InputCategory;
      areaHectares: number;
    }) => {
      if (!input?.farmId) throw new Error("farm_required");
      if (!(input.areaHectares > 0)) throw new Error("area_must_be_positive");
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { loadProducts, loadRecommendations } = await import("@/lib/atap/practice.server");
    const { buildNutrientPlan } = await import("@/lib/atap/practice");
    const { audit } = await import("@/lib/atap/admin.server");

    // The plan is bound to a parcel the caller may read; RLS decides that.
    const { data: farm, error: farmError } = await supabase
      .from("farm_records")
      .select("id, farmer_user_id")
      .eq("id", data.farmId)
      .maybeSingle();
    if (farmError) throw new Error(farmError.message);
    if (!farm) throw new Error("farm_not_visible");

    const [products, recommendations] = await Promise.all([
      loadProducts(supabase),
      loadRecommendations(supabase),
    ]);
    const plan = buildNutrientPlan({
      crop: data.crop,
      growthStage: data.growthStage,
      mode: data.mode,
      areaHectares: data.areaHectares,
      recommendations,
      products,
    });

    const subjectUserId = (farm as unknown as { farmer_user_id: string }).farmer_user_id;
    const { error } = await supabase.from("farmer_input_plans").insert({
      farm_id: data.farmId,
      subject_user_id: subjectUserId,
      created_by_user_id: userId,
      crop: data.crop,
      growth_stage: data.growthStage,
      mode: data.mode,
      area_hectares: data.areaHectares,
      snapshot: plan as unknown as Record<string, unknown>,
    } as never);
    if (error) throw new Error(error.message);

    await audit(supabase, {
      actor_user_id: userId,
      action: "farmer.input_plan.saved",
      subject_type: "farm_record",
      subject_id: data.farmId,
      decision: "allow",
      metadata: {
        crop: data.crop,
        growth_stage: data.growthStage,
        mode: data.mode,
        assisted: subjectUserId !== userId,
      },
    });

    return { ok: true, lines: plan.lines.length };
  });

/* --------------------------------------------------------- soil care */

export const getSoilCare = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { locale?: string; farmId?: string } | undefined) => input ?? {})
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { normalizeLocale } = await import("@/lib/i18n");
    const { loadSoilPractices } = await import("@/lib/atap/practice.server");
    const { buildSoilCarePlan } = await import("@/lib/atap/practice");
    const { listParcels, resolveLocation, readSoil } = await import(
      "@/lib/atap/intelligence.server"
    );

    const locale = normalizeLocale(data.locale);
    const parcels = await listParcels(supabase);
    const parcel = parcels.find((p) => p.id === data.farmId) ?? parcels[0] ?? null;
    const practices = await loadSoilPractices(supabase, locale);

    if (!parcel) {
      return {
        locale,
        farmId: null,
        parcels: parcels.map((p) => ({ id: p.id, label: p.label })),
        plan: buildSoilCarePlan({ soilTypes: [], basis: "inferred_from_location", practices }),
      };
    }

    const location = await resolveLocation(supabase, parcel);
    const soil = await readSoil(parcel, location.districtName);

    return {
      locale,
      farmId: parcel.id,
      parcels: parcels.map((p) => ({ id: p.id, label: p.label })),
      plan: buildSoilCarePlan({
        soilTypes: soil.soilTypes,
        basis: soil.basis === "lab_tested" ? "lab_tested" : "inferred_from_location",
        practices,
      }),
    };
  });
