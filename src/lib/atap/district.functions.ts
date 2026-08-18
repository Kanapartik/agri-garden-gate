/**
 * B3 FPO & government district MVP server functions.
 *
 * Every handler re-checks authority server-side. Route hiding and disabled
 * buttons are presentation only.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  checkInviteAcceptance,
  checkStaffInvite,
  canManageRoster,
  canReadRoster,
  checklistsForRoles,
  delegatedPurchasingAllowed,
  evaluateSchemeRules,
  invitableRoles,
  planApplicationTransition,
  planMemberImport,
  planSchemeVersion,
  prefillFromFarmProfile,
  rolloutReadiness,
  trainingProgress,
  type MemberRowError,
  type MemberStatus,
  type RolloutChecklistItem,
  type SchemeApplicationStatus,
  type SchemeEvaluation,
  type SchemeRule,
  type TrainingProgress,
} from "@/lib/atap/district";
import type { FieldDef, FlagDef, FormValues } from "@/lib/atap/onboarding";
import type { AppRole, TenantType } from "@/lib/atap/policy";

/* ------------------------------------------------------------------ types */

export interface TenantSummary {
  id: string;
  name: string;
  tenant_type: TenantType;
  roles: AppRole[];
  invitableRoles: AppRole[];
}

export interface InviteRow {
  id: string;
  tenant_id: string;
  invited_email: string;
  invited_role: AppRole;
  status: "pending" | "accepted" | "revoked" | "expired";
  expires_at: string;
  created_at: string;
  note: string | null;
}

export interface MemberRow {
  id: string;
  tenant_id: string;
  member_ref: string;
  display_name: string;
  village_code: string | null;
  contact_hint: string | null;
  status: MemberStatus;
  farmer_user_id: string | null;
  created_at: string;
}

export interface BatchRow {
  id: string;
  tenant_id: string;
  source_label: string;
  row_count: number;
  accepted_count: number;
  rejected_count: number;
  errors: MemberRowError[];
  created_at: string;
}

export interface FpoWorkspace {
  userId: string;
  tenants: TenantSummary[];
  invites: InviteRow[];
  members: MemberRow[];
  batches: BatchRow[];
  training: TrainingProgress[];
  delegatedPurchasingEnabled: boolean;
  flags: FlagDef[];
}

export interface SchemeVersionRow {
  id: string;
  scheme_id: string;
  version: number;
  rules: SchemeRule[];
  form_fields: FieldDef[];
  changelog: string;
  published_at: string | null;
  created_at: string;
}

export interface SchemeRow {
  id: string;
  tenant_id: string;
  code: string;
  title: string;
  summary: string;
  status: "draft" | "published" | "closed";
  current_version: number;
  requires_human_decision: boolean;
  created_at: string;
}

export interface ApplicationRow {
  id: string;
  scheme_id: string;
  scheme_version: number;
  applicant_user_id: string;
  status: SchemeApplicationStatus;
  prefill_source: string;
  prefill_consent_ok: boolean;
  form_data: FormValues;
  rule_evaluation: SchemeEvaluation | Record<string, never>;
  decision_note: string | null;
  decided_at: string | null;
  reviewer_user_id: string | null;
  created_at: string;
}

export interface GovtWorkspace {
  userId: string;
  tenants: TenantSummary[];
  canPublish: boolean;
  canReview: boolean;
  schemes: SchemeRow[];
  versions: SchemeVersionRow[];
  queue: ApplicationRow[];
  training: TrainingProgress[];
}

export interface SchemeDiscovery {
  userId: string;
  schemes: Array<SchemeRow & { version: SchemeVersionRow | null }>;
  applications: ApplicationRow[];
  prefillAvailable: boolean;
  prefillBlockedReason: string | null;
  prefillValues: FormValues;
}

export interface RolloutConfig {
  delegated_purchasing?: boolean;
  district_code?: string;
  assisted_channels?: string[];
}

export interface RolloutRow {
  id: string;
  label: string;
  template_code: string;
  status: "planned" | "configuring" | "piloting" | "live" | "paused";
  checklist: RolloutChecklistItem[];
  config: RolloutConfig;
  geography: { code: string; name: string; level: string } | null;
  readiness: ReturnType<typeof rolloutReadiness>;
  memberCount: number;
  applicationCount: number;
  decidedCount: number;
}

