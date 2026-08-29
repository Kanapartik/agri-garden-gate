/**
 * Server-only helpers for slice B10 — farmer history & command centre.
 *
 * Everything runs as the signed-in farmer, so RLS keeps season records and
 * insurance snapshots owner-only. District benchmarks and nearby services are
 * aggregate/public reference data and never contain another farmer's rows.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  isOfficialSource,
  resolveAdapterMode,
  resolveAreaCropBaselineAdapter,
  resolveFarmerInsuranceIndicatorAdapter,
  type BaselineProvenance,
} from "@/lib/adapters/resolution";
import {
  lookupFarmerSharePct,
  overlayOfficialMsp,
  summariseOfficialReference,
  type OfficialDataLoadRow,
  type OfficialInsuranceShareRow,
  type OfficialMspRow,
  type OfficialReferenceSummary,
} from "@/lib/adapters/officialReference";
import { haversineKm, type GeoPoint } from "@/lib/atap/intelligence";

import {
  areaCropViews,
  buildInsuranceCorner,
  classifyScale,
  farmerPremiumShare,
  historyReadiness,
  ownVsArea,
  summariseHistory,
  totalCost,
  type AreaBenchmark,
  type AreaCropView,
  type CostBreakdown,
  type CoverState,
  type HistoryReadiness,
  type HistorySummary,
  type InsuranceCorner,
  type OwnVsArea,
  type ScaleProfile,
  type SeasonRecord,
} from "@/lib/atap/farmHistory";

export type AuthedClient = SupabaseClient<Database>;

const SEASON_SELECT =
  "id, farm_id, crop_year, season_code, crop, area_acres, input_costs, input_cost_total, yield_quintal, price_per_quintal, revenue_inr, notes";

export interface ParcelRow {
  id: string;
  label: string;
  area_acres: number | null;
  primary_crop: string | null;
  village_code: string | null;
  centroid_lat: number | null;
  centroid_lng: number | null;
}

export interface NearbyService {
  id: string;
  kind: string;
  name: string;
  district_name: string | null;
  state_name: string | null;
  contact_label: string | null;
  distanceKm: number | null;
  is_synthetic: boolean;
}

export interface EligibleApplication {
  id: string;
  code: string;
  title: string;
  category: string | null;
  status: string;
}

export interface FarmHistoryWorkspace {
  userId: string;
  farmerName: string | null;
  stateName: string | null;
  district: string | null;
  totalAcres: number;
  parcels: ParcelRow[];
  scale: ScaleProfile;
  seasons: SeasonRecord[];
  summary: HistorySummary;
  readiness: HistoryReadiness;
  areaCrops: AreaCropView[];
  comparison: OwnVsArea[];
  insurance: InsuranceCorner;
  insuranceApplications: EligibleApplication[];
  services: NearbyService[];
  serviceKinds: string[];
  cropOptions: string[];
  currentYear: number;
  currentSeason: string;
  /** Where the district and insurance reference figures came from (B11). */
  areaProvenance: BaselineProvenance;
  insuranceProvenance: BaselineProvenance;
  /** Field-level truth of official reference data (C1). */
  officialReference: OfficialReferenceSummary;
}


function num(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function costs(value: unknown): CostBreakdown {
  if (!value || typeof value !== "object") return {};
  const out: CostBreakdown = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed > 0) out[key as keyof CostBreakdown] = parsed;
  }
  return out;
}

export function resolveSeasonCode(now = new Date()): string {
  const month = now.getUTCMonth() + 1;
  if (month >= 6 && month <= 10) return "kharif";
  if (month >= 11 || month <= 3) return "rabi";
  return "zaid";
}

function geoName(rows: Array<{ id: string; name: string }>, id: string | null): string | null {
  if (!id) return null;
  return rows.find((r) => r.id === id)?.name ?? null;
}

