import { describe, expect, it } from "vitest";
import {
  CATEGORIES,
  MIN_PUBLISH_QUALITY_SCORE,
  NON_PURCHASABLE_CAPABILITIES,
  checkProfileSubmit,
  entitlementFor,
  evaluateListingPublish,
  evaluateRfqCreate,
  isCategoryInScope,
  listingQualityScore,
  planDisputeDecision,
  planGrants,
  planOrderTransition,
  rankListings,
  routeDispute,
  sponsoredPlacementsVisible,
  summariseMarketplace,
  type ListingDraft,
  type RankableListing,
} from "./marketplace";

const goodListing: ListingDraft = {
  category: "seed",
  title: "Certified paddy seed BPT-5204",
  description:
    "Certified paddy seed lot with germination certificate, packed in 20 kg bags, available across Warangal district.",
  unit: "kg",
  price_min: 40,
  price_max: 48,
  min_order_qty: 200,
  region_code: "TS-WGL",
  quality: { germination_pct: 92, certification: "state_seed_lab" },
};

describe("scope guardrails (DO NOT BUILD list)", () => {
  it("only exposes inputs, equipment-for-sale and produce categories", () => {
    expect(CATEGORIES.every((c) => ["inputs", "equipment", "produce"].includes(c.group))).toBe(true);
  });

  it.each([
    "equipment_rental",
    "warehousing",
    "export_trade",
    "auction_lot",
    "carbon_credits",
    "logistics_freight",
  ])("blocks out-of-slice category %s", (code) => {
    expect(isCategoryInScope(code)).toBe(false);
  });
});

describe("commerce profile onboarding", () => {
  it("accepts a complete seller profile", () => {
    const result = checkProfileSubmit({
      party_kind: "input_supplier",
      side: "seller",
      display_name: "Synthetic Agri Inputs Pvt Ltd",
      contact_email: "sales@example.com",
      categories: ["seed", "fertiliser"],
      regions: ["TS-WGL"],
      state: "draft",
    });
    expect(result).toEqual({ ok: true, errors: [] });
  });

  it("rejects out-of-scope categories and missing details", () => {
    const result = checkProfileSubmit({
      party_kind: "buyer_trader",
      side: "buyer",
      display_name: "X",
      contact_email: "not-an-email",
      categories: ["warehousing"],
      regions: [],
      state: "draft",
    });
    expect(result.ok).toBe(false);
    expect(result.errors).toContain("display_name_required");
    expect(result.errors).toContain("valid_contact_email_required");
    expect(result.errors).toContain("at_least_one_region_required");
    expect(result.errors.some((e) => e.startsWith("out_of_scope_categories"))).toBe(true);
  });

  it("refuses to re-submit an already approved profile", () => {
    const result = checkProfileSubmit({
      party_kind: "processor",
      side: "buyer",
      display_name: "Synthetic Processor",
      contact_email: "p@example.com",
      categories: ["produce_grain"],
      regions: ["TS-WGL"],
      state: "approved",
    });
    expect(result.errors).toContain("profile_not_editable");
  });
});

describe("GATE 1 — approved seller can publish a listing", () => {
  it("publishes when the profile is approved and quality clears the bar", () => {
    const decision = evaluateListingPublish({
      profileState: "approved",
      profileSide: "seller",
      draft: goodListing,
      entitlement: entitlementFor("base"),
    });
    expect(decision.ok).toBe(true);
    expect(decision.score).toBeGreaterThanOrEqual(MIN_PUBLISH_QUALITY_SCORE);
  });

  it("blocks publishing before the seller profile is approved", () => {
    const decision = evaluateListingPublish({
      profileState: "submitted",
      profileSide: "seller",
      draft: goodListing,
      entitlement: entitlementFor("base"),
    });
    expect(decision.ok).toBe(false);
    expect(decision.errors).toContain("seller_profile_not_approved");
  });

  it("blocks a buyer profile from publishing listings", () => {
    const decision = evaluateListingPublish({
      profileState: "approved",
      profileSide: "buyer",
      draft: goodListing,
      entitlement: entitlementFor("base"),
    });
    expect(decision.errors).toContain("seller_profile_required");
  });
});

