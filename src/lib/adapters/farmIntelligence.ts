/**
 * B2A farm-intelligence adapter seams.
 *
 * Interfaces plus synthetic implementations only. No live IMD / Soil Health
 * Card / ICAR-CRIDA / e-NAM / AGMARKNET / SFAC call exists in this slice; every
 * response is deterministic, marked `synthetic: true` and carries a freshness
 * stamp. Real providers plug in behind these interfaces — [VALIDATE provider].
 */
import type {
  ByproductAssumption,
  GeoPoint,
  SeasonCode,
  SoilGeneral,
  SoilLabResult,
} from "@/lib/atap/intelligence";

export interface AdapterEnvelope {
  sourceKey: string;
  adapterName: string;
  observedAt: string;
  fetchedAt: string;
  freshnessSeconds: number;
  confidence: number;
  synthetic: boolean;
}

function envelope(sourceKey: string, adapterName: string, ageSeconds: number, confidence: number): AdapterEnvelope {
  const now = Date.now();
  return {
    sourceKey,
    adapterName,
    observedAt: new Date(now - ageSeconds * 1000).toISOString(),
    fetchedAt: new Date(now).toISOString(),
    freshnessSeconds: ageSeconds,
    confidence,
    synthetic: true,
  };
}

/** Deterministic pseudo-variation so synthetic data differs per parcel. */
function seedFrom(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i += 1) h = (h * 31 + key.charCodeAt(i)) % 100_000;
  return h;
}

/* ------------------------------------------------------ agromet ------ */

export interface AgrometReading {
  current: {
    temperatureC: number;
    humidityPct: number;
    windKph: number;
    rainfallMm24h: number;
    conditions: string;
  };
  forecast: Array<{ date: string; minC: number; maxC: number; rainfallMm: number; conditions: string }>;
  alerts: Array<{ kind: "rain" | "heat" | "wind"; severity: "advisory" | "watch" | "warning"; message: string }>;
  advisories: string[];
  envelope: AdapterEnvelope;
}

export interface AgrometAdapter {
  readonly name: string;
  /** Block/district-level agromet, shaped after IMD Mausam / SANKALP views. */
  read(input: { point: GeoPoint; districtName: string | null; blockName?: string | null }): Promise<AgrometReading>;
}

export const syntheticAgromet: AgrometAdapter = {
  name: "synthetic-agromet-imd",
  async read({ point, districtName }) {
    const seed = seedFrom(`${point.lat.toFixed(2)}:${point.lng.toFixed(2)}`);
    const baseTemp = 27 + (seed % 7);
    const rain = (seed % 5) * 4.5;
    const forecast = Array.from({ length: 5 }, (_, i) => {
      const d = new Date(Date.now() + (i + 1) * 86_400_000);
      const dayRain = ((seed + i * 13) % 6) * 3.2;
      return {
        date: d.toISOString().slice(0, 10),
        minC: baseTemp - 6 + (i % 2),
        maxC: baseTemp + 4 + (i % 3),
        rainfallMm: Math.round(dayRain * 10) / 10,
        conditions: dayRain > 8 ? "Rain likely" : dayRain > 2 ? "Isolated showers" : "Mainly dry",
      };
    });
    const alerts: AgrometReading["alerts"] = [];
    if (forecast.some((f) => f.rainfallMm > 12)) {
      alerts.push({
        kind: "rain",
        severity: "watch",
        message: `Heavy rain possible in ${districtName ?? "your district"} within the forecast window. Plan drainage and delay top-dressing.`,
      });
    }
    if (baseTemp + 4 >= 38) {
      alerts.push({ kind: "heat", severity: "advisory", message: "Day temperatures near heat-stress levels; irrigate in the evening." });
    }
    if (seed % 11 === 0) {
      alerts.push({ kind: "wind", severity: "advisory", message: "Gusty winds expected; avoid spraying operations." });
    }
    return {
      current: {
        temperatureC: baseTemp,
        humidityPct: 55 + (seed % 30),
        windKph: 6 + (seed % 12),
        rainfallMm24h: Math.round(rain * 10) / 10,
        conditions: rain > 10 ? "Rain" : rain > 2 ? "Cloudy with showers" : "Partly cloudy",
      },
      forecast,
      alerts,
      advisories: [
        "Agromet guidance is district/block level. Confirm field-level decisions with your KVK or extension centre.",
        rain > 10
          ? "Recent rainfall recorded — hold off on irrigation and check field drainage."
          : "No significant recent rainfall — check soil moisture before the next irrigation.",
      ],
      envelope: envelope("synthetic:imd-mausam-sankalp", "synthetic-agromet-imd", 1800, 0.7),
    };
  },
};

