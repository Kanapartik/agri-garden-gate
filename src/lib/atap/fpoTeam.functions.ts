/**
 * FPO Management & Operations workspace — Phase 9 server functions
 * (team directory, delegated permission matrix, access reviews).
 *
 * Reads are tenant-scoped and default-deny. Every mutation requires
 * organization-admin (or platform-admin) authority, is clamped to the role
 * ceiling in `fpoTeam.ts`, and is audited. Nothing here grants farmer-data
 * access: staff rows carry no farmer identifiers.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isFpoSection, type FpoSection } from "@/lib/atap/fpo";
import {
  buildMatrix,
  canManageTeam,
  canTransitionStaff,
  canViewTeam,
  checkPermissionOverride,
  effectiveLevelForRoles,
  FPO_STAFF_ROLES,
  lastAdminGuard,
  reviewDue,
  sortStaff,
  statusForDecision,
  summarizeStaff,
  TEAM_DISCLAIMER,
  type PermissionLevel,
  type PermissionRowLike,
  type ReviewDecision,
  type StaffStatus,
} from "@/lib/atap/fpoTeam";
import type { AppRole } from "@/lib/atap/policy";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type AuthedClient = SupabaseClient<Database>;

export interface StaffRow {
  id: string;
  display_name: string;
  designation: string | null;
  contact_hint: string | null;
  staff_role: AppRole;
  status: StaffStatus;
  district_scope: string[];
  mandal_scope: string[];
  notes: string | null;
  last_reviewed_at: string | null;
  suspended_reason: string | null;
  created_at: string;
  review_due: boolean;
}

export interface PermissionRow extends PermissionRowLike {
  id: string;
  rationale: string | null;
}

export interface AccessReviewRow {
  id: string;
  staff_member_id: string;
  decision: ReviewDecision;
  previous_role: AppRole | null;
  new_role: AppRole | null;
  notes: string | null;
  reviewed_at: string;
}

export interface TeamBoard {
  tenantId: string;
  roles: AppRole[];
  canManage: boolean;
  staff: StaffRow[];
  summary: ReturnType<typeof summarizeStaff>;
  matrix: ReturnType<typeof buildMatrix>;
  permissionRows: PermissionRow[];
  reviews: AccessReviewRow[];
  mySections: Array<{ section: FpoSection; level: PermissionLevel }>;
  staffRoles: AppRole[];
  disclaimer: string;
}

const STAFF_COLUMNS =
  "id, display_name, designation, contact_hint, staff_role, status, district_scope, mandal_scope, notes, last_reviewed_at, suspended_reason, created_at";

async function tenantScope(supabase: AuthedClient, userId: string, tenantId: string) {
  const { resolveDistrictActor } = await import("@/lib/atap/district.server");
  const actor = await resolveDistrictActor(supabase, userId);
  const permitted = actor.isPlatformAdmin || actor.isAuditor || actor.tenantIds.includes(tenantId);
  if (!permitted) throw new Error("You do not have access to this organization");
  const roles = actor.tenantRoles
    .filter((r: { tenant_id: string | null }) => r.tenant_id === tenantId)
    .map((r: { role: AppRole }) => r.role) as AppRole[];
  const effective: AppRole[] = actor.isPlatformAdmin ? [...roles, "platform_admin"] : roles;
  if (actor.isAuditor && !effective.includes("auditor")) effective.push("auditor");
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

async function loadStaff(supabase: AuthedClient, tenantId: string) {
  const { data } = await supabase
    .from("fpo_staff_members")
    .select(STAFF_COLUMNS)
    .eq("tenant_id", tenantId)
    .limit(500);
  return (data ?? []) as unknown as Array<Omit<StaffRow, "review_due">>;
}

async function requireManage(supabase: AuthedClient, userId: string, tenantId: string) {
  const scope = await tenantScope(supabase, userId, tenantId);
  if (!canManageTeam(scope.roles)) {
    throw new Error("Only an organization admin can change team access");
  }
  return scope;
}

/* ------------------------------------------------------------------ read */

