/**
 * FPO Management & Operations workspace — Phase 5 server functions.
 *
 * Procurement board reads are tenant-scoped and default-deny. Demand capture is
 * open to field agents; aggregation, RFQs, supplier selection, ordering,
 * distribution and payment recording require FPO admin authority. Ordering is
 * blocked until every member whose input is purchased has authorized it. Every
 * write is audited.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
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
  settlementSummary,
  PROCUREMENT_DISCLAIMER,
  type AggregatedDemand,
  type ComparedQuote,
  type InputCategory,
  type ProcurementStatus,
  type SettlementSummary,
} from "@/lib/atap/fpoProcurement";
import type { AppRole } from "@/lib/atap/policy";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type AuthedClient = SupabaseClient<Database>;

export interface CampaignRow {
  id: string;
  name: string;
  input_category: InputCategory;
  season: string | null;
  status: ProcurementStatus;
  demand_window_start: string | null;
  demand_window_end: string | null;
  required_by: string | null;
  note: string | null;
  updated_at: string;
}

export interface ProcurementBoard {
  tenantId: string;
  roles: AppRole[];
  canManage: boolean;
  canRecordDemand: boolean;
  campaigns: CampaignRow[];
  counts: Record<ProcurementStatus, number>;
  disclaimer: string;
}

export interface DemandRow {
  id: string;
  member_id: string | null;
  member_name: string;
  product_name: string;
  generic_name: string | null;
  quantity: number;
  unit: string;
  indicative_price_per_unit: number | null;
  member_authorized: boolean;
  note: string | null;
}

export interface RfqRow {
  id: string;
  product_name: string;
  aggregated_quantity: number;
  unit: string;
  delivery_by: string | null;
  specification: string | null;
  is_open: boolean;
  quotes: ComparedQuote[];
  selected_quote_id: string | null;
}

export interface DistributionRow {
  id: string;
  member_id: string | null;
  member_name: string;
  product_name: string;
  quantity: number;
  unit: string;
  amount_due: number;
  amount_collected: number;
  payment_state: string;
  distributed_at: string | null;
}

export interface CampaignDetail {
  campaign: CampaignRow;
  canManage: boolean;
  canRecordDemand: boolean;
  demand: DemandRow[];
  aggregated: AggregatedDemand[];
  authorization: ReturnType<typeof authorizationGate>;
  rfqs: RfqRow[];
  distributions: DistributionRow[];
  settlement: SettlementSummary;
  members: Array<{ id: string; display_name: string }>;
  disclaimer: string;
}

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

/* -------------------------------------------------------------- board API */

export const getProcurementBoard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string }) => input)
  .handler(async ({ data, context }): Promise<ProcurementBoard> => {
    const { supabase, userId } = context;
    const { roles } = await tenantScope(supabase, userId, data.tenantId);

    const { data: rows } = await supabase
      .from("fpo_procurement_campaigns")
      .select(
        "id, name, input_category, season, status, demand_window_start, demand_window_end, required_by, note, updated_at",
      )
      .eq("tenant_id", data.tenantId)
      .order("updated_at", { ascending: false });

    const campaigns = ((rows ?? []) as unknown as CampaignRow[]).map((r) => ({ ...r }));
    return {
      tenantId: data.tenantId,
      roles,
      canManage: canManageProcurement(roles),
      canRecordDemand: canRecordDemand(roles),
      campaigns,
      counts: campaignCounts(campaigns),
      disclaimer: PROCUREMENT_DISCLAIMER,
    };
  });

