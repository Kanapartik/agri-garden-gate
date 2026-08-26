import { describe, expect, it } from "vitest";
import {
  aggregateContributions,
  canAcceptOffer,
  canManageProduce,
  canRecordContribution,
  canTransitionEnquiry,
  canTransitionLot,
  commodityWindows,
  compareEnquiries,
  listingReadiness,
  lotCounts,
  nextEnquiryStatuses,
  nextLotStatuses,
  PRICE_BASIS_LABEL,
  priceSnapshots,
} from "@/lib/atap/fpoProduce";

describe("produce lot lifecycle", () => {
  it("allows only forward or corrective transitions", () => {
    expect(canTransitionLot("planned", "collecting")).toBe(true);
    expect(canTransitionLot("aggregated", "listed")).toBe(true);
    expect(canTransitionLot("listed", "aggregated")).toBe(true);
    expect(canTransitionLot("planned", "settled")).toBe(false);
    expect(canTransitionLot("closed", "listed")).toBe(false);
  });

  it("exposes next statuses and terminal states", () => {
    expect(nextLotStatuses("offers_received")).toContain("buyer_selected");
    expect(nextLotStatuses("closed")).toEqual([]);
    expect(nextLotStatuses("cancelled")).toEqual([]);
  });

  it("counts lots by status", () => {
    const counts = lotCounts([
      { status: "collecting" },
      { status: "collecting" },
      { status: "listed" },
    ]);
    expect(counts.collecting).toBe(2);
    expect(counts.listed).toBe(1);
    expect(counts.settled).toBe(0);
  });
});

describe("enquiry lifecycle", () => {
  it("gates negotiation and acceptance", () => {
    expect(canTransitionEnquiry("received", "under_review")).toBe(true);
    expect(canTransitionEnquiry("under_review", "accepted")).toBe(true);
    expect(canTransitionEnquiry("received", "accepted")).toBe(false);
    expect(canTransitionEnquiry("declined", "accepted")).toBe(false);
    expect(nextEnquiryStatuses("negotiating")).toContain("accepted");
  });
});

describe("authorization", () => {
  it("keeps produce management with FPO admins", () => {
    expect(canManageProduce(["tenant_admin"])).toBe(true);
    expect(canManageProduce(["platform_admin"])).toBe(true);
    expect(canManageProduce(["field_agent"])).toBe(false);
    expect(canManageProduce(["viewer"])).toBe(false);
  });

  it("lets field agents record contributions but never accept offers", () => {
    expect(canRecordContribution(["field_agent"])).toBe(true);
    expect(canAcceptOffer(["field_agent"])).toBe(false);
    expect(canAcceptOffer(["tenant_admin"])).toBe(true);
  });
});

describe("contribution aggregation", () => {
  it("rolls up expected, confirmed and delivered quantities", () => {
    const agg = aggregateContributions([
      {
        expected_quantity: 20,
        confirmed_quantity: 18,
        delivered_quantity: 10,
        unit: "quintal",
      },
      {
        expected_quantity: 30,
        confirmed_quantity: 22,
        delivered_quantity: 12,
        unit: "quintal",
      },
    ]);
    expect(agg.members).toBe(2);
    expect(agg.expected).toBe(50);
    expect(agg.confirmed).toBe(40);
    expect(agg.delivered).toBe(22);
    expect(agg.confirmation_rate).toBe(80);
    expect(agg.delivery_rate).toBe(55);
    expect(agg.outstanding_delivery).toBe(18);
  });

  it("handles an empty lot without dividing by zero", () => {
    const agg = aggregateContributions([]);
    expect(agg.expected).toBe(0);
    expect(agg.confirmation_rate).toBe(0);
    expect(agg.delivery_rate).toBe(0);
    expect(agg.unit).toBe("quintal");
  });
});

describe("commodity harvest windows", () => {
  it("groups lots per commodity and widens the window", () => {
    const windows = commodityWindows([
      {
        commodity: "Paddy",
        harvest_window_start: "2026-11-01",
        harvest_window_end: "2026-11-20",
        expected_quantity: 900,
        aggregated_quantity: 400,
        unit: "quintal",
      },
      {
        commodity: "Paddy",
        harvest_window_start: "2026-10-25",
        harvest_window_end: "2026-11-15",
        expected_quantity: 600,
        aggregated_quantity: 200,
        unit: "quintal",
      },
      {
        commodity: "Maize",
        harvest_window_start: null,
        harvest_window_end: null,
        expected_quantity: 300,
        aggregated_quantity: 0,
        unit: "quintal",
      },
    ]);
    expect(windows[0]!.commodity).toBe("Paddy");
    expect(windows[0]!.expected).toBe(1500);
    expect(windows[0]!.aggregated).toBe(600);
    expect(windows[0]!.lots).toBe(2);
    expect(windows[0]!.window_start).toBe("2026-10-25");
    expect(windows[0]!.window_end).toBe("2026-11-20");
    expect(windows[1]!.window_start).toBeNull();
  });
});

