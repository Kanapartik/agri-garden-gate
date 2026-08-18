/**
 * B9 — Talent & Skills domain (evidence-gated on D-16).
 *
 * Pure, dependency-free domain logic. Three rules dominate this module:
 *  1. Nothing in the talent domain is usable until the D-16 evidence gate is
 *     approved on all three axes (demand, policy, commercial model) AND the
 *     matching feature flag is enabled.
 *  2. A candidate profile is hidden by default. Recruiters and employers never
 *     read candidate rows; they only ever see a consented referral summary.
 *  3. Money never buys visibility, ranking or covert data access.
 */

export type TalentVisibility = "hidden" | "platform_only" | "employers_optin";
export type TalentEntityState =
  | "draft"
  | "submitted"
  | "in_review"
  | "approved"
  | "rejected"
  | "suspended";
export type TalentEmployerKind = "employer" | "recruiter" | "government_exchange";
export type JobListingStatus = "draft" | "open" | "closed" | "filled" | "withdrawn";
export type EnrollmentStatus =
  | "enrolled"
  | "in_progress"
  | "completed"
  | "dropped"
  | "cancelled";
export type CertificationVerification = "pending" | "verified" | "failed" | "revoked";
export type ReferralStatus =
  | "proposed"
  | "candidate_consent_pending"
  | "shared"
  | "declined_by_candidate"
  | "withdrawn"
  | "closed";
export type GateStatus = "pending" | "approved" | "rejected";

export type Check = { ok: true } | { ok: false; errors: string[] };

const ok: Check = { ok: true };
const fail = (errors: string[]): Check => (errors.length === 0 ? ok : { ok: false, errors });

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/* ------------------------------------------------------------ D-16 gate */

export const TALENT_DOMAIN_GATE = "D-16";

export const TALENT_FLAGS = [
  "talent.domain",
  "talent.candidate_profiles",
  "talent.training_partners",
  "talent.employers",
  "talent.exchange_integration",
  "talent.matching",
  "talent.commercial_entitlements",
] as const;

export type TalentFlag = (typeof TALENT_FLAGS)[number];

export interface EvidenceGate {
  code: string;
  status: GateStatus;
  demand_validated: boolean;
  policy_validated: boolean;
  commercial_validated: boolean;
}

export interface GateDecision {
  activated: boolean;
  errors: string[];
}

/**
 * The single choke point for the whole slice. Every talent mutation calls this
 * first; when it returns `activated: false` the feature does not exist as far
 * as the API is concerned.
 */
export function evaluateTalentGate(input: {
  gate: EvidenceGate | null;
  domainFlagEnabled: boolean;
  featureFlagEnabled?: boolean;
}): GateDecision {
  const errors: string[] = [];
  const g = input.gate;
  if (!g) errors.push("evidence_gate_missing");
  else {
    if (g.code !== TALENT_DOMAIN_GATE) errors.push("evidence_gate_mismatch");
    if (g.status !== "approved") errors.push("evidence_gate_not_approved");
    if (!g.demand_validated) errors.push("demand_not_validated");
    if (!g.policy_validated) errors.push("policy_not_validated");
    if (!g.commercial_validated) errors.push("commercial_model_not_validated");
  }
  if (!input.domainFlagEnabled) errors.push("talent_domain_flag_disabled");
  if (input.featureFlagEnabled === false) errors.push("feature_flag_disabled");
  return { activated: errors.length === 0, errors };
}

/** Leadership decision on D-16; always a human decision, never inferred. */
export function planGateDecision(input: {
  decision: GateStatus;
  demandValidated: boolean;
  policyValidated: boolean;
  commercialValidated: boolean;
  reviewerIsAuthorized: boolean;
}): Check & { requiresHumanDecision: true } {
  const errors: string[] = [];
  if (!input.reviewerIsAuthorized) errors.push("not_authorized");
  if (
    input.decision === "approved" &&
    !(input.demandValidated && input.policyValidated && input.commercialValidated)
  ) {
    errors.push("all_three_axes_required");
  }
  const base = fail(errors);
  return { ...base, requiresHumanDecision: true } as Check & { requiresHumanDecision: true };
}

/* --------------------------------------------------- candidate profiles */

export interface CandidateDraft {
  fullName: string;
  headline: string;
  skills: string[];
}

export interface CandidateProfile {
  id: string;
  user_id: string;
  full_name: string;
  headline: string;
  skills: string[];
  visibility: TalentVisibility;
  visibility_consent_at: string | null;
  seeking: boolean;
}

