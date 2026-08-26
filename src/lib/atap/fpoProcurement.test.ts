import { describe, expect, it } from "vitest";
import {
  aggregateDemand,
  authorizationGate,
  campaignCounts,
  canManageProcurement,
  canRecordDemand,
  canSelectSupplier,
  canTransitionCampaign,
  compareQuotes,
  derivePaymentState,
  landedCost,
  nextCampaignStatuses,
  settlementSummary,
} from "@/lib/atap/fpoProcurement";

describe("procurement lifecycle", () => {
  it("allows only the documented forward transitions", () => {
    expect(canTransitionCampaign("draft", "collecting_demand")).toBe(true);
    expect(canTransitionCampaign("quotes_received", "supplier_selected")).toBe(true);
    expect(canTransitionCampaign("draft", "ordered")).toBe(false);
    expect(canTransitionCampaign("closed", "ordered")).toBe(false);
  });

  it("lets a campaign step back one stage for correction but never out of a terminal state", () => {
    expect(nextCampaignStatuses("rfq_open")).toContain("aggregated");
    expect(nextCampaignStatuses("cancelled")).toEqual([]);
  });
});

describe("procurement authorization", () => {
  it("keeps ordering and supplier selection with FPO admins", () => {
    expect(canManageProcurement(["tenant_admin"])).toBe(true);
    expect(canManageProcurement(["viewer"])).toBe(false);
    expect(canSelectSupplier(["field_agent"])).toBe(false);
  });

  it("lets field agents record member demand only", () => {
    expect(canRecordDemand(["field_agent"])).toBe(true);
    expect(canRecordDemand(["viewer"])).toBe(false);
  });
});

describe("demand aggregation", () => {
  const lines = [
    {
      product_name: "Paddy seed",
      quantity: 30,
      unit: "kg",
      indicative_price_per_unit: 48,
      member_authorized: true,
    },
    {
      product_name: "Paddy seed",
      quantity: 20,
      unit: "kg",
      indicative_price_per_unit: 48,
      member_authorized: false,
    },
    {
      product_name: "Urea",
      quantity: 100,
      unit: "kg",
      indicative_price_per_unit: 6,
      member_authorized: true,
    },
  ];

  it("groups by product and unit with authorized quantity tracked separately", () => {
    const agg = aggregateDemand(lines);
    expect(agg[0]?.product_name).toBe("Urea");
    const paddy = agg.find((a) => a.product_name === "Paddy seed")!;
    expect(paddy.total_quantity).toBe(50);
    expect(paddy.authorized_quantity).toBe(30);
    expect(paddy.member_count).toBe(2);
    expect(paddy.indicative_value).toBe(2400);
  });

  it("blocks ordering while any member has not authorized the purchase", () => {
    const gate = authorizationGate(lines);
    expect(gate.ready).toBe(false);
    expect(gate.pending).toBe(1);
    expect(authorizationGate([]).reason).toMatch(/No member demand/);
    expect(authorizationGate([{ ...lines[0]! }]).ready).toBe(true);
  });
});

describe("quote comparison", () => {
  const quotes = [
    {
      id: "a",
      supplier_name: "Krishna Seeds",
      certification_label: "State certified",
      unit_price: 46.5,
      transport_cost: 4200,
      delivery_days: 6,
      supplier_rating: 4.4,
      available_quantity: 500,
    },
    {
      id: "b",
      supplier_name: "TG Seed Corp",
      certification_label: "Government certified",
      unit_price: 48,
      transport_cost: 2600,
      delivery_days: 4,
      supplier_rating: 4.6,
      available_quantity: 500,
    },
    {
      id: "c",
      supplier_name: "Sri Lakshmi",
      certification_label: null,
      unit_price: 43.75,
      transport_cost: 6900,
      delivery_days: 12,
      supplier_rating: 3.8,
      available_quantity: 300,
    },
  ];

  it("computes landed cost as verifiable arithmetic", () => {
    expect(landedCost(quotes[0]!, 500)).toBe(27450);
  });

  it("ranks by landed cost and shows the workings", () => {
    const rows = compareQuotes(quotes, 500);
    expect(rows[0]?.supplier_name).toBe("TG Seed Corp");
    expect(rows[0]?.is_lowest_landed_cost).toBe(true);
    expect(rows[0]?.workings).toContain("transport");
    expect(rows[0]?.landed_cost_per_unit).toBe(53.2);
  });

  it("flags missing certification, slow delivery and short availability without hiding the supplier", () => {
    const rows = compareQuotes(quotes, 500);
    const lakshmi = rows.find((r) => r.id === "c")!;
    expect(lakshmi.flags).toContain("No certification declared");
    expect(lakshmi.flags).toContain("Declared availability is below aggregated demand");
    expect(lakshmi.meets_quantity).toBe(false);
    expect(rows).toHaveLength(3);
  });

  it("returns nothing when no quotes exist", () => {
    expect(compareQuotes([], 100)).toEqual([]);
  });
});

describe("distribution and payment", () => {
  const rows = [
    {
      quantity: 30,
      amount_due: 1440,
      amount_collected: 1440,
      payment_state: "paid" as const,
      distributed_at: "2026-08-20",
    },
    {
      quantity: 20,
      amount_due: 960,
      amount_collected: 400,
      payment_state: "partial" as const,
      distributed_at: "2026-08-20",
    },
    {
      quantity: 10,
      amount_due: 480,
      amount_collected: 0,
      payment_state: "pending" as const,
      distributed_at: null,
    },
  ];

  it("summarises quantity, dues and outstanding balance", () => {
    const s = settlementSummary(rows);
    expect(s.quantity).toBe(60);
    expect(s.amount_due).toBe(2880);
    expect(s.amount_collected).toBe(1840);
    expect(s.outstanding).toBe(1040);
    expect(s.distributed).toBe(2);
    expect(s.fully_settled).toBe(false);
  });

  it("derives the payment state from collected amount", () => {
    expect(derivePaymentState(1000, 0)).toBe("pending");
    expect(derivePaymentState(1000, 400)).toBe("partial");
    expect(derivePaymentState(1000, 1000)).toBe("paid");
  });
});

describe("campaign counts", () => {
  it("counts each status including zeroes", () => {
    const counts = campaignCounts([
      { status: "draft" },
      { status: "draft" },
      { status: "ordered" },
    ]);
    expect(counts.draft).toBe(2);
    expect(counts.ordered).toBe(1);
    expect(counts.closed).toBe(0);
  });
});
