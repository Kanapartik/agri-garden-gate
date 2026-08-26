/**
 * FPO Management & Operations workspace — Phase 3 server functions.
 *
 * Opportunity Center and FPO scheme intelligence. Reads are tenant-scoped and
 * default-deny; writes require FPO admin (or scheme reviewer) authority and are
 * audited. Eligibility is advisory: decision buckets (approved / rejected /
 * benefit received) can only be set by a platform-authorized reviewer, never
 * derived automatically.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  ADVISORY_DISCLAIMER,
  buildCards,
  buildSchemeCards,
  bucketCounts,
  canManageOpportunities,
  canSetBucket,
  canTransitionTracking,
  explainEligibility,
  trackingCounts,
  type EligibilityBucket,
  type EligibilityProfileInput,
  type EligibilityRow,
  type OpportunityCard,
  type OpportunityCategory,
  type OpportunityRow,
  type SchemeCard,
  type SchemeInput,
  type TrackStatus,
  type TrackingRow,
} from "@/lib/atap/fpoOpportunities";
import type { AppRole } from "@/lib/atap/policy";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";

type AuthedClient = SupabaseClient<Database>;

/* ------------------------------------------------------------------ types */

export interface OpportunityBoard {
  tenantId: string;
  roles: AppRole[];
  canManage: boolean;
  cards: OpportunityCard[];
  counts: Record<TrackStatus, number>;
  categories: OpportunityCategory[];
  commodities: string[];
  fpo: { state_code: string | null; district_code: string | null; commodities: string[] } | null;
  advisory: string;
}

export interface SchemeIntelligence {
  tenantId: string;
  roles: AppRole[];
  canManage: boolean;
  canDecide: boolean;
  cards: SchemeCard[];
  counts: Record<EligibilityBucket, number>;
  advisory: string;
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
  return { actor, roles };
}

async function loadProfile(
  supabase: AuthedClient,
  tenantId: string,
): Promise<EligibilityProfileInput & { commodities: string[] }> {
  const { data } = await supabase
    .from("fpo_profiles")
    .select(
      "state_code, district_code, primary_crops, secondary_crops, active_farmers, registered_farmers, total_acres, state",
    )
    .eq("tenant_id", tenantId)
    .maybeSingle();

  const { data: docs } = await supabase
    .from("fpo_documents")
    .select("doc_type, status")
    .eq("tenant_id", tenantId);

  const verifiedDocs = ((docs ?? []) as Array<{ doc_type: string; status: string }>)
    .filter((d) => d.status === "verified")
    .map((d) => d.doc_type);

  if (!data) return { commodities: [], document_types: verifiedDocs };

  const row = data as {
    state_code: string | null;
    district_code: string | null;
    primary_crops: string[] | null;
    secondary_crops: string[] | null;
    active_farmers: number | null;
    registered_farmers: number | null;
    total_acres: number | null;
    state: string;
  };
  const commodities = [...(row.primary_crops ?? []), ...(row.secondary_crops ?? [])];
  return {
    state_code: row.state_code,
    district_code: row.district_code,
    commodities,
    active_members: row.active_farmers,
    registered_members: row.registered_farmers,
    total_acreage: row.total_acres,
    verification_state: row.state,
    document_types: verifiedDocs,
  };
}

/* ------------------------------------------------------ opportunity board */

