/**
 * B5 — Inputs & Produce base marketplace: server functions.
 *
 * Every handler re-checks authority server-side; UI hiding is never the control.
 * All rule decisions come from the pure module `marketplace.ts` so the tested
 * behaviour and the runtime behaviour cannot drift.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  CATEGORIES,
  MIN_PUBLISH_QUALITY_SCORE,
  checkProfileSubmit,
  entitlementFor,
  evaluateListingPublish,
  evaluateRfqCreate,
  isCategoryInScope,
  listingQualityScore,
  planDisputeDecision,
  planOrderTransition,
  rankListings,
  routeDispute,
  summariseMarketplace,
  type DisputeStatus,
  type ListingStatus,
  type MarketPartyKind,
  type MarketProfileState,
  type MarketSide,
  type OrderStatus,
  type RfqStatus,
} from "@/lib/atap/marketplace";

/* ------------------------------------------------------------------ types */

export interface MarketProfileRow {
  id: string;
  party_kind: MarketPartyKind;
  side: MarketSide;
  display_name: string;
  contact_email: string;
  categories: string[];
  regions: string[];
  state: MarketProfileState;
  decision_note: string | null;
  tenant_id: string | null;
  created_by: string | null;
  created_at: string;
}

export interface ListingRow {
  id: string;
  seller_profile_id: string;
  category: string;
  title: string;
  description: string;
  unit: string;
  price_min: number | null;
  price_max: number | null;
  min_order_qty: number | null;
  region_code: string | null;
  quality_score: number;
  status: ListingStatus;
  review_note: string | null;
  is_sponsored: boolean;
  created_by: string | null;
  created_at: string;
}

export interface RfqRow {
  id: string;
  buyer_profile_id: string;
  category: string;
  title: string;
  quantity: number;
  unit: string;
  delivery_region: string | null;
  notes: string;
  is_aggregated: boolean;
  aggregating_tenant_id: string | null;
  status: RfqStatus;
  created_by: string | null;
  created_at: string;
}

export interface QuoteRow {
  id: string;
  rfq_id: string;
  listing_id: string | null;
  seller_profile_id: string;
  price: number;
  unit: string;
  note: string;
  status: string;
  created_by: string | null;
  created_at: string;
}

export interface OrderRow {
  id: string;
  rfq_id: string | null;
  quote_id: string | null;
  buyer_profile_id: string;
  seller_profile_id: string;
  buyer_user_id: string | null;
  seller_user_id: string | null;
  quantity: number;
  unit: string;
  agreed_price: number | null;
  status: OrderStatus;
  status_note: string | null;
  created_at: string;
}

export interface DisputeRow {
  id: string;
  order_id: string;
  raised_by: string | null;
  category: string;
  summary: string;
  status: DisputeStatus;
  resolution_note: string | null;
  created_at: string;
}

export interface MarketplaceWorkspace {
  userId: string;
  categories: typeof CATEGORIES;
  minPublishScore: number;
  myProfiles: MarketProfileRow[];
  myListings: ListingRow[];
  publishedListings: ListingRow[];
  openRfqs: RfqRow[];
  myRfqs: RfqRow[];
  quotes: QuoteRow[];
  orders: OrderRow[];
  disputes: DisputeRow[];
  reviewProfiles: MarketProfileRow[];
  reviewListings: ListingRow[];
  reviewDisputes: DisputeRow[];
  plans: Array<{ profile_id: string | null; plan_code: string; status: string }>;
  flags: {
    baseCommerce: boolean;
    aggregatedRfq: boolean;
    sponsoredPlacement: boolean;
    disputeWorkflow: boolean;
  };
  canReview: boolean;
  summary: ReturnType<typeof summariseMarketplace>;
}

const PARTY_KINDS: MarketPartyKind[] = [
  "input_supplier",
  "equipment_supplier",
  "buyer_trader",
  "processor",
  "fpo_aggregator",
];

/* --------------------------------------------------------------- workspace */

