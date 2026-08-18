/**
 * B3 — FPO & government district MVP: pure, IO-free domain logic.
 *
 * Encodes the slice rules so they are directly unit-testable:
 *  - staff invites/delegations never escalate beyond tenant scope
 *  - FPO roster authority is not farmer-data authority
 *  - scheme rule changes are versioned, changelogged and audited
 *  - rule evaluation only recommends; the government human decides
 *  - prefill requires an active consent for the scheme purpose
 *  - FPO delegated purchasing stays off until D-08 is validated
 */
import type { AppRole, TenantType } from "@/lib/atap/policy";
import { PLATFORM_ONLY_ROLES, TENANT_SCOPED_ROLES } from "@/lib/atap/identity";
import { isFlagActive, type AtapEnv, type FlagDef, type FormValue, type FormValues } from "@/lib/atap/onboarding";

/* ------------------------------------------------- staff invites / delegation */

export type InvitationStatus = "pending" | "accepted" | "revoked" | "expired";

/** Which scoped roles an organisation of this type may delegate to its staff. */
const INVITABLE_BY_TENANT_TYPE: Record<TenantType, readonly AppRole[]> = {
  fpo: ["tenant_admin", "onboarding_officer", "field_agent", "viewer"],
  govt_dept: ["tenant_admin", "scheme_publisher", "scheme_reviewer", "onboarding_officer", "viewer"],
  bank: ["tenant_admin", "viewer"],
  insurer: ["tenant_admin", "viewer"],
  agri_business: ["tenant_admin", "viewer"],
  platform_ops: ["tenant_admin", "onboarding_officer", "viewer"],
};

export function invitableRoles(tenantType: TenantType): readonly AppRole[] {
  return INVITABLE_BY_TENANT_TYPE[tenantType] ?? [];
}

export interface InviteActor {
  isPlatformAdmin: boolean;
  tenantAdminOf: readonly string[];
}

export type InviteCheck =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "not_authorized"
        | "platform_role_requires_privileged_workflow"
        | "role_not_invitable_for_tenant_type"
        | "invalid_email";
    };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function checkStaffInvite(
  role: AppRole,
  tenantId: string,
  tenantType: TenantType,
  email: string,
  actor: InviteActor,
): InviteCheck {
  if (PLATFORM_ONLY_ROLES.includes(role)) {
    return { ok: false, reason: "platform_role_requires_privileged_workflow" };
  }
  if (!TENANT_SCOPED_ROLES.includes(role) || !invitableRoles(tenantType).includes(role)) {
    return { ok: false, reason: "role_not_invitable_for_tenant_type" };
  }
  if (!actor.isPlatformAdmin && !actor.tenantAdminOf.includes(tenantId)) {
    return { ok: false, reason: "not_authorized" };
  }
  if (!EMAIL_RE.test(email.trim()) || email.trim().length > 255) {
    return { ok: false, reason: "invalid_email" };
  }
  return { ok: true };
}

export interface InvitationLike {
  status: InvitationStatus;
  invited_email: string;
  expires_at: string;
}

export type AcceptCheck =
  | { ok: true }
  | { ok: false; reason: "invite_not_pending" | "invite_expired" | "invite_email_mismatch" };

export function checkInviteAcceptance(
  invite: InvitationLike,
  accepterEmail: string,
  now: Date = new Date(),
): AcceptCheck {
  if (invite.status !== "pending") return { ok: false, reason: "invite_not_pending" };
  if (new Date(invite.expires_at) <= now) return { ok: false, reason: "invite_expired" };
  if (invite.invited_email.trim().toLowerCase() !== accepterEmail.trim().toLowerCase()) {
    return { ok: false, reason: "invite_email_mismatch" };
  }
  return { ok: true };
}

/* ------------------------------------------------------- member bulk import */

export type MemberStatus = "invited" | "active" | "suspended" | "removed";

export interface ParsedMemberRow {
  member_ref: string;
  display_name: string;
  village_code: string | null;
  contact_hint: string | null;
}

