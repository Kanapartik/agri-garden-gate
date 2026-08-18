/**
 * B2A — My Farm Intelligence: pure, IO-free domain logic.
 *
 * Nothing here performs network or database access, so every rule the PRD calls
 * out (three separate price labels, configurable recovery assumptions,
 * explainable crop scoring, lab-vs-inferred soil separation, break-even maths)
 * is directly unit-testable and reusable from server functions.
 */

/* ------------------------------------------------------- price labels */

/**
 * Three labels that must never be confused in the UI:
 *  - `observed`          an actual mandi/partner price, with source + date
 *  - `forecast`          a model estimate, always with an uncertainty range
 *  - `derived_scenario`  a calculated value-add / planner outcome
 */
export type PriceLabel = "observed" | "forecast" | "derived_scenario";

export const PRICE_LABEL_TEXT: Record<PriceLabel, string> = {
  observed: "OBSERVED",
  forecast: "FORECAST",
  derived_scenario: "DERIVED SCENARIO",
};

export const PRICE_LABEL_HELP: Record<PriceLabel, string> = {
  observed: "Actual market/partner price recorded on a date, from a named source.",
  forecast: "Model estimate of a future price. Shown with an uncertainty range, never as today's price.",
  derived_scenario: "Calculated outcome from visible assumptions. Not a market price.",
};

export interface LabeledMoney {
  amount: number;
  currency: "INR";
  unit: string;
  label: PriceLabel;
  sourceKey: string;
  asOf: string | null;
  /** Required for `forecast`. */
  range?: { low: number; high: number };
  /** Required for `derived_scenario`. */
  assumptions?: Record<string, string | number>;
}

/**
 * The only constructor for money in this domain. It refuses unlabelled values,
 * a forecast without an uncertainty range and a derived value without visible
 * assumptions, so a derived or predicted number can never be rendered as if it
 * were a current market price.
 */
export function labeledMoney(input: LabeledMoney): LabeledMoney {
  if (!input.label) throw new Error("price_label_required");
  if (!Number.isFinite(input.amount)) throw new Error("price_amount_not_numeric");
  if (!input.sourceKey) throw new Error("price_source_required");
  if (input.label === "observed" && !input.asOf) throw new Error("observed_price_requires_as_of");
  if (input.label === "forecast" && !input.range) throw new Error("forecast_price_requires_range");
  if (input.label === "derived_scenario" && !input.assumptions) {
    throw new Error("derived_price_requires_assumptions");
  }
  return input;
}

export function isObservedPrice(money: LabeledMoney): boolean {
  return money.label === "observed";
}

/* ------------------------------------------------------------ geodesy */

export interface GeoPoint {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_KM = 6371;

export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h)) * 10) / 10;
}

export interface FacilityLike {
  id: string;
  kind: string;
  name: string;
  latitude: number;
  longitude: number;
  district_name: string | null;
  state_name: string | null;
  soil_lab_kind?: string | null;
  contact_label?: string | null;
  source_key: string;
}

export interface RankedFacility extends FacilityLike {
  distanceKm: number;
}

/** Distance-ranked, deterministic (name tie-break) — never paid placement. */
export function nearestFacilities(
  from: GeoPoint,
  facilities: readonly FacilityLike[],
  opts: { kinds?: readonly string[]; limit?: number } = {},
): RankedFacility[] {
  const kinds = opts.kinds;
  const limit = opts.limit ?? 5;
  return facilities
    .filter((f) => (kinds ? kinds.includes(f.kind) : true))
    .map((f) => ({ ...f, distanceKm: haversineKm(from, { lat: f.latitude, lng: f.longitude }) }))
    .sort((a, b) => a.distanceKm - b.distanceKm || a.name.localeCompare(b.name))
    .slice(0, limit);
}

/* ------------------------------------------------------------- season */

export type SeasonCode = "kharif" | "rabi" | "zaid";

export interface Season {
  code: SeasonCode;
  label: string;
  sowingWindow: string;
  harvestWindow: string;
}

const SEASONS: Record<SeasonCode, Season> = {
  kharif: { code: "kharif", label: "Kharif (monsoon)", sowingWindow: "Jun–Jul", harvestWindow: "Oct–Nov" },
  rabi: { code: "rabi", label: "Rabi (post-monsoon)", sowingWindow: "Oct–Nov", harvestWindow: "Feb–Mar" },
  zaid: { code: "zaid", label: "Zaid (summer)", sowingWindow: "Mar–Apr", harvestWindow: "May–Jun" },
};

