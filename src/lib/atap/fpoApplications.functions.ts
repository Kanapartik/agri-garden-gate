/**
 * FPO Management & Operations workspace — Phase 4 server functions.
 *
 * FPO scheme application tracking and member facilitation. Reads are
 * tenant-scoped and default-deny; writes require FPO admin authority, are
 * lifecycle-validated, append an immutable application event and write an
 * audit record. Government decision outcomes require a platform-authorized
 * reviewer; farmer applications are never advanced without recorded farmer
 * authorization.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  applicationCounts,
  canAssistFarmerApplication,
  canManageApplications,
  canRecordDecision,
  canTransitionApplication,
  canTransitionFacilitation,
  facilitationCounts,
  isDecisionStatus,
  submissionReadiness,
  FACILITATION_DISCLAIMER,
  type ApplicationStatus,
  type CampaignStatus,
  type FacilitationState,
} from "@/lib/atap/fpoApplications";
import type { AppRole } from "@/lib/atap/policy";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type AuthedClient = SupabaseClient<Database>;

export interface ApplicationRow {
  id: string;
  scheme_id: string;
  scheme_title: string;
  status: ApplicationStatus;
  reference_no: string | null;
  title: string;
  assigned_user_id: string | null;
  requires_signatory: boolean;
  pending_documents: string[];
  requested_amount: number | null;
  benefit_amount: number | null;
  submitted_at: string | null;
  decided_at: string | null;
  note: string | null;
  updated_at: string;
}

export interface ApplicationBoard {
  tenantId: string;
  roles: AppRole[];
  canManage: boolean;
  canDecide: boolean;
  isSignatory: boolean;
  applications: ApplicationRow[];
  counts: Record<ApplicationStatus, number>;
  schemes: Array<{ id: string; title: string }>;
  disclaimer: string;
}

export interface CampaignSummary {
  id: string;
  name: string;
  status: CampaignStatus;
  scheme_id: string | null;
  scheme_title: string | null;
  note: string | null;
  counts: Record<FacilitationState, number>;
  members: Array<{
    id: string;
    member_id: string;
    display_name: string;
    state: FacilitationState;
    assigned_agent_user_id: string | null;
    authorization_recorded_at: string | null;
    has_assistance_consent: boolean;
    can_assist: boolean;
  }>;
}

export interface FacilitationBoard {
  tenantId: string;
  roles: AppRole[];
  canManage: boolean;
  campaigns: CampaignSummary[];
  schemes: Array<{ id: string; title: string }>;
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
  return { actor, roles };
}

async function isSignatory(supabase: AuthedClient, tenantId: string, userId: string) {
  const { data } = await supabase
    .from("fpo_leadership")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .eq("is_signatory", true)
    .maybeSingle();
  return Boolean(data);
}

async function publishedSchemes(supabase: AuthedClient) {
  const { data } = await supabase
    .from("schemes")
    .select("id, title")
    .eq("status", "published")
    .order("title");
  return ((data ?? []) as Array<{ id: string; title: string }>).map((s) => ({
    id: s.id,
    title: s.title,
  }));
}

async function recordEvent(
  supabase: AuthedClient,
  input: {
    applicationId: string;
    tenantId: string;
    from: ApplicationStatus | null;
    to: ApplicationStatus;
    userId: string;
    note?: string | null;
  },
) {
  await supabase.from("fpo_application_events").insert({
    application_id: input.applicationId,
    tenant_id: input.tenantId,
    from_status: input.from,
    to_status: input.to,
    actor_user_id: input.userId,
    note: input.note ?? null,
  });
}

/* --------------------------------------------------------- application API */

