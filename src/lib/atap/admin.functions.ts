/**
 * B1 admin control plane. Every handler re-checks authority server-side; the
 * admin UI hiding a button is presentation only.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";
import type { AppRole } from "@/lib/atap/policy";
import {
  advanceWorkflow,
  canApprovePrivilegeRequest,
  canProvisionTenant,
  checkTenantRoleGrant,
  isValidContactTarget,
  planConsentGrant,
  planOrgTransition,
  type ContactChannel,
  type OrgStatus,
  type TenantRelationshipType,
  type WorkflowState,
} from "@/lib/atap/identity";

export interface AdminConsole {
  actor: {
    isPlatformAdmin: boolean;
    isAuditor: boolean;
    tenantAdminOf: string[];
    privilegedSessionActive: boolean;
  };
  subtypes: Array<{
    code: string;
    label: string;
    tenant_type: string;
    requires_approval: boolean;
    evidence_required: string[];
    is_active: boolean;
  }>;
  organizations: Array<{
    id: string;
    display_name: string;
    legal_name: string;
    subtype_code: string;
    status: OrgStatus;
    tenant_id: string | null;
    region_code: string | null;
    decision_note: string | null;
    created_at: string;
  }>;
  tenants: Array<{ id: string; name: string; slug: string; tenant_type: string; status: string }>;
  relationships: Array<{
    id: string;
    from_tenant_id: string;
    to_tenant_id: string;
    relationship_type: string;
    status: string;
  }>;
  cases: Array<{
    id: string;
    case_type: string;
    subject_type: string;
    subject_id: string;
    status: string;
    tenant_id: string | null;
    decision_note: string | null;
    created_at: string;
  }>;
  workflows: Array<{
    id: string;
    workflow_key: string;
    subject_type: string;
    subject_id: string;
    current_state: string;
    status: string;
    updated_at: string;
  }>;
  privilegeRequests: Array<{
    id: string;
    requester_user_id: string;
    requested_role: string;
    status: string;
    mfa_verified: boolean;
    justification: string;
    expires_at: string | null;
    created_at: string;
  }>;
  entitlements: Array<{
    id: string;
    tenant_id: string;
    plan_code: string;
    status: string;
    features: Json;
  }>;
  consentPolicies: Array<{
    code: string;
    purpose_code: string;
    max_duration_days: number;
    requires_explicit_consent: boolean;
    is_active: boolean;
  }>;
  audit: Array<{
    id: string;
    action: string;
    decision: string;
    subject_type: string | null;
    subject_id: string | null;
    metadata: Json;
    created_at: string;
  }>;
}

/** Read model for the admin console. RLS decides what actually comes back. */
export const getAdminConsole = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminConsole> => {
    const { supabase, userId } = context;
    const { resolveActor } = await import("@/lib/atap/admin.server");
    const actor = await resolveActor(supabase, userId);

    const [subtypes, orgs, tenants, rels, cases, workflows, privileges, ents, policies, audit] =
      await Promise.all([
        supabase.from("organization_subtypes").select("*").order("sort_order"),
        supabase.from("organizations").select("*").order("created_at", { ascending: false }).limit(100),
        supabase.from("tenants").select("id, name, slug, tenant_type, status").order("name"),
        supabase.from("tenant_relationships").select("*").limit(100),
        supabase.from("verification_cases").select("*").order("created_at", { ascending: false }).limit(100),
        supabase.from("onboarding_workflows").select("*").order("updated_at", { ascending: false }).limit(100),
        supabase.from("privileged_access_requests").select("*").order("created_at", { ascending: false }).limit(50),
        supabase.from("tenant_entitlements").select("*").limit(100),
        supabase.from("consent_policies").select("*").order("code"),
        supabase
          .from("audit_events")
          .select("id, action, decision, subject_type, subject_id, metadata, created_at")
          .order("created_at", { ascending: false })
          .limit(100),
      ]);

    return {
      actor: {
        isPlatformAdmin: actor.isPlatformAdmin,
        isAuditor: actor.isAuditor,
        tenantAdminOf: actor.tenantAdminOf,
        privilegedSessionActive: actor.privilegedSessionActive,
      },
      subtypes: (subtypes.data ?? []).map((s) => ({
        code: s.code,
        label: s.label,
        tenant_type: s.tenant_type,
        requires_approval: s.requires_approval,
        evidence_required: Array.isArray(s.evidence_required)
          ? (s.evidence_required as string[])
          : [],
        is_active: s.is_active,
      })),
      organizations: (orgs.data ?? []) as AdminConsole["organizations"],
      tenants: (tenants.data ?? []) as AdminConsole["tenants"],
      relationships: (rels.data ?? []) as AdminConsole["relationships"],
      cases: (cases.data ?? []) as AdminConsole["cases"],
      workflows: (workflows.data ?? []) as AdminConsole["workflows"],
      privilegeRequests: (privileges.data ?? []) as AdminConsole["privilegeRequests"],
      entitlements: (ents.data ?? []) as AdminConsole["entitlements"],
      consentPolicies: (policies.data ?? []) as AdminConsole["consentPolicies"],
      audit: (audit.data ?? []) as AdminConsole["audit"],
    };
  });

