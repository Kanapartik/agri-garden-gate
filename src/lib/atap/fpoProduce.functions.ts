/**
 * FPO Management & Operations workspace — Phase 6 server functions.
 *
 * Produce and market-linkage reads are tenant-scoped and default-deny. Member
 * harvest declarations may be recorded by field agents; creating lots, listing
 * to the marketplace and responding to buyer enquiries require FPO admin
 * authority. Accepting an offer is always a recorded human decision, and price
 * rows keep their OBSERVED / FORECAST / DERIVED SCENARIO basis. Every write is
 * audited.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
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
  priceSnapshots,
  PRODUCE_DISCLAIMER,
  type CommodityWindow,
  type ComparedEnquiry,
  type EnquiryStatus,
  type LogisticsKind,
  type LotAggregation,
  type PriceBasis,
  type PriceSnapshot,
  type ProduceLotStatus,
} from "@/lib/atap/fpoProduce";
import type { AppRole } from "@/lib/atap/policy";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type AuthedClient = SupabaseClient<Database>;

export interface ProduceLotRow {
  id: string;
  lot_code: string | null;
  commodity: string;
  variety: string | null;
  grade: string | null;
  season: string | null;
  harvest_window_start: string | null;
  harvest_window_end: string | null;
  expected_quantity: number;
  aggregated_quantity: number;
  unit: string;
  reserve_price_per_unit: number | null;
  storage_location: string | null;
  status: ProduceLotStatus;
  marketplace_listing_id: string | null;
  marketplace_rfq_id: string | null;
  note: string | null;
  updated_at: string;
}

export interface LogisticsRow {
  id: string;
  kind: LogisticsKind;
  provider_name: string;
  location: string | null;
  capacity: number | null;
  capacity_unit: string | null;
  rate: number | null;
  rate_basis: string | null;
  contact: string | null;
  is_active: boolean;
}

export interface ProduceBoard {
  tenantId: string;
  roles: AppRole[];
  canManage: boolean;
  canRecordContribution: boolean;
  lots: ProduceLotRow[];
  counts: Record<ProduceLotStatus, number>;
  windows: CommodityWindow[];
  prices: PriceSnapshot[];
  logistics: LogisticsRow[];
  openEnquiries: number;
  disclaimer: string;
}

export interface ContributionRow {
  id: string;
  member_id: string | null;
  member_name: string;
  expected_quantity: number;
  confirmed_quantity: number;
  delivered_quantity: number;
  unit: string;
  grade: string | null;
  note: string | null;
}

export interface LotDetail {
  lot: ProduceLotRow;
  canManage: boolean;
  canRecordContribution: boolean;
  canAcceptOffer: boolean;
  contributions: ContributionRow[];
  aggregation: LotAggregation;
  enquiries: ComparedEnquiry[];
  prices: PriceSnapshot[];
  readiness: ReturnType<typeof listingReadiness>;
  members: Array<{ id: string; display_name: string }>;
  disclaimer: string;
}

const LOT_COLUMNS =
  "id, lot_code, commodity, variety, grade, season, harvest_window_start, harvest_window_end, expected_quantity, aggregated_quantity, unit, reserve_price_per_unit, storage_location, status, marketplace_listing_id, marketplace_rfq_id, note, updated_at";

/* -------------------------------------------------------------- internals */

async function tenantScope(supabase: AuthedClient, userId: string, tenantId: string) {
  const { resolveDistrictActor } = await import("@/lib/atap/district.server");
  const actor = await resolveDistrictActor(supabase, userId);
  const permitted = actor.isPlatformAdmin || actor.isAuditor || actor.tenantIds.includes(tenantId);
  if (!permitted) throw new Error("You do not have access to this organization");
  const roles = actor.tenantRoles
    .filter((r: { tenant_id: string | null }) => r.tenant_id === tenantId)
    .map((r: { role: AppRole }) => r.role) as AppRole[];
  const effective: AppRole[] = actor.isPlatformAdmin ? [...roles, "platform_admin"] : roles;
  return { actor, roles: effective };
}

async function logAudit(
  supabase: AuthedClient,
  input: {
    userId: string;
    tenantId: string;
    action: string;
    subjectType: string;
    subjectId: string;
    metadata?: Record<string, unknown>;
  },
) {
  const { audit } = await import("@/lib/atap/admin.server");
  await audit(supabase, {
    actor_user_id: input.userId,
    tenant_id: input.tenantId,
    action: input.action,
    subject_type: input.subjectType,
    subject_id: input.subjectId,
    decision: "allow",
    metadata: input.metadata ?? {},
  });
}

