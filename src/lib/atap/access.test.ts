import { describe, expect, it } from "vitest";
import {
  administrableTenantIds,
  assignableRoles,
  checkRoleAssignment,
  roleDefinitionsForTenantType,
  validateRoleDefinitionDraft,
  type AccessActor,
} from "@/lib/atap/access";

const superAdmin: AccessActor = { userId: "u1", isPlatformAdmin: true, tenantAdminOf: [] };
const bankAdmin: AccessActor = { userId: "u2", isPlatformAdmin: false, tenantAdminOf: ["bank-1"] };
const plainUser: AccessActor = { userId: "u3", isPlatformAdmin: false, tenantAdminOf: [] };

describe("checkRoleAssignment", () => {
  it("lets the super admin appoint a tenant admin", () => {
    expect(checkRoleAssignment("tenant_admin", "bank-1", superAdmin)).toEqual({ ok: true });
  });

  it("blocks a tenant admin from minting another tenant admin", () => {
    expect(checkRoleAssignment("tenant_admin", "bank-1", bankAdmin)).toEqual({
      ok: false,
      reason: "tenant_admin_appointment_requires_super_admin",
    });
  });

  it("lets a tenant admin delegate operational roles inside their tenant only", () => {
    expect(checkRoleAssignment("onboarding_officer", "bank-1", bankAdmin).ok).toBe(true);
    expect(checkRoleAssignment("onboarding_officer", "fpo-9", bankAdmin)).toEqual({
      ok: false,
      reason: "not_authorized",
    });
  });

  it("never allows platform-scoped roles at tenant scope, even for the super admin", () => {
    for (const role of ["platform_admin", "auditor", "market_operator", "researcher"] as const) {
      expect(checkRoleAssignment(role, "bank-1", superAdmin)).toEqual({
        ok: false,
        reason: "role_is_platform_scoped",
      });
    }
  });

  it("denies users with no admin authority", () => {
    expect(checkRoleAssignment("field_agent", "bank-1", plainUser)).toEqual({
      ok: false,
      reason: "not_authorized",
    });
  });
});

describe("assignableRoles", () => {
  it("includes tenant_admin only for the super admin", () => {
    expect(assignableRoles("bank-1", superAdmin)).toContain("tenant_admin");
    expect(assignableRoles("bank-1", bankAdmin)).not.toContain("tenant_admin");
  });

  it("returns nothing for a user without admin authority", () => {
    expect(assignableRoles("bank-1", plainUser)).toEqual([]);
  });
});

describe("administrableTenantIds", () => {
  it("scopes tenant admins to their own tenants", () => {
    expect(administrableTenantIds(["bank-1", "fpo-9"], bankAdmin)).toEqual(["bank-1"]);
    expect(administrableTenantIds(["bank-1", "fpo-9"], superAdmin)).toEqual(["bank-1", "fpo-9"]);
  });
});

describe("validateRoleDefinitionDraft", () => {
  const base = {
    code: "fpo_treasurer",
    label: "FPO treasurer",
    description: "Handles FPO finance operations",
    journeyKind: "onboarding",
    appRoleBinding: "viewer" as const,
  };

  it("accepts and normalizes a super admin draft", () => {
    const res = validateRoleDefinitionDraft({ ...base, code: "FPO_Treasurer" }, [], superAdmin);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.normalized.code).toBe("fpo_treasurer");
      expect(res.normalized.isPublicSelectable).toBe(false);
    }
  });

  it("rejects non super admins", () => {
    expect(validateRoleDefinitionDraft(base, [], bankAdmin)).toEqual({
      ok: false,
      reason: "not_authorized",
    });
  });

  it("rejects bad codes and duplicates", () => {
    expect(validateRoleDefinitionDraft({ ...base, code: "A B" }, [], superAdmin)).toEqual({
      ok: false,
      reason: "invalid_code",
    });
    expect(validateRoleDefinitionDraft(base, ["fpo_treasurer"], superAdmin)).toEqual({
      ok: false,
      reason: "code_taken",
    });
  });

  it("refuses to bind a catalogue role to platform authority", () => {
    expect(
      validateRoleDefinitionDraft(
        { ...base, appRoleBinding: "platform_admin" },
        [],
        superAdmin,
      ),
    ).toEqual({ ok: false, reason: "binding_not_allowed" });
  });
});

describe("roleDefinitionsForTenantType", () => {
  it("keeps unscoped and matching definitions, drops inactive", () => {
    const defs = [
      { tenant_type_scope: null, is_active: true },
      { tenant_type_scope: "bank", is_active: true },
      { tenant_type_scope: "fpo", is_active: true },
      { tenant_type_scope: "bank", is_active: false },
    ];
    expect(roleDefinitionsForTenantType(defs, "bank")).toHaveLength(2);
  });
});
