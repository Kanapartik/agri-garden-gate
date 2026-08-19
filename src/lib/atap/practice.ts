/**
 * B2B — Farmer practice training, input/protection advisory and soil care.
 *
 * Pure, IO-free domain logic. Two rules dominate this module:
 *  1. Every cost figure produced here is a DERIVED SCENARIO, built from visible
 *     assumptions via `labeledMoney`. It is never a market price.
 *  2. Nothing here decides a chemical application, a scheme, a loan or a claim.
 *     Doses and products are configuration rows, surfaced as advice, and every
 *     protection recommendation carries a human-confirmation requirement.
 */

import { labeledMoney, type LabeledMoney } from "@/lib/atap/intelligence";

/* -------------------------------------------------------------- stages */

export type PracticeStage =
  | "land_prep_sowing"
  | "crop_protection"
  | "harvest_cutting"
  | "post_harvest_preservation"
  | "value_creation";

export const PRACTICE_STAGE_ORDER: PracticeStage[] = [
  "land_prep_sowing",
  "crop_protection",
  "harvest_cutting",
  "post_harvest_preservation",
  "value_creation",
];

export const PRACTICE_STAGE_LABEL: Record<PracticeStage, string> = {
  land_prep_sowing: "Land preparation & sowing",
  crop_protection: "Crop protection",
  harvest_cutting: "Harvest & crop cutting",
  post_harvest_preservation: "Drying, storage & preservation",
  value_creation: "Value creation",
};

export function isPracticeStage(value: string): value is PracticeStage {
  return (PRACTICE_STAGE_ORDER as string[]).includes(value);
}

/** Stage order is domain knowledge, not row order, so content edits can't scramble the journey. */
export function stageRank(stage: string): number {
  const i = PRACTICE_STAGE_ORDER.indexOf(stage as PracticeStage);
  return i === -1 ? PRACTICE_STAGE_ORDER.length : i;
}

export interface LessonLike {
  lessonKey: string;
  sortOrder: number;
}

export interface ModuleProgress {
  total: number;
  completed: number;
  ratio: number;
  complete: boolean;
  completedKeys: string[];
}

export function moduleProgress(
  lessons: readonly LessonLike[],
  completedKeys: readonly string[],
): ModuleProgress {
  const valid = new Set(lessons.map((l) => l.lessonKey));
  const done = [...new Set(completedKeys.filter((k) => valid.has(k)))];
  const total = valid.size;
  return {
    total,
    completed: done.length,
    ratio: total === 0 ? 0 : done.length / total,
    complete: total > 0 && done.length === total,
    completedKeys: done,
  };
}

export function sortLessons<T extends LessonLike>(lessons: readonly T[]): T[] {
  return [...lessons].sort((a, b) =>
    a.sortOrder === b.sortOrder ? a.lessonKey.localeCompare(b.lessonKey) : a.sortOrder - b.sortOrder,
  );
}

/* ------------------------------------------------------ input catalogue */

export type InputCategory = "conventional" | "organic";
export type InputKind =
  | "fertilizer"
  | "bio_fertilizer"
  | "pesticide"
  | "bio_pesticide"
  | "soil_amendment";

export interface InputProduct {
  code: string;
  genericName: string;
  kind: InputKind;
  category: InputCategory;
  nutrientOrActive: string;
  unit: string;
  /** Cost band per `unit`, in paise. */
  costMinMinor: number;
  costMaxMinor: number;
  currency: "INR";
  brandNames: string[];
  preparationNotes: string | null;
}

export interface NutrientRecommendation {
  crop: string;
  growthStage: string;
  soilType: string | null;
  nutrient: string;
  productCode: string;
  dosePerHectare: number;
  unit: string;
  notes: string | null;
}

export const ACRES_PER_HECTARE = 2.47105;

export function acresToHectares(acres: number): number {
  return acres / ACRES_PER_HECTARE;
}