describe("GATE 2 — paid tier does not bypass quality, consent or neutral matching", () => {
  const thinListing: ListingDraft = {
    ...goodListing,
    title: "Seed",
    description: "cheap",
    price_min: null,
    price_max: null,
    min_order_qty: null,
    region_code: null,
    quality: {},
  };

  it("enterprise plan still fails the listing-quality threshold", () => {
    for (const plan of ["base", "growth", "enterprise"]) {
      const decision = evaluateListingPublish({
        profileState: "approved",
        profileSide: "seller",
        draft: thinListing,
        entitlement: entitlementFor(plan),
      });
      expect(decision.ok).toBe(false);
      expect(decision.errors.some((e) => e.startsWith("listing_quality_below_threshold"))).toBe(true);
    }
  });

  it("quality score is identical across plans for identical content", () => {
    const scores = ["base", "growth", "enterprise"].map(
      (plan) =>
        evaluateListingPublish({
          profileState: "approved",
          profileSide: "seller",
          draft: goodListing,
          entitlement: entitlementFor(plan),
        }).score,
    );
    expect(new Set(scores).size).toBe(1);
    expect(scores[0]).toBe(listingQualityScore(goodListing));
  });

  it("no plan can grant a non-purchasable capability", () => {
    for (const plan of ["base", "growth", "enterprise"]) {
      for (const capability of NON_PURCHASABLE_CAPABILITIES) {
        expect(planGrants(entitlementFor(plan), capability)).toBe(false);
      }
    }
  });

  it("ranking is unchanged when seller plans differ", () => {
    const base: Omit<RankableListing, "id" | "seller_plan"> = {
      category: "seed",
      region_code: "TS-WGL",
      quality_score: 80,
      price_min: 40,
      status: "published",
      is_sponsored: false,
      created_at: "2026-01-01T00:00:00Z",
    };
    const cheap: RankableListing[] = [
      { ...base, id: "a", seller_plan: "base" },
      { ...base, id: "b", seller_plan: "base" },
    ];
    const paid: RankableListing[] = [
      { ...base, id: "a", seller_plan: "enterprise" },
      { ...base, id: "b", seller_plan: "base" },
    ];
    const query = { category: "seed", region_code: "TS-WGL" };
    expect(rankListings(paid, query)).toEqual(rankListings(cheap, query));
  });

  it("sponsorship does not reorder organic results, flag on or off", () => {
    const listings: RankableListing[] = [
      {
        id: "organic",
        category: "seed",
        region_code: "TS-WGL",
        quality_score: 90,
        price_min: 40,
        status: "published",
        is_sponsored: false,
        seller_plan: "base",
        created_at: "2026-01-01T00:00:00Z",
      },
      {
        id: "sponsored",
        category: "seed",
        region_code: "TS-WGL",
        quality_score: 70,
        price_min: 40,
        status: "published",
        is_sponsored: true,
        seller_plan: "enterprise",
        created_at: "2026-01-02T00:00:00Z",
      },
    ];
    const off = rankListings(listings, { category: "seed" }, { sponsoredPlacementEnabled: false });
    const on = rankListings(listings, { category: "seed" }, { sponsoredPlacementEnabled: true });
    expect(off.map((l) => l.id)).toEqual(["organic", "sponsored"]);
    expect(on).toEqual(off);
  });

  it("sponsored placement UI stays off while the flag is off (D-15)", () => {
    expect(sponsoredPlacementsVisible(false)).toBe(false);
    expect(sponsoredPlacementsVisible(true)).toBe(true);
  });

  it("hides unpublished listings from discovery", () => {
    const ranked = rankListings(
      [
        {
          id: "draft",
          category: "seed",
          region_code: null,
          quality_score: 100,
          price_min: 1,
          status: "draft",
          is_sponsored: false,
          seller_plan: "enterprise",
          created_at: "2026-01-01T00:00:00Z",
        },
      ],
      {},
    );
    expect(ranked).toEqual([]);
  });
});

describe("GATE 1 (buyer half) — approved buyer can create an RFQ/order", () => {
  const draft = {
    category: "produce_grain",
    title: "Maize 50 MT for feed mill",
    quantity: 50,
    unit: "MT",
    delivery_region: "TS-WGL",
    is_aggregated: false,
    aggregation_authority_ref: null,
  };

  it("allows an approved buyer profile", () => {
    const result = evaluateRfqCreate({
      profileState: "approved",
      profileSide: "buyer",
      draft,
      entitlement: entitlementFor("base"),
      delegatedAuthorityApproved: false,
      aggregatedRfqFlagEnabled: false,
    });
    expect(result).toEqual({ ok: true, errors: [] });
  });

  it("blocks an unapproved buyer and a seller-side profile", () => {
    expect(
      evaluateRfqCreate({
        profileState: "draft",
        profileSide: "seller",
        draft,
        entitlement: entitlementFor("enterprise"),
        delegatedAuthorityApproved: true,
        aggregatedRfqFlagEnabled: true,
      }).errors,
    ).toEqual(expect.arrayContaining(["buyer_profile_required", "buyer_profile_not_approved"]));
  });

  it("blocks FPO aggregated demand until the delegated-authority rule is approved", () => {
    const result = evaluateRfqCreate({
      profileState: "approved",
      profileSide: "buyer",
      draft: { ...draft, is_aggregated: true },
      entitlement: entitlementFor("enterprise"),
      delegatedAuthorityApproved: false,
      aggregatedRfqFlagEnabled: true,
    });
    expect(result.ok).toBe(false);
    expect(result.errors).toContain("delegated_authority_rule_not_approved");
  });

  it("blocks aggregated demand while the activation flag is off even with authority", () => {
    const result = evaluateRfqCreate({
      profileState: "approved",
      profileSide: "buyer",
      draft: { ...draft, is_aggregated: true, aggregation_authority_ref: "RES-2026-01" },
      entitlement: entitlementFor("enterprise"),
      delegatedAuthorityApproved: true,
      aggregatedRfqFlagEnabled: false,
    });
    expect(result.errors).toContain("aggregated_rfq_not_activated");
  });

  it("allows aggregated demand only with flag, approved rule and authority reference", () => {
    const result = evaluateRfqCreate({
      profileState: "approved",
      profileSide: "buyer",
      draft: { ...draft, is_aggregated: true, aggregation_authority_ref: "RES-2026-01" },
      entitlement: entitlementFor("base"),
      delegatedAuthorityApproved: true,
      aggregatedRfqFlagEnabled: true,
    });
    expect(result.ok).toBe(true);
  });
});

