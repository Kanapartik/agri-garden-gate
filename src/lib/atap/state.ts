/**
 * B7 — state institutions, knowledge, research and post-harvest expansion.
 *
 * Pure, side-effect-free rules. Invariants of this slice:
 *  - Knowledge cannot publish, become training content or ground AI until an
 *    *other* human reviewer approved it (separation of duties).
 *  - Research and policy access is aggregate and de-identified by construction:
 *    a cohort smaller than the configured minimum is suppressed, and raw
 *    farmer rows are never an option.
 *  - A state configuration governs only its own tenant/geography subtree; it
 *    can never widen access to another tenant's data.
 *  - Post-harvest domains activate only through the B6 evidence gate and always
 *    carry a human-decided contract/dispute path.
 */

export type KnowledgeKind = "university" | "kvk" | "extension_centre" | "state_training_cell";
export type KnowledgeStatus =
  | "draft"
  | "submitted"
  | "in_review"
  | "approved"
  | "published"
  | "rejected"
  | "withdrawn";
export type ResearchRequestStatus =
  | "draft"
  | "submitted"
  | "ethics_review"
  | "approved"
  | "rejected"
  | "expired"
  | "revoked";
export type PostharvestKind = "warehouse" | "cold_storage" | "processor";
export type ContractStatus =
  | "draft"
  | "proposed"
  | "accepted"
  | "active"
  | "completed"
  | "cancelled"
  | "disputed";

/** Floor for any aggregate disclosure, whatever a tenant configures. */
export const PLATFORM_MIN_COHORT = 10;

/* --------------------------------------------------------------- state config */

export interface StateConfigRequest {
  tenantId: string;
  tenantType: string;
  /** Geography the state governs; must be a state-level node. */
  geographyLevel: string;
  defaultLocale: string;
  locales: string[];
  enabledFlags: string[];
  aggregationMinCohort: number;
  /** Flags the platform allows a state tenant to toggle for itself. */
  allowedFlags: string[];
  requestedRawFarmerAccess?: boolean;
}

export interface StateConfigPlan {
  ok: boolean;
  errors: string[];
  defaultLocale: string;
  locales: string[];
  enabledFlags: string[];
  aggregationMinCohort: number;
  /** Always false — non-negotiable: no raw farmer access for state/policy roles. */
  allowsRawFarmerAccess: false;
  /** Tenant ids this configuration may affect. Always exactly its own tenant. */
  scopedTenantIds: string[];
}

export const STATE_GOVERNABLE_FLAGS = [
  "state.tenant_configuration",
  "knowledge.contribution",
  "research.aggregate_access",
  "policy.aggregate_dashboard",
  "expansion.district_templates",
] as const;

export function planStateConfiguration(req: StateConfigRequest): StateConfigPlan {
  const errors: string[] = [];
  if (!req.tenantId) errors.push("tenant_required");
  if (req.tenantType !== "govt_dept" && req.tenantType !== "platform_ops") {
    errors.push("tenant_type_not_state_capable");
  }
  if (req.geographyLevel !== "state") errors.push("geography_level_must_be_state");

  const locales = Array.from(new Set(req.locales.filter(Boolean)));
  if (locales.length === 0) errors.push("locale_required");
  const defaultLocale = req.defaultLocale || locales[0] || "en";
  if (locales.length > 0 && !locales.includes(defaultLocale)) errors.push("default_locale_not_offered");

  const unknownFlags = req.enabledFlags.filter((f) => !req.allowedFlags.includes(f));
  if (unknownFlags.length > 0) errors.push(`flag_not_state_governable:${unknownFlags.join(",")}`);

  const min = Math.max(req.aggregationMinCohort, PLATFORM_MIN_COHORT);
  if (req.aggregationMinCohort < PLATFORM_MIN_COHORT) errors.push("aggregation_min_below_platform_floor");
  if (req.requestedRawFarmerAccess) errors.push("raw_farmer_access_not_grantable");

  return {
    ok: errors.length === 0,
    errors,
    defaultLocale,
    locales,
    enabledFlags: req.enabledFlags.filter((f) => req.allowedFlags.includes(f)),
    aggregationMinCohort: min,
    allowsRawFarmerAccess: false,
    scopedTenantIds: req.tenantId ? [req.tenantId] : [],
  };
}