export const getCampaignDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string; campaignId: string }) => input)
  .handler(async ({ data, context }): Promise<CampaignDetail> => {
    const { supabase, userId } = context;
    const { roles } = await tenantScope(supabase, userId, data.tenantId);

    const [campaignRes, demandRes, rfqRes, distRes, memberRes] = await Promise.all([
      supabase
        .from("fpo_procurement_campaigns")
        .select(
          "id, name, input_category, season, status, demand_window_start, demand_window_end, required_by, note, updated_at",
        )
        .eq("tenant_id", data.tenantId)
        .eq("id", data.campaignId)
        .maybeSingle(),
      supabase
        .from("fpo_procurement_demand")
        .select("*, fpo_members(display_name)")
        .eq("campaign_id", data.campaignId)
        .order("created_at"),
      supabase
        .from("fpo_procurement_rfqs")
        .select("*")
        .eq("campaign_id", data.campaignId)
        .order("created_at"),
      supabase
        .from("fpo_procurement_distributions")
        .select("*, fpo_members(display_name)")
        .eq("campaign_id", data.campaignId)
        .order("created_at"),
      supabase
        .from("fpo_members")
        .select("id, display_name")
        .eq("tenant_id", data.tenantId)
        .eq("status", "active")
        .order("display_name")
        .limit(300),
    ]);

    if (!campaignRes.data) throw new Error("Procurement campaign not found");
    const campaign = campaignRes.data as unknown as CampaignRow;

    const demand: DemandRow[] = (
      (demandRes.data ?? []) as Array<
        Record<string, unknown> & { fpo_members: { display_name: string } | null }
      >
    ).map((r) => ({
      id: r["id"] as string,
      member_id: (r["member_id"] as string | null) ?? null,
      member_name: r.fpo_members?.display_name ?? "Unlinked member",
      product_name: r["product_name"] as string,
      generic_name: (r["generic_name"] as string | null) ?? null,
      quantity: num(r["quantity"]),
      unit: r["unit"] as string,
      indicative_price_per_unit:
        r["indicative_price_per_unit"] === null ? null : num(r["indicative_price_per_unit"]),
      member_authorized: Boolean(r["member_authorized"]),
      note: (r["note"] as string | null) ?? null,
    }));

    const rfqIds = ((rfqRes.data ?? []) as Array<{ id: string }>).map((r) => r.id);
    const { data: quoteRows } = rfqIds.length
      ? await supabase.from("fpo_supplier_quotes").select("*").in("rfq_id", rfqIds)
      : { data: [] };

    const rfqs: RfqRow[] = ((rfqRes.data ?? []) as Array<Record<string, unknown>>).map((r) => {
      const quantity = num(r["aggregated_quantity"]);
      const mine = ((quoteRows ?? []) as Array<Record<string, unknown>>).filter(
        (q) => q["rfq_id"] === r["id"],
      );
      const compared = compareQuotes(
        mine.map((q) => ({
          id: q["id"] as string,
          supplier_name: q["supplier_name"] as string,
          certification_label: (q["certification_label"] as string | null) ?? null,
          unit_price: num(q["unit_price"]),
          transport_cost: num(q["transport_cost"]),
          min_order_quantity:
            q["min_order_quantity"] === null ? null : num(q["min_order_quantity"]),
          available_quantity:
            q["available_quantity"] === null ? null : num(q["available_quantity"]),
          availability_date: (q["availability_date"] as string | null) ?? null,
          delivery_days: q["delivery_days"] === null ? null : Number(q["delivery_days"]),
          supplier_rating: q["supplier_rating"] === null ? null : num(q["supplier_rating"]),
        })),
        quantity,
      );
      const selected = mine.find((q) => Boolean(q["is_selected"]));
      return {
        id: r["id"] as string,
        product_name: r["product_name"] as string,
        aggregated_quantity: quantity,
        unit: r["unit"] as string,
        delivery_by: (r["delivery_by"] as string | null) ?? null,
        specification: (r["specification"] as string | null) ?? null,
        is_open: Boolean(r["is_open"]),
        quotes: compared,
        selected_quote_id: (selected?.["id"] as string | undefined) ?? null,
      };
    });

    const distributions: DistributionRow[] = (
      (distRes.data ?? []) as Array<
        Record<string, unknown> & { fpo_members: { display_name: string } | null }
      >
    ).map((r) => ({
      id: r["id"] as string,
      member_id: (r["member_id"] as string | null) ?? null,
      member_name: r.fpo_members?.display_name ?? "Unlinked member",
      product_name: r["product_name"] as string,
      quantity: num(r["quantity"]),
      unit: r["unit"] as string,
      amount_due: num(r["amount_due"]),
      amount_collected: num(r["amount_collected"]),
      payment_state: r["payment_state"] as string,
      distributed_at: (r["distributed_at"] as string | null) ?? null,
    }));

    return {
      campaign,
      canManage: canManageProcurement(roles),
      canRecordDemand: canRecordDemand(roles),
      demand,
      aggregated: aggregateDemand(demand),
      authorization: authorizationGate(demand),
      rfqs,
      distributions,
      settlement: settlementSummary(
        distributions.map((d) => ({
          quantity: d.quantity,
          amount_due: d.amount_due,
          amount_collected: d.amount_collected,
          payment_state: d.payment_state as "pending" | "partial" | "paid" | "waived",
          distributed_at: d.distributed_at,
        })),
      ),
      members: ((memberRes.data ?? []) as Array<{ id: string; display_name: string }>).map((m) => ({
        id: m.id,
        display_name: m.display_name,
      })),
      disclaimer: PROCUREMENT_DISCLAIMER,
    };
  });

