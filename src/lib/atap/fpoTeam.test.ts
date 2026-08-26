import { describe, expect, it } from "vitest";
import {
  atLeast,
  buildMatrix,
  canManageTeam,
  canTransitionStaff,
  canViewTeam,
  checkPermissionOverride,
  effectiveLevel,
  effectiveLevelForRoles,
  isReadOnlyTeamRole,
  lastAdminGuard,
  nextStaffStatuses,
  reviewDue,
  roleCeiling,
  sortStaff,
  statusForDecision,
  summarizeStaff,
  type PermissionRowLike,
  type StaffLike,
} from "@/lib/atap/fpoTeam";
import type { AppRole } from "@/lib/atap/policy";

const TENANT = "t1";

function row(
  tenant_id: string | null,
  staff_role: AppRole,
  section: string,
  level: PermissionRowLike["level"],
): PermissionRowLike {
  return { tenant_id, staff_role, section, level };
}

const DEFAULTS: PermissionRowLike[] = [
  row(null, "tenant_admin", "accounts", "manage"),
  row(null, "onboarding_officer", "farmers", "write"),
  row(null, "onboarding_officer", "accounts", "read"),
  row(null, "field_agent", "farmers", "read"),
  row(null, "field_agent", "accounts", "none"),
  row(null, "field_agent", "produce", "read"),
  row(null, "viewer", "farmers", "read"),
];

describe("permission levels", () => {
  it("ranks levels", () => {
    expect(atLeast("manage", "write")).toBe(true);
    expect(atLeast("read", "write")).toBe(false);
    expect(atLeast("none", "none")).toBe(true);
  });
});

describe("effective permissions", () => {
  it("falls back to the platform default when no override exists", () => {
    expect(effectiveLevel(DEFAULTS, "onboarding_officer", "farmers", TENANT)).toBe("write");
  });

  it("returns none when neither an override nor a default exists", () => {
    expect(effectiveLevel(DEFAULTS, "field_agent", "insights", TENANT)).toBe("none");
    expect(effectiveLevel([], "field_agent", "farmers", TENANT)).toBe("none");
  });

  it("applies a tenant override over the default", () => {
    const rows = [...DEFAULTS, row(TENANT, "field_agent", "produce", "write")];
    expect(effectiveLevel(rows, "field_agent", "produce", TENANT)).toBe("write");
  });

  it("ignores an override belonging to another tenant", () => {
    const rows = [...DEFAULTS, row("other", "field_agent", "produce", "manage")];
    expect(effectiveLevel(rows, "field_agent", "produce", TENANT)).toBe("read");
  });

  it("clamps an over-generous override to the role ceiling", () => {
    const rows = [...DEFAULTS, row(TENANT, "field_agent", "accounts", "manage")];
    expect(effectiveLevel(rows, "field_agent", "accounts", TENANT)).toBe("none");
    const rows2 = [...DEFAULTS, row(TENANT, "onboarding_officer", "team", "manage")];
    expect(effectiveLevel(rows2, "onboarding_officer", "team", TENANT)).toBe("read");
  });

  it("never lets a viewer exceed read", () => {
    const rows = [...DEFAULTS, row(TENANT, "viewer", "accounts", "manage")];
    expect(effectiveLevel(rows, "viewer", "accounts", TENANT)).toBe("read");
  });

  it("grants platform admin manage everywhere", () => {
    expect(effectiveLevel([], "platform_admin", "accounts", TENANT)).toBe("manage");
    expect(roleCeiling("platform_admin", "team")).toBe("manage");
  });

  it("gives no access to a role that holds no workspace seat", () => {
    expect(roleCeiling("partner_developer" as AppRole, "farmers")).toBe("none");
  });

  it("takes the highest level across the actor's roles", () => {
    expect(
      effectiveLevelForRoles(DEFAULTS, ["field_agent", "onboarding_officer"], "farmers", TENANT),
    ).toBe("write");
  });
});

describe("matrix", () => {
  it("marks overridden and clamped cells", () => {
    const rows = [
      ...DEFAULTS,
      row(TENANT, "field_agent", "produce", "write"),
      row(TENANT, "field_agent", "accounts", "manage"),
    ];
    const matrix = buildMatrix(rows, TENANT);
    const produce = matrix.find((c) => c.role === "field_agent" && c.section === "produce")!;
    expect(produce.overridden).toBe(true);
    expect(produce.clamped).toBe(false);
    const accounts = matrix.find((c) => c.role === "field_agent" && c.section === "accounts")!;
    expect(accounts.clamped).toBe(true);
    expect(accounts.effective).toBe("none");
  });

  it("covers every workspace role and section", () => {
    const matrix = buildMatrix(DEFAULTS, TENANT);
    expect(matrix.length).toBe(14 * 4);
  });
});

describe("override authorization", () => {
  it("requires an organization admin", () => {
    expect(checkPermissionOverride("field_agent", "produce", "write", ["field_agent"])).toEqual({
      ok: false,
      reason: "not_authorized",
    });
    expect(
      checkPermissionOverride("field_agent", "produce", "write", ["tenant_admin"]).ok,
    ).toBe(true);
    expect(
      checkPermissionOverride("field_agent", "produce", "write", ["platform_admin"]).ok,
    ).toBe(true);
  });

  it("refuses non-delegable roles", () => {
    expect(
      checkPermissionOverride("auditor" as AppRole, "farmers", "read", ["tenant_admin"]),
    ).toEqual({ ok: false, reason: "role_not_delegable" });
  });

  it("refuses a level above the role ceiling", () => {
    expect(checkPermissionOverride("field_agent", "accounts", "read", ["tenant_admin"])).toEqual({
      ok: false,
      reason: "exceeds_role_ceiling",
    });
  });
});