describe("price snapshots", () => {
  const rows = [
    {
      commodity: "Paddy",
      market_name: "Guntur mandi",
      price_per_unit: 2345,
      unit: "quintal",
      basis: "observed" as const,
      observed_on: "2026-08-24",
    },
    {
      commodity: "Paddy",
      market_name: "Karimnagar mandi",
      price_per_unit: 2378,
      unit: "quintal",
      basis: "observed" as const,
      observed_on: "2026-08-25",
    },
    {
      commodity: "Paddy",
      market_name: "Guntur mandi",
      price_per_unit: 2420,
      unit: "quintal",
      basis: "forecast" as const,
      observed_on: "2026-08-26",
    },
  ];

  it("never blends bases and keeps explicit labels", () => {
    const snaps = priceSnapshots(rows);
    expect(snaps).toHaveLength(2);
    const forecast = snaps.find((s) => s.basis === "forecast")!;
    const observed = snaps.find((s) => s.basis === "observed")!;
    expect(forecast.basis_label).toBe("FORECAST");
    expect(forecast.latest_price).toBe(2420);
    expect(observed.basis_label).toBe(PRICE_BASIS_LABEL.observed);
    expect(observed.latest_price).toBe(2378);
    expect(observed.low).toBe(2345);
    expect(observed.high).toBe(2378);
    expect(observed.observations).toBe(2);
  });

  it("returns nothing for no observations", () => {
    expect(priceSnapshots([])).toEqual([]);
  });
});

describe("enquiry comparison", () => {
  const enquiries = [
    {
      id: "a",
      buyer_name: "Rice mill",
      buyer_type: "processor",
      offered_price_per_unit: 2385,
      quantity: 800,
      unit: "quintal",
      payment_terms: "15 days",
      delivery_terms: "Buyer transport",
      status: "under_review" as const,
    },
    {
      id: "b",
      buyer_name: "Bulk trader",
      buyer_type: "buyer",
      offered_price_per_unit: 2280,
      quantity: 2000,
      unit: "quintal",
      payment_terms: null,
      delivery_terms: null,
      status: "negotiating" as const,
    },
    {
      id: "c",
      buyer_name: "Lapsed buyer",
      buyer_type: "buyer",
      offered_price_per_unit: 2500,
      quantity: 100,
      unit: "quintal",
      payment_terms: "Advance",
      delivery_terms: "Pickup",
      status: "expired" as const,
    },
  ];

  it("ranks on price with verifiable workings", () => {
    const rows = compareEnquiries(enquiries, {
      reservePricePerUnit: 2320,
      availableQuantity: 1240,
    });
    expect(rows[0]!.id).toBe("c");
    const top = rows.find((r) => r.id === "a")!;
    expect(top.gross_value).toBe(1908000);
    expect(top.workings).toContain("2385 × 800");
    expect(top.is_highest_price).toBe(true);
    expect(top.meets_reserve).toBe(true);
    expect(top.vs_reserve).toBe(65);
  });

  it("flags below-reserve, over-quantity and missing terms without hiding offers", () => {
    const rows = compareEnquiries(enquiries, {
      reservePricePerUnit: 2320,
      availableQuantity: 1240,
    });
    const trader = rows.find((r) => r.id === "b")!;
    expect(trader.flags).toContain("Below reserve price");
    expect(trader.flags).toContain("Requested quantity exceeds aggregated produce");
    expect(trader.flags).toContain("Payment terms not stated");
    expect(rows).toHaveLength(3);
  });

  it("returns an empty list when there are no enquiries", () => {
    expect(compareEnquiries([])).toEqual([]);
  });
});

describe("listing readiness", () => {
  it("blocks listing without aggregated produce or a reserve price", () => {
    const r = listingReadiness({
      status: "aggregated",
      aggregated_quantity: 0,
      reserve_price_per_unit: null,
    });
    expect(r.ready).toBe(false);
    expect(r.reasons).toHaveLength(2);
  });

  it("allows listing an aggregated lot with a reserve price", () => {
    const r = listingReadiness({
      status: "aggregated",
      aggregated_quantity: 1240,
      reserve_price_per_unit: 2320,
    });
    expect(r).toEqual({ ready: true, reasons: [] });
  });

  it("explains why a planned lot cannot be listed directly", () => {
    const r = listingReadiness({
      status: "planned",
      aggregated_quantity: 100,
      reserve_price_per_unit: 2000,
    });
    expect(r.ready).toBe(false);
    expect(r.reasons.join(" ")).toContain("cannot be listed directly");
  });
});