function num(v: unknown): number {
  return v === null || v === undefined ? 0 : Number(v);
}

async function loadLot(supabase: AuthedClient, tenantId: string, lotId: string) {
  const { data } = await supabase
    .from("fpo_produce_lots")
    .select(LOT_COLUMNS)
    .eq("tenant_id", tenantId)
    .eq("id", lotId)
    .maybeSingle();
  if (!data) throw new Error("Produce lot not found");
  return data as unknown as ProduceLotRow;
}

/** Recomputes the stored aggregate from confirmed member declarations. */
async function refreshAggregate(supabase: AuthedClient, tenantId: string, lotId: string) {
  const { data } = await supabase
    .from("fpo_produce_contributions")
    .select("expected_quantity, confirmed_quantity, delivered_quantity, unit")
    .eq("lot_id", lotId);
  const rows = ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    expected_quantity: num(r["expected_quantity"]),
    confirmed_quantity: num(r["confirmed_quantity"]),
    delivered_quantity: num(r["delivered_quantity"]),
    unit: r["unit"] as string,
  }));
  const agg = aggregateContributions(rows);
  await supabase
    .from("fpo_produce_lots")
    .update({ aggregated_quantity: agg.confirmed })
    .eq("tenant_id", tenantId)
    .eq("id", lotId);
  return agg;
}

/* -------------------------------------------------------------- board API */

export const getProduceBoard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string }) => input)
  .handler(async ({ data, context }): Promise<ProduceBoard> => {
    const { supabase, userId } = context;
    const { roles } = await tenantScope(supabase, userId, data.tenantId);

    const [lotRes, priceRes, logisticsRes, enquiryRes] = await Promise.all([
      supabase
        .from("fpo_produce_lots")
        .select(LOT_COLUMNS)
        .eq("tenant_id", data.tenantId)
        .order("updated_at", { ascending: false }),
      supabase
        .from("fpo_market_price_observations")
        .select("commodity, market_name, price_per_unit, unit, basis, observed_on, source")
        .eq("tenant_id", data.tenantId)
        .order("observed_on", { ascending: false })
        .limit(200),
      supabase
        .from("fpo_logistics_options")
        .select(
          "id, kind, provider_name, location, capacity, capacity_unit, rate, rate_basis, contact, is_active",
        )
        .eq("tenant_id", data.tenantId)
        .order("kind"),
      supabase
        .from("fpo_buyer_enquiries")
        .select("id, status")
        .eq("tenant_id", data.tenantId)
        .in("status", ["received", "under_review", "negotiating"]),
    ]);

    const lots = ((lotRes.data ?? []) as unknown as ProduceLotRow[]).map((r) => ({
      ...r,
      expected_quantity: num(r.expected_quantity),
      aggregated_quantity: num(r.aggregated_quantity),
      reserve_price_per_unit:
        r.reserve_price_per_unit === null ? null : num(r.reserve_price_per_unit),
    }));

    return {
      tenantId: data.tenantId,
      roles,
      canManage: canManageProduce(roles),
      canRecordContribution: canRecordContribution(roles),
      lots,
      counts: lotCounts(lots),
      windows: commodityWindows(lots),
      prices: priceSnapshots(
        ((priceRes.data ?? []) as Array<Record<string, unknown>>).map((r) => ({
          commodity: r["commodity"] as string,
          market_name: r["market_name"] as string,
          price_per_unit: num(r["price_per_unit"]),
          unit: r["unit"] as string,
          basis: r["basis"] as PriceBasis,
          observed_on: r["observed_on"] as string,
          source: (r["source"] as string | null) ?? null,
        })),
      ),
      logistics: ((logisticsRes.data ?? []) as unknown as LogisticsRow[]).map((r) => ({
        ...r,
        capacity: r.capacity === null ? null : num(r.capacity),
        rate: r.rate === null ? null : num(r.rate),
      })),
      openEnquiries: (enquiryRes.data ?? []).length,
      disclaimer: PRODUCE_DISCLAIMER,
    };
  });