export const getTeamBoard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { tenantId: string }) => data)
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as AuthedClient;
    const { roles } = await tenantScope(supabase, context.userId, data.tenantId);
    if (!canViewTeam(roles)) throw new Error("You do not have access to this organization");

    const [staffRaw, permRes, reviewRes] = await Promise.all([
      loadStaff(supabase, data.tenantId),
      supabase
        .from("fpo_role_permissions")
        .select("id, tenant_id, staff_role, section, level, rationale")
        .or(`tenant_id.is.null,tenant_id.eq.${data.tenantId}`)
        .limit(500),
      supabase
        .from("fpo_access_reviews")
        .select("id, staff_member_id, decision, previous_role, new_role, notes, reviewed_at")
        .eq("tenant_id", data.tenantId)
        .order("reviewed_at", { ascending: false })
        .limit(200),
    ]);

    const now = new Date();
    const staff = sortStaff(staffRaw, now).map((s) => ({
      ...(s as Omit<StaffRow, "review_due">),
      review_due: reviewDue(s, now),
    })) as StaffRow[];

    const permissionRows = (permRes.data ?? []) as unknown as PermissionRow[];
    const mySections = (
      [
        "overview",
        "farmers",
        "schemes",
        "applications",
        "procurement",
        "produce",
        "accounts",
        "opportunities",
        "documents",
        "notifications",
        "tasks",
        "insights",
        "team",
        "settings",
      ] as FpoSection[]
    ).map((section) => ({
      section,
      level: effectiveLevelForRoles(permissionRows, roles, section, data.tenantId),
    }));

    return {
      tenantId: data.tenantId,
      roles,
      canManage: canManageTeam(roles),
      staff,
      summary: summarizeStaff(staffRaw, now),
      matrix: buildMatrix(permissionRows, data.tenantId),
      permissionRows,
      reviews: (reviewRes.data ?? []) as unknown as AccessReviewRow[],
      mySections,
      staffRoles: [...FPO_STAFF_ROLES],
      disclaimer: TEAM_DISCLAIMER,
    } satisfies TeamBoard;
  });

/* ----------------------------------------------------------------- staff */

export const upsertStaffMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      tenantId: string;
      staffId?: string;
      displayName: string;
      designation?: string;
      contactHint?: string;
      staffRole: AppRole;
      districtScope?: string[];
      mandalScope?: string[];
      notes?: string;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as AuthedClient;
    await requireManage(supabase, context.userId, data.tenantId);
    if (!FPO_STAFF_ROLES.includes(data.staffRole)) {
      throw new Error("That role cannot be delegated inside an organization workspace");
    }
    if (!data.displayName.trim()) throw new Error("A staff name is required");

    const staff = await loadStaff(supabase, data.tenantId);
    if (data.staffId) {
      const withStatus = staff.map((s) => ({ ...s }));
      const guard = lastAdminGuard(withStatus, data.staffId, data.staffRole);
      if (!guard.ok) {
        throw new Error("This organization would be left without an active admin");
      }
    }

    const payload = {
      tenant_id: data.tenantId,
      display_name: data.displayName.trim(),
      designation: data.designation?.trim() || null,
      contact_hint: data.contactHint?.trim() || null,
      staff_role: data.staffRole,
      district_scope: data.districtScope ?? [],
      mandal_scope: data.mandalScope ?? [],
      notes: data.notes?.trim() || null,
      created_by: context.userId,
    };

    let id = data.staffId ?? "";
    if (data.staffId) {
      const { error } = await supabase
        .from("fpo_staff_members")
        .update(payload)
        .eq("tenant_id", data.tenantId)
        .eq("id", data.staffId);
      if (error) throw new Error(error.message);
    } else {
      const { data: inserted, error } = await supabase
        .from("fpo_staff_members")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      id = (inserted as { id: string }).id;
    }

    await logAudit(supabase, {
      userId: context.userId,
      tenantId: data.tenantId,
      action: data.staffId ? "fpo.staff.updated" : "fpo.staff.added",
      subjectType: "fpo_staff_member",
      subjectId: id,
      metadata: { role: data.staffRole, districts: payload.district_scope },
    });

    return { id };
  });

export const setStaffStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { tenantId: string; staffId: string; status: StaffStatus; reason?: string }) => data,
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as AuthedClient;
    await requireManage(supabase, context.userId, data.tenantId);

    const staff = await loadStaff(supabase, data.tenantId);
    const target = staff.find((s) => s.id === data.staffId);
    if (!target) throw new Error("Staff member not found");
    if (!canTransitionStaff(target.status, data.status)) {
      throw new Error(`Cannot move access from ${target.status} to ${data.status}`);
    }
    const guard = lastAdminGuard(staff, data.staffId, data.status);
    if (!guard.ok) throw new Error("This organization would be left without an active admin");

    const { error } = await supabase
      .from("fpo_staff_members")
      .update({
        status: data.status,
        suspended_reason: data.status === "suspended" ? data.reason?.trim() || null : null,
      })
      .eq("tenant_id", data.tenantId)
      .eq("id", data.staffId);
    if (error) throw new Error(error.message);

    await logAudit(supabase, {
      userId: context.userId,
      tenantId: data.tenantId,
      action: `fpo.staff.${data.status}`,
      subjectType: "fpo_staff_member",
      subjectId: data.staffId,
      metadata: { from: target.status, to: data.status, reason: data.reason ?? null },
    });

    return { ok: true };
  });

/* ----------------------------------------------------------- permissions */

