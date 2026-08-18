/**
 * B4 — Bank, insurer & agritech developer onboarding: pure domain logic.
 *
 * No IO here. These primitives encode the B4 non-negotiables so they can be
 * unit-tested directly and reused by every server function:
 *  - one access path for first-party and third-party consumers at the same tier
 *  - sandbox credentials can never reach production
 *  - no production access before BOTH legal and security approval
 *  - farmer data is default-deny: scope AND purpose-scoped consent required
 *  - high-stakes bank/insurer outcomes always await an authorized human
 */

import {
  evaluateDataAccess,
  requiresHumanDecision,
  resolveTierPolicy,
  type ConsentGrantLike,
  type ConsumerTier,
} from "@/lib/atap/policy";

export type PartnerKind = "bank" | "insurer" | "agritech";
export type PartnerEnv = "sandbox" | "production";
export type GateStatus = "pending" | "approved" | "rejected";
export type PartnerRegState =
  | "draft"
  | "submitted"
  | "legal_review"
  | "security_review"
  | "approved"
  | "rejected"
  | "suspended";

export type PartnerCaseKind = "credit_signal" | "loan" | "claim" | "advisory";
export type PartnerCaseStatus =
  | "open"
  | "awaiting_evidence"
  | "awaiting_human_decision"
  | "approved"
  | "declined"
  | "withdrawn";

/* --------------------------------------------------------------- scopes */

export interface ScopeDef {
  code: string;
  label: string;
  /** Purpose this scope reads farmer data under. `null` = no farmer data. */
  purposeCode: string | null;
  /** Partner kinds that may request the scope. Empty = all kinds. */
  kinds: readonly PartnerKind[];
}

/** Scope catalogue is configuration, not per-partner forks. */
export const SCOPE_CATALOGUE: readonly ScopeDef[] = [
  { code: "profile.read", label: "Partner profile (no farmer data)", purposeCode: null, kinds: [] },
  { code: "catalogue.read", label: "Scheme / product catalogue", purposeCode: null, kinds: [] },
  {
    code: "farm.summary.read",
    label: "Farm summary (consented)",
    purposeCode: "advisory",
    kinds: [],
  },
  {
    code: "credit.signal.read",
    label: "Credit signals (consented)",
    purposeCode: "credit_assessment",
    kinds: ["bank"],
  },
  {
    code: "insurance.evidence.read",
    label: "Claim evidence (consented)",
    purposeCode: "crop_insurance",
    kinds: ["insurer"],
  },
  {
    code: "scheme.eligibility.read",
    label: "Scheme eligibility inputs (consented)",
    purposeCode: "scheme_eligibility",
    kinds: [],
  },
];

export function scopeDef(code: string): ScopeDef | null {
  return SCOPE_CATALOGUE.find((s) => s.code === code) ?? null;
}

export function scopesForKind(kind: PartnerKind): ScopeDef[] {
  return SCOPE_CATALOGUE.filter((s) => s.kinds.length === 0 || s.kinds.includes(kind));
}

/** Scopes that never touch farmer data — safe in sandbox with synthetic data. */
export function isFarmerDataScope(code: string): boolean {
  return scopeDef(code)?.purposeCode !== null && scopeDef(code) !== null;
}

/* ------------------------------------------------- registration lifecycle */

export interface RegistrationLike {
  state: PartnerRegState;
  legal_status: GateStatus;
  security_status: GateStatus;
  partner_kind: PartnerKind;
}

/**
 * Legal AND security must both be approved. Either rejection rejects. A
 * suspended registration never re-derives to approved.
 */
export function deriveRegistrationState(reg: {
  state: PartnerRegState;
  legal_status: GateStatus;
  security_status: GateStatus;
}): PartnerRegState {
  if (reg.state === "draft" || reg.state === "suspended") return reg.state;
  if (reg.legal_status === "rejected" || reg.security_status === "rejected") return "rejected";
  if (reg.legal_status === "approved" && reg.security_status === "approved") return "approved";
  if (reg.legal_status === "approved") return "security_review";
  if (reg.state === "submitted") return "legal_review";
  return reg.state;
}

export interface SubmitCheck {
  ok: boolean;
  errors: string[];
}

export function checkRegistrationSubmit(input: {
  display_name: string;
  contact_email: string;
  intended_use: string;
  requested_purposes: string[];
  partner_kind: PartnerKind;
  state: PartnerRegState;
}): SubmitCheck {
  const errors: string[] = [];
  if (input.state !== "draft") errors.push("Only a draft registration can be submitted.");
  if (input.display_name.trim().length < 3) errors.push("Partner name is required.");
  if (!/^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(input.contact_email.trim())) {
    errors.push("A valid contact email is required.");
  }
  if (input.intended_use.trim().length < 20) {
    errors.push("Describe the intended use in at least 20 characters.");
  }
  if (input.requested_purposes.length === 0) {
    errors.push("Select at least one data purpose to request.");
  }
  return { ok: errors.length === 0, errors };
}