/** Dose scaling is linear on area and always rounded to two decimals for field use. */
export function scaleDose(dosePerHectare: number, areaHectares: number): number {
  if (!Number.isFinite(dosePerHectare) || !Number.isFinite(areaHectares)) {
    throw new Error("dose_inputs_not_numeric");
  }
  if (areaHectares <= 0) throw new Error("area_must_be_positive");
  return Math.round(dosePerHectare * areaHectares * 100) / 100;
}

export interface PlanLine {
  nutrient: string;
  product: InputProduct;
  quantity: number;
  unit: string;
  notes: string | null;
  /** Cost band for the whole quantity, in paise. */
  costMinMinor: number;
  costMaxMinor: number;
}

export function quantityCostBand(product: InputProduct, quantity: number) {
  return {
    costMinMinor: Math.round(product.costMinMinor * quantity),
    costMaxMinor: Math.round(product.costMaxMinor * quantity),
  };
}

export interface NutrientPlan {
  crop: string;
  growthStage: string;
  mode: InputCategory;
  areaHectares: number;
  lines: PlanLine[];
  /** DERIVED SCENARIO — midpoint of the cost band, with assumptions attached. */
  estimatedCost: LabeledMoney;
  costMinMinor: number;
  costMaxMinor: number;
  advisoryNote: string;
}

const ADVISORY_NOTE =
  "Advisory only. Doses are configured reference values for the crop and stage — confirm with your KVK or agronomist and with your soil test before applying.";

/**
 * Builds a nutrient plan for one crop/stage/mode. Organic mode uses only
 * organic-category products, so the two paths never silently mix.
 */
export function buildNutrientPlan(input: {
  crop: string;
  growthStage: string;
  mode: InputCategory;
  areaHectares: number;
  recommendations: readonly NutrientRecommendation[];
  products: readonly InputProduct[];
}): NutrientPlan {
  const byCode = new Map(input.products.map((p) => [p.code, p]));
  const lines: PlanLine[] = [];

  for (const rec of input.recommendations) {
    if (rec.crop.toLowerCase() !== input.crop.toLowerCase()) continue;
    if (rec.growthStage !== input.growthStage) continue;
    const product = byCode.get(rec.productCode);
    if (!product || product.category !== input.mode) continue;
    const quantity = scaleDose(rec.dosePerHectare, input.areaHectares);
    lines.push({
      nutrient: rec.nutrient,
      product,
      quantity,
      unit: rec.unit || product.unit,
      notes: rec.notes,
      ...quantityCostBand(product, quantity),
    });
  }

  lines.sort((a, b) => a.nutrient.localeCompare(b.nutrient));

  const costMinMinor = lines.reduce((sum, l) => sum + l.costMinMinor, 0);
  const costMaxMinor = lines.reduce((sum, l) => sum + l.costMaxMinor, 0);
  const midpoint = Math.round((costMinMinor + costMaxMinor) / 2);

  return {
    crop: input.crop,
    growthStage: input.growthStage,
    mode: input.mode,
    areaHectares: input.areaHectares,
    lines,
    costMinMinor,
    costMaxMinor,
    estimatedCost: labeledMoney({
      amount: midpoint / 100,
      currency: "INR",
      unit: `plan for ${input.areaHectares} ha`,
      label: "derived_scenario",
      sourceKey: "agrighar:input-advisor",
      asOf: null,
      assumptions: {
        crop: input.crop,
        growth_stage: input.growthStage,
        mode: input.mode,
        area_hectares: input.areaHectares,
        cost_band_low_inr: costMinMinor / 100,
        cost_band_high_inr: costMaxMinor / 100,
        basis: "configured dose per hectare × area × catalogue cost band midpoint",
      },
    }),
    advisoryNote: ADVISORY_NOTE,
  };
}

export interface ModeComparison {
  conventionalMinor: number;
  organicMinor: number;
  differenceMinor: number;
  cheaperMode: InputCategory | "equal";
  differencePct: number;
  /** DERIVED SCENARIO — a comparison, never a market price. */
  difference: LabeledMoney;
}