export const getApplicationBoard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string }) => input)
  .handler(async ({ data, context }): Promise<ApplicationBoard> => {
    const { supabase, userId } = context;
    const { actor, roles } = await tenantScope(supabase, userId, data.tenantId);

    const [{ data: rows }, schemes, signatory] = await Promise.all([
      supabase
        .from("fpo_scheme_applications")
        .select("*, schemes(title)")
        .eq("tenant_id", data.tenantId)
        .order("updated_at", { ascending: false }),
      publishedSchemes(supabase),
      isSignatory(supabase, data.tenantId, userId),
    ]);

    const applications: ApplicationRow[] = (
      (rows ?? []) as Array<
        Record<string, unknown> & { schemes: { title: string } | null }
      >
    ).map((r) => ({
      id: r["id"] as string,
      scheme_id: r["scheme_id"] as string,
      scheme_title: r.schemes?.title ?? "Scheme",
      status: r["status"] as ApplicationStatus,
      reference_no: (r["reference_no"] as string | null) ?? null,
      title: r["title"] as string,
      assigned_user_id: (r["assigned_user_id"] as string | null) ?? null,
      requires_signatory: Boolean(r["requires_signatory"]),
      pending_documents: (r["pending_documents"] as string[] | null) ?? [],
      requested_amount: (r["requested_amount"] as number | null) ?? null,
      benefit_amount: (r["benefit_amount"] as number | null) ?? null,
      submitted_at: (r["submitted_at"] as string | null) ?? null,
      decided_at: (r["decided_at"] as string | null) ?? null,
      note: (r["note"] as string | null) ?? null,
      updated_at: r["updated_at"] as string,
    }));

    return {
      tenantId: data.tenantId,
      roles,
      canManage: canManageApplications(roles, actor.isPlatformAdmin),
      canDecide: canRecordDecision(actor.isPlatformAdmin, roles),
      isSignatory: signatory,
      applications,
      counts: applicationCounts(applications),
      schemes,
      disclaimer: FACILITATION_DISCLAIMER,
    };
  });

export const createFpoApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      tenantId: string;
      schemeId: string;
      title: string;
      requiresSignatory?: boolean;
      requestedAmount?: number | null;
      pendingDocuments?: string[];
      note?: string | null;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { actor, roles } = await tenantScope(supabase, userId, data.tenantId);
    if (!canManageApplications(roles, actor.isPlatformAdmin)) {
      throw new Error("You are not permitted to create scheme applications for this FPO");
    }
    if (!data.title.trim()) throw new Error("Give the application a title");

    const pending = data.pendingDocuments ?? [];
    const { data: created, error } = await supabase
      .from("fpo_scheme_applications")
      .insert({
        tenant_id: data.tenantId,
        scheme_id: data.schemeId,
        title: data.title.trim(),
        status: pending.length > 0 ? "documents_pending" : "draft",
        requires_signatory: data.requiresSignatory ?? true,
        requested_amount: data.requestedAmount ?? null,
        pending_documents: pending,
        note: data.note ?? null,
        created_by_user_id: userId,
      })
      .select("id, status")
      .single();
    if (error) throw new Error(error.message);

    const row = created as { id: string; status: ApplicationStatus };
    await recordEvent(supabase, {
      applicationId: row.id,
      tenantId: data.tenantId,
      from: null,
      to: row.status,
      userId,
      note: "Application created",
    });

    const { audit } = await import("@/lib/atap/admin.server");
    await audit(supabase, {
      actor_user_id: userId,
      tenant_id: data.tenantId,
      action: "fpo.application.create",
      subject_type: "fpo_scheme_applications",
      subject_id: row.id,
      decision: "allow",
      metadata: { scheme_id: data.schemeId, status: row.status },
    });
    return { id: row.id };
  });

export const setFpoApplicationStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      tenantId: string;
      applicationId: string;
      status: ApplicationStatus;
      note?: string | null;
      benefitAmount?: number | null;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { actor, roles } = await tenantScope(supabase, userId, data.tenantId);
    if (!canManageApplications(roles, actor.isPlatformAdmin)) {
      throw new Error("You are not permitted to update this application");
    }

    const { data: existing } = await supabase
      .from("fpo_scheme_applications")
      .select("id, status, pending_documents, requires_signatory")
      .eq("tenant_id", data.tenantId)
      .eq("id", data.applicationId)
      .maybeSingle();
    if (!existing) throw new Error("Application not found");

    const current = existing as {
      status: ApplicationStatus;
      pending_documents: string[] | null;
      requires_signatory: boolean;
    };
    if (!canTransitionApplication(current.status, data.status)) {
      throw new Error(`Cannot move this application from ${current.status} to ${data.status}`);
    }
    if (isDecisionStatus(data.status) && !canRecordDecision(actor.isPlatformAdmin, roles)) {
      throw new Error(
        "Approval, rejection and benefit outcomes are recorded by the authorized reviewer, not the FPO",
      );
    }

    const patch: Record<string, unknown> = { status: data.status, note: data.note ?? null };
    if (data.status === "submitted") {
      const readiness = submissionReadiness(current, {
        isSignatory: await isSignatory(supabase, data.tenantId, userId),
      });
      if (!readiness.ready) throw new Error(readiness.blockers.join("; "));
      patch["submitted_at"] = new Date().toISOString();
      patch["submitted_by_user_id"] = userId;
    }
    if (data.status === "approved" || data.status === "rejected") {
      patch["decided_at"] = new Date().toISOString();
    }
    if (data.status === "benefit_received") {
      patch["benefit_amount"] = data.benefitAmount ?? null;
    }

    const { error } = await supabase
      .from("fpo_scheme_applications")
      .update(patch)
      .eq("id", data.applicationId);
    if (error) throw new Error(error.message);

    await recordEvent(supabase, {
      applicationId: data.applicationId,
      tenantId: data.tenantId,
      from: current.status,
      to: data.status,
      userId,
      note: data.note ?? null,
    });

    const { audit } = await import("@/lib/atap/admin.server");
    await audit(supabase, {
      actor_user_id: userId,
      tenant_id: data.tenantId,
      action: "fpo.application.status",
      subject_type: "fpo_scheme_applications",
      subject_id: data.applicationId,
      decision: "allow",
      metadata: { from: current.status, to: data.status },
    });
    return { ok: true };
  });

