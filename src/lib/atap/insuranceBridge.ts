/**
 * Slice C3 — insurer/bank deep flows: policy binding & claim-status sync
 * (pure logic, no I/O).
 *
 * What this module does:
 *  - decides whether an insurer policy actually applies to a member farmer
 *    (district + crop + season match), so cover shown to a farmer is bound to
 *    a real policy rather than an indicative baseline;
 *  - computes per-farmer cover arithmetic (sum insured, farmer share) from the
 *    policy's notified rates and the farmer's acreage;
 *  - maps insurer claim stages to farmer-facing advisory language.
 *
 * Non-negotiables honoured here:
 *  - nothing auto-decides eligibility, issuance or a claim outcome; every
 *    output is labelled advisory and the authorised insurer/government role
 *    keeps the decision;
 *  - farmer-facing claim views carry FPO-level aggregate facts only (stage,
 *    peril, season) — never insurer-internal notes or surveyor identity.
 */

/** Consent purpose that authorises an FPO to facilitate member insurance. */
export const INSURANCE_BRIDGE_PURPOSE = "fpo_member_management";

export const INSURANCE_BRIDGE_NOTE =
  "Cover figures are bound to a notified insurer policy where one exists for the member's district, crop and season. Enrolment, eligibility and claim outcomes remain decisions of the authorised insurer or government officer.";

export const CLAIM_SYNC_NOTE =
  "Claim status is mirrored from the insurer at organization level. It shows the stage of the FPO's claim, not an individual entitlement, and never an automated decision.";

export type CoverBindingState = "bound" | "pending" | "indicative" | "none";

export const COVER_BINDING_LABEL: Record<CoverBindingState, string> = {
  bound: "Bound to a notified policy",
  pending: "Policy pending enrolment",
  indicative: "Indicative only",
  none: "No cover linked",
};

export interface BindablePolicy {
  id: string;
  policy_reference: string;
  scheme_code: string;
  scheme_name: string;
  state_name: string | null;
  district: string | null;
  crop: string | null;
  season: string;
  status: string;
  coverage_start: string | null;
  coverage_end: string | null;
  sum_insured_per_acre_inr: number;
  actuarial_rate_pct: number;
  farmer_share_pct: number;
}

export interface FarmerCoverSubject {
  farmerUserId: string;
  district: string | null;
  crops: string[];
  acres: number;
}

/* ------------------------------------------------------------ season keys */

const SEASON_ALIASES: Array<[RegExp, string]> = [
  [/kharif/i, "kharif"],
  [/rabi/i, "rabi"],
  [/zaid|summer/i, "summer"],
  [/annual|perennial/i, "annual"],
];

export function seasonCodeFor(season: string): string {
  for (const [pattern, code] of SEASON_ALIASES) {
    if (pattern.test(season)) return code;
  }
  return season.trim().toLowerCase().replace(/[^a-z]+/g, "_") || "annual";
}

export function cropYearFor(season: string, fallbackYear: number): number {
  const match = season.match(/(20\d{2})/);
  return match ? Number(match[1]) : fallbackYear;
}

/* ------------------------------------------------------------- matching */

const norm = (v: string | null | undefined) => (v ?? "").trim().toLowerCase();

/**
 * A policy binds to a farmer when the district matches (or the policy is
 * state-wide, i.e. district not set) AND the crop matches one the farmer grows
 * (or the policy is crop-agnostic). Default-deny: an empty roster crop list
 * only matches crop-agnostic policies.
 */
export function policyMatchesFarmer(policy: BindablePolicy, subject: FarmerCoverSubject): boolean {
  if (policy.district && norm(policy.district) !== norm(subject.district)) return false;
  if (!policy.crop) return true;
  return subject.crops.some((c) => norm(c) === norm(policy.crop));
}

export function policyCoverState(status: string): CoverBindingState {
  if (status === "active" || status === "issued") return "bound";
  if (status === "pending_enrolment") return "pending";
  if (status === "draft") return "indicative";
  return "none";
}

