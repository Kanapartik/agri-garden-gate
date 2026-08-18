/**
 * Access administration control plane.
 *
 * Super admin: role catalogue + tenant admin appointments.
 * Tenant admin: delegate operational roles inside their own tenant.
 * Every handler re-checks authority server-side and writes an audit event.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { AppRole, TenantType } from "@/lib/atap/policy";
import {
  assignableRoles,
  checkRoleAssignment,
  validateRoleDefinitionDraft,
} from "@/lib/atap/access";

export interface AccessDirectoryUser {
  userId: string;
  email: string;
  fullName: string | null;
  roles: Array<{ role: AppRole; tenantId: string | null }>;
}

export interface AccessConsole {
  actor: { userId: string; isPlatformAdmin: boolean; tenantAdminOf: string[] };
  tenants: Array<{
    id: string;
    name: string;
    slug: string;
    tenant_type: string;
    region_code: string | null;
    status: string;
    adminCount: number;
  }>;
  roleDefinitions: Array<{
    code: string;
    label: string;
    description: string;
    journey_kind: string;
    app_role_binding: AppRole | null;
    tenant_type_scope: string | null;
    is_custom: boolean;
    is_active: boolean;
    is_public_selectable: boolean;
    authority_note: string | null;
  }>;
  assignable: AppRole[];
  directory: AccessDirectoryUser[];
}

export const getAccessConsole = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AccessConsole> => {
    const { supabase, userId } = context;
    const { resolveActor } = await import("@/lib/atap/admin.server");
    const actor = await resolveActor(supabase, userId);
    const accessActor = {
      userId,
      isPlatformAdmin: actor.isPlatformAdmin,
      tenantAdminOf: actor.tenantAdminOf,
    };
    const authorized = actor.isPlatformAdmin || actor.tenantAdminOf.length > 0;
    if (!authorized) {
      return {
        actor: { userId, isPlatformAdmin: false, tenantAdminOf: [] },
        tenants: [],
        roleDefinitions: [],
        assignable: [],
        directory: [],
      };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const scopedTenantIds = actor.tenantAdminOf;

    const tenantQuery = supabaseAdmin
      .from("tenants")
      .select("id, name, slug, tenant_type, region_code, status")
      .order("name");
    const [{ data: tenantRows }, { data: definitions }] = await Promise.all([
      actor.isPlatformAdmin ? tenantQuery : tenantQuery.in("id", scopedTenantIds),
      supabaseAdmin
        .from("role_definitions")
        .select(
          "code, label, description, journey_kind, app_role_binding, tenant_type_scope, is_custom, is_active, is_public_selectable, authority_note",
        )
        .order("sort_order"),
    ]);

    const visibleTenantIds = (tenantRows ?? []).map((t) => t.id);
    const roleRowsQuery = supabaseAdmin.from("user_roles").select("user_id, role, tenant_id");
    const { data: roleRows } = actor.isPlatformAdmin
      ? await roleRowsQuery
      : await roleRowsQuery.in("tenant_id", visibleTenantIds);

    // Directory: platform admin sees everyone, tenant admin only their members.
    const memberQuery = supabaseAdmin.from("tenant_members").select("user_id, tenant_id");
    const { data: memberRows } = actor.isPlatformAdmin
      ? await memberQuery
      : await memberQuery.in("tenant_id", visibleTenantIds);
    const allowedUserIds = new Set((memberRows ?? []).map((m) => m.user_id));
    (roleRows ?? []).forEach((r) => allowedUserIds.add(r.user_id));

    const { data: authList } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const { data: profiles } = await supabaseAdmin.from("profiles").select("id, full_name");
    const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

    const directory: AccessDirectoryUser[] = (authList?.users ?? [])
      .filter((u) => actor.isPlatformAdmin || allowedUserIds.has(u.id))
      .map((u) => ({
        userId: u.id,
        email: u.email ?? "",
        fullName: nameById.get(u.id) ?? (u.user_metadata?.["full_name"] as string) ?? null,
        roles: (roleRows ?? [])
          .filter((r) => r.user_id === u.id)
          .map((r) => ({ role: r.role as AppRole, tenantId: r.tenant_id })),
      }))
      .sort((a, b) => (a.fullName ?? a.email).localeCompare(b.fullName ?? b.email));

    const adminCount = (tenantId: string) =>
      (roleRows ?? []).filter((r) => r.tenant_id === tenantId && r.role === "tenant_admin").length;

    return {
      actor: { userId, isPlatformAdmin: actor.isPlatformAdmin, tenantAdminOf: actor.tenantAdminOf },
      tenants: (tenantRows ?? []).map((t) => ({ ...t, adminCount: adminCount(t.id) })),
      roleDefinitions: (definitions ?? []) as AccessConsole["roleDefinitions"],
      assignable: assignableRoles(visibleTenantIds[0] ?? "", accessActor),
      directory,
    };
  });

/* --------------------------------------------------- role catalogue (super) */

