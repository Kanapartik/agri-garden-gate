import { describe, expect, it } from "vitest";
import {
  buildAlertDetail,
  buildAlertTitle,
  cellOnWatchlist,
  exposureByDistrict,
  exposureForDistrict,
  filterRiskCells,
  ruleMatchesCell,
  severityAtLeast,
  summarizeRisk,
  uniqueStates,
  type AlertRuleRow,
  type RiskCellRow,
  type WatchlistRow,
} from "@/lib/atap/insurerRisk";
import { syntheticCropCalendar, syntheticWeatherRiskFeed } from "@/lib/adapters/weatherRisk";

function cell(over: Partial<RiskCellRow> = {}): RiskCellRow {
  return {
    id: "c1",
    state_name: "Andhra Pradesh",
    district: "Guntur",
    crop: "Chilli",
    season: "Kharif",
    event_type: "drought",
    severity: "advisory",
    rainfall_deviation_pct: -55,
    affected_acres: 12000,
    affected_fpos: 14,
    observed_at: "2026-06-01T00:00:00Z",
    source: "synthetic_weather_feed",
    ...over,
  };
}

function rule(over: Partial<AlertRuleRow> = {}): AlertRuleRow {
  return {
    id: "r1",
    insurer_tenant_id: "t1",
    name: "Severe drought",
    event_type: "drought",
    min_severity: "advisory",
    rainfall_deviation_threshold_pct: null,
    active: true,
    ...over,
  };
}

describe("severity ordering", () => {
  it("orders watch < advisory < severe", () => {
    expect(severityAtLeast("severe", "advisory")).toBe(true);
    expect(severityAtLeast("watch", "advisory")).toBe(false);
    expect(severityAtLeast("advisory", "advisory")).toBe(true);
  });
});

describe("ruleMatchesCell", () => {
  it("matches event, severity and rainfall threshold", () => {
    expect(ruleMatchesCell(rule(), cell())).toBe(true);
    expect(ruleMatchesCell(rule({ event_type: "flood" }), cell())).toBe(false);
    expect(ruleMatchesCell(rule({ min_severity: "severe" }), cell())).toBe(false);
    expect(ruleMatchesCell(rule({ active: false }), cell())).toBe(false);
  });

  it("applies absolute rainfall deviation thresholds", () => {
    expect(ruleMatchesCell(rule({ rainfall_deviation_threshold_pct: 50 }), cell())).toBe(true);
    expect(ruleMatchesCell(rule({ rainfall_deviation_threshold_pct: 60 }), cell())).toBe(false);
    expect(
      ruleMatchesCell(rule({ rainfall_deviation_threshold_pct: 50 }), cell({ rainfall_deviation_pct: null })),
    ).toBe(false);
  });

  it("event-agnostic rules match any event", () => {
    expect(ruleMatchesCell(rule({ event_type: null }), cell({ event_type: "cyclone" }))).toBe(true);
  });
});

describe("alert text", () => {
  it("builds advisory titles and details with an explicit non-claims note", () => {
    expect(buildAlertTitle(cell())).toContain("Drought — Guntur");
    const detail = buildAlertDetail(cell());
    expect(detail).toContain("Rainfall deviation");
    expect(detail).toContain("no claim action");
  });
});

describe("watchlist and exposure", () => {
  it("matches cells against watchlist entries", () => {
    const watch: WatchlistRow[] = [
      { id: "w1", insurer_tenant_id: "t1", state_name: "Andhra Pradesh", district: "Guntur", crop: "Chilli", season: "Kharif", notes: null },
    ];
    expect(cellOnWatchlist(cell(), watch)).toBe(true);
    expect(cellOnWatchlist(cell({ crop: "Cotton" }), watch)).toBe(false);
  });

  it("rolls channel exposure up per district with aggregates only", () => {
    const channel = [
      { registration_number: "R1", fpo_name: "A", district: "Guntur", member_count: 100, insured_members: 40, policies_count: 2, premium_inr: 5000 },
      { registration_number: "R2", fpo_name: "B", district: "Guntur", member_count: 80, insured_members: 10, policies_count: 1, premium_inr: 2000 },
      { registration_number: "R3", fpo_name: "C", district: "Khammam", member_count: 50, insured_members: 0, policies_count: 0, premium_inr: 0 },
    ];
    const rolled = exposureByDistrict(channel);
    expect(rolled[0]?.district).toBe("Guntur");
    expect(rolled[0]?.fpos).toBe(2);
    expect(rolled[0]?.insuredMembers).toBe(50);
    expect(exposureForDistrict(channel, "Nowhere").fpos).toBe(0);
  });
});

describe("filtering and summary", () => {
  const cells = [
    cell({ id: "a", severity: "severe", affected_acres: 5000, affected_fpos: 3 }),
    cell({ id: "b", state_name: "Telangana", district: "Khammam", event_type: "flood", affected_acres: 7000, affected_fpos: 5 }),
  ];

  it("filters by state, severity and event", () => {
    expect(filterRiskCells(cells, { state: "Telangana" })).toHaveLength(1);
    expect(filterRiskCells(cells, { severity: "severe" })).toHaveLength(1);
    expect(filterRiskCells(cells, { event: "flood" })).toHaveLength(1);
    expect(filterRiskCells(cells, {})).toHaveLength(2);
  });

  it("summarises aggregate figures", () => {
    const s = summarizeRisk(cells);
    expect(s.total).toBe(2);
    expect(s.severe).toBe(1);
    expect(s.acres).toBe(12000);
    expect(s.fpos).toBe(8);
  });

  it("lists unique states sorted", () => {
    expect(uniqueStates(cells)).toEqual(["Andhra Pradesh", "Telangana"]);
  });
});

describe("synthetic adapters", () => {
  it("weather feed is deterministic and aggregate-only", () => {
    const a = syntheticWeatherRiskFeed.signal({
      stateName: "Andhra Pradesh",
      district: "Guntur",
      crop: "Chilli",
      season: "Kharif",
    });
    const b = syntheticWeatherRiskFeed.signal({
      stateName: "Andhra Pradesh",
      district: "Guntur",
      crop: "Chilli",
      season: "Kharif",
    });
    expect(a).toEqual(b);
    expect(a.synthetic).toBe(true);
  });

  it("crop calendar returns a window for known and unknown crops", () => {
    expect(syntheticCropCalendar.window({ crop: "Paddy" }).season).toBe("Kharif");
    expect(syntheticCropCalendar.window({ crop: "Dragonfruit" }).synthetic).toBe(true);
  });
});
