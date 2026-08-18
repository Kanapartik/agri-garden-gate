import { describe, expect, it } from "vitest";
import {
  PRICE_LABEL_TEXT,
  classifySoil,
  confidenceLabel,
  evaluateValueAdd,
  freshnessLabel,
  haversineKm,
  labeledMoney,
  nearestFacilities,
  outcomeScenarios,
  rankCrops,
  resolveSeason,
  scoreCrop,
  type FacilityLike,
  type ProcessingStepAssumption,
} from "./intelligence";
import { farmIntelligenceAdapters } from "@/lib/adapters/farmIntelligence";

const observed = labeledMoney({
  amount: 2200,
  currency: "INR",
  unit: "quintal",
  label: "observed",
  sourceKey: "synthetic:enam:guntur",
  asOf: "2026-08-01",
});

describe("price labelling", () => {
  it("keeps observed, forecast and derived scenario labels distinct", () => {
    expect(PRICE_LABEL_TEXT.observed).not.toBe(PRICE_LABEL_TEXT.forecast);
    expect(PRICE_LABEL_TEXT.forecast).not.toBe(PRICE_LABEL_TEXT.derived_scenario);
  });

  it("refuses an unlabelled, undated or unsourced money value", () => {
    expect(() =>
      labeledMoney({ amount: 100, currency: "INR", unit: "quintal", label: "observed", sourceKey: "s", asOf: null }),
    ).toThrow(/as_of/);
    expect(() =>
      labeledMoney({ amount: 100, currency: "INR", unit: "quintal", label: "observed", sourceKey: "", asOf: "2026-01-01" }),
    ).toThrow(/source/);
  });

  it("requires an uncertainty range on a forecast and assumptions on a derived scenario", () => {
    expect(() =>
      labeledMoney({ amount: 100, currency: "INR", unit: "quintal", label: "forecast", sourceKey: "s", asOf: null }),
    ).toThrow(/range/);
    expect(() =>
      labeledMoney({
        amount: 100,
        currency: "INR",
        unit: "quintal",
        label: "derived_scenario",
        sourceKey: "s",
        asOf: null,
      }),
    ).toThrow(/assumptions/);
  });
});

describe("location and season basis", () => {
  it("measures distance between two AP/TS points sensibly", () => {
    const km = haversineKm({ lat: 16.3067, lng: 80.4365 }, { lat: 17.385, lng: 78.4867 });
    expect(km).toBeGreaterThan(200);
    expect(km).toBeLessThan(300);
  });

  it("ranks nearby facilities by distance and can filter by kind", () => {
    const facilities: FacilityLike[] = [
      { id: "a", kind: "fpo", name: "Guntur FPO", district_name: "Guntur", state_name: "Andhra Pradesh", latitude: 16.31, longitude: 80.44, source_key: "syn" },
      { id: "b", kind: "soil_lab", name: "Soil lab", district_name: "Guntur", state_name: "Andhra Pradesh", latitude: 16.5, longitude: 80.6, source_key: "syn" },
      { id: "c", kind: "fpo", name: "Warangal FPO", district_name: "Warangal", state_name: "Telangana", latitude: 17.98, longitude: 79.6, source_key: "syn" },
    ];
    const ranked = nearestFacilities({ lat: 16.3, lng: 80.45 }, facilities, { kinds: ["fpo"], limit: 5 });
    expect(ranked.map((f) => f.id)).toEqual(["a", "c"]);
    expect(ranked[0]!.distanceKm).toBeLessThan(ranked[1]!.distanceKm);
  });

  it("resolves a season with a sowing and harvest window", () => {
    const season = resolveSeason(new Date("2026-07-15T00:00:00Z"));
    expect(season.code).toBe("kharif");
    expect(season.sowingWindow.length).toBeGreaterThan(0);
    expect(season.harvestWindow.length).toBeGreaterThan(0);
  });
});

describe("soil basis separation", () => {
  const general = {
    majorSoils: ["Black cotton", "Red loamy"],
    texture: "Clayey",
    phRange: "7.5-8.3",
    organicCarbonRange: "0.5-0.75%",
    sourceKey: "syn:district",
    observedAt: "2026-08-01T00:00:00.000Z",
  };

  it("labels location-inferred soil as not farm-specific", () => {
    const soil = classifySoil(general, null);
    expect(soil.basis).toBe("inferred_from_location");
    expect(soil.lab).toBeNull();
    expect(soil.basisNote).toMatch(/general soil information/i);
  });

  it("labels an actual lab result and keeps general context separate", () => {
    const soil = classifySoil(general, {
      cardRef: "SHC-SYN-001",
      labName: "Guntur Soil Testing Lab",
      labKind: "state_soil_lab",
      testedOn: "2026-05-04",
      ph: 7.8,
      organicCarbonPct: 0.62,
      nitrogen: "Medium",
      phosphorus: "Low",
      potassium: "High",
      sourceKey: "syn:shc",
    });
    expect(soil.basis).toBe("lab_tested");
    expect(soil.general).toEqual(general);
    expect(soil.basisNote).toMatch(/laboratory result/i);
  });
});