/** A state config read/write must never cross into another tenant's records. */
export function stateConfigVisibleTo(
  config: { tenant_id: string },
  actor: { isPlatformAdmin: boolean; isAuditor: boolean; tenantIds: string[] },
): boolean {
  if (actor.isPlatformAdmin || actor.isAuditor) return true;
  return actor.tenantIds.includes(config.tenant_id);
}

/* ------------------------------------------------------------------ knowledge */

export interface KnowledgeContribution {
  id: string;
  status: KnowledgeStatus;
  author_user_id: string;
  reviewed_by: string | null;
  institution_state: string;
  title: string;
  summary: string;
  body: string;
  citations: string[];
  is_training_content: boolean;
  ai_grounding_enabled: boolean;
}

export interface KnowledgeSubmitCheck {
  ok: boolean;
  errors: string[];
}

export function checkKnowledgeSubmit(c: {
  title: string;
  summary: string;
  body: string;
  citations: string[];
  institution_state: string;
  status: KnowledgeStatus;
}): KnowledgeSubmitCheck {
  const errors: string[] = [];
  if (c.status !== "draft" && c.status !== "rejected") errors.push("not_submittable_from_status");
  if (c.title.trim().length < 6) errors.push("title_too_short");
  if (c.summary.trim().length < 20) errors.push("summary_too_short");
  if (c.body.trim().length < 80) errors.push("body_too_short");
  if (c.citations.length === 0) errors.push("citation_required");
  if (c.institution_state !== "approved") errors.push("institution_not_approved");
  return { ok: errors.length === 0, errors };
}

export interface KnowledgeDecision {
  ok: boolean;
  errors: string[];
  nextStatus: KnowledgeStatus;
  /** AI grounding is only ever proposed for approved+published content. */
  aiGroundingEnabled: boolean;
  publish: boolean;
}

/**
 * Reviewer separation: the reviewer must be a different human holding a review
 * role. A contributor can never approve, publish or ground its own content.
 */
export function decideKnowledgeReview(input: {
  contribution: Pick<KnowledgeContribution, "status" | "author_user_id">;
  reviewerUserId: string;
  reviewerIsReviewer: boolean;
  decision: "approve" | "reject" | "request_changes";
  publish?: boolean;
  enableAiGrounding?: boolean;
  aiGroundingFlagEnabled?: boolean;
}): KnowledgeDecision {
  const errors: string[] = [];
  const { contribution: c } = input;
  if (!input.reviewerIsReviewer) errors.push("reviewer_role_required");
  if (input.reviewerUserId === c.author_user_id) errors.push("reviewer_separation_violated");
  if (c.status !== "submitted" && c.status !== "in_review") errors.push("not_reviewable_from_status");

  let nextStatus: KnowledgeStatus = c.status;
  let publish = false;
  let aiGroundingEnabled = false;

  if (input.decision === "approve") {
    nextStatus = "approved";
    publish = Boolean(input.publish);
    if (publish) nextStatus = "published";
    if (input.enableAiGrounding) {
      if (!input.aiGroundingFlagEnabled) errors.push("ai_grounding_flag_disabled");
      else aiGroundingEnabled = true;
    }
  } else if (input.decision === "reject") {
    nextStatus = "rejected";
  } else {
    nextStatus = "in_review";
  }

  const ok = errors.length === 0;
  return {
    ok,
    errors,
    nextStatus: ok ? nextStatus : c.status,
    aiGroundingEnabled: ok ? aiGroundingEnabled : false,
    publish: ok ? publish : false,
  };
}

/** Only approved-and-published, grounding-enabled content may ground answers. */
export function groundableKnowledge(rows: KnowledgeContribution[]): KnowledgeContribution[] {
  return rows.filter((r) => r.status === "published" && r.ai_grounding_enabled && r.reviewed_by !== null);
}

/** Training content is only usable once published by a separate reviewer. */
export function usableTrainingContent(rows: KnowledgeContribution[]): KnowledgeContribution[] {
  return rows.filter((r) => r.is_training_content && r.status === "published" && r.reviewed_by !== null);
}

/* ------------------------------------------------------------------- research */