export const getApplicationHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string; applicationId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await tenantScope(supabase, userId, data.tenantId);
    const { data: rows } = await supabase
      .from("fpo_application_events")
      .select("id, from_status, to_status, note, created_at")
      .eq("tenant_id", data.tenantId)
      .eq("application_id", data.applicationId)
      .order("created_at", { ascending: false });
    return (rows ?? []) as Array<{
      id: string;
      from_status: ApplicationStatus | null;
      to_status: ApplicationStatus;
      note: string | null;
      created_at: string;
    }>;
  });

/* -------------------------------------------------------- facilitation API */

export const getFacilitationBoard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string }) => input)
  .handler(async ({ data, context }): Promise<FacilitationBoard> => {
    const { supabase, userId } = context;
    const { actor, roles } = await tenantScope(supabase, userId, data.tenantId);

    const [{ data: campaigns }, { data: members }, { data: consents }, schemes] = await Promise.all([
      supabase
        .from("fpo_member_campaigns")
        .select("id, name, status, scheme_id, note, schemes(title)")
        .eq("tenant_id", data.tenantId)
        .order("created_at", { ascending: false }),
      supabase
        .from("fpo_campaign_members")
        .select(
          "id, campaign_id, member_id, state, assigned_agent_user_id, authorization_recorded_at, fpo_members(display_name, farmer_user_id)",
        )
        .eq("tenant_id", data.tenantId),
      supabase
        .from("fpo_farmer_consents")
        .select("member_id, purpose_code, revoked_at")
        .eq("tenant_id", data.tenantId)
        .eq("purpose_code", "fpo_scheme_assistance"),
      publishedSchemes(supabase),
    ]);

    const consented = new Set(
      ((consents ?? []) as Array<{ member_id: string; revoked_at: string | null }>)
        .filter((c) => !c.revoked_at)
        .map((c) => c.member_id),
    );

    const memberRows = (members ?? []) as Array<{
      id: string;
      campaign_id: string;
      member_id: string;
      state: FacilitationState;
      assigned_agent_user_id: string | null;
      authorization_recorded_at: string | null;
      fpo_members: { display_name: string | null } | null;
    }>;

    const summaries: CampaignSummary[] = (
      (campaigns ?? []) as Array<{
        id: string;
        name: string;
        status: CampaignStatus;
        scheme_id: string | null;
        note: string | null;
        schemes: { title: string } | null;
      }>
    ).map((c) => {
      const rows = memberRows
        .filter((m) => m.campaign_id === c.id)
        .map((m) => {
          const hasConsent = consented.has(m.member_id);
          return {
            id: m.id,
            member_id: m.member_id,
            display_name: m.fpo_members?.display_name ?? "Member",
            state: m.state,
            assigned_agent_user_id: m.assigned_agent_user_id,
            authorization_recorded_at: m.authorization_recorded_at,
            has_assistance_consent: hasConsent,
            can_assist: canAssistFarmerApplication({
              state: m.state,
              hasAssistanceConsent: hasConsent,
            }),
          };
        });
      return {
        id: c.id,
        name: c.name,
        status: c.status,
        scheme_id: c.scheme_id,
        scheme_title: c.schemes?.title ?? null,
        note: c.note,
        counts: facilitationCounts(rows),
        members: rows,
      };
    });

    return {
      tenantId: data.tenantId,
      roles,
      canManage: canManageApplications(roles, actor.isPlatformAdmin),
      campaigns: summaries,
      schemes,
      disclaimer: FACILITATION_DISCLAIMER,
    };
  });