export interface MemberRowError {
  line: number;
  raw: string;
  reason:
    | "missing_member_ref"
    | "missing_display_name"
    | "duplicate_in_file"
    | "duplicate_existing_member"
    | "too_many_columns"
    | "field_too_long";
}

export interface MemberImportPlan {
  accepted: ParsedMemberRow[];
  errors: MemberRowError[];
  rowCount: number;
}

export const MEMBER_IMPORT_ROW_LIMIT = 500;

/**
 * Bulk member onboarding: every rejected row keeps its line number and reason so
 * the FPO can fix and re-upload without duplicating accepted members.
 */
export function planMemberImport(
  input: string,
  existingRefs: readonly string[],
): MemberImportPlan {
  const existing = new Set(existingRefs.map((r) => r.trim().toLowerCase()));
  const seen = new Set<string>();
  const accepted: ParsedMemberRow[] = [];
  const errors: MemberRowError[] = [];

  const lines = input
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .slice(0, MEMBER_IMPORT_ROW_LIMIT);

  lines.forEach((raw, index) => {
    const line = index + 1;
    const cells = raw.split(",").map((c) => c.trim());
    if (cells.length > 4) {
      errors.push({ line, raw, reason: "too_many_columns" });
      return;
    }
    const [ref = "", name = "", village = "", contact = ""] = cells;
    if (ref.length === 0) {
      errors.push({ line, raw, reason: "missing_member_ref" });
      return;
    }
    if (name.length === 0) {
      errors.push({ line, raw, reason: "missing_display_name" });
      return;
    }
    if (ref.length > 64 || name.length > 120 || village.length > 64 || contact.length > 64) {
      errors.push({ line, raw, reason: "field_too_long" });
      return;
    }
    const key = ref.toLowerCase();
    if (seen.has(key)) {
      errors.push({ line, raw, reason: "duplicate_in_file" });
      return;
    }
    if (existing.has(key)) {
      errors.push({ line, raw, reason: "duplicate_existing_member" });
      return;
    }
    seen.add(key);
    accepted.push({
      member_ref: ref,
      display_name: name,
      village_code: village.length > 0 ? village : null,
      contact_hint: contact.length > 0 ? contact : null,
    });
  });

  return { accepted, errors, rowCount: lines.length };
}

/* ----------------------------------------------------------- roster scoping */

export interface RosterActor {
  userId: string;
  isPlatformAdmin: boolean;
  isAuditor: boolean;
  tenantRoles: ReadonlyArray<{ role: AppRole; tenant_id: string | null }>;
}

export function tenantRolesFor(actor: RosterActor, tenantId: string): AppRole[] {
  return actor.tenantRoles.filter((r) => r.tenant_id === tenantId).map((r) => r.role);
}

/** FPO staff may only read the roster of their own tenant. */
export function canReadRoster(actor: RosterActor, tenantId: string): boolean {
  if (actor.isPlatformAdmin || actor.isAuditor) return true;
  const roles = tenantRolesFor(actor, tenantId);
  return roles.some(
    (r) => r === "tenant_admin" || r === "onboarding_officer" || r === "field_agent",
  );
}

export function canManageRoster(actor: RosterActor, tenantId: string): boolean {
  if (actor.isPlatformAdmin) return true;
  const roles = tenantRolesFor(actor, tenantId);
  return roles.some((r) => r === "tenant_admin" || r === "onboarding_officer");
}

/**
 * Roster authority is membership administration only. It structurally cannot
 * return farmer purposes, so an FPO cannot read farm data via the roster.
 */
export function rosterGrantedPurposes(_actor: RosterActor, _tenantId: string): readonly string[] {
  return [];
}

/* ------------------------------------------------------------ scheme rules */

export type SchemeRuleOperator = "gte" | "lte" | "eq" | "in" | "exists";

export interface SchemeRule {
  key: string;
  label: string;
  field: string;
  operator: SchemeRuleOperator;
  value: FormValue;
  severity: "blocking" | "advisory";
}

export type RuleValidation = { ok: true } | { ok: false; reason: string };

