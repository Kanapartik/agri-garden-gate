/**
 * Slice B10 — farmer history & farm command centre: pure domain logic.
 *
 * Every number shown to the farmer is derived here so it is unit-testable and
 * identical on server and client. Nothing in this module decides insurance
 * eligibility, claim outcomes or scheme approval — those stay with the
 * authorised human/partner role.
 */

export const SEASON_CODES = ["kharif", "rabi", "zaid", "perennial"] as const;
export type SeasonCodeB10 = (typeof SEASON_CODES)[number];

export const SEASON_LABEL: Record<string, string> = {
  kharif: "Kharif (monsoon)",
  rabi: "Rabi (winter)",
  zaid: "Zaid (summer)",
  perennial: "Perennial",
};

export const COST_HEADS = [
  "seed",
  "fertiliser",
  "protection",
  "labour",
  "machinery",
  "other",
] as const;
export type CostHead = (typeof COST_HEADS)[number];

export const COST_HEAD_LABEL: Record<CostHead, string> = {
  seed: "Seed",
  fertiliser: "Fertiliser / nutrition",
  protection: "Crop protection",
  labour: "Labour",
  machinery: "Machinery / hiring",
  other: "Other",
};

export type CostBreakdown = Partial<Record<CostHead, number>>;

export interface SeasonRecord {
  id: string;
  farm_id: string | null;
  crop_year: number;
  season_code: string;
  crop: string;
  area_acres: number;
  input_costs: CostBreakdown;
  input_cost_total: number;
  yield_quintal: number | null;
  price_per_quintal: number | null;
  revenue_inr: number | null;
  notes: string | null;
}

/* ------------------------------------------------------------ money maths */

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function totalCost(costs: CostBreakdown): number {
  return round2(
    COST_HEADS.reduce((sum, head) => sum + (Number(costs[head]) > 0 ? Number(costs[head]) : 0), 0),
  );
}

/** Revenue is taken as entered when present, otherwise yield × price. */
export function seasonRevenue(record: {
  revenue_inr?: number | null;
  yield_quintal?: number | null;
  price_per_quintal?: number | null;
}): number | null {
  if (typeof record.revenue_inr === "number" && record.revenue_inr > 0) {
    return round2(record.revenue_inr);
  }
  const y = record.yield_quintal ?? null;
  const p = record.price_per_quintal ?? null;
  if (y === null || p === null || y <= 0 || p <= 0) return null;
  return round2(y * p);
}

export interface SeasonEconomics {
  revenue: number | null;
  cost: number;
  netMargin: number | null;
  netPerAcre: number | null;
  yieldPerAcre: number | null;
  costPerAcre: number | null;
  /** Net margin as a share of cost; null when cost or revenue is missing. */
  returnOnCostPct: number | null;
}

export function seasonEconomics(record: SeasonRecord): SeasonEconomics {
  const cost = record.input_cost_total > 0 ? round2(record.input_cost_total) : totalCost(record.input_costs);
  const revenue = seasonRevenue(record);
  const acres = record.area_acres > 0 ? record.area_acres : null;
  const netMargin = revenue === null ? null : round2(revenue - cost);
  return {
    revenue,
    cost,
    netMargin,
    netPerAcre: netMargin === null || acres === null ? null : round2(netMargin / acres),
    yieldPerAcre:
      record.yield_quintal === null || acres === null ? null : round2(record.yield_quintal / acres),
    costPerAcre: acres === null ? null : round2(cost / acres),
    returnOnCostPct: netMargin === null || cost <= 0 ? null : Math.round((netMargin / cost) * 100),
  };
}

/* ------------------------------------------------------------- farm scale */

export type FarmScale = "small" | "medium" | "large";

export interface ScaleProfile {
  scale: FarmScale;
  label: string;
  /** Large holdings get parcel-wise breakdowns; small holdings stay single-view. */
  showParcelBreakdown: boolean;
  helper: string;
}