/* --------------------------------------------------------- soil ------ */

export interface SoilReading {
  general: SoilGeneral;
  /** Non-null only when a Soil Health Card / lab test exists for this farm. */
  lab: SoilLabResult | null;
  envelope: AdapterEnvelope;
}

export interface SoilHealthAdapter {
  readonly name: string;
  read(input: { plotRef: string; districtName: string | null }): Promise<SoilReading>;
}

const DISTRICT_SOILS: Record<string, { majorSoils: string[]; texture: string }> = {
  Guntur: { majorSoils: ["Black cotton (vertisol)", "Sandy loam"], texture: "Clayey to sandy loam" },
  Kurnool: { majorSoils: ["Red sandy loam", "Shallow black"], texture: "Sandy loam" },
  Warangal: { majorSoils: ["Red chalka", "Black clayey"], texture: "Loamy sand to clay" },
  Nizamabad: { majorSoils: ["Deep black", "Red loam"], texture: "Clay loam" },
};

export const syntheticSoilHealth: SoilHealthAdapter = {
  name: "synthetic-soil-health-card",
  async read({ plotRef, districtName }) {
    const seed = seedFrom(plotRef);
    const district = DISTRICT_SOILS[districtName ?? ""] ?? {
      majorSoils: ["Mixed red and black soils"],
      texture: "Loam",
    };
    const general: SoilGeneral = {
      majorSoils: district.majorSoils,
      texture: district.texture,
      phRange: "6.5 – 8.2",
      organicCarbonRange: "0.35 – 0.62 %",
      sourceKey: "synthetic:icar-crida-district-profile",
      observedAt: new Date(Date.now() - 86_400_000 * 30).toISOString(),
    };
    // Only some parcels have an actual card — the rest must show "inferred".
    const hasCard = seed % 3 === 0;
    const lab: SoilLabResult | null = hasCard
      ? {
          cardRef: `SHC-SYN-${(seed % 9000) + 1000}`,
          labName: `District Soil Testing Lab, ${districtName ?? "Anchor district"} (synthetic)`,
          labKind: "government",
          testedOn: new Date(Date.now() - 86_400_000 * 90).toISOString().slice(0, 10),
          ph: Math.round((6.6 + (seed % 15) / 10) * 10) / 10,
          organicCarbonPct: Math.round((0.35 + (seed % 25) / 100) * 100) / 100,
          nitrogen: seed % 2 === 0 ? "Low" : "Medium",
          phosphorus: seed % 3 === 0 ? "Medium" : "High",
          potassium: "Medium",
          sourceKey: "synthetic:soil-health-card",
        }
      : null;
    return { general, lab, envelope: envelope("synthetic:soil-health-card", "synthetic-soil-health-card", 86_400, 0.65) };
  },
};

/* ---------------------------------------------- district profile ----- */

export interface DistrictProfile {
  districtName: string;
  agroClimaticZone: string;
  majorSoils: string[];
  irrigationSources: string[];
  majorCrops: Array<{ crop: string; variety: string | null; season: SeasonCode; sowingWindow: string; typicalYieldPerAcre: number; typicalCostPerAcre: number }>;
  envelope: AdapterEnvelope;
}

export interface DistrictProfileAdapter {
  readonly name: string;
  /** Shaped after the ICAR-CRIDA district agriculture contingency profile. */
  read(input: { districtName: string | null; stateName: string | null }): Promise<DistrictProfile>;
}

