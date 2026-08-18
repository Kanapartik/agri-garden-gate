import { describe, expect, it } from "vitest";
import {
  advanceWorkflow,
  canApprovePrivilegeRequest,
  canProvisionTenant,
  checkPlatformRoleGrant,
  checkTenantRoleGrant,
  consentPurposesFromEntitlement,
  isPrivilegedSessionActive,
  isValidContactTarget,
  planConsentGrant,
  planOrgTransition,
  relationshipGrantedRoles,
  requiresOrganizationTenant,
  rolesFromEntitlement,
  type ConsentPolicyLike,
} from "@/lib/atap/identity";

const admin = { isPlatformAdmin: true };
const nonAdmin = { isPlatformAdmin: false };

describe("organisation lifecycle", () => {
  it("admin can approve a pending organisation", () => {
    expect(planOrgTransition("pending", "approved", admin)).toEqual({
      ok: true,
      next: "approved",
    });
  });

  it("non-admin cannot approve", () => {
    expect(planOrgTransition("pending", "approved", nonAdmin)).toEqual({
      ok: false,
      reason: "not_authorized",
    });
  });

  it("rejects invalid transitions", () => {
    expect(planOrgTransition("draft", "approved", admin)).toEqual({
      ok: false,
      reason: "invalid_transition",
    });
  });

  it("blocks submission without required evidence", () => {
    expect(planOrgTransition("draft", "pending", nonAdmin, [], ["registration_certificate"])).toEqual(
      { ok: false, reason: "evidence_missing" },
    );
    expect(
      planOrgTransition("draft", "pending", nonAdmin, ["registration_certificate"], [
        "registration_certificate",
      ]),
    ).toEqual({ ok: true, next: "pending" });
  });
});

describe("tenancy", () => {
  it("provisions only for approved orgs, by an admin", () => {
    expect(canProvisionTenant("approved", admin)).toBe(true);
    expect(canProvisionTenant("pending", admin)).toBe(false);
    expect(canProvisionTenant("approved", nonAdmin)).toBe(false);
  });

  it("does not force farmers into an organisation tenant", () => {
    expect(requiresOrganizationTenant("farmer")).toBe(false);
    expect(requiresOrganizationTenant("fpo_admin")).toBe(true);
  });

  it("relationships grant no roles", () => {
    expect(relationshipGrantedRoles("parent", "govt_dept")).toEqual([]);
    expect(relationshipGrantedRoles("data_partner", "bank")).toEqual([]);
  });
});

describe("role grants", () => {
  it("tenant admin can grant scoped roles in their own tenant only", () => {
    const actor = { isPlatformAdmin: false, tenantAdminOf: ["t1"] };
    expect(checkTenantRoleGrant("field_agent", "t1", actor)).toEqual({ ok: true });
    expect(checkTenantRoleGrant("field_agent", "t2", actor)).toEqual({
      ok: false,
      reason: "not_authorized",
    });
  });

  it("platform-wide roles are never grantable at tenant scope", () => {
    expect(checkTenantRoleGrant("platform_admin", "t1", { isPlatformAdmin: true, tenantAdminOf: [] })).toEqual(
      { ok: false, reason: "role_not_grantable_at_tenant_scope" },
    );
  });

  it("platform roles need an active privileged session", () => {
    const base = { isPlatformAdmin: true, tenantAdminOf: [] };
    expect(checkPlatformRoleGrant("auditor", base)).toEqual({
      ok: false,
      reason: "platform_role_requires_privileged_workflow",
    });
    expect(checkPlatformRoleGrant("auditor", { ...base, privilegedSessionActive: true })).toEqual({
      ok: true,
    });
  });
});

