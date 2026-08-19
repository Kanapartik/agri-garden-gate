/**
 * Server-only helpers for B2B — farmer practice training, input advisory and
 * soil care. Imported only from `practice.functions.ts` handler bodies.
 *
 * Reference/catalogue rows are readable by any authenticated user; anything
 * farmer-specific (progress, saved plans, parcels) is reached through RLS as
 * the calling user, so this file adds no privileged access of its own.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  sortLessons,
  stageRank,
  type Infestation,
  type InfestationKind,
  type InputProduct,
  type NutrientRecommendation,
  type SoilPractice,
  type Treatment,
} from "@/lib/atap/practice";
import { indexTranslations, localizedField, type Locale, type TranslationRow } from "@/lib/i18n";

export type AuthedClient = SupabaseClient<Database>;

/* ------------------------------------------------------------ modules */

export interface LessonView {
  id: string;
  lessonKey: string;
  title: string;
  body: string;
  doNotes: string[];
  dontNotes: string[];
  sortOrder: number;
}

export interface ModuleView {
  id: string;
  code: string;
  stage: string;
  title: string;
  summary: string;
  cropTags: string[];
  seasonCodes: string[];
  sourceAttribution: string | null;
  sortOrder: number;
  lessons: LessonView[];
}

export async function loadModules(
  supabase: AuthedClient,
  locale: Locale,
): Promise<ModuleView[]> {
  const [{ data: modules }, { data: lessons }, { data: translations }] = await Promise.all([
    supabase
      .from("practice_modules")
      .select(
        "id, code, stage, title, summary, crop_tags, season_codes, source_attribution, sort_order",
      )
      .eq("published", true),
    supabase
      .from("practice_lessons")
      .select("id, module_id, lesson_key, title, body, do_notes, dont_notes, sort_order"),
    supabase
      .from("content_translations")
      .select("entity, entity_id, locale, field, value")
      .eq("locale", locale),
  ]);

  const index = indexTranslations((translations ?? []) as unknown as TranslationRow[]);
  const lessonRows = (lessons ?? []) as unknown as Array<{
    id: string;
    module_id: string;
    lesson_key: string;
    title: string;
    body: string;
    do_notes: string[] | null;
    dont_notes: string[] | null;
    sort_order: number;
  }>;

  return ((modules ?? []) as unknown as Array<{
    id: string;
    code: string;
    stage: string;
    title: string;
    summary: string;
    crop_tags: string[] | null;
    season_codes: string[] | null;
    source_attribution: string | null;
    sort_order: number;
  }>)
    .map((m) => ({
      id: m.id,
      code: m.code,
      stage: m.stage,
      title: localizedField(index, "practice_module", m.id, "title", locale, m.title),
      summary: localizedField(index, "practice_module", m.id, "summary", locale, m.summary),
      cropTags: m.crop_tags ?? [],
      seasonCodes: m.season_codes ?? [],
      sourceAttribution: m.source_attribution,
      sortOrder: m.sort_order,
      lessons: sortLessons(
        lessonRows
          .filter((l) => l.module_id === m.id)
          .map((l) => ({
            id: l.id,
            lessonKey: l.lesson_key,
            title: localizedField(index, "practice_lesson", l.id, "title", locale, l.title),
            body: localizedField(index, "practice_lesson", l.id, "body", locale, l.body),
            doNotes: l.do_notes ?? [],
            dontNotes: l.dont_notes ?? [],
            sortOrder: l.sort_order,
          })),
      ),
    }))
    .sort((a, b) => {
      const s = stageRank(a.stage) - stageRank(b.stage);
      if (s !== 0) return s;
      return a.sortOrder === b.sortOrder ? a.title.localeCompare(b.title) : a.sortOrder - b.sortOrder;
    });
}

export async function loadProgress(
  supabase: AuthedClient,
  subjectUserId: string,
): Promise<Array<{ moduleId: string; lessonKey: string }>> {
  const { data } = await supabase
    .from("practice_progress")
    .select("module_id, lesson_key")
    .eq("subject_user_id", subjectUserId);
  return ((data ?? []) as unknown as Array<{ module_id: string; lesson_key: string }>).map((r) => ({
    moduleId: r.module_id,
    lessonKey: r.lesson_key,
  }));
}

/* ---------------------------------------------------------- catalogue */

