import { describe, expect, it } from "vitest";
import {
  areaCropViews,
  buildInsuranceCorner,
  classifyScale,
  farmerPremiumShare,
  historyReadiness,
  ownVsArea,
  seasonEconomics,
  summariseHistory,
  totalCost,
  type AreaBenchmark,
  type SeasonRecord,
} from "@/lib/atap/farmHistory";

function season(over: Partial<SeasonRecord> = {}): SeasonRecord {
  const input_costs = over.input_costs ?? { seed: 2000, fertiliser: 6000, labour: 8000 };
  return {
    id: over.id ?? "s1",
    farm_id: null,
    crop_year: 2025,
    season_code: "kharif",
    crop: "Paddy",
    area_acres: 4,
    yield_quintal: 100,
    price_per_quintal: 2200,
    revenue_inr: null,
    notes: null,
    ...over,
    input_costs,
    input_cost_total: over.input_cost_total ?? totalCost(input_costs),
  };
}

describe("cost and season economics", () => {
  it("sums only positive cost heads", () => {
    expect(totalCost({ seed: 1000, labour: 500 })).toBe(1500);
    expect(totalCost({})).toBe(0);
  });

  it("derives revenue from yield x price when revenue is absent", () => {
    const eco = seasonEconomics(season());
    expect(eco.revenue).toBe(220000);
    expect(eco.cost).toBe(16000);
    expect(eco.netMargin).toBe(204000);
    expect(eco.netPerAcre).toBe(51000);
    expect(eco.yieldPerAcre).toBe(25);
  });

  it("prefers an explicitly recorded revenue figure", () => {
    const eco = seasonEconomics(season({ revenue_inr: 180000 }));
    expect(eco.revenue).toBe(180000);
  });

  it("returns null per-acre values without area", () => {
    const eco = seasonEconomics(season({ area_acres: 0 }));
    expect(eco.netPerAcre).toBeNull();
    expect(eco.yieldPerAcre).toBeNull();
  });
});

describe("scale classification", () => {
  it("classifies small holdings as single-view", () => {
    const small = classifyScale(2.5);
    expect(small.scale).toBe("small");
    expect(small.showParcelBreakdown).toBe(false);
  });

  it("classifies medium and large holdings with parcel breakdowns", () => {
    expect(classifyScale(5).scale).toBe("medium");
    expect(classifyScale(25).scale).toBe("medium");
    expect(classifyScale(60).scale).toBe("large");
    expect(classifyScale(60).showParcelBreakdown).toBe(true);
  });

  it("treats missing extent as a small holding", () => {
    expect(classifyScale(null).scale).toBe("small");
  });
});

describe("five-year summary", () => {
  const records = [
    season({ id: "a", crop_year: 2023, yield_quintal: 80 }),
    season({ id: "b", crop_year: 2024, yield_quintal: 90 }),
    season({ id: "c", crop_year: 2025, yield_quintal: 110 }),
    season({ id: "d", crop_year: 2025, crop: "Cotton", season_code: "rabi", yield_quintal: 40 }),
  ];

  it("rolls seasons up by year and lists crops", () => {
    const summary = summariseHistory(records);
    expect(summary.yearsCovered).toBe(3);
    expect(summary.seasonsRecorded).toBe(4);
    const y2025 = summary.years.find((y) => y.crop_year === 2025);
    expect(y2025?.crops.sort()).toEqual(["Cotton", "Paddy"]);
    expect(summary.cropsGrown.sort()).toEqual(["Cotton", "Paddy"]);
  });

  it("ranks years by net income per acre, not total income", () => {
    const summary = summariseHistory(records);
    // 2025 has the highest total but two seasons over 8 acres, so per-acre it
    // falls behind the single high-yield 2024 season.
    expect(summary.bestYear?.crop_year).toBe(2024);
    expect(summary.worstYear?.crop_year).toBe(2025);
    // Trend follows the same per-acre basis, so the extra 2025 season keeps it flat.
    expect(summary.trend).toBe("flat");
  });

  it("reports insufficient data with one year only", () => {
    expect(summariseHistory([season()]).trend).toBe("insufficient_data");
  });

  it("handles an empty history", () => {
    const summary = summariseHistory([]);
    expect(summary.yearsCovered).toBe(0);
    expect(summary.avgNetPerAcre).toBeNull();
    expect(summary.bestYear).toBeNull();
  });
});