describe("privileged access workflow", () => {
  const future = new Date(Date.now() + 3_600_000).toISOString();
  const past = new Date(Date.now() - 3_600_000).toISOString();

  it("requires approved + mfa + unexpired", () => {
    expect(
      isPrivilegedSessionActive(
        [{ status: "approved", mfa_verified: true, expires_at: future, requester_user_id: "u1" }],
        "u1",
      ),
    ).toBe(true);
    expect(
      isPrivilegedSessionActive(
        [{ status: "approved", mfa_verified: false, expires_at: future, requester_user_id: "u1" }],
        "u1",
      ),
    ).toBe(false);
    expect(
      isPrivilegedSessionActive(
        [{ status: "approved", mfa_verified: true, expires_at: past, requester_user_id: "u1" }],
        "u1",
      ),
    ).toBe(false);
  });

  it("forbids self-approval", () => {
    const req = {
      status: "pending" as const,
      mfa_verified: false,
      expires_at: null,
      requester_user_id: "u1",
    };
    expect(canApprovePrivilegeRequest(req, "u1", true)).toBe(false);
    expect(canApprovePrivilegeRequest(req, "u2", true)).toBe(true);
    expect(canApprovePrivilegeRequest(req, "u2", false)).toBe(false);
  });
});

describe("commercial entitlements never widen access", () => {
  const ent = { plan_code: "premium", features: { seats: 50 }, status: "active" as const };
  it("yields no roles and no consent purposes", () => {
    expect(rolesFromEntitlement(ent)).toEqual([]);
    expect(consentPurposesFromEntitlement(ent)).toEqual([]);
  });
});

describe("contact verification shell", () => {
  it("validates channel targets", () => {
    expect(isValidContactTarget("email", "a@b.co")).toBe(true);
    expect(isValidContactTarget("email", "nope")).toBe(false);
    expect(isValidContactTarget("sms", "+919000000000")).toBe(true);
    expect(isValidContactTarget("sms", "12")).toBe(false);
  });
});

describe("onboarding workflow", () => {
  it("only a human reviewer can activate or reject", () => {
    expect(advanceWorkflow("in_review", "activated", { isHumanReviewer: false })).toEqual({
      ok: false,
      reason: "requires_human_reviewer",
    });
    expect(advanceWorkflow("in_review", "activated", { isHumanReviewer: true })).toEqual({
      ok: true,
      next: "activated",
    });
  });

  it("blocks state skipping", () => {
    expect(advanceWorkflow("created", "activated", { isHumanReviewer: true })).toEqual({
      ok: false,
      reason: "invalid_transition",
    });
  });
});

describe("consent policy service skeleton", () => {
  const policies: ConsentPolicyLike[] = [
    {
      code: "credit_assessment_scoped",
      purpose_code: "credit_assessment",
      scope_template: ["name", "landholding_summary"],
      requires_explicit_consent: true,
      max_duration_days: 90,
      is_active: true,
    },
    {
      code: "retired_policy",
      purpose_code: "advisory",
      scope_template: ["geography_coarse"],
      requires_explicit_consent: true,
      max_duration_days: 30,
      is_active: false,
    },
  ];

  it("plans a scoped grant within policy", () => {
    const plan = planConsentGrant(policies, {
      policyCode: "credit_assessment_scoped",
      requestedScope: ["name"],
      durationDays: 30,
    });
    expect(plan.ok).toBe(true);
    if (plan.ok) expect(plan.scope).toEqual(["name"]);
  });

  it("refuses scope outside the policy", () => {
    expect(
      planConsentGrant(policies, {
        policyCode: "credit_assessment_scoped",
        requestedScope: ["bank_statements"],
        durationDays: 10,
      }),
    ).toEqual({ ok: false, reason: "scope_not_in_policy" });
  });

  it("refuses over-long and inactive/unknown policies", () => {
    expect(
      planConsentGrant(policies, {
        policyCode: "credit_assessment_scoped",
        requestedScope: [],
        durationDays: 900,
      }),
    ).toEqual({ ok: false, reason: "duration_exceeds_policy" });
    expect(
      planConsentGrant(policies, { policyCode: "retired_policy", requestedScope: [], durationDays: 1 }),
    ).toEqual({ ok: false, reason: "policy_inactive" });
    expect(
      planConsentGrant(policies, { policyCode: "nope", requestedScope: [], durationDays: 1 }),
    ).toEqual({ ok: false, reason: "unknown_policy" });
  });
});