export const getMarketplaceWorkspace = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MarketplaceWorkspace> => {
    const { supabase, userId } = context;
    const { resolveMarketActor, canReviewMarketplace, flagEnabled } = await import(
      "@/lib/atap/marketplace.server"
    );
    const actor = await resolveMarketActor(supabase, userId);
    const canReview = canReviewMarketplace(actor);

    const [profiles, listings, rfqs, quotes, orders, disputes, plans] = await Promise.all([
      supabase.from("marketplace_profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("marketplace_listings").select("*").order("created_at", { ascending: false }),
      supabase.from("marketplace_rfqs").select("*").order("created_at", { ascending: false }),
      supabase.from("marketplace_quotes").select("*").order("created_at", { ascending: false }),
      supabase.from("marketplace_orders").select("*").order("created_at", { ascending: false }),
      supabase.from("marketplace_disputes").select("*").order("created_at", { ascending: false }),
      supabase.from("commerce_entitlements").select("profile_id, plan_code, status"),
    ]);

    const [baseCommerce, aggregatedRfq, sponsoredPlacement, disputeWorkflow] = await Promise.all([
      flagEnabled(supabase, "marketplace.base_commerce"),
      flagEnabled(supabase, "marketplace.fpo_aggregated_rfq"),
      flagEnabled(supabase, "marketplace.sponsored_placement"),
      flagEnabled(supabase, "marketplace.dispute_workflow"),
    ]);

    const allProfiles = (profiles.data ?? []) as unknown as MarketProfileRow[];
    const allListings = (listings.data ?? []) as unknown as ListingRow[];
    const allRfqs = (rfqs.data ?? []) as unknown as RfqRow[];
    const allDisputes = (disputes.data ?? []) as unknown as DisputeRow[];

    return {
      userId,
      categories: CATEGORIES,
      minPublishScore: MIN_PUBLISH_QUALITY_SCORE,
      myProfiles: allProfiles.filter((p) => p.created_by === userId),
      myListings: allListings.filter((l) => l.created_by === userId),
      publishedListings: allListings.filter((l) => l.status === "published"),
      openRfqs: allRfqs.filter((r) => r.status === "open" || r.status === "quoted"),
      myRfqs: allRfqs.filter((r) => r.created_by === userId),
      quotes: (quotes.data ?? []) as unknown as QuoteRow[],
      orders: (orders.data ?? []) as unknown as OrderRow[],
      disputes: allDisputes,
      reviewProfiles: canReview ? allProfiles.filter((p) => p.state === "submitted") : [],
      reviewListings: canReview ? allListings.filter((l) => l.status === "pending_review") : [],
      reviewDisputes: canReview ? allDisputes.filter((d) => d.status === "human_review") : [],
      plans: (plans.data ?? []) as unknown as Array<{
        profile_id: string | null;
        plan_code: string;
        status: string;
      }>,
      flags: { baseCommerce, aggregatedRfq, sponsoredPlacement, disputeWorkflow },
      canReview,
      summary: summariseMarketplace({
        listings: allListings,
        rfqs: allRfqs,
        orders: (orders.data ?? []) as unknown as OrderRow[],
        disputes: allDisputes,
      }),
    };
  });

/** Neutral discovery: identical inputs give identical ordering for everyone. */
export const searchListings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { category?: string | null; region?: string | null; maxPrice?: number | null }) => input,
  )
  .handler(async ({ data, context }): Promise<{ results: ListingRow[]; sponsoredVisible: boolean }> => {
    const { supabase } = context;
    const { flagEnabled } = await import("@/lib/atap/marketplace.server");
    const sponsoredVisible = await flagEnabled(supabase, "marketplace.sponsored_placement");

    const { data: rows } = await supabase
      .from("marketplace_listings")
      .select("*")
      .eq("status", "published");
    const listings = (rows ?? []) as unknown as ListingRow[];

    const ranked = rankListings(
      listings.map((l) => ({
        id: l.id,
        category: l.category,
        region_code: l.region_code,
        quality_score: l.quality_score,
        price_min: l.price_min,
        status: l.status,
        is_sponsored: l.is_sponsored,
        seller_plan: "base",
        created_at: l.created_at,
      })),
      {
        category: data.category ?? null,
        region_code: data.region ?? null,
        maxPrice: data.maxPrice ?? null,
      },
      { sponsoredPlacementEnabled: sponsoredVisible },
    );

    const byId = new Map(listings.map((l) => [l.id, l]));
    return {
      results: ranked.flatMap((r) => {
        const row = byId.get(r.id);
        return row ? [row] : [];
      }),
      sponsoredVisible,
    };
  });