export function validateSchemeRules(rules: readonly SchemeRule[]): RuleValidation {
  if (rules.length === 0) return { ok: false, reason: "rules_empty" };
  if (rules.length > 40) return { ok: false, reason: "too_many_rules" };
  const keys = new Set<string>();
  for (const rule of rules) {
    if (!rule.key || !rule.field || !rule.label) return { ok: false, reason: "rule_incomplete" };
    if (keys.has(rule.key)) return { ok: false, reason: "rule_key_duplicated" };
    keys.add(rule.key);
    if (rule.operator === "in" && !Array.isArray(rule.value)) {
      return { ok: false, reason: "rule_in_requires_list" };
    }
    if (
      (rule.operator === "gte" || rule.operator === "lte") &&
      typeof rule.value !== "number"
    ) {
      return { ok: false, reason: "rule_threshold_requires_number" };
    }
  }
  return { ok: true };
}

export interface RuleCheckResult {
  key: string;
  label: string;
  severity: SchemeRule["severity"];
  passed: boolean;
  detail: string;
}

export interface SchemeEvaluation {
  checks: RuleCheckResult[];
  /** Recommendation only. A government human always decides. */
  recommendation: "recommend_approve" | "recommend_reject" | "needs_information";
  requiresHumanDecision: true;
}

export function evaluateSchemeRules(
  rules: readonly SchemeRule[],
  values: FormValues,
): SchemeEvaluation {
  const checks: RuleCheckResult[] = [];
  let missing = false;

  for (const rule of rules) {
    const raw = values[rule.field];
    const present = raw !== undefined && raw !== null && raw !== "";
    let passed = false;
    let detail = "";

    if (!present) {
      missing = true;
      detail = "value_missing";
    } else {
      switch (rule.operator) {
        case "exists":
          passed = true;
          detail = "present";
          break;
        case "eq":
          passed = String(raw) === String(rule.value);
          detail = `${String(raw)} vs ${String(rule.value)}`;
          break;
        case "in":
          passed = Array.isArray(rule.value) && rule.value.map(String).includes(String(raw));
          detail = `${String(raw)} in list`;
          break;
        case "gte":
          passed = Number(raw) >= Number(rule.value);
          detail = `${String(raw)} >= ${String(rule.value)}`;
          break;
        case "lte":
          passed = Number(raw) <= Number(rule.value);
          detail = `${String(raw)} <= ${String(rule.value)}`;
          break;
      }
    }
    checks.push({ key: rule.key, label: rule.label, severity: rule.severity, passed, detail });
  }

  const blockingFailed = checks.some((c) => c.severity === "blocking" && !c.passed);
  const recommendation = missing
    ? "needs_information"
    : blockingFailed
      ? "recommend_reject"
      : "recommend_approve";

  return { checks, recommendation, requiresHumanDecision: true };
}

/* --------------------------------------------------------- scheme versions */

export interface SchemeVersionPlan {
  version: number;
  changelog: string;
}

export type VersionPlanResult =
  | { ok: true; plan: SchemeVersionPlan }
  | {
      ok: false;
      reason: "not_authorized" | "changelog_required" | "rules_invalid" | "scheme_closed";
    };

export interface SchemePublisherActor {
  isPlatformAdmin: boolean;
  schemePublisherOf: readonly string[];
}

/**
 * Every rule change is a NEW version. Existing versions are never mutated, so
 * an application always resolves the exact rules it was decided against.
 */
export function planSchemeVersion(
  input: {
    tenantId: string;
    schemeStatus: "draft" | "published" | "closed";
    currentVersion: number;
    rules: readonly SchemeRule[];
    changelog: string;
  },
  actor: SchemePublisherActor,
): VersionPlanResult {
  if (!actor.isPlatformAdmin && !actor.schemePublisherOf.includes(input.tenantId)) {
    return { ok: false, reason: "not_authorized" };
  }
  if (input.schemeStatus === "closed") return { ok: false, reason: "scheme_closed" };
  const changelog = input.changelog.trim();
  if (changelog.length < 4 || changelog.length > 500) {
    return { ok: false, reason: "changelog_required" };
  }
  const valid = validateSchemeRules(input.rules);
  if (!valid.ok) return { ok: false, reason: "rules_invalid" };
  return { ok: true, plan: { version: input.currentVersion + 1, changelog } };
}