export function checkCandidateProfile(draft: CandidateDraft): Check {
  const errors: string[] = [];
  if (draft.fullName.trim().length < 3) errors.push("full_name_too_short");
  if (draft.skills.filter((s) => s.trim().length > 0).length === 0) errors.push("skills_required");
  if (draft.headline.length > 160) errors.push("headline_too_long");
  return fail(errors);
}

/**
 * Visibility only ever leaves `hidden` with an explicit, recorded consent.
 * Withdrawing consent is always allowed and takes effect immediately.
 */
export function planVisibilityChange(input: {
  requested: TalentVisibility;
  consentGiven: boolean;
  now: string;
}):
  | { ok: true; visibility: TalentVisibility; visibilityConsentAt: string | null }
  | { ok: false; errors: string[] } {
  if (input.requested === "hidden") {
    return { ok: true, visibility: "hidden", visibilityConsentAt: null };
  }
  if (!input.consentGiven) return { ok: false, errors: ["visibility_consent_required"] };
  return { ok: true, visibility: input.requested, visibilityConsentAt: input.now };
}

/** Employers may only ever be shown candidates who opted in and are seeking. */
export function candidateDiscoverableByEmployers(p: CandidateProfile): boolean {
  return p.visibility === "employers_optin" && p.seeking && p.visibility_consent_at !== null;
}

export const CANDIDATE_SHAREABLE_FIELDS = ["full_name", "headline", "skills"] as const;

export type TalentFieldMap = Record<string, string | number | boolean | null | string[]>;

export interface ReferralSummary {
  candidateId: string;
  status: ReferralStatus;
  /** Redacted unless the candidate has consented to this specific referral. */
  fields: TalentFieldMap | null;
  redactionReason: string | null;
}

/**
 * The only path from a candidate profile to an employer's screen. Anything but
 * an accepted (`shared`) referral yields no candidate fields at all.
 */
export function buildReferralSummary(input: {
  profile: CandidateProfile;
  status: ReferralStatus;
  sharedFields: readonly string[];
}): ReferralSummary {
  if (input.status !== "shared") {
    return {
      candidateId: input.profile.id,
      status: input.status,
      fields: null,
      redactionReason: "candidate_consent_missing",
    };
  }
  if (!candidateDiscoverableByEmployers(input.profile)) {
    return {
      candidateId: input.profile.id,
      status: input.status,
      fields: null,
      redactionReason: "profile_hidden",
    };
  }
  const allowed = input.sharedFields.filter((f) =>
    (CANDIDATE_SHAREABLE_FIELDS as readonly string[]).includes(f),
  );
  const fields: TalentFieldMap = {};
  for (const f of allowed) {
    if (f === "full_name") fields["full_name"] = input.profile.full_name;
    if (f === "headline") fields["headline"] = input.profile.headline;
    if (f === "skills") fields["skills"] = input.profile.skills;
  }
  return { candidateId: input.profile.id, status: "shared", fields, redactionReason: null };
}

/* ---------------------------------------------- training partners/courses */

export interface TrainingPartnerDraft {
  name: string;
  contactEmail: string;
  certificationIssuerName: string;
  accreditationRef: string;
}

export function checkTrainingPartnerSubmit(draft: TrainingPartnerDraft): Check {
  const errors: string[] = [];
  if (draft.name.trim().length < 3) errors.push("name_too_short");
  if (!EMAIL.test(draft.contactEmail.trim())) errors.push("contact_email_invalid");
  if (draft.certificationIssuerName.trim().length < 3) errors.push("issuer_name_required");
  if (draft.accreditationRef.trim().length === 0) errors.push("accreditation_ref_required");
  return fail(errors);
}

export interface EntityDecisionPlan {
  ok: boolean;
  errors: string[];
  nextState: TalentEntityState;
  requiresHumanDecision: true;
}

export function planEntityDecision(input: {
  currentState: TalentEntityState;
  decision: "approved" | "rejected" | "suspended";
  reviewerIsAuthorized: boolean;
  /** Employment-exchange style extra gates, evaluated by the caller. */
  extraErrors?: string[];
}): EntityDecisionPlan {
  const errors: string[] = [...(input.extraErrors ?? [])];
  if (!input.reviewerIsAuthorized) errors.push("not_authorized");
  if (!["submitted", "in_review", "approved"].includes(input.currentState)) {
    errors.push("not_reviewable_state");
  }
  return {
    ok: errors.length === 0,
    errors,
    nextState: errors.length === 0 ? input.decision : input.currentState,
    requiresHumanDecision: true,
  };
}

export interface CourseDraft {
  code: string;
  title: string;
  hours: number;
  feeAmount: number;
  certificationIssuerName: string;
}