/* ------------------------------------------------- organisation registry */

export const createOrganization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      legalName: string;
      displayName: string;
      subtypeCode: string;
      registrationNumber?: string;
      regionCode?: string;
      evidence?: string[];
    }) => {
      if (!input.legalName?.trim() || !input.displayName?.trim() || !input.subtypeCode) {
        throw new Error("invalid_input");
      }
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { audit } = await import("@/lib/atap/admin.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: org, error } = await supabaseAdmin
      .from("organizations")
      .insert({
        legal_name: data.legalName.trim(),
        display_name: data.displayName.trim(),
        subtype_code: data.subtypeCode,
        registration_number: data.registrationNumber?.trim() || null,
        region_code: data.regionCode?.trim() || null,
        status: "draft",
        created_by: userId,
        is_synthetic: true,
        metadata: { evidence: data.evidence ?? [] },
      })
      .select("id, status")
      .single();
    if (error || !org) throw new Error("organization_create_failed");

    await supabaseAdmin.from("onboarding_workflows").insert({
      workflow_key: "organization_onboarding",
      subject_type: "organization",
      subject_id: org.id,
      current_state: "created" satisfies WorkflowState,
      created_by: userId,
      state_history: [{ state: "created", at: new Date().toISOString(), by: userId }],
    });

    await audit(supabase, {
      actor_user_id: userId,
      action: "organization.create",
      subject_type: "organization",
      subject_id: org.id,
      decision: "allow",
      metadata: { subtype: data.subtypeCode, synthetic: true },
    });
    return { ok: true, organizationId: org.id };
  });

export const decideOrganization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { organizationId: string; next: OrgStatus; note?: string }) => {
    if (!input.organizationId || !input.next) throw new Error("invalid_input");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { audit, resolveActor } = await import("@/lib/atap/admin.server");
    const actor = await resolveActor(supabase, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: org } = await supabaseAdmin
      .from("organizations")
      .select("id, status, subtype_code, metadata")
      .eq("id", data.organizationId)
      .maybeSingle();
    if (!org) throw new Error("organization_not_found");

    const { data: subtype } = await supabaseAdmin
      .from("organization_subtypes")
      .select("evidence_required")
      .eq("code", org.subtype_code)
      .maybeSingle();

    const evidencePresent = Array.isArray(
      (org.metadata as { evidence?: unknown } | null)?.evidence,
    )
      ? ((org.metadata as { evidence: string[] }).evidence)
      : [];

    const plan = planOrgTransition(
      org.status as OrgStatus,
      data.next,
      { isPlatformAdmin: actor.isPlatformAdmin },
      evidencePresent,
      Array.isArray(subtype?.evidence_required) ? (subtype!.evidence_required as string[]) : [],
    );

    if (!plan.ok) {
      await audit(supabase, {
        actor_user_id: userId,
        action: "organization.decide",
        subject_type: "organization",
        subject_id: org.id,
        decision: "deny",
        metadata: { attempted: data.next, reason: plan.reason },
      });
      throw new Error(plan.reason);
    }

    await supabaseAdmin
      .from("organizations")
      .update({
        status: plan.next,
        decision_note: data.note ?? null,
        decided_by: ["approved", "rejected", "suspended"].includes(plan.next) ? userId : null,
        decided_at: ["approved", "rejected", "suspended"].includes(plan.next)
          ? new Date().toISOString()
          : null,
      })
      .eq("id", org.id);

    await audit(supabase, {
      actor_user_id: userId,
      action: "organization.decide",
      subject_type: "organization",
      subject_id: org.id,
      decision: "allow",
      metadata: { from: org.status, to: plan.next, note: data.note ?? null },
    });
    return { ok: true, status: plan.next };
  });