export const createMemberCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { tenantId: string; name: string; schemeId?: string | null; note?: string | null }) =>
      input,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { actor, roles } = await tenantScope(supabase, userId, data.tenantId);
    if (!canManageApplications(roles, actor.isPlatformAdmin)) {
      throw new Error("You are not permitted to create facilitation campaigns");
    }
    if (!data.name.trim()) throw new Error("Give the campaign a name");

    const { data: created, error } = await supabase
      .from("fpo_member_campaigns")
      .insert({
        tenant_id: data.tenantId,
        name: data.name.trim(),
        scheme_id: data.schemeId ?? null,
        note: data.note ?? null,
        status: "active",
        created_by_user_id: userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    const { audit } = await import("@/lib/atap/admin.server");
    await audit(supabase, {
      actor_user_id: userId,
      tenant_id: data.tenantId,
      action: "fpo.campaign.create",
      subject_type: "fpo_member_campaigns",
      subject_id: (created as { id: string }).id,
      decision: "allow",
      metadata: { scheme_id: data.schemeId ?? null },
    });
    return { id: (created as { id: string }).id };
  });

export const addCampaignMembers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string; campaignId: string; memberIds: string[] }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { actor, roles } = await tenantScope(supabase, userId, data.tenantId);
    if (!canManageApplications(roles, actor.isPlatformAdmin)) {
      throw new Error("You are not permitted to change this campaign cohort");
    }
    if (data.memberIds.length === 0) return { added: 0 };

    const { error } = await supabase.from("fpo_campaign_members").upsert(
      data.memberIds.map((memberId) => ({
        tenant_id: data.tenantId,
        campaign_id: data.campaignId,
        member_id: memberId,
        state: "identified" as FacilitationState,
      })),
      { onConflict: "campaign_id,member_id", ignoreDuplicates: true },
    );
    if (error) throw new Error(error.message);

    const { audit } = await import("@/lib/atap/admin.server");
    await audit(supabase, {
      actor_user_id: userId,
      tenant_id: data.tenantId,
      action: "fpo.campaign.members.add",
      subject_type: "fpo_member_campaigns",
      subject_id: data.campaignId,
      decision: "allow",
      metadata: { count: data.memberIds.length },
    });
    return { added: data.memberIds.length };
  });

export const setFacilitationState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      tenantId: string;
      cohortMemberId: string;
      state: FacilitationState;
      assignToMe?: boolean;
      note?: string | null;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { actor, roles } = await tenantScope(supabase, userId, data.tenantId);
    if (!canManageApplications(roles, actor.isPlatformAdmin)) {
      throw new Error("You are not permitted to update this cohort member");
    }

    const { data: existing } = await supabase
      .from("fpo_campaign_members")
      .select("id, state, member_id")
      .eq("tenant_id", data.tenantId)
      .eq("id", data.cohortMemberId)
      .maybeSingle();
    if (!existing) throw new Error("Cohort member not found");

    const current = existing as { state: FacilitationState; member_id: string };
    if (!canTransitionFacilitation(current.state, data.state)) {
      throw new Error(`Cannot move this member from ${current.state} to ${data.state}`);
    }

    // Farmer authorization is a consent fact, not an FPO click.
    if (data.state === "authorized" || data.state === "application_started" || data.state === "application_submitted") {
      const { data: consent } = await supabase
        .from("fpo_farmer_consents")
        .select("id")
        .eq("tenant_id", data.tenantId)
        .eq("member_id", current.member_id)
        .eq("purpose_code", "fpo_scheme_assistance")
        .is("revoked_at", null)
        .maybeSingle();
      if (!consent) {
        throw new Error(
          "This farmer has not authorized scheme assistance. Record purpose-scoped consent first.",
        );
      }
    }

    const { error } = await supabase
      .from("fpo_campaign_members")
      .update({
        state: data.state,
        note: data.note ?? null,
        ...(data.assignToMe ? { assigned_agent_user_id: userId } : {}),
        ...(data.state === "authorized" ? { authorization_recorded_at: new Date().toISOString() } : {}),
      })
      .eq("id", data.cohortMemberId);
    if (error) throw new Error(error.message);

    const { audit } = await import("@/lib/atap/admin.server");
    await audit(supabase, {
      actor_user_id: userId,
      tenant_id: data.tenantId,
      action: "fpo.campaign.member.state",
      subject_type: "fpo_campaign_members",
      subject_id: data.cohortMemberId,
      decision: "allow",
      metadata: { from: current.state, to: data.state },
    });
    return { ok: true };
  });