export function checkCourse(input: {
  draft: CourseDraft;
  partnerState: TalentEntityState;
  commercialEntitlementsEnabled: boolean;
}): Check {
  const errors: string[] = [];
  const d = input.draft;
  if (input.partnerState !== "approved") errors.push("partner_not_approved");
  if (d.code.trim().length < 2) errors.push("code_required");
  if (d.title.trim().length < 3) errors.push("title_too_short");
  if (d.hours <= 0) errors.push("hours_required");
  if (d.feeAmount < 0) errors.push("fee_invalid");
  if (d.feeAmount > 0 && !input.commercialEntitlementsEnabled) errors.push("fee_not_approved");
  if (d.certificationIssuerName.trim().length < 3) errors.push("issuer_name_required");
  return fail(errors);
}

/* ------------------------------------------- enrollment & certification */

export function planEnrollment(input: {
  coursePublished: boolean;
  partnerState: TalentEntityState;
  alreadyEnrolled: boolean;
}): Check {
  const errors: string[] = [];
  if (!input.coursePublished) errors.push("course_not_published");
  if (input.partnerState !== "approved") errors.push("partner_not_approved");
  if (input.alreadyEnrolled) errors.push("already_enrolled");
  return fail(errors);
}

export function planCompletion(input: {
  status: EnrollmentStatus;
  actorIsIssuingPartner: boolean;
}): Check & { nextStatus: EnrollmentStatus } {
  const errors: string[] = [];
  if (!input.actorIsIssuingPartner) errors.push("only_issuing_partner_may_complete");
  if (input.status === "completed") errors.push("already_completed");
  if (input.status === "cancelled" || input.status === "dropped") errors.push("enrollment_closed");
  const base = fail(errors);
  return {
    ...base,
    nextStatus: errors.length === 0 ? "completed" : input.status,
  } as Check & { nextStatus: EnrollmentStatus };
}

export interface CertificationProvenance {
  issuerName: string;
  issuerPartnerId: string;
  credentialRef: string;
  courseCode: string;
  hours: number;
  verifiedBy: string | null;
}

/** Provenance is mandatory: a certificate with no visible issuer cannot exist. */
export function planCertificationIssue(input: {
  enrollmentStatus: EnrollmentStatus;
  actorIsIssuingPartner: boolean;
  provenance: CertificationProvenance;
}): Check {
  const errors: string[] = [];
  if (input.enrollmentStatus !== "completed") errors.push("enrollment_not_completed");
  if (!input.actorIsIssuingPartner) errors.push("only_issuing_partner_may_issue");
  const p = input.provenance;
  if (p.issuerName.trim().length < 3) errors.push("issuer_name_required");
  if (!p.issuerPartnerId) errors.push("issuer_partner_required");
  if (p.credentialRef.trim().length < 3) errors.push("credential_ref_required");
  if (p.courseCode.trim().length === 0) errors.push("course_code_required");
  return fail(errors);
}

export interface CertificationView {
  id: string;
  issuer_name: string;
  credential_ref: string;
  verification_status: CertificationVerification;
  provenance: TalentFieldMap;
}

export function certificationIsTrustworthy(c: CertificationView): boolean {
  return (
    c.verification_status === "verified" &&
    c.issuer_name.trim().length > 0 &&
    c.credential_ref.trim().length > 0
  );
}

/* --------------------------------------------- employers & requisitions */

export interface EmployerDraft {
  kind: TalentEmployerKind;
  name: string;
  contactEmail: string;
  agreementRef: string;
  dataScope: string[];
}

export const EMPLOYER_DATA_SCOPES = [
  "consented_referral_summary",
  "certification_verification",
  "aggregate_supply_stats",
] as const;

export function checkEmployerSubmit(input: {
  draft: EmployerDraft;
  exchangeIntegrationEnabled: boolean;
}): Check {
  const errors: string[] = [];
  const d = input.draft;
  if (d.name.trim().length < 3) errors.push("name_too_short");
  if (!EMAIL.test(d.contactEmail.trim())) errors.push("contact_email_invalid");
  const unknown = d.dataScope.filter(
    (s) => !(EMPLOYER_DATA_SCOPES as readonly string[]).includes(s),
  );
  if (unknown.length > 0) errors.push("data_scope_unknown");
  if (d.kind === "government_exchange") {
    if (!input.exchangeIntegrationEnabled) errors.push("exchange_integration_disabled");
    if (d.agreementRef.trim().length === 0) errors.push("agreement_ref_required");
    if (d.dataScope.length === 0) errors.push("data_scope_required");
  }
  return fail(errors);
}

