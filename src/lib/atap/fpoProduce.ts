/**
 * FPO Management & Operations workspace — Phase 6 pure domain logic.
 *
 * Produce aggregation and market linkage: member harvest declarations roll up
 * into a lot, the lot is listed through the existing marketplace module, and
 * buyer/processor enquiries are compared transparently.
 *
 * Two rules are load-bearing here and re-checked server-side:
 * 1. Price information always carries its basis label — OBSERVED, FORECAST or
 *    DERIVED SCENARIO — and a forecast/scenario is never presented as a price
 *    guarantee.
 * 2. Accepting a buyer offer is a recorded human decision of an authorized FPO
 *    office bearer; nothing here auto-awards a sale.
 */
import type { AppRole } from "@/lib/atap/policy";

/* ------------------------------------------------------------- lifecycle */

export const PRODUCE_LOT_STATUSES = [
  "planned",
  "collecting",
  "aggregated",
  "listed",
  "offers_received",
  "buyer_selected",
  "dispatched",
  "delivered",
  "settled",
  "closed",
  "cancelled",
] as const;

export type ProduceLotStatus = (typeof PRODUCE_LOT_STATUSES)[number];

export const PRODUCE_LOT_STATUS_LABEL: Record<ProduceLotStatus, string> = {
  planned: "Planned",
  collecting: "Collecting declarations",
  aggregated: "Aggregated",
  listed: "Listed on market",
  offers_received: "Offers received",
  buyer_selected: "Buyer selected",
  dispatched: "Dispatched",
  delivered: "Delivered",
  settled: "Settled",
  closed: "Closed",
  cancelled: "Cancelled",
};

const LOT_TRANSITIONS: Record<ProduceLotStatus, ProduceLotStatus[]> = {
  planned: ["collecting", "cancelled"],
  collecting: ["aggregated", "cancelled"],
  aggregated: ["listed", "collecting", "cancelled"],
  listed: ["offers_received", "aggregated", "cancelled"],
  offers_received: ["buyer_selected", "listed", "cancelled"],
  buyer_selected: ["dispatched", "offers_received", "cancelled"],
  dispatched: ["delivered", "cancelled"],
  delivered: ["settled"],
  settled: ["closed"],
  closed: [],
  cancelled: [],
};

export function canTransitionLot(from: ProduceLotStatus, to: ProduceLotStatus): boolean {
  return LOT_TRANSITIONS[from]?.includes(to) ?? false;
}

export function nextLotStatuses(from: ProduceLotStatus): ProduceLotStatus[] {
  return [...(LOT_TRANSITIONS[from] ?? [])];
}

export const ENQUIRY_STATUSES = [
  "received",
  "under_review",
  "negotiating",
  "accepted",
  "declined",
  "withdrawn",
  "expired",
] as const;

export type EnquiryStatus = (typeof ENQUIRY_STATUSES)[number];

export const ENQUIRY_STATUS_LABEL: Record<EnquiryStatus, string> = {
  received: "Received",
  under_review: "Under review",
  negotiating: "Negotiating",
  accepted: "Accepted",
  declined: "Declined",
  withdrawn: "Withdrawn",
  expired: "Expired",
};

const ENQUIRY_TRANSITIONS: Record<EnquiryStatus, EnquiryStatus[]> = {
  received: ["under_review", "declined", "expired"],
  under_review: ["negotiating", "accepted", "declined", "expired"],
  negotiating: ["accepted", "declined", "expired"],
  accepted: ["withdrawn"],
  declined: [],
  withdrawn: [],
  expired: [],
};

export function canTransitionEnquiry(from: EnquiryStatus, to: EnquiryStatus): boolean {
  return ENQUIRY_TRANSITIONS[from]?.includes(to) ?? false;
}

export function nextEnquiryStatuses(from: EnquiryStatus): EnquiryStatus[] {
  return [...(ENQUIRY_TRANSITIONS[from] ?? [])];
}

export const PRICE_BASES = ["observed", "forecast", "derived_scenario"] as const;
export type PriceBasis = (typeof PRICE_BASES)[number];

/** Basis labels stay upper-case and explicit everywhere they are shown. */
export const PRICE_BASIS_LABEL: Record<PriceBasis, string> = {
  observed: "OBSERVED",
  forecast: "FORECAST",
  derived_scenario: "DERIVED SCENARIO",
};

