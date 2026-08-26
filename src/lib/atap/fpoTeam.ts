/**
 * FPO Management & Operations workspace — Phase 9 pure domain logic
 * (team, delegated permissions and access reviews).
 *
 * Authority model, restated because it is the point of this phase:
 * - A workspace role is *technical* delegation inside one organization. It
 *   never confers government authority, support ownership or farmer-data
 *   access; farmer data stays default-deny and purpose-scoped (Phase 2).
 * - The permission matrix can only ever *narrow* what a role already holds
 *   platform-wide. A tenant override cannot invent authority a role does not
 *   have, and cannot grant admin-only capabilities to a non-admin role.
 * - Every gate here is re-evaluated server-side in `fpoTeam.functions.ts`;
 *   hiding a section in the UI is presentation only, never security.
 */
import { FPO_SECTIONS, type FpoSection } from "@/lib/atap/fpo";
import type { AppRole } from "@/lib/atap/policy";

export const TEAM_DISCLAIMER =
  "Workspace roles delegate work inside this organization only. They never grant " +
  "government authority, support ownership over another organization, or access to " +
  "farmer data — farmer data always requires a separate, purpose-scoped authorization.";

/* --------------------------------------------------------------- statuses */

export const STAFF_STATUSES = ["invited", "active", "suspended", "removed"] as const;
export type StaffStatus = (typeof STAFF_STATUSES)[number];

export const STAFF_STATUS_LABEL: Record<StaffStatus, string> = {
  invited: "Invited",
  active: "Active",
  suspended: "Suspended",
  removed: "Removed",
};

const STAFF_TRANSITIONS: Record<StaffStatus, StaffStatus[]> = {
  invited: ["active", "removed"],
  active: ["suspended", "removed"],
  suspended: ["active", "removed"],
  removed: [],
};

export function nextStaffStatuses(from: StaffStatus): StaffStatus[] {
  return [...STAFF_TRANSITIONS[from]];
}

export function canTransitionStaff(from: StaffStatus, to: StaffStatus): boolean {
  return STAFF_TRANSITIONS[from].includes(to);
}

/* ------------------------------------------------------------ permissions */

export const PERMISSION_LEVELS = ["none", "read", "write", "manage"] as const;
export type PermissionLevel = (typeof PERMISSION_LEVELS)[number];

export const PERMISSION_LEVEL_LABEL: Record<PermissionLevel, string> = {
  none: "No access",
  read: "Read only",
  write: "Record & update",
  manage: "Manage",
};

const LEVEL_RANK: Record<PermissionLevel, number> = { none: 0, read: 1, write: 2, manage: 3 };

export function atLeast(level: PermissionLevel, required: PermissionLevel): boolean {
  return LEVEL_RANK[level] >= LEVEL_RANK[required];
}

/** Roles that may hold a workspace seat at all. */
export const FPO_STAFF_ROLES: readonly AppRole[] = [
  "tenant_admin",
  "onboarding_officer",
  "field_agent",
  "viewer",
];

export const FPO_ADMIN_ROLES: readonly AppRole[] = ["tenant_admin", "platform_admin"];

/**
 * Ceiling a role can ever reach on a section, regardless of configuration.
 * This is the "configuration cannot escalate authority" guard: an override is
 * clamped to the ceiling, never above it.
 */
const ROLE_CEILING: Record<string, Partial<Record<FpoSection, PermissionLevel>>> = {
  tenant_admin: {},
  onboarding_officer: {
    accounts: "read",
    team: "read",
    settings: "read",
  },
  field_agent: {
    accounts: "none",
    team: "none",
    settings: "none",
    applications: "write",
    notifications: "read",
  },
  viewer: Object.fromEntries(FPO_SECTIONS.map((s) => [s, "read"])) as Partial<
    Record<FpoSection, PermissionLevel>
  >,
};

export function roleCeiling(role: AppRole, section: FpoSection): PermissionLevel {
  if (role === "platform_admin") return "manage";
  if (!FPO_STAFF_ROLES.includes(role)) return "none";
  const ceiling = ROLE_CEILING[role]?.[section];
  if (ceiling) return ceiling;
  return role === "viewer" ? "read" : "manage";
}

