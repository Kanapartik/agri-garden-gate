/**
 * FPO Management & Operations workspace — Phase 5 pure domain logic.
 *
 * Procurement runs demand collection → aggregation → RFQ → supplier quotes →
 * comparison → supplier selection → member authorization → order →
 * distribution → payment → closed. No I/O here; every authority decision is
 * re-checked server-side in `fpoProcurement.functions.ts`.
 *
 * Quote comparison is transparent and explainable: the landed cost is arithmetic
 * the FPO can verify, and ranking never hides a supplier or auto-awards an
 * order. Selection is always a recorded human act.
 */
import type { AppRole } from "@/lib/atap/policy";

/* ------------------------------------------------------------- lifecycle */

export const PROCUREMENT_STATUSES = [
  "draft",
  "collecting_demand",
  "aggregated",
  "rfq_open",
  "quotes_received",
  "supplier_selected",
  "member_authorization",
  "ordered",
  "distributing",
  "payment_pending",
  "closed",
  "cancelled",
] as const;

export type ProcurementStatus = (typeof PROCUREMENT_STATUSES)[number];

export const PROCUREMENT_STATUS_LABEL: Record<ProcurementStatus, string> = {
  draft: "Draft",
  collecting_demand: "Collecting demand",
  aggregated: "Demand aggregated",
  rfq_open: "RFQ open",
  quotes_received: "Quotes received",
  supplier_selected: "Supplier selected",
  member_authorization: "Member authorization",
  ordered: "Ordered",
  distributing: "Distributing",
  payment_pending: "Payment pending",
  closed: "Closed",
  cancelled: "Cancelled",
};

const TRANSITIONS: Record<ProcurementStatus, ProcurementStatus[]> = {
  draft: ["collecting_demand", "cancelled"],
  collecting_demand: ["aggregated", "cancelled"],
  aggregated: ["rfq_open", "collecting_demand", "cancelled"],
  rfq_open: ["quotes_received", "aggregated", "cancelled"],
  quotes_received: ["supplier_selected", "rfq_open", "cancelled"],
  supplier_selected: ["member_authorization", "quotes_received", "cancelled"],
  member_authorization: ["ordered", "supplier_selected", "cancelled"],
  ordered: ["distributing", "cancelled"],
  distributing: ["payment_pending", "closed"],
  payment_pending: ["closed"],
  closed: [],
  cancelled: [],
};

