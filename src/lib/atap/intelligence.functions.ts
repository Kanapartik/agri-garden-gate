import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type {
  CropRecommendation,
  EscalationKind,
  LabeledMoney,
  OutcomeScenario,
  PriceLabel,
  RankedFacility,
  SeasonCode,
  SoilIntelligence,
  ValueAddResult,
} from "@/lib/atap/intelligence";
import type { AgrometReading } from "@/lib/adapters/farmIntelligence";
import type { AtapEnv, FlagDef } from "@/lib/atap/onboarding";

/* -------------------------------------------------------------- types */

export interface ParcelOption {
  id: string;
  label: string;
  plotRef: string;
  primaryCrop: string | null;
  areaAcres: number | null;
}

export interface LocationView {
  villageCode: string | null;
  villageName: string | null;
  blockName: string | null;
  districtName: string | null;
  stateName: string | null;
  lat: number;
  lng: number;
  agroClimaticZone: string;
  seasonCode: SeasonCode;
  seasonLabel: string;
  sowingWindow: string;
  harvestWindow: string;
  sourceKey: string;
  resolvedAt: string;
  majorSoils: string[];
  irrigationSources: string[];
}

export interface PriceView {
  id: string;
  marketName: string;
  districtName: string | null;
  stateName: string | null;
  commodity: string;
  variety: string | null;
  grade: string | null;
  unit: string;
  minPrice: number | null;
  modalPrice: number | null;
  maxPrice: number | null;
  arrivalsQuantity: number | null;
  arrivalsUnit: string | null;
  priceDate: string;
  label: PriceLabel;
  sourceKey: string;
  distanceKm: number | null;
}

export interface ProcessingPathView {
  id: string;
  code: string;
  label: string;
  commodity: string;
  ownerScope: string;
  assumptionSource: string;
  notes: string | null;
  steps: Array<{
    stepOrder: number;
    fromProduct: string;
    toProduct: string;
    recoveryPct: number;
    costPerQuintal: number;
    costBreakdown: Record<string, number>;
    byproducts: Array<{ name: string; yield_pct: number; price_per_quintal: number }>;
    assumptionNote: string | null;
  }>;
}

export interface EscalationView {
  id: string;
  kind: EscalationKind;
  status: string;
  message: string | null;
  facilityName: string | null;
  createdAt: string;
}

export interface FarmIntelligence {
  env: AtapEnv;
  flags: FlagDef[];
  userId: string;
  parcels: ParcelOption[];
  farmId: string | null;
  location: LocationView | null;
  weather: AgrometReading | null;
  soil: (SoilIntelligence & { envelope: { sourceKey: string; freshnessSeconds: number; confidence: number } }) | null;
  crops: CropRecommendation[];
  facilities: Record<string, RankedFacility[]>;
  prices: PriceView[];
  nearestModalPrice: LabeledMoney | null;
  processingPaths: ProcessingPathView[];
  escalations: EscalationView[];
  synthetic: boolean;
}

const FACILITY_GROUPS: Record<string, string[]> = {
  fpo: ["fpo"],
  kvk: ["kvk", "extension_centre"],
  soil_lab: ["soil_lab"],
  chc: ["chc"],
  warehouse: ["warehouse"],
  cold_storage: ["cold_storage"],
  processor: ["processor"],
  logistics: ["logistics"],
};

/* -------------------------------------------------- main read path */

/**
 * Everything the My Farm Intelligence workspace shows for one parcel. Default
 * deny: RLS scopes every row to a parcel the caller may read, and the access is
 * audited with a purpose code.
 */
