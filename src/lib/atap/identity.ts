/**
 * AgriGhar ATAP — B1 identity / organisation / tenant / role control-plane logic.
 *
 * Pure functions only (no IO) so every rule is unit-testable and reusable by the
 * server functions. Encodes the non-negotiables:
 *  - technical tenancy grants no authority
 *  - commercial entitlements never change roles or consent scope
 *  - farmers are never forced into an organisation tenant
 *  - high-stakes decisions stay with an authorised human role
 */
import type { AppRole, TenantType } from "@/lib/atap/policy";

/* ------------------------------------------------------------------ orgs */

export type OrgStatus = "draft" | "pending" | "approved" | "rejected" | "suspended";

const ORG_TRANSITIONS: Record<OrgStatus, readonly OrgStatus[]> = {
  draft: ["pending"],
  pending: ["approved", "rejected"],
  approved: ["suspended"],
  rejected: ["pending"],
  suspended: ["approved"],
};

export type OrgTransition =
  | { ok: true; next: OrgStatus }
  | { ok: false; reason: "invalid_transition" | "not_authorized" | "evidence_missing" };

export interface OrgActor {
  isPlatformAdmin: boolean;
}

/** Org lifecycle. Approve/reject/suspend are platform-admin only, server-side. */
export function planOrgTransition(
  current: OrgStatus,
  next: OrgStatus,
  actor: OrgActor,
  evidencePresent: readonly string[] = [],
  evidenceRequired: readonly string[] = [],
): OrgTransition {
  if (!ORG_TRANSITIONS[current].includes(next)) {
    return { ok: false, reason: "invalid_transition" };
  }
  const privileged: OrgStatus[] = ["approved", "rejected", "suspended"];
  if (privileged.includes(next) && !actor.isPlatformAdmin) {
    return { ok: false, reason: "not_authorized" };
  }
  if (next === "pending") {
    const missing = evidenceRequired.filter((e) => !evidencePresent.includes(e));
    if (missing.length > 0) return { ok: false, reason: "evidence_missing" };
  }
  return { ok: true, next };
}

/* -------------------------------------------------------------- tenancy */

/**
 * A tenant is only ever provisioned for an APPROVED organisation. Farmer /
 * individual journeys deliberately have no organisation tenant.
 */
export const INDIVIDUAL_ROLE_CODES = ["farmer", "farm_worker", "individual_buyer"] as const;

export function requiresOrganizationTenant(roleCode: string): boolean {
  return !(INDIVIDUAL_ROLE_CODES as readonly string[]).includes(roleCode);
}

export function canProvisionTenant(orgStatus: OrgStatus, actor: OrgActor): boolean {
  return orgStatus === "approved" && actor.isPlatformAdmin;
}

/** Relationships describe integration, never authority over another tenant. */
export type TenantRelationshipType =
  | "parent"
  | "affiliation"
  | "service_provider"
  | "data_partner";

export function relationshipGrantedRoles(
  _type: TenantRelationshipType,
  _tenantType: TenantType,
): readonly AppRole[] {
  return [];
}

/* ---------------------------------------------------------------- roles */

export const PLATFORM_ONLY_ROLES: readonly AppRole[] = ["platform_admin", "auditor"];

export const TENANT_SCOPED_ROLES: readonly AppRole[] = [
  "tenant_admin",
  "onboarding_officer",
  "field_agent",
  "consumer_api_manager",
  "scheme_publisher",
  "scheme_reviewer",
  "viewer",
];

export type RoleGrantCheck =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "role_not_grantable_at_tenant_scope"
        | "platform_role_requires_privileged_workflow"
        | "not_authorized";
    };

export interface RoleActor {
  isPlatformAdmin: boolean;
  tenantAdminOf: readonly string[];
  /** Set only by an approved, MFA-verified, unexpired privileged access grant. */
  privilegedSessionActive?: boolean;
}

/** Server-side authorization hook for scoped role grants. */
export function checkTenantRoleGrant(
  role: AppRole,
  tenantId: string,
  actor: RoleActor,
): RoleGrantCheck {
  if (PLATFORM_ONLY_ROLES.includes(role)) {
    return { ok: false, reason: "role_not_grantable_at_tenant_scope" };
  }
  if (!TENANT_SCOPED_ROLES.includes(role)) {
    return { ok: false, reason: "role_not_grantable_at_tenant_scope" };
  }
  if (actor.isPlatformAdmin || actor.tenantAdminOf.includes(tenantId)) return { ok: true };
  return { ok: false, reason: "not_authorized" };
}

/** Platform-wide roles require an approved + MFA-verified privileged workflow. */
export function checkPlatformRoleGrant(role: AppRole, actor: RoleActor): RoleGrantCheck {
  if (!PLATFORM_ONLY_ROLES.includes(role)) {
    return { ok: false, reason: "role_not_grantable_at_tenant_scope" };
  }
  if (!actor.isPlatformAdmin) return { ok: false, reason: "not_authorized" };
  if (!actor.privilegedSessionActive) {
    return { ok: false, reason: "platform_role_requires_privileged_workflow" };
  }
  return { ok: true };
}

/* --------------------------------------------------- privileged access */

export interface PrivilegeRequestLike {
  status: "pending" | "approved" | "denied" | "expired" | "revoked";
  mfa_verified: boolean;
  expires_at: string | null;
  requester_user_id: string;
}