const RANK: Record<CoverBindingState, number> = { bound: 3, pending: 2, indicative: 1, none: 0 };

/** Best applicable policy: strongest binding first, then most recent cover. */
export function pickPolicyForFarmer(
  policies: readonly BindablePolicy[],
  subject: FarmerCoverSubject,
): BindablePolicy | null {
  const applicable = policies.filter((p) => policyMatchesFarmer(p, subject));
  if (!applicable.length) return null;
  return [...applicable].sort((a, b) => {
    const rank = RANK[policyCoverState(b.status)] - RANK[policyCoverState(a.status)];
    if (rank !== 0) return rank;
    return (b.coverage_start ?? "").localeCompare(a.coverage_start ?? "");
  })[0]!;
}

/* ------------------------------------------------------------- binding */

export interface BoundCover {
  policyId: string;
  policyReference: string;
  schemeCode: string;
  schemeName: string;
  stateName: string | null;
  district: string | null;
  crop: string | null;
  season: string;
  seasonCode: string;
  cropYear: number;
  coverState: CoverBindingState;
  coverageStart: string | null;
  coverageEnd: string | null;
  acres: number;
  sumInsuredPerAcre: number;
  farmerSharePerAcre: number;
  indicativePremiumPerAcre: number;
  estimatedSumInsured: number;
  estimatedFarmerShare: number;
  /** Notified cap applied instead of the policy's own farmer share, if any. */
  notifiedFarmerSharePct: number | null;
}

const round2 = (v: number) => Math.round(v * 100) / 100;

/**
 * Per-farmer cover arithmetic. When a notified farmer-share cap exists
 * (PMFBY tables loaded in C1), the lower of the two shares is used — the cap
 * protects the farmer and is never exceeded by a policy's own figure.
 */
export function bindCoverForFarmer(
  policy: BindablePolicy,
  subject: FarmerCoverSubject,
  options: { notifiedFarmerSharePct?: number | null; fallbackYear?: number } = {},
): BoundCover {
  const notified = options.notifiedFarmerSharePct ?? null;
  const sharePct =
    notified === null ? policy.farmer_share_pct : Math.min(notified, policy.farmer_share_pct);
  const grossPerAcre = (policy.sum_insured_per_acre_inr * policy.actuarial_rate_pct) / 100;
  const farmerPerAcre = (policy.sum_insured_per_acre_inr * sharePct) / 100;
  const acres = Math.max(0, subject.acres);
  const year = options.fallbackYear ?? new Date().getUTCFullYear();

  return {
    policyId: policy.id,
    policyReference: policy.policy_reference,
    schemeCode: policy.scheme_code,
    schemeName: policy.scheme_name,
    stateName: policy.state_name,
    district: policy.district,
    crop: policy.crop,
    season: policy.season,
    seasonCode: seasonCodeFor(policy.season),
    cropYear: cropYearFor(policy.season, year),
    coverState: policyCoverState(policy.status),
    coverageStart: policy.coverage_start,
    coverageEnd: policy.coverage_end,
    acres: round2(acres),
    sumInsuredPerAcre: round2(policy.sum_insured_per_acre_inr),
    farmerSharePerAcre: round2(farmerPerAcre),
    indicativePremiumPerAcre: round2(grossPerAcre),
    estimatedSumInsured: Math.round(policy.sum_insured_per_acre_inr * acres),
    estimatedFarmerShare: Math.round(farmerPerAcre * acres),
    notifiedFarmerSharePct: notified,
  };
}

/** Row shape written to `farmer_insurance_snapshots` for a bound cover. */
export function coverSnapshotRow(
  cover: BoundCover,
  farmerUserId: string,
): Record<string, unknown> {
  return {
    farmer_user_id: farmerUserId,
    crop_year: cover.cropYear,
    season_code: cover.seasonCode,
    crop: cover.crop,
    state_name: cover.stateName,
    district: cover.district,
    scheme_code: cover.schemeCode,
    cover_state: cover.coverState === "bound" ? "covered" : "eligible",
    sum_insured_per_acre: cover.sumInsuredPerAcre,
    farmer_share_per_acre: cover.farmerSharePerAcre,
    indicative_premium_per_acre: cover.indicativePremiumPerAcre,
    contact_label: `Policy ${cover.policyReference} · ${cover.schemeName}`,
    source: "insurer_policy",
    is_synthetic: false,
  };
}