/* -------------------------------------------------------- FPO workspace */

export const getFpoWorkspace = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<FpoWorkspace> => {
    const { supabase, userId } = context;
    const { resolveDistrictActor } = await import("@/lib/atap/district.server");
    const { atapEnv, fetchScaffoldRows } = await import("@/lib/atap/onboarding.server");

    const actor = await resolveDistrictActor(supabase, userId);
    const [{ flags }, { data: tenantRows }, { data: invites }, { data: members }, { data: batches }, { data: completions }] =
      await Promise.all([
        fetchScaffoldRows(),
        supabase.from("tenants").select("id, name, tenant_type"),
        supabase
          .from("tenant_invitations")
          .select("id, tenant_id, invited_email, invited_role, status, expires_at, created_at, note")
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("fpo_members")
          .select(
            "id, tenant_id, member_ref, display_name, village_code, contact_hint, status, farmer_user_id, created_at",
          )
          .order("created_at", { ascending: false })
          .limit(300),
        supabase
          .from("member_import_batches")
          .select("id, tenant_id, source_label, row_count, accepted_count, rejected_count, errors, created_at")
          .order("created_at", { ascending: false })
          .limit(25),
        supabase.from("training_completions").select("checklist_code, item_key").eq("user_id", userId),
      ]);

    const visibleTenantIds = actor.isPlatformAdmin || actor.isAuditor
      ? (tenantRows ?? []).map((t) => t.id)
      : actor.tenantIds;

    const tenants: TenantSummary[] = (tenantRows ?? [])
      .filter((t) => visibleTenantIds.includes(t.id))
      .map((t) => ({
        id: t.id,
        name: t.name,
        tenant_type: t.tenant_type as TenantType,
        roles: actor.tenantRoles.filter((r) => r.tenant_id === t.id).map((r) => r.role),
        invitableRoles: [...invitableRoles(t.tenant_type as TenantType)],
      }));

    const done = (completions ?? []) as Array<{ checklist_code: string; item_key: string }>;
    const roles = actor.tenantRoles.map((r) => r.role);
    const training = checklistsForRoles(roles).map((c) =>
      trainingProgress(
        c,
        done.filter((d) => d.checklist_code === c.code).map((d) => d.item_key),
      ),
    );

    return {
      userId,
      tenants,
      invites: (invites ?? []) as InviteRow[],
      members: (members ?? []) as MemberRow[],
      batches: (batches ?? []) as unknown as BatchRow[],
      training,
      // D-08 unvalidated: this is expected to stay false.
      delegatedPurchasingEnabled: delegatedPurchasingAllowed(flags, atapEnv()),
      flags,
    };
  });

export const inviteStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string; email: string; role: AppRole; note?: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { resolveDistrictActor, inviteTokenHash, tenantTypeOf } = await import(
      "@/lib/atap/district.server"
    );
    const { audit } = await import("@/lib/atap/admin.server");

    const [actor, tenant] = await Promise.all([
      resolveDistrictActor(supabase, userId),
      tenantTypeOf(supabase, data.tenantId),
    ]);
    if (!tenant) throw new Error("tenant_not_found");

    const check = checkStaffInvite(
      data.role,
      data.tenantId,
      tenant.tenant_type as TenantType,
      data.email,
      actor,
    );
    if (!check.ok) {
      await audit(supabase, {
        actor_user_id: userId,
        tenant_id: data.tenantId,
        action: "tenant.invite.create",
        subject_type: "tenant",
        subject_id: data.tenantId,
        decision: "deny",
        metadata: { reason: check.reason, role: data.role },
      });
      throw new Error(check.reason);
    }

    const nonce = crypto.randomUUID();
    const { data: row, error } = await supabase
      .from("tenant_invitations")
      .insert({
        tenant_id: data.tenantId,
        invited_email: data.email.trim().toLowerCase(),
        invited_role: data.role,
        token_hash: await inviteTokenHash(data.tenantId, data.email, nonce),
        invited_by: userId,
        note: data.note?.slice(0, 300) ?? null,
      } as never)
      .select("id")
      .single();
    if (error) throw new Error("invite_write_failed");

    await audit(supabase, {
      actor_user_id: userId,
      tenant_id: data.tenantId,
      action: "tenant.invite.create",
      subject_type: "tenant_invitation",
      subject_id: row.id,
      decision: "allow",
      metadata: { role: data.role, email_domain: data.email.split("@")[1] ?? null },
    });
    return { id: row.id as string };
  });