export const getFarmIntelligence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { farmId?: string | null } | undefined) => ({ farmId: input?.farmId ?? null }))
  .handler(async ({ data, context }): Promise<FarmIntelligence> => {
    const { supabase, userId } = context;
    const { atapEnv } = await import("@/lib/atap/onboarding.server");
    const { audit } = await import("@/lib/atap/admin.server");
    const {
      buildCropRecommendations,
      listParcels,
      loadFacilities,
      loadPrices,
      loadProcessingPaths,
      observedModalPrice,
      parcelPoint,
      readSoil,
      readWeather,
      resolveLocation,
    } = await import("@/lib/atap/intelligence.server");
    const { nearestFacilities } = await import("@/lib/atap/intelligence");

    const [{ data: flagRows }, env, parcels, facilities] = await Promise.all([
      supabase.from("feature_flags").select("key, label, enabled, environments"),
      atapEnv(supabase),
      listParcels(supabase),
      loadFacilities(supabase),
    ]);
    const flags = (flagRows ?? []) as unknown as FlagDef[];

    const parcelOptions: ParcelOption[] = parcels.map((p) => ({
      id: p.id,
      label: p.label,
      plotRef: p.plot_ref,
      primaryCrop: p.primary_crop,
      areaAcres: p.area_acres,
    }));

    const parcel = data.farmId ? parcels.find((p) => p.id === data.farmId) : parcels[0];
    if (!parcel) {
      return {
        env,
        flags,
        userId,
        parcels: parcelOptions,
        farmId: null,
        location: null,
        weather: null,
        soil: null,
        crops: [],
        facilities: {},
        prices: [],
        nearestModalPrice: null,
        processingPaths: [],
        escalations: [],
        synthetic: true,
      };
    }

    const point = parcelPoint(parcel);
    const { location, profile } = await resolveLocation(supabase, parcel, facilities);
    const [weather, soil, prices, paths, escRes] = await Promise.all([
      readWeather(point, location),
      readSoil(parcel, location.districtName),
      loadPrices(supabase, point),
      loadProcessingPaths(supabase),
      supabase
        .from("advisory_escalations")
        .select("id, kind, status, message, facility_id, created_at")
        .eq("farm_id", parcel.id)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    const grouped: Record<string, RankedFacility[]> = {};
    for (const [group, kinds] of Object.entries(FACILITY_GROUPS)) {
      grouped[group] = nearestFacilities(point, facilities, { kinds, limit: 3 });
    }

    const crops = buildCropRecommendations({
      profile,
      soil,
      weather,
      prices,
      season: location.seasonCode,
      irrigationRecorded: location.irrigationSources.length > 0,
      processedCommodities: paths.map((p) => p.commodity),
    });

    // Persist the resolved location snapshot + audit the data access.
    await Promise.all([
      supabase.from("location_context_snapshots").insert({
        farm_id: parcel.id,
        subject_user_id: parcel.farmer_user_id,
        village_code: location.villageCode,
        village_name: location.villageName,
        block_name: location.blockName,
        district_name: location.districtName,
        state_name: location.stateName,
        geography_id: location.geographyId,
        centroid_lat: point.lat,
        centroid_lng: point.lng,
        agro_climatic_zone: location.agroClimaticZone,
        season_code: location.seasonCode,
        season_label: location.seasonLabel,
        source_key: location.sourceKey,
      } as never),
      audit(supabase, {
        actor_user_id: userId,
        action: "farm_intelligence.read",
        subject_type: "farm_record",
        subject_id: parcel.id,
        purpose_code: "farm_advisory",
        decision: "allow",
        metadata: { district: location.districtName, season: location.seasonCode },
      }),
    ]);

    const escalations = ((escRes.data ?? []) as unknown as Array<{
      id: string;
      kind: EscalationKind;
      status: string;
      message: string | null;
      facility_id: string | null;
      created_at: string;
    }>).map((row) => ({
      id: row.id,
      kind: row.kind,
      status: row.status,
      message: row.message,
      facilityName: facilities.find((f) => f.id === row.facility_id)?.name ?? null,
      createdAt: row.created_at,
    }));

    return {
      env,
      flags,
      userId,
      parcels: parcelOptions,
      farmId: parcel.id,
      location: {
        ...location,
        lat: point.lat,
        lng: point.lng,
        majorSoils: profile.majorSoils,
        irrigationSources: profile.irrigationSources,
      },
      weather,
      soil,
      crops,
      facilities: grouped,
      prices: prices.slice(0, 40).map(toPriceView),
      nearestModalPrice: observedModalPrice(prices, parcel.primary_crop ?? "Paddy"),
      processingPaths: paths.map((p) => ({
        id: p.id,
        code: p.code,
        label: p.label,
        commodity: p.commodity,
        ownerScope: p.owner_scope,
        assumptionSource: p.assumption_source,
        notes: p.notes,
        steps: p.steps.map((s) => ({
          stepOrder: s.step_order,
          fromProduct: s.from_product,
          toProduct: s.to_product,
          recoveryPct: s.recovery_pct,
          costPerQuintal: s.cost_per_quintal,
          costBreakdown: s.cost_breakdown,
          byproducts: s.byproducts,
          assumptionNote: s.assumption_note,
        })),
      })),
      escalations,
      synthetic: true,
    };
  });

function toPriceView(row: {
  id: string;
  market_name: string;
  district_name: string | null;
  state_name: string | null;
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
  label: PriceLabel;
  source_key: string;
  distanceKm: number | null;
}): PriceView {
  return {
    id: row.id,
    marketName: row.market_name,
    districtName: row.district_name,
    stateName: row.state_name,
    commodity: row.commodity,
    variety: row.variety,
    grade: row.grade,
    unit: row.unit,
    minPrice: row.min_price,
    modalPrice: row.modal_price,
    maxPrice: row.max_price,
    arrivalsQuantity: row.arrivals_quantity,
    arrivalsUnit: row.arrivals_unit,
    priceDate: row.price_date,
    label: row.label,
    sourceKey: row.source_key,
    distanceKm: row.distanceKm,
  };
}

/* ------------------------------------------------ observation refresh */

/** Stores the current adapter readings as append-only observations. */
export const refreshFarmObservations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { farmId: string }) => {
    if (!input?.farmId) throw new Error("farm_id_required");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { audit } = await import("@/lib/atap/admin.server");
    const { listParcels, loadFacilities, parcelPoint, readSoil, readWeather, resolveLocation } =
      await import("@/lib/atap/intelligence.server");

    const parcels = await listParcels(supabase);
    const parcel = parcels.find((p) => p.id === data.farmId);
    if (!parcel) throw new Error("farm_not_found_or_not_permitted");

    const facilities = await loadFacilities(supabase);
    const { location, profile } = await resolveLocation(supabase, parcel, facilities);
    const point = parcelPoint(parcel);
    const [weather, soil] = await Promise.all([
      readWeather(point, location),
      readSoil(parcel, location.districtName),
    ]);

    const rows = [
      {
        farm_id: parcel.id,
        kind: "agromet" as const,
        source_key: weather.envelope.sourceKey,
        adapter_name: weather.envelope.adapterName,
        payload: weather as unknown as Record<string, unknown>,
        observed_at: weather.envelope.observedAt,
        freshness_seconds: weather.envelope.freshnessSeconds,
        confidence: weather.envelope.confidence,
        is_synthetic: true,
      },
      {
        farm_id: parcel.id,
        kind: soil.basis === "lab_tested" ? ("soil_health_card" as const) : ("soil_general" as const),
        source_key: soil.envelope.sourceKey,
        adapter_name: "synthetic-soil-health-card",
        payload: soil as unknown as Record<string, unknown>,
        observed_at: new Date().toISOString(),
        freshness_seconds: soil.envelope.freshnessSeconds,
        confidence: soil.envelope.confidence,
        is_synthetic: true,
      },
      {
        farm_id: parcel.id,
        kind: "district_profile" as const,
        source_key: profile.envelope.sourceKey,
        adapter_name: profile.envelope.adapterName,
        payload: profile as unknown as Record<string, unknown>,
        observed_at: profile.envelope.observedAt,
        freshness_seconds: profile.envelope.freshnessSeconds,
        confidence: profile.envelope.confidence,
        is_synthetic: true,
      },
    ];

    const { error } = await supabase.from("external_data_observations").insert(rows as never);
    if (error) throw new Error(error.message);

    await audit(supabase, {
      actor_user_id: userId,
      action: "farm_intelligence.refresh",
      subject_type: "farm_record",
      subject_id: parcel.id,
      purpose_code: "farm_advisory",
      decision: "allow",
      metadata: { observations: rows.length },
    });

    return { stored: rows.length, soilBasis: soil.basis };
  });