export const getOpportunityBoard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string }) => input)
  .handler(async ({ data, context }): Promise<OpportunityBoard> => {
    const { supabase, userId } = context;
    const { actor, roles } = await tenantScope(supabase, userId, data.tenantId);

    const [{ data: shared }, { data: owned }, { data: tracking }, profile] = await Promise.all([
      supabase.from("fpo_opportunities").select("*").is("tenant_id", null),
      supabase.from("fpo_opportunities").select("*").eq("tenant_id", data.tenantId),
      supabase
        .from("fpo_opportunity_tracking")
        .select("opportunity_id, status, owner_user_id, note")
        .eq("tenant_id", data.tenantId),
      loadProfile(supabase, data.tenantId),
    ]);

    const rows = [...((shared ?? []) as OpportunityRow[]), ...((owned ?? []) as OpportunityRow[])];
    const cards = buildCards(rows, (tracking ?? []) as TrackingRow[], {
      state_code: profile.state_code ?? null,
      district_code: profile.district_code ?? null,
      commodities: profile.commodities,
    });

    return {
      tenantId: data.tenantId,
      roles,
      canManage: canManageOpportunities(roles, actor.isPlatformAdmin),
      cards,
      counts: trackingCounts(cards),
      categories: Array.from(new Set(cards.map((c) => c.category))).sort(),
      commodities: Array.from(new Set(cards.flatMap((c) => c.commodities))).sort(),
      fpo: {
        state_code: profile.state_code ?? null,
        district_code: profile.district_code ?? null,
        commodities: profile.commodities,
      },
      advisory: ADVISORY_DISCLAIMER,
    };
  });

export const setOpportunityTracking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      tenantId: string;
      opportunityId: string;
      status: TrackStatus;
      note?: string | null;
      assignToMe?: boolean;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { actor, roles } = await tenantScope(supabase, userId, data.tenantId);
    if (!canManageOpportunities(roles, actor.isPlatformAdmin)) {
      throw new Error("You are not permitted to update opportunity tracking");
    }

    const { data: existing } = await supabase
      .from("fpo_opportunity_tracking")
      .select("id, status")
      .eq("tenant_id", data.tenantId)
      .eq("opportunity_id", data.opportunityId)
      .maybeSingle();

    const from = ((existing as { status: TrackStatus } | null)?.status ?? "new") as TrackStatus;
    if (from !== data.status && !canTransitionTracking(from, data.status)) {
      throw new Error(`Cannot move this opportunity from ${from} to ${data.status}`);
    }

    const payload = {
      tenant_id: data.tenantId,
      opportunity_id: data.opportunityId,
      status: data.status,
      note: data.note ?? null,
      ...(data.assignToMe ? { owner_user_id: userId } : {}),
    };

    const { error } = existing
      ? await supabase
          .from("fpo_opportunity_tracking")
          .update(payload)
          .eq("id", (existing as { id: string }).id)
      : await supabase.from("fpo_opportunity_tracking").insert(payload);
    if (error) throw new Error(error.message);

    const { audit } = await import("@/lib/atap/admin.server");
    await audit(supabase, {
      actor_user_id: userId,
      tenant_id: data.tenantId,
      action: "fpo.opportunity.track",
      subject_type: "fpo_opportunity_tracking",
      subject_id: data.opportunityId,
      decision: "allow",
      metadata: { from, to: data.status },
    });
    return { ok: true };
  });

/* --------------------------------------------------- scheme intelligence */

export const getSchemeIntelligence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string }) => input)
  .handler(async ({ data, context }): Promise<SchemeIntelligence> => {
    const { supabase, userId } = context;
    const { actor, roles } = await tenantScope(supabase, userId, data.tenantId);

    const [{ data: schemes }, { data: eligibility }, profile] = await Promise.all([
      supabase
        .from("schemes")
        .select("id, code, title, summary, status, current_version, geography_id")
        .eq("status", "published")
        .order("title"),
      supabase
        .from("fpo_scheme_eligibility")
        .select(
          "scheme_id, bucket, reasons, missing_information, advisory_note, source_name, assessed_at",
        )
        .eq("tenant_id", data.tenantId),
      loadProfile(supabase, data.tenantId),
    ]);

    const schemeInputs: SchemeInput[] = (
      (schemes ?? []) as Array<{
        id: string;
        code: string;
        title: string;
        summary: string;
      }>
    ).map((s) => ({ id: s.id, code: s.code, title: s.title, summary: s.summary }));

    const rows: EligibilityRow[] = (
      (eligibility ?? []) as Array<{
        scheme_id: string;
        bucket: EligibilityBucket;
        reasons: Json;
        missing_information: string[] | null;
        advisory_note: string | null;
        source_name: string;
        assessed_at: string;
      }>
    ).map((r) => ({
      scheme_id: r.scheme_id,
      bucket: r.bucket,
      reasons: Array.isArray(r.reasons) ? (r.reasons as string[]) : [],
      missing_information: r.missing_information ?? [],
      advisory_note: r.advisory_note,
      source_name: r.source_name,
      assessed_at: r.assessed_at,
    }));

    const cards = buildSchemeCards(schemeInputs, rows, profile);

    return {
      tenantId: data.tenantId,
      roles,
      canManage: canManageOpportunities(roles, actor.isPlatformAdmin),
      canDecide: actor.isPlatformAdmin,
      cards,
      counts: bucketCounts(cards),
      advisory: ADVISORY_DISCLAIMER,
    };
  });