export const getProduceLotDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string; lotId: string }) => input)
  .handler(async ({ data, context }): Promise<LotDetail> => {
    const { supabase, userId } = context;
    const { roles } = await tenantScope(supabase, userId, data.tenantId);
    const lot = await loadLot(supabase, data.tenantId, data.lotId);

    const [contribRes, enquiryRes, priceRes, memberRes] = await Promise.all([
      supabase
        .from("fpo_produce_contributions")
        .select("*, fpo_members(display_name)")
        .eq("lot_id", data.lotId)
        .order("created_at"),
      supabase
        .from("fpo_buyer_enquiries")
        .select("*")
        .eq("tenant_id", data.tenantId)
        .eq("lot_id", data.lotId)
        .order("created_at", { ascending: false }),
      supabase
        .from("fpo_market_price_observations")
        .select("commodity, market_name, price_per_unit, unit, basis, observed_on, source")
        .eq("tenant_id", data.tenantId)
        .eq("commodity", lot.commodity)
        .order("observed_on", { ascending: false })
        .limit(60),
      supabase
        .from("fpo_members")
        .select("id, display_name")
        .eq("tenant_id", data.tenantId)
        .eq("status", "active")
        .order("display_name")
        .limit(300),
    ]);

    const contributions: ContributionRow[] = (
      (contribRes.data ?? []) as Array<
        Record<string, unknown> & { fpo_members: { display_name: string } | null }
      >
    ).map((r) => ({
      id: r["id"] as string,
      member_id: (r["member_id"] as string | null) ?? null,
      member_name: r.fpo_members?.display_name ?? "Unlinked member",
      expected_quantity: num(r["expected_quantity"]),
      confirmed_quantity: num(r["confirmed_quantity"]),
      delivered_quantity: num(r["delivered_quantity"]),
      unit: r["unit"] as string,
      grade: (r["grade"] as string | null) ?? null,
      note: (r["note"] as string | null) ?? null,
    }));

    const aggregation = aggregateContributions(contributions, lot.unit);

    const enquiries = compareEnquiries(
      ((enquiryRes.data ?? []) as Array<Record<string, unknown>>).map((r) => ({
        id: r["id"] as string,
        buyer_name: r["buyer_name"] as string,
        buyer_type: r["buyer_type"] as string,
        offered_price_per_unit:
          r["offered_price_per_unit"] === null ? null : num(r["offered_price_per_unit"]),
        quantity: r["quantity"] === null ? null : num(r["quantity"]),
        unit: r["unit"] as string,
        payment_terms: (r["payment_terms"] as string | null) ?? null,
        delivery_terms: (r["delivery_terms"] as string | null) ?? null,
        status: r["status"] as EnquiryStatus,
      })),
      {
        reservePricePerUnit: lot.reserve_price_per_unit,
        availableQuantity: num(lot.aggregated_quantity),
      },
    );

    return {
      lot,
      canManage: canManageProduce(roles),
      canRecordContribution: canRecordContribution(roles),
      canAcceptOffer: canAcceptOffer(roles),
      contributions,
      aggregation,
      enquiries,
      prices: priceSnapshots(
        ((priceRes.data ?? []) as Array<Record<string, unknown>>).map((r) => ({
          commodity: r["commodity"] as string,
          market_name: r["market_name"] as string,
          price_per_unit: num(r["price_per_unit"]),
          unit: r["unit"] as string,
          basis: r["basis"] as PriceBasis,
          observed_on: r["observed_on"] as string,
          source: (r["source"] as string | null) ?? null,
        })),
      ),
      readiness: listingReadiness({
        status: lot.status,
        aggregated_quantity: num(lot.aggregated_quantity),
        reserve_price_per_unit: lot.reserve_price_per_unit,
      }),
      members: ((memberRes.data ?? []) as Array<{ id: string; display_name: string }>).map((m) => ({
        id: m.id,
        display_name: m.display_name,
      })),
      disclaimer: PRODUCE_DISCLAIMER,
    };
  });

/* -------------------------------------------------------------- write API */