/** Cost comparison between the two modes for the same nutrient target. */
export function compareModes(
  conventional: NutrientPlan,
  organic: NutrientPlan,
): ModeComparison {
  const c = Math.round((conventional.costMinMinor + conventional.costMaxMinor) / 2);
  const o = Math.round((organic.costMinMinor + organic.costMaxMinor) / 2);
  const diff = o - c;
  const base = c === 0 ? (o === 0 ? 1 : o) : c;
  return {
    conventionalMinor: c,
    organicMinor: o,
    differenceMinor: diff,
    cheaperMode: diff === 0 ? "equal" : diff > 0 ? "conventional" : "organic",
    differencePct: Math.round((diff / base) * 1000) / 10,
    difference: labeledMoney({
      amount: Math.abs(diff) / 100,
      currency: "INR",
      unit: `difference for ${conventional.areaHectares} ha`,
      label: "derived_scenario",
      sourceKey: "agrighar:input-advisor:mode-comparison",
      asOf: null,
      assumptions: {
        conventional_inr: c / 100,
        organic_inr: o / 100,
        crop: conventional.crop,
        growth_stage: conventional.growthStage,
        basis: "midpoint of each mode's catalogue cost band",
      },
    }),
  };
}

/* ------------------------------------------------------- infestations */

export type InfestationKind = "pest" | "disease" | "weed";

export interface Infestation {
  id: string;
  code: string;
  crop: string;
  kind: InfestationKind;
  name: string;
  symptoms: string[];
  severity: "low" | "moderate" | "high";
}

export interface Treatment {
  infestationId: string;
  productCode: string;
  dosePerHectare: number;
  unit: string;
  safetyIntervalDays: number;
  reentryNote: string | null;
  isOrganic: boolean;
}

export interface TreatmentOption extends Treatment {
  product: InputProduct;
  quantity: number;
  costMinMinor: number;
  costMaxMinor: number;
  /** Always present — protection advice can never stand alone. */
  humanConfirmation: string;
}