/* ---------------------------------------------------------------- profiles */

export const createMarketProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      partyKind: MarketPartyKind;
      side: MarketSide;
      displayName: string;
      contactEmail: string;
      categories: string[];
      regions: string[];
      tenantId?: string | null;
    }) => {
      if (!PARTY_KINDS.includes(input.partyKind)) throw new Error("invalid_party_kind");
      if (input.side !== "seller" && input.side !== "buyer") throw new Error("invalid_side");
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { flagEnabled } = await import("@/lib/atap/marketplace.server");
    const { writeAuditRow } = await import("@/lib/atap/onboarding.server");
    if (!(await flagEnabled(supabase, "marketplace.base_commerce"))) {
      throw new Error("marketplace_not_activated");
    }
    const outOfScope = data.categories.filter((c) => !isCategoryInScope(c));
    if (outOfScope.length > 0) throw new Error(`out_of_scope_categories:${outOfScope.join(",")}`);

    const { data: row, error } = await supabase
      .from("marketplace_profiles")
      .insert({
        party_kind: data.partyKind,
        side: data.side,
        display_name: data.displayName.trim(),
        contact_email: data.contactEmail.trim(),
        categories: data.categories,
        regions: data.regions,
        tenant_id: data.tenantId ?? null,
        created_by: userId,
        state: "draft",
      } as never)
      .select("id")
      .single();
    if (error || !row) throw new Error("profile_create_failed");

    await writeAuditRow(supabase, {
      actor_user_id: userId,
      action: "market.profile.create",
      subject_type: "marketplace_profile",
      subject_id: row.id,
      decision: "allow",
      metadata: { party_kind: data.partyKind, side: data.side, categories: data.categories },
    });
    return { id: row.id as string };
  });

export const submitMarketProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { profileId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { writeAuditRow } = await import("@/lib/atap/onboarding.server");

    const { data: found } = await supabase
      .from("marketplace_profiles")
      .select("*")
      .eq("id", data.profileId)
      .maybeSingle();
    if (!found) throw new Error("profile_not_found");
    const profile = found as unknown as MarketProfileRow;
    if (profile.created_by !== userId) throw new Error("not_profile_owner");

    const check = checkProfileSubmit({
      party_kind: profile.party_kind,
      side: profile.side,
      display_name: profile.display_name,
      contact_email: profile.contact_email,
      categories: profile.categories,
      regions: profile.regions,
      state: profile.state,
    });
    if (!check.ok) throw new Error(check.errors.join(" "));

    await supabase
      .from("marketplace_profiles")
      .update({ state: "submitted" } as never)
      .eq("id", data.profileId);

    await writeAuditRow(supabase, {
      actor_user_id: userId,
      action: "market.profile.submit",
      subject_type: "marketplace_profile",
      subject_id: data.profileId,
      decision: "allow",
      metadata: { side: profile.side },
    });
    return { ok: true };
  });

