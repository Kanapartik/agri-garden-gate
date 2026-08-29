import { describe, expect, it } from "vitest";
import {
  isOfficialSource,
  resolveAdapterMode,
  resolveAreaCropBaselineAdapter,
  resolveFarmerInsuranceIndicatorAdapter,
} from "@/lib/adapters/resolution";
import {
  MIN_COHORT,
  aggregateCropYears,
  canViewMemberHistoryInsights,
  cohortCoverage,
  consentedFarmerIds,
  cropTrends,
  inputDemandPlan,
  procurementSignals,
  type MemberSeasonRow,
} from "@/lib/atap/fpoHistoryInsights";
import { buildSeasonBudget, planCandidates, planRisks } from "@/lib/atap/seasonPlanning";
import type { SeasonRecord, AreaCropView } from "@/lib/atap/farmHistory";

const officialRow = (crop: string, year: number) => ({
  state_name: "Andhra Pradesh",
  district: "Guntur",
  crop,
  crop_year: year,
  season_code: "kharif",
  typical_yield_quintal_per_acre: 20,
  typical_cost_per_acre: 24000,
  typical_price_per_quintal: 2100,
  adoption_share: 30,
  source: "state_agriculture_statistics",
});

describe("adapter resolution (B11)", () => {
  it("defaults to official_first and validates config values", () => {
    expect(resolveAdapterMode(null)).toBe("official_first");
    expect(resolveAdapterMode("SYNTHETIC_ONLY")).toBe("synthetic_only");
    expect(resolveAdapterMode("nonsense")).toBe("official_first");
  });

  it("treats synthetic sources as non-official", () => {
    expect(isOfficialSource("state_agriculture_statistics")).toBe(true);
    expect(isOfficialSource("synthetic_baseline")).toBe(false);
    expect(isOfficialSource(null)).toBe(false);
  });

  it("prefers official rows and marks provenance non-synthetic", () => {
    const res = resolveAreaCropBaselineAdapter({
      officialRows: [officialRow("Paddy", 2024), officialRow("Paddy", 2025)],
    });
    expect(res.provenance.synthetic).toBe(false);
    expect(res.provenance.officialRows).toBe(2);
  });

  it("declares the synthetic fallback when no official rows exist", () => {
    const res = resolveAreaCropBaselineAdapter({ officialRows: [] });
    expect(res.provenance.synthetic).toBe(true);
    expect(res.provenance.sources).toContain("synthetic_baseline");
    const ins = resolveFarmerInsuranceIndicatorAdapter({ officialRows: [] });
    expect(ins.provenance.synthetic).toBe(true);
  });

  it("never returns synthetic figures in synthetic_only-forbidden official_only mode", () => {
    const res = resolveAreaCropBaselineAdapter({
      officialRows: [officialRow("Cotton", 2025)],
      mode: "official_only",
    });
    expect(res.provenance.synthetic).toBe(false);
  });
});

const memberRow = (
  farmer: string,
  crop: string,
  year: number,
  over: Partial<MemberSeasonRow> = {},
): MemberSeasonRow => ({
  farmer_user_id: farmer,
  crop_year: year,
  season_code: "kharif",
  crop,
  area_acres: 2,
  input_cost_total: 40000,
  yield_quintal: 40,
  revenue_inr: 80000,
  ...over,
});

describe("FPO member history insights (B11)", () => {
  it("only counts active, purpose-scoped, unexpired consents", () => {
    const ids = consentedFarmerIds([
      { farmer_user_id: "a", purpose_code: "fpo_member_management", revoked_at: null, expires_at: null },
      {
        farmer_user_id: "b",
        purpose_code: "fpo_member_management",
        revoked_at: "2025-01-01T00:00:00Z",
        expires_at: null,
      },
      {
        farmer_user_id: "c",
        purpose_code: "fpo_member_management",
        revoked_at: null,
        expires_at: "2000-01-01T00:00:00Z",
      },
      { farmer_user_id: "d", purpose_code: "marketing", revoked_at: null, expires_at: null },
    ]);
    expect(ids).toEqual(["a"]);
  });

  it("suppresses cohorts below the minimum member count", () => {
    const rows = Array.from({ length: MIN_COHORT - 1 }, (_, i) =>
      memberRow(`f${i}`, "Paddy", 2025),
    );
    const [agg] = aggregateCropYears(rows);
    expect(agg?.suppressed).toBe(true);
    expect(agg?.avgYieldPerAcre).toBeNull();
  });

  it("publishes aggregates once the cohort is large enough", () => {
    const rows = Array.from({ length: MIN_COHORT }, (_, i) => memberRow(`f${i}`, "Paddy", 2025));
    const [agg] = aggregateCropYears(rows);
    expect(agg?.suppressed).toBe(false);
    expect(agg?.members).toBe(MIN_COHORT);
    expect(agg?.avgYieldPerAcre).toBe(20);
  });

  it("derives trends and projects input demand with a staff-supplied growth assumption", () => {
    const rows = [
      ...Array.from({ length: MIN_COHORT }, (_, i) =>
        memberRow(`f${i}`, "Paddy", 2024, { yield_quintal: 30 }),
      ),
      ...Array.from({ length: MIN_COHORT }, (_, i) =>
        memberRow(`f${i}`, "Paddy", 2025, { yield_quintal: 44 }),
      ),
    ];
    const aggregates = aggregateCropYears(rows);
    const trends = cropTrends(aggregates);
    expect(trends[0]?.trend).toBe("improving");

    const demand = inputDemandPlan(aggregates, { growthPct: 10 });
    expect(demand[0]?.projectedAcres).toBeCloseTo(2 * MIN_COHORT * 1.1, 2);
    expect(demand[0]?.basis).toBe("member_history");
  });

  it("flags yield support when the cohort trails the district reference", () => {
    const rows = Array.from({ length: MIN_COHORT }, (_, i) =>
      memberRow(`f${i}`, "Paddy", 2025, { yield_quintal: 20 }),
    );
    const trends = cropTrends(aggregateCropYears(rows));
    const signals = procurementSignals(trends, [
      { crop: "Paddy", avgYieldPerAcre: 20, avgPricePerQuintal: 2100 },
    ]);
    expect(signals[0]?.signal).toBe("yield_support_needed");
  });

  it("restricts the view to roles with roster authority", () => {
    expect(canViewMemberHistoryInsights(["tenant_admin"])).toBe(true);
    expect(canViewMemberHistoryInsights(["farmer"])).toBe(false);
  });

  it("reports coverage honestly when nothing can be shown", () => {
    const coverage = cohortCoverage({
      members: 12,
      consentedMembers: 0,
      contributingMembers: 0,
      aggregates: [],
    });
    expect(coverage.coveragePct).toBe(0);
    expect(coverage.message).toContain("no aggregate");
  });
});

