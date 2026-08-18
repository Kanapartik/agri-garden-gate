/**
 * Server-only helpers for B2A — My Farm Intelligence.
 * Imported only from `intelligence.functions.ts` handler bodies.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  classifySoil,
  haversineKm,
  labeledMoney,
  nearestFacilities,
  outcomeScenarios,
  rankCrops,
  resolveSeason,
  scoreCrop,
  type CropRecommendation,
  type FacilityLike,
  type GeoPoint,
  type LabeledMoney,
  type OutcomeScenario,
  type ProcessingStepAssumption,
  type SeasonCode,
  type SoilIntelligence,
} from "@/lib/atap/intelligence";
import { farmIntelligenceAdapters } from "@/lib/adapters/farmIntelligence";
import type { AgrometReading, DistrictProfile } from "@/lib/adapters/farmIntelligence";

export type AuthedClient = SupabaseClient<Database>;

export interface FarmParcel {
  id: string;
  label: string;
  plot_ref: string;
  village_code: string | null;
  geography_id: string | null;
  primary_crop: string | null;
  area_acres: number | null;
  centroid_lat: number | null;
  centroid_lng: number | null;
  farmer_user_id: string;
  captured_by_user_id: string | null;
}

const FALLBACK_POINT: GeoPoint = { lat: 17.385, lng: 78.4867 };

export async function listParcels(supabase: AuthedClient): Promise<FarmParcel[]> {
  const { data } = await supabase
    .from("farm_records")
    .select(
      "id, label, plot_ref, village_code, geography_id, primary_crop, area_acres, centroid_lat, centroid_lng, farmer_user_id, captured_by_user_id",
    )
    .order("updated_at", { ascending: false })
    .limit(50);
  return ((data ?? []) as unknown as FarmParcel[]).map((row) => ({
    ...row,
    area_acres: row.area_acres === null ? null : Number(row.area_acres),
    centroid_lat: row.centroid_lat === null ? null : Number(row.centroid_lat),
    centroid_lng: row.centroid_lng === null ? null : Number(row.centroid_lng),
  }));
}

export function parcelPoint(parcel: FarmParcel): GeoPoint {
  if (parcel.centroid_lat !== null && parcel.centroid_lng !== null) {
    return { lat: parcel.centroid_lat, lng: parcel.centroid_lng };
  }
  return FALLBACK_POINT;
}

export interface LocationContext {
  villageCode: string | null;
  villageName: string | null;
  blockName: string | null;
  districtName: string | null;
  stateName: string | null;
  geographyId: string | null;
  point: GeoPoint;
  agroClimaticZone: string;
  seasonCode: SeasonCode;
  seasonLabel: string;
  sowingWindow: string;
  harvestWindow: string;
  sourceKey: string;
  resolvedAt: string;
}

interface GeoRow {
  id: string;
  code: string;
  name: string;
  level: string;
  parent_id: string | null;
}

/**
 * Resolves the village → block → district → state chain from the geography tree
 * when the parcel is linked to one, and otherwise falls back to the nearest
 * known facility's district so intelligence still has a location basis.
 */
export async function resolveLocation(
  supabase: AuthedClient,
  parcel: FarmParcel,
  facilities: readonly FacilityLike[],
): Promise<{ location: LocationContext; profile: DistrictProfile }> {
  const { data } = await supabase.from("geographies").select("id, code, name, level, parent_id");
  const rows = (data ?? []) as GeoRow[];
  const byId = new Map(rows.map((r) => [r.id, r]));
  const byCode = new Map(rows.map((r) => [r.code, r]));

  let node: GeoRow | undefined =
    (parcel.geography_id ? byId.get(parcel.geography_id) : undefined) ??
    (parcel.village_code ? byCode.get(parcel.village_code) : undefined);

  const chain: Record<string, string> = {};
  let guard = 0;
  while (node && guard < 8) {
    chain[node.level] = node.name;
    node = node.parent_id ? byId.get(node.parent_id) : undefined;
    guard += 1;
  }

  const point = parcelPoint(parcel);
  const nearest = nearestFacilities(point, facilities, { limit: 1 })[0];
  const districtName = chain["district"] ?? nearest?.district_name ?? null;
  const stateName = chain["state"] ?? nearest?.state_name ?? null;

  const profile = await farmIntelligenceAdapters.districtProfile.read({ districtName, stateName });
  const season = resolveSeason(new Date());

  return {
    location: {
      villageCode: parcel.village_code,
      villageName: chain["village"] ?? null,
      blockName: chain["block"] ?? null,
      districtName,
      stateName,
      geographyId: parcel.geography_id,
      point,
      agroClimaticZone: profile.agroClimaticZone,
      seasonCode: season.code,
      seasonLabel: season.label,
      sowingWindow: season.sowingWindow,
      harvestWindow: season.harvestWindow,
      sourceKey: profile.envelope.sourceKey,
      resolvedAt: new Date().toISOString(),
    },
    profile,
  };
}