export interface PermissionRowLike {
  tenant_id: string | null;
  staff_role: AppRole;
  section: string;
  level: PermissionLevel;
}

/**
 * Effective level = tenant override when present, else platform default, else
 * "none" — then clamped to the role ceiling. Clamping happens last so a stale
 * or over-generous override cannot escalate.
 */
export function effectiveLevel(
  rows: readonly PermissionRowLike[],
  role: AppRole,
  section: FpoSection,
  tenantId: string,
): PermissionLevel {
  if (role === "platform_admin") return "manage";
  const override = rows.find(
    (r) => r.tenant_id === tenantId && r.staff_role === role && r.section === section,
  );
  const fallback = rows.find(
    (r) => r.tenant_id === null && r.staff_role === role && r.section === section,
  );
  const configured = override?.level ?? fallback?.level ?? "none";
  const ceiling = roleCeiling(role, section);
  return atLeast(configured, ceiling) ? ceiling : configured;
}

/** Highest level any of the actor's roles resolves to for a section. */
export function effectiveLevelForRoles(
  rows: readonly PermissionRowLike[],
  roles: readonly AppRole[],
  section: FpoSection,
  tenantId: string,
): PermissionLevel {
  let best: PermissionLevel = "none";
  for (const role of roles) {
    const level = effectiveLevel(rows, role, section, tenantId);
    if (LEVEL_RANK[level] > LEVEL_RANK[best]) best = level;
  }
  return best;
}

export interface MatrixCell {
  section: FpoSection;
  role: AppRole;
  configured: PermissionLevel;
  effective: PermissionLevel;
  ceiling: PermissionLevel;
  overridden: boolean;
  clamped: boolean;
}

/** Full role x section matrix for the configuration screen. */
export function buildMatrix(
  rows: readonly PermissionRowLike[],
  tenantId: string,
  roles: readonly AppRole[] = FPO_STAFF_ROLES,
): MatrixCell[] {
  const cells: MatrixCell[] = [];
  for (const section of FPO_SECTIONS) {
    for (const role of roles) {
      const override = rows.find(
        (r) => r.tenant_id === tenantId && r.staff_role === role && r.section === section,
      );
      const fallback = rows.find(
        (r) => r.tenant_id === null && r.staff_role === role && r.section === section,
      );
      const configured = override?.level ?? fallback?.level ?? "none";
      const ceiling = roleCeiling(role, section);
      const eff = effectiveLevel(rows, role, section, tenantId);
      cells.push({
        section,
        role,
        configured,
        effective: eff,
        ceiling,
        overridden: Boolean(override),
        clamped: eff !== configured,
      });
    }
  }
  return cells;
}

export type PermissionCheck =
  | { ok: true; clamped: boolean }
  | { ok: false; reason: "role_not_delegable" | "exceeds_role_ceiling" | "not_authorized" };

/**
 * Gate for writing a tenant override. Only an organization admin (or platform
 * admin) may configure, only workspace roles are configurable, and the
 * requested level must sit at or below the role ceiling.
 */
export function checkPermissionOverride(
  role: AppRole,
  section: FpoSection,
  level: PermissionLevel,
  actorRoles: readonly AppRole[],
): PermissionCheck {
  if (!actorRoles.some((r) => FPO_ADMIN_ROLES.includes(r))) {
    return { ok: false, reason: "not_authorized" };
  }
  if (!FPO_STAFF_ROLES.includes(role)) return { ok: false, reason: "role_not_delegable" };
  const ceiling = roleCeiling(role, section);
  if (!atLeast(ceiling, level)) return { ok: false, reason: "exceeds_role_ceiling" };
  return { ok: true, clamped: false };
}

/* ------------------------------------------------------------- role gates */

export function canViewTeam(roles: readonly AppRole[]): boolean {
  return roles.length > 0;
}

export function canManageTeam(roles: readonly AppRole[]): boolean {
  return roles.some((r) => FPO_ADMIN_ROLES.includes(r));
}

/** Auditors read the directory and the review trail; they never mutate it. */
export function isReadOnlyTeamRole(roles: readonly AppRole[]): boolean {
  return roles.length > 0 && !canManageTeam(roles);
}