/**
 * Government employment-exchange integrations additionally require a formal
 * agreement reference and an explicitly approved data scope before approval.
 */
export function planEmployerApproval(input: {
  kind: TalentEmployerKind;
  currentState: TalentEntityState;
  decision: "approved" | "rejected" | "suspended";
  reviewerIsAuthorized: boolean;
  agreementRef: string;
  dataScope: string[];
  dataScopeApproved: boolean;
}): EntityDecisionPlan {
  const extra: string[] = [];
  if (input.decision === "approved" && input.kind === "government_exchange") {
    if (input.agreementRef.trim().length === 0) extra.push("agreement_ref_required");
    if (input.dataScope.length === 0) extra.push("data_scope_required");
    if (!input.dataScopeApproved) extra.push("data_scope_not_approved");
  }
  return planEntityDecision({
    currentState: input.currentState,
    decision: input.decision,
    reviewerIsAuthorized: input.reviewerIsAuthorized,
    extraErrors: extra,
  });
}

export interface JobDraft {
  title: string;
  skills: string[];
  positions: number;
  isSponsored: boolean;
  sponsoredLabel: string;
  compensationMin: number | null;
  compensationMax: number | null;
}

export const NO_PLACEMENT_GUARANTEE_NOTICE =
  "AgriGhar ATAP connects candidates and employers. It does not guarantee placement, employment, salary or any hiring outcome.";

export function checkJobListing(input: {
  draft: JobDraft;
  employerState: TalentEntityState;
}): Check {
  const errors: string[] = [];
  const d = input.draft;
  if (input.employerState !== "approved") errors.push("employer_not_approved");
  if (d.title.trim().length < 3) errors.push("title_too_short");
  if (d.skills.filter((s) => s.trim()).length === 0) errors.push("skills_required");
  if (d.positions < 1) errors.push("positions_invalid");
  if (d.isSponsored && d.sponsoredLabel.trim().length === 0) errors.push("sponsored_label_required");
  if (
    d.compensationMin !== null &&
    d.compensationMax !== null &&
    d.compensationMin > d.compensationMax
  ) {
    errors.push("compensation_range_invalid");
  }
  return fail(errors);
}

/* ---------------------------------------------------- neutral matching */

export interface MatchInput {
  jobSkills: string[];
  candidates: Array<
    CandidateProfile & { certifications: CertificationView[]; hasPaidEntitlement?: boolean }
  >;
}

export interface MatchRow {
  candidateId: string;
  skillOverlap: number;
  verifiedCertifications: number;
  score: number;
}

/**
 * Ranking is skill/certification merit only. Paid entitlements are ignored by
 * construction, and hidden candidates never enter the candidate set.
 */
export function rankCandidates(input: MatchInput): MatchRow[] {
  const wanted = new Set(input.jobSkills.map((s) => s.trim().toLowerCase()).filter(Boolean));
  return input.candidates
    .filter(candidateDiscoverableByEmployers)
    .map((c) => {
      const overlap = c.skills.filter((s) => wanted.has(s.trim().toLowerCase())).length;
      const verified = c.certifications.filter(certificationIsTrustworthy).length;
      return {
        candidateId: c.id,
        skillOverlap: overlap,
        verifiedCertifications: verified,
        score: overlap * 10 + verified,
      };
    })
    .sort((a, b) => b.score - a.score || a.candidateId.localeCompare(b.candidateId));
}

export function planReferral(input: {
  jobStatus: JobListingStatus;
  employerState: TalentEntityState;
  candidate: CandidateProfile;
  matchingEnabled: boolean;
  alreadyReferred: boolean;
}): Check & { status: ReferralStatus } {
  const errors: string[] = [];
  if (!input.matchingEnabled) errors.push("matching_disabled");
  if (input.jobStatus !== "open") errors.push("job_not_open");
  if (input.employerState !== "approved") errors.push("employer_not_approved");
  if (!candidateDiscoverableByEmployers(input.candidate)) errors.push("candidate_not_discoverable");
  if (input.alreadyReferred) errors.push("already_referred");
  const base = fail(errors);
  return {
    ...base,
    status: "candidate_consent_pending",
  } as Check & { status: ReferralStatus };
}