/* ------------------------------------------------------------- prefill */

export const SCHEME_PURPOSE_CODE = "scheme_eligibility";

export interface FarmProfileLike {
  label: string;
  plot_ref: string;
  village_code: string | null;
  primary_crop: string | null;
  area_acres: number | null;
}

export interface PrefillResult {
  values: FormValues;
  source: "consented_farm_profile" | "none";
  blockedReason: "baseline_consent_missing" | "no_farm_profile" | null;
}

/**
 * Prefill is a farmer-data read, so it needs an active baseline consent. Without
 * it the application still works — the farmer just types the values.
 */
export function prefillFromFarmProfile(
  farm: FarmProfileLike | null,
  baselineConsentActive: boolean,
): PrefillResult {
  if (!baselineConsentActive) {
    return { values: {}, source: "none", blockedReason: "baseline_consent_missing" };
  }
  if (!farm) return { values: {}, source: "none", blockedReason: "no_farm_profile" };
  return {
    source: "consented_farm_profile",
    blockedReason: null,
    values: {
      farm_label: farm.label,
      plot_ref: farm.plot_ref,
      village_code: farm.village_code,
      primary_crop: farm.primary_crop,
      land_area_acres: farm.area_acres,
    },
  };
}

/* ------------------------------------------------------ review / decision */

export type SchemeApplicationStatus =
  | "draft"
  | "submitted"
  | "in_review"
  | "approved"
  | "rejected"
  | "withdrawn";

const APPLICATION_TRANSITIONS: Record<SchemeApplicationStatus, readonly SchemeApplicationStatus[]> =
  {
    draft: ["submitted", "withdrawn"],
    submitted: ["in_review", "withdrawn"],
    in_review: ["approved", "rejected"],
    approved: [],
    rejected: [],
    withdrawn: [],
  };

export interface ReviewActor {
  userId: string;
  isPlatformAdmin: boolean;
  schemeReviewerOf: readonly string[];
}

export type ApplicationTransition =
  | { ok: true; next: SchemeApplicationStatus }
  | {
      ok: false;
      reason:
        | "invalid_transition"
        | "not_authorized"
        | "decision_note_required"
        | "applicant_cannot_decide";
    };

/**
 * Government decisions are human decisions: only a scoped scheme_reviewer may
 * move an application to approved/rejected, and never on their own application.
 */
export function planApplicationTransition(input: {
  current: SchemeApplicationStatus;
  next: SchemeApplicationStatus;
  schemeTenantId: string;
  applicantUserId: string;
  decisionNote: string;
  actor: ReviewActor;
}): ApplicationTransition {
  if (!APPLICATION_TRANSITIONS[input.current].includes(input.next)) {
    return { ok: false, reason: "invalid_transition" };
  }
  const reviewerStates: SchemeApplicationStatus[] = ["in_review", "approved", "rejected"];
  if (!reviewerStates.includes(input.next)) return { ok: true, next: input.next };

  const authorized =
    input.actor.isPlatformAdmin || input.actor.schemeReviewerOf.includes(input.schemeTenantId);
  if (!authorized) return { ok: false, reason: "not_authorized" };
  if (input.actor.userId === input.applicantUserId) {
    return { ok: false, reason: "applicant_cannot_decide" };
  }
  if (
    (input.next === "approved" || input.next === "rejected") &&
    input.decisionNote.trim().length < 4
  ) {
    return { ok: false, reason: "decision_note_required" };
  }
  return { ok: true, next: input.next };
}

/* ---------------------------------------------------------- role training */

export interface TrainingItem {
  key: string;
  label: string;
  required: boolean;
}

export interface TrainingChecklist {
  code: string;
  label: string;
  appliesToRoles: readonly AppRole[];
  items: readonly TrainingItem[];
}