/* -------------------------------------------------------------- write API */

export const createProcurementCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      tenantId: string;
      name: string;
      inputCategory: InputCategory;
      season?: string | null;
      requiredBy?: string | null;
      note?: string | null;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { roles } = await tenantScope(supabase, userId, data.tenantId);
    if (!canManageProcurement(roles)) throw new Error("Only FPO administrators can open a procurement campaign");
    if (!data.name.trim()) throw new Error("Campaign name is required");

    const { data: row, error } = await supabase
      .from("fpo_procurement_campaigns")
      .insert({
        tenant_id: data.tenantId,
        name: data.name.trim(),
        input_category: data.inputCategory,
        season: data.season ?? null,
        required_by: data.requiredBy ?? null,
        note: data.note ?? null,
        status: "draft",
        created_by_user_id: userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await logAudit(supabase, {
      userId,
      tenantId: data.tenantId,
      action: "fpo.procurement.campaign.create",
      subjectType: "fpo_procurement_campaigns",
      subjectId: row.id,
      metadata: { name: data.name, category: data.inputCategory },
    });
    return { id: row.id as string };
  });

export const setCampaignStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string; campaignId: string; status: ProcurementStatus }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { roles } = await tenantScope(supabase, userId, data.tenantId);
    if (!canManageProcurement(roles)) throw new Error("Only FPO administrators can move a procurement campaign");

    const { data: existing } = await supabase
      .from("fpo_procurement_campaigns")
      .select("status")
      .eq("id", data.campaignId)
      .eq("tenant_id", data.tenantId)
      .maybeSingle();
    if (!existing) throw new Error("Procurement campaign not found");
    const from = existing.status as ProcurementStatus;
    if (!canTransitionCampaign(from, data.status)) {
      throw new Error(`Cannot move this campaign from ${from} to ${data.status}`);
    }

    // Purchasing on a member's behalf requires that member's recorded authorization.
    if (data.status === "ordered") {
      const { data: lines } = await supabase
        .from("fpo_procurement_demand")
        .select("member_authorized")
        .eq("campaign_id", data.campaignId);
      const gate = authorizationGate(
        ((lines ?? []) as Array<{ member_authorized: boolean }>).map((l) => ({
          product_name: "",
          quantity: 1,
          unit: "kg",
          member_authorized: l.member_authorized,
        })),
      );
      if (!gate.ready) throw new Error(gate.reason ?? "Member authorization is incomplete");

      const { data: selected } = await supabase
        .from("fpo_supplier_quotes")
        .select("id")
        .eq("tenant_id", data.tenantId)
        .eq("is_selected", true)
        .limit(1);
      if (!selected?.length) throw new Error("Select a supplier quote before placing the order");
    }

    const { error } = await supabase
      .from("fpo_procurement_campaigns")
      .update({ status: data.status })
      .eq("id", data.campaignId);
    if (error) throw new Error(error.message);

    await logAudit(supabase, {
      userId,
      tenantId: data.tenantId,
      action: "fpo.procurement.campaign.status",
      subjectType: "fpo_procurement_campaigns",
      subjectId: data.campaignId,
      metadata: { from, to: data.status },
    });
    return { ok: true };
  });