export function classifyScale(totalAcres: number | null | undefined): ScaleProfile {
  const acres = typeof totalAcres === "number" && totalAcres > 0 ? totalAcres : 0;
  if (acres > 25) {
    return {
      scale: "large",
      label: "Large holding",
      showParcelBreakdown: true,
      helper: "Parcel-wise economics and multi-crop planning are shown.",
    };
  }
  if (acres >= 5) {
    return {
      scale: "medium",
      label: "Medium holding",
      showParcelBreakdown: true,
      helper: "Season comparison across parcels, with area benchmarks.",
    };
  }
  return {
    scale: "small",
    label: "Small holding",
    showParcelBreakdown: false,
    helper: "A single simple view of cost, yield and income per season.",
  };
}

/* -------------------------------------------------------- five-year rollup */

export interface YearRollup {
  crop_year: number;
  revenue: number;
  cost: number;
  netMargin: number;
  acres: number;
  netPerAcre: number | null;
  crops: string[];
}

export type TrendDirection = "improving" | "flat" | "declining" | "insufficient_data";

export interface HistorySummary {
  years: YearRollup[];
  seasonsRecorded: number;
  yearsCovered: number;
  totalRevenue: number;
  totalCost: number;
  totalNet: number;
  avgNetPerAcre: number | null;
  bestYear: YearRollup | null;
  worstYear: YearRollup | null;
  trend: TrendDirection;
  cropsGrown: string[];
}

export function summariseHistory(records: readonly SeasonRecord[]): HistorySummary {
  const byYear = new Map<number, YearRollup>();
  let totalRevenue = 0;
  let totalCost = 0;
  let totalAcres = 0;
  const crops = new Set<string>();

  for (const record of records) {
    const eco = seasonEconomics(record);
    const revenue = eco.revenue ?? 0;
    const row =
      byYear.get(record.crop_year) ??
      ({
        crop_year: record.crop_year,
        revenue: 0,
        cost: 0,
        netMargin: 0,
        acres: 0,
        netPerAcre: null,
        crops: [],
      } satisfies YearRollup);
    row.revenue = round2(row.revenue + revenue);
    row.cost = round2(row.cost + eco.cost);
    row.netMargin = round2(row.revenue - row.cost);
    row.acres = round2(row.acres + (record.area_acres > 0 ? record.area_acres : 0));
    row.netPerAcre = row.acres > 0 ? round2(row.netMargin / row.acres) : null;
    if (record.crop && !row.crops.includes(record.crop)) row.crops.push(record.crop);
    byYear.set(record.crop_year, row);

    totalRevenue = round2(totalRevenue + revenue);
    totalCost = round2(totalCost + eco.cost);
    totalAcres = round2(totalAcres + (record.area_acres > 0 ? record.area_acres : 0));
    if (record.crop) crops.add(record.crop);
  }

  const years = [...byYear.values()].sort((a, b) => a.crop_year - b.crop_year);
  const ranked = [...years].sort((a, b) => (b.netPerAcre ?? -Infinity) - (a.netPerAcre ?? -Infinity));

  let trend: TrendDirection = "insufficient_data";
  if (years.length >= 2) {
    const first = years[0]?.netPerAcre ?? null;
    const last = years[years.length - 1]?.netPerAcre ?? null;
    if (first !== null && last !== null && first !== 0) {
      const delta = (last - first) / Math.abs(first);
      trend = delta > 0.08 ? "improving" : delta < -0.08 ? "declining" : "flat";
    } else {
      trend = "flat";
    }
  }

  return {
    years,
    seasonsRecorded: records.length,
    yearsCovered: years.length,
    totalRevenue,
    totalCost,
    totalNet: round2(totalRevenue - totalCost),
    avgNetPerAcre: totalAcres > 0 ? round2((totalRevenue - totalCost) / totalAcres) : null,
    bestYear: ranked[0] ?? null,
    worstYear: ranked.length > 1 ? (ranked[ranked.length - 1] ?? null) : null,
    trend,
    cropsGrown: [...crops].sort(),
  };
}

