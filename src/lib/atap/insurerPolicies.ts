/**
 * Slice I4 — insurer policy & enrolment lifecycle (pure logic).
 *
 * Aggregate-only: batches carry member counts and acres, never farmer identity.
 * Issuance and verification are human decisions; nothing here auto-decides.
 */

export const POLICY_HUMAN_DECISION_NOTE =
  "Policy issuance, enrolment verification and rejection are human decisions by an authorised insurer role. The platform computes premium arithmetic and flags variances only.";

export const POLICY_AGGREGATE_NOTE =
  "Enrolment batches record member counts and acres at FPO level. Individual farmer enrolment data stays with the FPO under its own consent scope.";

export type PolicyStatus =
  | "draft"
  | "pending_enrolment"
  | "issued"
  | "active"
  | "expired"
  | "cancelled";

export type EnrolmentState =
  | "draft"
  | "submitted"
  | "under_verification"
  | "verified"
  | "rejected"
  | "withdrawn"
  | "policy_linked";

export type RemittanceState =
  | "expected"
  | "received"
  | "reconciled"
  | "short"
  | "excess"
  | "refunded";

export const POLICY_STATUS_LABEL: Record<PolicyStatus, string> = {
  draft: "Draft",
  pending_enrolment: "Pending enrolment",
  issued: "Issued",
  active: "Active cover",
  expired: "Expired",
  cancelled: "Cancelled",
};

export const ENROLMENT_STATE_LABEL: Record<EnrolmentState, string> = {
  draft: "Draft",
  submitted: "Submitted",
  under_verification: "Under verification",
  verified: "Verified",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
  policy_linked: "Linked to policy",
};

export const REMITTANCE_STATE_LABEL: Record<RemittanceState, string> = {
  expected: "Expected",
  received: "Received",
  reconciled: "Reconciled",
  short: "Short received",
  excess: "Excess received",
  refunded: "Refunded",
};

export interface PolicyRow {
  id: string;
  insurer_tenant_id: string;
  policy_reference: string;
  registration_number: string;
  fpo_name: string;
  state_name: string | null;
  district: string | null;
  scheme_code: string;
  scheme_name: string;
  crop: string | null;
  season: string;
  status: PolicyStatus;
  coverage_start: string | null;
  coverage_end: string | null;
  enrolment_cutoff: string | null;
  sum_insured_per_acre_inr: number;
  actuarial_rate_pct: number;
  farmer_share_pct: number;
  centre_share_pct: number;
  state_share_pct: number;
  insured_acres: number;
  insured_members: number;
  gross_premium_inr: number;
  decision_note?: string | null;
}

export interface EnrolmentBatchRow {
  id: string;
  insurer_tenant_id: string;
  policy_id: string | null;
  batch_reference: string;
  registration_number: string;
  fpo_name: string;
  state_name: string | null;
  district: string | null;
  crop: string | null;
  season: string;
  state: EnrolmentState;
  member_count: number;
  acres: number;
  premium_due_inr: number;
  farmer_premium_inr: number;
  subsidy_premium_inr: number;
  submitted_at: string | null;
  verified_at: string | null;
  verification_note?: string | null;
  remittances?: RemittanceRow[];
}

export interface RemittanceRow {
  id: string;
  batch_id: string;
  remittance_reference: string;
  amount_inr: number;
  method: string;
  state: RemittanceState;
  received_at: string | null;
  reconciled_at: string | null;
}

/* ------------------------------------------------- premium arithmetic */

export interface PremiumSplit {
  grossInr: number;
  farmerInr: number;
  centreInr: number;
  stateInr: number;
}

export function grossPremium(
  acres: number,
  sumInsuredPerAcreInr: number,
  actuarialRatePct: number,
): number {
  if (acres <= 0 || sumInsuredPerAcreInr <= 0 || actuarialRatePct <= 0) return 0;
  return Math.round((acres * sumInsuredPerAcreInr * actuarialRatePct) / 100);
}

export function splitPremium(
  grossInr: number,
  shares: { farmer_share_pct: number; centre_share_pct: number; state_share_pct: number },
): PremiumSplit {
  const gross = Math.max(0, Math.round(grossInr));
  const farmer = Math.round((gross * shares.farmer_share_pct) / 100);
  const centre = Math.round((gross * shares.centre_share_pct) / 100);
  const state = gross - farmer - centre;
  return { grossInr: gross, farmerInr: farmer, centreInr: centre, stateInr: Math.max(0, state) };
}