export const TRAINING_CHECKLISTS: readonly TrainingChecklist[] = [
  {
    code: "fpo_staff_v1",
    label: "FPO staff readiness",
    appliesToRoles: ["tenant_admin", "onboarding_officer", "field_agent"],
    items: [
      { key: "roster_vs_farm_data", label: "Roster access is not farm-data access", required: true },
      { key: "assisted_consent", label: "Consent is taken from the farmer, never on their behalf", required: true },
      { key: "member_data_errors", label: "Handling rejected rows in bulk member import", required: true },
      { key: "no_purchasing", label: "Delegated purchasing authority is not available (D-08)", required: true },
      { key: "escalation", label: "When to escalate to a verification case", required: false },
    ],
  },
  {
    code: "govt_staff_v1",
    label: "Government staff readiness",
    appliesToRoles: ["scheme_publisher", "scheme_reviewer", "viewer"],
    items: [
      { key: "rule_versioning", label: "Rule changes create a new audited version", required: true },
      { key: "human_decision", label: "Rule output is a recommendation; the officer decides", required: true },
      { key: "traceable_result", label: "Every decision needs a traceable note", required: true },
      { key: "scoped_access", label: "Scoped roles: publisher, reviewer, viewer", required: true },
    ],
  },
  {
    code: "field_staff_v1",
    label: "Field staff readiness",
    appliesToRoles: ["field_agent"],
    items: [
      { key: "actor_subject", label: "Assisted capture records actor and subject separately", required: true },
      { key: "offline_sync", label: "Offline drafts and deferred sync", required: true },
      { key: "identity_fallback", label: "Manual review fallback when identity check fails", required: true },
    ],
  },
];

export function checklistsForRoles(roles: readonly AppRole[]): TrainingChecklist[] {
  return TRAINING_CHECKLISTS.filter((c) => c.appliesToRoles.some((r) => roles.includes(r)));
}

export interface TrainingProgress {
  code: string;
  label: string;
  completed: number;
  total: number;
  requiredOutstanding: string[];
  ready: boolean;
}

export function trainingProgress(
  checklist: TrainingChecklist,
  completedKeys: readonly string[],
): TrainingProgress {
  const done = new Set(completedKeys);
  const requiredOutstanding = checklist.items
    .filter((i) => i.required && !done.has(i.key))
    .map((i) => i.key);
  return {
    code: checklist.code,
    label: checklist.label,
    completed: checklist.items.filter((i) => done.has(i.key)).length,
    total: checklist.items.length,
    requiredOutstanding,
    ready: requiredOutstanding.length === 0,
  };
}

/* -------------------------------------------------------- district rollout */

export type RolloutStatus = "planned" | "configuring" | "piloting" | "live" | "paused";

export interface RolloutChecklistItem {
  key: string;
  label: string;
  done: boolean;
}

export interface RolloutReadiness {
  total: number;
  done: number;
  percent: number;
  outstanding: string[];
  canGoLive: boolean;
}

export function rolloutReadiness(items: readonly RolloutChecklistItem[]): RolloutReadiness {
  const total = items.length;
  const done = items.filter((i) => i.done).length;
  const outstanding = items.filter((i) => !i.done).map((i) => i.key);
  return {
    total,
    done,
    percent: total === 0 ? 0 : Math.round((done / total) * 100),
    outstanding,
    canGoLive: total > 0 && outstanding.length === 0,
  };
}

/** District rollout stays a district. No state/national aggregation in B3. */
export const ROLLOUT_SCOPE_LEVELS = ["district", "block", "village"] as const;

export function isRolloutScopeAllowed(level: string): boolean {
  return (ROLLOUT_SCOPE_LEVELS as readonly string[]).includes(level);
}

/* ----------------------------------------------- D-08 delegated purchasing */

export const DELEGATED_PURCHASING_FLAG = "fpo.delegated_purchasing";

/**
 * D-08 is unvalidated, so delegated purchasing authority is disabled. Even with
 * the flag forced on, this returns false outside development.
 */
export function delegatedPurchasingAllowed(flags: FlagDef[], env: AtapEnv): boolean {
  if (env === "production") return false;
  return isFlagActive(flags, DELEGATED_PURCHASING_FLAG, env);
}
