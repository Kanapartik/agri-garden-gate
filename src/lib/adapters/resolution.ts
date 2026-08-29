/**
 * Real-adapter wiring (B11).
 *
 * Slice B10 read district baselines and insurance indicators from a synthetic
 * adapter. This module adds the resolution layer that callers use instead:
 *
 *  - Official rows (state agriculture statistics loaded into
 *    `area_crop_benchmarks`, notified PMFBY tables) are preferred whenever a
 *    matching row exists.
 *  - The synthetic adapter is a declared fallback, never a silent one: every
 *    resolution returns provenance that the UI shows to the user.
 *  - Config decides the mode, so a jurisdiction can forbid synthetic fallback
 *    entirely (`official_only`) without a code fork.
 *
 * Swapping in a real provider means supplying rows/adapters here; callers keep
 * the `AreaCropBaselineAdapter` / `FarmerInsuranceIndicatorAdapter` contracts.
 */
import {
  syntheticAreaCropBaseline,
  syntheticFarmerInsuranceIndicator,
  type AreaCropBaseline,
  type AreaCropBaselineAdapter,
  type FarmerInsuranceIndicator,
  type FarmerInsuranceIndicatorAdapter,
} from "./farmHistoryBaseline";

export type AdapterMode = "official_first" | "official_only" | "synthetic_only";

export function resolveAdapterMode(raw: string | null | undefined): AdapterMode {
  const value = (raw ?? "").trim().toLowerCase();
  if (value === "official_only" || value === "official_first" || value === "synthetic_only") {
    return value;
  }
  return "official_first";
}

export interface BaselineProvenance {
  adapter: string;
  mode: AdapterMode;
  /** How many official rows were available to the resolver. */
  officialRows: number;
  /** True when the caller will be served synthetic figures. */
  synthetic: boolean;
  /** Short user-facing label, e.g. "Official statistics" / "Synthetic baseline". */
  label: string;
  sources: string[];
}

const SYNTHETIC_SOURCES = new Set(["synthetic_baseline", "synthetic", "seed_synthetic"]);

export function isOfficialSource(source: string | null | undefined): boolean {
  const value = (source ?? "").trim().toLowerCase();
  if (!value) return false;
  return !SYNTHETIC_SOURCES.has(value);
}

/* ------------------------------------------------------ area crop baseline */

export interface OfficialAreaCropRow {
  state_name: string;
  district: string;
  crop: string;
  crop_year: number;
  season_code: string;
  typical_yield_quintal_per_acre: number;
  typical_cost_per_acre: number;
  typical_price_per_quintal: number;
  adoption_share: number;
  source: string;
}

const key = (district: string, crop: string, year: number) =>
  `${district.trim().toLowerCase()}|${crop.trim().toLowerCase()}|${year}`;

/**
 * Adapter backed by official rows already loaded from the database. Exact
 * district+crop+year matches win; otherwise the nearest available year for the
 * same district+crop is used and flagged through `source`.
 */
export function officialAreaCropBaseline(
  rows: readonly OfficialAreaCropRow[],
  fallback: AreaCropBaselineAdapter = syntheticAreaCropBaseline,
): AreaCropBaselineAdapter {
  const exact = new Map<string, OfficialAreaCropRow>();
  const byCrop = new Map<string, OfficialAreaCropRow[]>();
  for (const row of rows) {
    exact.set(key(row.district, row.crop, row.crop_year), row);
    const k = `${row.district.trim().toLowerCase()}|${row.crop.trim().toLowerCase()}`;
    const list = byCrop.get(k) ?? [];
    list.push(row);
    byCrop.set(k, list);
  }

  const crops = [...new Set(rows.map((r) => r.crop))].sort();

  const toBaseline = (row: OfficialAreaCropRow, cropYear: number): AreaCropBaseline => ({
    stateName: row.state_name,
    district: row.district,
    crop: row.crop,
    cropYear,
    seasonCode: row.season_code,
    typicalYieldPerAcre: row.typical_yield_quintal_per_acre,
    typicalCostPerAcre: row.typical_cost_per_acre,
    typicalPricePerQuintal: row.typical_price_per_quintal,
    adoptionShare: row.adoption_share,
    source: row.crop_year === cropYear ? row.source : `${row.source}:nearest_year_${row.crop_year}`,
    synthetic: false,
  });

  return {
    name: "official-area-crop-baseline",
    crops: crops.length ? crops : fallback.crops,
    baseline(input) {
      const hit = exact.get(key(input.district, input.crop, input.cropYear));
      if (hit) return toBaseline(hit, input.cropYear);

      const list = byCrop.get(`${input.district.trim().toLowerCase()}|${input.crop.trim().toLowerCase()}`);
      if (list && list.length) {
        const nearest = [...list].sort(
          (a, b) => Math.abs(a.crop_year - input.cropYear) - Math.abs(b.crop_year - input.cropYear),
        )[0]!;
        return toBaseline(nearest, input.cropYear);
      }
      return fallback.baseline(input);
    },
  };
}