export function matchInfestations(
  all: readonly Infestation[],
  filter: { crop?: string | null; kind?: InfestationKind | null; query?: string | null },
): Infestation[] {
  const q = (filter.query ?? "").trim().toLowerCase();
  return all
    .filter((i) => (filter.crop ? i.crop.toLowerCase() === filter.crop.toLowerCase() : true))
    .filter((i) => (filter.kind ? i.kind === filter.kind : true))
    .filter((i) =>
      q.length === 0
        ? true
        : i.name.toLowerCase().includes(q) ||
          i.symptoms.some((s) => s.toLowerCase().includes(q)),
    )
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Treatment options for one infestation. Organic mode returns only bio options;
 * conventional mode returns bio options first, so IPM stays the default read.
 */
export function treatmentOptions(input: {
  infestationId: string;
  treatments: readonly Treatment[];
  products: readonly InputProduct[];
  areaHectares: number;
  mode: InputCategory;
}): TreatmentOption[] {
  const byCode = new Map(input.products.map((p) => [p.code, p]));
  return input.treatments
    .filter((t) => t.infestationId === input.infestationId)
    .filter((t) => (input.mode === "organic" ? t.isOrganic : true))
    .flatMap((t) => {
      const product = byCode.get(t.productCode);
      if (!product) return [];
      const quantity = scaleDose(t.dosePerHectare, input.areaHectares);
      return [
        {
          ...t,
          product,
          quantity,
          ...quantityCostBand(product, quantity),
          humanConfirmation:
            "AgriGhar does not prescribe an application. Confirm the product, dose and timing with your KVK or agronomist before spraying.",
        } satisfies TreatmentOption,
      ];
    })
    .sort((a, b) => Number(b.isOrganic) - Number(a.isOrganic));
}

/* --------------------------------------------------------- soil care */

export interface SoilPractice {
  id: string;
  code: string;
  name: string;
  soilTypes: string[];
  body: string;
  effort: "low" | "moderate" | "high";
  expectedBenefit: string;
  costMinMinor: number;
  costMaxMinor: number;
  sortOrder: number;
}

function normalizeSoil(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Filters retention practices to the soil types on record. A practice with no
 * soil types is universal. Matching is substring-tolerant because soil names
 * arrive from different sources ("black cotton soil" vs "black cotton").
 */
export function filterSoilPractices(
  practices: readonly SoilPractice[],
  soilTypes: readonly string[],
): SoilPractice[] {
  const soils = soilTypes.map(normalizeSoil).filter((s) => s.length > 0);
  return practices
    .filter((p) => {
      if (p.soilTypes.length === 0) return true;
      if (soils.length === 0) return true;
      return p.soilTypes.some((t) => {
        const target = normalizeSoil(t);
        return soils.some((s) => s.includes(target) || target.includes(s));
      });
    })
    .sort((a, b) => (a.sortOrder === b.sortOrder ? a.name.localeCompare(b.name) : a.sortOrder - b.sortOrder));
}

export interface SoilCarePlan {
  soilTypes: string[];
  basis: "inferred_from_location" | "lab_tested";
  basisNote: string;
  practices: SoilPractice[];
  recommendSoilTest: boolean;
  /** DERIVED SCENARIO — the indicative cost of adopting the listed practices. */
  estimatedCost: LabeledMoney;
}

export function buildSoilCarePlan(input: {
  soilTypes: readonly string[];
  basis: "inferred_from_location" | "lab_tested";
  practices: readonly SoilPractice[];
}): SoilCarePlan {
  const practices = filterSoilPractices(input.practices, input.soilTypes);
  const min = practices.reduce((s, p) => s + p.costMinMinor, 0);
  const max = practices.reduce((s, p) => s + p.costMaxMinor, 0);
  return {
    soilTypes: [...input.soilTypes],
    basis: input.basis,
    basisNote:
      input.basis === "lab_tested"
        ? "These practices are matched to a laboratory result recorded for this farm."
        : "No soil test is on record for this farm, so these practices are matched to soil inferred from the location. Book a soil test for farm-specific rates.",
    practices,
    recommendSoilTest: input.basis !== "lab_tested",
    estimatedCost: labeledMoney({
      amount: Math.round((min + max) / 2) / 100,
      currency: "INR",
      unit: "per acre, all listed practices",
      label: "derived_scenario",
      sourceKey: "agrighar:soil-care",
      asOf: null,
      assumptions: {
        practices: practices.length,
        cost_band_low_inr: min / 100,
        cost_band_high_inr: max / 100,
        basis: "sum of configured practice cost bands, midpoint",
      },
    }),
  };
}

/* ------------------------------------------------------------ sellers */

export interface SellerListingLike {
  id: string;
  title: string;
  category: string | null;
  sellerName: string | null;
  qualityScore: number | null;
  isSponsored?: boolean;
}

/**
 * Matches marketplace listings to an input by generic/active name. Ranking is
 * neutral: quality score then title. Sponsored status is deliberately ignored.
 */
export function matchSellerListings(
  listings: readonly SellerListingLike[],
  product: InputProduct,
  limit = 4,
): SellerListingLike[] {
  const needles = [product.genericName, product.nutrientOrActive, ...product.brandNames]
    .map((v) => v.toLowerCase())
    .flatMap((v) => v.split(/[^a-z0-9]+/i))
    .filter((v) => v.length >= 4);

  return listings
    .filter((l) => {
      const hay = `${l.title} ${l.category ?? ""}`.toLowerCase();
      return needles.some((n) => hay.includes(n));
    })
    .sort((a, b) => {
      const q = (b.qualityScore ?? 0) - (a.qualityScore ?? 0);
      return q !== 0 ? q : a.title.localeCompare(b.title);
    })
    .slice(0, limit);
}