export const PRICE_BASIS_NOTE: Record<PriceBasis, string> = {
  observed: "Recorded market arrival price from the mandi feed adapter.",
  forecast: "Model projection, not a price guarantee and not an offer.",
  derived_scenario: "Illustrative scenario derived from assumptions; not a market price.",
};

export const LOGISTICS_KINDS = [
  "transport",
  "cold_storage",
  "warehouse",
  "grading",
  "processing",
] as const;

export type LogisticsKind = (typeof LOGISTICS_KINDS)[number];

export const LOGISTICS_KIND_LABEL: Record<LogisticsKind, string> = {
  transport: "Transport",
  cold_storage: "Cold storage",
  warehouse: "Warehouse",
  grading: "Grading",
  processing: "Processing",
};

export const BUYER_TYPES = ["buyer", "processor", "exporter", "institutional"] as const;
export type BuyerType = (typeof BUYER_TYPES)[number];

/* --------------------------------------------------------- authorization */

const ADMIN_ROLES: AppRole[] = ["platform_admin", "tenant_admin"];

/** Creating lots, listing produce and answering buyers is an FPO admin act. */
export function canManageProduce(roles: readonly AppRole[]): boolean {
  return roles.some((r) => ADMIN_ROLES.includes(r));
}

/** Field agents collect member harvest declarations but never accept an offer. */
export function canRecordContribution(roles: readonly AppRole[]): boolean {
  return canManageProduce(roles) || roles.includes("field_agent");
}

export function canAcceptOffer(roles: readonly AppRole[]): boolean {
  return canManageProduce(roles);
}

export const PRODUCE_DISCLAIMER =
  "Prices are labelled OBSERVED, FORECAST or DERIVED SCENARIO. Forecasts and scenarios are indicative only and are never a price guarantee. Listing produce and accepting a buyer offer remain recorded decisions of an authorized FPO office bearer.";

/* ------------------------------------------------------------ aggregation */

export interface ContributionLike {
  member_id?: string | null;
  expected_quantity: number;
  confirmed_quantity: number;
  delivered_quantity: number;
  unit: string;
  grade?: string | null;
}

export interface LotAggregation {
  members: number;
  expected: number;
  confirmed: number;
  delivered: number;
  unit: string;
  confirmation_rate: number;
  delivery_rate: number;
  outstanding_delivery: number;
}

export function aggregateContributions(
  rows: readonly ContributionLike[],
  unit = "quintal",
): LotAggregation {
  const expected = round2(rows.reduce((s, r) => s + r.expected_quantity, 0));
  const confirmed = round2(rows.reduce((s, r) => s + r.confirmed_quantity, 0));
  const delivered = round2(rows.reduce((s, r) => s + r.delivered_quantity, 0));
  return {
    members: rows.length,
    expected,
    confirmed,
    delivered,
    unit: rows[0]?.unit ?? unit,
    confirmation_rate: expected > 0 ? round2((confirmed / expected) * 100) : 0,
    delivery_rate: confirmed > 0 ? round2((delivered / confirmed) * 100) : 0,
    outstanding_delivery: round2(Math.max(0, confirmed - delivered)),
  };
}

export interface HarvestWindowLike {
  commodity: string;
  harvest_window_start?: string | null;
  harvest_window_end?: string | null;
  expected_quantity: number;
  aggregated_quantity: number;
  unit: string;
}

export interface CommodityWindow {
  commodity: string;
  unit: string;
  expected: number;
  aggregated: number;
  lots: number;
  window_start: string | null;
  window_end: string | null;
}

/** Groups lots by commodity so the workspace can plan a harvest calendar. */
export function commodityWindows(lots: readonly HarvestWindowLike[]): CommodityWindow[] {
  const map = new Map<string, CommodityWindow>();
  for (const lot of lots) {
    const entry = map.get(lot.commodity) ?? {
      commodity: lot.commodity,
      unit: lot.unit,
      expected: 0,
      aggregated: 0,
      lots: 0,
      window_start: null,
      window_end: null,
    };
    entry.expected = round2(entry.expected + lot.expected_quantity);
    entry.aggregated = round2(entry.aggregated + lot.aggregated_quantity);
    entry.lots += 1;
    const start = lot.harvest_window_start ?? null;
    const end = lot.harvest_window_end ?? null;
    if (start && (!entry.window_start || start < entry.window_start)) entry.window_start = start;
    if (end && (!entry.window_end || end > entry.window_end)) entry.window_end = end;
    map.set(lot.commodity, entry);
  }
  return [...map.values()].sort((a, b) => b.expected - a.expected);
}

