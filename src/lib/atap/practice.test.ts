import { describe, expect, it } from "vitest";
import {
  buildNutrientPlan,
  buildSoilCarePlan,
  compareModes,
  filterSoilPractices,
  matchInfestations,
  matchSellerListings,
  moduleProgress,
  scaleDose,
  sortLessons,
  stageRank,
  treatmentOptions,
  type InputProduct,
  type Infestation,
  type NutrientRecommendation,
  type SoilPractice,
  type Treatment,
} from "@/lib/atap/practice";
import {
  DEFAULT_LOCALE,
  indexTranslations,
  localizedField,
  normalizeLocale,
  translate,
} from "@/lib/i18n";

const urea: InputProduct = {
  code: "UREA",
  genericName: "Urea",
  kind: "fertilizer",
  category: "conventional",
  nutrientOrActive: "Nitrogen",
  unit: "kg",
  costMinMinor: 600,
  costMaxMinor: 800,
  currency: "INR",
  brandNames: ["IFFCO Urea", "Kribhco Urea"],
  preparationNotes: null,
};

const vermicompost: InputProduct = {
  code: "VERMI",
  genericName: "Vermicompost",
  kind: "bio_fertilizer",
  category: "organic",
  nutrientOrActive: "Nitrogen",
  unit: "kg",
  costMinMinor: 900,
  costMaxMinor: 1400,
  currency: "INR",
  brandNames: [],
  preparationNotes: "Apply 10 days before sowing.",
};

const neem: InputProduct = {
  code: "NEEM",
  genericName: "Azadirachtin 1500 ppm",
  kind: "bio_pesticide",
  category: "organic",
  nutrientOrActive: "Azadirachtin",
  unit: "litre",
  costMinMinor: 40000,
  costMaxMinor: 55000,
  currency: "INR",
  brandNames: ["Nimbecidine"],
  preparationNotes: null,
};

const chem: InputProduct = {
  code: "EMA",
  genericName: "Emamectin benzoate 5% SG",
  kind: "pesticide",
  category: "conventional",
  nutrientOrActive: "Emamectin benzoate",
  unit: "gram",
  costMinMinor: 300,
  costMaxMinor: 400,
  currency: "INR",
  brandNames: ["Proclaim"],
  preparationNotes: null,
};

const recs: NutrientRecommendation[] = [
  {
    crop: "Paddy",
    growthStage: "basal",
    soilType: null,
    nutrient: "Nitrogen",
    productCode: "UREA",
    dosePerHectare: 60,
    unit: "kg",
    notes: null,
  },
  {
    crop: "Paddy",
    growthStage: "basal",
    soilType: null,
    nutrient: "Nitrogen",
    productCode: "VERMI",
    dosePerHectare: 500,
    unit: "kg",
    notes: null,
  },
  {
    crop: "Chilli",
    growthStage: "basal",
    soilType: null,
    nutrient: "Nitrogen",
    productCode: "UREA",
    dosePerHectare: 80,
    unit: "kg",
    notes: null,
  },
];

describe("training modules", () => {
  it("orders stages by journey, not row order", () => {
    expect(stageRank("land_prep_sowing")).toBeLessThan(stageRank("value_creation"));
    expect(stageRank("unknown_stage")).toBe(5);
  });

  it("counts progress and ignores unknown or duplicate lesson keys", () => {
    const lessons = [
      { lessonKey: "a", sortOrder: 1 },
      { lessonKey: "b", sortOrder: 2 },
    ];
    const p = moduleProgress(lessons, ["a", "a", "zzz"]);
    expect(p).toMatchObject({ total: 2, completed: 1, complete: false });
    expect(p.ratio).toBeCloseTo(0.5);
    expect(moduleProgress(lessons, ["a", "b"]).complete).toBe(true);
  });

  it("sorts lessons deterministically on ties", () => {
    const sorted = sortLessons([
      { lessonKey: "b", sortOrder: 1 },
      { lessonKey: "a", sortOrder: 1 },
    ]);
    expect(sorted.map((l) => l.lessonKey)).toEqual(["a", "b"]);
  });
});