describe("team role gates", () => {
  it("lets any workspace role view and only admins manage", () => {
    expect(canViewTeam(["field_agent"])).toBe(true);
    expect(canViewTeam([])).toBe(false);
    expect(canManageTeam(["field_agent"])).toBe(false);
    expect(canManageTeam(["tenant_admin"])).toBe(true);
    expect(isReadOnlyTeamRole(["auditor" as AppRole])).toBe(true);
    expect(isReadOnlyTeamRole(["platform_admin"])).toBe(false);
  });
});

describe("staff lifecycle", () => {
  it("allows only defined transitions", () => {
    expect(nextStaffStatuses("invited")).toEqual(["active", "removed"]);
    expect(canTransitionStaff("suspended", "active")).toBe(true);
    expect(canTransitionStaff("removed", "active")).toBe(false);
    expect(canTransitionStaff("invited", "suspended")).toBe(false);
    expect(nextStaffStatuses("removed")).toEqual([]);
  });
});

const NOW = new Date("2026-06-01T00:00:00Z");

const STAFF: StaffLike[] = [
  {
    id: "a",
    display_name: "Sailaja",
    staff_role: "tenant_admin",
    status: "active",
    district_scope: ["guntur"],
    last_reviewed_at: "2026-05-01T00:00:00Z",
  },
  {
    id: "b",
    display_name: "Ramesh",
    staff_role: "onboarding_officer",
    status: "active",
    district_scope: [],
    last_reviewed_at: "2025-01-01T00:00:00Z",
  },
  {
    id: "c",
    display_name: "Lavanya",
    staff_role: "field_agent",
    status: "invited",
    district_scope: ["guntur"],
    last_reviewed_at: "2026-05-20T00:00:00Z",
  },
  {
    id: "d",
    display_name: "Deepa",
    staff_role: "field_agent",
    status: "suspended",
    district_scope: ["karimnagar"],
    last_reviewed_at: "2026-05-20T00:00:00Z",
  },
  {
    id: "e",
    display_name: "Old",
    staff_role: "viewer",
    status: "removed",
    district_scope: [],
    last_reviewed_at: null,
    created_at: "2024-01-01T00:00:00Z",
  },
];

describe("staff summary and review due", () => {
  it("flags reviews older than the interval and never for removed staff", () => {
    expect(reviewDue(STAFF[1]!, NOW)).toBe(true);
    expect(reviewDue(STAFF[0]!, NOW)).toBe(false);
    expect(reviewDue(STAFF[4]!, NOW)).toBe(false);
    expect(
      reviewDue({ id: "x", display_name: "n", staff_role: "viewer", status: "active" }, NOW),
    ).toBe(true);
  });

  it("summarizes the directory", () => {
    const s = summarizeStaff(STAFF, NOW);
    expect(s).toEqual({
      total: 5,
      active: 2,
      invited: 1,
      suspended: 1,
      admins: 1,
      reviewDue: 1,
      unscoped: 1,
    });
  });

  it("puts review-due and suspended staff first", () => {
    const sorted = sortStaff(STAFF, NOW).map((s) => s.id);
    expect(sorted[0]).toBe("b");
    expect(sorted[1]).toBe("d");
    expect(sorted[sorted.length - 1]).toBe("e");
  });
});

describe("last admin guard", () => {
  it("refuses to suspend or remove the only active admin", () => {
    expect(lastAdminGuard(STAFF, "a", "suspended")).toEqual({
      ok: false,
      reason: "last_active_admin",
    });
    expect(lastAdminGuard(STAFF, "a", "removed").ok).toBe(false);
    expect(lastAdminGuard(STAFF, "a", "field_agent" as AppRole).ok).toBe(false);
  });

  it("allows it when another active admin remains", () => {
    const staff = [
      ...STAFF,
      {
        id: "f",
        display_name: "Second admin",
        staff_role: "tenant_admin" as AppRole,
        status: "active" as const,
        district_scope: ["guntur"],
        last_reviewed_at: "2026-05-01T00:00:00Z",
      },
    ];
    expect(lastAdminGuard(staff, "a", "removed").ok).toBe(true);
  });

  it("does not block non-admin or already inactive staff", () => {
    expect(lastAdminGuard(STAFF, "c", "removed").ok).toBe(true);
    expect(lastAdminGuard(STAFF, "d", "removed").ok).toBe(true);
    expect(lastAdminGuard(STAFF, "a", "active").ok).toBe(true);
    expect(lastAdminGuard(STAFF, "a", "tenant_admin").ok).toBe(true);
  });
});

describe("access review decisions", () => {
  it("maps decisions that imply a status change", () => {
    expect(statusForDecision("suspended")).toBe("suspended");
    expect(statusForDecision("removed")).toBe("removed");
    expect(statusForDecision("retained")).toBeNull();
    expect(statusForDecision("role_changed")).toBeNull();
  });
});