export async function loadProducts(supabase: AuthedClient): Promise<InputProduct[]> {
  const { data } = await supabase
    .from("input_products")
    .select(
      "code, generic_name, kind, category, nutrient_or_active, unit, cost_min_minor, cost_max_minor, brand_names, preparation_notes",
    );
  return ((data ?? []) as unknown as Array<Record<string, unknown>>).map((r) => ({
    code: String(r["code"]),
    genericName: String(r["generic_name"]),
    kind: r["kind"] as InputProduct["kind"],
    category: r["category"] as InputProduct["category"],
    nutrientOrActive: String(r["nutrient_or_active"]),
    unit: String(r["unit"]),
    costMinMinor: Number(r["cost_min_minor"]),
    costMaxMinor: Number(r["cost_max_minor"]),
    currency: "INR" as const,
    brandNames: (r["brand_names"] as string[] | null) ?? [],
    preparationNotes: (r["preparation_notes"] as string | null) ?? null,
  }));
}

export async function loadRecommendations(
  supabase: AuthedClient,
): Promise<NutrientRecommendation[]> {
  const { data } = await supabase
    .from("nutrient_recommendations")
    .select("crop, growth_stage, soil_type, nutrient, product_code, dose_per_hectare, unit, notes");
  return ((data ?? []) as unknown as Array<Record<string, unknown>>).map((r) => ({
    crop: String(r["crop"]),
    growthStage: String(r["growth_stage"]),
    soilType: (r["soil_type"] as string | null) ?? null,
    nutrient: String(r["nutrient"]),
    productCode: String(r["product_code"]),
    dosePerHectare: Number(r["dose_per_hectare"]),
    unit: String(r["unit"]),
    notes: (r["notes"] as string | null) ?? null,
  }));
}

export async function loadInfestations(supabase: AuthedClient): Promise<Infestation[]> {
  const { data } = await supabase
    .from("infestation_types")
    .select("id, code, crop, kind, name, symptoms, severity");
  return ((data ?? []) as unknown as Array<Record<string, unknown>>).map((r) => ({
    id: String(r["id"]),
    code: String(r["code"]),
    crop: String(r["crop"]),
    kind: r["kind"] as InfestationKind,
    name: String(r["name"]),
    symptoms: (r["symptoms"] as string[] | null) ?? [],
    severity: r["severity"] as Infestation["severity"],
  }));
}

export async function loadTreatments(supabase: AuthedClient): Promise<Treatment[]> {
  const { data } = await supabase
    .from("infestation_treatments")
    .select(
      "infestation_id, product_code, dose_per_hectare, unit, safety_interval_days, reentry_note, is_organic",
    );
  return ((data ?? []) as unknown as Array<Record<string, unknown>>).map((r) => ({
    infestationId: String(r["infestation_id"]),
    productCode: String(r["product_code"]),
    dosePerHectare: Number(r["dose_per_hectare"]),
    unit: String(r["unit"]),
    safetyIntervalDays: Number(r["safety_interval_days"]),
    reentryNote: (r["reentry_note"] as string | null) ?? null,
    isOrganic: Boolean(r["is_organic"]),
  }));
}

export async function loadSoilPractices(
  supabase: AuthedClient,
  locale: Locale,
): Promise<SoilPractice[]> {
  const [{ data }, { data: translations }] = await Promise.all([
    supabase
      .from("soil_retention_practices")
      .select(
        "id, code, name, soil_types, body, effort, expected_benefit, cost_min_minor, cost_max_minor, sort_order",
      ),
    supabase
      .from("content_translations")
      .select("entity, entity_id, locale, field, value")
      .eq("locale", locale)
      .eq("entity", "soil_practice"),
  ]);
  const index = indexTranslations((translations ?? []) as unknown as TranslationRow[]);
  return ((data ?? []) as unknown as Array<Record<string, unknown>>).map((r) => {
    const id = String(r["id"]);
    return {
      id,
      code: String(r["code"]),
      name: localizedField(index, "soil_practice", id, "name", locale, String(r["name"])),
      soilTypes: (r["soil_types"] as string[] | null) ?? [],
      body: localizedField(index, "soil_practice", id, "body", locale, String(r["body"])),
      effort: r["effort"] as SoilPractice["effort"],
      expectedBenefit: String(r["expected_benefit"]),
      costMinMinor: Number(r["cost_min_minor"]),
      costMaxMinor: Number(r["cost_max_minor"]),
      sortOrder: Number(r["sort_order"]),
    };
  });
}

/* -------------------------------------------------------- marketplace */

export async function loadInputListings(supabase: AuthedClient) {
  const { data } = await supabase
    .from("marketplace_listings")
    .select("id, title, category, quality_score, status")
    .eq("status", "published")
    .limit(200);
  return ((data ?? []) as unknown as Array<Record<string, unknown>>).map((r) => ({
    id: String(r["id"]),
    title: String(r["title"]),
    category: (r["category"] as string | null) ?? null,
    sellerName: null,
    qualityScore: r["quality_score"] === null ? null : Number(r["quality_score"]),
  }));
}