const season = (crop: string, year: number, over: Partial<SeasonRecord> = {}): SeasonRecord =>
  ({
    id: `${crop}-${year}`,
    crop_year: year,
    season_code: "kharif",
    crop,
    area_acres: 2,
    input_costs: { seed: 4000, fertiliser: 9000, labour: 11000 },
    input_cost_total: 24000,
    yield_quintal: 42,
    price_per_quintal: 2100,
    revenue_inr: 88200,
    notes: null,
    ...over,
  }) as SeasonRecord;

const areaView = (crop: string, over: Partial<AreaCropView> = {}): AreaCropView =>
  ({
    crop,
    years: 5,
    avgYieldPerAcre: 20,
    avgCostPerAcre: 24000,
    avgPricePerQuintal: 2100,
    yieldBand: [16, 24],
    priceBand: [1900, 2300],
    indicativeNetPerAcre: 18000,
    adoptionShare: 35,
    ...over,
  }) as AreaCropView;

describe("season planning (B11)", () => {
  it("ranks a crop the farmer has grown above an area-only crop", () => {
    const candidates = planCandidates({
      history: [season("Paddy", 2024), season("Paddy", 2025)],
      areaCrops: [areaView("Paddy"), areaView("Maize", { adoptionShare: 5 })],
    });
    expect(candidates[0]?.crop).toBe("Paddy");
    expect(candidates[0]?.confidence).not.toBe("area_only");
    expect(candidates.find((c) => c.crop === "Maize")?.confidence).toBe("area_only");
  });

  it("builds a budget from the farmer's own cost shares when available", () => {
    const candidates = planCandidates({
      history: [season("Paddy", 2025)],
      areaCrops: [areaView("Paddy")],
    });
    const budget = buildSeasonBudget({
      crop: "Paddy",
      acres: 4,
      history: [season("Paddy", 2025)],
      candidate: candidates[0]!,
    });
    expect(budget.basis).toBe("own_history");
    expect(budget.totalCost).toBeGreaterThan(0);
    expect(budget.lines.reduce((s, l) => s + l.total, 0)).toBeCloseTo(budget.totalCost, 0);
  });

  it("warns about missing cover and no own history", () => {
    const candidates = planCandidates({ history: [], areaCrops: [areaView("Maize")] });
    const budget = buildSeasonBudget({
      crop: "Maize",
      acres: 2,
      history: [],
      candidate: candidates[0]!,
    });
    const risks = planRisks({
      candidate: candidates[0]!,
      budget,
      areaView: areaView("Maize"),
      insuranceCovered: false,
    });
    const codes = risks.map((r) => r.code);
    expect(codes).toContain("no_own_history");
    expect(codes).toContain("no_cover");
  });

  it("raises a high severity risk when the downside does not cover input cost", () => {
    const candidates = planCandidates({
      history: [],
      areaCrops: [areaView("Chilli", { avgCostPerAcre: 90000 })],
    });
    const budget = buildSeasonBudget({
      crop: "Chilli",
      acres: 2,
      history: [],
      candidate: candidates[0]!,
    });
    const risks = planRisks({
      candidate: candidates[0]!,
      budget,
      areaView: areaView("Chilli", { yieldBand: [2, 24], priceBand: [800, 2300] }),
      insuranceCovered: true,
    });
    expect(risks.some((r) => r.severity === "high")).toBe(true);
  });
});
