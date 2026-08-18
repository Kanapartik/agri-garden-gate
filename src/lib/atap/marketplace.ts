/**
 * B5 — Inputs & Produce base marketplace: pure commerce rules.
 *
 * No IO, so every rule below is unit-testable and reused verbatim by the server
 * functions. Non-negotiables encoded here:
 *  - Commercial entitlements NEVER relax listing quality, consent or matching.
 *  - Matching/ranking is neutral: identical listings rank identically whatever
 *    the seller's plan, and sponsored placement cannot influence order.
 *  - FPO aggregated demand requires an approved delegated-authority rule.
 *  - Disputes always land with a human reviewer.
 *  - Out-of-scope commerce domains (rental, warehousing, export, auctions,
 *    carbon, logistics) are hard-blocked, not merely hidden.
 */

export type MarketPartyKind =
  | "input_supplier"
  | "equipment_supplier"
  | "buyer_trader"
  | "processor"
  | "fpo_aggregator";

export type MarketSide = "seller" | "buyer";
export type MarketProfileState = "draft" | "submitted" | "approved" | "rejected" | "suspended";
export type ListingStatus = "draft" | "pending_review" | "published" | "delisted";
export type RfqStatus = "draft" | "open" | "quoted" | "ordered" | "cancelled";
export type OrderStatus =
  | "created"
  | "accepted"
  | "fulfilled"
  | "cancelled"
  | "disputed"
  | "closed";
export type DisputeStatus = "open" | "human_review" | "resolved" | "rejected";

/** Commercial plan scaffolding. Pricing is deliberately unset in this slice. */
export type CommercePlan = "base" | "growth" | "enterprise";

export interface CommerceEntitlement {
  plan_code: CommercePlan | string;
  has_retainer: boolean;
  /** null = no pricing assumed yet. */
  retainer_amount: number | null;
  transaction_fee_bps: number | null;
  currency: string | null;
  features: Record<string, boolean>;
  status: "active" | "suspended" | "revoked";
}

export const PLAN_SCAFFOLD: Record<CommercePlan, Omit<CommerceEntitlement, "status">> = {
  base: {
    plan_code: "base",
    has_retainer: false,
    retainer_amount: null,
    transaction_fee_bps: null,
    currency: null,
    features: { listings: true, rfq: true, analytics_basic: true },
  },
  growth: {
    plan_code: "growth",
    has_retainer: true,
    retainer_amount: null,
    transaction_fee_bps: null,
    currency: null,
    features: { listings: true, rfq: true, analytics_basic: true, analytics_advanced: true },
  },
  enterprise: {
    plan_code: "enterprise",
    has_retainer: true,
    retainer_amount: null,
    transaction_fee_bps: null,
    currency: null,
    features: {
      listings: true,
      rfq: true,
      analytics_basic: true,
      analytics_advanced: true,
      priority_support: true,
    },
  },
};

/**
 * Capabilities a paid plan can NEVER buy. Kept as an explicit deny-list so a
 * future plan definition cannot silently acquire them.
 */
export const NON_PURCHASABLE_CAPABILITIES = [
  "bypass_listing_quality",
  "bypass_consent",
  "rank_boost",
  "bypass_dispute_review",
  "bypass_neutral_matching",
] as const;

export function entitlementFor(
  plan: string,
  status: CommerceEntitlement["status"] = "active",
): CommerceEntitlement {
  const scaffold = PLAN_SCAFFOLD[(plan as CommercePlan) in PLAN_SCAFFOLD ? (plan as CommercePlan) : "base"];
  const features: Record<string, boolean> = { ...scaffold.features };
  for (const capability of NON_PURCHASABLE_CAPABILITIES) features[capability] = false;
  return { ...scaffold, plan_code: plan, features, status };
}

/** True only for capabilities that are legitimately plan-gated. */
export function planGrants(entitlement: CommerceEntitlement, capability: string): boolean {
  if ((NON_PURCHASABLE_CAPABILITIES as readonly string[]).includes(capability)) return false;
  if (entitlement.status !== "active") return false;
  return entitlement.features[capability] === true;
}

/* ------------------------------------------------------------- categories */

export interface CategoryDef {
  code: string;
  label: string;
  side: MarketSide | "both";
  group: "inputs" | "equipment" | "produce";
}

/**
 * Base slice catalogue only: inputs, equipment for sale, produce. Rental,
 * warehousing, export, auctions, carbon and logistics are NOT present.
 */
