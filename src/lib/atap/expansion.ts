/**
 * B6 — multi-district repeatability & first service expansion.
 *
 * Pure, side-effect-free rules. Two invariants dominate this module:
 *  - Scaling is *configuration*, never a fork: cloning a district template may
 *    only vary configuration values, never code identity.
 *  - A service domain activates only when a specific evidence gate is approved,
 *    its verification checks exist and its dispute categories exist. Nothing
 *    activates implicitly, and no activated domain may lack a dispute flow.
 */

export type EvidenceGateState = "not_evaluated" | "evidence_pending" | "approved" | "rejected";
export type ServiceProviderState =
  | "draft"
  | "submitted"
  | "verification"
  | "approved"
  | "rejected"
  | "suspended";
export type CertificationState =
  | "draft"
  | "submitted"
  | "in_review"
  | "certified"
  | "declined"
  | "revoked";
export type SupportCaseStatus =
  | "new"
  | "triaged"
  | "in_progress"
  | "waiting_customer"
  | "resolved"
  | "closed";

/* ------------------------------------------------- district template clones */

export interface DistrictTemplate {
  code: string;
  version: number;
  default_locale: string;
  locales: string[];
  scheme_codes: string[];
  local_roles: string[];
  checklist: Array<{ key: string; label: string; required: boolean }>;
  config: Record<string, string | number | boolean>;
  is_active: boolean;
}

export interface CloneRequest {
  template: DistrictTemplate;
  geographyId: string;
  geographyLevel: string;
  locale: string;
  schemeCodes?: string[];
  localRoles?: string[];
  configOverrides?: Record<string, string | number | boolean>;
}

export interface ClonePlan {
  ok: boolean;
  errors: string[];
  /** Configuration actually written for the new district. */
  appliedConfig: Record<string, string | number | boolean>;
  locale: string;
  schemeCodes: string[];
  localRoles: string[];
  checklist: Array<{ key: string; label: string; required: boolean; complete: boolean }>;
  /** Always false: repeatability is configuration, not a code fork. */
  forkedCode: boolean;
  templateVersion: number;
}

/** Local roles a district clone may configure. Farmer data authority is never cloned. */
export const CLONEABLE_LOCAL_ROLES = [
  "tenant_admin",
  "onboarding_officer",
  "field_agent",
  "scheme_publisher",
  "scheme_reviewer",
  "viewer",
] as const;

export const CLONE_GEOGRAPHY_LEVELS = ["district", "block"] as const;

export function planDistrictClone(req: CloneRequest): ClonePlan {
  const errors: string[] = [];
  const t = req.template;
  if (!t.is_active) errors.push("template_inactive");
  if (!CLONE_GEOGRAPHY_LEVELS.includes(req.geographyLevel as "district")) {
    errors.push("geography_level_not_cloneable");
  }
  if (!req.geographyId) errors.push("geography_required");

  const locale = req.locale || t.default_locale;
  if (!t.locales.includes(locale)) errors.push("locale_not_in_template");

  const schemeCodes = req.schemeCodes ?? t.scheme_codes;
  const unknownSchemes = schemeCodes.filter((c) => !t.scheme_codes.includes(c));
  if (unknownSchemes.length > 0) errors.push(`scheme_not_in_template:${unknownSchemes.join(",")}`);

  const localRoles = req.localRoles ?? t.local_roles;
  const badRoles = localRoles.filter(
    (r) => !(CLONEABLE_LOCAL_ROLES as readonly string[]).includes(r),
  );
  if (badRoles.length > 0) errors.push(`role_not_cloneable:${badRoles.join(",")}`);

  const appliedConfig: Record<string, string | number | boolean> = { ...t.config, ...(req.configOverrides ?? {}) };

  return {
    ok: errors.length === 0,
    errors,
    appliedConfig,
    locale,
    schemeCodes,
    localRoles,
    checklist: t.checklist.map((c) => ({ ...c, complete: false })),
    forkedCode: false,
    templateVersion: t.version,
  };
}

/* ------------------------------------------------- effort instrumentation */

export interface EffortMetric {
  rollout_id: string;
  phase: string;
  person_days: number;
  cost_amount: number;
  onboarded_count: number;
  is_operational: boolean;
}

export interface EffortSummary {
  rolloutId: string;
  personDays: number;
  cost: number;
  onboarded: number;
  personDaysPerOnboarding: number | null;
  operational: boolean;
}