/** Internal human decision; approval also seeds the base commercial plan. */
export const decideMarketProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { profileId: string; decision: "approved" | "rejected" | "suspended"; note: string }) => {
      if ((input.note ?? "").trim().length < 10) throw new Error("decision_note_required");
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { resolveMarketActor, canReviewMarketplace } = await import("@/lib/atap/marketplace.server");
    const { writeAuditRow } = await import("@/lib/atap/onboarding.server");
    const actor = await resolveMarketActor(supabase, userId);
    if (!canReviewMarketplace(actor)) {
      await writeAuditRow(supabase, {
        actor_user_id: userId,
        action: "market.profile.decide",
        subject_type: "marketplace_profile",
        subject_id: data.profileId,
        decision: "deny",
        metadata: { reason: "market_reviewer_required" },
      });
      throw new Error("market_reviewer_required");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("marketplace_profiles")
      .update({
        state: data.decision,
        decision_note: data.note.trim(),
        decided_by: userId,
        decided_at: new Date().toISOString(),
      } as never)
      .eq("id", data.profileId);

    if (data.decision === "approved") {
      // Base plan only. No pricing is written: commercial terms are unresolved.
      const { data: existing } = await supabaseAdmin
        .from("commerce_entitlements")
        .select("id")
        .eq("profile_id", data.profileId)
        .maybeSingle();
      if (!existing) {
        await supabaseAdmin
          .from("commerce_entitlements")
          .insert({ profile_id: data.profileId, plan_code: "base" } as never);
      }
    }

    await writeAuditRow(supabase, {
      actor_user_id: userId,
      action: "market.profile.decide",
      subject_type: "marketplace_profile",
      subject_id: data.profileId,
      decision: "allow",
      metadata: { outcome: data.decision, note: data.note.trim() },
    });
    return { ok: true };
  });

/* ---------------------------------------------------------------- listings */

export const saveListing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      listingId?: string | null;
      sellerProfileId: string;
      category: string;
      title: string;
      description: string;
      unit: string;
      priceMin: number | null;
      priceMax: number | null;
      minOrderQty: number | null;
      regionCode: string | null;
      qualityNotes: string;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { writeAuditRow } = await import("@/lib/atap/onboarding.server");
    if (!isCategoryInScope(data.category)) throw new Error("category_out_of_scope");

    const { data: profileRow } = await supabase
      .from("marketplace_profiles")
      .select("*")
      .eq("id", data.sellerProfileId)
      .maybeSingle();
    if (!profileRow) throw new Error("profile_not_found");
    const profile = profileRow as unknown as MarketProfileRow;
    if (profile.created_by !== userId) throw new Error("not_profile_owner");
    if (profile.side !== "seller") throw new Error("seller_profile_required");

    const quality = data.qualityNotes.trim() ? { notes: data.qualityNotes.trim() } : {};
    const score = listingQualityScore({
      category: data.category,
      title: data.title,
      description: data.description,
      unit: data.unit,
      price_min: data.priceMin,
      price_max: data.priceMax,
      min_order_qty: data.minOrderQty,
      region_code: data.regionCode,
      quality,
    });

    const payload = {
      seller_profile_id: data.sellerProfileId,
      category: data.category,
      title: data.title.trim(),
      description: data.description.trim(),
      unit: data.unit.trim() || "kg",
      price_min: data.priceMin,
      price_max: data.priceMax,
      min_order_qty: data.minOrderQty,
      region_code: data.regionCode,
      quality,
      quality_score: score,
      created_by: userId,
    };

    let listingId = data.listingId ?? null;
    if (listingId) {
      const { data: existing } = await supabase
        .from("marketplace_listings")
        .select("created_by, status")
        .eq("id", listingId)
        .maybeSingle();
      const row = existing as { created_by: string | null; status: ListingStatus } | null;
      if (!row || row.created_by !== userId) throw new Error("not_listing_owner");
      if (row.status === "published") throw new Error("delist_before_editing");
      await supabase
        .from("marketplace_listings")
        .update(payload as never)
        .eq("id", listingId);
    } else {
      const { data: inserted, error } = await supabase
        .from("marketplace_listings")
        .insert(payload as never)
        .select("id")
        .single();
      if (error || !inserted) throw new Error("listing_save_failed");
      listingId = inserted.id as string;
    }

    await writeAuditRow(supabase, {
      actor_user_id: userId,
      action: "market.listing.save",
      subject_type: "marketplace_listing",
      subject_id: listingId,
      decision: "allow",
      metadata: { category: data.category, quality_score: score },
    });
    return { id: listingId, qualityScore: score };
  });