describe("nutrient plan", () => {
  it("scales doses on area and rejects non-positive area", () => {
    expect(scaleDose(60, 1.5)).toBe(90);
    expect(scaleDose(33.333, 1)).toBe(33.33);
    expect(() => scaleDose(60, 0)).toThrow("area_must_be_positive");
  });

  it("keeps conventional and organic modes separate", () => {
    const conv = buildNutrientPlan({
      crop: "Paddy",
      growthStage: "basal",
      mode: "conventional",
      areaHectares: 1,
      recommendations: recs,
      products: [urea, vermicompost],
    });
    expect(conv.lines).toHaveLength(1);
    expect(conv.lines[0]!.product.code).toBe("UREA");
    expect(conv.lines[0]!.quantity).toBe(60);

    const org = buildNutrientPlan({
      crop: "Paddy",
      growthStage: "basal",
      mode: "organic",
      areaHectares: 1,
      recommendations: recs,
      products: [urea, vermicompost],
    });
    expect(org.lines.map((l) => l.product.code)).toEqual(["VERMI"]);
  });

  it("labels every plan cost as a derived scenario with visible assumptions", () => {
    const plan = buildNutrientPlan({
      crop: "Paddy",
      growthStage: "basal",
      mode: "conventional",
      areaHectares: 2,
      recommendations: recs,
      products: [urea],
    });
    expect(plan.estimatedCost.label).toBe("derived_scenario");
    expect(plan.estimatedCost.assumptions).toBeTruthy();
    expect(plan.costMinMinor).toBe(600 * 120);
    expect(plan.costMaxMinor).toBe(800 * 120);
    expect(plan.advisoryNote).toMatch(/KVK/);
  });

  it("compares modes and names the cheaper one", () => {
    const args = { crop: "Paddy", growthStage: "basal", areaHectares: 1, recommendations: recs };
    const conv = buildNutrientPlan({ ...args, mode: "conventional", products: [urea] });
    const org = buildNutrientPlan({ ...args, mode: "organic", products: [vermicompost] });
    const cmp = compareModes(conv, org);
    expect(cmp.cheaperMode).toBe("conventional");
    expect(cmp.difference.label).toBe("derived_scenario");
    expect(cmp.differenceMinor).toBeGreaterThan(0);
  });
});

describe("infestations", () => {
  const infestations: Infestation[] = [
    {
      id: "i1",
      code: "CHILLI_THRIPS",
      crop: "Chilli",
      kind: "pest",
      name: "Chilli thrips",
      symptoms: ["upward leaf curl", "silvering"],
      severity: "high",
    },
    {
      id: "i2",
      code: "PADDY_BLAST",
      crop: "Paddy",
      kind: "disease",
      name: "Paddy blast",
      symptoms: ["diamond shaped lesions"],
      severity: "moderate",
    },
  ];

  it("filters by crop, kind and symptom text", () => {
    expect(matchInfestations(infestations, { crop: "Chilli" })).toHaveLength(1);
    expect(matchInfestations(infestations, { kind: "disease" })[0]!.code).toBe("PADDY_BLAST");
    expect(matchInfestations(infestations, { query: "silvering" })[0]!.id).toBe("i1");
  });

  const treatments: Treatment[] = [
    {
      infestationId: "i1",
      productCode: "NEEM",
      dosePerHectare: 2,
      unit: "litre",
      safetyIntervalDays: 3,
      reentryNote: "After spray dries",
      isOrganic: true,
    },
    {
      infestationId: "i1",
      productCode: "EMA",
      dosePerHectare: 200,
      unit: "gram",
      safetyIntervalDays: 7,
      reentryNote: null,
      isOrganic: false,
    },
  ];

  it("returns only bio options in organic mode and puts bio first otherwise", () => {
    const organic = treatmentOptions({
      infestationId: "i1",
      treatments,
      products: [neem, chem],
      areaHectares: 1,
      mode: "organic",
    });
    expect(organic.map((o) => o.productCode)).toEqual(["NEEM"]);

    const conventional = treatmentOptions({
      infestationId: "i1",
      treatments,
      products: [neem, chem],
      areaHectares: 1,
      mode: "conventional",
    });
    expect(conventional.map((o) => o.productCode)).toEqual(["NEEM", "EMA"]);
  });

  it("never returns a protection option without a human-confirmation requirement", () => {
    const options = treatmentOptions({
      infestationId: "i1",
      treatments,
      products: [neem, chem],
      areaHectares: 2,
      mode: "conventional",
    });
    expect(options.length).toBeGreaterThan(0);
    for (const option of options) {
      expect(option.humanConfirmation).toMatch(/KVK|agronomist/);
      expect(option.safetyIntervalDays).toBeGreaterThan(0);
    }
    expect(options.find((o) => o.productCode === "EMA")!.quantity).toBe(400);
  });
});