export const reassessSchemeEligibility = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string; schemeId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { actor, roles } = await tenantScope(supabase, userId, data.tenantId);
    if (!canManageOpportunities(roles, actor.isPlatformAdmin)) {
      throw new Error("You are not permitted to reassess scheme eligibility");
    }

    const { data: scheme } = await supabase
      .from("schemes")
      .select("id, code, title, summary")
      .eq("id", data.schemeId)
      .maybeSingle();
    if (!scheme) throw new Error("Scheme not found");

    const profile = await loadProfile(supabase, data.tenantId);
    const outcome = explainEligibility(scheme as SchemeInput, profile);

    const { error } = await supabase.from("fpo_scheme_eligibility").upsert(
      {
        tenant_id: data.tenantId,
        scheme_id: data.schemeId,
        bucket: outcome.bucket,
        reasons: outcome.reasons as unknown as Json,
        missing_information: outcome.missing,
        advisory_note: outcome.advisory,
        source_name: "agrighar_profile_assessment",
        assessed_at: new Date().toISOString(),
        assessed_by: userId,
      },
      { onConflict: "tenant_id,scheme_id" },
    );
    if (error) throw new Error(error.message);

    const { audit } = await import("@/lib/atap/admin.server");
    await audit(supabase, {
      actor_user_id: userId,
      tenant_id: data.tenantId,
      action: "fpo.scheme.eligibility.reassess",
      subject_type: "fpo_scheme_eligibility",
      subject_id: data.schemeId,
      decision: "allow",
      metadata: { bucket: outcome.bucket, missing: outcome.missing.length },
    });
    return outcome;
  });

export const setSchemeEligibilityBucket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      tenantId: string;
      schemeId: string;
      bucket: EligibilityBucket;
      note?: string | null;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { actor, roles } = await tenantScope(supabase, userId, data.tenantId);
    if (!canManageOpportunities(roles, actor.isPlatformAdmin)) {
      throw new Error("You are not permitted to update scheme eligibility");
    }
    if (!canSetBucket(data.bucket, actor.isPlatformAdmin)) {
      throw new Error(
        "Approval, rejection and benefit outcomes are recorded by the authorized reviewer, not the FPO",
      );
    }

    const { error } = await supabase.from("fpo_scheme_eligibility").upsert(
      {
        tenant_id: data.tenantId,
        scheme_id: data.schemeId,
        bucket: data.bucket,
        advisory_note: data.note ?? ADVISORY_DISCLAIMER,
        source_name: "fpo_team_update",
        assessed_at: new Date().toISOString(),
        assessed_by: userId,
      },
      { onConflict: "tenant_id,scheme_id" },
    );
    if (error) throw new Error(error.message);

    const { audit } = await import("@/lib/atap/admin.server");
    await audit(supabase, {
      actor_user_id: userId,
      tenant_id: data.tenantId,
      action: "fpo.scheme.eligibility.set",
      subject_type: "fpo_scheme_eligibility",
      subject_id: data.schemeId,
      decision: "allow",
      metadata: { bucket: data.bucket },
    });
    return { ok: true };
  });