export function isProductionEligible(reg: RegistrationLike): boolean {
  return (
    reg.state === "approved" && reg.legal_status === "approved" && reg.security_status === "approved"
  );
}

/* ----------------------------------------------- credentials & environment */

export interface CredentialLike {
  environment: PartnerEnv;
  status: string;
  revoked_at: string | null;
  scopes: string[];
}

export type EnvDecision =
  | { decision: "allow" }
  | {
      decision: "deny";
      reason:
        | "credential_revoked"
        | "sandbox_credential_cannot_call_production"
        | "production_credential_not_allowed_in_sandbox"
        | "environment_mismatch";
    };

/**
 * Environment separation. A sandbox credential calling production is always a
 * hard deny — independent of tier, scopes, consent or first-party status.
 */
export function checkEnvironment(
  credential: CredentialLike,
  targetEnvironment: PartnerEnv,
): EnvDecision {
  if (credential.status !== "active" || credential.revoked_at !== null) {
    return { decision: "deny", reason: "credential_revoked" };
  }
  if (credential.environment === targetEnvironment) return { decision: "allow" };
  if (credential.environment === "sandbox" && targetEnvironment === "production") {
    return { decision: "deny", reason: "sandbox_credential_cannot_call_production" };
  }
  if (credential.environment === "production" && targetEnvironment === "sandbox") {
    return { decision: "deny", reason: "production_credential_not_allowed_in_sandbox" };
  }
  return { decision: "deny", reason: "environment_mismatch" };
}

/* ------------------------------------------------------- API access path */

export interface ApiAccessRequest {
  /** Requested endpoint scope, e.g. `credit.signal.read`. */
  scope: string;
  targetEnvironment: PartnerEnv;
  credential: CredentialLike;
  appScopes: string[];
  tier: ConsumerTier;
  consumerId: string;
  consumerStatus: "active" | "suspended" | "revoked";
  registration: RegistrationLike;
  subjectUserId: string | null;
}

export interface ApiAccessResult {
  decision: "allow" | "deny";
  reason: string;
  /** True when the endpoint would return farmer-subject data. */
  returnsFarmerData: boolean;
  purposeCode: string | null;
  rateLimitPerMin: number;
  /** High-stakes outcomes may never be auto-decided. */
  humanDecisionRequired: boolean;
}

/**
 * THE single access path. Note there is no `isFirstParty` parameter: an
 * equivalent first-party and third-party consumer at the same tier are
 * evaluated by identical code with identical inputs.
 */
export function evaluateApiAccess(
  request: ApiAccessRequest,
  grants: readonly ConsentGrantLike[],
  now: Date = new Date(),
): ApiAccessResult {
  const def = scopeDef(request.scope);
  const purposeCode = def?.purposeCode ?? null;
  const policy = resolveTierPolicy(request.tier);
  const base = {
    returnsFarmerData: false,
    purposeCode,
    rateLimitPerMin: policy.rateLimitPerMin,
    humanDecisionRequired: purposeCode ? requiresHumanDecision(purposeCode) : false,
  };

  if (!def) return { decision: "deny", reason: "unknown_scope", ...base };

  const env = checkEnvironment(request.credential, request.targetEnvironment);
  if (env.decision === "deny") return { decision: "deny", reason: env.reason, ...base };

  if (request.targetEnvironment === "production" && !isProductionEligible(request.registration)) {
    return { decision: "deny", reason: "production_access_not_approved", ...base };
  }
  if (request.registration.state === "suspended") {
    return { decision: "deny", reason: "partner_suspended", ...base };
  }
  if (def.kinds.length > 0 && !def.kinds.includes(request.registration.partner_kind)) {
    return { decision: "deny", reason: "scope_not_available_for_partner_kind", ...base };
  }
  if (!request.appScopes.includes(request.scope)) {
    return { decision: "deny", reason: "scope_not_granted_to_app", ...base };
  }
  if (!request.credential.scopes.includes(request.scope)) {
    return { decision: "deny", reason: "scope_not_on_credential", ...base };
  }

  // Non-farmer-data scopes stop here: no consent needed, no farmer data returned.
  if (purposeCode === null) return { decision: "allow", reason: "scope_allowed", ...base };

  if (!request.subjectUserId) {
    return { decision: "deny", reason: "subject_required_for_farmer_data", ...base };
  }

  const consent = evaluateDataAccess(
    {
      purposeCode,
      consumerId: request.consumerId,
      consumerTier: request.tier,
      consumerStatus: request.consumerStatus,
    },
    grants,
    now,
  );
  if (consent.decision === "deny") {
    return { decision: "deny", reason: consent.reason, ...base };
  }

  return { decision: "allow", reason: "consent_active", ...base, returnsFarmerData: true };
}