/* ------------------------------------------------ market + nearby */

export const getMarketIntelligence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { farmId: string; commodity?: string | null }) => ({
    farmId: input.farmId,
    commodity: input.commodity ?? null,
  }))
  .handler(async ({ data, context }): Promise<{ prices: PriceView[] }> => {
    const { supabase } = context;
    const { listParcels, loadPrices, parcelPoint } = await import("@/lib/atap/intelligence.server");
    const parcels = await listParcels(supabase);
    const parcel = parcels.find((p) => p.id === data.farmId);
    if (!parcel) throw new Error("farm_not_found_or_not_permitted");
    const prices = await loadPrices(supabase, parcelPoint(parcel));
    const filtered = data.commodity
      ? prices.filter((p) => p.commodity.toLowerCase() === data.commodity!.toLowerCase())
      : prices;
    return { prices: filtered.map(toPriceView) };
  });

export const getNearbyFacilities = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { farmId: string; kinds?: string[] }) => ({
    farmId: input.farmId,
    kinds: input.kinds ?? null,
  }))
  .handler(async ({ data, context }): Promise<{ facilities: RankedFacility[] }> => {
    const { supabase } = context;
    const { listParcels, loadFacilities, parcelPoint } = await import("@/lib/atap/intelligence.server");
    const { nearestFacilities } = await import("@/lib/atap/intelligence");
    const parcels = await listParcels(supabase);
    const parcel = parcels.find((p) => p.id === data.farmId);
    if (!parcel) throw new Error("farm_not_found_or_not_permitted");
    const facilities = await loadFacilities(supabase);
    return {
      facilities: nearestFacilities(parcelPoint(parcel), facilities, {
        ...(data.kinds ? { kinds: data.kinds } : {}),
        limit: 10,
      }),
    };
  });