/* ---------------------------------------------------------------- staff */

export interface StaffLike {
  id: string;
  display_name: string;
  designation?: string | null;
  staff_role: AppRole;
  status: StaffStatus;
  district_scope?: string[] | null;
  mandal_scope?: string[] | null;
  last_reviewed_at?: string | null;
  created_at?: string | null;
}

export interface StaffSummary {
  total: number;
  active: number;
  invited: number;
  suspended: number;
  admins: number;
  reviewDue: number;
  unscoped: number;
}

const REVIEW_INTERVAL_DAYS = 90;

export function reviewDue(staff: StaffLike, now = new Date()): boolean {
  if (staff.status === "removed") return false;
  const anchor = staff.last_reviewed_at ?? staff.created_at;
  if (!anchor) return true;
  const days = (now.getTime() - new Date(anchor).getTime()) / 86_400_000;
  return days >= REVIEW_INTERVAL_DAYS;
}

export function summarizeStaff(staff: readonly StaffLike[], now = new Date()): StaffSummary {
  const live = staff.filter((s) => s.status !== "removed");
  return {
    total: staff.length,
    active: staff.filter((s) => s.status === "active").length,
    invited: staff.filter((s) => s.status === "invited").length,
    suspended: staff.filter((s) => s.status === "suspended").length,
    admins: live.filter((s) => s.staff_role === "tenant_admin").length,
    reviewDue: live.filter((s) => reviewDue(s, now)).length,
    unscoped: live.filter((s) => (s.district_scope ?? []).length === 0).length,
  };
}

/**
 * An organization must never be left without an admin: removing or suspending
 * the last active admin is refused so the workspace stays governable.
 */
export function lastAdminGuard(
  staff: readonly StaffLike[],
  targetId: string,
  to: StaffStatus | AppRole,
): { ok: true } | { ok: false; reason: "last_active_admin" } {
  const target = staff.find((s) => s.id === targetId);
  if (!target || target.staff_role !== "tenant_admin" || target.status !== "active") {
    return { ok: true };
  }
  const losesAdmin =
    to === "suspended" || to === "removed" || (to !== "tenant_admin" && !isStatus(to));
  if (!losesAdmin) return { ok: true };
  const otherAdmins = staff.filter(
    (s) => s.id !== targetId && s.staff_role === "tenant_admin" && s.status === "active",
  );
  return otherAdmins.length > 0 ? { ok: true } : { ok: false, reason: "last_active_admin" };
}

function isStatus(value: string): value is StaffStatus {
  return (STAFF_STATUSES as readonly string[]).includes(value);
}

/** Directory ordering: attention first, then admins, then name. */
export function sortStaff(staff: readonly StaffLike[], now = new Date()): StaffLike[] {
  const statusWeight: Record<StaffStatus, number> = {
    suspended: 0,
    invited: 1,
    active: 2,
    removed: 3,
  };
  return [...staff].sort((a, b) => {
    const rd = Number(reviewDue(b, now)) - Number(reviewDue(a, now));
    if (rd !== 0) return rd;
    const sw = statusWeight[a.status] - statusWeight[b.status];
    if (sw !== 0) return sw;
    const ad = Number(b.staff_role === "tenant_admin") - Number(a.staff_role === "tenant_admin");
    if (ad !== 0) return ad;
    return a.display_name.localeCompare(b.display_name);
  });
}

/* -------------------------------------------------------- access reviews */

export const REVIEW_DECISIONS = [
  "retained",
  "role_changed",
  "scope_changed",
  "suspended",
  "removed",
] as const;
export type ReviewDecision = (typeof REVIEW_DECISIONS)[number];

export const REVIEW_DECISION_LABEL: Record<ReviewDecision, string> = {
  retained: "Access retained",
  role_changed: "Role changed",
  scope_changed: "Scope changed",
  suspended: "Access suspended",
  removed: "Access removed",
};

/** Status implied by a review decision, when the decision implies one. */
export function statusForDecision(decision: ReviewDecision): StaffStatus | null {
  if (decision === "suspended") return "suspended";
  if (decision === "removed") return "removed";
  return null;
}