describe("crop recommendations are explainable", () => {
  const candidate = {
    crop: "Paddy",
    variety: "BPT 5204",
    season: "kharif" as const,
    sowingWindow: "June - July",
    soilFit: 0.8,
    rainfallOutlook: 0.7,
    irrigationFit: 0.8,
    sowingWindowFit: 0.9,
    historicPerformance: 0.7,
    localPriceStrength: 0.6,
    valueAddOpportunity: 0.8,
    sources: ["syn:district", "syn:imd"],
    changeFactors: ["A lab soil test", "A revised rainfall forecast"],
  };

  it("returns a factor breakdown, sources and what would change the answer", () => {
    const rec = scoreCrop(candidate, { soilBasis: "lab_tested", freshnessSeconds: 1800 });
    expect(rec.score).toBeGreaterThan(0);
    expect(rec.score).toBeLessThanOrEqual(100);
    expect(rec.factors.length).toBeGreaterThanOrEqual(7);
    expect(rec.sources.length).toBeGreaterThan(0);
    expect(rec.changeFactors.length).toBeGreaterThan(0);
    expect(rec.explanation.length).toBeGreaterThan(0);
  });

  it("reports lower confidence when the soil basis is only inferred", () => {
    const tested = scoreCrop(candidate, { soilBasis: "lab_tested", freshnessSeconds: 1800 });
    const inferred = scoreCrop(candidate, { soilBasis: "inferred_from_location", freshnessSeconds: 1800 });
    expect(inferred.confidence).toBeLessThan(tested.confidence);
  });

  it("rejects a candidate with no sources or no change factors", () => {
    expect(() => scoreCrop({ ...candidate, sources: [] }, { soilBasis: "lab_tested" })).toThrow();
    expect(() => scoreCrop({ ...candidate, changeFactors: [] }, { soilBasis: "lab_tested" })).toThrow();
  });

  it("ranks higher-scoring crops first", () => {
    const a = scoreCrop(candidate, { soilBasis: "lab_tested" });
    const b = scoreCrop({ ...candidate, crop: "Maize", soilFit: 0.3, historicPerformance: 0.3 }, { soilBasis: "lab_tested" });
    expect(rankCrops([b, a])[0]!.crop).toBe("Paddy");
  });
});

describe("value-add economics", () => {
  const steps: ProcessingStepAssumption[] = [
    {
      step_order: 1,
      from_product: "Paddy",
      to_product: "Rice (polished)",
      recovery_pct: 65,
      byproducts: [
        { name: "Bran", yield_pct: 8, price_per_quintal: 1800 },
        { name: "Husk", yield_pct: 20, price_per_quintal: 300 },
      ],
      cost_per_quintal: 180,
      cost_breakdown: { milling: 120, labour: 60 },
      assumption_note: "Platform default milling assumption",
    },
  ];

  const ricePrice = labeledMoney({
    amount: 4100,
    currency: "INR",
    unit: "quintal",
    label: "observed",
    sourceKey: "synthetic:enam:rice",
    asOf: "2026-08-01",
  });

  it("uses configured recovery percentages rather than hard-coded conversions", () => {
    const base = evaluateValueAdd({
      commodity: "Paddy",
      inputQuintal: 100,
      steps,
      rawPrice: observed,
      processedPrice: ricePrice,
      assumptionSource: "platform_default",
    });
    const higher = evaluateValueAdd({
      commodity: "Paddy",
      inputQuintal: 100,
      steps: [{ ...steps[0]!, recovery_pct: 70 }],
      rawPrice: observed,
      processedPrice: ricePrice,
      assumptionSource: "processor_override",
    });
    expect(base.finalOutputQuintal).toBe(65);
    expect(higher.finalOutputQuintal).toBe(70);
    expect(higher.estimatedRealization.amount).not.toBe(base.estimatedRealization.amount);
  });

  it("labels every processed realization as a derived scenario with visible assumptions", () => {
    const result = evaluateValueAdd({
      commodity: "Paddy",
      inputQuintal: 50,
      steps,
      rawPrice: observed,
      processedPrice: ricePrice,
      packagingPerQuintal: 40,
      transportPerQuintal: 25,
      assumptionSource: "platform_default",
    });
    expect(result.estimatedRealization.label).toBe("derived_scenario");
    expect(Object.keys(result.estimatedRealization.assumptions ?? {}).length).toBeGreaterThan(0);
    // The lot-level raw comparison is itself derived from an observed unit price.
    expect(result.rawRealization.label).toBe("derived_scenario");
    expect(result.rawPrice.label).toBe("observed");
    expect(result.processedObservedPrice?.label).toBe("observed");
    expect(result.totalByproductValue).toBeGreaterThan(0);
    expect(result.totalProcessingCost).toBeGreaterThan(0);
  });

  it("rejects an empty path or a non-positive quantity", () => {
    expect(() =>
      evaluateValueAdd({ commodity: "Paddy", inputQuintal: 10, steps: [], rawPrice: observed, assumptionSource: "x" }),
    ).toThrow();
    expect(() =>
      evaluateValueAdd({ commodity: "Paddy", inputQuintal: 0, steps, rawPrice: observed, assumptionSource: "x" }),
    ).toThrow();
  });
});