export const listProcessingPaths = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ paths: ProcessingPathView[] }> => {
    const { loadProcessingPaths } = await import("@/lib/atap/intelligence.server");
    const paths = await loadProcessingPaths(context.supabase);
    return {
      paths: paths.map((p) => ({
        id: p.id,
        code: p.code,
        label: p.label,
        commodity: p.commodity,
        ownerScope: p.owner_scope,
        assumptionSource: p.assumption_source,
        notes: p.notes,
        steps: p.steps.map((s) => ({
          stepOrder: s.step_order,
          fromProduct: s.from_product,
          toProduct: s.to_product,
          recoveryPct: s.recovery_pct,
          costPerQuintal: s.cost_per_quintal,
          costBreakdown: s.cost_breakdown,
          byproducts: s.byproducts,
          assumptionNote: s.assumption_note,
        })),
      })),
    };
  });

/* --------------------------------------------------- derived outputs */

export interface ValueAddView extends ValueAddResult {
  pathLabel: string;
  assumptionSource: string;
}

/**
 * DERIVED SCENARIO only. Recovery percentages come from the stored processing
 * path (platform default, tenant/processor override or a quotation) and can be
 * overridden per request; nothing is hard-coded.
 */
export const computeValueAddScenario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      farmId: string;
      pathId: string;
      inputQuintal: number;
      packagingPerQuintal?: number;
      transportPerQuintal?: number;
      recoveryOverrides?: Record<string, number>;
    }) => {
      if (!input.farmId || !input.pathId) throw new Error("farm_and_path_required");
      if (!(input.inputQuintal > 0)) throw new Error("input_quintal_must_be_positive");
      return input;
    },
  )
  .handler(async ({ data, context }): Promise<ValueAddView> => {
    const { supabase, userId } = context;
    const { evaluateValueAdd } = await import("@/lib/atap/intelligence");
    const { listParcels, loadPrices, loadProcessingPaths, observedModalPrice, parcelPoint } =
      await import("@/lib/atap/intelligence.server");

    const parcels = await listParcels(supabase);
    const parcel = parcels.find((p) => p.id === data.farmId);
    if (!parcel) throw new Error("farm_not_found_or_not_permitted");

    const [paths, prices] = await Promise.all([
      loadProcessingPaths(supabase),
      loadPrices(supabase, parcelPoint(parcel)),
    ]);
    const path = paths.find((p) => p.id === data.pathId);
    if (!path) throw new Error("processing_path_not_found");

    const steps = path.steps.map((s) => {
      const override = data.recoveryOverrides?.[String(s.step_order)];
      return override === undefined ? s : { ...s, recovery_pct: override };
    });
    const finalProduct = steps[steps.length - 1]?.to_product ?? path.commodity;

    const rawPrice = observedModalPrice(prices, path.commodity);
    if (!rawPrice) throw new Error("no_observed_raw_price_available");
    const processedPrice =
      observedModalPrice(prices, finalProduct) ??
      observedModalPrice(prices, finalProduct.replace(/\(.*\)/, "").trim()) ??
      observedModalPrice(prices, "Rice (polished)");

    const result = evaluateValueAdd({
      commodity: path.commodity,
      inputQuintal: data.inputQuintal,
      steps,
      rawPrice,
      processedPrice,
      packagingPerQuintal: data.packagingPerQuintal ?? 0,
      transportPerQuintal: data.transportPerQuintal ?? 0,
      assumptionSource: data.recoveryOverrides ? "request_override" : path.assumption_source,
    });

    await supabase.from("value_add_scenarios").insert({
      farm_id: parcel.id,
      path_id: path.id,
      commodity: path.commodity,
      raw_price_per_quintal: rawPrice.amount,
      raw_price_label: rawPrice.label,
      raw_price_source: rawPrice.sourceKey,
      assumptions: result.assumptions as never,
      steps_result: result.steps as never,
      byproduct_value: result.totalByproductValue,
      processing_cost: result.totalProcessingCost,
      estimated_realization: result.estimatedRealization.amount,
      created_by: userId,
    } as never);

    return { ...result, pathLabel: path.label, assumptionSource: path.assumption_source };
  });

