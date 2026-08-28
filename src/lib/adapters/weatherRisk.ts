/**
 * Weather-risk and crop-calendar adapter seams (slice I2).
 *
 * Development/sandbox implementations are deterministic synthetic feeds. Real
 * IMD/weather, satellite/GIS and state crop-calendar providers plug in behind
 * the same interfaces without touching callers — [VALIDATE data source].
 * Signals are district×crop aggregates; adapters never return plot- or
 * farmer-level data.
 */

export interface WeatherRiskSignal {
  stateName: string;
  district: string;
  crop: string;
  season: string;
  eventType: "drought" | "excess_rain" | "flood" | "hail" | "pest_outbreak" | "heatwave" | "cyclone";
  severity: "watch" | "advisory" | "severe";
  rainfallDeviationPct: number;
  source: string;
  synthetic: boolean;
}

export interface WeatherRiskFeedAdapter {
  readonly name: string;
  signal(input: { stateName: string; district: string; crop: string; season: string }): WeatherRiskSignal;
}

export interface CropCalendarWindow {
  crop: string;
  season: "Kharif" | "Rabi";
  sowingWindow: string;
  harvestWindow: string;
  source: string;
  synthetic: boolean;
}

export interface CropCalendarAdapter {
  readonly name: string;
  window(input: { crop: string }): CropCalendarWindow;
}

function hash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

const EVENTS = ["drought", "excess_rain", "flood", "hail", "pest_outbreak", "heatwave"] as const;
const SEVERITIES = ["watch", "advisory", "severe"] as const;

export const syntheticWeatherRiskFeed: WeatherRiskFeedAdapter = {
  name: "synthetic-weather-risk-feed",
  signal({ stateName, district, crop, season }) {
    return {
      stateName,
      district,
      crop,
      season,
      eventType: EVENTS[hash(`${district}${crop}evt`) % EVENTS.length],
      severity: SEVERITIES[hash(`${district}${crop}sev`) % SEVERITIES.length],
      rainfallDeviationPct: -60 + (hash(`${district}${crop}rain`) % 130),
      source: "synthetic_weather_feed",
      synthetic: true,
    };
  },
};

const CALENDAR: Record<string, CropCalendarWindow> = {
  Paddy: { crop: "Paddy", season: "Kharif", sowingWindow: "Jun–Jul", harvestWindow: "Nov–Dec", source: "synthetic_crop_calendar", synthetic: true },
  Cotton: { crop: "Cotton", season: "Kharif", sowingWindow: "May–Jun", harvestWindow: "Dec–Jan", source: "synthetic_crop_calendar", synthetic: true },
  Chilli: { crop: "Chilli", season: "Kharif", sowingWindow: "Jun–Jul", harvestWindow: "Jan–Feb", source: "synthetic_crop_calendar", synthetic: true },
  Maize: { crop: "Maize", season: "Kharif", sowingWindow: "Jun–Jul", harvestWindow: "Oct–Nov", source: "synthetic_crop_calendar", synthetic: true },
  Turmeric: { crop: "Turmeric", season: "Kharif", sowingWindow: "May–Jun", harvestWindow: "Jan–Mar", source: "synthetic_crop_calendar", synthetic: true },
  Groundnut: { crop: "Groundnut", season: "Kharif", sowingWindow: "Jun–Jul", harvestWindow: "Oct–Nov", source: "synthetic_crop_calendar", synthetic: true },
};

export const syntheticCropCalendar: CropCalendarAdapter = {
  name: "synthetic-crop-calendar",
  window({ crop }) {
    return (
      CALENDAR[crop] ?? {
        crop,
        season: "Kharif",
        sowingWindow: "Jun–Jul",
        harvestWindow: "Nov–Dec",
        source: "synthetic_crop_calendar",
        synthetic: true,
      }
    );
  },
};