export async function loadFacilities(supabase: AuthedClient): Promise<FacilityLike[]> {
  const { data } = await supabase
    .from("nearby_service_facilities")
    .select("id, kind, soil_lab_kind, name, district_name, state_name, latitude, longitude, contact_label, source_key");
  return ((data ?? []) as unknown as FacilityLike[]).map((f) => ({
    ...f,
    latitude: Number(f.latitude),
    longitude: Number(f.longitude),
  }));
}

export interface PriceRow {
  id: string;
  market_name: string;
  district_name: string | null;
  state_name: string | null;
  latitude: number | null;
  longitude: number | null;
  commodity: string;
  variety: string | null;
  grade: string | null;
  unit: string;
  min_price: number | null;
  modal_price: number | null;
  max_price: number | null;
  arrivals_quantity: number | null;
  arrivals_unit: string | null;
  price_date: string;
  label: "observed" | "forecast" | "derived_scenario";
  source_key: string;
  adapter_name: string;
}

export interface RankedPrice extends PriceRow {
  distanceKm: number | null;
}

export async function loadPrices(supabase: AuthedClient, point: GeoPoint): Promise<RankedPrice[]> {
  const { data } = await supabase
    .from("market_price_observations")
    .select(
      "id, market_name, district_name, state_name, latitude, longitude, commodity, variety, grade, unit, min_price, modal_price, max_price, arrivals_quantity, arrivals_unit, price_date, label, source_key, adapter_name",
    )
    .order("price_date", { ascending: false })
    .limit(200);
  return ((data ?? []) as unknown as PriceRow[])
    .map((row) => ({
      ...row,
      min_price: num(row.min_price),
      modal_price: num(row.modal_price),
      max_price: num(row.max_price),
      arrivals_quantity: num(row.arrivals_quantity),
      latitude: num(row.latitude),
      longitude: num(row.longitude),
      distanceKm:
        row.latitude !== null && row.longitude !== null
          ? haversineKm(point, { lat: Number(row.latitude), lng: Number(row.longitude) })
          : null,
    }))
    .sort((a, b) => (a.distanceKm ?? 1e9) - (b.distanceKm ?? 1e9) || b.price_date.localeCompare(a.price_date));
}

function num(v: number | null): number | null {
  return v === null ? null : Number(v);
}

/** Nearest OBSERVED modal price for a commodity, as a labelled money value. */
export function observedModalPrice(prices: readonly RankedPrice[], commodity: string): LabeledMoney | null {
  const row = prices.find(
    (p) => p.commodity.toLowerCase() === commodity.toLowerCase() && p.label === "observed" && p.modal_price !== null,
  );
  if (!row) return null;
  return labeledMoney({
    amount: Number(row.modal_price),
    currency: "INR",
    unit: row.unit,
    label: "observed",
    sourceKey: row.source_key,
    asOf: row.price_date,
  });
}

/* ------------------------------------------------- processing paths */

export interface ProcessingPath {
  id: string;
  code: string;
  label: string;
  commodity: string;
  owner_scope: string;
  assumption_source: string;
  notes: string | null;
  steps: ProcessingStepAssumption[];
}

export async function loadProcessingPaths(supabase: AuthedClient): Promise<ProcessingPath[]> {
  const [{ data: defs }, { data: steps }] = await Promise.all([
    supabase
      .from("processing_path_definitions")
      .select("id, code, label, commodity, owner_scope, assumption_source, notes")
      .eq("is_active", true),
    supabase
      .from("processing_path_steps")
      .select("path_id, step_order, from_product, to_product, recovery_pct, byproducts, cost_per_quintal, cost_breakdown, assumption_note")
      .order("step_order", { ascending: true }),
  ]);

  const stepRows = (steps ?? []) as unknown as Array<ProcessingStepAssumption & { path_id: string }>;
  return ((defs ?? []) as unknown as Array<Omit<ProcessingPath, "steps">>).map((def) => ({
    ...def,
    steps: stepRows
      .filter((s) => s.path_id === def.id)
      .map((s) => ({
        step_order: s.step_order,
        from_product: s.from_product,
        to_product: s.to_product,
        recovery_pct: Number(s.recovery_pct),
        byproducts: (s.byproducts ?? []).map((b) => ({
          name: b.name,
          yield_pct: Number(b.yield_pct),
          price_per_quintal: Number(b.price_per_quintal),
        })),
        cost_per_quintal: Number(s.cost_per_quintal),
        cost_breakdown: s.cost_breakdown ?? {},
        assumption_note: s.assumption_note ?? null,
      })),
  }));
}