export const createRoleDefinition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      code: string;
      label: string;
      description?: string;
      journeyKind?: string;
      appRoleBinding: AppRole;
      tenantTypeScope?: TenantType | null;
      isPublicSelectable?: boolean;
      authorityNote?: string | null;
    }) => {
      if (!input.code || !input.label || !input.appRoleBinding) throw new Error("invalid_input");
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { audit, resolveActor } = await import("@/lib/atap/admin.server");
    const actor = await resolveActor(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing } = await supabaseAdmin.from("role_definitions").select("code");
    const check = validateRoleDefinitionDraft(
      {
        code: data.code,
        label: data.label,
        description: data.description ?? "",
        journeyKind: data.journeyKind ?? "onboarding",
        appRoleBinding: data.appRoleBinding,
        tenantTypeScope: data.tenantTypeScope ?? null,
        isPublicSelectable: data.isPublicSelectable ?? false,
        authorityNote: data.authorityNote ?? null,
      },
      (existing ?? []).map((r) => r.code),
      { userId, isPlatformAdmin: actor.isPlatformAdmin, tenantAdminOf: actor.tenantAdminOf },
    );
    if (!check.ok) {
      await audit(supabase, {
        actor_user_id: userId,
        action: "role_definition.create",
        subject_type: "role_definition",
        subject_id: data.code,
        decision: "deny",
        metadata: { reason: check.reason },
      });
      throw new Error(check.reason);
    }

    const draft = check.normalized;
    const { error } = await supabaseAdmin.from("role_definitions").insert({
      code: draft.code,
      label: draft.label,
      description: draft.description,
      journey_kind: draft.journeyKind,
      app_role_binding: draft.appRoleBinding,
      tenant_type_scope: draft.tenantTypeScope ?? null,
      is_public_selectable: draft.isPublicSelectable ?? false,
      authority_note: draft.authorityNote ?? null,
      is_custom: true,
      is_active: true,
      created_by: userId,
      sort_order: 900,
    });
    if (error) throw new Error("role_definition_create_failed");

    await audit(supabase, {
      actor_user_id: userId,
      action: "role_definition.create",
      subject_type: "role_definition",
      subject_id: draft.code,
      decision: "allow",
      metadata: { binding: draft.appRoleBinding, tenant_type: draft.tenantTypeScope },
    });
    return { ok: true, code: draft.code };
  });

export const setRoleDefinitionActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { code: string; isActive: boolean }) => {
    if (!input.code) throw new Error("invalid_input");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { audit, resolveActor } = await import("@/lib/atap/admin.server");
    const actor = await resolveActor(supabase, userId);
    if (!actor.isPlatformAdmin) {
      await audit(supabase, {
        actor_user_id: userId,
        action: "role_definition.set_active",
        subject_type: "role_definition",
        subject_id: data.code,
        decision: "deny",
        metadata: { reason: "not_authorized" },
      });
      throw new Error("Forbidden");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("role_definitions")
      .update({ is_active: data.isActive })
      .eq("code", data.code);
    await audit(supabase, {
      actor_user_id: userId,
      action: "role_definition.set_active",
      subject_type: "role_definition",
      subject_id: data.code,
      decision: "allow",
      metadata: { is_active: data.isActive },
    });
    return { ok: true };
  });

/* ------------------------------------------------------- role assignment */

export const assignTenantRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string; email: string; role: AppRole }) => {
    if (!input.tenantId || !input.email || !input.role) throw new Error("invalid_input");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { audit, resolveActor } = await import("@/lib/atap/admin.server");
    const actor = await resolveActor(supabase, userId);
    const accessActor = {
      userId,
      isPlatformAdmin: actor.isPlatformAdmin,
      tenantAdminOf: actor.tenantAdminOf,
    };
    const check = checkRoleAssignment(data.role, data.tenantId, accessActor);
    if (!check.ok) {
      await audit(supabase, {
        actor_user_id: userId,
        tenant_id: data.tenantId,
        action: "role.assign",
        subject_type: "user",
        subject_id: data.email,
        decision: "deny",
        metadata: { role: data.role, reason: check.reason },
      });
      throw new Error(check.reason);
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = data.email.trim().toLowerCase();
    const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const target = (list?.users ?? []).find((u) => (u.email ?? "").toLowerCase() === email);
    if (!target) throw new Error("user_not_found");

    await supabaseAdmin
      .from("tenant_members")
      .upsert(
        { tenant_id: data.tenantId, user_id: target.id, status: "active" },
        { onConflict: "tenant_id,user_id" },
      );
    const { error } = await supabaseAdmin.from("user_roles").insert({
      user_id: target.id,
      tenant_id: data.tenantId,
      role: data.role,
      granted_by: userId,
    });
    if (error && !`${error.message}`.toLowerCase().includes("duplicate")) {
      throw new Error("assign_failed");
    }

    await audit(supabase, {
      actor_user_id: userId,
      tenant_id: data.tenantId,
      action: "role.assign",
      subject_type: "user",
      subject_id: target.id,
      decision: "allow",
      metadata: { role: data.role, scope: "tenant", note: "tenancy confers no farmer-data access" },
    });
    return { ok: true, userId: target.id };
  });

export const revokeTenantRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string; targetUserId: string; role: AppRole }) => {
    if (!input.tenantId || !input.targetUserId || !input.role) throw new Error("invalid_input");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { audit, resolveActor } = await import("@/lib/atap/admin.server");
    const actor = await resolveActor(supabase, userId);
    const check = checkRoleAssignment(data.role, data.tenantId, {
      userId,
      isPlatformAdmin: actor.isPlatformAdmin,
      tenantAdminOf: actor.tenantAdminOf,
    });
    if (!check.ok) {
      await audit(supabase, {
        actor_user_id: userId,
        tenant_id: data.tenantId,
        action: "role.revoke",
        subject_type: "user",
        subject_id: data.targetUserId,
        decision: "deny",
        metadata: { role: data.role, reason: check.reason },
      });
      throw new Error(check.reason);
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("tenant_id", data.tenantId)
      .eq("user_id", data.targetUserId)
      .eq("role", data.role);

    await audit(supabase, {
      actor_user_id: userId,
      tenant_id: data.tenantId,
      action: "role.revoke",
      subject_type: "user",
      subject_id: data.targetUserId,
      decision: "allow",
      metadata: { role: data.role },
    });
    return { ok: true };
  });