export const setRolePermission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      tenantId: string;
      staffRole: AppRole;
      section: string;
      level: PermissionLevel;
      rationale?: string;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as AuthedClient;
    const { roles } = await requireManage(supabase, context.userId, data.tenantId);
    if (!isFpoSection(data.section)) throw new Error("Unknown workspace section");

    const check = checkPermissionOverride(data.staffRole, data.section, data.level, roles);
    if (!check.ok) {
      if (check.reason === "exceeds_role_ceiling") {
        throw new Error(
          "Configuration can only narrow a role: this level is above what the role may ever hold",
        );
      }
      if (check.reason === "role_not_delegable") {
        throw new Error("That role cannot hold a workspace seat");
      }
      throw new Error("Only an organization admin can configure permissions");
    }

    const { data: existing } = await supabase
      .from("fpo_role_permissions")
      .select("id")
      .eq("tenant_id", data.tenantId)
      .eq("staff_role", data.staffRole)
      .eq("section", data.section)
      .maybeSingle();

    const payload = {
      tenant_id: data.tenantId,
      staff_role: data.staffRole,
      section: data.section,
      level: data.level,
      rationale: data.rationale?.trim() || null,
      updated_by: context.userId,
    };

    if (existing) {
      const { error } = await supabase
        .from("fpo_role_permissions")
        .update(payload)
        .eq("id", (existing as { id: string }).id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("fpo_role_permissions").insert(payload);
      if (error) throw new Error(error.message);
    }

    await logAudit(supabase, {
      userId: context.userId,
      tenantId: data.tenantId,
      action: "fpo.permission.configured",
      subjectType: "fpo_role_permission",
      subjectId: `${data.staffRole}:${data.section}`,
      metadata: { level: data.level, rationale: payload.rationale },
    });

    return { ok: true };
  });

export const clearRolePermission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { tenantId: string; staffRole: AppRole; section: string }) => data)
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as AuthedClient;
    await requireManage(supabase, context.userId, data.tenantId);
    const { error } = await supabase
      .from("fpo_role_permissions")
      .delete()
      .eq("tenant_id", data.tenantId)
      .eq("staff_role", data.staffRole)
      .eq("section", data.section);
    if (error) throw new Error(error.message);

    await logAudit(supabase, {
      userId: context.userId,
      tenantId: data.tenantId,
      action: "fpo.permission.reset_to_default",
      subjectType: "fpo_role_permission",
      subjectId: `${data.staffRole}:${data.section}`,
    });
    return { ok: true };
  });

/* -------------------------------------------------------- access reviews */

export const recordAccessReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      tenantId: string;
      staffId: string;
      decision: ReviewDecision;
      newRole?: AppRole;
      notes?: string;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as AuthedClient;
    await requireManage(supabase, context.userId, data.tenantId);

    const staff = await loadStaff(supabase, data.tenantId);
    const target = staff.find((s) => s.id === data.staffId);
    if (!target) throw new Error("Staff member not found");

    const impliedStatus = statusForDecision(data.decision);
    const nextRole =
      data.decision === "role_changed" && data.newRole ? data.newRole : target.staff_role;
    if (data.decision === "role_changed" && !FPO_STAFF_ROLES.includes(nextRole)) {
      throw new Error("That role cannot be delegated inside an organization workspace");
    }

    const guard = lastAdminGuard(staff, data.staffId, impliedStatus ?? nextRole);
    if (!guard.ok) throw new Error("This organization would be left without an active admin");
    if (impliedStatus && !canTransitionStaff(target.status, impliedStatus)) {
      throw new Error(`Cannot move access from ${target.status} to ${impliedStatus}`);
    }

    const { data: inserted, error } = await supabase
      .from("fpo_access_reviews")
      .insert({
        tenant_id: data.tenantId,
        staff_member_id: data.staffId,
        decision: data.decision,
        previous_role: target.staff_role,
        new_role: nextRole,
        notes: data.notes?.trim() || null,
        reviewed_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    const update: {
      last_reviewed_at: string;
      status?: StaffStatus;
      staff_role?: AppRole;
    } = { last_reviewed_at: new Date().toISOString() };
    if (impliedStatus) update.status = impliedStatus;
    if (data.decision === "role_changed") update.staff_role = nextRole;
    const { error: updateError } = await supabase
      .from("fpo_staff_members")
      .update(update)
      .eq("tenant_id", data.tenantId)
      .eq("id", data.staffId);
    if (updateError) throw new Error(updateError.message);

    await logAudit(supabase, {
      userId: context.userId,
      tenantId: data.tenantId,
      action: "fpo.staff.access_reviewed",
      subjectType: "fpo_staff_member",
      subjectId: data.staffId,
      metadata: {
        decision: data.decision,
        previous_role: target.staff_role,
        new_role: nextRole,
      },
    });

    return { id: (inserted as { id: string }).id };
  });
