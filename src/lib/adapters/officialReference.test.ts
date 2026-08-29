import { describe, expect, it } from "vitest";
import {
  cropCategoryFor,
  lookupFarmerSharePct,
  lookupMsp,
  overlayOfficialMsp,
  summariseOfficialReference,
  type OfficialInsuranceShareRow,
  type OfficialMspRow,
} from "./officialReference";

const msp = (crop: string, year: number, price: number): OfficialMspRow => ({
  crop,
  crop_year: year,
  season_code: "kharif",
  variety_label: "common",
  msp_per_quintal: price,
  source: "cacp_msp",
  notification_ref: `CACP MSP ${year}`,
});

const row = (crop: string, year: number, price: number) => ({
  crop,
  crop_year: year,
  typical_price_per_quintal: price,
  price_low_per_quintal: price * 0.9,
  price_high_per_quintal: price * 1.1,
  source: "synthetic_baseline",
});

describe("official MSP lookup", () => {
  const rows = [msp("Paddy", 2024, 2300), msp("Paddy", 2025, 2369)];

  it("returns an exact crop-year match", () => {
    const hit = lookupMsp(rows, "paddy", 2025);
    expect(hit?.row.msp_per_quintal).toBe(2369);
    expect(hit?.nearestYear).toBeNull();
  });

  it("falls back to the nearest year and flags it", () => {
    const hit = lookupMsp(rows, "Paddy", 2021);
    expect(hit?.row.crop_year).toBe(2024);
    expect(hit?.nearestYear).toBe(2024);
  });

  it("returns null for crops with no notified MSP", () => {
    expect(lookupMsp(rows, "Turmeric", 2025)).toBeNull();
  });
});

describe("overlayOfficialMsp", () => {
  it("replaces the typical price with the notified MSP and keeps a band", () => {
    const result = overlayOfficialMsp([row("Paddy", 2025, 2000)], [msp("Paddy", 2025, 2369)]);
    expect(result.matched).toBe(1);
    expect(result.rows[0]!.typical_price_per_quintal).toBe(2369);
    expect(result.rows[0]!.price_low_per_quintal).toBeLessThan(2369);
    expect(result.rows[0]!.price_high_per_quintal).toBeGreaterThan(2369);
    expect(result.rows[0]!.source).toBe("cacp_msp");
  });

  it("leaves crops without MSP untouched and reports them", () => {
    const result = overlayOfficialMsp(
      [row("Paddy", 2025, 2000), row("Turmeric", 2025, 7000)],
      [msp("Paddy", 2025, 2369)],
    );
    expect(result.matched).toBe(1);
    expect(result.unmatched).toBe(1);
    expect(result.cropsWithoutMsp).toEqual(["Turmeric"]);
    expect(result.rows[1]!.typical_price_per_quintal).toBe(7000);
  });

  it("is a no-op when no official rows are loaded", () => {
    const result = overlayOfficialMsp([row("Paddy", 2025, 2000)], []);
    expect(result.matched).toBe(0);
    expect(result.sources).toEqual([]);
    expect(result.rows[0]!.typical_price_per_quintal).toBe(2000);
  });

  it("marks a nearest-year substitution in the source", () => {
    const result = overlayOfficialMsp([row("Paddy", 2021, 1800)], [msp("Paddy", 2024, 2300)]);
    expect(result.rows[0]!.source).toBe("cacp_msp:nearest_year_2024");
  });
});

describe("notified farmer share caps", () => {
  const shares: OfficialInsuranceShareRow[] = [
    {
      scheme_code: "PMFBY",
      season_code: "kharif",
      crop_category: "food_and_oilseed",
      farmer_share_pct: 2,
      source: "pmfby_operational_guidelines",
      notification_ref: null,
    },
    {
      scheme_code: "PMFBY",
      season_code: "rabi",
      crop_category: "food_and_oilseed",
      farmer_share_pct: 1.5,
      source: "pmfby_operational_guidelines",
      notification_ref: null,
    },
    {
      scheme_code: "PMFBY",
      season_code: "annual",
      crop_category: "commercial_or_horticultural",
      farmer_share_pct: 5,
      source: "pmfby_operational_guidelines",
      notification_ref: null,
    },
  ];

  it("classifies commercial crops separately", () => {
    expect(cropCategoryFor("Cotton")).toBe("commercial_or_horticultural");
    expect(cropCategoryFor("paddy")).toBe("food_and_oilseed");
  });

  it("returns 2% for kharif food crops and 1.5% for rabi", () => {
    expect(lookupFarmerSharePct(shares, { crop: "Paddy", seasonCode: "kharif" })?.farmer_share_pct).toBe(2);
    expect(lookupFarmerSharePct(shares, { crop: "Paddy", seasonCode: "rabi" })?.farmer_share_pct).toBe(1.5);
  });

  it("falls back to the annual row for commercial crops", () => {
    expect(lookupFarmerSharePct(shares, { crop: "Chilli", seasonCode: "kharif" })?.farmer_share_pct).toBe(5);
  });

  it("returns null when nothing notified covers the combination", () => {
    expect(lookupFarmerSharePct(shares, { crop: "Paddy", seasonCode: "zaid", schemeCode: "OTHER" })).toBeNull();
  });
});

describe("summariseOfficialReference", () => {
  it("reports price as official but keeps yield and cost indicative", () => {
    const overlay = overlayOfficialMsp([row("Paddy", 2025, 2000)], [msp("Paddy", 2025, 2369)]);
    const summary = summariseOfficialReference({
      mspRows: [msp("Paddy", 2025, 2369)],
      overlay,
      shareRow: null,
      loads: [
        {
          dataset_code: "cacp_msp_2021_2025",
          dataset_label: "CACP MSP",
          source_citation: "CACP, GoI",
          row_count: 25,
          coverage_note: null,
          validate_notes: null,
        },
      ],
    });
    expect(summary.fields).toEqual({
      price: "official",
      yieldPerAcre: "indicative",
      costPerAcre: "indicative",
    });
    expect(summary.datasets).toHaveLength(1);
    expect(summary.notes.some((n) => n.includes("not a guaranteed sale price"))).toBe(true);
  });

  it("stays fully indicative when nothing is loaded", () => {
    const overlay = overlayOfficialMsp([row("Turmeric", 2025, 7000)], []);
    const summary = summariseOfficialReference({ mspRows: [], overlay, shareRow: null, loads: [] });
    expect(summary.fields.price).toBe("indicative");
    expect(summary.farmerSharePctOfficial).toBe(false);
    expect(summary.mspRowsLoaded).toBe(0);
  });
});