describe("area benchmarks", () => {
  function benchmark(over: Partial<AreaBenchmark> = {}): AreaBenchmark {
    return {
      state_name: "Telangana",
      district: "Warangal",
      crop: "Paddy",
      crop_year: 2025,
      season_code: "kharif",
      typical_yield_quintal_per_acre: 24,
      yield_low_quintal_per_acre: 18,
      yield_high_quintal_per_acre: 30,
      typical_cost_per_acre: 22000,
      typical_price_per_quintal: 2100,
      price_low_per_quintal: 1900,
      price_high_per_quintal: 2400,
      adoption_share: 40,
      source: "synthetic_baseline",
      ...over,
    };
  }

  it("collapses multiple years into one row per crop with bands", () => {
    const views = areaCropViews([
      benchmark({ crop_year: 2024, typical_yield_quintal_per_acre: 20, yield_low_quintal_per_acre: 16 }),
      benchmark(),
      benchmark({ crop: "Cotton", adoption_share: 55 }),
    ]);
    expect(views).toHaveLength(2);
    expect(views[0]?.crop).toBe("Cotton");
    const paddy = views.find((v) => v.crop === "Paddy");
    expect(paddy?.years).toBe(2);
    expect(paddy?.avgYieldPerAcre).toBe(22);
    expect(paddy?.yieldBand).toEqual([16, 30]);
    expect(paddy?.indicativeNetPerAcre).toBe(22 * 2100 - 22000);
  });

  it("compares own performance against area typicals", () => {
    const views = areaCropViews([benchmark()]);
    const rows = ownVsArea([season({ yield_quintal: 100, area_acres: 4 })], views);
    expect(rows[0]?.ownYieldPerAcre).toBe(25);
    expect(rows[0]?.verdict).toBe("near_area");
  });

  it("flags crops the farmer has no history for", () => {
    const views = areaCropViews([benchmark({ crop: "Turmeric" })]);
    const rows = ownVsArea([], views);
    expect(rows[0]?.verdict).toBe("no_own_data");
    expect(rows[0]?.ownYieldPerAcre).toBeNull();
  });
});

describe("insurance corner", () => {
  it("caps the farmer share at the actuarial premium", () => {
    expect(
      farmerPremiumShare({ sumInsuredPerAcre: 40000, actuarialPremiumPerAcre: 1500, farmerSharePct: 2 }),
    ).toBe(800);
    expect(
      farmerPremiumShare({ sumInsuredPerAcre: 40000, actuarialPremiumPerAcre: 500, farmerSharePct: 2 }),
    ).toBe(500);
  });

  it("scales indicative amounts by area and stays advisory", () => {
    const corner = buildInsuranceCorner({
      seasonCode: "kharif",
      cropYear: 2025,
      crop: "Paddy",
      district: "Warangal",
      acres: 4,
      coverState: "not_covered",
      indicativePremiumPerAcre: 1450,
      sumInsuredPerAcre: 40000,
      farmerSharePerAcre: 800,
      contactLabel: "District insurance help desk",
      source: "synthetic_baseline",
    });
    expect(corner.estimatedSumInsured).toBe(160000);
    expect(corner.estimatedFarmerShare).toBe(3200);
    expect(corner.advisory).toBe(true);
  });

  it("returns null totals when extent is unknown", () => {
    const corner = buildInsuranceCorner({
      seasonCode: "rabi",
      cropYear: 2025,
      crop: null,
      district: null,
      acres: null,
      coverState: "unknown",
      indicativePremiumPerAcre: null,
      sumInsuredPerAcre: 40000,
      farmerSharePerAcre: 800,
      contactLabel: null,
      source: "synthetic_baseline",
    });
    expect(corner.estimatedFarmerShare).toBeNull();
    expect(corner.estimatedSumInsured).toBeNull();
  });
});

describe("history readiness", () => {
  it("scores the last five years and lists the gaps", () => {
    const ready = historyReadiness(
      [season({ crop_year: 2025 }), season({ id: "x", crop_year: 2024 })],
      2025,
    );
    expect(ready.score).toBe(40);
    expect(ready.yearsMissing).toEqual([2023, 2022, 2021]);
  });

  it("is complete when every year is present", () => {
    const records = [2025, 2024, 2023, 2022, 2021].map((y) =>
      season({ id: `y${y}`, crop_year: y }),
    );
    const ready = historyReadiness(records, 2025);
    expect(ready.score).toBe(100);
    expect(ready.yearsMissing).toEqual([]);
  });
});
