/**
 * Insurer market baseline adapter (slice I1).
 *
 * Cultivated area, farmer population, current penetration and indicative
 * premium per acre for a district x crop cell. In development/sandbox this is a
 * deterministic synthetic provider; official state agriculture statistics and
 * the insurer's own book plug in behind the same interface —
 * [VALIDATE data source].
 */

export interface MarketBaselineCell {
  stateName: string;
  district: string;
  crop: string;
  potentialFarmers: number;
  cultivatedAcres: number;
  insuredFarmers: number;
  insuredAcres: number;
  premiumPerAcre: number;
  source: string;
  synthetic: boolean;
}

export interface InsurerMarketBaselineAdapter {
  readonly name: string;
  readonly crops: readonly string[];
  cell(input: { stateName: string; district: string; crop: string }): MarketBaselineCell;
}

const PREMIUM_PER_ACRE: Record<string, number> = {
  Paddy: 1450,
  Cotton: 2100,
  Chilli: 2800,
  Maize: 1250,
  Turmeric: 2600,
  Groundnut: 1600,
};

/** Small stable string hash so every environment sees identical baselines. */
function hash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export const syntheticInsurerMarketBaseline: InsurerMarketBaselineAdapter = {
  name: "synthetic-insurer-market-baseline",
  crops: Object.keys(PREMIUM_PER_ACRE),
  cell({ stateName, district, crop }) {
    const farmers = 8000 + (hash(`${district}${crop}pf`) % 46000);
    const acres = 12000 + (hash(`${district}${crop}ca`) % 68000);
    const penetration = 18 + (hash(`${district}${crop}pen`) % 45);
    return {
      stateName,
      district,
      crop,
      potentialFarmers: farmers,
      cultivatedAcres: acres,
      insuredFarmers: Math.round((farmers * penetration) / 100),
      insuredAcres: Math.round((acres * penetration) / 100),
      premiumPerAcre: PREMIUM_PER_ACRE[crop] ?? 1500,
      source: "synthetic_baseline",
      synthetic: true,
    };
  },
};