export const computeCropOutcomeScenarios = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { farmId: string; crop: string; areaAcres?: number | null }) => {
    if (!input.farmId || !input.crop) throw new Error("farm_and_crop_required");
    return input;
  })
  .handler(async ({ data, context }): Promise<{ scenarios: OutcomeScenario[]; priceLabel: PriceLabel; priceSource: string }> => {
    const { supabase, userId } = context;
    const { labeledMoney } = await import("@/lib/atap/intelligence");
    const {
      buildOutcomeScenarios,
      listParcels,
      loadFacilities,
      loadPrices,
      loadProcessingPaths,
      observedModalPrice,
      parcelPoint,
      resolveLocation,
    } = await import("@/lib/atap/intelligence.server");

    const parcels = await listParcels(supabase);
    const parcel = parcels.find((p) => p.id === data.farmId);
    if (!parcel) throw new Error("farm_not_found_or_not_permitted");

    const facilities = await loadFacilities(supabase);
    const { location, profile } = await resolveLocation(supabase, parcel, facilities);
    const point = parcelPoint(parcel);
    const [prices, paths] = await Promise.all([loadPrices(supabase, point), loadProcessingPaths(supabase)]);

    const observed = observedModalPrice(prices, data.crop);
    // No observed price for this crop → fall back to an explicit FORECAST band,
    // never to an unlabelled number.
    const price: LabeledMoney =
      observed ??
      labeledMoney({
        amount: 2000,
        currency: "INR",
        unit: "quintal",
        label: "forecast",
        sourceKey: "synthetic:price-forecast-placeholder",
        asOf: new Date().toISOString().slice(0, 10),
        range: { low: 1700, high: 2300 },
      });

    const areaAcres = data.areaAcres ?? parcel.area_acres ?? 1;
    const nearestMarket = prices[0]?.market_name ?? "Nearest mandi";
    const valueAdd = paths.find((p) => p.commodity.toLowerCase() === data.crop.toLowerCase());

    const scenarios = buildOutcomeScenarios({
      crop: data.crop,
      season: location.seasonCode,
      areaAcres,
      profile,
      price,
      harvestWindow: location.harvestWindow,
      targetMarket: nearestMarket,
      valueAddAlternative: valueAdd ? valueAdd.label : "No configured processing path for this crop yet",
      risks: [
        "Rainfall or heat deviation from the current agromet outlook",
        "Mandi price and arrival swings at harvest",
        "Input cost changes during the season",
      ],
    });

    await supabase.from("crop_outcome_scenarios").insert(
      scenarios.map((s) => ({
        farm_id: parcel.id,
        crop: data.crop,
        season_code: location.seasonCode,
        scenario: s.scenario,
        expected_yield_quintal: s.expectedYieldQuintal,
        selling_price: s.sellingPrice,
        selling_price_label: s.sellingPriceLabel,
        total_cost: s.totalCost,
        gross_realization: s.grossRealization,
        net_contribution: s.netContribution,
        break_even_price: s.breakEvenPrice,
        break_even_yield: s.breakEvenYield,
        harvest_window: s.harvestWindow,
        target_market: s.targetMarket,
        value_add_alternative: s.valueAddAlternative,
        risks: s.risks,
        assumptions: s.assumptions,
        created_by: userId,
      })) as never,
    );

    return { scenarios, priceLabel: price.label, priceSource: price.sourceKey };
  });

/* ---------------------------------------------------- escalations */

async function createEscalation(
  supabase: Awaited<ReturnType<typeof requireSupabaseAuth>> extends never ? never : never,
): Promise<never> {
  throw new Error("unused");
}
void createEscalation;