/* ----------------------------------------------------- tenancy provision */

export const provisionTenant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { organizationId: string; slug: string; regionCode?: string }) => {
    if (!input.organizationId || !/^[a-z0-9-]{3,40}$/.test(input.slug ?? "")) {
      throw new Error("invalid_input");
    }
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { audit, resolveActor } = await import("@/lib/atap/admin.server");
    const actor = await resolveActor(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: org } = await supabaseAdmin
      .from("organizations")
      .select("id, status, display_name, subtype_code, region_code, tenant_id")
      .eq("id", data.organizationId)
      .maybeSingle();
    if (!org) throw new Error("organization_not_found");

    if (!canProvisionTenant(org.status as OrgStatus, { isPlatformAdmin: actor.isPlatformAdmin })) {
      await audit(supabase, {
        actor_user_id: userId,
        action: "tenant.provision",
        subject_type: "organization",
        subject_id: org.id,
        decision: "deny",
        metadata: { reason: actor.isPlatformAdmin ? "org_not_approved" : "not_authorized" },
      });
      throw new Error("Forbidden");
    }
    if (org.tenant_id) return { ok: true, tenantId: org.tenant_id };

    const { data: subtype } = await supabaseAdmin
      .from("organization_subtypes")
      .select("tenant_type")
      .eq("code", org.subtype_code)
      .maybeSingle();

    const { data: tenant, error } = await supabaseAdmin
      .from("tenants")
      .insert({
        name: org.display_name,
        slug: data.slug,
        tenant_type: subtype?.tenant_type ?? "agri_business",
        region_code: data.regionCode ?? org.region_code,
        status: "active",
      })
      .select("id")
      .single();
    if (error || !tenant) throw new Error("tenant_create_failed");

    await supabaseAdmin.from("organizations").update({ tenant_id: tenant.id }).eq("id", org.id);

    await audit(supabase, {
      actor_user_id: userId,
      tenant_id: tenant.id,
      action: "tenant.provision",
      subject_type: "organization",
      subject_id: org.id,
      decision: "allow",
      metadata: { slug: data.slug, note: "tenancy confers no authority" },
    });
    return { ok: true, tenantId: tenant.id };
  });

export const createTenantRelationship = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      fromTenantId: string;
      toTenantId: string;
      relationshipType: TenantRelationshipType;
      note?: string;
    }) => {
      if (!input.fromTenantId || !input.toTenantId) throw new Error("invalid_input");
      if (input.fromTenantId === input.toTenantId) throw new Error("invalid_input");
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { audit, resolveActor } = await import("@/lib/atap/admin.server");
    const actor = await resolveActor(supabase, userId);
    if (!actor.isPlatformAdmin) {
      await audit(supabase, {
        actor_user_id: userId,
        action: "tenant.relationship.create",
        subject_type: "tenant",
        subject_id: data.fromTenantId,
        decision: "deny",
        metadata: { reason: "not_authorized" },
      });
      throw new Error("Forbidden");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("tenant_relationships").insert({
      from_tenant_id: data.fromTenantId,
      to_tenant_id: data.toTenantId,
      relationship_type: data.relationshipType,
      note: data.note ?? null,
      created_by: userId,
    });
    if (error && !`${error.message}`.includes("duplicate")) throw new Error("relationship_failed");

    await audit(supabase, {
      actor_user_id: userId,
      tenant_id: data.fromTenantId,
      action: "tenant.relationship.create",
      subject_type: "tenant",
      subject_id: data.toTenantId,
      decision: "allow",
      metadata: { relationship_type: data.relationshipType },
    });
    return { ok: true };
  });