export const revokeInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { inviteId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { resolveDistrictActor } = await import("@/lib/atap/district.server");
    const { audit } = await import("@/lib/atap/admin.server");

    const { data: invite } = await supabase
      .from("tenant_invitations")
      .select("id, tenant_id, status")
      .eq("id", data.inviteId)
      .maybeSingle();
    if (!invite) throw new Error("invite_not_found");

    const actor = await resolveDistrictActor(supabase, userId);
    if (!actor.isPlatformAdmin && !actor.tenantAdminOf.includes(invite.tenant_id)) {
      await audit(supabase, {
        actor_user_id: userId,
        tenant_id: invite.tenant_id,
        action: "tenant.invite.revoke",
        subject_type: "tenant_invitation",
        subject_id: invite.id,
        decision: "deny",
        metadata: { reason: "not_authorized" },
      });
      throw new Error("not_authorized");
    }

    const { error } = await supabase
      .from("tenant_invitations")
      .update({ status: "revoked" } as never)
      .eq("id", invite.id);
    if (error) throw new Error("invite_write_failed");

    await audit(supabase, {
      actor_user_id: userId,
      tenant_id: invite.tenant_id,
      action: "tenant.invite.revoke",
      subject_type: "tenant_invitation",
      subject_id: invite.id,
      decision: "allow",
      metadata: {},
    });
    return { ok: true };
  });

/**
 * Accepting an invitation is the only path where a scoped role is granted from
 * a delegation. Privileged platform roles are structurally excluded by
 * `checkStaffInvite`, and the grant itself is audited.
 */
export const acceptInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { inviteId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { currentUserEmail } = await import("@/lib/atap/district.server");
    const { audit } = await import("@/lib/atap/admin.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const email = await currentUserEmail(supabase);
    if (!email) throw new Error("email_unavailable");

    const { data: invite } = await supabaseAdmin
      .from("tenant_invitations")
      .select("id, tenant_id, invited_email, invited_role, status, expires_at")
      .eq("id", data.inviteId)
      .maybeSingle();
    if (!invite) throw new Error("invite_not_found");

    const check = checkInviteAcceptance(
      {
        status: invite.status as "pending",
        invited_email: invite.invited_email,
        expires_at: invite.expires_at,
      },
      email,
    );
    if (!check.ok) {
      await audit(supabase, {
        actor_user_id: userId,
        tenant_id: invite.tenant_id,
        action: "tenant.invite.accept",
        subject_type: "tenant_invitation",
        subject_id: invite.id,
        decision: "deny",
        metadata: { reason: check.reason },
      });
      throw new Error(check.reason);
    }

    await supabaseAdmin
      .from("tenant_members")
      .upsert(
        { tenant_id: invite.tenant_id, user_id: userId, status: "active" } as never,
        { onConflict: "tenant_id,user_id" },
      );
    await supabaseAdmin.from("user_roles").upsert(
      {
        user_id: userId,
        tenant_id: invite.tenant_id,
        role: invite.invited_role,
        granted_by: userId,
      } as never,
      { onConflict: "user_id,role,tenant_id" },
    );
    await supabaseAdmin
      .from("tenant_invitations")
      .update({ status: "accepted", accepted_by: userId, accepted_at: new Date().toISOString() } as never)
      .eq("id", invite.id);

    await audit(supabase, {
      actor_user_id: userId,
      tenant_id: invite.tenant_id,
      action: "role.grant.via_invitation",
      subject_type: "user",
      subject_id: userId,
      decision: "allow",
      metadata: { role: invite.invited_role, invitation_id: invite.id },
    });
    return { ok: true, role: invite.invited_role as AppRole };
  });

/* ------------------------------------------------------- member roster */