const DISTRICT_PROFILES: Record<string, Omit<DistrictProfile, "envelope">> = {
  Guntur: {
    districtName: "Guntur",
    agroClimaticZone: "Krishna–Godavari zone (AP)",
    majorSoils: ["Black cotton (vertisol)", "Sandy loam"],
    irrigationSources: ["Canal (Krishna delta)", "Borewell"],
    majorCrops: [
      { crop: "Paddy", variety: "MTU-1061", season: "kharif", sowingWindow: "Jun–Jul", typicalYieldPerAcre: 26, typicalCostPerAcre: 32000 },
      { crop: "Chilli", variety: "Teja", season: "rabi", sowingWindow: "Sep–Oct", typicalYieldPerAcre: 9, typicalCostPerAcre: 78000 },
      { crop: "Cotton", variety: "Medium staple", season: "kharif", sowingWindow: "Jun–Jul", typicalYieldPerAcre: 8, typicalCostPerAcre: 36000 },
    ],
  },
  Kurnool: {
    districtName: "Kurnool",
    agroClimaticZone: "Scarce rainfall zone (AP)",
    majorSoils: ["Red sandy loam", "Shallow black"],
    irrigationSources: ["Borewell", "Tank", "Rainfed"],
    majorCrops: [
      { crop: "Bengal Gram", variety: "Desi", season: "rabi", sowingWindow: "Oct–Nov", typicalYieldPerAcre: 7, typicalCostPerAcre: 21000 },
      { crop: "Groundnut", variety: "Bold", season: "kharif", sowingWindow: "Jun–Jul", typicalYieldPerAcre: 8, typicalCostPerAcre: 26000 },
      { crop: "Maize", variety: "Hybrid", season: "rabi", sowingWindow: "Oct–Nov", typicalYieldPerAcre: 24, typicalCostPerAcre: 28000 },
    ],
  },
  Warangal: {
    districtName: "Warangal",
    agroClimaticZone: "Central Telangana zone",
    majorSoils: ["Red chalka", "Black clayey"],
    irrigationSources: ["Borewell", "Tank", "Lift irrigation"],
    majorCrops: [
      { crop: "Paddy", variety: "MTU-1010", season: "kharif", sowingWindow: "Jun–Jul", typicalYieldPerAcre: 25, typicalCostPerAcre: 31000 },
      { crop: "Cotton", variety: "Medium staple", season: "kharif", sowingWindow: "Jun–Jul", typicalYieldPerAcre: 7.5, typicalCostPerAcre: 35000 },
      { crop: "Maize", variety: "Hybrid", season: "rabi", sowingWindow: "Oct–Nov", typicalYieldPerAcre: 23, typicalCostPerAcre: 27000 },
    ],
  },
  Nizamabad: {
    districtName: "Nizamabad",
    agroClimaticZone: "Northern Telangana zone",
    majorSoils: ["Deep black", "Red loam"],
    irrigationSources: ["Canal (Sriram Sagar)", "Borewell"],
    majorCrops: [
      { crop: "Paddy", variety: "BPT-5204", season: "kharif", sowingWindow: "Jun–Jul", typicalYieldPerAcre: 27, typicalCostPerAcre: 33000 },
      { crop: "Turmeric", variety: "Nizamabad bulb", season: "kharif", sowingWindow: "May–Jun", typicalYieldPerAcre: 22, typicalCostPerAcre: 92000 },
      { crop: "Maize", variety: "Hybrid", season: "rabi", sowingWindow: "Oct–Nov", typicalYieldPerAcre: 25, typicalCostPerAcre: 28000 },
    ],
  },
};

export const syntheticDistrictProfile: DistrictProfileAdapter = {
  name: "synthetic-icar-crida-profile",
  async read({ districtName, stateName }) {
    const fallback: Omit<DistrictProfile, "envelope"> = {
      districtName: districtName ?? "Anchor district",
      agroClimaticZone: `${stateName ?? "Anchor state"} agro-climatic zone [VALIDATE mapping]`,
      majorSoils: ["Mixed red and black soils"],
      irrigationSources: ["Borewell", "Rainfed"],
      majorCrops: [
        { crop: "Paddy", variety: null, season: "kharif", sowingWindow: "Jun–Jul", typicalYieldPerAcre: 24, typicalCostPerAcre: 31000 },
        { crop: "Maize", variety: "Hybrid", season: "rabi", sowingWindow: "Oct–Nov", typicalYieldPerAcre: 22, typicalCostPerAcre: 27000 },
      ],
    };
    const profile = DISTRICT_PROFILES[districtName ?? ""] ?? fallback;
    return {
      ...profile,
      envelope: envelope("synthetic:icar-crida-district-profile", "synthetic-icar-crida-profile", 604_800, 0.6),
    };
  },
};