describe("order workflow shell", () => {
  it("only the seller may accept or fulfil", () => {
    expect(
      planOrderTransition({ current: "created", next: "accepted", actorRole: "buyer", note: "" }).error,
    ).toBe("only_seller_can_accept");
    expect(
      planOrderTransition({ current: "created", next: "accepted", actorRole: "seller", note: "" }).ok,
    ).toBe(true);
    expect(
      planOrderTransition({ current: "accepted", next: "fulfilled", actorRole: "seller", note: "" }).ok,
    ).toBe(true);
  });

  it("rejects invalid transitions and unexplained cancellations", () => {
    expect(
      planOrderTransition({ current: "closed", next: "accepted", actorRole: "seller", note: "" }).error,
    ).toBe("invalid_transition");
    expect(
      planOrderTransition({ current: "created", next: "cancelled", actorRole: "buyer", note: "" }).error,
    ).toBe("cancel_reason_required");
  });
});

describe("GATE 3 — marketplace dispute routes to human review", () => {
  const valid = {
    orderStatus: "accepted" as const,
    actorIsParty: true,
    category: "quality_mismatch",
    summary: "Delivered lot germination is materially below the published listing certificate.",
    flagEnabled: true,
  };

  it("routes a valid dispute to human review", () => {
    const result = routeDispute(valid);
    expect(result.ok).toBe(true);
    expect(result.status).toBe("human_review");
    expect(result.requiresHumanReview).toBe(true);
  });

  it("always reports human review as required, even when rejected", () => {
    const result = routeDispute({ ...valid, actorIsParty: false });
    expect(result.ok).toBe(false);
    expect(result.errors).toContain("only_order_party_can_raise_dispute");
    expect(result.requiresHumanReview).toBe(true);
  });

  it("requires a substantive summary and a live order", () => {
    expect(routeDispute({ ...valid, summary: "bad" }).errors).toContain("summary_too_short");
    expect(routeDispute({ ...valid, orderStatus: "closed" }).errors).toContain("order_not_disputable");
  });

  it("only an authorized human reviewer can decide, with a note", () => {
    expect(
      planDisputeDecision({
        current: "human_review",
        next: "resolved",
        actorIsAuthorizedReviewer: false,
        resolutionNote: "Replacement lot agreed with both parties.",
      }).error,
    ).toBe("human_reviewer_required");
    expect(
      planDisputeDecision({
        current: "human_review",
        next: "resolved",
        actorIsAuthorizedReviewer: true,
        resolutionNote: "short",
      }).error,
    ).toBe("resolution_note_required");
    expect(
      planDisputeDecision({
        current: "human_review",
        next: "resolved",
        actorIsAuthorizedReviewer: true,
        resolutionNote: "Replacement lot agreed with both parties.",
      }),
    ).toEqual({ ok: true, status: "resolved", error: "" });
  });

  it("cannot auto-close a dispute into an arbitrary state", () => {
    expect(
      planDisputeDecision({
        current: "human_review",
        next: "open",
        actorIsAuthorizedReviewer: true,
        resolutionNote: "Auto-closed by system.",
      }).error,
    ).toBe("invalid_dispute_outcome");
  });
});

describe("entitlement scaffolding", () => {
  it("assumes no pricing", () => {
    for (const plan of ["base", "growth", "enterprise"]) {
      const e = entitlementFor(plan);
      expect(e.retainer_amount).toBeNull();
      expect(e.transaction_fee_bps).toBeNull();
      expect(e.currency).toBeNull();
    }
  });

  it("suspended entitlements grant nothing", () => {
    expect(planGrants(entitlementFor("enterprise", "suspended"), "analytics_advanced")).toBe(false);
  });
});

describe("marketplace summary", () => {
  it("counts the operational surfaces", () => {
    expect(
      summariseMarketplace({
        listings: [{ status: "published" }, { status: "pending_review" }, { status: "draft" }],
        rfqs: [{ status: "open" }, { status: "quoted" }, { status: "draft" }],
        orders: [{ status: "created" }, { status: "accepted" }, { status: "closed" }],
        disputes: [{ status: "human_review" }, { status: "resolved" }],
      }),
    ).toEqual({
      publishedListings: 1,
      pendingListings: 1,
      openRfqs: 2,
      liveOrders: 2,
      disputesInHumanReview: 1,
    });
  });
});