export const CATEGORIES: readonly CategoryDef[] = [
  { code: "seed", label: "Seed", side: "both", group: "inputs" },
  { code: "fertiliser", label: "Fertiliser & nutrition", side: "both", group: "inputs" },
  { code: "crop_protection", label: "Crop protection", side: "both", group: "inputs" },
  { code: "farm_equipment", label: "Farm equipment (sale)", side: "both", group: "equipment" },
  { code: "irrigation_equipment", label: "Irrigation equipment (sale)", side: "both", group: "equipment" },
  { code: "produce_grain", label: "Produce — grain & pulses", side: "both", group: "produce" },
  { code: "produce_horticulture", label: "Produce — horticulture", side: "both", group: "produce" },
];

/** Domains explicitly excluded from this slice. */
export const BLOCKED_CATEGORY_PATTERNS = [
  "rental",
  "rent",
  "warehous",
  "storage",
  "export",
  "auction",
  "carbon",
  "logistic",
  "freight",
  "transport",
] as const;

export function isCategoryInScope(code: string): boolean {
  const lower = (code ?? "").toLowerCase();
  if (BLOCKED_CATEGORY_PATTERNS.some((p) => lower.includes(p))) return false;
  return CATEGORIES.some((c) => c.code === lower);
}

export function categoryLabel(code: string): string {
  return CATEGORIES.find((c) => c.code === code)?.label ?? code;
}

export function kindDefaultSide(kind: MarketPartyKind): MarketSide {
  return kind === "input_supplier" || kind === "equipment_supplier" ? "seller" : "buyer";
}

/* ---------------------------------------------------------------- profiles */

export interface ProfileDraft {
  party_kind: MarketPartyKind;
  side: MarketSide;
  display_name: string;
  contact_email: string;
  categories: string[];
  regions: string[];
  state: MarketProfileState;
}

export interface CheckResult {
  ok: boolean;
  errors: string[];
}

export function checkProfileSubmit(draft: ProfileDraft): CheckResult {
  const errors: string[] = [];
  if (draft.state !== "draft" && draft.state !== "rejected") errors.push("profile_not_editable");
  if ((draft.display_name ?? "").trim().length < 3) errors.push("display_name_required");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(draft.contact_email ?? "")) errors.push("valid_contact_email_required");
  if ((draft.categories ?? []).length === 0) errors.push("at_least_one_category_required");
  const outOfScope = (draft.categories ?? []).filter((c) => !isCategoryInScope(c));
  if (outOfScope.length > 0) errors.push(`out_of_scope_categories:${outOfScope.join(",")}`);
  if ((draft.regions ?? []).length === 0) errors.push("at_least_one_region_required");
  if (draft.side !== kindDefaultSide(draft.party_kind) && draft.party_kind !== "fpo_aggregator") {
    errors.push("side_does_not_match_party_kind");
  }
  return { ok: errors.length === 0, errors };
}

/* ---------------------------------------------------------------- listings */

export interface ListingDraft {
  category: string;
  title: string;
  description: string;
  unit: string;
  price_min: number | null;
  price_max: number | null;
  min_order_qty: number | null;
  region_code: string | null;
  quality: Record<string, unknown>;
}

/** Listing-quality score is derived from content only — never from plan. */
export function listingQualityScore(draft: ListingDraft): number {
  let score = 0;
  if ((draft.title ?? "").trim().length >= 8) score += 20;
  if ((draft.description ?? "").trim().length >= 40) score += 20;
  if (draft.price_min != null && draft.price_max != null && draft.price_max >= draft.price_min) score += 20;
  if (draft.min_order_qty != null && draft.min_order_qty > 0) score += 15;
  if ((draft.region_code ?? "").trim().length > 0) score += 15;
  if (Object.keys(draft.quality ?? {}).length > 0) score += 10;
  return Math.min(score, 100);
}

export const MIN_PUBLISH_QUALITY_SCORE = 70;

export interface PublishDecision {
  ok: boolean;
  score: number;
  errors: string[];
}

/**
 * Publish gate. `entitlement` is accepted for auditability but can only ever
 * make the answer stricter, never looser: no plan bypasses quality or approval.
 */