/* --------------------------------------------------------- price snapshot */

export interface PriceObservationLike {
  commodity: string;
  market_name: string;
  price_per_unit: number;
  unit: string;
  basis: PriceBasis;
  observed_on: string;
  source?: string | null;
}

export interface PriceSnapshot {
  commodity: string;
  unit: string;
  basis: PriceBasis;
  basis_label: string;
  basis_note: string;
  latest_price: number;
  market_name: string;
  observed_on: string;
  observations: number;
  low: number;
  high: number;
}

/**
 * One snapshot per commodity and basis. Bases are never blended, so a forecast
 * can never silently become the headline "market price".
 */
export function priceSnapshots(rows: readonly PriceObservationLike[]): PriceSnapshot[] {
  const map = new Map<string, PriceObservationLike[]>();
  for (const row of rows) {
    const key = `${row.commodity}::${row.basis}`;
    map.set(key, [...(map.get(key) ?? []), row]);
  }
  const out: PriceSnapshot[] = [];
  for (const group of map.values()) {
    const sorted = [...group].sort((a, b) => (a.observed_on < b.observed_on ? 1 : -1));
    const latest = sorted[0]!;
    const prices = group.map((g) => g.price_per_unit);
    out.push({
      commodity: latest.commodity,
      unit: latest.unit,
      basis: latest.basis,
      basis_label: PRICE_BASIS_LABEL[latest.basis],
      basis_note: PRICE_BASIS_NOTE[latest.basis],
      latest_price: latest.price_per_unit,
      market_name: latest.market_name,
      observed_on: latest.observed_on,
      observations: group.length,
      low: Math.min(...prices),
      high: Math.max(...prices),
    });
  }
  return out.sort(
    (a, b) => a.commodity.localeCompare(b.commodity) || a.basis.localeCompare(b.basis),
  );
}

/* ------------------------------------------------------- offer comparison */

export interface EnquiryLike {
  id: string;
  buyer_name: string;
  buyer_type: string;
  offered_price_per_unit?: number | null;
  quantity?: number | null;
  unit: string;
  payment_terms?: string | null;
  delivery_terms?: string | null;
  status: EnquiryStatus;
}

export interface ComparedEnquiry extends EnquiryLike {
  gross_value: number | null;
  is_highest_price: boolean;
  meets_reserve: boolean | null;
  vs_reserve: number | null;
  flags: string[];
  workings: string | null;
}

/**
 * Ranking is arithmetic the FPO can verify: gross value = offered price ×
 * quantity. No offer is hidden and nothing is auto-accepted.
 */
export function compareEnquiries(
  enquiries: readonly EnquiryLike[],
  opts: { reservePricePerUnit?: number | null; availableQuantity?: number | null } = {},
): ComparedEnquiry[] {
  if (enquiries.length === 0) return [];
  const reserve = opts.reservePricePerUnit ?? null;
  const available = opts.availableQuantity ?? null;
  const live = enquiries.filter(
    (e) => e.status !== "declined" && e.status !== "withdrawn" && e.status !== "expired",
  );
  const highest = live.reduce(
    (m, e) => Math.max(m, e.offered_price_per_unit ?? 0),
    Number.NEGATIVE_INFINITY,
  );

  const rows = enquiries.map((e) => {
    const price = e.offered_price_per_unit ?? null;
    const qty = e.quantity ?? null;
    const flags: string[] = [];
    if (price == null) flags.push("No price quoted");
    if (reserve != null && price != null && price < reserve) flags.push("Below reserve price");
    if (available != null && qty != null && qty > available) {
      flags.push("Requested quantity exceeds aggregated produce");
    }
    if (!e.payment_terms) flags.push("Payment terms not stated");
    if (!e.delivery_terms) flags.push("Delivery terms not stated");
    return {
      ...e,
      gross_value: price != null && qty != null ? round2(price * qty) : null,
      is_highest_price:
        price != null && live.includes(e) && Number.isFinite(highest) && price === highest,
      meets_reserve: reserve == null || price == null ? null : price >= reserve,
      vs_reserve: reserve == null || price == null ? null : round2(price - reserve),
      flags,
      workings:
        price != null && qty != null
          ? `${price} × ${qty} ${e.unit} = ${round2(price * qty)}`
          : null,
    };
  });

  return rows.sort(
    (a, b) =>
      (b.offered_price_per_unit ?? -1) - (a.offered_price_per_unit ?? -1) ||
      (b.gross_value ?? -1) - (a.gross_value ?? -1),
  );
}