/**
 * Publish path. Runs the same `evaluateListingPublish` gate the tests cover, so
 * a paid plan cannot shortcut approval or listing quality.
 */
export const publishListing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { listingId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { entitlementForProfile } = await import("@/lib/atap/marketplace.server");
    const { writeAuditRow } = await import("@/lib/atap/onboarding.server");

    const { data: listingRow } = await supabase
      .from("marketplace_listings")
      .select("*")
      .eq("id", data.listingId)
      .maybeSingle();
    if (!listingRow) throw new Error("listing_not_found");
    const listing = listingRow as unknown as ListingRow;
    if (listing.created_by !== userId) throw new Error("not_listing_owner");

    const { data: profileRow } = await supabase
      .from("marketplace_profiles")
      .select("*")
      .eq("id", listing.seller_profile_id)
      .maybeSingle();
    const profile = profileRow as unknown as MarketProfileRow | null;
    if (!profile) throw new Error("profile_not_found");

    const entitlement = await entitlementForProfile(supabase, profile.id);
    const decision = evaluateListingPublish({
      profileState: profile.state,
      profileSide: profile.side,
      draft: {
        category: listing.category,
        title: listing.title,
        description: listing.description,
        unit: listing.unit,
        price_min: listing.price_min,
        price_max: listing.price_max,
        min_order_qty: listing.min_order_qty,
        region_code: listing.region_code,
        quality: listing.quality_score > 0 ? { scored: true } : {},
      },
      entitlement,
    });

    if (!decision.ok) {
      await writeAuditRow(supabase, {
        actor_user_id: userId,
        action: "market.listing.publish",
        subject_type: "marketplace_listing",
        subject_id: data.listingId,
        decision: "deny",
        metadata: { errors: decision.errors, plan: entitlement.plan_code, score: decision.score },
      });
      throw new Error(decision.errors.join(" "));
    }

    await supabase
      .from("marketplace_listings")
      .update({
        status: "published",
        published_at: new Date().toISOString(),
        review_note: null,
      } as never)
      .eq("id", data.listingId);

    await writeAuditRow(supabase, {
      actor_user_id: userId,
      action: "market.listing.publish",
      subject_type: "marketplace_listing",
      subject_id: data.listingId,
      decision: "allow",
      metadata: { plan: entitlement.plan_code, score: decision.score },
    });
    return { ok: true, score: decision.score };
  });

export const delistListing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { listingId: string; note: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { resolveMarketActor, canReviewMarketplace } = await import("@/lib/atap/marketplace.server");
    const { writeAuditRow } = await import("@/lib/atap/onboarding.server");

    const { data: listingRow } = await supabase
      .from("marketplace_listings")
      .select("created_by")
      .eq("id", data.listingId)
      .maybeSingle();
    if (!listingRow) throw new Error("listing_not_found");
    const actor = await resolveMarketActor(supabase, userId);
    const isOwner = (listingRow as { created_by: string | null }).created_by === userId;
    if (!isOwner && !canReviewMarketplace(actor)) throw new Error("not_authorized");

    await supabase
      .from("marketplace_listings")
      .update({ status: "delisted", review_note: data.note.trim() || null } as never)
      .eq("id", data.listingId);

    await writeAuditRow(supabase, {
      actor_user_id: userId,
      action: "market.listing.delist",
      subject_type: "marketplace_listing",
      subject_id: data.listingId,
      decision: "allow",
      metadata: { by_owner: isOwner, note: data.note.trim() },
    });
    return { ok: true };
  });

/* --------------------------------------------------------------- RFQ/order */