export interface AreaCropResolution {
  adapter: AreaCropBaselineAdapter;
  provenance: BaselineProvenance;
}

export function resolveAreaCropBaselineAdapter(input: {
  officialRows: readonly OfficialAreaCropRow[];
  mode?: AdapterMode;
}): AreaCropResolution {
  const mode = input.mode ?? "official_first";
  const official = input.officialRows.filter((r) => isOfficialSource(r.source));

  if (mode === "synthetic_only" || (official.length === 0 && mode !== "official_only")) {
    return {
      adapter: syntheticAreaCropBaseline,
      provenance: {
        adapter: syntheticAreaCropBaseline.name,
        mode,
        officialRows: official.length,
        synthetic: true,
        label: "Synthetic baseline (no official district statistics loaded)",
        sources: ["synthetic_baseline"],
      },
    };
  }

  if (official.length === 0) {
    // official_only with nothing loaded: refuse to invent figures.
    throw new Error(
      "No official district statistics are configured for this area. Load official benchmarks or allow the synthetic baseline.",
    );
  }

  return {
    adapter: officialAreaCropBaseline(official),
    provenance: {
      adapter: "official-area-crop-baseline",
      mode,
      officialRows: official.length,
      synthetic: false,
      label: "Official district statistics",
      sources: [...new Set(official.map((r) => r.source))].sort(),
    },
  };
}

/* ---------------------------------------------- farmer insurance indicator */

export interface OfficialInsuranceRow {
  state_name: string;
  district: string;
  crop: string;
  season_code: string;
  sum_insured_per_acre: number;
  actuarial_premium_per_acre: number;
  farmer_share_pct: number;
  scheme_code: string;
  contact_label: string | null;
  source: string;
}

/**
 * Adapter backed by notified sum-insured / premium tables. It never computes a
 * decision — it only returns the notified configuration for the human/partner
 * role to act on.
 */
export function officialFarmerInsuranceIndicator(
  rows: readonly OfficialInsuranceRow[],
  fallback: FarmerInsuranceIndicatorAdapter = syntheticFarmerInsuranceIndicator,
): FarmerInsuranceIndicatorAdapter {
  const map = new Map<string, OfficialInsuranceRow>();
  for (const row of rows) {
    map.set(
      `${row.district.trim().toLowerCase()}|${row.crop.trim().toLowerCase()}|${row.season_code.toLowerCase()}`,
      row,
    );
  }
  return {
    name: "official-farmer-insurance-indicator",
    indicator(input): FarmerInsuranceIndicator {
      const hit =
        map.get(
          `${input.district.trim().toLowerCase()}|${input.crop.trim().toLowerCase()}|${input.seasonCode.toLowerCase()}`,
        ) ?? null;
      if (!hit) return fallback.indicator(input);
      return {
        stateName: hit.state_name,
        district: hit.district,
        crop: hit.crop,
        seasonCode: hit.season_code,
        sumInsuredPerAcre: hit.sum_insured_per_acre,
        actuarialPremiumPerAcre: hit.actuarial_premium_per_acre,
        farmerSharePct: hit.farmer_share_pct,
        schemeCode: hit.scheme_code,
        contactLabel: hit.contact_label ?? "Crop insurance help desk",
        source: hit.source,
        synthetic: false,
      };
    },
  };
}

export interface InsuranceResolution {
  adapter: FarmerInsuranceIndicatorAdapter;
  provenance: BaselineProvenance;
}

export function resolveFarmerInsuranceIndicatorAdapter(input: {
  officialRows: readonly OfficialInsuranceRow[];
  mode?: AdapterMode;
}): InsuranceResolution {
  const mode = input.mode ?? "official_first";
  const official = input.officialRows.filter((r) => isOfficialSource(r.source));

  if (mode === "synthetic_only" || (official.length === 0 && mode !== "official_only")) {
    return {
      adapter: syntheticFarmerInsuranceIndicator,
      provenance: {
        adapter: syntheticFarmerInsuranceIndicator.name,
        mode,
        officialRows: official.length,
        synthetic: true,
        label: "Synthetic insurance indicator (notified tables not loaded)",
        sources: ["synthetic_baseline"],
      },
    };
  }

  if (official.length === 0) {
    throw new Error(
      "No notified insurance tables are configured for this area. Load notified figures or allow the synthetic indicator.",
    );
  }

  return {
    adapter: officialFarmerInsuranceIndicator(official),
    provenance: {
      adapter: "official-farmer-insurance-indicator",
      mode,
      officialRows: official.length,
      synthetic: false,
      label: "Notified insurance tables",
      sources: [...new Set(official.map((r) => r.source))].sort(),
    },
  };
}