/* -------------------------------------------------------- role lifecycle */

export const grantScopedRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string; targetUserId: string; role: AppRole }) => {
    if (!input.tenantId || !input.targetUserId || !input.role) throw new Error("invalid_input");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { audit, resolveActor } = await import("@/lib/atap/admin.server");
    const actor = await resolveActor(supabase, userId);

    const check = checkTenantRoleGrant(data.role, data.tenantId, {
      isPlatformAdmin: actor.isPlatformAdmin,
      tenantAdminOf: actor.tenantAdminOf,
      privilegedSessionActive: actor.privilegedSessionActive,
    });
    if (!check.ok) {
      await audit(supabase, {
        actor_user_id: userId,
        tenant_id: data.tenantId,
        action: "role.grant",
        subject_type: "user",
        subject_id: data.targetUserId,
        decision: "deny",
        metadata: { role: data.role, reason: check.reason },
      });
      throw new Error(check.reason);
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("tenant_members")
      .upsert(
        { tenant_id: data.tenantId, user_id: data.targetUserId, status: "active" },
        { onConflict: "tenant_id,user_id" },
      );
    const { error } = await supabaseAdmin.from("user_roles").insert({
      user_id: data.targetUserId,
      tenant_id: data.tenantId,
      role: data.role,
      granted_by: userId,
    });
    if (error && !`${error.message}`.toLowerCase().includes("duplicate")) {
      throw new Error("grant_failed");
    }

    await audit(supabase, {
      actor_user_id: userId,
      tenant_id: data.tenantId,
      action: "role.grant",
      subject_type: "user",
      subject_id: data.targetUserId,
      decision: "allow",
      metadata: { role: data.role, scope: "tenant" },
    });
    return { ok: true };
  });

export const suspendTenantMembership = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string; targetUserId: string; reason?: string }) => {
    if (!input.tenantId || !input.targetUserId) throw new Error("invalid_input");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { audit, resolveActor } = await import("@/lib/atap/admin.server");
    const actor = await resolveActor(supabase, userId);
    const authorized = actor.isPlatformAdmin || actor.tenantAdminOf.includes(data.tenantId);
    if (!authorized) {
      await audit(supabase, {
        actor_user_id: userId,
        tenant_id: data.tenantId,
        action: "membership.suspend",
        subject_type: "user",
        subject_id: data.targetUserId,
        decision: "deny",
        metadata: { reason: "not_authorized" },
      });
      throw new Error("Forbidden");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("tenant_members")
      .update({ status: "suspended" })
      .eq("tenant_id", data.tenantId)
      .eq("user_id", data.targetUserId);
    await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("tenant_id", data.tenantId)
      .eq("user_id", data.targetUserId);

    await audit(supabase, {
      actor_user_id: userId,
      tenant_id: data.tenantId,
      action: "membership.suspend",
      subject_type: "user",
      subject_id: data.targetUserId,
      decision: "allow",
      metadata: { reason: data.reason ?? null },
    });
    return { ok: true };
  });

/* ------------------------------------------------------ verification ops */

export const openVerificationCase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      caseType: string;
      subjectType: string;
      subjectId: string;
      tenantId?: string | null;
      evidence?: string[];
    }) => {
      if (!input.caseType || !input.subjectType || !input.subjectId) throw new Error("invalid_input");
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { audit } = await import("@/lib/atap/admin.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: row, error } = await supabaseAdmin
      .from("verification_cases")
      .insert({
        case_type: data.caseType,
        subject_type: data.subjectType,
        subject_id: data.subjectId,
        tenant_id: data.tenantId ?? null,
        opened_by: userId,
        evidence: data.evidence ?? [],
      })
      .select("id")
      .single();
    if (error || !row) throw new Error("case_create_failed");

    await audit(supabase, {
      actor_user_id: userId,
      tenant_id: data.tenantId ?? null,
      action: "verification_case.open",
      subject_type: data.subjectType,
      subject_id: data.subjectId,
      decision: "allow",
      metadata: { case_id: row.id, case_type: data.caseType },
    });
    return { ok: true, caseId: row.id };
  });