/** Listing needs real aggregated produce and a reserve price to protect members. */
export function listingReadiness(lot: {
  status: ProduceLotStatus;
  aggregated_quantity: number;
  reserve_price_per_unit?: number | null;
}): { ready: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (lot.aggregated_quantity <= 0) reasons.push("No confirmed member produce aggregated yet.");
  if (lot.reserve_price_per_unit == null || lot.reserve_price_per_unit <= 0) {
    reasons.push("Set a reserve price before listing so member returns are protected.");
  }
  if (!canTransitionLot(lot.status, "listed") && lot.status !== "listed") {
    reasons.push(`A lot in "${PRODUCE_LOT_STATUS_LABEL[lot.status]}" cannot be listed directly.`);
  }
  return { ready: reasons.length === 0, reasons };
}

/* ------------------------------------------------- marketplace bridge (C2) */

/**
 * Horticulture and commercial commodities map to the horticulture listing
 * category; everything else is grain & pulses. Keep this conservative — an
 * unmapped commodity falls to grain, never out of scope.
 */
const HORTICULTURE_COMMODITIES = new Set([
  "chilli",
  "chillies",
  "turmeric",
  "banana",
  "mango",
  "onion",
  "tomato",
  "potato",
  "oil palm",
  "sugarcane",
  "cotton",
]);

export type ProduceListingCategory = "produce_grain" | "produce_horticulture";

export function produceCategoryFor(commodity: string): ProduceListingCategory {
  return HORTICULTURE_COMMODITIES.has(commodity.trim().toLowerCase())
    ? "produce_horticulture"
    : "produce_grain";
}

export interface LotListingDraft {
  category: ProduceListingCategory;
  title: string;
  description: string;
  unit: string;
  priceMin: number | null;
  priceMax: number | null;
  minOrderQty: number | null;
}

/**
 * Build the marketplace listing draft for an aggregated lot. The reserve
 * price becomes the listing's floor so member returns stay protected; the
 * listing never exposes member identities.
 */
export function lotListingDraft(
  lot: {
    commodity: string;
    variety: string | null;
    grade: string | null;
    season: string | null;
    aggregated_quantity: number;
    unit: string;
    reserve_price_per_unit: number | null;
  },
  fpoName: string,
): LotListingDraft {
  const label = [lot.commodity, lot.variety, lot.grade ? `Grade ${lot.grade}` : null]
    .filter(Boolean)
    .join(" · ");
  const qty = round2(lot.aggregated_quantity);
  return {
    category: produceCategoryFor(lot.commodity),
    title: `${label}${lot.season ? ` — ${lot.season}` : ""}`.trim(),
    description:
      `Aggregated ${qty} ${lot.unit} of ${label} from member farmers of ${fpoName}. ` +
      "Sold as a single FPO lot; quality as per declaration. Individual member data is not shared.",
    unit: lot.unit,
    priceMin: lot.reserve_price_per_unit,
    priceMax: null,
    minOrderQty: qty > 0 ? qty : null,
  };
}

/* ---------------------------------------------------------------- counts */

export function lotCounts(
  lots: readonly { status: ProduceLotStatus }[],
): Record<ProduceLotStatus, number> {
  const counts = Object.fromEntries(PRODUCE_LOT_STATUSES.map((s) => [s, 0])) as Record<
    ProduceLotStatus,
    number
  >;
  for (const l of lots) counts[l.status] = (counts[l.status] ?? 0) + 1;
  return counts;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