export function sharesAreValid(shares: {
  farmer_share_pct: number;
  centre_share_pct: number;
  state_share_pct: number;
}): boolean {
  const total = shares.farmer_share_pct + shares.centre_share_pct + shares.state_share_pct;
  return (
    shares.farmer_share_pct >= 0 &&
    shares.centre_share_pct >= 0 &&
    shares.state_share_pct >= 0 &&
    Math.abs(total - 100) < 0.01
  );
}

/* ------------------------------------------------------ coverage rules */

export function coverageWindowIsValid(policy: {
  coverage_start: string | null;
  coverage_end: string | null;
}): boolean {
  if (!policy.coverage_start || !policy.coverage_end) return false;
  return new Date(policy.coverage_start).getTime() < new Date(policy.coverage_end).getTime();
}

export function enrolmentIsOpen(
  policy: { enrolment_cutoff: string | null },
  now = new Date(),
): boolean {
  if (!policy.enrolment_cutoff) return false;
  return new Date(policy.enrolment_cutoff).getTime() >= now.getTime();
}

export function policyIsInForce(policy: PolicyRow, now = new Date()): boolean {
  if (policy.status !== "active" && policy.status !== "issued") return false;
  if (!coverageWindowIsValid(policy)) return false;
  const t = now.getTime();
  return (
    new Date(policy.coverage_start as string).getTime() <= t &&
    new Date(policy.coverage_end as string).getTime() >= t
  );
}

/* --------------------------------------------------- state transitions */

const POLICY_TRANSITIONS: Record<PolicyStatus, PolicyStatus[]> = {
  draft: ["pending_enrolment", "cancelled"],
  pending_enrolment: ["issued", "cancelled"],
  issued: ["active", "cancelled"],
  active: ["expired", "cancelled"],
  expired: [],
  cancelled: [],
};

const ENROLMENT_TRANSITIONS: Record<EnrolmentState, EnrolmentState[]> = {
  draft: ["submitted", "withdrawn"],
  submitted: ["under_verification", "withdrawn"],
  under_verification: ["verified", "rejected"],
  verified: ["policy_linked", "rejected"],
  rejected: [],
  withdrawn: [],
  policy_linked: [],
};

export const POLICY_DECISION_STATUSES: readonly PolicyStatus[] = ["issued", "cancelled"];
export const ENROLMENT_DECISION_STATES: readonly EnrolmentState[] = [
  "verified",
  "rejected",
  "withdrawn",
];

export function canMovePolicyStatus(from: PolicyStatus, to: PolicyStatus): boolean {
  return (POLICY_TRANSITIONS[from] ?? []).includes(to);
}

export function nextPolicyStatuses(from: PolicyStatus): PolicyStatus[] {
  return [...(POLICY_TRANSITIONS[from] ?? [])];
}

export function canMoveEnrolmentState(from: EnrolmentState, to: EnrolmentState): boolean {
  return (ENROLMENT_TRANSITIONS[from] ?? []).includes(to);
}

export function nextEnrolmentStates(from: EnrolmentState): EnrolmentState[] {
  return [...(ENROLMENT_TRANSITIONS[from] ?? [])];
}

export function requiresPolicyDecisionNote(to: PolicyStatus): boolean {
  return POLICY_DECISION_STATUSES.includes(to);
}

export function requiresEnrolmentDecisionNote(to: EnrolmentState): boolean {
  return ENROLMENT_DECISION_STATES.includes(to);
}

/**
 * Issuance guard: a policy may only be issued when the premium arithmetic is
 * coherent and at least one verified enrolment batch backs it.
 */
export function blocksPolicyIssuance(
  policy: PolicyRow,
  batches: EnrolmentBatchRow[],
): string | null {
  if (!sharesAreValid(policy)) return "Premium shares must total 100%";
  if (!coverageWindowIsValid(policy)) return "Coverage start must precede coverage end";
  if (policy.gross_premium_inr <= 0) return "Gross premium must be greater than zero";
  const backed = batches.some(
    (b) => b.policy_id === policy.id && (b.state === "verified" || b.state === "policy_linked"),
  );
  if (!backed) return "At least one verified enrolment batch is required";
  return null;
}

/* ----------------------------------------------------- reconciliation */

export interface ReconciliationRow {
  batchId: string;
  batchReference: string;
  fpoName: string;
  expectedInr: number;
  receivedInr: number;
  varianceInr: number;
  status: "matched" | "short" | "excess" | "awaiting";
}