/* --------------------------------------------------------- area benchmarks */

export interface AreaBenchmark {
  state_name: string;
  district: string;
  crop: string;
  crop_year: number;
  season_code: string;
  typical_yield_quintal_per_acre: number;
  yield_low_quintal_per_acre: number;
  yield_high_quintal_per_acre: number;
  typical_cost_per_acre: number;
  typical_price_per_quintal: number;
  price_low_per_quintal: number;
  price_high_per_quintal: number;
  adoption_share: number;
  source: string;
}

export interface AreaCropView {
  crop: string;
  years: number;
  avgYieldPerAcre: number;
  yieldBand: [number, number];
  avgCostPerAcre: number;
  avgPricePerQuintal: number;
  priceBand: [number, number];
  adoptionShare: number;
  /** Indicative gross realisation per acre using area typicals. */
  indicativeGrossPerAcre: number;
  indicativeNetPerAcre: number;
}

/** Collapses the 5-year district rows into one comparable row per crop. */
export function areaCropViews(rows: readonly AreaBenchmark[]): AreaCropView[] {
  const grouped = new Map<string, AreaBenchmark[]>();
  for (const row of rows) {
    const list = grouped.get(row.crop) ?? [];
    list.push(row);
    grouped.set(row.crop, list);
  }
  const avg = (list: readonly number[]) =>
    list.length ? round2(list.reduce((a, b) => a + b, 0) / list.length) : 0;

  return [...grouped.entries()]
    .map(([crop, list]) => {
      const yieldAvg = avg(list.map((r) => r.typical_yield_quintal_per_acre));
      const costAvg = avg(list.map((r) => r.typical_cost_per_acre));
      const priceAvg = avg(list.map((r) => r.typical_price_per_quintal));
      const gross = round2(yieldAvg * priceAvg);
      return {
        crop,
        years: list.length,
        avgYieldPerAcre: yieldAvg,
        yieldBand: [
          Math.min(...list.map((r) => r.yield_low_quintal_per_acre)),
          Math.max(...list.map((r) => r.yield_high_quintal_per_acre)),
        ] as [number, number],
        avgCostPerAcre: costAvg,
        avgPricePerQuintal: priceAvg,
        priceBand: [
          Math.min(...list.map((r) => r.price_low_per_quintal)),
          Math.max(...list.map((r) => r.price_high_per_quintal)),
        ] as [number, number],
        adoptionShare: avg(list.map((r) => r.adoption_share)),
        indicativeGrossPerAcre: gross,
        indicativeNetPerAcre: round2(gross - costAvg),
      };
    })
    .sort((a, b) => b.adoptionShare - a.adoptionShare);
}

export interface OwnVsArea {
  crop: string;
  ownYieldPerAcre: number | null;
  areaYieldPerAcre: number;
  yieldGapPct: number | null;
  ownNetPerAcre: number | null;
  areaNetPerAcre: number;
  verdict: "above_area" | "near_area" | "below_area" | "no_own_data";
}

/**
 * Compares the farmer's own crop performance against district typicals. Purely
 * informational — it never scores the farmer or gates any benefit.
 */
export function ownVsArea(
  records: readonly SeasonRecord[],
  views: readonly AreaCropView[],
): OwnVsArea[] {
  return views.map((view) => {
    const mine = records.filter((r) => r.crop.toLowerCase() === view.crop.toLowerCase());
    const yields = mine
      .map((r) => seasonEconomics(r).yieldPerAcre)
      .filter((v): v is number => typeof v === "number");
    const nets = mine
      .map((r) => seasonEconomics(r).netPerAcre)
      .filter((v): v is number => typeof v === "number");
    const ownYield = yields.length
      ? round2(yields.reduce((a, b) => a + b, 0) / yields.length)
      : null;
    const ownNet = nets.length ? round2(nets.reduce((a, b) => a + b, 0) / nets.length) : null;
    const gap =
      ownYield === null || view.avgYieldPerAcre <= 0
        ? null
        : Math.round(((ownYield - view.avgYieldPerAcre) / view.avgYieldPerAcre) * 100);

    return {
      crop: view.crop,
      ownYieldPerAcre: ownYield,
      areaYieldPerAcre: view.avgYieldPerAcre,
      yieldGapPct: gap,
      ownNetPerAcre: ownNet,
      areaNetPerAcre: view.indicativeNetPerAcre,
      verdict:
        gap === null ? "no_own_data" : gap >= 8 ? "above_area" : gap <= -8 ? "below_area" : "near_area",
    };
  });
}