export function summariseEffort(rolloutId: string, metrics: readonly EffortMetric[]): EffortSummary {
  const rows = metrics.filter((m) => m.rollout_id === rolloutId);
  const personDays = rows.reduce((a, m) => a + m.person_days, 0);
  const cost = rows.reduce((a, m) => a + m.cost_amount, 0);
  const onboarded = rows.reduce((a, m) => a + m.onboarded_count, 0);
  return {
    rolloutId,
    personDays,
    cost,
    onboarded,
    personDaysPerOnboarding: onboarded > 0 ? personDays / onboarded : null,
    operational: rows.length > 0 && rows.every((m) => m.is_operational),
  };
}

export type EffortVerdict =
  | { status: "insufficient_data"; reason: string }
  | {
      status: "compared";
      baseline: EffortSummary;
      candidate: EffortSummary;
      improvementPct: number;
      materiallyLower: boolean;
    };

/** A drop of at least this share counts as "materially lower" onboarding effort. */
export const MATERIAL_EFFORT_IMPROVEMENT = 0.15;

/**
 * Acceptance-gate primitive: district #2 must show materially lower effort per
 * onboarding — but only once operational (non-projected) data exists. Without
 * it we report insufficient data rather than claiming success.
 */
export function compareDistrictEffort(input: {
  baselineRolloutId: string;
  candidateRolloutId: string;
  metrics: readonly EffortMetric[];
}): EffortVerdict {
  const baseline = summariseEffort(input.baselineRolloutId, input.metrics);
  const candidate = summariseEffort(input.candidateRolloutId, input.metrics);
  if (!baseline.operational || !candidate.operational) {
    return { status: "insufficient_data", reason: "operational_data_missing" };
  }
  if (baseline.personDaysPerOnboarding === null || candidate.personDaysPerOnboarding === null) {
    return { status: "insufficient_data", reason: "no_onboarding_volume" };
  }
  const improvementPct =
    (baseline.personDaysPerOnboarding - candidate.personDaysPerOnboarding) /
    baseline.personDaysPerOnboarding;
  return {
    status: "compared",
    baseline,
    candidate,
    improvementPct,
    materiallyLower: improvementPct >= MATERIAL_EFFORT_IMPROVEMENT,
  };
}

/* ------------------------------------------------- service subtype gating */

export interface ServiceSubtypeConfig {
  code: string;
  domain: string;
  evidence_gate: EvidenceGateState;
  verification_checks: Array<{ code: string; label: string }>;
  dispute_categories: string[];
  requires_human_decision: boolean;
  is_active: boolean;
  flagEnabled: boolean;
}

export interface ActivationDecision {
  ok: boolean;
  errors: string[];
}

/**
 * A subtype may only be activated when its evidence gate is explicitly
 * approved AND it carries both verification checks and a dispute flow. Bulk
 * "activate everything" is impossible by construction: each subtype needs its
 * own approved gate.
 */
export function evaluateSubtypeActivation(input: {
  subtype: Pick<
    ServiceSubtypeConfig,
    "evidence_gate" | "verification_checks" | "dispute_categories" | "requires_human_decision"
  >;
}): ActivationDecision {
  const errors: string[] = [];
  const s = input.subtype;
  if (s.evidence_gate !== "approved") errors.push("evidence_gate_not_approved");
  if (s.verification_checks.length === 0) errors.push("verification_checks_missing");
  if (s.dispute_categories.length === 0) errors.push("dispute_flow_missing");
  if (!s.requires_human_decision) errors.push("human_decision_required");
  return { ok: errors.length === 0, errors };
}

/** Domains explicitly out of scope for B6 regardless of configuration. */
export const OUT_OF_SCOPE_DOMAINS = ["export_marketplace", "talent", "jobs", "labour_export"];

export function isDomainInScope(domain: string): boolean {
  return !OUT_OF_SCOPE_DOMAINS.some((d) => domain.toLowerCase().includes(d));
}

/** Only subtypes that are active AND flag-enabled AND evidence-approved are usable. */
export function usableSubtypes(subtypes: readonly ServiceSubtypeConfig[]): ServiceSubtypeConfig[] {
  return subtypes.filter(
    (s) =>
      s.is_active &&
      s.flagEnabled &&
      isDomainInScope(s.domain) &&
      evaluateSubtypeActivation({ subtype: s }).ok,
  );
}