const escalationValidator = (input: {
  farmId: string;
  kind: EscalationKind;
  facilityId?: string | null;
  message?: string | null;
  context?: Record<string, unknown>;
}) => {
  if (!input?.farmId) throw new Error("farm_id_required");
  if (!input?.kind) throw new Error("escalation_kind_required");
  return input;
};

/** Routes the farmer to a human. AI/derived output never decides an outcome. */
export const escalateToHuman = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(escalationValidator)
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const { supabase, userId } = context;
    const { audit } = await import("@/lib/atap/admin.server");
    const { listParcels } = await import("@/lib/atap/intelligence.server");

    const parcels = await listParcels(supabase);
    const parcel = parcels.find((p) => p.id === data.farmId);
    if (!parcel) throw new Error("farm_not_found_or_not_permitted");

    const { data: row, error } = await supabase
      .from("advisory_escalations")
      .insert({
        farm_id: parcel.id,
        requester_user_id: userId,
        subject_user_id: parcel.farmer_user_id,
        kind: data.kind,
        facility_id: data.facilityId ?? null,
        message: data.message ?? null,
        context: (data.context ?? {}) as never,
      } as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await audit(supabase, {
      actor_user_id: userId,
      action: "farm_intelligence.escalate",
      subject_type: "farm_record",
      subject_id: parcel.id,
      purpose_code: "farm_advisory",
      decision: "allow",
      metadata: { kind: data.kind, facility_id: data.facilityId ?? null },
    });

    return { id: (row as { id: string }).id };
  });

/** Thin, explicit wrappers so the UI intent is auditable by name. */
export const requestSoilTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { farmId: string; facilityId?: string | null; message?: string | null }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { listParcels } = await import("@/lib/atap/intelligence.server");
    const parcels = await listParcels(supabase);
    const parcel = parcels.find((p) => p.id === data.farmId);
    if (!parcel) throw new Error("farm_not_found_or_not_permitted");
    const { error } = await supabase.from("advisory_escalations").insert({
      farm_id: parcel.id,
      requester_user_id: userId,
      subject_user_id: parcel.farmer_user_id,
      kind: "book_soil_test",
      facility_id: data.facilityId ?? null,
      message: data.message ?? "Soil test requested from My Farm Intelligence.",
    } as never);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const requestProcessorQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { farmId: string; facilityId?: string | null; commodity: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { listParcels } = await import("@/lib/atap/intelligence.server");
    const parcels = await listParcels(supabase);
    const parcel = parcels.find((p) => p.id === data.farmId);
    if (!parcel) throw new Error("farm_not_found_or_not_permitted");
    const { error } = await supabase.from("advisory_escalations").insert({
      farm_id: parcel.id,
      requester_user_id: userId,
      subject_user_id: parcel.farmer_user_id,
      kind: "request_processor_quote",
      facility_id: data.facilityId ?? null,
      message: `Processor quotation requested for ${data.commodity}. Recovery and cost assumptions to be replaced by the quotation.`,
    } as never);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Tenant/processor-owned recovery assumptions, replacing platform defaults. */
export const saveProcessorAssumptions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      pathId: string;
      steps: Array<{ stepOrder: number; recoveryPct: number; costPerQuintal: number }>;
      assumptionSource?: string;
    }) => {
      if (!input.pathId) throw new Error("path_id_required");
      if (!input.steps?.length) throw new Error("steps_required");
      for (const s of input.steps) {
        if (!(s.recoveryPct > 0 && s.recoveryPct <= 100)) throw new Error("recovery_pct_out_of_range");
      }
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { audit } = await import("@/lib/atap/admin.server");
    for (const step of data.steps) {
      const { error } = await supabase
        .from("processing_path_steps")
        .update({ recovery_pct: step.recoveryPct, cost_per_quintal: step.costPerQuintal } as never)
        .eq("path_id", data.pathId)
        .eq("step_order", step.stepOrder);
      if (error) throw new Error(error.message);
    }
    const { error: defError } = await supabase
      .from("processing_path_definitions")
      .update({ assumption_source: data.assumptionSource ?? "processor_override" } as never)
      .eq("id", data.pathId);
    if (defError) throw new Error(defError.message);

    await audit(supabase, {
      actor_user_id: userId,
      action: "processing_path.assumptions_updated",
      subject_type: "processing_path_definition",
      subject_id: data.pathId,
      decision: "allow",
      metadata: { steps: data.steps.length },
    });
    return { ok: true };
  });