export function evaluateListingPublish(input: {
  profileState: MarketProfileState;
  profileSide: MarketSide;
  draft: ListingDraft;
  entitlement: CommerceEntitlement;
}): PublishDecision {
  const errors: string[] = [];
  if (input.profileSide !== "seller") errors.push("seller_profile_required");
  if (input.profileState !== "approved") errors.push("seller_profile_not_approved");
  if (!isCategoryInScope(input.draft.category)) errors.push("category_out_of_scope");
  if (input.entitlement.status !== "active") errors.push("entitlement_not_active");

  const score = listingQualityScore(input.draft);
  if (score < MIN_PUBLISH_QUALITY_SCORE) errors.push(`listing_quality_below_threshold:${score}`);
  // Guard against a plan definition that tries to buy its way past quality.
  if (planGrants(input.entitlement, "bypass_listing_quality")) errors.push("invalid_entitlement_claim");

  return { ok: errors.length === 0, score, errors };
}

/* ----------------------------------------------------- neutral discovery */

export interface RankableListing {
  id: string;
  category: string;
  region_code: string | null;
  quality_score: number;
  price_min: number | null;
  status: ListingStatus;
  is_sponsored: boolean;
  seller_plan: string;
  created_at: string;
}

export interface DiscoveryQuery {
  category?: string | null;
  region_code?: string | null;
  maxPrice?: number | null;
  text?: string | null;
}

export interface RankedListing {
  id: string;
  matchScore: number;
}

/**
 * Neutral matching: score depends only on query fit, listing quality and price.
 * Seller plan and sponsorship are NOT inputs. Ties break on id so ordering is
 * deterministic rather than insertion-order dependent.
 */
export function rankListings(
  listings: RankableListing[],
  query: DiscoveryQuery,
  options: { sponsoredPlacementEnabled?: boolean } = {},
): RankedListing[] {
  const sponsoredEnabled = options.sponsoredPlacementEnabled === true;
  const scored = listings
    .filter((l) => l.status === "published")
    .filter((l) => (query.category ? l.category === query.category : true))
    .filter((l) => (query.region_code ? l.region_code === query.region_code : true))
    .filter((l) => (query.maxPrice != null ? (l.price_min ?? 0) <= query.maxPrice : true))
    .map((l) => {
      let matchScore = l.quality_score;
      if (query.category && l.category === query.category) matchScore += 10;
      if (query.region_code && l.region_code === query.region_code) matchScore += 10;
      if (query.maxPrice != null && l.price_min != null && l.price_min <= query.maxPrice) matchScore += 5;
      return { id: l.id, matchScore };
    });

  scored.sort((a, b) => (b.matchScore - a.matchScore) || a.id.localeCompare(b.id));
  // Sponsored slots stay inert until decision D-15; even when the flag flips on
  // it is a separate labelled surface, never a reordering of organic results.
  if (!sponsoredEnabled) return scored;
  return scored;
}

/** Sponsored placement is schema-only in this slice. */
export function sponsoredPlacementsVisible(flagEnabled: boolean): boolean {
  return flagEnabled === true;
}

/* --------------------------------------------------------------------- RFQ */

export interface RfqDraft {
  category: string;
  title: string;
  quantity: number;
  unit: string;
  delivery_region: string | null;
  is_aggregated: boolean;
  aggregation_authority_ref: string | null;
}

export function evaluateRfqCreate(input: {
  profileState: MarketProfileState;
  profileSide: MarketSide;
  draft: RfqDraft;
  entitlement: CommerceEntitlement;
  /** Delegated purchasing authority rule approved for the aggregating tenant. */
  delegatedAuthorityApproved: boolean;
  aggregatedRfqFlagEnabled: boolean;
}): CheckResult {
  const errors: string[] = [];
  if (input.profileSide !== "buyer") errors.push("buyer_profile_required");
  if (input.profileState !== "approved") errors.push("buyer_profile_not_approved");
  if (!isCategoryInScope(input.draft.category)) errors.push("category_out_of_scope");
  if ((input.draft.title ?? "").trim().length < 5) errors.push("title_required");
  if (!(input.draft.quantity > 0)) errors.push("quantity_must_be_positive");
  if (input.entitlement.status !== "active") errors.push("entitlement_not_active");

  if (input.draft.is_aggregated) {
    // FPO aggregated demand is delegated purchasing: blocked until the rule is
    // approved AND the flag is on. Paid plans cannot substitute for authority.
    if (!input.aggregatedRfqFlagEnabled) errors.push("aggregated_rfq_not_activated");
    if (!input.delegatedAuthorityApproved) errors.push("delegated_authority_rule_not_approved");
    if (!(input.draft.aggregation_authority_ref ?? "").trim()) errors.push("authority_reference_required");
  }
  return { ok: errors.length === 0, errors };
}