export const decideVerificationCase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { caseId: string; decision: "approved" | "rejected" | "escalated"; note?: string }) => {
    if (!input.caseId || !input.decision) throw new Error("invalid_input");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { audit, resolveActor } = await import("@/lib/atap/admin.server");
    const actor = await resolveActor(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: row } = await supabaseAdmin
      .from("verification_cases")
      .select("id, tenant_id, status, subject_type, subject_id")
      .eq("id", data.caseId)
      .maybeSingle();
    if (!row) throw new Error("case_not_found");

    const authorized =
      actor.isPlatformAdmin ||
      (row.tenant_id !== null &&
        (actor.tenantAdminOf.includes(row.tenant_id) ||
          actor.onboardingOfficerOf.includes(row.tenant_id)));
    if (!authorized) {
      await audit(supabase, {
        actor_user_id: userId,
        tenant_id: row.tenant_id,
        action: "verification_case.decide",
        subject_type: row.subject_type,
        subject_id: row.subject_id,
        decision: "deny",
        metadata: { reason: "not_authorized", case_id: row.id },
      });
      throw new Error("Forbidden");
    }

    await supabaseAdmin
      .from("verification_cases")
      .update({
        status: data.decision,
        decision_note: data.note ?? null,
        decided_by: userId,
        decided_at: new Date().toISOString(),
      })
      .eq("id", row.id);

    await audit(supabase, {
      actor_user_id: userId,
      tenant_id: row.tenant_id,
      action: "verification_case.decide",
      subject_type: row.subject_type,
      subject_id: row.subject_id,
      decision: "allow",
      metadata: { case_id: row.id, outcome: data.decision, human_decided: true },
    });
    return { ok: true };
  });

/* ---------------------------------------------------------- workflow ops */

export const advanceOnboardingWorkflow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { workflowId: string; next: WorkflowState }) => {
    if (!input.workflowId || !input.next) throw new Error("invalid_input");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { audit, resolveActor } = await import("@/lib/atap/admin.server");
    const actor = await resolveActor(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: wf } = await supabaseAdmin
      .from("onboarding_workflows")
      .select("id, current_state, state_history, tenant_id, subject_type, subject_id, created_by")
      .eq("id", data.workflowId)
      .maybeSingle();
    if (!wf) throw new Error("workflow_not_found");

    const isReviewer =
      actor.isPlatformAdmin ||
      (wf.tenant_id !== null &&
        (actor.tenantAdminOf.includes(wf.tenant_id) ||
          actor.onboardingOfficerOf.includes(wf.tenant_id)));
    const isOwner = wf.created_by === userId;
    if (!isReviewer && !isOwner) throw new Error("Forbidden");

    const plan = advanceWorkflow(wf.current_state as WorkflowState, data.next, {
      isHumanReviewer: isReviewer,
    });
    if (!plan.ok) {
      await audit(supabase, {
        actor_user_id: userId,
        tenant_id: wf.tenant_id,
        action: "workflow.advance",
        subject_type: wf.subject_type,
        subject_id: wf.subject_id,
        decision: "deny",
        metadata: { from: wf.current_state, attempted: data.next, reason: plan.reason },
      });
      throw new Error(plan.reason);
    }

    const history = Array.isArray(wf.state_history) ? (wf.state_history as unknown[]) : [];
    await supabaseAdmin
      .from("onboarding_workflows")
      .update({
        current_state: plan.next,
        status: plan.next === "activated" ? "completed" : "active",
        state_history: [
          ...history,
          { state: plan.next, at: new Date().toISOString(), by: userId },
        ] as never,
      })
      .eq("id", wf.id);

    await audit(supabase, {
      actor_user_id: userId,
      tenant_id: wf.tenant_id,
      action: "workflow.advance",
      subject_type: wf.subject_type,
      subject_id: wf.subject_id,
      decision: "allow",
      metadata: { from: wf.current_state, to: plan.next },
    });
    return { ok: true, state: plan.next };
  });

/* ------------------------------------------- contact verification shell */