describe("soil care", () => {
  const practices: SoilPractice[] = [
    {
      id: "p1",
      code: "GREEN_MANURE",
      name: "Green manure with sunhemp",
      soilTypes: ["black cotton"],
      body: "Sow sunhemp and incorporate at flowering.",
      effort: "moderate",
      expectedBenefit: "Adds organic carbon",
      costMinMinor: 150000,
      costMaxMinor: 250000,
      sortOrder: 1,
    },
    {
      id: "p2",
      code: "MULCHING",
      name: "Mulching",
      soilTypes: [],
      body: "Cover soil with crop residue.",
      effort: "low",
      expectedBenefit: "Retains moisture",
      costMinMinor: 50000,
      costMaxMinor: 90000,
      sortOrder: 2,
    },
    {
      id: "p3",
      code: "GYPSUM",
      name: "Gypsum application",
      soilTypes: ["saline"],
      body: "Apply gypsum as per lab result.",
      effort: "high",
      expectedBenefit: "Improves structure",
      costMinMinor: 100000,
      costMaxMinor: 180000,
      sortOrder: 3,
    },
  ];

  it("matches soil types tolerantly and keeps universal practices", () => {
    const matched = filterSoilPractices(practices, ["Black cotton soil"]);
    expect(matched.map((p) => p.code)).toEqual(["GREEN_MANURE", "MULCHING"]);
  });

  it("recommends a soil test when the basis is only inferred", () => {
    const inferred = buildSoilCarePlan({
      soilTypes: ["black cotton"],
      basis: "inferred_from_location",
      practices,
    });
    expect(inferred.recommendSoilTest).toBe(true);
    expect(inferred.basisNote).toMatch(/soil test/i);
    expect(inferred.estimatedCost.label).toBe("derived_scenario");

    const lab = buildSoilCarePlan({ soilTypes: ["saline"], basis: "lab_tested", practices });
    expect(lab.recommendSoilTest).toBe(false);
    expect(lab.practices.map((p) => p.code)).toEqual(["MULCHING", "GYPSUM"]);
  });
});

describe("seller matching neutrality", () => {
  it("ranks on quality and title, never on sponsorship", () => {
    const matched = matchSellerListings(
      [
        { id: "a", title: "Urea 45kg bag", category: "fertilizer", sellerName: "S1", qualityScore: 72, isSponsored: true },
        { id: "b", title: "Urea prilled 45kg", category: "fertilizer", sellerName: "S2", qualityScore: 91 },
        { id: "c", title: "Paddy seed", category: "seed", sellerName: "S3", qualityScore: 99 },
      ],
      urea,
    );
    expect(matched.map((m) => m.id)).toEqual(["b", "a"]);
  });
});

describe("multilingual layer", () => {
  it("falls back to English for a missing translation and to the key as a last resort", () => {
    expect(translate("te", "practices.title")).not.toBe("Farmer training");
    expect(translate("te", "practices.empty")).toBe(translate(DEFAULT_LOCALE, "practices.empty"));
    expect(translate("kn", "does.not.exist")).toBe("does.not.exist");
  });

  it("normalizes unknown locales to the default", () => {
    expect(normalizeLocale("fr")).toBe("en");
    expect(normalizeLocale("ta")).toBe("ta");
  });

  it("resolves content rows and falls back to the stored English value", () => {
    const index = indexTranslations([
      { entity: "practice_module", entity_id: "m1", locale: "te", field: "title", value: "విత్తనం" },
    ]);
    expect(localizedField(index, "practice_module", "m1", "title", "te", "Sowing")).toBe("విత్తనం");
    expect(localizedField(index, "practice_module", "m1", "title", "hi", "Sowing")).toBe("Sowing");
    expect(localizedField(index, "practice_module", "m1", "title", "en", "Sowing")).toBe("Sowing");
  });
});