export const recordMemberDemand = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      tenantId: string;
      campaignId: string;
      memberId: string | null;
      productName: string;
      genericName?: string | null;
      quantity: number;
      unit: string;
      indicativePrice?: number | null;
      memberAuthorized: boolean;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { roles } = await tenantScope(supabase, userId, data.tenantId);
    if (!canRecordDemand(roles)) throw new Error("You are not permitted to record member demand");
    if (!data.productName.trim()) throw new Error("Product name is required");
    if (!(data.quantity > 0)) throw new Error("Quantity must be greater than zero");

    const { data: row, error } = await supabase
      .from("fpo_procurement_demand")
      .insert({
        campaign_id: data.campaignId,
        tenant_id: data.tenantId,
        member_id: data.memberId,
        product_name: data.productName.trim(),
        generic_name: data.genericName ?? null,
        quantity: data.quantity,
        unit: data.unit || "kg",
        indicative_price_per_unit: data.indicativePrice ?? null,
        member_authorized: data.memberAuthorized,
        authorization_recorded_at: data.memberAuthorized ? new Date().toISOString() : null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await logAudit(supabase, {
      userId,
      tenantId: data.tenantId,
      action: "fpo.procurement.demand.record",
      subjectType: "fpo_procurement_demand",
      subjectId: row.id,
      metadata: { campaignId: data.campaignId, authorized: data.memberAuthorized },
    });
    return { id: row.id as string };
  });

export const setDemandAuthorization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string; demandId: string; authorized: boolean }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { roles } = await tenantScope(supabase, userId, data.tenantId);
    if (!canRecordDemand(roles)) throw new Error("You are not permitted to record member authorization");

    const { error } = await supabase
      .from("fpo_procurement_demand")
      .update({
        member_authorized: data.authorized,
        authorization_recorded_at: data.authorized ? new Date().toISOString() : null,
      })
      .eq("id", data.demandId)
      .eq("tenant_id", data.tenantId);
    if (error) throw new Error(error.message);

    await logAudit(supabase, {
      userId,
      tenantId: data.tenantId,
      action: "fpo.procurement.demand.authorization",
      subjectType: "fpo_procurement_demand",
      subjectId: data.demandId,
      metadata: { authorized: data.authorized },
    });
    return { ok: true };
  });

export const raiseRfqFromDemand = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      tenantId: string;
      campaignId: string;
      productName: string;
      unit: string;
      deliveryBy?: string | null;
      specification?: string | null;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { roles } = await tenantScope(supabase, userId, data.tenantId);
    if (!canManageProcurement(roles)) throw new Error("Only FPO administrators can raise an RFQ");

    const { data: lines } = await supabase
      .from("fpo_procurement_demand")
      .select("product_name, quantity, unit")
      .eq("campaign_id", data.campaignId);
    const agg = aggregateDemand(
      ((lines ?? []) as Array<{ product_name: string; quantity: number; unit: string }>).map((l) => ({
        product_name: l.product_name,
        quantity: Number(l.quantity),
        unit: l.unit,
      })),
    ).find((a) => a.product_name === data.productName && a.unit === data.unit);
    if (!agg) throw new Error("No aggregated demand found for this product");

    const { data: row, error } = await supabase
      .from("fpo_procurement_rfqs")
      .insert({
        campaign_id: data.campaignId,
        tenant_id: data.tenantId,
        product_name: data.productName,
        aggregated_quantity: agg.total_quantity,
        unit: data.unit,
        delivery_by: data.deliveryBy ?? null,
        specification: data.specification ?? null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await logAudit(supabase, {
      userId,
      tenantId: data.tenantId,
      action: "fpo.procurement.rfq.raise",
      subjectType: "fpo_procurement_rfqs",
      subjectId: row.id,
      metadata: { product: data.productName, quantity: agg.total_quantity },
    });
    return { id: row.id as string, quantity: agg.total_quantity };
  });