/* --------------------------------------------------------- insurance corner */

export type CoverState = "covered" | "partially_covered" | "not_covered" | "unknown";

export const COVER_LABEL: Record<CoverState, string> = {
  covered: "Cover recorded for this season",
  partially_covered: "Partially covered",
  not_covered: "No cover recorded",
  unknown: "Cover status not known",
};

export interface InsuranceCorner {
  seasonCode: string;
  cropYear: number;
  crop: string | null;
  district: string | null;
  coverState: CoverState;
  indicativePremiumPerAcre: number | null;
  sumInsuredPerAcre: number | null;
  farmerSharePerAcre: number | null;
  estimatedFarmerShare: number | null;
  estimatedSumInsured: number | null;
  contactLabel: string | null;
  source: string;
  /** Always advisory: an authorised insurer/partner role decides. */
  advisory: true;
}

/**
 * PMFBY-style farmer share is a configured percentage of sum insured, capped by
 * the actuarial premium. This only *indicates* an amount; it is never a quote.
 */
export function farmerPremiumShare(input: {
  sumInsuredPerAcre: number;
  actuarialPremiumPerAcre: number;
  farmerSharePct: number;
}): number {
  const share = round2((input.sumInsuredPerAcre * input.farmerSharePct) / 100);
  return round2(Math.min(share, input.actuarialPremiumPerAcre));
}

export function buildInsuranceCorner(input: {
  seasonCode: string;
  cropYear: number;
  crop: string | null;
  district: string | null;
  acres: number | null;
  coverState: CoverState;
  indicativePremiumPerAcre: number | null;
  sumInsuredPerAcre: number | null;
  farmerSharePerAcre: number | null;
  contactLabel: string | null;
  source: string;
}): InsuranceCorner {
  const acres = input.acres && input.acres > 0 ? input.acres : null;
  return {
    seasonCode: input.seasonCode,
    cropYear: input.cropYear,
    crop: input.crop,
    district: input.district,
    coverState: input.coverState,
    indicativePremiumPerAcre: input.indicativePremiumPerAcre,
    sumInsuredPerAcre: input.sumInsuredPerAcre,
    farmerSharePerAcre: input.farmerSharePerAcre,
    estimatedFarmerShare:
      acres === null || input.farmerSharePerAcre === null
        ? null
        : round2(acres * input.farmerSharePerAcre),
    estimatedSumInsured:
      acres === null || input.sumInsuredPerAcre === null
        ? null
        : round2(acres * input.sumInsuredPerAcre),
    contactLabel: input.contactLabel,
    source: input.source,
    advisory: true,
  };
}

/* -------------------------------------------------------- history readiness */

export interface HistoryReadiness {
  score: number;
  yearsMissing: number[];
  message: string;
}

/** How complete the last five years of history is, for a gentle nudge only. */
export function historyReadiness(
  records: readonly SeasonRecord[],
  currentYear: number,
): HistoryReadiness {
  const wanted = [0, 1, 2, 3, 4].map((n) => currentYear - n);
  const have = new Set(records.map((r) => r.crop_year));
  const missing = wanted.filter((y) => !have.has(y));
  const score = Math.round(((wanted.length - missing.length) / wanted.length) * 100);
  return {
    score,
    yearsMissing: missing,
    message:
      missing.length === 0
        ? "Five years of history recorded."
        : `Add ${missing.length} more season${missing.length === 1 ? "" : "s"} to complete five years.`,
  };
}