/* ------------------------------------------------------- claim advisory */

export type ClaimStage =
  | "reported"
  | "documents_pending"
  | "survey_assigned"
  | "assessment_review"
  | "approved"
  | "rejected"
  | "payout_initiated"
  | "settled"
  | "withdrawn";

export const CLAIM_STAGE_ADVISORY: Record<ClaimStage, string> = {
  reported: "Reported to the insurer — under acknowledgement",
  documents_pending: "Insurer has asked for more documents",
  survey_assigned: "Field survey assigned",
  assessment_review: "Loss assessment under review",
  approved: "Approved by the insurer",
  rejected: "Not approved by the insurer",
  payout_initiated: "Payout initiated",
  settled: "Settled",
  withdrawn: "Withdrawn",
};

export interface ClaimStatusRow {
  id: string;
  claim_reference: string;
  registration_number: string;
  fpo_name: string;
  district: string | null;
  crop: string | null;
  season: string;
  peril: string;
  stage: string;
  reported_at: string;
  decided_at: string | null;
}

export interface ClaimAdvisory {
  id: string;
  reference: string;
  fpoName: string;
  district: string | null;
  crop: string | null;
  season: string;
  peril: string;
  stage: string;
  stageLabel: string;
  reportedAt: string;
  decidedAt: string | null;
  /** True when the stage matches the farmer's own district and crop. */
  relevantToFarmer: boolean;
}

export function claimAdvisories(
  rows: readonly ClaimStatusRow[],
  subject: { district: string | null; crops: string[] },
): ClaimAdvisory[] {
  return rows
    .map((r) => ({
      id: r.id,
      reference: r.claim_reference,
      fpoName: r.fpo_name,
      district: r.district,
      crop: r.crop,
      season: r.season,
      peril: r.peril,
      stage: r.stage,
      stageLabel: CLAIM_STAGE_ADVISORY[r.stage as ClaimStage] ?? r.stage.replace(/_/g, " "),
      reportedAt: r.reported_at,
      decidedAt: r.decided_at,
      relevantToFarmer:
        (!r.district || norm(r.district) === norm(subject.district)) &&
        (!r.crop || subject.crops.some((c) => norm(c) === norm(r.crop))),
    }))
    .sort((a, b) => b.reportedAt.localeCompare(a.reportedAt));
}

/* ------------------------------------------------------------ sync plan */

export interface SyncPlanEntry {
  farmerUserId: string;
  cover: BoundCover;
}

export interface SyncPlan {
  entries: SyncPlanEntry[];
  eligibleMembers: number;
  skippedNoPolicy: number;
  skippedNoAcreage: number;
}

/**
 * Deterministic plan for a member cohort: which consented members get a bound
 * cover snapshot and why the rest are skipped. Skips are reported, never
 * silently dropped.
 */
export function buildSyncPlan(
  subjects: readonly FarmerCoverSubject[],
  policies: readonly BindablePolicy[],
  options: { notifiedFarmerSharePct?: number | null; fallbackYear?: number } = {},
): SyncPlan {
  const entries: SyncPlanEntry[] = [];
  let skippedNoPolicy = 0;
  let skippedNoAcreage = 0;

  for (const subject of subjects) {
    if (subject.acres <= 0) {
      skippedNoAcreage += 1;
      continue;
    }
    const policy = pickPolicyForFarmer(policies, subject);
    if (!policy || policyCoverState(policy.status) === "none") {
      skippedNoPolicy += 1;
      continue;
    }
    entries.push({
      farmerUserId: subject.farmerUserId,
      cover: bindCoverForFarmer(policy, subject, options),
    });
  }

  return {
    entries,
    eligibleMembers: subjects.length,
    skippedNoPolicy,
    skippedNoAcreage,
  };
}