export function decideReferral(input: {
  current: ReferralStatus;
  decision: "accept" | "decline" | "withdraw";
  actorIsCandidate: boolean;
  sharedFields: readonly string[];
}): { ok: boolean; errors: string[]; status: ReferralStatus; sharedFields: string[] } {
  const errors: string[] = [];
  if (!input.actorIsCandidate) errors.push("only_candidate_may_decide");
  if (input.current !== "candidate_consent_pending" && input.current !== "proposed") {
    if (!(input.decision === "withdraw" && input.current === "shared")) {
      errors.push("referral_not_pending");
    }
  }
  const allowed = input.sharedFields.filter((f) =>
    (CANDIDATE_SHAREABLE_FIELDS as readonly string[]).includes(f),
  );
  if (input.decision === "accept" && allowed.length === 0) errors.push("shared_fields_required");
  if (errors.length > 0) {
    return { ok: false, errors, status: input.current, sharedFields: [] };
  }
  const status: ReferralStatus =
    input.decision === "accept"
      ? "shared"
      : input.decision === "decline"
        ? "declined_by_candidate"
        : "withdrawn";
  return { ok: true, errors: [], status, sharedFields: input.decision === "accept" ? allowed : [] };
}

/* ------------------------------------------ commercial entitlements */

export const TALENT_ENTITLEMENT_KINDS = [
  "candidate_training_fee",
  "employer_subscription",
  "recruiter_subscription",
  "training_partner_fee",
] as const;

export function checkEntitlement(input: {
  subjectKind: string;
  feeAmount: number;
  grantsRankingAdvantage: boolean;
  commercialFlagEnabled: boolean;
  approverIsAuthorized: boolean;
}): Check {
  const errors: string[] = [];
  if (!(TALENT_ENTITLEMENT_KINDS as readonly string[]).includes(input.subjectKind)) {
    errors.push("subject_kind_unknown");
  }
  if (!input.commercialFlagEnabled) errors.push("commercial_model_not_approved");
  if (!input.approverIsAuthorized) errors.push("not_authorized");
  if (input.feeAmount < 0) errors.push("fee_invalid");
  if (input.grantsRankingAdvantage) errors.push("ranking_advantage_forbidden");
  return fail(errors);
}

/* ----------------------------------------------------------- dashboard */

export interface TalentDashboard {
  gateApproved: boolean;
  candidates: number;
  hiddenCandidates: number;
  optedInCandidates: number;
  partners: { total: number; approved: number };
  courses: { total: number; published: number };
  enrollments: { total: number; completed: number };
  certifications: { total: number; verified: number };
  employers: { total: number; approved: number; exchanges: number };
  jobs: { total: number; open: number; sponsored: number };
  referrals: { total: number; pending: number; shared: number; declined: number };
}

export function summariseTalent(input: {
  gate: EvidenceGate | null;
  candidates: readonly CandidateProfile[];
  partners: ReadonlyArray<{ state: TalentEntityState }>;
  courses: ReadonlyArray<{ is_published: boolean }>;
  enrollments: ReadonlyArray<{ status: EnrollmentStatus }>;
  certifications: readonly CertificationView[];
  employers: ReadonlyArray<{ state: TalentEntityState; kind: TalentEmployerKind }>;
  jobs: ReadonlyArray<{ status: JobListingStatus; is_sponsored: boolean }>;
  referrals: ReadonlyArray<{ status: ReferralStatus }>;
}): TalentDashboard {
  return {
    gateApproved: input.gate?.status === "approved",
    candidates: input.candidates.length,
    hiddenCandidates: input.candidates.filter((c) => c.visibility === "hidden").length,
    optedInCandidates: input.candidates.filter(candidateDiscoverableByEmployers).length,
    partners: {
      total: input.partners.length,
      approved: input.partners.filter((p) => p.state === "approved").length,
    },
    courses: {
      total: input.courses.length,
      published: input.courses.filter((c) => c.is_published).length,
    },
    enrollments: {
      total: input.enrollments.length,
      completed: input.enrollments.filter((e) => e.status === "completed").length,
    },
    certifications: {
      total: input.certifications.length,
      verified: input.certifications.filter(certificationIsTrustworthy).length,
    },
    employers: {
      total: input.employers.length,
      approved: input.employers.filter((e) => e.state === "approved").length,
      exchanges: input.employers.filter((e) => e.kind === "government_exchange").length,
    },
    jobs: {
      total: input.jobs.length,
      open: input.jobs.filter((j) => j.status === "open").length,
      sponsored: input.jobs.filter((j) => j.is_sponsored).length,
    },
    referrals: {
      total: input.referrals.length,
      pending: input.referrals.filter((r) => r.status === "candidate_consent_pending").length,
      shared: input.referrals.filter((r) => r.status === "shared").length,
      declined: input.referrals.filter((r) => r.status === "declined_by_candidate").length,
    },
  };
}