export const importMembers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string; sourceLabel: string; rows: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { resolveDistrictActor } = await import("@/lib/atap/district.server");
    const { audit } = await import("@/lib/atap/admin.server");

    const actor = await resolveDistrictActor(supabase, userId);
    if (!canManageRoster(actor, data.tenantId)) {
      await audit(supabase, {
        actor_user_id: userId,
        tenant_id: data.tenantId,
        action: "fpo.members.import",
        subject_type: "tenant",
        subject_id: data.tenantId,
        decision: "deny",
        metadata: { reason: "not_authorized" },
      });
      throw new Error("not_authorized");
    }

    const { data: existing } = await supabase
      .from("fpo_members")
      .select("member_ref")
      .eq("tenant_id", data.tenantId);
    const plan = planMemberImport(
      data.rows,
      (existing ?? []).map((e) => e.member_ref),
    );

    const { data: batch, error: batchError } = await supabase
      .from("member_import_batches")
      .insert({
        tenant_id: data.tenantId,
        uploaded_by: userId,
        source_label: data.sourceLabel.slice(0, 120) || "manual paste",
        row_count: plan.rowCount,
        accepted_count: plan.accepted.length,
        rejected_count: plan.errors.length,
        errors: plan.errors,
      } as never)
      .select("id")
      .single();
    if (batchError) throw new Error("batch_write_failed");

    if (plan.accepted.length > 0) {
      const { error } = await supabase.from("fpo_members").insert(
        plan.accepted.map((row) => ({
          tenant_id: data.tenantId,
          member_ref: row.member_ref,
          display_name: row.display_name,
          village_code: row.village_code,
          contact_hint: row.contact_hint,
          status: "invited",
          import_batch_id: batch.id,
          added_by: userId,
        })) as never,
      );
      if (error) throw new Error("member_write_failed");
    }

    await audit(supabase, {
      actor_user_id: userId,
      tenant_id: data.tenantId,
      action: "fpo.members.import",
      subject_type: "member_import_batch",
      subject_id: batch.id,
      decision: "allow",
      metadata: {
        rows: plan.rowCount,
        accepted: plan.accepted.length,
        rejected: plan.errors.length,
      },
    });

    return {
      batchId: batch.id as string,
      accepted: plan.accepted.length,
      rejected: plan.errors.length,
      errors: plan.errors,
    };
  });

export const setMemberStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { memberId: string; status: MemberStatus }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { resolveDistrictActor } = await import("@/lib/atap/district.server");
    const { audit } = await import("@/lib/atap/admin.server");

    const { data: member } = await supabase
      .from("fpo_members")
      .select("id, tenant_id, status")
      .eq("id", data.memberId)
      .maybeSingle();
    if (!member) throw new Error("member_not_found");

    const actor = await resolveDistrictActor(supabase, userId);
    if (!canManageRoster(actor, member.tenant_id)) {
      await audit(supabase, {
        actor_user_id: userId,
        tenant_id: member.tenant_id,
        action: "fpo.member.status",
        subject_type: "fpo_member",
        subject_id: member.id,
        decision: "deny",
        metadata: { reason: "not_authorized" },
      });
      throw new Error("not_authorized");
    }

    const { error } = await supabase
      .from("fpo_members")
      .update({ status: data.status } as never)
      .eq("id", member.id);
    if (error) throw new Error("member_write_failed");

    await audit(supabase, {
      actor_user_id: userId,
      tenant_id: member.tenant_id,
      action: "fpo.member.status",
      subject_type: "fpo_member",
      subject_id: member.id,
      decision: "allow",
      metadata: { from: member.status, to: data.status },
    });
    return { ok: true };
  });

/* ------------------------------------------------- government workspace */