/** Calendar-month season resolution for the AP/Telangana anchor geography. */
export function resolveSeason(now: Date): Season {
  const m = now.getUTCMonth() + 1;
  if (m >= 6 && m <= 9) return SEASONS.kharif;
  if (m >= 10 || m <= 2) return SEASONS.rabi;
  return SEASONS.zaid;
}

export function seasonByCode(code: SeasonCode): Season {
  return SEASONS[code];
}

/* --------------------------------------------------------------- soil */

export type SoilBasis = "inferred_from_location" | "lab_tested";

export interface SoilGeneral {
  majorSoils: string[];
  texture: string;
  phRange: string;
  organicCarbonRange: string;
  sourceKey: string;
  observedAt: string;
}

export interface SoilLabResult {
  cardRef: string;
  labName: string;
  labKind: string;
  testedOn: string;
  ph: number;
  organicCarbonPct: number;
  nitrogen: string;
  phosphorus: string;
  potassium: string;
  sourceKey: string;
}

export interface SoilIntelligence {
  basis: SoilBasis;
  general: SoilGeneral;
  lab: SoilLabResult | null;
  /** Plain-language reason the farmer sees, so the two are never conflated. */
  basisNote: string;
}

export function classifySoil(general: SoilGeneral, lab: SoilLabResult | null): SoilIntelligence {
  if (lab) {
    return {
      basis: "lab_tested",
      general,
      lab,
      basisNote: `Actual laboratory result for this farm (${lab.labName}, tested ${lab.testedOn}). General location soil information is shown separately for context.`,
    };
  }
  return {
    basis: "inferred_from_location",
    general,
    lab: null,
    basisNote:
      "No Soil Health Card or laboratory test is on record for this farm. What you see is general soil information inferred from the location — book a soil test for farm-specific values.",
  };
}

/* -------------------------------------------------- crop suitability */

export interface CropFactor {
  key: string;
  label: string;
  weight: number;
  /** 0..1 */
  score: number;
  explanation: string;
  sourceKey: string;
}

export interface CropCandidateInput {
  crop: string;
  variety: string | null;
  season: SeasonCode;
  sowingWindow: string;
  soilFit: number;
  rainfallOutlook: number;
  irrigationFit: number;
  sowingWindowFit: number;
  historicPerformance: number;
  localPriceStrength: number;
  valueAddOpportunity: number;
  sources: string[];
  changeFactors: string[];
}

export interface CropRecommendation {
  crop: string;
  variety: string | null;
  season: SeasonCode;
  sowingWindow: string;
  /** 0..100 */
  score: number;
  confidence: number;
  soilBasis: SoilBasis;
  factors: CropFactor[];
  changeFactors: string[];
  sources: string[];
  freshnessSeconds: number | null;
  /** Never an instruction — always decision support. */
  explanation: string;
}

const FACTOR_WEIGHTS = {
  soilFit: 0.22,
  rainfallOutlook: 0.18,
  irrigationFit: 0.15,
  sowingWindowFit: 0.15,
  historicPerformance: 0.12,
  localPriceStrength: 0.1,
  valueAddOpportunity: 0.08,
} as const;

const FACTOR_LABEL: Record<keyof typeof FACTOR_WEIGHTS, string> = {
  soilFit: "Soil suitability",
  rainfallOutlook: "Rainfall outlook",
  irrigationFit: "Irrigation availability",
  sowingWindowFit: "Sowing window",
  historicPerformance: "Historic crop performance",
  localPriceStrength: "Local price conditions",
  valueAddOpportunity: "Market / value-add opportunity",
};

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

/**
 * Explainable scoring: every recommendation carries the factor breakdown,
 * confidence, sources and the things that would change the answer. A candidate
 * without sources or change factors is rejected rather than shown bare.
 */