export const createRfq = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      buyerProfileId: string;
      category: string;
      title: string;
      quantity: number;
      unit: string;
      deliveryRegion: string | null;
      notes: string;
      isAggregated: boolean;
      aggregatingTenantId?: string | null;
      authorityRef?: string | null;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { entitlementForProfile, flagEnabled, delegatedPurchasingApproved } = await import(
      "@/lib/atap/marketplace.server"
    );
    const { writeAuditRow } = await import("@/lib/atap/onboarding.server");

    const { data: profileRow } = await supabase
      .from("marketplace_profiles")
      .select("*")
      .eq("id", data.buyerProfileId)
      .maybeSingle();
    if (!profileRow) throw new Error("profile_not_found");
    const profile = profileRow as unknown as MarketProfileRow;
    if (profile.created_by !== userId) throw new Error("not_profile_owner");

    const entitlement = await entitlementForProfile(supabase, profile.id);
    const check = evaluateRfqCreate({
      profileState: profile.state,
      profileSide: profile.side,
      draft: {
        category: data.category,
        title: data.title,
        quantity: data.quantity,
        unit: data.unit,
        delivery_region: data.deliveryRegion,
        is_aggregated: data.isAggregated,
        aggregation_authority_ref: data.authorityRef ?? null,
      },
      entitlement,
      delegatedAuthorityApproved: data.isAggregated
        ? await delegatedPurchasingApproved(supabase, data.aggregatingTenantId ?? profile.tenant_id)
        : false,
      aggregatedRfqFlagEnabled: await flagEnabled(supabase, "marketplace.fpo_aggregated_rfq"),
    });

    if (!check.ok) {
      await writeAuditRow(supabase, {
        actor_user_id: userId,
        action: "market.rfq.create",
        subject_type: "marketplace_profile",
        subject_id: profile.id,
        decision: "deny",
        metadata: { errors: check.errors, aggregated: data.isAggregated },
      });
      throw new Error(check.errors.join(" "));
    }

    const { data: row, error } = await supabase
      .from("marketplace_rfqs")
      .insert({
        buyer_profile_id: profile.id,
        category: data.category,
        title: data.title.trim(),
        quantity: data.quantity,
        unit: data.unit.trim() || "kg",
        delivery_region: data.deliveryRegion,
        notes: data.notes.trim(),
        is_aggregated: data.isAggregated,
        aggregating_tenant_id: data.isAggregated ? (data.aggregatingTenantId ?? null) : null,
        aggregation_authority_ref: data.isAggregated ? (data.authorityRef ?? null) : null,
        status: "open",
        created_by: userId,
      } as never)
      .select("id")
      .single();
    if (error || !row) throw new Error("rfq_create_failed");

    await writeAuditRow(supabase, {
      actor_user_id: userId,
      action: "market.rfq.create",
      subject_type: "marketplace_rfq",
      subject_id: row.id,
      decision: "allow",
      metadata: { category: data.category, aggregated: data.isAggregated },
    });
    return { id: row.id as string };
  });

export const submitQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { rfqId: string; sellerProfileId: string; listingId?: string | null; price: number; note: string }) =>
      input,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { writeAuditRow } = await import("@/lib/atap/onboarding.server");

    const { data: profileRow } = await supabase
      .from("marketplace_profiles")
      .select("*")
      .eq("id", data.sellerProfileId)
      .maybeSingle();
    const profile = profileRow as unknown as MarketProfileRow | null;
    if (!profile || profile.created_by !== userId) throw new Error("not_profile_owner");
    if (profile.side !== "seller") throw new Error("seller_profile_required");
    if (profile.state !== "approved") throw new Error("seller_profile_not_approved");
    if (!(data.price > 0)) throw new Error("price_must_be_positive");

    const { data: rfqRow } = await supabase
      .from("marketplace_rfqs")
      .select("id, status")
      .eq("id", data.rfqId)
      .maybeSingle();
    const rfq = rfqRow as { id: string; status: RfqStatus } | null;
    if (!rfq || (rfq.status !== "open" && rfq.status !== "quoted")) throw new Error("rfq_not_open");

    const { data: row, error } = await supabase
      .from("marketplace_quotes")
      .insert({
        rfq_id: data.rfqId,
        listing_id: data.listingId ?? null,
        seller_profile_id: profile.id,
        price: data.price,
        note: data.note.trim(),
        created_by: userId,
      } as never)
      .select("id")
      .single();
    if (error || !row) throw new Error("quote_failed");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("marketplace_rfqs").update({ status: "quoted" } as never).eq("id", data.rfqId);

    await writeAuditRow(supabase, {
      actor_user_id: userId,
      action: "market.quote.submit",
      subject_type: "marketplace_quote",
      subject_id: row.id,
      decision: "allow",
      metadata: { rfq_id: data.rfqId, price: data.price },
    });
    return { id: row.id as string };
  });