export const getGovtWorkspace = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<GovtWorkspace> => {
    const { supabase, userId } = context;
    const { resolveDistrictActor } = await import("@/lib/atap/district.server");

    const actor = await resolveDistrictActor(supabase, userId);
    const [{ data: tenantRows }, { data: schemes }, { data: versions }, { data: queue }, { data: completions }] =
      await Promise.all([
        supabase.from("tenants").select("id, name, tenant_type"),
        supabase
          .from("schemes")
          .select(
            "id, tenant_id, code, title, summary, status, current_version, requires_human_decision, created_at",
          )
          .order("created_at", { ascending: false }),
        supabase
          .from("scheme_versions")
          .select("id, scheme_id, version, rules, form_fields, changelog, published_at, created_at")
          .order("version", { ascending: false }),
        supabase
          .from("scheme_applications")
          .select(
            "id, scheme_id, scheme_version, applicant_user_id, status, prefill_source, prefill_consent_ok, form_data, rule_evaluation, decision_note, decided_at, reviewer_user_id, created_at",
          )
          .order("created_at", { ascending: false })
          .limit(200),
        supabase.from("training_completions").select("checklist_code, item_key").eq("user_id", userId),
      ]);

    const visible = actor.isPlatformAdmin || actor.isAuditor
      ? (tenantRows ?? []).map((t) => t.id)
      : actor.tenantIds;
    const tenants: TenantSummary[] = (tenantRows ?? [])
      .filter((t) => visible.includes(t.id) && t.tenant_type === "govt_dept")
      .map((t) => ({
        id: t.id,
        name: t.name,
        tenant_type: t.tenant_type as TenantType,
        roles: actor.tenantRoles.filter((r) => r.tenant_id === t.id).map((r) => r.role),
        invitableRoles: [...invitableRoles(t.tenant_type as TenantType)],
      }));

    const done = (completions ?? []) as Array<{ checklist_code: string; item_key: string }>;
    const training = checklistsForRoles(actor.tenantRoles.map((r) => r.role)).map((c) =>
      trainingProgress(
        c,
        done.filter((d) => d.checklist_code === c.code).map((d) => d.item_key),
      ),
    );

    return {
      userId,
      tenants,
      canPublish: actor.isPlatformAdmin || actor.schemePublisherOf.length > 0,
      canReview: actor.isPlatformAdmin || actor.schemeReviewerOf.length > 0,
      schemes: (schemes ?? []) as SchemeRow[],
      versions: (versions ?? []) as unknown as SchemeVersionRow[],
      // RLS already restricts this to the publishing department's reviewers.
      queue: ((queue ?? []) as ApplicationRow[]).filter((a) => a.applicant_user_id !== userId),
      training,
    };
  });

export const createScheme = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      tenantId: string;
      code: string;
      title: string;
      summary: string;
      geographyId?: string | null;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { resolveDistrictActor } = await import("@/lib/atap/district.server");
    const { audit } = await import("@/lib/atap/admin.server");

    const actor = await resolveDistrictActor(supabase, userId);
    const authorized = actor.isPlatformAdmin || actor.schemePublisherOf.includes(data.tenantId);
    if (!authorized) {
      await audit(supabase, {
        actor_user_id: userId,
        tenant_id: data.tenantId,
        action: "scheme.create",
        subject_type: "tenant",
        subject_id: data.tenantId,
        decision: "deny",
        metadata: { reason: "not_authorized" },
      });
      throw new Error("not_authorized");
    }
    const code = data.code.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "-").slice(0, 60);
    if (code.length < 3 || data.title.trim().length < 3 || data.summary.trim().length < 10) {
      throw new Error("scheme_fields_invalid");
    }

    const { data: row, error } = await supabase
      .from("schemes")
      .insert({
        tenant_id: data.tenantId,
        code,
        title: data.title.trim().slice(0, 160),
        summary: data.summary.trim().slice(0, 600),
        geography_id: data.geographyId ?? null,
        created_by: userId,
      } as never)
      .select("id")
      .single();
    if (error) throw new Error("scheme_write_failed");

    await audit(supabase, {
      actor_user_id: userId,
      tenant_id: data.tenantId,
      action: "scheme.create",
      subject_type: "scheme",
      subject_id: row.id,
      decision: "allow",
      metadata: { code },
    });
    return { id: row.id as string };
  });