export function isPrivilegedSessionActive(
  requests: readonly PrivilegeRequestLike[],
  userId: string,
  now: Date = new Date(),
): boolean {
  return requests.some(
    (r) =>
      r.requester_user_id === userId &&
      r.status === "approved" &&
      r.mfa_verified &&
      r.expires_at !== null &&
      new Date(r.expires_at) > now,
  );
}

/** Self-approval of privileged access is never allowed. */
export function canApprovePrivilegeRequest(
  request: PrivilegeRequestLike,
  approverUserId: string,
  approverIsPlatformAdmin: boolean,
): boolean {
  return (
    approverIsPlatformAdmin &&
    request.status === "pending" &&
    request.requester_user_id !== approverUserId
  );
}

/* ---------------------------------------------------- entitlements gate */

export interface EntitlementLike {
  plan_code: string;
  features: Record<string, unknown>;
  status: "active" | "suspended" | "revoked";
}

/**
 * Commercial entitlements are commercial only. This function is the single
 * seam and it structurally cannot return roles or consent purposes.
 */
export function rolesFromEntitlement(_e: EntitlementLike): readonly AppRole[] {
  return [];
}

export function consentPurposesFromEntitlement(_e: EntitlementLike): readonly string[] {
  return [];
}

/* ------------------------------------------- contact verification shell */

export type ContactChannel = "email" | "sms" | "whatsapp";

export interface ContactVerificationRequest {
  channel: ContactChannel;
  target: string;
}

export interface ContactVerificationChallenge {
  provider: string;
  providerRef: string;
  /** Hashed only — the plain code never leaves the provider adapter. */
  codeHash: string;
  expiresAt: string;
}

export interface ContactVerificationProvider {
  readonly name: string;
  start(req: ContactVerificationRequest): Promise<ContactVerificationChallenge>;
  check(providerRef: string, code: string, codeHash: string): Promise<boolean>;
}

export const CONTACT_TARGET_PATTERNS: Record<ContactChannel, RegExp> = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,
  sms: /^\+?[0-9]{8,15}$/,
  whatsapp: /^\+?[0-9]{8,15}$/,
};

export function isValidContactTarget(channel: ContactChannel, target: string): boolean {
  return CONTACT_TARGET_PATTERNS[channel].test(target.trim());
}

export const MAX_CONTACT_ATTEMPTS = 5;

export function canAttemptContactVerification(
  row: { status: string; attempts: number; expires_at: string | null },
  now: Date = new Date(),
): boolean {
  if (row.status !== "pending") return false;
  if (row.attempts >= MAX_CONTACT_ATTEMPTS) return false;
  if (row.expires_at !== null && new Date(row.expires_at) <= now) return false;
  return true;
}

/* ------------------------------------------------------------ workflows */

export type WorkflowState =
  | "created"
  | "contact_verified"
  | "evidence_submitted"
  | "in_review"
  | "activated"
  | "rejected";

const WORKFLOW_TRANSITIONS: Record<WorkflowState, readonly WorkflowState[]> = {
  created: ["contact_verified"],
  contact_verified: ["evidence_submitted"],
  evidence_submitted: ["in_review"],
  in_review: ["activated", "rejected"],
  activated: [],
  rejected: ["evidence_submitted"],
};

export const HUMAN_DECIDED_STATES: readonly WorkflowState[] = ["activated", "rejected"];

export type WorkflowAdvance =
  | { ok: true; next: WorkflowState }
  | { ok: false; reason: "invalid_transition" | "requires_human_reviewer" };

export function advanceWorkflow(
  current: WorkflowState,
  next: WorkflowState,
  actor: { isHumanReviewer: boolean },
): WorkflowAdvance {
  if (!WORKFLOW_TRANSITIONS[current].includes(next)) {
    return { ok: false, reason: "invalid_transition" };
  }
  if (HUMAN_DECIDED_STATES.includes(next) && !actor.isHumanReviewer) {
    return { ok: false, reason: "requires_human_reviewer" };
  }
  return { ok: true, next };
}

/* ------------------------------------------------- consent policy shell */

export interface ConsentPolicyLike {
  code: string;
  purpose_code: string;
  scope_template: string[];
  requires_explicit_consent: boolean;
  max_duration_days: number;
  is_active: boolean;
}

export type ConsentPlan =
  | { ok: true; purposeCode: string; scope: readonly string[]; expiresAt: string }
  | {
      ok: false;
      reason: "policy_inactive" | "unknown_policy" | "duration_exceeds_policy" | "scope_not_in_policy";
    };

/**
 * Consent-policy service skeleton: a grant may never exceed its policy scope or
 * duration, and B1 issues no broad partner access.
 */
export function planConsentGrant(
  policies: readonly ConsentPolicyLike[],
  input: { policyCode: string; requestedScope: readonly string[]; durationDays: number },
  now: Date = new Date(),
): ConsentPlan {
  const policy = policies.find((p) => p.code === input.policyCode);
  if (!policy) return { ok: false, reason: "unknown_policy" };
  if (!policy.is_active) return { ok: false, reason: "policy_inactive" };
  if (input.durationDays > policy.max_duration_days) {
    return { ok: false, reason: "duration_exceeds_policy" };
  }
  const outside = input.requestedScope.filter((s) => !policy.scope_template.includes(s));
  if (outside.length > 0) return { ok: false, reason: "scope_not_in_policy" };

  const expires = new Date(now.getTime() + input.durationDays * 86_400_000);
  return {
    ok: true,
    purposeCode: policy.purpose_code,
    scope: input.requestedScope.length > 0 ? input.requestedScope : policy.scope_template,
    expiresAt: expires.toISOString(),
  };
}