export function scoreCrop(
  input: CropCandidateInput,
  ctx: { soilBasis: SoilBasis; freshnessSeconds?: number | null },
): CropRecommendation {
  if (input.sources.length === 0) throw new Error("crop_recommendation_requires_sources");
  if (input.changeFactors.length === 0) throw new Error("crop_recommendation_requires_change_factors");

  const entries = Object.keys(FACTOR_WEIGHTS) as Array<keyof typeof FACTOR_WEIGHTS>;
  const factors: CropFactor[] = entries.map((key) => {
    const score = clamp01(input[key]);
    return {
      key,
      label: FACTOR_LABEL[key],
      weight: FACTOR_WEIGHTS[key],
      score,
      explanation: explainFactor(key, score),
      sourceKey: input.sources[0]!,
    };
  });

  const weighted = factors.reduce((sum, f) => sum + f.weight * f.score, 0);
  const score = Math.round(weighted * 1000) / 10;
  // Lab-tested soil raises confidence; inferred soil deliberately caps it.
  const base = ctx.soilBasis === "lab_tested" ? 0.8 : 0.6;
  const confidence = Math.round(Math.min(0.92, base * (0.6 + 0.4 * weighted)) * 100) / 100;

  return {
    crop: input.crop,
    variety: input.variety,
    season: input.season,
    sowingWindow: input.sowingWindow,
    score,
    confidence,
    soilBasis: ctx.soilBasis,
    factors,
    changeFactors: input.changeFactors,
    sources: input.sources,
    freshnessSeconds: ctx.freshnessSeconds ?? null,
    explanation: buildExplanation(input.crop, factors),
  };
}

function explainFactor(key: keyof typeof FACTOR_WEIGHTS, score: number): string {
  const band = score >= 0.75 ? "strong" : score >= 0.5 ? "moderate" : "weak";
  const text: Record<keyof typeof FACTOR_WEIGHTS, string> = {
    soilFit: `${band} match between this crop and the soil on record`,
    rainfallOutlook: `${band} rainfall outlook for the coming sowing window`,
    irrigationFit: `${band} fit with the irrigation recorded for this parcel`,
    sowingWindowFit: `${band} alignment with the district sowing window`,
    historicPerformance: `${band} historic performance for this crop in the district`,
    localPriceStrength: `${band} recent local price conditions`,
    valueAddOpportunity: `${band} processing / value-add opportunity nearby`,
  };
  return text[key];
}

function buildExplanation(crop: string, factors: readonly CropFactor[]): string {
  const top = [...factors].sort((a, b) => b.weight * b.score - a.weight * a.score).slice(0, 3);
  return `${crop} is shortlisted mainly because of ${top
    .map((f) => `${f.label.toLowerCase()} (${Math.round(f.score * 100)}%)`)
    .join(", ")}. This is decision support, not a guarantee — confirm with your nearest FPO, KVK or agronomist.`;
}

export function rankCrops(recommendations: readonly CropRecommendation[]): CropRecommendation[] {
  return [...recommendations].sort((a, b) => b.score - a.score || a.crop.localeCompare(b.crop));
}

/* ------------------------------------------------- processing paths */

export interface ByproductAssumption {
  name: string;
  yield_pct: number;
  price_per_quintal: number;
}

export interface ProcessingStepAssumption {
  step_order: number;
  from_product: string;
  to_product: string;
  /** Configurable — never a hard-coded universal constant. */
  recovery_pct: number;
  byproducts: ByproductAssumption[];
  cost_per_quintal: number;
  cost_breakdown: Record<string, number>;
  assumption_note: string | null;
}

export interface ProcessingStepResult {
  stepOrder: number;
  fromProduct: string;
  toProduct: string;
  recoveryPct: number;
  inputQuintal: number;
  outputQuintal: number;
  processingCost: number;
  byproducts: Array<{ name: string; quantityQuintal: number; value: number; pricePerQuintal: number }>;
  byproductValue: number;
  assumptionNote: string | null;
}

export interface ValueAddResult {
  commodity: string;
  inputQuintal: number;
  steps: ProcessingStepResult[];
  finalProduct: string;
  finalOutputQuintal: number;
  totalProcessingCost: number;
  totalByproductValue: number;
  /** Raw price the comparison started from — carries its own label. */
  rawPrice: LabeledMoney;
  rawRealization: LabeledMoney;
  /** Observable market price for the processed product, when one exists. */
  processedObservedPrice: LabeledMoney | null;
  estimatedRealization: LabeledMoney;
  assumptions: Record<string, string | number>;
}

export interface ValueAddInput {
  commodity: string;
  inputQuintal: number;
  steps: readonly ProcessingStepAssumption[];
  rawPrice: LabeledMoney;
  /** Price for the final processed product, if actually observed in a market. */
  processedPrice?: LabeledMoney | null;
  /** Per-quintal packaging and transport applied to the final output. */
  packagingPerQuintal?: number;
  transportPerQuintal?: number;
  assumptionSource: string;
}