export const startContactVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { channel: ContactChannel; target: string }) => {
    if (!input.channel || !input.target) throw new Error("invalid_input");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!isValidContactTarget(data.channel, data.target)) throw new Error("invalid_target");

    const { audit, contactProvider } = await import("@/lib/atap/admin.server");
    const provider = contactProvider();
    const challenge = await provider.start({ channel: data.channel, target: data.target.trim() });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("contact_verifications")
      .insert({
        user_id: userId,
        channel: data.channel,
        target: data.target.trim(),
        provider: challenge.provider,
        provider_ref: challenge.providerRef,
        code_hash: challenge.codeHash,
        expires_at: challenge.expiresAt,
      })
      .select("id")
      .single();
    if (error || !row) throw new Error("verification_start_failed");

    await audit(supabase, {
      actor_user_id: userId,
      action: "contact.verification.start",
      subject_type: "user",
      subject_id: userId,
      decision: "allow",
      metadata: { channel: data.channel, provider: challenge.provider },
    });
    return { ok: true, verificationId: row.id, provider: challenge.provider };
  });

export const confirmContactVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { verificationId: string; code: string }) => {
    if (!input.verificationId || !input.code) throw new Error("invalid_input");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { audit, contactProvider } = await import("@/lib/atap/admin.server");
    const { canAttemptContactVerification } = await import("@/lib/atap/identity");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: row } = await supabaseAdmin
      .from("contact_verifications")
      .select("id, user_id, status, attempts, expires_at, provider_ref, code_hash")
      .eq("id", data.verificationId)
      .maybeSingle();
    if (!row || row.user_id !== userId) throw new Error("Forbidden");
    if (!canAttemptContactVerification(row)) throw new Error("verification_unavailable");

    const ok = await contactProvider().check(row.provider_ref ?? "", data.code, row.code_hash ?? "");
    await supabaseAdmin
      .from("contact_verifications")
      .update({
        attempts: row.attempts + 1,
        status: ok ? "verified" : "pending",
        verified_at: ok ? new Date().toISOString() : null,
      })
      .eq("id", row.id);

    await audit(supabase, {
      actor_user_id: userId,
      action: "contact.verification.confirm",
      subject_type: "user",
      subject_id: userId,
      decision: ok ? "allow" : "deny",
      metadata: { verification_id: row.id },
    });
    return { ok };
  });

/* ------------------------------------------------------ terms acceptance */

export const recordTermsAcceptance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { termsCode: string; version: string }) => {
    if (!input.termsCode || !input.version) throw new Error("invalid_input");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { audit } = await import("@/lib/atap/admin.server");
    await supabase
      .from("terms_acceptances")
      .insert({ user_id: userId, terms_code: data.termsCode, version: data.version });
    await audit(supabase, {
      actor_user_id: userId,
      action: "terms.accept",
      subject_type: "user",
      subject_id: userId,
      decision: "allow",
      metadata: { terms_code: data.termsCode, version: data.version },
    });
    return { ok: true };
  });

/* --------------------------------------------------- privileged workflow */

export const requestPrivilegedAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { requestedRole: AppRole; justification: string }) => {
    if (!input.requestedRole || !input.justification?.trim()) throw new Error("invalid_input");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { audit } = await import("@/lib/atap/admin.server");
    const { data: row, error } = await supabase
      .from("privileged_access_requests")
      .insert({
        requester_user_id: userId,
        requested_role: data.requestedRole,
        justification: data.justification.trim(),
      })
      .select("id")
      .single();
    if (error || !row) throw new Error("privilege_request_failed");

    await audit(supabase, {
      actor_user_id: userId,
      action: "privilege.request",
      subject_type: "user",
      subject_id: userId,
      decision: "allow",
      metadata: { requested_role: data.requestedRole },
    });
    return { ok: true, requestId: row.id };
  });