export function reconcileBatch(batch: EnrolmentBatchRow): ReconciliationRow {
  const received = (batch.remittances ?? [])
    .filter((r) => r.state !== "expected" && r.state !== "refunded")
    .reduce((sum, r) => sum + Number(r.amount_inr || 0), 0);
  const expected = Number(batch.farmer_premium_inr || 0);
  const variance = Math.round(received - expected);
  let status: ReconciliationRow["status"] = "awaiting";
  if (received > 0) {
    if (Math.abs(variance) <= 1) status = "matched";
    else status = variance < 0 ? "short" : "excess";
  }
  return {
    batchId: batch.id,
    batchReference: batch.batch_reference,
    fpoName: batch.fpo_name,
    expectedInr: expected,
    receivedInr: Math.round(received),
    varianceInr: variance,
    status,
  };
}

export function reconcileBatches(batches: EnrolmentBatchRow[]): ReconciliationRow[] {
  return batches.map(reconcileBatch);
}

/* -------------------------------------------------------- roll-ups */

export interface PortfolioSummary {
  policies: number;
  activePolicies: number;
  insuredAcres: number;
  insuredMembers: number;
  grossPremiumInr: number;
  farmerPremiumInr: number;
  subsidyPremiumInr: number;
  averageSumInsuredPerAcreInr: number;
}

export function summarizePortfolio(
  policies: PolicyRow[],
  batches: EnrolmentBatchRow[] = [],
  now = new Date(),
): PortfolioSummary {
  const insuredAcres = policies.reduce((s, p) => s + Number(p.insured_acres || 0), 0);
  const insuredMembers = policies.reduce((s, p) => s + Number(p.insured_members || 0), 0);
  const gross = policies.reduce((s, p) => s + Number(p.gross_premium_inr || 0), 0);
  const farmer = batches.reduce((s, b) => s + Number(b.farmer_premium_inr || 0), 0);
  const subsidy = batches.reduce((s, b) => s + Number(b.subsidy_premium_inr || 0), 0);
  return {
    policies: policies.length,
    activePolicies: policies.filter((p) => policyIsInForce(p, now)).length,
    insuredAcres: Math.round(insuredAcres),
    insuredMembers,
    grossPremiumInr: Math.round(gross),
    farmerPremiumInr: Math.round(farmer),
    subsidyPremiumInr: Math.round(subsidy),
    averageSumInsuredPerAcreInr: policies.length
      ? Math.round(
          policies.reduce((s, p) => s + Number(p.sum_insured_per_acre_inr || 0), 0) /
            policies.length,
        )
      : 0,
  };
}

export interface EnrolmentBucket {
  state: EnrolmentState;
  count: number;
  members: number;
  acres: number;
  premiumDueInr: number;
}

export function batchesByState(batches: EnrolmentBatchRow[]): EnrolmentBucket[] {
  const order: EnrolmentState[] = [
    "draft",
    "submitted",
    "under_verification",
    "verified",
    "policy_linked",
    "rejected",
    "withdrawn",
  ];
  return order
    .map((state) => {
      const rows = batches.filter((b) => b.state === state);
      return {
        state,
        count: rows.length,
        members: rows.reduce((s, b) => s + Number(b.member_count || 0), 0),
        acres: Math.round(rows.reduce((s, b) => s + Number(b.acres || 0), 0)),
        premiumDueInr: Math.round(rows.reduce((s, b) => s + Number(b.premium_due_inr || 0), 0)),
      };
    })
    .filter((b) => b.count > 0);
}

/* --------------------------------------------------------- filtering */

export interface PolicyFilters {
  state?: string;
  status?: PolicyStatus | "all";
  season?: string;
  search?: string;
}

export function filterPolicies(rows: PolicyRow[], f: PolicyFilters): PolicyRow[] {
  const q = (f.search ?? "").trim().toLowerCase();
  return rows.filter((r) => {
    if (f.state && r.state_name !== f.state) return false;
    if (f.status && f.status !== "all" && r.status !== f.status) return false;
    if (f.season && r.season !== f.season) return false;
    if (
      q &&
      !`${r.policy_reference} ${r.fpo_name} ${r.district ?? ""} ${r.crop ?? ""}`
        .toLowerCase()
        .includes(q)
    )
      return false;
    return true;
  });
}

export function policyStates(rows: PolicyRow[]): string[] {
  return [...new Set(rows.map((r) => r.state_name).filter(Boolean) as string[])].sort();
}

export function policySeasons(rows: PolicyRow[]): string[] {
  return [...new Set(rows.map((r) => r.season))].sort();
}

export function formatInr(value: number): string {
  if (!Number.isFinite(value)) return "₹0";
  if (Math.abs(value) >= 10000000) return `₹${(value / 10000000).toFixed(2)} Cr`;
  if (Math.abs(value) >= 100000) return `₹${(value / 100000).toFixed(2)} L`;
  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}