/** Rule changes never mutate a published version; they create the next one. */
export const publishSchemeVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      schemeId: string;
      rules: SchemeRule[];
      formFields: FieldDef[];
      changelog: string;
      publish: boolean;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { resolveDistrictActor } = await import("@/lib/atap/district.server");
    const { audit } = await import("@/lib/atap/admin.server");

    const { data: scheme } = await supabase
      .from("schemes")
      .select("id, tenant_id, status, current_version")
      .eq("id", data.schemeId)
      .maybeSingle();
    if (!scheme) throw new Error("scheme_not_found");

    const actor = await resolveDistrictActor(supabase, userId);
    const plan = planSchemeVersion(
      {
        tenantId: scheme.tenant_id,
        schemeStatus: scheme.status as "draft",
        currentVersion: scheme.current_version,
        rules: data.rules,
        changelog: data.changelog,
      },
      actor,
    );
    if (!plan.ok) {
      await audit(supabase, {
        actor_user_id: userId,
        tenant_id: scheme.tenant_id,
        action: "scheme.version.publish",
        subject_type: "scheme",
        subject_id: scheme.id,
        decision: "deny",
        metadata: { reason: plan.reason },
      });
      throw new Error(plan.reason);
    }

    const publishedAt = data.publish ? new Date().toISOString() : null;
    const { error: versionError } = await supabase.from("scheme_versions").insert({
      scheme_id: scheme.id,
      version: plan.plan.version,
      rules: data.rules,
      form_fields: data.formFields,
      changelog: plan.plan.changelog,
      created_by: userId,
      published_at: publishedAt,
    } as never);
    if (versionError) throw new Error("version_write_failed");

    const { error: schemeError } = await supabase
      .from("schemes")
      .update({
        current_version: plan.plan.version,
        status: data.publish ? "published" : scheme.status,
      } as never)
      .eq("id", scheme.id);
    if (schemeError) throw new Error("scheme_write_failed");

    await audit(supabase, {
      actor_user_id: userId,
      tenant_id: scheme.tenant_id,
      action: "scheme.version.publish",
      subject_type: "scheme",
      subject_id: scheme.id,
      decision: "allow",
      metadata: {
        version: plan.plan.version,
        published: data.publish,
        changelog: plan.plan.changelog,
        rule_keys: data.rules.map((r) => r.key),
      },
    });
    return { version: plan.plan.version };
  });

export const decideSchemeApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { applicationId: string; next: SchemeApplicationStatus; note: string }) => input,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { resolveDistrictActor } = await import("@/lib/atap/district.server");
    const { audit } = await import("@/lib/atap/admin.server");

    const { data: application } = await supabase
      .from("scheme_applications")
      .select("id, scheme_id, status, applicant_user_id, scheme_version")
      .eq("id", data.applicationId)
      .maybeSingle();
    if (!application) throw new Error("application_not_found");

    const { data: scheme } = await supabase
      .from("schemes")
      .select("id, tenant_id")
      .eq("id", application.scheme_id)
      .maybeSingle();
    if (!scheme) throw new Error("scheme_not_found");

    const actor = await resolveDistrictActor(supabase, userId);
    const plan = planApplicationTransition({
      current: application.status as SchemeApplicationStatus,
      next: data.next,
      schemeTenantId: scheme.tenant_id,
      applicantUserId: application.applicant_user_id,
      decisionNote: data.note,
      actor,
    });
    if (!plan.ok) {
      await audit(supabase, {
        actor_user_id: userId,
        tenant_id: scheme.tenant_id,
        action: "scheme.application.decide",
        subject_type: "scheme_application",
        subject_id: application.id,
        decision: "deny",
        metadata: { reason: plan.reason, requested: data.next },
      });
      throw new Error(plan.reason);
    }

    const decided = plan.next === "approved" || plan.next === "rejected";
    const { error } = await supabase
      .from("scheme_applications")
      .update({
        status: plan.next,
        reviewer_user_id: userId,
        decision_note: data.note.trim().slice(0, 800) || null,
        decided_at: decided ? new Date().toISOString() : null,
      } as never)
      .eq("id", application.id);
    if (error) throw new Error("application_write_failed");

    await audit(supabase, {
      actor_user_id: userId,
      tenant_id: scheme.tenant_id,
      action: "scheme.application.decide",
      subject_type: "scheme_application",
      subject_id: application.id,
      purpose_code: "scheme_eligibility",
      decision: "allow",
      metadata: {
        from: application.status,
        to: plan.next,
        scheme_version: application.scheme_version,
        decided_by_human: true,
        note: data.note.trim().slice(0, 300),
      },
    });
    return { ok: true, status: plan.next };
  });

/* -------------------------------------------- farmer scheme discovery */