export async function loadWorkspace(
  supabase: AuthedClient,
  userId: string,
): Promise<FarmHistoryWorkspace> {
  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const currentSeason = resolveSeasonCode(now);
  const fromYear = currentYear - 4;

  const [profileRes, parcelRes, seasonRes, geoRes, snapshotRes, appsRes] = await Promise.all([
    supabase
      .from("farmer_profiles")
      .select(
        "full_name, total_extent_acres, state_geography_id, district_geography_id, village_code",
      )
      .eq("farmer_user_id", userId)
      .maybeSingle(),
    supabase
      .from("farm_records")
      .select("id, label, area_acres, primary_crop, village_code, centroid_lat, centroid_lng")
      .eq("farmer_user_id", userId)
      .order("updated_at", { ascending: false }),
    supabase
      .from("farm_season_records")
      .select(SEASON_SELECT)
      .eq("farmer_user_id", userId)
      .gte("crop_year", fromYear)
      .order("crop_year", { ascending: false }),
    supabase.from("geographies").select("id, name, level, code"),
    supabase
      .from("farmer_insurance_snapshots")
      .select(
        "season_code, crop_year, crop, district, state_name, cover_state, indicative_premium_per_acre, sum_insured_per_acre, farmer_share_per_acre, contact_label, source",
      )
      .eq("farmer_user_id", userId)
      .order("crop_year", { ascending: false })
      .limit(1),
    supabase
      .from("scheme_applications")
      .select("id, status, scheme_id, created_at")
      .eq("applicant_user_id", userId)
      .order("created_at", { ascending: false })
      .limit(25),
  ]);

  const profile = (profileRes.data ?? null) as {
    full_name: string | null;
    total_extent_acres: number | null;
    state_geography_id: string | null;
    district_geography_id: string | null;
    village_code: string | null;
  } | null;

  const geoRows = ((geoRes.data ?? []) as Array<{ id: string; name: string; level: string }>).map(
    (g) => ({ id: g.id, name: g.name }),
  );

  const parcels: ParcelRow[] = ((parcelRes.data ?? []) as Array<Record<string, unknown>>).map((p) => ({
    id: p["id"] as string,
    label: (p["label"] as string) ?? "Parcel",
    area_acres: num(p["area_acres"]),
    primary_crop: (p["primary_crop"] as string) ?? null,
    village_code: (p["village_code"] as string) ?? null,
    centroid_lat: num(p["centroid_lat"]),
    centroid_lng: num(p["centroid_lng"]),
  }));

  const seasons: SeasonRecord[] = ((seasonRes.data ?? []) as Array<Record<string, unknown>>).map((s) => ({
    id: s["id"] as string,
    farm_id: (s["farm_id"] as string) ?? null,
    crop_year: Number(s["crop_year"]),
    season_code: s["season_code"] as string,
    crop: s["crop"] as string,
    area_acres: num(s["area_acres"]) ?? 0,
    input_costs: costs(s["input_costs"]),
    input_cost_total: num(s["input_cost_total"]) ?? 0,
    yield_quintal: num(s["yield_quintal"]),
    price_per_quintal: num(s["price_per_quintal"]),
    revenue_inr: num(s["revenue_inr"]),
    notes: (s["notes"] as string) ?? null,
  }));

  const parcelAcres = parcels.reduce((sum, p) => sum + (p.area_acres ?? 0), 0);
  const totalAcres = parcelAcres > 0 ? parcelAcres : (profile?.total_extent_acres ?? 0);

  const stateName = geoName(geoRows, profile?.state_geography_id ?? null);
  const district = geoName(geoRows, profile?.district_geography_id ?? null);

  /* -------------------------------------------------- district benchmarks */
  let benchmarkRows: AreaBenchmark[] = [];
  if (district) {
    const { data } = await supabase
      .from("area_crop_benchmarks")
      .select(
        "state_name, district, crop, crop_year, season_code, typical_yield_quintal_per_acre, yield_low_quintal_per_acre, yield_high_quintal_per_acre, typical_cost_per_acre, typical_price_per_quintal, price_low_per_quintal, price_high_per_quintal, adoption_share, source",
      )
      .ilike("district", district)
      .gte("crop_year", fromYear);
    benchmarkRows = ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
      state_name: r["state_name"] as string,
      district: r["district"] as string,
      crop: r["crop"] as string,
      crop_year: Number(r["crop_year"]),
      season_code: r["season_code"] as string,
      typical_yield_quintal_per_acre: num(r["typical_yield_quintal_per_acre"]) ?? 0,
      yield_low_quintal_per_acre: num(r["yield_low_quintal_per_acre"]) ?? 0,
      yield_high_quintal_per_acre: num(r["yield_high_quintal_per_acre"]) ?? 0,
      typical_cost_per_acre: num(r["typical_cost_per_acre"]) ?? 0,
      typical_price_per_quintal: num(r["typical_price_per_quintal"]) ?? 0,
      price_low_per_quintal: num(r["price_low_per_quintal"]) ?? 0,
      price_high_per_quintal: num(r["price_high_per_quintal"]) ?? 0,
      adoption_share: num(r["adoption_share"]) ?? 0,
      source: r["source"] as string,
    }));
  }

  // No stored district rows (unknown / new geography) → synthetic adapter fills
  // in the same shape so the farmer still sees an area comparison.
  // Real-adapter wiring (B11): official rows win, the synthetic baseline is a
  // declared fallback and its provenance is surfaced to the farmer.
  const adapterMode = resolveAdapterMode(process.env["ATAP_BASELINE_ADAPTER_MODE"] ?? null);
  const areaResolution = resolveAreaCropBaselineAdapter({
    mode: adapterMode === "official_only" ? "official_first" : adapterMode,
    officialRows: benchmarkRows.map((r) => ({
      state_name: r.state_name,
      district: r.district,
      crop: r.crop,
      crop_year: r.crop_year,
      season_code: r.season_code,
      typical_yield_quintal_per_acre: r.typical_yield_quintal_per_acre,
      typical_cost_per_acre: r.typical_cost_per_acre,
      typical_price_per_quintal: r.typical_price_per_quintal,
      adoption_share: r.adoption_share,
      source: r.source,
    })),
  });
  const areaProvenance = areaResolution.provenance;

  if (benchmarkRows.length === 0) {
    const target = district ?? "Unassigned district";
    for (const crop of areaResolution.adapter.crops) {
      for (let y = fromYear; y <= currentYear; y += 1) {
        const b = areaResolution.adapter.baseline({
          stateName: stateName ?? "Andhra Pradesh",
          district: target,
          crop,
          cropYear: y,
        });
        benchmarkRows.push({
          state_name: b.stateName,
          district: b.district,
          crop: b.crop,
          crop_year: b.cropYear,
          season_code: b.seasonCode,
          typical_yield_quintal_per_acre: b.typicalYieldPerAcre,
          yield_low_quintal_per_acre: Math.round(b.typicalYieldPerAcre * 0.72 * 100) / 100,
          yield_high_quintal_per_acre: Math.round(b.typicalYieldPerAcre * 1.24 * 100) / 100,
          typical_cost_per_acre: b.typicalCostPerAcre,
          typical_price_per_quintal: b.typicalPricePerQuintal,
          price_low_per_quintal: Math.round(b.typicalPricePerQuintal * 0.86 * 100) / 100,
          price_high_per_quintal: Math.round(b.typicalPricePerQuintal * 1.19 * 100) / 100,
          adoption_share: b.adoptionShare,
          source: b.source,
        });
      }
    }
  }

  /* ------------------------------------------- official reference overlay */
  // Bulk-loaded government data (C1). MSP is published per crop and crop year,
  // so the price field becomes official while yield/cost stay indicative until
  // state statistics are loaded. Provenance is per-field, never per-row.
  const [mspRes, shareRes, loadRes] = await Promise.all([
    supabase
      .from("official_msp_rates")
      .select("crop, crop_year, season_code, variety_label, msp_per_quintal, source, notification_ref")
      .gte("crop_year", fromYear),
    supabase
      .from("official_insurance_rates")
      .select("scheme_code, season_code, crop_category, farmer_share_pct, source, notification_ref"),
    supabase
      .from("official_data_loads")
      .select("dataset_code, dataset_label, source_citation, row_count, coverage_note, validate_notes")
      .order("loaded_at", { ascending: false }),
  ]);

  const mspRows: OfficialMspRow[] = ((mspRes.data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    crop: r["crop"] as string,
    crop_year: Number(r["crop_year"]),
    season_code: r["season_code"] as string,
    variety_label: r["variety_label"] as string,
    msp_per_quintal: num(r["msp_per_quintal"]) ?? 0,
    source: r["source"] as string,
    notification_ref: (r["notification_ref"] as string) ?? null,
  }));
  const shareRows: OfficialInsuranceShareRow[] = ((shareRes.data ?? []) as Array<Record<string, unknown>>).map(
    (r) => ({
      scheme_code: r["scheme_code"] as string,
      season_code: r["season_code"] as string,
      crop_category: r["crop_category"] as string,
      farmer_share_pct: num(r["farmer_share_pct"]) ?? 0,
      source: r["source"] as string,
      notification_ref: (r["notification_ref"] as string) ?? null,
    }),
  );
  const loadRows: OfficialDataLoadRow[] = ((loadRes.data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    dataset_code: r["dataset_code"] as string,
    dataset_label: r["dataset_label"] as string,
    source_citation: r["source_citation"] as string,
    row_count: Number(r["row_count"] ?? 0),
    coverage_note: (r["coverage_note"] as string) ?? null,
    validate_notes: (r["validate_notes"] as string) ?? null,
  }));

  const overlay = overlayOfficialMsp(benchmarkRows, mspRows);
  benchmarkRows = overlay.rows;

  const areaCrops = areaCropViews(benchmarkRows);

  /* ---------------------------------------------------- insurance corner */
  const snapshot = ((snapshotRes.data ?? []) as Array<Record<string, unknown>>)[0] ?? null;
  const primaryCrop =
    parcels.find((p) => p.primary_crop)?.primary_crop ?? seasons[0]?.crop ?? areaCrops[0]?.crop ?? null;

  const notifiedShare = primaryCrop
    ? lookupFarmerSharePct(shareRows, { crop: primaryCrop, seasonCode: currentSeason })
    : null;

  const officialReference = summariseOfficialReference({
    mspRows,
    overlay,
    shareRow: notifiedShare,
    loads: loadRows,
  });


  const insuranceResolution = resolveFarmerInsuranceIndicatorAdapter({
    mode: adapterMode === "official_only" ? "official_first" : adapterMode,
    // Notified sum-insured/premium tables are not loaded yet — [VALIDATE source].
    officialRows: [],
  });
  const insuranceProvenance: BaselineProvenance =
    snapshot && isOfficialSource((snapshot["source"] as string) ?? null)
      ? {
          adapter: "stored-insurer-snapshot",
          mode: adapterMode,
          officialRows: 1,
          synthetic: false,
          label: "Insurer-supplied indicator",
          sources: [(snapshot["source"] as string) ?? "insurer"],
        }
      : insuranceResolution.provenance;

  let insurance: InsuranceCorner;
  if (snapshot) {
    insurance = buildInsuranceCorner({
      seasonCode: snapshot["season_code"] as string,
      cropYear: Number(snapshot["crop_year"]),
      crop: (snapshot["crop"] as string) ?? primaryCrop,
      district: (snapshot["district"] as string) ?? district,
      acres: totalAcres,
      coverState: (snapshot["cover_state"] as CoverState) ?? "unknown",
      indicativePremiumPerAcre: num(snapshot["indicative_premium_per_acre"]),
      sumInsuredPerAcre: num(snapshot["sum_insured_per_acre"]),
      farmerSharePerAcre: num(snapshot["farmer_share_per_acre"]),
      contactLabel: (snapshot["contact_label"] as string) ?? null,
      source: (snapshot["source"] as string) ?? "synthetic_baseline",
    });
  } else {
    const indicator = insuranceResolution.adapter.indicator({
      stateName: stateName ?? "Andhra Pradesh",
      district: district ?? "Unassigned district",
      crop: primaryCrop ?? "Paddy",
      seasonCode: currentSeason,
    });
    insurance = buildInsuranceCorner({
      seasonCode: currentSeason,
      cropYear: currentYear,
      crop: primaryCrop,
      district,
      acres: totalAcres,
      coverState: "not_covered",
      indicativePremiumPerAcre: indicator.actuarialPremiumPerAcre,
      sumInsuredPerAcre: indicator.sumInsuredPerAcre,
      farmerSharePerAcre: farmerPremiumShare({
        sumInsuredPerAcre: indicator.sumInsuredPerAcre,
        actuarialPremiumPerAcre: indicator.actuarialPremiumPerAcre,
        farmerSharePct: indicator.farmerSharePct,
      }),
      contactLabel: indicator.contactLabel,
      source: indicator.source,
    });
  }

  /* --------------------------------------- insurance-linked applications */
  const appRows = (appsRes.data ?? []) as Array<{ id: string; status: string; scheme_id: string }>;
  let insuranceApplications: EligibleApplication[] = [];
  if (appRows.length > 0) {
    const { data: schemes } = await supabase
      .from("schemes")
      .select("id, code, title, summary")
      .in(
        "id",
        appRows.map((a) => a.scheme_id),
      );
    const byId = new Map(
      ((schemes ?? []) as Array<{ id: string; code: string; title: string; summary: string | null }>).map(
        (s) => [s.id, s],
      ),
    );
    insuranceApplications = appRows.flatMap((a) => {
      const scheme = byId.get(a.scheme_id);
      if (!scheme) return [];
      return [
        {
          id: a.id,
          code: scheme.code,
          title: scheme.title,
          category: scheme.summary,
          status: a.status,
        },
      ];
    });
  }

  /* ------------------------------------------------------ nearby services */
  const point: GeoPoint | null = (() => {
    const p = parcels.find((x) => x.centroid_lat !== null && x.centroid_lng !== null);
    return p ? { lat: p.centroid_lat as number, lng: p.centroid_lng as number } : null;
  })();

  const serviceQuery = supabase
    .from("nearby_service_facilities")
    .select("id, kind, name, district_name, state_name, contact_label, latitude, longitude, is_synthetic")
    .limit(400);
  const { data: facilityRows } = district
    ? await serviceQuery.ilike("district_name", `%${district}%`)
    : await serviceQuery;

  let facilities = (facilityRows ?? []) as Array<Record<string, unknown>>;
  if (facilities.length === 0) {
    const { data: fallback } = await supabase
      .from("nearby_service_facilities")
      .select("id, kind, name, district_name, state_name, contact_label, latitude, longitude, is_synthetic")
      .limit(60);
    facilities = (fallback ?? []) as Array<Record<string, unknown>>;
  }

  const services: NearbyService[] = facilities
    .map((f) => {
      const lat = num(f["latitude"]);
      const lng = num(f["longitude"]);
      return {
        id: f["id"] as string,
        kind: f["kind"] as string,
        name: f["name"] as string,
        district_name: (f["district_name"] as string) ?? null,
        state_name: (f["state_name"] as string) ?? null,
        contact_label: (f["contact_label"] as string) ?? null,
        distanceKm:
          point && lat !== null && lng !== null
            ? Math.round(haversineKm(point, { lat, lng }) * 10) / 10
            : null,
        is_synthetic: Boolean(f["is_synthetic"]),
      };
    })
    .sort((a, b) => (a.distanceKm ?? 9999) - (b.distanceKm ?? 9999))
    .slice(0, 60);

  const summary = summariseHistory(seasons);

  return {
    userId,
    farmerName: profile?.full_name ?? null,
    stateName,
    district,
    totalAcres: Math.round(totalAcres * 100) / 100,
    parcels,
    scale: classifyScale(totalAcres),
    seasons,
    summary,
    readiness: historyReadiness(seasons, currentYear),
    areaCrops,
    comparison: ownVsArea(seasons, areaCrops),
    insurance,
    insuranceApplications,
    services,
    serviceKinds: [...new Set(services.map((s) => s.kind))].sort(),
    cropOptions: [...new Set([...areaCrops.map((c) => c.crop), ...summary.cropsGrown])].sort(),
    currentYear,
    currentSeason,
    areaProvenance,
    insuranceProvenance,
  };
}

