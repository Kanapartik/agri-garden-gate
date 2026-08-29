/**
 * Adapter seams for the farmer history & command centre slice (B10).
 *
 * Development/sandbox implementations are deterministic and synthetic. Official
 * state agriculture statistics (yield/cost/price), PMFBY notified sum-insured
 * tables and real drone/custom-hiring directories plug in behind the same
 * interfaces without touching callers — [VALIDATE data source].
 */

export interface AreaCropBaseline {
  stateName: string;
  district: string;
  crop: string;
  cropYear: number;
  seasonCode: string;
  typicalYieldPerAcre: number;
  typicalCostPerAcre: number;
  typicalPricePerQuintal: number;
  adoptionShare: number;
  source: string;
  synthetic: boolean;
}

export interface AreaCropBaselineAdapter {
  readonly name: string;
  readonly crops: readonly string[];
  baseline(input: {
    stateName: string;
    district: string;
    crop: string;
    cropYear: number;
  }): AreaCropBaseline;
}

export interface FarmerInsuranceIndicator {
  stateName: string;
  district: string;
  crop: string;
  seasonCode: string;
  /** Notified sum insured per acre — configuration, not a computed guess. */
  sumInsuredPerAcre: number;
  actuarialPremiumPerAcre: number;
  farmerSharePct: number;
  schemeCode: string;
  contactLabel: string;
  source: string;
  synthetic: boolean;
}

export interface FarmerInsuranceIndicatorAdapter {
  readonly name: string;
  indicator(input: {
    stateName: string;
    district: string;
    crop: string;
    seasonCode: string;
  }): FarmerInsuranceIndicator;
}

const CROP_BASE: Record<string, { yieldPerAcre: number; cost: number; price: number; adoption: number }> = {
  Paddy: { yieldPerAcre: 22, cost: 26000, price: 2050, adoption: 34 },
  Cotton: { yieldPerAcre: 9, cost: 34000, price: 7200, adoption: 22 },
  Maize: { yieldPerAcre: 24, cost: 22000, price: 2100, adoption: 14 },
  Chilli: { yieldPerAcre: 20, cost: 78000, price: 12500, adoption: 12 },
  Groundnut: { yieldPerAcre: 11, cost: 28000, price: 6200, adoption: 9 },
  Turmeric: { yieldPerAcre: 24, cost: 82000, price: 7400, adoption: 5 },
  Redgram: { yieldPerAcre: 5, cost: 18000, price: 7000, adoption: 4 },
};

/** Stable string hash so every environment sees identical baselines. */
function hash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export const syntheticAreaCropBaseline: AreaCropBaselineAdapter = {
  name: "synthetic-area-crop-baseline",
  crops: Object.keys(CROP_BASE),
  baseline({ stateName, district, crop, cropYear }) {
    const base = CROP_BASE[crop] ?? { yieldPerAcre: 12, cost: 25000, price: 3000, adoption: 3 };
    const jitter = (hash(`${district}${crop}${cropYear}`) % 30) / 100;
    const inflation = 1 + Math.max(0, cropYear - 2021) * 0.045;
    return {
      stateName,
      district,
      crop,
      cropYear,
      seasonCode: crop === "Maize" || crop === "Chilli" ? "rabi" : "kharif",
      typicalYieldPerAcre: round2(base.yieldPerAcre * (0.85 + jitter)),
      typicalCostPerAcre: round2(base.cost * inflation),
      typicalPricePerQuintal: round2(base.price * (1 + Math.max(0, cropYear - 2021) * 0.038)),
      adoptionShare: base.adoption,
      source: "synthetic_baseline",
      synthetic: true,
    };
  },
};

export const syntheticFarmerInsuranceIndicator: FarmerInsuranceIndicatorAdapter = {
  name: "synthetic-farmer-insurance-indicator",
  indicator({ stateName, district, crop, seasonCode }) {
    const base = CROP_BASE[crop] ?? { yieldPerAcre: 12, cost: 25000, price: 3000, adoption: 3 };
    const sumInsured = round2(base.yieldPerAcre * base.price * 0.85);
    const actuarial = round2(sumInsured * (0.07 + ((hash(`${district}${crop}act`) % 6) / 100)));
    return {
      stateName,
      district,
      crop,
      seasonCode,
      sumInsuredPerAcre: sumInsured,
      actuarialPremiumPerAcre: actuarial,
      // Kharif 2%, Rabi 1.5%, commercial/horticulture 5% — configuration.
      farmerSharePct: crop === "Chilli" || crop === "Turmeric" ? 5 : seasonCode === "rabi" ? 1.5 : 2,
      schemeCode: "PMFBY",
      contactLabel: "Crop insurance help desk (synthetic)",
      source: "synthetic_baseline",
      synthetic: true,
    };
  },
};

export const farmHistoryAdapters = {
  areaCropBaseline: syntheticAreaCropBaseline,
  farmerInsuranceIndicator: syntheticFarmerInsuranceIndicator,
} as const;