export const getSchemeDiscovery = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SchemeDiscovery> => {
    const { supabase, userId } = context;
    const { baselinePolicyVersion } = await import("@/lib/atap/farmer.server");
    const { baselineConsentActive } = await import("@/lib/atap/farmer");

    const [{ data: schemes }, { data: versions }, { data: applications }, { data: consents }, { data: farms }] =
      await Promise.all([
        supabase
          .from("schemes")
          .select(
            "id, tenant_id, code, title, summary, status, current_version, requires_human_decision, created_at",
          )
          .eq("status", "published"),
        supabase
          .from("scheme_versions")
          .select("id, scheme_id, version, rules, form_fields, changelog, published_at, created_at")
          .not("published_at", "is", null),
        supabase
          .from("scheme_applications")
          .select(
            "id, scheme_id, scheme_version, applicant_user_id, status, prefill_source, prefill_consent_ok, form_data, rule_evaluation, decision_note, decided_at, reviewer_user_id, created_at",
          )
          .eq("applicant_user_id", userId)
          .order("created_at", { ascending: false }),
        supabase.from("baseline_consents").select("policy_version, revoked_at").eq("subject_user_id", userId),
        supabase
          .from("farm_records")
          .select("label, plot_ref, village_code, primary_crop, area_acres, updated_at")
          .eq("farmer_user_id", userId)
          .order("updated_at", { ascending: false })
          .limit(1),
      ]);

    const version = await baselinePolicyVersion(supabase);
    const consentOk = baselineConsentActive((consents ?? []) as never, version);
    const prefill = prefillFromFarmProfile((farms ?? [])[0] ?? null, consentOk);
    const versionRows = (versions ?? []) as unknown as SchemeVersionRow[];

    return {
      userId,
      schemes: ((schemes ?? []) as SchemeRow[]).map((s) => ({
        ...s,
        version:
          versionRows.find((v) => v.scheme_id === s.id && v.version === s.current_version) ?? null,
      })),
      applications: (applications ?? []) as ApplicationRow[],
      prefillAvailable: prefill.source === "consented_farm_profile",
      prefillBlockedReason: prefill.blockedReason,
      prefillValues: prefill.values,
    };
  });

export const submitSchemeApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { schemeId: string; values: FormValues; usedPrefill: boolean }) => input,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { audit } = await import("@/lib/atap/admin.server");
    const { baselinePolicyVersion } = await import("@/lib/atap/farmer.server");
    const { baselineConsentActive } = await import("@/lib/atap/farmer");

    const { data: scheme } = await supabase
      .from("schemes")
      .select("id, tenant_id, status, current_version")
      .eq("id", data.schemeId)
      .maybeSingle();
    if (!scheme || scheme.status !== "published") throw new Error("scheme_not_open");

    const { data: version } = await supabase
      .from("scheme_versions")
      .select("version, rules")
      .eq("scheme_id", scheme.id)
      .eq("version", scheme.current_version)
      .maybeSingle();
    if (!version) throw new Error("scheme_version_missing");

    const { data: consents } = await supabase
      .from("baseline_consents")
      .select("policy_version, revoked_at")
      .eq("subject_user_id", userId);
    const consentOk = baselineConsentActive(
      (consents ?? []) as never,
      await baselinePolicyVersion(supabase),
    );
    if (data.usedPrefill && !consentOk) throw new Error("baseline_consent_missing");

    // Rule output is a recommendation. The reviewer decides.
    const evaluation = evaluateSchemeRules((version.rules ?? []) as unknown as SchemeRule[], data.values);

    const { data: row, error } = await supabase
      .from("scheme_applications")
      .insert({
        scheme_id: scheme.id,
        scheme_version: version.version,
        applicant_user_id: userId,
        prefill_source: data.usedPrefill ? "consented_farm_profile" : "none",
        prefill_consent_ok: data.usedPrefill && consentOk,
        form_data: data.values,
        rule_evaluation: evaluation,
        status: "submitted",
      } as never)
      .select("id")
      .single();
    if (error) throw new Error("application_write_failed");

    await audit(supabase, {
      actor_user_id: userId,
      tenant_id: scheme.tenant_id,
      action: "scheme.application.submit",
      subject_type: "scheme_application",
      subject_id: row.id,
      purpose_code: "scheme_eligibility",
      decision: "allow",
      metadata: {
        scheme_version: version.version,
        recommendation: evaluation.recommendation,
        prefill: data.usedPrefill,
      },
    });
    return { id: row.id as string, evaluation };
  });

/* ------------------------------------------------------ district rollout */