export const acceptQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { quoteId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { writeAuditRow } = await import("@/lib/atap/onboarding.server");

    const { data: quoteRow } = await supabase
      .from("marketplace_quotes")
      .select("*")
      .eq("id", data.quoteId)
      .maybeSingle();
    if (!quoteRow) throw new Error("quote_not_found");
    const quote = quoteRow as unknown as QuoteRow;

    const { data: rfqRow } = await supabase
      .from("marketplace_rfqs")
      .select("*")
      .eq("id", quote.rfq_id)
      .maybeSingle();
    const rfq = rfqRow as unknown as RfqRow | null;
    if (!rfq) throw new Error("rfq_not_found");
    if (rfq.created_by !== userId) throw new Error("only_rfq_owner_can_accept");

    const { data: order, error } = await supabase
      .from("marketplace_orders")
      .insert({
        rfq_id: rfq.id,
        quote_id: quote.id,
        buyer_profile_id: rfq.buyer_profile_id,
        seller_profile_id: quote.seller_profile_id,
        buyer_user_id: userId,
        seller_user_id: quote.created_by,
        quantity: rfq.quantity,
        unit: rfq.unit,
        agreed_price: quote.price,
        status: "created",
      } as never)
      .select("id")
      .single();
    if (error || !order) throw new Error("order_create_failed");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("marketplace_rfqs").update({ status: "ordered" } as never).eq("id", rfq.id);
    await supabaseAdmin
      .from("marketplace_quotes")
      .update({ status: "accepted" } as never)
      .eq("id", quote.id);

    await writeAuditRow(supabase, {
      actor_user_id: userId,
      action: "market.order.create",
      subject_type: "marketplace_order",
      subject_id: order.id,
      decision: "allow",
      metadata: { rfq_id: rfq.id, quote_id: quote.id, agreed_price: quote.price },
    });
    return { id: order.id as string };
  });

export const transitionOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orderId: string; next: OrderStatus; note: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { resolveMarketActor, canReviewMarketplace } = await import("@/lib/atap/marketplace.server");
    const { writeAuditRow } = await import("@/lib/atap/onboarding.server");

    const { data: orderRow } = await supabase
      .from("marketplace_orders")
      .select("*")
      .eq("id", data.orderId)
      .maybeSingle();
    if (!orderRow) throw new Error("order_not_found");
    const order = orderRow as unknown as OrderRow;

    const actor = await resolveMarketActor(supabase, userId);
    const actorRole =
      order.seller_user_id === userId
        ? "seller"
        : order.buyer_user_id === userId
          ? "buyer"
          : canReviewMarketplace(actor)
            ? "operator"
            : null;
    if (!actorRole) throw new Error("not_order_party");

    const plan = planOrderTransition({
      current: order.status,
      next: data.next,
      actorRole,
      note: data.note ?? "",
    });
    if (!plan.ok) {
      await writeAuditRow(supabase, {
        actor_user_id: userId,
        action: "market.order.transition",
        subject_type: "marketplace_order",
        subject_id: data.orderId,
        decision: "deny",
        metadata: { reason: plan.error, attempted: data.next },
      });
      throw new Error(plan.error);
    }

    await supabase
      .from("marketplace_orders")
      .update({ status: plan.status, status_note: data.note.trim() || null } as never)
      .eq("id", data.orderId);

    await writeAuditRow(supabase, {
      actor_user_id: userId,
      action: "market.order.transition",
      subject_type: "marketplace_order",
      subject_id: data.orderId,
      decision: "allow",
      metadata: { from: order.status, to: plan.status, actor_role: actorRole },
    });
    return { status: plan.status };
  });