/* ------------------------------------------------------------------ writes */

export interface SeasonInput {
  id?: string;
  farm_id?: string | null;
  crop_year: number;
  season_code: string;
  crop: string;
  area_acres: number;
  input_costs?: CostBreakdown;
  yield_quintal?: number | null;
  price_per_quintal?: number | null;
  revenue_inr?: number | null;
  notes?: string | null;
}

function clampYear(year: number): number {
  const current = new Date().getUTCFullYear();
  return Math.min(current, Math.max(current - 10, Math.round(year)));
}

function positive(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 100) / 100 : null;
}

/** Season history is farmer-entered; provenance records that explicitly. */
export async function saveSeason(supabase: AuthedClient, userId: string, input: SeasonInput) {
  const { audit } = await import("@/lib/atap/admin.server");
  const cleanCosts = input.input_costs ?? {};
  const payload = {
    farmer_user_id: userId,
    farm_id: input.farm_id ?? null,
    crop_year: clampYear(input.crop_year),
    season_code: (input.season_code || "kharif").slice(0, 20),
    crop: (input.crop || "").trim().slice(0, 60) || "Unspecified",
    area_acres: positive(input.area_acres) ?? 0,
    input_costs: cleanCosts,
    input_cost_total: totalCost(cleanCosts),
    yield_quintal: positive(input.yield_quintal),
    price_per_quintal: positive(input.price_per_quintal),
    revenue_inr: positive(input.revenue_inr),
    notes: input.notes ? input.notes.trim().slice(0, 500) : null,
    provenance: "farmer_entered" as const,
    is_synthetic: true,
  };

  const result = input.id
    ? await supabase
        .from("farm_season_records")
        .update(payload as never)
        .eq("id", input.id)
        .eq("farmer_user_id", userId)
        .select("id")
        .maybeSingle()
    : await supabase
        .from("farm_season_records")
        .insert(payload as never)
        .select("id")
        .maybeSingle();

  if (result.error) throw new Error(result.error.message);

  await audit(supabase, {
    actor_user_id: userId,
    action: input.id ? "farm_season_record.update" : "farm_season_record.create",
    subject_type: "farm_season_record",
    subject_id: (result.data as { id: string } | null)?.id ?? input.id ?? "unknown",
    decision: "allow",
    purpose_code: "farm_history_self_service",
    metadata: { crop_year: payload.crop_year, season_code: payload.season_code },
  });

  return { id: (result.data as { id: string } | null)?.id ?? input.id ?? null };
}

export async function deleteSeason(supabase: AuthedClient, userId: string, id: string) {
  const { audit } = await import("@/lib/atap/admin.server");
  const { error } = await supabase
    .from("farm_season_records")
    .delete()
    .eq("id", id)
    .eq("farmer_user_id", userId);
  if (error) throw new Error(error.message);
  await audit(supabase, {
    actor_user_id: userId,
    action: "farm_season_record.delete",
    subject_type: "farm_season_record",
    subject_id: id,
    decision: "allow",
    purpose_code: "farm_history_self_service",
  });
  return { ok: true };
}