export const recordSupplierQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      tenantId: string;
      rfqId: string;
      supplierName: string;
      certificationLabel?: string | null;
      unitPrice: number;
      transportCost?: number | null;
      deliveryDays?: number | null;
      availableQuantity?: number | null;
      supplierRating?: number | null;
      note?: string | null;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { roles } = await tenantScope(supabase, userId, data.tenantId);
    if (!canManageProcurement(roles)) throw new Error("Only FPO administrators can record supplier quotes");
    if (!data.supplierName.trim()) throw new Error("Supplier name is required");
    if (!(data.unitPrice >= 0)) throw new Error("Unit price must be zero or more");

    const { data: row, error } = await supabase
      .from("fpo_supplier_quotes")
      .insert({
        rfq_id: data.rfqId,
        tenant_id: data.tenantId,
        supplier_name: data.supplierName.trim(),
        certification_label: data.certificationLabel ?? null,
        unit_price: data.unitPrice,
        transport_cost: data.transportCost ?? 0,
        delivery_days: data.deliveryDays ?? null,
        available_quantity: data.availableQuantity ?? null,
        supplier_rating: data.supplierRating ?? null,
        note: data.note ?? null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await logAudit(supabase, {
      userId,
      tenantId: data.tenantId,
      action: "fpo.procurement.quote.record",
      subjectType: "fpo_supplier_quotes",
      subjectId: row.id,
      metadata: { rfqId: data.rfqId, supplier: data.supplierName },
    });
    return { id: row.id as string };
  });

export const selectSupplierQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string; rfqId: string; quoteId: string; note?: string | null }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { roles } = await tenantScope(supabase, userId, data.tenantId);
    if (!canSelectSupplier(roles)) throw new Error("Only an authorized FPO office bearer can select a supplier");

    await supabase
      .from("fpo_supplier_quotes")
      .update({ is_selected: false, selected_at: null, selected_by_user_id: null })
      .eq("rfq_id", data.rfqId)
      .eq("tenant_id", data.tenantId);

    const { error } = await supabase
      .from("fpo_supplier_quotes")
      .update({
        is_selected: true,
        selected_at: new Date().toISOString(),
        selected_by_user_id: userId,
        note: data.note ?? null,
      })
      .eq("id", data.quoteId)
      .eq("tenant_id", data.tenantId);
    if (error) throw new Error(error.message);

    await logAudit(supabase, {
      userId,
      tenantId: data.tenantId,
      action: "fpo.procurement.quote.select",
      subjectType: "fpo_supplier_quotes",
      subjectId: data.quoteId,
      metadata: { rfqId: data.rfqId, note: data.note ?? null },
    });
    return { ok: true };
  });

export const recordDistribution = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      tenantId: string;
      campaignId: string;
      memberId: string | null;
      productName: string;
      quantity: number;
      unit: string;
      amountDue: number;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { roles } = await tenantScope(supabase, userId, data.tenantId);
    if (!canManageProcurement(roles)) throw new Error("Only FPO administrators can record distribution");
    if (!(data.quantity > 0)) throw new Error("Quantity must be greater than zero");

    const { data: row, error } = await supabase
      .from("fpo_procurement_distributions")
      .insert({
        campaign_id: data.campaignId,
        tenant_id: data.tenantId,
        member_id: data.memberId,
        product_name: data.productName.trim(),
        quantity: data.quantity,
        unit: data.unit || "kg",
        amount_due: data.amountDue,
        payment_state: "pending",
        distributed_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await logAudit(supabase, {
      userId,
      tenantId: data.tenantId,
      action: "fpo.procurement.distribution.record",
      subjectType: "fpo_procurement_distributions",
      subjectId: row.id,
      metadata: { campaignId: data.campaignId, quantity: data.quantity },
    });
    return { id: row.id as string };
  });

export const recordDistributionPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string; distributionId: string; amountCollected: number }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { roles } = await tenantScope(supabase, userId, data.tenantId);
    if (!canManageProcurement(roles)) throw new Error("Only FPO administrators can record payments");
    if (data.amountCollected < 0) throw new Error("Collected amount cannot be negative");

    const { data: existing } = await supabase
      .from("fpo_procurement_distributions")
      .select("amount_due")
      .eq("id", data.distributionId)
      .eq("tenant_id", data.tenantId)
      .maybeSingle();
    if (!existing) throw new Error("Distribution row not found");

    const state = derivePaymentState(Number(existing.amount_due), data.amountCollected);
    const { error } = await supabase
      .from("fpo_procurement_distributions")
      .update({ amount_collected: data.amountCollected, payment_state: state })
      .eq("id", data.distributionId);
    if (error) throw new Error(error.message);

    await logAudit(supabase, {
      userId,
      tenantId: data.tenantId,
      action: "fpo.procurement.distribution.payment",
      subjectType: "fpo_procurement_distributions",
      subjectId: data.distributionId,
      metadata: { collected: data.amountCollected, state },
    });
    return { ok: true, state };
  });