export function canTransitionCampaign(from: ProcurementStatus, to: ProcurementStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function nextCampaignStatuses(from: ProcurementStatus): ProcurementStatus[] {
  return [...(TRANSITIONS[from] ?? [])];
}

export const INPUT_CATEGORIES = [
  "seed",
  "fertilizer",
  "crop_protection",
  "equipment",
  "irrigation",
  "packaging",
  "farm_service",
] as const;

export type InputCategory = (typeof INPUT_CATEGORIES)[number];

export const INPUT_CATEGORY_LABEL: Record<InputCategory, string> = {
  seed: "Seed",
  fertilizer: "Fertilizer",
  crop_protection: "Crop protection",
  equipment: "Equipment",
  irrigation: "Irrigation",
  packaging: "Packaging",
  farm_service: "Farm services",
};

export const PAYMENT_STATES = ["pending", "partial", "paid", "waived"] as const;
export type PaymentState = (typeof PAYMENT_STATES)[number];

/* --------------------------------------------------------- authorization */

const ADMIN_ROLES: AppRole[] = ["platform_admin", "tenant_admin"];

/** Managing procurement is an FPO admin act; roster membership alone is read-only. */
export function canManageProcurement(roles: readonly AppRole[]): boolean {
  return roles.some((r) => ADMIN_ROLES.includes(r));
}

/** Field agents may record member demand, but never award an order. */
export function canRecordDemand(roles: readonly AppRole[]): boolean {
  return canManageProcurement(roles) || roles.includes("field_agent");
}

export function canSelectSupplier(roles: readonly AppRole[]): boolean {
  return canManageProcurement(roles);
}

export const PROCUREMENT_DISCLAIMER =
  "Quote comparison is advisory arithmetic on supplier-declared terms. Supplier selection, ordering and payment remain recorded decisions of an authorized FPO office bearer.";

/* ------------------------------------------------------------ aggregation */

export interface DemandLineLike {
  product_name: string;
  quantity: number;
  unit: string;
  indicative_price_per_unit?: number | null;
  member_authorized?: boolean;
}

export interface AggregatedDemand {
  product_name: string;
  unit: string;
  total_quantity: number;
  authorized_quantity: number;
  member_count: number;
  indicative_value: number | null;
}

/** Groups member demand by product and unit so an RFQ can be raised per line. */
export function aggregateDemand(lines: readonly DemandLineLike[]): AggregatedDemand[] {
  const map = new Map<string, AggregatedDemand>();
  for (const line of lines) {
    const key = `${line.product_name}::${line.unit}`;
    const entry = map.get(key) ?? {
      product_name: line.product_name,
      unit: line.unit,
      total_quantity: 0,
      authorized_quantity: 0,
      member_count: 0,
      indicative_value: null,
    };
    entry.total_quantity = round2(entry.total_quantity + line.quantity);
    if (line.member_authorized) {
      entry.authorized_quantity = round2(entry.authorized_quantity + line.quantity);
    }
    entry.member_count += 1;
    if (line.indicative_price_per_unit != null) {
      entry.indicative_value = round2(
        (entry.indicative_value ?? 0) + line.quantity * line.indicative_price_per_unit,
      );
    }
    map.set(key, entry);
  }
  return [...map.values()].sort((a, b) => b.total_quantity - a.total_quantity);
}

/**
 * Every member whose input is bought on their behalf must have authorized it.
 * Ordering is blocked while any demand line is unauthorized.
 */
export function authorizationGate(lines: readonly DemandLineLike[]): {
  total: number;
  authorized: number;
  pending: number;
  ready: boolean;
  reason: string | null;
} {
  const total = lines.length;
  const authorized = lines.filter((l) => l.member_authorized).length;
  const pending = total - authorized;
  if (total === 0) {
    return { total, authorized, pending, ready: false, reason: "No member demand recorded yet." };
  }
  return {
    total,
    authorized,
    pending,
    ready: pending === 0,
    reason:
      pending === 0
        ? null
        : `${pending} member(s) have not authorized this purchase on their behalf.`,
  };
}

/* ------------------------------------------------------- quote comparison */

export interface QuoteLike {
  id: string;
  supplier_name: string;
  certification_label?: string | null;
  unit_price: number;
  transport_cost?: number | null;
  min_order_quantity?: number | null;
  available_quantity?: number | null;
  availability_date?: string | null;
  delivery_days?: number | null;
  supplier_rating?: number | null;
}

export interface ComparedQuote extends QuoteLike {
  landed_cost: number;
  landed_cost_per_unit: number;
  savings_vs_worst: number;
  is_lowest_landed_cost: boolean;
  meets_quantity: boolean;
  flags: string[];
  workings: string;
}

/** Landed cost = unit price × quantity + declared transport. */
export function landedCost(quote: QuoteLike, quantity: number): number {
  return round2(quote.unit_price * quantity + (quote.transport_cost ?? 0));
}

export function compareQuotes(quotes: readonly QuoteLike[], quantity: number): ComparedQuote[] {
  if (quotes.length === 0) return [];
  const costs = quotes.map((q) => landedCost(q, quantity));
  const lowest = Math.min(...costs);
  const highest = Math.max(...costs);

  const rows = quotes.map((q, i) => {
    const cost = costs[i]!;
    const flags: string[] = [];
    if (!q.certification_label) flags.push("No certification declared");
    if (q.min_order_quantity != null && q.min_order_quantity > quantity) {
      flags.push(`Minimum order ${q.min_order_quantity} exceeds aggregated demand`);
    }
    if (q.available_quantity != null && q.available_quantity < quantity) {
      flags.push("Declared availability is below aggregated demand");
    }
    if ((q.delivery_days ?? 0) > 10) flags.push("Delivery longer than 10 days");
    return {
      ...q,
      landed_cost: cost,
      landed_cost_per_unit: quantity > 0 ? round2(cost / quantity) : 0,
      savings_vs_worst: round2(highest - cost),
      is_lowest_landed_cost: cost === lowest,
      meets_quantity: q.available_quantity == null || q.available_quantity >= quantity,
      flags,
      workings: `${q.unit_price} × ${quantity} + ${q.transport_cost ?? 0} transport = ${cost}`,
    };
  });

  return rows.sort(
    (a, b) =>
      a.landed_cost - b.landed_cost ||
      (b.supplier_rating ?? 0) - (a.supplier_rating ?? 0) ||
      (a.delivery_days ?? 99) - (b.delivery_days ?? 99),
  );
}

/* ------------------------------------------------------------ settlement */

export interface DistributionLike {
  quantity: number;
  amount_due: number;
  amount_collected: number;
  payment_state: PaymentState;
  distributed_at?: string | null;
}

export interface SettlementSummary {
  members: number;
  distributed: number;
  quantity: number;
  amount_due: number;
  amount_collected: number;
  outstanding: number;
  fully_settled: boolean;
}

export function settlementSummary(rows: readonly DistributionLike[]): SettlementSummary {
  const due = rows.reduce((s, r) => s + r.amount_due, 0);
  const collected = rows.reduce((s, r) => s + r.amount_collected, 0);
  return {
    members: rows.length,
    distributed: rows.filter((r) => Boolean(r.distributed_at)).length,
    quantity: round2(rows.reduce((s, r) => s + r.quantity, 0)),
    amount_due: round2(due),
    amount_collected: round2(collected),
    outstanding: round2(Math.max(0, due - collected)),
    fully_settled:
      rows.length > 0 &&
      rows.every((r) => r.payment_state === "paid" || r.payment_state === "waived"),
  };
}

export function derivePaymentState(amountDue: number, amountCollected: number): PaymentState {
  if (amountCollected <= 0) return "pending";
  if (amountCollected + 0.009 >= amountDue) return "paid";
  return "partial";
}

/* ---------------------------------------------------------------- counts */

export function campaignCounts(
  campaigns: readonly { status: ProcurementStatus }[],
): Record<ProcurementStatus, number> {
  const counts = Object.fromEntries(PROCUREMENT_STATUSES.map((s) => [s, 0])) as Record<
    ProcurementStatus,
    number
  >;
  for (const c of campaigns) counts[c.status] = (counts[c.status] ?? 0) + 1;
  return counts;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