export const AGGREGATE_DATASETS = [
  "onboarding_funnel_aggregate",
  "scheme_uptake_aggregate",
  "storage_utilisation_aggregate",
  "market_price_aggregate",
] as const;

export interface ResearchRequestInput {
  title: string;
  abstract: string;
  purposeCode: string;
  datasets: string[];
  duaReference: string | null;
  ethicsReference: string | null;
  aggregationMinCohort: number;
  requestedRawRows?: boolean;
}

export interface ResearchRequestCheck {
  ok: boolean;
  errors: string[];
  datasets: string[];
  aggregationMinCohort: number;
  rawRowAccess: false;
}

export const RESEARCH_PURPOSES = ["research_aggregate", "policy_aggregate"] as const;

export function checkResearchRequest(input: ResearchRequestInput): ResearchRequestCheck {
  const errors: string[] = [];
  if (input.title.trim().length < 6) errors.push("title_too_short");
  if (input.abstract.trim().length < 40) errors.push("abstract_too_short");
  if (!(RESEARCH_PURPOSES as readonly string[]).includes(input.purposeCode)) {
    errors.push("purpose_not_aggregate_scoped");
  }
  if (input.datasets.length === 0) errors.push("dataset_required");
  const unknown = input.datasets.filter(
    (d) => !(AGGREGATE_DATASETS as readonly string[]).includes(d),
  );
  if (unknown.length > 0) errors.push(`dataset_not_aggregate:${unknown.join(",")}`);
  if (input.requestedRawRows) errors.push("raw_row_access_not_available");
  if (input.aggregationMinCohort < PLATFORM_MIN_COHORT) errors.push("aggregation_min_below_platform_floor");

  return {
    ok: errors.length === 0,
    errors,
    datasets: input.datasets.filter((d) => (AGGREGATE_DATASETS as readonly string[]).includes(d)),
    aggregationMinCohort: Math.max(input.aggregationMinCohort, PLATFORM_MIN_COHORT),
    rawRowAccess: false,
  };
}

export interface ResearchApprovalCheck {
  ok: boolean;
  errors: string[];
}

/** DUA + ethics references are mandatory before any approval. */
export function checkResearchApproval(input: {
  status: ResearchRequestStatus;
  duaReference: string | null;
  ethicsReference: string | null;
  approverIsPlatformAdmin: boolean;
}): ResearchApprovalCheck {
  const errors: string[] = [];
  if (!input.approverIsPlatformAdmin) errors.push("not_authorized");
  if (input.status !== "submitted" && input.status !== "ethics_review") {
    errors.push("not_decidable_from_status");
  }
  if (!input.duaReference || input.duaReference.trim().length < 4) errors.push("dua_reference_required");
  if (!input.ethicsReference || input.ethicsReference.trim().length < 4) {
    errors.push("ethics_reference_required");
  }
  return { ok: errors.length === 0, errors };
}

export interface AggregateRow {
  metric_code: string;
  period: string;
  geography_id: string | null;
  value: number;
  cohort_size: number;
  is_deidentified: boolean;
}

export interface ExportVerdict {
  allowed: boolean;
  errors: string[];
  minCohortApplied: number;
  /** Rows that met the cohort floor. */
  rows: AggregateRow[];
  /** Rows suppressed because their cohort was too small. */
  suppressed: number;
}

/**
 * Aggregation control: an approved, unexpired request may read de-identified
 * aggregate rows whose cohort is at least the effective minimum. Everything
 * else is suppressed rather than returned at finer grain.
 */
export function evaluateAggregateExport(input: {
  request: {
    status: ResearchRequestStatus;
    aggregation_min_cohort: number;
    requested_datasets: string[];
    expires_at: string | null;
    raw_row_access?: boolean;
  };
  datasetCode: string;
  stateMinCohort?: number;
  rows: AggregateRow[];
  now: Date;
}): ExportVerdict {
  const errors: string[] = [];
  const r = input.request;
  if (r.status !== "approved") errors.push("request_not_approved");
  if (r.expires_at && new Date(r.expires_at).getTime() <= input.now.getTime()) errors.push("request_expired");
  if (!r.requested_datasets.includes(input.datasetCode)) errors.push("dataset_not_in_request");
  if (r.raw_row_access) errors.push("raw_row_access_not_available");

  const minCohortApplied = Math.max(
    PLATFORM_MIN_COHORT,
    r.aggregation_min_cohort,
    input.stateMinCohort ?? 0,
  );

  const identified = input.rows.filter((row) => !row.is_deidentified);
  if (identified.length > 0) errors.push("identified_rows_rejected");

  if (errors.length > 0) {
    return { allowed: false, errors, minCohortApplied, rows: [], suppressed: input.rows.length };
  }

  const rows = input.rows.filter((row) => row.cohort_size >= minCohortApplied);
  return {
    allowed: true,
    errors: [],
    minCohortApplied,
    rows,
    suppressed: input.rows.length - rows.length,
  };
}