export const getDistrictRollouts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ rollouts: RolloutRow[] }> => {
    const { supabase } = context;
    const [{ data: rows }, { data: members }, { data: applications }] = await Promise.all([
      supabase
        .from("district_rollouts")
        .select(
          "id, label, template_code, status, checklist, config, govt_tenant_id, fpo_tenant_id, geographies(code, name, level)",
        ),
      supabase.from("fpo_members").select("id, tenant_id"),
      supabase.from("scheme_applications").select("id, status, submitted_via_tenant_id"),
    ]);

    const apps = (applications ?? []) as Array<{ status: string }>;
    const rollouts = ((rows ?? []) as never[]).map((raw) => {
      const row = raw as {
        id: string;
        label: string;
        template_code: string;
        status: RolloutRow["status"];
        checklist: RolloutChecklistItem[];
        config: RolloutConfig;
        fpo_tenant_id: string | null;
        geographies: { code: string; name: string; level: string } | null;
      };
      return {
        id: row.id,
        label: row.label,
        template_code: row.template_code,
        status: row.status,
        checklist: row.checklist ?? [],
        config: row.config ?? {},
        geography: row.geographies,
        readiness: rolloutReadiness(row.checklist ?? []),
        memberCount: ((members ?? []) as Array<{ tenant_id: string }>).filter(
          (m) => m.tenant_id === row.fpo_tenant_id,
        ).length,
        applicationCount: apps.length,
        decidedCount: apps.filter((a) => a.status === "approved" || a.status === "rejected").length,
      } satisfies RolloutRow;
    });

    return { rollouts };
  });

export const setRolloutChecklistItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { rolloutId: string; itemKey: string; done: boolean }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { resolveDistrictActor } = await import("@/lib/atap/district.server");
    const { audit } = await import("@/lib/atap/admin.server");

    const actor = await resolveDistrictActor(supabase, userId);
    if (!actor.isPlatformAdmin) {
      await audit(supabase, {
        actor_user_id: userId,
        action: "district.rollout.update",
        subject_type: "district_rollout",
        subject_id: data.rolloutId,
        decision: "deny",
        metadata: { reason: "not_authorized" },
      });
      throw new Error("not_authorized");
    }

    const { data: row } = await supabase
      .from("district_rollouts")
      .select("id, checklist")
      .eq("id", data.rolloutId)
      .maybeSingle();
    if (!row) throw new Error("rollout_not_found");

    const checklist = ((row.checklist ?? []) as unknown as RolloutChecklistItem[]).map((item) =>
      item.key === data.itemKey ? { ...item, done: data.done } : item,
    );
    const { error } = await supabase
      .from("district_rollouts")
      .update({ checklist } as never)
      .eq("id", row.id);
    if (error) throw new Error("rollout_write_failed");

    await audit(supabase, {
      actor_user_id: userId,
      action: "district.rollout.update",
      subject_type: "district_rollout",
      subject_id: row.id,
      decision: "allow",
      metadata: { item: data.itemKey, done: data.done },
    });
    return { readiness: rolloutReadiness(checklist) };
  });

/* ---------------------------------------------------------- training */

export const setTrainingItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { checklistCode: string; itemKey: string; done: boolean; tenantId?: string | null }) =>
      input,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.done) {
      const { error } = await supabase.from("training_completions").upsert(
        {
          user_id: userId,
          tenant_id: data.tenantId ?? null,
          checklist_code: data.checklistCode,
          item_key: data.itemKey,
        } as never,
        { onConflict: "user_id,checklist_code,item_key" },
      );
      if (error) throw new Error("training_write_failed");
    } else {
      const { error } = await supabase
        .from("training_completions")
        .delete()
        .eq("user_id", userId)
        .eq("checklist_code", data.checklistCode)
        .eq("item_key", data.itemKey);
      if (error) throw new Error("training_write_failed");
    }
    return { ok: true };
  });

/** Exposed for the roster guard test: roster authority is never data authority. */
export const rosterVisibilityProbe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { resolveDistrictActor } = await import("@/lib/atap/district.server");
    const actor = await resolveDistrictActor(supabase, userId);
    return {
      canReadRoster: canReadRoster(actor, data.tenantId),
      canManageRoster: canManageRoster(actor, data.tenantId),
      grantedFarmerPurposes: [] as string[],
    };
  });