export const createProduceLot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      tenantId: string;
      commodity: string;
      variety?: string | null;
      season?: string | null;
      unit?: string;
      expectedQuantity?: number | null;
      reservePrice?: number | null;
      harvestStart?: string | null;
      harvestEnd?: string | null;
      storageLocation?: string | null;
    }) => input,
  )
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const { supabase, userId } = context;
    const { roles } = await tenantScope(supabase, userId, data.tenantId);
    if (!canManageProduce(roles))
      throw new Error("Only FPO administrators can create produce lots");
    const commodity = data.commodity.trim();
    if (!commodity) throw new Error("Commodity is required");

    const { data: row, error } = await supabase
      .from("fpo_produce_lots")
      .insert({
        tenant_id: data.tenantId,
        commodity,
        variety: data.variety?.trim() || null,
        season: data.season?.trim() || null,
        unit: data.unit?.trim() || "quintal",
        expected_quantity: data.expectedQuantity ?? 0,
        reserve_price_per_unit: data.reservePrice ?? null,
        harvest_window_start: data.harvestStart || null,
        harvest_window_end: data.harvestEnd || null,
        storage_location: data.storageLocation?.trim() || null,
        status: "planned",
        created_by_user_id: userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await logAudit(supabase, {
      userId,
      tenantId: data.tenantId,
      action: "fpo.produce.lot_created",
      subjectType: "fpo_produce_lot",
      subjectId: row.id,
      metadata: { commodity, season: data.season ?? null },
    });
    return { id: row.id };
  });

export const setProduceLotStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string; lotId: string; status: ProduceLotStatus }) => input)
  .handler(async ({ data, context }): Promise<{ status: ProduceLotStatus }> => {
    const { supabase, userId } = context;
    const { roles } = await tenantScope(supabase, userId, data.tenantId);
    if (!canManageProduce(roles)) throw new Error("Only FPO administrators can move a produce lot");

    const lot = await loadLot(supabase, data.tenantId, data.lotId);
    if (!canTransitionLot(lot.status, data.status)) {
      throw new Error(`A lot cannot move from ${lot.status} to ${data.status}`);
    }
    if (data.status === "listed") {
      const readiness = listingReadiness({
        status: lot.status,
        aggregated_quantity: num(lot.aggregated_quantity),
        reserve_price_per_unit: lot.reserve_price_per_unit,
      });
      if (!readiness.ready) throw new Error(readiness.reasons.join(" "));
    }

    const { error } = await supabase
      .from("fpo_produce_lots")
      .update({ status: data.status })
      .eq("tenant_id", data.tenantId)
      .eq("id", data.lotId);
    if (error) throw new Error(error.message);

    await logAudit(supabase, {
      userId,
      tenantId: data.tenantId,
      action: "fpo.produce.lot_status_changed",
      subjectType: "fpo_produce_lot",
      subjectId: data.lotId,
      metadata: { from: lot.status, to: data.status },
    });
    return { status: data.status };
  });

export const recordProduceContribution = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      tenantId: string;
      lotId: string;
      memberId?: string | null;
      expectedQuantity: number;
      unit?: string;
      grade?: string | null;
      note?: string | null;
    }) => input,
  )
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const { supabase, userId } = context;
    const { roles } = await tenantScope(supabase, userId, data.tenantId);
    if (!canRecordContribution(roles)) {
      throw new Error("You are not permitted to record member produce declarations");
    }
    if (!(data.expectedQuantity > 0))
      throw new Error("Expected quantity must be greater than zero");

    const lot = await loadLot(supabase, data.tenantId, data.lotId);
    const { data: row, error } = await supabase
      .from("fpo_produce_contributions")
      .insert({
        tenant_id: data.tenantId,
        lot_id: data.lotId,
        member_id: data.memberId || null,
        expected_quantity: data.expectedQuantity,
        confirmed_quantity: 0,
        delivered_quantity: 0,
        unit: data.unit?.trim() || lot.unit,
        grade: data.grade?.trim() || null,
        note: data.note?.trim() || null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await logAudit(supabase, {
      userId,
      tenantId: data.tenantId,
      action: "fpo.produce.contribution_recorded",
      subjectType: "fpo_produce_contribution",
      subjectId: row.id,
      metadata: { lot_id: data.lotId, expected_quantity: data.expectedQuantity },
    });
    return { id: row.id };
  });

