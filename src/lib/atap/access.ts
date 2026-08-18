/**
 * Access administration domain logic (pure).
 *
 * Super admin (platform_admin) owns the role catalogue and appoints tenant
 * admins. Tenant admins delegate operational roles inside their own tenant
 * only. Technical tenancy still confers no authority over farmer data — role
 * assignment never widens consent.
 */
import type { AppRole, TenantType } from "@/lib/atap/policy";

/** Roles that only exist platform-wide and never at tenant scope. */
export const PLATFORM_SCOPE_ROLES: readonly AppRole[] = [
  "platform_admin",
  "auditor",
  "expansion_manager",
  "support_agent",
  "market_operator",
  "state_admin",
  "knowledge_contributor",
  "knowledge_reviewer",
  "researcher",
  "policymaker",
  "talent_candidate",
  "talent_operator",
];

/** Roles a tenant admin may delegate inside their own tenant. */
export const DELEGABLE_TENANT_ROLES: readonly AppRole[] = [
  "onboarding_officer",
  "field_agent",
  "consumer_api_manager",
  "scheme_publisher",
  "scheme_reviewer",
  "partner_developer",
  "service_provider_admin",
  "postharvest_provider_admin",
  "training_partner_admin",
  "employer_recruiter",
  "employment_exchange_admin",
  "viewer",
];

/** Roles the super admin may appoint at tenant scope (includes tenant_admin). */
export const SUPER_ADMIN_TENANT_ROLES: readonly AppRole[] = [
  "tenant_admin",
  ...DELEGABLE_TENANT_ROLES,
];

export interface AccessActor {
  userId: string;
  isPlatformAdmin: boolean;
  tenantAdminOf: readonly string[];
}

export type AssignmentCheck =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "role_is_platform_scoped"
        | "tenant_admin_appointment_requires_super_admin"
        | "role_not_delegable"
        | "not_authorized";
    };

/**
 * Server-side gate for `role + tenant` assignment. UI hiding is presentation
 * only; every mutation re-runs this.
 */
export function checkRoleAssignment(
  role: AppRole,
  tenantId: string,
  actor: AccessActor,
): AssignmentCheck {
  if (PLATFORM_SCOPE_ROLES.includes(role)) return { ok: false, reason: "role_is_platform_scoped" };
  if (role === "tenant_admin") {
    return actor.isPlatformAdmin
      ? { ok: true }
      : { ok: false, reason: "tenant_admin_appointment_requires_super_admin" };
  }
  if (!DELEGABLE_TENANT_ROLES.includes(role)) return { ok: false, reason: "role_not_delegable" };
  if (actor.isPlatformAdmin) return { ok: true };
  if (actor.tenantAdminOf.includes(tenantId)) return { ok: true };
  return { ok: false, reason: "not_authorized" };
}

/** Roles the actor is allowed to offer in the UI for a given tenant. */
export function assignableRoles(tenantId: string, actor: AccessActor): AppRole[] {
  const candidates = actor.isPlatformAdmin ? SUPER_ADMIN_TENANT_ROLES : DELEGABLE_TENANT_ROLES;
  return candidates.filter((role) => checkRoleAssignment(role, tenantId, actor).ok);
}

/** Tenants the actor may administer. */
export function administrableTenantIds(
  allTenantIds: readonly string[],
  actor: AccessActor,
): string[] {
  if (actor.isPlatformAdmin) return [...allTenantIds];
  return allTenantIds.filter((id) => actor.tenantAdminOf.includes(id));
}

/* ------------------------------------------------------- role catalogue */

export interface RoleDefinitionDraft {
  code: string;
  label: string;
  description: string;
  journeyKind: string;
  appRoleBinding: AppRole;
  tenantTypeScope?: TenantType | null;
  isPublicSelectable?: boolean;
  authorityNote?: string | null;
}

export type RoleDraftCheck =
  | { ok: true; normalized: RoleDefinitionDraft }
  | {
      ok: false;
      reason:
        | "not_authorized"
        | "invalid_code"
        | "code_taken"
        | "label_required"
        | "binding_not_allowed";
    };

export const ROLE_CODE_PATTERN = /^[a-z][a-z0-9_]{2,39}$/;

/**
 * Configuration over forks: new roles are catalogue rows bound to an existing
 * authority. A custom role can never bind to a platform-scoped authority —
 * that would let the catalogue mint platform power.
 */
export function validateRoleDefinitionDraft(
  draft: RoleDefinitionDraft,
  existingCodes: readonly string[],
  actor: AccessActor,
): RoleDraftCheck {
  if (!actor.isPlatformAdmin) return { ok: false, reason: "not_authorized" };
  const code = (draft.code ?? "").trim().toLowerCase();
  if (!ROLE_CODE_PATTERN.test(code)) return { ok: false, reason: "invalid_code" };
  if (existingCodes.includes(code)) return { ok: false, reason: "code_taken" };
  const label = (draft.label ?? "").trim();
  if (label.length < 3) return { ok: false, reason: "label_required" };
  if (!SUPER_ADMIN_TENANT_ROLES.includes(draft.appRoleBinding)) {
    return { ok: false, reason: "binding_not_allowed" };
  }
  return {
    ok: true,
    normalized: {
      code,
      label,
      description: (draft.description ?? "").trim() || label,
      journeyKind: (draft.journeyKind ?? "onboarding").trim() || "onboarding",
      appRoleBinding: draft.appRoleBinding,
      tenantTypeScope: draft.tenantTypeScope ?? null,
      isPublicSelectable: draft.isPublicSelectable ?? false,
      authorityNote: draft.authorityNote ?? null,
    },
  };
}

/** Role definitions offered for a tenant of a given type. */
export function roleDefinitionsForTenantType<
  T extends { tenant_type_scope: string | null; is_active: boolean },
>(definitions: readonly T[], tenantType: string): T[] {
  return definitions.filter(
    (d) => d.is_active && (d.tenant_type_scope === null || d.tenant_type_scope === tenantType),
  );
}