describe("outcome planner", () => {
  const scenarios = outcomeScenarios({
    crop: "Paddy",
    season: "kharif",
    areaAcres: 2,
    baseYieldPerAcre: 22,
    basePrice: observed,
    baseCostPerAcre: 28000,
    harvestWindow: "October - November",
    targetMarket: "Guntur mandi",
    valueAddAlternative: "Paddy to polished rice",
    risks: ["Rainfall deviation"],
  });

  it("produces low, base and high bands with break-even values", () => {
    expect(scenarios.map((s) => s.scenario)).toEqual(["low", "base", "high"]);
    for (const s of scenarios) {
      expect(s.breakEvenPrice).toBeGreaterThan(0);
      expect(s.breakEvenYield).toBeGreaterThan(0);
      expect(s.risks.length).toBeGreaterThan(0);
      expect(Object.keys(s.assumptions).length).toBeGreaterThan(0);
    }
  });

  it("keeps the source price label on the selling price and marks the output derived", () => {
    for (const s of scenarios) {
      expect(s.sellingPriceLabel).toBe("observed");
      expect(s.label).toBe("derived_scenario");
    }
  });

  it("orders net contribution low < base < high", () => {
    expect(scenarios[0]!.netContribution).toBeLessThan(scenarios[1]!.netContribution);
    expect(scenarios[1]!.netContribution).toBeLessThan(scenarios[2]!.netContribution);
  });

  it("rejects a non-positive area", () => {
    expect(() =>
      outcomeScenarios({
        crop: "Paddy",
        season: "kharif",
        areaAcres: 0,
        baseYieldPerAcre: 20,
        basePrice: observed,
        baseCostPerAcre: 1000,
        harvestWindow: "x",
        targetMarket: "y",
        valueAddAlternative: "z",
        risks: [],
      }),
    ).toThrow();
  });
});

describe("data provenance and adapters", () => {
  it("marks every farm-intelligence adapter reading synthetic with source and freshness", async () => {
    const weather = await farmIntelligenceAdapters.agromet.read({
      point: { lat: 16.3, lng: 80.45 },
      districtName: "Guntur",
      blockName: null,
    });
    expect(weather.envelope.synthetic).toBe(true);
    expect(weather.envelope.sourceKey).toContain("synthetic");
    expect(weather.envelope.freshnessSeconds).toBeGreaterThanOrEqual(0);

    const soil = await farmIntelligenceAdapters.soilHealth.read({ plotRef: "SYN-PLOT-1", districtName: "Guntur" });
    expect(soil.envelope.synthetic).toBe(true);

    const profile = await farmIntelligenceAdapters.districtProfile.read({
      districtName: "Guntur",
      stateName: "Andhra Pradesh",
    });
    expect(profile.majorCrops.length).toBeGreaterThan(0);
    expect(profile.envelope.synthetic).toBe(true);
  });

  it("describes freshness and confidence in plain language", () => {
    expect(freshnessLabel(120)).toMatch(/min old/);
    expect(freshnessLabel(7200)).toMatch(/h old/);
    expect(freshnessLabel(null)).toMatch(/unknown/);
    expect(confidenceLabel(0.9)).toMatch(/high/);
    expect(confidenceLabel(0.2)).toMatch(/low/);
  });
});