/* --------------------------------------------------- market price ---- */

export interface MarketPriceQuote {
  marketName: string;
  districtName: string | null;
  stateName: string | null;
  latitude: number | null;
  longitude: number | null;
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
  sourceKey: string;
}

export interface MarketPriceAdapter {
  readonly name: string;
  /** min/modal/max shaped after e-NAM and the AGMARKNET-derived open dataset. */
  latest(input: { commodities: readonly string[]; stateName: string | null }): Promise<{
    quotes: MarketPriceQuote[];
    envelope: AdapterEnvelope;
  }>;
}

/**
 * Development adapter: prices come from the seeded synthetic
 * `market_price_observations` rows, so the adapter here only reports its
 * envelope. A real e-NAM/AGMARKNET client replaces this — [VALIDATE provider].
 */
export const syntheticMarketPrice: MarketPriceAdapter = {
  name: "synthetic-market-price",
  async latest() {
    return {
      quotes: [],
      envelope: envelope("synthetic:agmarknet", "synthetic-market-price", 86_400, 0.75),
    };
  },
};

/* ------------------------------------------------------ FPO registry - */

export interface FpoRegistryAdapter {
  readonly name: string;
  /** Shaped after the SFAC state-wise registered FPO listing. */
  listByState(input: { stateName: string }): Promise<{
    fpos: Array<{ name: string; districtName: string; latitude: number; longitude: number }>;
    envelope: AdapterEnvelope;
  }>;
}

export const syntheticFpoRegistry: FpoRegistryAdapter = {
  name: "synthetic-sfac-fpo-registry",
  async listByState({ stateName }) {
    const rows =
      stateName === "Telangana"
        ? [
            { name: "Warangal Paddy FPO (synthetic)", districtName: "Warangal", latitude: 17.9784, longitude: 79.5941 },
            { name: "Nizamabad Turmeric FPO (synthetic)", districtName: "Nizamabad", latitude: 18.6725, longitude: 78.0941 },
          ]
        : [
            { name: "Guntur Chilli FPO (synthetic)", districtName: "Guntur", latitude: 16.3067, longitude: 80.4365 },
            { name: "Kurnool Millets FPO (synthetic)", districtName: "Kurnool", latitude: 15.8281, longitude: 78.0373 },
          ];
    return {
      fpos: rows,
      envelope: envelope("synthetic:sfac-fpo-registry", "synthetic-sfac-fpo-registry", 2_592_000, 0.5),
    };
  },
};

/* ------------------------------------------------- processor quotes -- */

export interface ProcessorQuoteAdapter {
  readonly name: string;
  /**
   * Returns configurable milling assumptions from a processor. Nothing here is a
   * universal recovery constant; a real quotation replaces these values.
   */
  quote(input: { commodity: string; processorName: string }): Promise<{
    assumptionSource: string;
    byproducts: ByproductAssumption[];
    envelope: AdapterEnvelope;
  }>;
}

export const syntheticProcessorQuote: ProcessorQuoteAdapter = {
  name: "synthetic-processor-quote",
  async quote({ processorName }) {
    return {
      assumptionSource: `processor_quotation:${processorName}`,
      byproducts: [
        { name: "Bran", yield_pct: 6, price_per_quintal: 2200 },
        { name: "Broken rice", yield_pct: 2, price_per_quintal: 1900 },
        { name: "Husk", yield_pct: 20, price_per_quintal: 180 },
      ],
      envelope: envelope("synthetic:processor-quote", "synthetic-processor-quote", 3600, 0.8),
    };
  },
};

export const farmIntelligenceAdapters = {
  agromet: syntheticAgromet,
  soilHealth: syntheticSoilHealth,
  districtProfile: syntheticDistrictProfile,
  marketPrice: syntheticMarketPrice,
  fpoRegistry: syntheticFpoRegistry,
  processorQuote: syntheticProcessorQuote,
} as const;
