import { describe, expect, it } from "vitest";
import { navItemsForRoles } from "@/components/atap/AppShell";
import {
  canMoveStage,
  conversionPct,
  filterChannel,
  filterMarket,
  formatInr,
  marketOpportunity,
  nextStage,
  opportunityScore,
  penetrationPct,
  scoreBand,
  scoreDrivers,
  summarizeChannel,
  summarizeFunnel,
  summarizeMarket,
  uniqueSorted,
  type ChannelRow,
  type FunnelRow,
  type MarketCellRow,
} from "@/lib/atap/insurerRevenue";

const cell = (over: Partial<MarketCellRow> = {}): MarketCellRow => ({
  state_name: "Andhra Pradesh",
  district: "Guntur",
  crop: "Chilli",
  potential_farmers: 1000,
  cultivated_acres: 2000,
  insured_farmers: 250,
  insured_acres: 500,
  premium_per_acre: 900,
  source: "synthetic",
  last_verified: "2026-08-28",
  ...over,
});

const channel = (over: Partial<ChannelRow> = {}): ChannelRow => ({
  id: over.id ?? "c1",
  insurer_tenant_id: "t1",
  registration_number: over.registration_number ?? "U01100AP2020PTC000001",
  fpo_name: over.fpo_name ?? "Guntur Chilli Growers FPO",
  state_name: "Andhra Pradesh",
  district: "Guntur",
  block_mandal: null,
  commodity_group: "Spices",
  primary_commodity: "Chilli",
  member_count: 1500,
  cultivated_acres: 3000,
  insured_members: 0,
  policies_count: 0,
  premium_inr: 0,
  potential_premium_inr: 1_500_000,
  accessibility: "easy",
  owner_name: null,
  opportunity_score: 90,
  score_drivers: [],
  last_reviewed: null,
  ...over,
});

const funnelRow = (stage: FunnelRow["stage"], id: string): FunnelRow => ({
  id,
  registration_number: `REG-${id}`,
  fpo_name: `FPO ${id}`,
  state_name: "Telangana",
  district: "Warangal",
  stage,
  farmer_count: 100,
  acres: 200,
  premium_opportunity_inr: 100_000,
  owner_name: null,
});

describe("insurer market maths", () => {
  it("derives penetration, uninsured farmers and premium potential per cell", () => {
    const o = marketOpportunity(cell());
    expect(o.penetration).toBe(25);
    expect(o.uninsured_farmers).toBe(750);
    expect(o.opportunity_acres).toBe(1500);
    expect(o.premium_potential_inr).toBe(1_350_000);
  });

  it("never reports negative opportunity when insured exceeds the baseline", () => {
    const o = marketOpportunity(cell({ insured_farmers: 1200, insured_acres: 2500 }));
    expect(o.uninsured_farmers).toBe(0);
    expect(o.opportunity_acres).toBe(0);
    expect(o.premium_potential_inr).toBe(0);
  });

  it("summarises and filters market cells without leaking other districts", () => {
    const rows = [cell(), cell({ district: "Warangal", state_name: "Telangana" })].map(
      marketOpportunity,
    );
    expect(summarizeMarket(rows).districts).toBe(2);
    expect(filterMarket(rows, { state: "Telangana" })).toHaveLength(1);
    expect(penetrationPct(0, 0)).toBe(0);
  });
});

describe("advisory opportunity score", () => {
  it("scores a large, wholly uninsured, high-value FPO near the maximum", () => {
    const score = opportunityScore(channel());
    expect(score).toBeGreaterThanOrEqual(90);
    expect(scoreBand(score)).toBe("priority");
  });

  it("gives an already fully insured FPO no penetration-gap points", () => {
    const drivers = scoreDrivers(channel({ insured_members: 1500 }));
    expect(drivers.find((d) => d.key === "penetration_gap")?.points).toBe(0);
  });

  it("penalises missing data and bands the result low", () => {
    const score = opportunityScore(
      channel({
        member_count: null,
        cultivated_acres: null,
        commodity_group: null,
        primary_commodity: null,
        accessibility: null,
        potential_premium_inr: 0,
      }),
    );
    expect(score).toBeLessThan(40);
    expect(scoreBand(score)).toBe("watch");
  });
});

describe("channel board", () => {
  it("filters by band and search, and rolls up penetration and ownership gaps", () => {
    const rows = [
      channel(),
      channel({ id: "c2", fpo_name: "Warangal Turmeric FPO", opportunity_score: 20, owner_name: "Asha" }),
    ];
    expect(filterChannel(rows, { band: "priority" })).toHaveLength(1);
    expect(filterChannel(rows, { search: "turmeric" })).toHaveLength(1);
    const totals = summarizeChannel(rows);
    expect(totals.fpos).toBe(2);
    expect(totals.unowned).toBe(1);
    expect(totals.penetration).toBe(0);
  });
});

describe("acquisition funnel", () => {
  it("summarises every stage including dropped", () => {
    const summary = summarizeFunnel([funnelRow("lead", "a"), funnelRow("dropped", "b")]);
    expect(summary).toHaveLength(9);
    expect(summary.find((s) => s.stage === "lead")?.fpos).toBe(1);
  });

  it("counts conversion as FPOs that reached the stage or beyond", () => {
    const rows = [funnelRow("lead", "a"), funnelRow("verified", "b")];
    expect(conversionPct(rows, "lead")).toBe(100);
    expect(conversionPct(rows, "verified")).toBe(50);
  });

  it("allows only adjacent moves, explicit drops and reinstatement", () => {
    expect(canMoveStage("lead", "contacted")).toBe(true);
    expect(canMoveStage("contacted", "lead")).toBe(true);
    expect(canMoveStage("lead", "enrolled")).toBe(false);
    expect(canMoveStage("lead", "dropped")).toBe(true);
    expect(canMoveStage("enrolled", "dropped")).toBe(false);
    expect(canMoveStage("dropped", "lead")).toBe(true);
    expect(canMoveStage("dropped", "verified")).toBe(false);
    expect(nextStage("enrolled")).toBeNull();
    expect(nextStage("lead")).toBe("contacted");
  });
});

describe("presentation helpers", () => {
  it("formats Indian currency in lakh and crore", () => {
    expect(formatInr(1_500_000)).toBe("₹15.00 L");
    expect(formatInr(120_000_000)).toBe("₹12.00 Cr");
    expect(formatInr(4_200)).toBe("₹4,200");
  });

  it("drops blanks when building filter option lists", () => {
    expect(uniqueSorted(["Guntur", null, "", "Guntur", "Krishna"])).toEqual(["Guntur", "Krishna"]);
  });
});

describe("insurer navigation", () => {
  it("exposes the insurer workspace to insurer-tenant members and oversight roles only", () => {
    const labels = (roles: Parameters<typeof navItemsForRoles>[0], tenantTypes: string[] = []) =>
      navItemsForRoles(roles, true, tenantTypes).map((i) => i.label);
    expect(labels(["tenant_admin"], ["insurer"])).toContain("Insurer revenue");
    expect(labels(["auditor"])).toContain("Insurer revenue");
    expect(labels(["viewer"])).not.toContain("Insurer revenue");
    expect(labels(["field_agent"])).not.toContain("Insurer revenue");
    // An FPO tenant_admin with no insurer membership must not see insurer menus.
    expect(labels(["tenant_admin"], ["fpo"])).not.toContain("Insurer revenue");
  });
});