/** Policymaker dashboards read the same suppressed aggregate surface. */
export function policyDashboard(input: {
  rows: AggregateRow[];
  minCohort?: number;
}): { metrics: Array<{ metric_code: string; period: string; value: number; cohort_size: number }>; suppressed: number } {
  const min = Math.max(PLATFORM_MIN_COHORT, input.minCohort ?? 0);
  const visible = input.rows.filter((r) => r.is_deidentified && r.cohort_size >= min);
  return {
    metrics: visible.map((r) => ({
      metric_code: r.metric_code,
      period: r.period,
      value: r.value,
      cohort_size: r.cohort_size,
    })),
    suppressed: input.rows.length - visible.length,
  };
}

/* -------------------------------------------------------------- post-harvest */

export const POSTHARVEST_SUBTYPES: Record<PostharvestKind, string> = {
  warehouse: "warehouse_storage",
  cold_storage: "cold_storage",
  processor: "processor_sourcing",
};

export interface PostharvestGate {
  ok: boolean;
  errors: string[];
  subtypeCode: string;
}

/** Post-harvest onboarding rides the B6 evidence gate; nothing self-activates. */
export function checkPostharvestOnboarding(input: {
  kind: PostharvestKind;
  subtype: {
    code: string;
    evidence_gate: string;
    is_active: boolean;
    flagEnabled: boolean;
    verification_checks: Array<{ code: string; label: string }>;
    dispute_categories: string[];
  } | null;
  displayName: string;
  contactEmail: string;
  serviceRegions: string[];
}): PostharvestGate {
  const errors: string[] = [];
  const subtypeCode = POSTHARVEST_SUBTYPES[input.kind];
  const s = input.subtype;
  if (!s) errors.push("subtype_not_configured");
  else {
    if (s.code !== subtypeCode) errors.push("subtype_mismatch");
    if (s.evidence_gate !== "approved") errors.push("evidence_gate_not_approved");
    if (!s.is_active) errors.push("subtype_inactive");
    if (!s.flagEnabled) errors.push("feature_flag_disabled");
    if (s.verification_checks.length === 0) errors.push("verification_checks_missing");
    if (s.dispute_categories.length === 0) errors.push("dispute_flow_missing");
  }
  if (input.displayName.trim().length < 3) errors.push("display_name_too_short");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(input.contactEmail)) errors.push("contact_email_invalid");
  if (input.serviceRegions.length === 0) errors.push("service_region_required");
  return { ok: errors.length === 0, errors, subtypeCode };
}

export interface CapacityListingCheck {
  ok: boolean;
  errors: string[];
  qualityScore: number;
}

const CAPACITY_QUALITY_FLOOR = 70;

export function checkCapacityListing(input: {
  kind: PostharvestKind;
  providerState: string;
  commodity: string;
  capacityTonnes: number;
  availableTonnes: number;
  temperatureMinC?: number | null;
  temperatureMaxC?: number | null;
  pricePerTonneMonth?: number | null;
}): CapacityListingCheck {
  const errors: string[] = [];
  if (input.providerState !== "approved") errors.push("provider_not_approved");
  if (input.commodity.trim().length < 2) errors.push("commodity_required");
  if (!(input.capacityTonnes > 0)) errors.push("capacity_must_be_positive");
  if (input.availableTonnes < 0) errors.push("available_cannot_be_negative");
  if (input.availableTonnes > input.capacityTonnes) errors.push("available_exceeds_capacity");
  if (input.kind === "cold_storage") {
    if (input.temperatureMinC == null || input.temperatureMaxC == null) {
      errors.push("cold_chain_temperature_range_required");
    } else if (input.temperatureMinC > input.temperatureMaxC) {
      errors.push("temperature_range_inverted");
    }
  }

  let score = 40;
  if (input.pricePerTonneMonth != null && input.pricePerTonneMonth >= 0) score += 20;
  if (input.availableTonnes > 0) score += 20;
  if (input.commodity.trim().length >= 3) score += 10;
  if (input.kind !== "cold_storage" || (input.temperatureMinC != null && input.temperatureMaxC != null)) {
    score += 10;
  }
  if (score < CAPACITY_QUALITY_FLOOR) errors.push("quality_score_below_floor");

  return { ok: errors.length === 0, errors, qualityScore: Math.min(score, 100) };
}