/* ------------------------------------------------- provider onboarding */

export interface ProviderDraft {
  subtypeCode: string;
  displayName: string;
  contactEmail: string;
  serviceRegions: string[];
}

export interface ProviderCheckRow {
  check_code: string;
  status: string;
}

export type ProviderCheck = { ok: true } | { ok: false; errors: string[] };

export function checkProviderSubmit(input: {
  draft: ProviderDraft;
  subtype: ServiceSubtypeConfig | null;
}): ProviderCheck {
  const errors: string[] = [];
  const { draft, subtype } = input;
  if (!subtype) errors.push("subtype_unknown");
  else if (usableSubtypes([subtype]).length === 0) errors.push("subtype_not_activated");
  if (draft.displayName.trim().length < 3) errors.push("display_name_too_short");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(draft.contactEmail.trim())) errors.push("contact_email_invalid");
  if (draft.serviceRegions.length === 0) errors.push("service_region_required");
  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}

export interface ProviderApprovalPlan {
  ok: boolean;
  errors: string[];
  nextState: ServiceProviderState;
  /** Always true: provider approval is a human decision, never automatic. */
  requiresHumanDecision: boolean;
}

export function planProviderApproval(input: {
  subtype: ServiceSubtypeConfig | null;
  currentState: ServiceProviderState;
  checks: readonly ProviderCheckRow[];
  reviewerIsAuthorized: boolean;
  decision: "approved" | "rejected" | "suspended";
  note: string;
}): ProviderApprovalPlan {
  const errors: string[] = [];
  if (!input.reviewerIsAuthorized) errors.push("not_authorized");
  if (input.note.trim().length < 10) errors.push("decision_note_required");
  if (!input.subtype) errors.push("subtype_unknown");
  if (input.currentState === "draft") errors.push("provider_not_submitted");

  if (input.decision === "approved" && input.subtype) {
    const required = input.subtype.verification_checks.map((c) => c.code);
    const passed = new Set(
      input.checks.filter((c) => c.status === "passed").map((c) => c.check_code),
    );
    const missing = required.filter((code) => !passed.has(code));
    if (missing.length > 0) errors.push(`checks_incomplete:${missing.join(",")}`);
  }

  return {
    ok: errors.length === 0,
    errors,
    nextState: errors.length === 0 ? input.decision : input.currentState,
    requiresHumanDecision: true,
  };
}

/* ------------------------------------------------- service disputes */

export interface ServiceDisputeRoute {
  ok: boolean;
  errors: string[];
  status: "human_review";
  /** No automated resolution path exists for any activated domain. */
  autoResolved: false;
}

export function routeServiceDispute(input: {
  subtype: ServiceSubtypeConfig | null;
  category: string;
  summary: string;
  actorIsParty: boolean;
}): ServiceDisputeRoute {
  const errors: string[] = [];
  if (!input.actorIsParty) errors.push("not_engagement_party");
  if (!input.subtype) errors.push("subtype_unknown");
  else if (!input.subtype.dispute_categories.includes(input.category)) {
    errors.push("dispute_category_not_configured");
  }
  if (input.summary.trim().length < 20) errors.push("summary_too_short");
  return { ok: errors.length === 0, errors, status: "human_review", autoResolved: false };
}

/* ------------------------------------------------- partner certification */

export interface CertificationCriterion {
  code: string;
  label: string;
  met: boolean;
  evidenceRef?: string | null;
}

export const CERTIFICATION_PROGRAMMES: Record<string, readonly string[]> = {
  partner_api_certified: [
    "sandbox_conformance",
    "consent_handling_review",
    "security_questionnaire",
    "support_contact_published",
  ],
  service_provider_certified: [
    "verification_checks_passed",
    "dispute_sla_commitment",
    "field_reference_check",
  ],
};

export interface CertificationEvaluation {
  eligible: boolean;
  missing: string[];
  /** Badge award is always a recorded human decision. */
  requiresHumanDecision: true;
}

export function evaluateCertification(input: {
  programmeCode: string;
  criteria: readonly CertificationCriterion[];
}): CertificationEvaluation {
  const required = CERTIFICATION_PROGRAMMES[input.programmeCode] ?? [];
  const met = new Set(input.criteria.filter((c) => c.met).map((c) => c.code));
  const missing = required.filter((code) => !met.has(code));
  return { eligible: required.length > 0 && missing.length === 0, missing, requiresHumanDecision: true };
}