/* --------------------------------------------------- production requests */

export interface ProdRequestCheck {
  ok: boolean;
  errors: string[];
}

export function checkProductionRequest(input: {
  registration: RegistrationLike;
  requestedScopes: string[];
  requestedTier: ConsumerTier;
  justification: string;
  hasOpenRequest: boolean;
}): ProdRequestCheck {
  const errors: string[] = [];
  if (input.hasOpenRequest) errors.push("A production request is already pending.");
  if (input.requestedScopes.length === 0) errors.push("Select at least one scope.");
  if (input.justification.trim().length < 20) {
    errors.push("Provide a justification of at least 20 characters.");
  }
  if (input.requestedTier === "sandbox") {
    errors.push("Production access requires a standard or premium tier.");
  }
  const tierPurposes = resolveTierPolicy(input.requestedTier).requestablePurposes;
  for (const code of input.requestedScopes) {
    const def = scopeDef(code);
    if (!def) {
      errors.push(`Unknown scope: ${code}`);
      continue;
    }
    if (def.kinds.length > 0 && !def.kinds.includes(input.registration.partner_kind)) {
      errors.push(`Scope ${code} is not available to a ${input.registration.partner_kind} partner.`);
    }
    if (def.purposeCode && !tierPurposes.includes(def.purposeCode)) {
      errors.push(`Scope ${code} requires a higher tier.`);
    }
  }
  return { ok: errors.length === 0, errors };
}

/**
 * Production credentials are only issuable when legal AND security approved
 * the registration AND an admin approved the production request.
 */
export function canIssueProductionCredential(input: {
  registration: RegistrationLike;
  productionRequestStatus: GateStatus | null;
}): { ok: boolean; reason: string } {
  if (!isProductionEligible(input.registration)) {
    return { ok: false, reason: "legal_and_security_approval_required" };
  }
  if (input.productionRequestStatus !== "approved") {
    return { ok: false, reason: "production_request_not_approved" };
  }
  return { ok: true, reason: "eligible" };
}

/* ------------------------------------------------------- consent broker */

export interface BrokerRequestPlan {
  ok: boolean;
  errors: string[];
  purposeCode: string | null;
}

export function planConsentBrokerRequest(input: {
  scope: string;
  registration: RegistrationLike;
  tier: ConsumerTier;
  environment: PartnerEnv;
  subjectUserId: string | null;
  reason: string;
}): BrokerRequestPlan {
  const errors: string[] = [];
  const def = scopeDef(input.scope);
  const purposeCode = def?.purposeCode ?? null;
  if (!def) errors.push("Unknown scope.");
  if (def && purposeCode === null) errors.push("This scope does not read farmer data; no consent request is needed.");
  if (!input.subjectUserId) errors.push("A farmer subject is required.");
  if (input.reason.trim().length < 10) errors.push("Give the farmer a reason of at least 10 characters.");
  if (input.environment === "production" && !isProductionEligible(input.registration)) {
    errors.push("Production consent requests require legal and security approval.");
  }
  if (purposeCode && !resolveTierPolicy(input.tier).requestablePurposes.includes(purposeCode)) {
    errors.push("This purpose is not requestable at the partner's tier.");
  }
  return { ok: errors.length === 0, errors, purposeCode };
}

/** Paid tiers never widen consent: the requested purpose is the granted purpose. */
export function brokerGrantPurpose(requestPurpose: string, _tier: ConsumerTier): string {
  return requestPurpose;
}

/* ------------------------------------------------------- workflow shells */

export interface CaseTransitionInput {
  kind: PartnerCaseKind;
  current: PartnerCaseStatus;
  next: PartnerCaseStatus;
  actorIsAuthorizedHuman: boolean;
  decisionNote: string;
  accessAllowed: boolean;
}

export type CaseTransitionResult =
  | { ok: true; status: PartnerCaseStatus }
  | { ok: false; error: string };

const TERMINAL: PartnerCaseStatus[] = ["approved", "declined", "withdrawn"];

/**
 * No autonomous underwriting or claims decisions: approve/decline requires an
 * authorized human actor plus a recorded note.
 */
export function planCaseTransition(input: CaseTransitionInput): CaseTransitionResult {
  if (TERMINAL.includes(input.current)) return { ok: false, error: "case_already_closed" };
  if (input.next === input.current) return { ok: false, error: "no_change" };

  const isDecision = input.next === "approved" || input.next === "declined";
  if (isDecision) {
    if (!input.actorIsAuthorizedHuman) return { ok: false, error: "human_decision_required" };
    if (input.decisionNote.trim().length < 10) {
      return { ok: false, error: "decision_note_required" };
    }
  }
  if (input.next === "awaiting_human_decision" && !input.accessAllowed) {
    return { ok: false, error: "consent_required_before_review" };
  }
  return { ok: true, status: input.next };
}