/**
 * Evaluates a configurable processing path. Recovery percentages and costs come
 * from the caller (platform default, processor/FPO override or an actual
 * quotation) — this function never supplies its own conversion rates.
 */
export function evaluateValueAdd(input: ValueAddInput): ValueAddResult {
  if (input.steps.length === 0) throw new Error("processing_path_requires_steps");
  if (input.inputQuintal <= 0) throw new Error("processing_input_must_be_positive");

  const ordered = [...input.steps].sort((a, b) => a.step_order - b.step_order);
  const steps: ProcessingStepResult[] = [];
  let quantity = input.inputQuintal;
  let totalCost = 0;
  let totalByproductValue = 0;

  for (const step of ordered) {
    if (step.recovery_pct <= 0 || step.recovery_pct > 100) throw new Error("recovery_pct_out_of_range");
    const output = round2((quantity * step.recovery_pct) / 100);
    const cost = round2(quantity * step.cost_per_quintal);
    const byproducts = step.byproducts.map((b) => {
      const qty = round2((quantity * b.yield_pct) / 100);
      return {
        name: b.name,
        quantityQuintal: qty,
        pricePerQuintal: b.price_per_quintal,
        value: round2(qty * b.price_per_quintal),
      };
    });
    const byproductValue = round2(byproducts.reduce((s, b) => s + b.value, 0));
    steps.push({
      stepOrder: step.step_order,
      fromProduct: step.from_product,
      toProduct: step.to_product,
      recoveryPct: step.recovery_pct,
      inputQuintal: quantity,
      outputQuintal: output,
      processingCost: cost,
      byproducts,
      byproductValue,
      assumptionNote: step.assumption_note,
    });
    totalCost = round2(totalCost + cost);
    totalByproductValue = round2(totalByproductValue + byproductValue);
    quantity = output;
  }

  const packaging = round2((input.packagingPerQuintal ?? 0) * quantity);
  const transport = round2((input.transportPerQuintal ?? 0) * quantity);
  const finalStep = steps[steps.length - 1]!;

  const assumptions: Record<string, string | number> = {
    assumption_source: input.assumptionSource,
    input_quintal: input.inputQuintal,
    final_output_quintal: quantity,
    total_processing_cost: totalCost,
    packaging_cost: packaging,
    transport_cost: transport,
    byproduct_value: totalByproductValue,
    raw_price_label: input.rawPrice.label,
  };
  ordered.forEach((s) => {
    assumptions[`recovery_${s.step_order}_${slug(s.to_product)}_pct`] = s.recovery_pct;
  });

  const rawRealization = labeledMoney({
    amount: round2(input.rawPrice.amount * input.inputQuintal),
    currency: "INR",
    unit: `lot of ${input.inputQuintal} quintal`,
    label: "derived_scenario",
    sourceKey: `derived:raw-sale:${input.rawPrice.sourceKey}`,
    asOf: input.rawPrice.asOf,
    assumptions: { raw_price_per_quintal: input.rawPrice.amount, input_quintal: input.inputQuintal },
  });

  const processedGross = input.processedPrice ? input.processedPrice.amount * quantity : null;
  const realization =
    (processedGross ?? 0) + totalByproductValue - totalCost - packaging - transport;

  const estimatedRealization = labeledMoney({
    amount: round2(realization),
    currency: "INR",
    unit: `lot of ${input.inputQuintal} quintal`,
    label: "derived_scenario",
    sourceKey: `derived:value-add:${input.assumptionSource}`,
    asOf: input.processedPrice?.asOf ?? null,
    assumptions: {
      ...assumptions,
      processed_price_per_quintal: input.processedPrice?.amount ?? "not_available",
      processed_price_label: input.processedPrice?.label ?? "not_available",
    },
  });

  return {
    commodity: input.commodity,
    inputQuintal: input.inputQuintal,
    steps,
    finalProduct: finalStep.toProduct,
    finalOutputQuintal: quantity,
    totalProcessingCost: round2(totalCost + packaging + transport),
    totalByproductValue,
    rawPrice: input.rawPrice,
    rawRealization,
    processedObservedPrice: input.processedPrice?.label === "observed" ? input.processedPrice : null,
    estimatedRealization,
    assumptions,
  };
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/* ------------------------------------------------- outcome scenarios */

export type ScenarioBand = "low" | "base" | "high";

export interface OutcomeInput {
  crop: string;
  season: SeasonCode;
  areaAcres: number;
  /** Base expectation per acre, in quintal. */
  baseYieldPerAcre: number;
  basePrice: LabeledMoney;
  /** Per-acre cultivation cost at the base scenario. */
  baseCostPerAcre: number;
  harvestWindow: string;
  targetMarket: string;
  valueAddAlternative: string;
  risks: string[];
}

export interface OutcomeScenario {
  scenario: ScenarioBand;
  label: PriceLabel;
  expectedYieldQuintal: number;
  sellingPrice: number;
  sellingPriceLabel: PriceLabel;
  totalCost: number;
  grossRealization: number;
  netContribution: number;
  breakEvenPrice: number;
  breakEvenYield: number;
  harvestWindow: string;
  targetMarket: string;
  valueAddAlternative: string;
  risks: string[];
  assumptions: Record<string, string | number>;
}

const BANDS: Record<ScenarioBand, { yield: number; price: number; cost: number }> = {
  low: { yield: 0.8, price: 0.9, cost: 1.1 },
  base: { yield: 1, price: 1, cost: 1 },
  high: { yield: 1.15, price: 1.08, cost: 0.97 },
};

/**
 * Low/base/high outcome scenarios. Every output is a DERIVED SCENARIO; the
 * selling price keeps the label of the price it came from so the farmer can see
 * whether it is an observed mandi price or a forecast.
 */
export function outcomeScenarios(input: OutcomeInput): OutcomeScenario[] {
  if (input.areaAcres <= 0) throw new Error("area_must_be_positive");
  return (Object.keys(BANDS) as ScenarioBand[]).map((band) => {
    const f = BANDS[band];
    const yieldQuintal = round2(input.areaAcres * input.baseYieldPerAcre * f.yield);
    const price = round2(input.basePrice.amount * f.price);
    const totalCost = round2(input.areaAcres * input.baseCostPerAcre * f.cost);
    const gross = round2(yieldQuintal * price);
    return {
      scenario: band,
      label: "derived_scenario" as PriceLabel,
      expectedYieldQuintal: yieldQuintal,
      sellingPrice: price,
      sellingPriceLabel: input.basePrice.label,
      totalCost,
      grossRealization: gross,
      netContribution: round2(gross - totalCost),
      breakEvenPrice: yieldQuintal > 0 ? round2(totalCost / yieldQuintal) : 0,
      breakEvenYield: price > 0 ? round2(totalCost / price) : 0,
      harvestWindow: input.harvestWindow,
      targetMarket: input.targetMarket,
      valueAddAlternative: input.valueAddAlternative,
      risks: input.risks,
      assumptions: {
        area_acres: input.areaAcres,
        base_yield_per_acre: input.baseYieldPerAcre,
        yield_factor: f.yield,
        price_factor: f.price,
        cost_factor: f.cost,
        base_cost_per_acre: input.baseCostPerAcre,
        base_price_source: input.basePrice.sourceKey,
        base_price_label: input.basePrice.label,
      },
    };
  });
}

/* ------------------------------------------------------- escalations */

export type EscalationKind =
  | "talk_to_fpo"
  | "talk_to_kvk"
  | "talk_to_agronomist"
  | "book_soil_test"
  | "request_processor_quote";

export const ESCALATION_LABEL: Record<EscalationKind, string> = {
  talk_to_fpo: "Talk to nearest FPO",
  talk_to_kvk: "Talk to nearest KVK / extension centre",
  talk_to_agronomist: "Talk to an agronomist",
  book_soil_test: "Book a soil test",
  request_processor_quote: "Request a processor quote",
};

export const ESCALATION_FACILITY_KINDS: Record<EscalationKind, string[]> = {
  talk_to_fpo: ["fpo"],
  talk_to_kvk: ["kvk", "extension_centre"],
  talk_to_agronomist: ["kvk", "extension_centre", "fpo"],
  book_soil_test: ["soil_lab"],
  request_processor_quote: ["processor"],
};

/* --------------------------------------------------------- freshness */

export function freshnessLabel(seconds: number | null): string {
  if (seconds === null) return "freshness unknown";
  if (seconds < 3600) return `${Math.max(1, Math.round(seconds / 60))} min old`;
  if (seconds < 86_400) return `${Math.round(seconds / 3600)} h old`;
  return `${Math.round(seconds / 86_400)} d old`;
}

export function confidenceLabel(confidence: number | null): string {
  if (confidence === null) return "confidence unknown";
  if (confidence >= 0.75) return "high confidence";
  if (confidence >= 0.5) return "moderate confidence";
  return "low confidence";
}