export const updateProduceContribution = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      tenantId: string;
      lotId: string;
      contributionId: string;
      confirmedQuantity?: number | null;
      deliveredQuantity?: number | null;
    }) => input,
  )
  .handler(async ({ data, context }): Promise<LotAggregation> => {
    const { supabase, userId } = context;
    const { roles } = await tenantScope(supabase, userId, data.tenantId);
    if (!canRecordContribution(roles)) {
      throw new Error("You are not permitted to update member produce declarations");
    }

    const patch: { confirmed_quantity?: number; delivered_quantity?: number } = {};
    if (data.confirmedQuantity != null) patch["confirmed_quantity"] = data.confirmedQuantity;
    if (data.deliveredQuantity != null) patch["delivered_quantity"] = data.deliveredQuantity;
    if (Object.keys(patch).length === 0) throw new Error("Nothing to update");

    const { error } = await supabase
      .from("fpo_produce_contributions")
      .update(patch)
      .eq("tenant_id", data.tenantId)
      .eq("id", data.contributionId)
      .eq("lot_id", data.lotId);
    if (error) throw new Error(error.message);

    const aggregation = await refreshAggregate(supabase, data.tenantId, data.lotId);
    await logAudit(supabase, {
      userId,
      tenantId: data.tenantId,
      action: "fpo.produce.contribution_updated",
      subjectType: "fpo_produce_contribution",
      subjectId: data.contributionId,
      metadata: { ...patch, aggregated_quantity: aggregation.confirmed },
    });
    return aggregation;
  });

export const recordBuyerEnquiry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      tenantId: string;
      lotId: string;
      buyerName: string;
      buyerType: string;
      offeredPrice?: number | null;
      quantity?: number | null;
      unit?: string;
      paymentTerms?: string | null;
      deliveryTerms?: string | null;
      note?: string | null;
    }) => input,
  )
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const { supabase, userId } = context;
    const { roles } = await tenantScope(supabase, userId, data.tenantId);
    if (!canManageProduce(roles)) {
      throw new Error("Only FPO administrators can record buyer enquiries");
    }
    const buyerName = data.buyerName.trim();
    if (!buyerName) throw new Error("Buyer name is required");
    const lot = await loadLot(supabase, data.tenantId, data.lotId);

    const { data: row, error } = await supabase
      .from("fpo_buyer_enquiries")
      .insert({
        tenant_id: data.tenantId,
        lot_id: data.lotId,
        buyer_name: buyerName,
        buyer_type: data.buyerType,
        offered_price_per_unit: data.offeredPrice ?? null,
        quantity: data.quantity ?? null,
        unit: data.unit?.trim() || lot.unit,
        payment_terms: data.paymentTerms?.trim() || null,
        delivery_terms: data.deliveryTerms?.trim() || null,
        note: data.note?.trim() || null,
        status: "received",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await logAudit(supabase, {
      userId,
      tenantId: data.tenantId,
      action: "fpo.produce.enquiry_recorded",
      subjectType: "fpo_buyer_enquiry",
      subjectId: row.id,
      metadata: { lot_id: data.lotId, buyer_name: buyerName },
    });
    return { id: row.id };
  });

export const setEnquiryStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string; enquiryId: string; status: EnquiryStatus }) => input)
  .handler(async ({ data, context }): Promise<{ status: EnquiryStatus }> => {
    const { supabase, userId } = context;
    const { roles } = await tenantScope(supabase, userId, data.tenantId);

    const { data: current } = await supabase
      .from("fpo_buyer_enquiries")
      .select("id, status, buyer_name, lot_id")
      .eq("tenant_id", data.tenantId)
      .eq("id", data.enquiryId)
      .maybeSingle();
    if (!current) throw new Error("Buyer enquiry not found");

    const from = current.status as EnquiryStatus;
    if (!canTransitionEnquiry(from, data.status)) {
      throw new Error(`A buyer enquiry cannot move from ${from} to ${data.status}`);
    }
    // Accepting an offer is a commercial commitment for members: admin only.
    if (data.status === "accepted" ? !canAcceptOffer(roles) : !canManageProduce(roles)) {
      throw new Error("Only an authorized FPO office bearer can respond to buyer offers");
    }

    const { error } = await supabase
      .from("fpo_buyer_enquiries")
      .update({
        status: data.status,
        responded_at: new Date().toISOString(),
        responded_by_user_id: userId,
      })
      .eq("tenant_id", data.tenantId)
      .eq("id", data.enquiryId);
    if (error) throw new Error(error.message);

    await logAudit(supabase, {
      userId,
      tenantId: data.tenantId,
      action:
        data.status === "accepted"
          ? "fpo.produce.enquiry_accepted"
          : "fpo.produce.enquiry_status_changed",
      subjectType: "fpo_buyer_enquiry",
      subjectId: data.enquiryId,
      metadata: { from, to: data.status, buyer_name: current.buyer_name },
    });
    return { status: data.status };
  });