export interface ContractTransition {
  ok: boolean;
  errors: string[];
  nextStatus: ContractStatus;
  /** Contracts are never auto-decided; a human party/operator decides. */
  requiresHumanDecision: true;
}

const CONTRACT_FLOW: Record<ContractStatus, ContractStatus[]> = {
  draft: ["proposed", "cancelled"],
  proposed: ["accepted", "cancelled"],
  accepted: ["active", "cancelled", "disputed"],
  active: ["completed", "disputed"],
  completed: [],
  cancelled: [],
  disputed: ["active", "cancelled", "completed"],
};

export function planContractTransition(input: {
  current: ContractStatus;
  next: ContractStatus;
  actorIsParty: boolean;
  actorIsOperator: boolean;
  subtypeActive: boolean;
}): ContractTransition {
  const errors: string[] = [];
  if (!input.subtypeActive) errors.push("processor_sourcing_not_active");
  if (!input.actorIsParty && !input.actorIsOperator) errors.push("not_authorized");
  if (!CONTRACT_FLOW[input.current].includes(input.next)) errors.push("illegal_transition");
  if (input.next === "disputed" && !input.actorIsParty && !input.actorIsOperator) {
    errors.push("not_authorized");
  }
  if ((input.current === "disputed" || input.next === "completed") && !input.actorIsOperator && input.current === "disputed") {
    errors.push("dispute_resolution_requires_operator");
  }
  const ok = errors.length === 0;
  return { ok, errors, nextStatus: ok ? input.next : input.current, requiresHumanDecision: true };
}

/* ------------------------------------------------------------------ dashboard */

export interface StateDashboard {
  states: number;
  institutions: { total: number; approved: number; pending: number };
  knowledge: { total: number; awaitingReview: number; published: number; groundable: number };
  research: { total: number; pending: number; approved: number; deniedExports: number };
  postharvest: { providers: number; approvedProviders: number; listings: number; contracts: number };
  aggregateOnly: true;
}

export function summariseState(input: {
  stateConfigs: Array<{ id: string }>;
  institutions: Array<{ state: string }>;
  contributions: KnowledgeContribution[];
  researchRequests: Array<{ status: ResearchRequestStatus }>;
  exports: Array<{ allowed: boolean }>;
  providers: Array<{ state: string }>;
  listings: Array<{ id: string }>;
  contracts: Array<{ id: string }>;
}): StateDashboard {
  return {
    states: input.stateConfigs.length,
    institutions: {
      total: input.institutions.length,
      approved: input.institutions.filter((i) => i.state === "approved").length,
      pending: input.institutions.filter((i) => i.state === "submitted" || i.state === "verification")
        .length,
    },
    knowledge: {
      total: input.contributions.length,
      awaitingReview: input.contributions.filter(
        (c) => c.status === "submitted" || c.status === "in_review",
      ).length,
      published: input.contributions.filter((c) => c.status === "published").length,
      groundable: groundableKnowledge(input.contributions).length,
    },
    research: {
      total: input.researchRequests.length,
      pending: input.researchRequests.filter(
        (r) => r.status === "submitted" || r.status === "ethics_review",
      ).length,
      approved: input.researchRequests.filter((r) => r.status === "approved").length,
      deniedExports: input.exports.filter((e) => !e.allowed).length,
    },
    postharvest: {
      providers: input.providers.length,
      approvedProviders: input.providers.filter((p) => p.state === "approved").length,
      listings: input.listings.length,
      contracts: input.contracts.length,
    },
    aggregateOnly: true,
  };
}
