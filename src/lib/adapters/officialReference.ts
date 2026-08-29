/**
 * Official reference data overlay (C1).
 *
 * Slice B11 gave every baseline a provenance label, but the label was
 * whole-row: either "official district statistics" or "synthetic baseline".
 * That is too coarse once real government data is bulk-loaded, because real
 * datasets arrive field by field:
 *
 *  - CACP Minimum Support Prices are published nationally per crop and crop
 *    year → the *price* field can be official even when yield and cost are
 *    still indicative.
 *  - PMFBY operational guidelines publish the *farmer premium share cap* but
 *    not district x crop sum insured / actuarial rates → the share is official,
 *    the premium amount is not.
 *
 * So this module carries field-level provenance. Nothing here decides anything:
 * MSP is a reference price, not a settlement price, and the notified share cap
 * is configuration for the authorised human/partner role to act on.
 */

export type FieldProvenance = "official" | "indicative";

export interface OfficialMspRow {
  crop: string;
  crop_year: number;
  season_code: string;
  variety_label: string;
  msp_per_quintal: number;
  source: string;
  notification_ref: string | null;
}

export interface OfficialInsuranceShareRow {
  scheme_code: string;
  season_code: string;
  crop_category: string;
  farmer_share_pct: number;
  source: string;
  notification_ref: string | null;
}

export interface OfficialDataLoadRow {
  dataset_code: string;
  dataset_label: string;
  source_citation: string;
  row_count: number;
  coverage_note: string | null;
  validate_notes: string | null;
}

/** Crops with no notified MSP anywhere in the loaded series. */
export interface MspOverlayResult<T> {
  rows: T[];
  /** Rows whose price was replaced with a notified MSP. */
  matched: number;
  /** Rows left with an indicative price because no MSP exists for that crop. */
  unmatched: number;
  cropsWithoutMsp: string[];
  sources: string[];
}

const mspKey = (crop: string, year: number) => `${crop.trim().toLowerCase()}|${year}`;

export function indexMspRows(rows: readonly OfficialMspRow[]) {
  const exact = new Map<string, OfficialMspRow>();
  const byCrop = new Map<string, OfficialMspRow[]>();
  for (const row of rows) {
    // First writer wins for a crop+year so a deterministic variety is used.
    const k = mspKey(row.crop, row.crop_year);
    if (!exact.has(k)) exact.set(k, row);
    const ck = row.crop.trim().toLowerCase();
    const list = byCrop.get(ck) ?? [];
    list.push(row);
    byCrop.set(ck, list);
  }
  return { exact, byCrop };
}

/**
 * Look up the notified MSP for a crop and crop year. Falls back to the nearest
 * available year for the same crop (flagged through `nearestYear`) so a farmer
 * comparing an older season still sees a real reference price.
 */
export function lookupMsp(
  rows: readonly OfficialMspRow[],
  crop: string,
  cropYear: number,
): { row: OfficialMspRow; nearestYear: number | null } | null {
  const { exact, byCrop } = indexMspRows(rows);
  const hit = exact.get(mspKey(crop, cropYear));
  if (hit) return { row: hit, nearestYear: null };
  const list = byCrop.get(crop.trim().toLowerCase());
  if (!list || list.length === 0) return null;
  const nearest = [...list].sort(
    (a, b) => Math.abs(a.crop_year - cropYear) - Math.abs(b.crop_year - cropYear),
  )[0]!;
  return { row: nearest, nearestYear: nearest.crop_year };
}

interface PriceCarrier {
  crop: string;
  crop_year: number;
  typical_price_per_quintal: number;
  price_low_per_quintal: number;
  price_high_per_quintal: number;
  source: string;
}

/**
 * Overlay notified MSP onto benchmark rows as the typical price. The low/high
 * band is preserved as a relative spread around the official price so the
 * "what my area grows" view keeps showing realistic market variance rather than
 * implying MSP is guaranteed realisation.
 */