/* --------------------------------------------------- soil + weather */

export async function readSoil(parcel: FarmParcel, districtName: string | null): Promise<SoilIntelligence & { envelope: { sourceKey: string; freshnessSeconds: number; confidence: number } }> {
  const reading = await farmIntelligenceAdapters.soilHealth.read({
    plotRef: parcel.plot_ref,
    districtName,
  });
  return {
    ...classifySoil(reading.general, reading.lab),
    envelope: {
      sourceKey: reading.envelope.sourceKey,
      freshnessSeconds: reading.envelope.freshnessSeconds,
      confidence: reading.envelope.confidence,
    },
  };
}

export async function readWeather(point: GeoPoint, location: LocationContext): Promise<AgrometReading> {
  return farmIntelligenceAdapters.agromet.read({
    point,
    districtName: location.districtName,
    blockName: location.blockName,
  });
}

/* ----------------------------------------------------- crop scoring */

/**
 * Builds explainable crop candidates from the district profile, current soil
 * basis, rainfall outlook and nearby observed prices. Deterministic, so tests
 * and the UI agree.
 */
export function buildCropRecommendations(input: {
  profile: DistrictProfile;
  soil: SoilIntelligence;
  weather: AgrometReading;
  prices: readonly RankedPrice[];
  season: SeasonCode;
  irrigationRecorded: boolean;
  processedCommodities: readonly string[];
}): CropRecommendation[] {
  const rainTotal = input.weather.forecast.reduce((s, f) => s + f.rainfallMm, 0);
  const rainfallOutlook = Math.min(1, rainTotal / 60);

  const recs = input.profile.majorCrops.map((crop) => {
    const price = input.prices.find((p) => p.commodity.toLowerCase() === crop.crop.toLowerCase());
    const priceStrength =
      price && price.modal_price !== null && price.max_price
        ? Math.min(1, Number(price.modal_price) / Number(price.max_price))
        : 0.5;
    const soilFit = input.soil.basis === "lab_tested" ? 0.85 : 0.65;
    const sources = [
      input.profile.envelope.sourceKey,
      input.weather.envelope.sourceKey,
      price?.source_key ?? "synthetic:no-price-observation",
    ];
    return scoreCrop(
      {
        crop: crop.crop,
        variety: crop.variety,
        season: crop.season,
        sowingWindow: crop.sowingWindow,
        soilFit,
        rainfallOutlook,
        irrigationFit: input.irrigationRecorded ? 0.8 : 0.55,
        sowingWindowFit: crop.season === input.season ? 0.9 : 0.45,
        historicPerformance: Math.min(1, crop.typicalYieldPerAcre / 30),
        localPriceStrength: priceStrength,
        valueAddOpportunity: input.processedCommodities.some(
          (c) => c.toLowerCase() === crop.crop.toLowerCase(),
        )
          ? 0.85
          : 0.4,
        sources,
        changeFactors: [
          "A Soil Health Card / laboratory test for this farm",
          "A revised rainfall or agromet forecast",
          "A change in nearby mandi prices or arrivals",
          "A change in irrigation availability for this parcel",
        ],
      },
      { soilBasis: input.soil.basis, freshnessSeconds: input.weather.envelope.freshnessSeconds },
    );
  });
  return rankCrops(recs);
}

export function buildOutcomeScenarios(input: {
  crop: string;
  season: SeasonCode;
  areaAcres: number;
  profile: DistrictProfile;
  price: LabeledMoney;
  harvestWindow: string;
  targetMarket: string;
  valueAddAlternative: string;
  risks: string[];
}): OutcomeScenario[] {
  const profileCrop = input.profile.majorCrops.find(
    (c) => c.crop.toLowerCase() === input.crop.toLowerCase(),
  );
  return outcomeScenarios({
    crop: input.crop,
    season: input.season,
    areaAcres: input.areaAcres,
    baseYieldPerAcre: profileCrop?.typicalYieldPerAcre ?? 20,
    basePrice: input.price,
    baseCostPerAcre: profileCrop?.typicalCostPerAcre ?? 30000,
    harvestWindow: input.harvestWindow,
    targetMarket: input.targetMarket,
    valueAddAlternative: input.valueAddAlternative,
    risks: input.risks,
  });
}