/* --------------------------------------------------------------- disputes */

export const raiseDispute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orderId: string; category: string; summary: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { flagEnabled } = await import("@/lib/atap/marketplace.server");
    const { writeAuditRow } = await import("@/lib/atap/onboarding.server");

    const { data: orderRow } = await supabase
      .from("marketplace_orders")
      .select("*")
      .eq("id", data.orderId)
      .maybeSingle();
    if (!orderRow) throw new Error("order_not_found");
    const order = orderRow as unknown as OrderRow;

    const route = routeDispute({
      orderStatus: order.status,
      actorIsParty: order.buyer_user_id === userId || order.seller_user_id === userId,
      category: data.category,
      summary: data.summary,
      flagEnabled: await flagEnabled(supabase, "marketplace.dispute_workflow"),
    });
    if (!route.ok) {
      await writeAuditRow(supabase, {
        actor_user_id: userId,
        action: "market.dispute.raise",
        subject_type: "marketplace_order",
        subject_id: data.orderId,
        decision: "deny",
        metadata: { errors: route.errors },
      });
      throw new Error(route.errors.join(" "));
    }

    const { data: row, error } = await supabase
      .from("marketplace_disputes")
      .insert({
        order_id: data.orderId,
        raised_by: userId,
        category: data.category.trim(),
        summary: data.summary.trim(),
        status: route.status,
      } as never)
      .select("id")
      .single();
    if (error || !row) throw new Error("dispute_create_failed");

    await supabase
      .from("marketplace_orders")
      .update({ status: "disputed", status_note: "dispute raised" } as never)
      .eq("id", data.orderId);

    await writeAuditRow(supabase, {
      actor_user_id: userId,
      action: "market.dispute.raise",
      subject_type: "marketplace_dispute",
      subject_id: row.id,
      decision: "allow",
      metadata: { order_id: data.orderId, routed_to: "human_review", category: data.category },
    });
    return { id: row.id as string, status: route.status };
  });

export const decideDispute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { disputeId: string; next: "resolved" | "rejected"; resolutionNote: string }) => input,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { resolveMarketActor, canReviewMarketplace } = await import("@/lib/atap/marketplace.server");
    const { writeAuditRow } = await import("@/lib/atap/onboarding.server");

    const { data: disputeRow } = await supabase
      .from("marketplace_disputes")
      .select("*")
      .eq("id", data.disputeId)
      .maybeSingle();
    if (!disputeRow) throw new Error("dispute_not_found");
    const dispute = disputeRow as unknown as DisputeRow;

    const actor = await resolveMarketActor(supabase, userId);
    const plan = planDisputeDecision({
      current: dispute.status,
      next: data.next,
      actorIsAuthorizedReviewer: canReviewMarketplace(actor),
      resolutionNote: data.resolutionNote ?? "",
    });
    if (!plan.ok) {
      await writeAuditRow(supabase, {
        actor_user_id: userId,
        action: "market.dispute.decide",
        subject_type: "marketplace_dispute",
        subject_id: data.disputeId,
        decision: "deny",
        metadata: { reason: plan.error },
      });
      throw new Error(plan.error);
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("marketplace_disputes")
      .update({
        status: plan.status,
        resolution_note: data.resolutionNote.trim(),
        decided_by: userId,
        decided_at: new Date().toISOString(),
      } as never)
      .eq("id", data.disputeId);
    await supabaseAdmin
      .from("marketplace_orders")
      .update({ status: "closed", status_note: `dispute ${plan.status}` } as never)
      .eq("id", dispute.order_id);

    await writeAuditRow(supabase, {
      actor_user_id: userId,
      action: "market.dispute.decide",
      subject_type: "marketplace_dispute",
      subject_id: data.disputeId,
      decision: "allow",
      metadata: { outcome: plan.status, note: data.resolutionNote.trim(), human_decision: true },
    });
    return { status: plan.status };
  });

/** Exposed for the workspace UI so plan labels stay consistent with the rules. */
export const describePlan = (plan: string) => entitlementFor(plan);