export function overlayOfficialMsp<T extends PriceCarrier>(
  rows: readonly T[],
  msp: readonly OfficialMspRow[],
): MspOverlayResult<T> {
  if (msp.length === 0) {
    return {
      rows: [...rows],
      matched: 0,
      unmatched: rows.length,
      cropsWithoutMsp: [...new Set(rows.map((r) => r.crop))].sort(),
      sources: [],
    };
  }

  let matched = 0;
  let unmatched = 0;
  const without = new Set<string>();
  const sources = new Set<string>();

  const out = rows.map((row) => {
    const hit = lookupMsp(msp, row.crop, row.crop_year);
    if (!hit) {
      unmatched += 1;
      without.add(row.crop);
      return row;
    }
    matched += 1;
    sources.add(hit.row.source);

    const base = row.typical_price_per_quintal > 0 ? row.typical_price_per_quintal : hit.row.msp_per_quintal;
    const lowRatio = base > 0 ? row.price_low_per_quintal / base : 0.86;
    const highRatio = base > 0 ? row.price_high_per_quintal / base : 1.19;
    const price = hit.row.msp_per_quintal;
    const round = (n: number) => Math.round(n * 100) / 100;

    return {
      ...row,
      typical_price_per_quintal: round(price),
      price_low_per_quintal: round(price * (lowRatio > 0 && lowRatio < 1 ? lowRatio : 0.86)),
      price_high_per_quintal: round(price * (highRatio > 1 ? highRatio : 1.19)),
      source: hit.nearestYear === null ? `${hit.row.source}` : `${hit.row.source}:nearest_year_${hit.nearestYear}`,
    } as T;
  });

  return {
    rows: out,
    matched,
    unmatched,
    cropsWithoutMsp: [...without].sort(),
    sources: [...sources].sort(),
  };
}

/** Crop categories used by the notified farmer share caps. */
const COMMERCIAL_CROPS = new Set(["cotton", "chilli", "turmeric", "sugarcane", "banana", "oil palm", "chillies"]);

export function cropCategoryFor(crop: string): "food_and_oilseed" | "commercial_or_horticultural" {
  return COMMERCIAL_CROPS.has(crop.trim().toLowerCase()) ? "commercial_or_horticultural" : "food_and_oilseed";
}

/**
 * Notified farmer premium share for a crop and season. Returns null when no
 * notified row covers the combination — callers must then keep the share
 * indicative rather than guessing.
 */
export function lookupFarmerSharePct(
  rows: readonly OfficialInsuranceShareRow[],
  input: { crop: string; seasonCode: string; schemeCode?: string },
): OfficialInsuranceShareRow | null {
  const season = input.seasonCode.trim().toLowerCase();
  const category = cropCategoryFor(input.crop);
  const scheme = (input.schemeCode ?? "PMFBY").trim().toUpperCase();
  const candidates = rows.filter(
    (r) => r.scheme_code.trim().toUpperCase() === scheme && r.crop_category === category,
  );
  return (
    candidates.find((r) => r.season_code.trim().toLowerCase() === season) ??
    candidates.find((r) => r.season_code.trim().toLowerCase() === "annual") ??
    null
  );
}

export interface FieldProvenanceMap {
  price: FieldProvenance;
  yieldPerAcre: FieldProvenance;
  costPerAcre: FieldProvenance;
}

export interface OfficialReferenceSummary {
  /** Field-level truth of the area comparison shown to the farmer. */
  fields: FieldProvenanceMap;
  mspRowsLoaded: number;
  mspMatchedRows: number;
  cropsWithoutMsp: string[];
  farmerSharePctOfficial: boolean;
  datasets: Array<{ code: string; label: string; citation: string; rows: number }>;
  /** Plain-language notes rendered next to the figures. */
  notes: string[];
}

export function summariseOfficialReference(input: {
  mspRows: readonly OfficialMspRow[];
  overlay: MspOverlayResult<PriceCarrier> | { matched: number; cropsWithoutMsp: string[] };
  shareRow: OfficialInsuranceShareRow | null;
  loads: readonly OfficialDataLoadRow[];
}): OfficialReferenceSummary {
  const matched = input.overlay.matched;
  const notes: string[] = [];

  if (matched > 0) {
    notes.push("Prices shown are notified Minimum Support Prices, not a guaranteed sale price.");
  }
  if (input.overlay.cropsWithoutMsp.length > 0) {
    notes.push(
      `No notified MSP exists for ${input.overlay.cropsWithoutMsp.join(", ")} — those prices stay indicative.`,
    );
  }
  notes.push("District yield and cost figures are indicative until state statistics are loaded.");
  if (input.shareRow) {
    notes.push(
      `Your premium share of ${input.shareRow.farmer_share_pct}% is the notified cap; the premium amount itself is indicative.`,
    );
  }

  return {
    fields: {
      price: matched > 0 ? "official" : "indicative",
      yieldPerAcre: "indicative",
      costPerAcre: "indicative",
    },
    mspRowsLoaded: input.mspRows.length,
    mspMatchedRows: matched,
    cropsWithoutMsp: input.overlay.cropsWithoutMsp,
    farmerSharePctOfficial: input.shareRow !== null,
    datasets: input.loads.map((l) => ({
      code: l.dataset_code,
      label: l.dataset_label,
      citation: l.source_citation,
      rows: l.row_count,
    })),
    notes,
  };
}