/** Automation may only produce advisory signals, never a decision. */
export function summariseSignals(signals: Record<string, unknown>): {
  advisory: true;
  decision: null;
  signalCount: number;
} {
  return { advisory: true, decision: null, signalCount: Object.keys(signals).length };
}

/* ----------------------------------------------------------- analytics */

export interface CallRecordLike {
  environment: PartnerEnv;
  outcome: string;
  deny_reason: string | null;
  status_code: number;
  latency_ms: number;
  is_first_party: boolean;
  tier: ConsumerTier;
}

export interface PartnerAnalytics {
  total: number;
  errors: number;
  denials: number;
  scopeDenials: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  byEnvironment: Record<PartnerEnv, number>;
  /** Neutrality check: same-tier allow rate for first- vs third-party callers. */
  neutrality: Array<{
    tier: ConsumerTier;
    firstPartyAllowRate: number | null;
    thirdPartyAllowRate: number | null;
    equivalent: boolean;
  }>;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)] ?? 0;
}

const SCOPE_DENY_REASONS = new Set([
  "scope_not_granted_to_app",
  "scope_not_on_credential",
  "scope_not_available_for_partner_kind",
  "purpose_not_requestable_at_tier",
  "unknown_scope",
]);

export function summariseCalls(calls: readonly CallRecordLike[]): PartnerAnalytics {
  const latencies = calls.map((c) => c.latency_ms).sort((a, b) => a - b);
  const tiers = Array.from(new Set(calls.map((c) => c.tier)));

  const rate = (subset: readonly CallRecordLike[]) =>
    subset.length === 0
      ? null
      : Math.round((subset.filter((c) => c.outcome === "allow").length / subset.length) * 100) / 100;

  return {
    total: calls.length,
    errors: calls.filter((c) => c.status_code >= 500).length,
    denials: calls.filter((c) => c.outcome === "deny").length,
    scopeDenials: calls.filter((c) => c.deny_reason && SCOPE_DENY_REASONS.has(c.deny_reason)).length,
    p50LatencyMs: percentile(latencies, 50),
    p95LatencyMs: percentile(latencies, 95),
    byEnvironment: {
      sandbox: calls.filter((c) => c.environment === "sandbox").length,
      production: calls.filter((c) => c.environment === "production").length,
    },
    neutrality: tiers.map((tier) => {
      const scoped = calls.filter((c) => c.tier === tier);
      const first = rate(scoped.filter((c) => c.is_first_party));
      const third = rate(scoped.filter((c) => !c.is_first_party));
      return {
        tier,
        firstPartyAllowRate: first,
        thirdPartyAllowRate: third,
        equivalent: first === null || third === null || first === third,
      };
    }),
  };
}

/* ------------------------------------------------------------- webhooks */

export function canConfigureWebhook(input: {
  registration: RegistrationLike;
  flagEnabled: boolean;
  environment: PartnerEnv;
  targetUrl: string;
}): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!input.flagEnabled) errors.push("Webhook delivery is not activated for this phase (P1).");
  if (!isProductionEligible(input.registration) && input.environment === "production") {
    errors.push("Production webhooks require legal and security approval.");
  }
  if (!/^https:\/\/[^\s]+$/.test(input.targetUrl.trim())) {
    errors.push("Webhook target must be an https URL.");
  }
  return { ok: errors.length === 0, errors };
}

/* ------------------------------------------------- developer onboarding */

export interface GuideStep {
  code: string;
  title: string;
  body: string;
}

export const DEVELOPER_GUIDE: readonly GuideStep[] = [
  {
    code: "register",
    title: "1. Register the partner organisation",
    body: "Describe the legal entity, intended use and the data purposes you need. Submission opens parallel legal and security review.",
  },
  {
    code: "sandbox",
    title: "2. Get a sandbox tenant",
    body: "Approval of the draft creates a sandbox tenant seeded with synthetic farmers only. No real farmer data exists in sandbox.",
  },
  {
    code: "app",
    title: "3. Register an app and issue sandbox credentials",
    body: "Pick scopes and a rate tier. The client secret is shown once and stored only as a hash.",
  },
  {
    code: "consent",
    title: "4. Broker consent per farmer and purpose",
    body: "Request consent for a purpose; the farmer grants or refuses in their consent centre and can revoke at any time. Paid tiers never widen consent.",
  },
  {
    code: "production",
    title: "5. Request production access",
    body: "Only after both legal and security approval. Sandbox credentials can never call production, and an admin must approve the request.",
  },
];