export const decidePrivilegedAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { requestId: string; approve: boolean; mfaVerified?: boolean; hours?: number }) => {
      if (!input.requestId) throw new Error("invalid_input");
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { audit, resolveActor } = await import("@/lib/atap/admin.server");
    const actor = await resolveActor(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: row } = await supabaseAdmin
      .from("privileged_access_requests")
      .select("id, requester_user_id, requested_role, status, mfa_verified, expires_at")
      .eq("id", data.requestId)
      .maybeSingle();
    if (!row) throw new Error("request_not_found");

    if (!canApprovePrivilegeRequest(row as never, userId, actor.isPlatformAdmin)) {
      await audit(supabase, {
        actor_user_id: userId,
        action: "privilege.decide",
        subject_type: "user",
        subject_id: row.requester_user_id,
        decision: "deny",
        metadata: { reason: "not_authorized_or_self_approval", request_id: row.id },
      });
      throw new Error("Forbidden");
    }

    const hours = Math.min(Math.max(data.hours ?? 4, 1), 24);
    await supabaseAdmin
      .from("privileged_access_requests")
      .update({
        status: data.approve ? "approved" : "denied",
        // MFA confirmation comes from the (unresolved) MFA provider adapter.
        mfa_verified: data.approve ? Boolean(data.mfaVerified) : false,
        approved_by: userId,
        approved_at: new Date().toISOString(),
        expires_at: data.approve ? new Date(Date.now() + hours * 3_600_000).toISOString() : null,
      })
      .eq("id", row.id);

    await audit(supabase, {
      actor_user_id: userId,
      action: "privilege.decide",
      subject_type: "user",
      subject_id: row.requester_user_id,
      decision: "allow",
      metadata: {
        request_id: row.id,
        approved: data.approve,
        mfa_verified: Boolean(data.mfaVerified),
        role: row.requested_role,
      },
    });
    return { ok: true };
  });

/* ------------------------------------------------------ commercial plans */

/**
 * Entitlements are commercial only. This handler writes nothing to
 * `user_roles` or `consent_grants` — by design and asserted by tests.
 */
export const setTenantEntitlement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string; planCode: string; features?: Record<string, unknown> }) => {
    if (!input.tenantId || !input.planCode) throw new Error("invalid_input");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { audit, resolveActor } = await import("@/lib/atap/admin.server");
    const actor = await resolveActor(supabase, userId);
    if (!actor.isPlatformAdmin) {
      await audit(supabase, {
        actor_user_id: userId,
        tenant_id: data.tenantId,
        action: "entitlement.set",
        subject_type: "tenant",
        subject_id: data.tenantId,
        decision: "deny",
        metadata: { reason: "not_authorized" },
      });
      throw new Error("Forbidden");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("tenant_entitlements").upsert(
      {
        tenant_id: data.tenantId,
        plan_code: data.planCode,
        features: (data.features ?? {}) as never,
        status: "active",
      },
      { onConflict: "tenant_id,plan_code" },
    );

    await audit(supabase, {
      actor_user_id: userId,
      tenant_id: data.tenantId,
      action: "entitlement.set",
      subject_type: "tenant",
      subject_id: data.tenantId,
      decision: "allow",
      metadata: { plan_code: data.planCode, roles_changed: false, consent_changed: false },
    });
    return { ok: true };
  });

/* --------------------------------------------------- consent evaluation */

/** Consent-policy service skeleton: plan only, no broad partner access in B1. */
export const previewConsentGrant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { policyCode: string; scope?: string[]; durationDays: number }) => {
    if (!input.policyCode || !input.durationDays) throw new Error("invalid_input");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: policies } = await supabase.from("consent_policies").select("*");
    const plan = planConsentGrant(
      ((policies ?? []) as Array<{ scope_template: unknown }>).map((p) => ({
        ...(p as unknown as Record<string, never>),
        scope_template: Array.isArray(p.scope_template) ? (p.scope_template as string[]) : [],
      })) as never,
      { policyCode: data.policyCode, requestedScope: data.scope ?? [], durationDays: data.durationDays },
    );
    const { audit } = await import("@/lib/atap/admin.server");
    await audit(supabase, {
      actor_user_id: userId,
      action: "consent.preview",
      subject_type: "consent_policy",
      subject_id: data.policyCode,
      decision: plan.ok ? "allow" : "deny",
      metadata: plan.ok ? { scope: plan.scope } : { reason: plan.reason },
    });
    return plan;
  });