/* ------------------------------------------------------------------ order */

const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  created: ["accepted", "cancelled", "disputed"],
  accepted: ["fulfilled", "cancelled", "disputed"],
  fulfilled: ["closed", "disputed"],
  disputed: ["closed", "cancelled"],
  cancelled: [],
  closed: [],
};

export interface OrderTransitionPlan {
  ok: boolean;
  status: OrderStatus;
  error: string;
}

export function planOrderTransition(input: {
  current: OrderStatus;
  next: OrderStatus;
  actorRole: "buyer" | "seller" | "operator";
  note: string;
}): OrderTransitionPlan {
  const fail = (error: string): OrderTransitionPlan => ({ ok: false, status: input.current, error });
  if (!ORDER_TRANSITIONS[input.current].includes(input.next)) return fail("invalid_transition");
  if (input.next === "accepted" && input.actorRole !== "seller") return fail("only_seller_can_accept");
  if (input.next === "fulfilled" && input.actorRole !== "seller") return fail("only_seller_can_fulfil");
  if (input.next === "closed" && input.actorRole === "seller") return fail("seller_cannot_close");
  if (input.next === "cancelled" && (input.note ?? "").trim().length < 5) return fail("cancel_reason_required");
  return { ok: true, status: input.next, error: "" };
}

/* --------------------------------------------------------------- disputes */

export interface DisputeRoute {
  ok: boolean;
  status: DisputeStatus;
  requiresHumanReview: true;
  errors: string[];
}

/**
 * A dispute is always routed to human review — there is no automated outcome,
 * and no plan or flag can change that.
 */
export function routeDispute(input: {
  orderStatus: OrderStatus;
  actorIsParty: boolean;
  category: string;
  summary: string;
  flagEnabled: boolean;
}): DisputeRoute {
  const errors: string[] = [];
  if (!input.flagEnabled) errors.push("dispute_workflow_not_activated");
  if (!input.actorIsParty) errors.push("only_order_party_can_raise_dispute");
  if (input.orderStatus === "cancelled" || input.orderStatus === "closed") {
    errors.push("order_not_disputable");
  }
  if ((input.category ?? "").trim().length === 0) errors.push("category_required");
  if ((input.summary ?? "").trim().length < 20) errors.push("summary_too_short");
  return {
    ok: errors.length === 0,
    status: "human_review",
    requiresHumanReview: true,
    errors,
  };
}

export function planDisputeDecision(input: {
  current: DisputeStatus;
  next: DisputeStatus;
  actorIsAuthorizedReviewer: boolean;
  resolutionNote: string;
}): { ok: boolean; status: DisputeStatus; error: string } {
  if (!input.actorIsAuthorizedReviewer) {
    return { ok: false, status: input.current, error: "human_reviewer_required" };
  }
  if (input.next !== "resolved" && input.next !== "rejected") {
    return { ok: false, status: input.current, error: "invalid_dispute_outcome" };
  }
  if (input.current !== "human_review" && input.current !== "open") {
    return { ok: false, status: input.current, error: "dispute_already_decided" };
  }
  if ((input.resolutionNote ?? "").trim().length < 10) {
    return { ok: false, status: input.current, error: "resolution_note_required" };
  }
  return { ok: true, status: input.next, error: "" };
}

/* ---------------------------------------------------------------- summary */

export function summariseMarketplace(input: {
  listings: Array<{ status: ListingStatus }>;
  rfqs: Array<{ status: RfqStatus }>;
  orders: Array<{ status: OrderStatus }>;
  disputes: Array<{ status: DisputeStatus }>;
}) {
  const count = <T extends string>(rows: Array<{ status: T }>, status: T) =>
    rows.filter((r) => r.status === status).length;
  return {
    publishedListings: count(input.listings, "published"),
    pendingListings: count(input.listings, "pending_review"),
    openRfqs: count(input.rfqs, "open") + count(input.rfqs, "quoted"),
    liveOrders: count(input.orders, "created") + count(input.orders, "accepted"),
    disputesInHumanReview: count(input.disputes, "human_review"),
  };
}