export interface BadgeState {
  visible: boolean;
  reason: string;
}

export function certifiedBadgeVisible(input: {
  state: CertificationState;
  badgeExpiresAt: string | null;
  now: Date;
}): BadgeState {
  if (input.state !== "certified") return { visible: false, reason: "not_certified" };
  if (input.badgeExpiresAt && new Date(input.badgeExpiresAt) <= input.now) {
    return { visible: false, reason: "badge_expired" };
  }
  return { visible: true, reason: "certified" };
}

/* ------------------------------------------------- support routing */

export type Severity = "low" | "normal" | "high" | "critical";

export interface SupportRoute {
  queue: string;
  slaHours: number;
  requiresHumanOwner: true;
}

/**
 * Scale support routing: queue and SLA follow case type and severity only —
 * never the customer's commercial plan.
 */
export function routeSupportCase(input: {
  caseType: string;
  severity: Severity;
  hasManagedOnboarding: boolean;
}): SupportRoute {
  const sla: Record<Severity, number> = { low: 72, normal: 48, high: 8, critical: 2 };
  let queue = "tier1_support";
  if (input.caseType === "managed_onboarding" || input.hasManagedOnboarding) {
    queue = "customer_success";
  }
  if (input.severity === "high" || input.severity === "critical") queue = "tier2_escalation";
  if (input.caseType === "trust_safety") queue = "trust_safety";
  return { queue, slaHours: sla[input.severity], requiresHumanOwner: true };
}

export const SUPPORT_TRANSITIONS: Record<SupportCaseStatus, SupportCaseStatus[]> = {
  new: ["triaged", "closed"],
  triaged: ["in_progress", "waiting_customer", "closed"],
  in_progress: ["waiting_customer", "resolved", "closed"],
  waiting_customer: ["in_progress", "closed"],
  resolved: ["closed", "in_progress"],
  closed: [],
};

export function planSupportTransition(input: {
  current: SupportCaseStatus;
  next: SupportCaseStatus;
  actorIsSupport: boolean;
  note: string;
}): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!input.actorIsSupport) errors.push("not_authorized");
  if (!SUPPORT_TRANSITIONS[input.current].includes(input.next)) errors.push("invalid_transition");
  if ((input.next === "resolved" || input.next === "closed") && input.note.trim().length < 10) {
    errors.push("resolution_note_required");
  }
  return { ok: errors.length === 0, errors };
}

/* ------------------------------------------------- operational dashboard */

export interface ExpansionDashboard {
  districts: number;
  clonedDistricts: number;
  forkedDistricts: number;
  activatedSubtypes: number;
  pendingEvidenceGates: number;
  providersInVerification: number;
  disputesInHumanReview: number;
  openSupportCases: number;
  breachedSupportCases: number;
}

export function summariseExpansion(input: {
  rolloutIds: readonly string[];
  clones: ReadonlyArray<{ rollout_id: string; forked_code: boolean }>;
  subtypes: readonly ServiceSubtypeConfig[];
  providers: ReadonlyArray<{ state: ServiceProviderState }>;
  disputes: ReadonlyArray<{ status: string }>;
  supportCases: ReadonlyArray<{ status: SupportCaseStatus; sla_hours: number; created_at: string }>;
  now: Date;
}): ExpansionDashboard {
  const clonedIds = new Set(input.clones.map((c) => c.rollout_id));
  const open = input.supportCases.filter((c) => c.status !== "closed" && c.status !== "resolved");
  return {
    districts: input.rolloutIds.length,
    clonedDistricts: input.rolloutIds.filter((id) => clonedIds.has(id)).length,
    forkedDistricts: input.clones.filter((c) => c.forked_code).length,
    activatedSubtypes: usableSubtypes(input.subtypes).length,
    pendingEvidenceGates: input.subtypes.filter(
      (s) => s.evidence_gate === "not_evaluated" || s.evidence_gate === "evidence_pending",
    ).length,
    providersInVerification: input.providers.filter(
      (p) => p.state === "submitted" || p.state === "verification",
    ).length,
    disputesInHumanReview: input.disputes.filter((d) => d.status === "human_review").length,
    openSupportCases: open.length,
    breachedSupportCases: open.filter(
      (c) =>
        input.now.getTime() - new Date(c.created_at).getTime() > c.sla_hours * 3600 * 1000,
    ).length,
  };
}
