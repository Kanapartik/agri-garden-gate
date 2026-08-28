/**
 * Slice I3 — Insurer claims intake & settlement lifecycle, pure helpers.
 *
 * Claims here are FPO/district-level records: no farmer identity, contact,
 * bank or plot data is stored or read. Every stage move, approval, rejection
 * and payout is a human decision by an authorised insurer role — nothing in
 * this module decides eligibility or amounts automatically.
 */

export const CLAIMS_HUMAN_DECISION_NOTE =
  "Claim approval, rejection, assessed loss and payout amounts are decided by the authorised claims officer. The platform records evidence, stage history and SLA ageing — it never auto-decides a claim.";

export const CLAIMS_AGGREGATE_NOTE =
  "Claim records are FPO-level and aggregate: affected member counts and acreage only. No farmer identity, contact or bank data is held in this workspace.";

/* ------------------------------------------------------------------ types */

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

export type ClaimDocStatus = "pending" | "received" | "verified" | "rejected";

export type ClaimPeril =
  | "drought"
  | "excess_rain"
  | "flood"
  | "hail"
  | "pest_outbreak"
  | "heatwave"
  | "cyclone";

export interface ClaimDocRow {
  id: string;
  claim_id: string;
  doc_type: string;
  label: string;
  required: boolean;
  status: ClaimDocStatus;
  received_at: string | null;
}

export interface ClaimEventRow {
  id: string;
  claim_id: string;
  from_stage: ClaimStage | null;
  to_stage: ClaimStage;
  note: string | null;
  created_at: string;
}

export interface ClaimRow {
  id: string;
  insurer_tenant_id: string;
  claim_reference: string;
  registration_number: string;
  fpo_name: string;
  state_name: string | null;
  district: string | null;
  crop: string | null;
  season: string;
  peril: ClaimPeril;
  stage: ClaimStage;
  risk_cell_id: string | null;
  affected_members: number;
  reported_acres: number | null;
  assessed_loss_pct: number | null;
  claimed_amount_inr: number;
  approved_amount_inr: number | null;
  surveyor_name: string | null;
  /** Insurer-internal; never returned on the FPO-facing read. */
  internal_notes?: string | null;
  decision_note: string | null;
  decided_at: string | null;
  reported_at: string;
  response_due_at: string | null;
  documents?: ClaimDocRow[];
  events?: ClaimEventRow[];
}

/* ----------------------------------------------------------- stage model */

export const CLAIM_STAGES: readonly ClaimStage[] = [
  "reported",
  "documents_pending",
  "survey_assigned",
  "assessment_review",
  "approved",
  "rejected",
  "payout_initiated",
  "settled",
  "withdrawn",
];

export const STAGE_LABEL: Record<ClaimStage, string> = {
  reported: "Reported",
  documents_pending: "Documents pending",
  survey_assigned: "Survey assigned",
  assessment_review: "Assessment review",
  approved: "Approved",
  rejected: "Rejected",
  payout_initiated: "Payout initiated",
  settled: "Settled",
  withdrawn: "Withdrawn",
};

export const PERIL_LABEL: Record<ClaimPeril, string> = {
  drought: "Drought",
  excess_rain: "Excess rain",
  flood: "Flood",
  hail: "Hail",
  pest_outbreak: "Pest outbreak",
  heatwave: "Heatwave",
  cyclone: "Cyclone",
};

/** Terminal stages: no further movement. */
export const TERMINAL_STAGES: readonly ClaimStage[] = ["settled", "rejected", "withdrawn"];

const ALLOWED: Record<ClaimStage, readonly ClaimStage[]> = {
  reported: ["documents_pending", "survey_assigned", "withdrawn"],
  documents_pending: ["survey_assigned", "rejected", "withdrawn"],
  survey_assigned: ["assessment_review", "documents_pending", "withdrawn"],
  assessment_review: ["approved", "rejected", "documents_pending", "withdrawn"],
  approved: ["payout_initiated", "assessment_review"],
  rejected: [],
  payout_initiated: ["settled"],
  settled: [],
  withdrawn: [],
};

/** Stages whose entry requires an explicit human decision note. */
export const DECISION_STAGES: readonly ClaimStage[] = ["approved", "rejected", "withdrawn"];

export function canMoveClaimStage(from: ClaimStage, to: ClaimStage): boolean {
  return ALLOWED[from].includes(to);
}

export function nextStages(from: ClaimStage): ClaimStage[] {
  return [...ALLOWED[from]];
}

export function requiresDecisionNote(to: ClaimStage): boolean {
  return DECISION_STAGES.includes(to);
}

/* ------------------------------------------------------------- evidence */

export interface EvidenceState {
  required: number;
  verified: number;
  pending: number;
  complete: boolean;
}

export function evidenceState(docs: ClaimDocRow[]): EvidenceState {
  const required = docs.filter((d) => d.required);
  const verified = required.filter((d) => d.status === "verified").length;
  return {
    required: required.length,
    verified,
    pending: required.length - verified,
    complete: required.length > 0 && verified === required.length,
  };
}

/**
 * Approval gate: mandatory evidence must be verified before a claim can be
 * approved. This is a process guard, not an automated decision.
 */
export function blocksApproval(to: ClaimStage, docs: ClaimDocRow[]): boolean {
  if (to !== "approved") return false;
  return !evidenceState(docs).complete;
}

/* ------------------------------------------------------------- ageing */

export function claimAgeDays(claim: ClaimRow, now = new Date()): number {
  const ms = now.getTime() - new Date(claim.reported_at).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

export function isOverdue(claim: ClaimRow, now = new Date()): boolean {
  if (!claim.response_due_at) return false;
  if (TERMINAL_STAGES.includes(claim.stage)) return false;
  return new Date(claim.response_due_at).getTime() < now.getTime();
}

/* ------------------------------------------------------------ summaries */

export interface ClaimsSummary {
  total: number;
  open: number;
  overdue: number;
  claimedInr: number;
  approvedInr: number;
  settledCount: number;
  approvalRatePct: number;
  averageAgeDays: number;
}

export function summarizeClaims(claims: ClaimRow[], now = new Date()): ClaimsSummary {
  const decided = claims.filter((c) => c.stage === "approved" || c.stage === "rejected" || c.stage === "payout_initiated" || c.stage === "settled");
  const approved = decided.filter((c) => c.stage !== "rejected");
  const ages = claims.map((c) => claimAgeDays(c, now));
  return {
    total: claims.length,
    open: claims.filter((c) => !TERMINAL_STAGES.includes(c.stage)).length,
    overdue: claims.filter((c) => isOverdue(c, now)).length,
    claimedInr: claims.reduce((s, c) => s + (c.claimed_amount_inr ?? 0), 0),
    approvedInr: claims.reduce((s, c) => s + (c.approved_amount_inr ?? 0), 0),
    settledCount: claims.filter((c) => c.stage === "settled").length,
    approvalRatePct: decided.length ? Math.round((approved.length / decided.length) * 100) : 0,
    averageAgeDays: ages.length ? Math.round(ages.reduce((s, a) => s + a, 0) / ages.length) : 0,
  };
}

export interface StageBucket {
  stage: ClaimStage;
  count: number;
  claimedInr: number;
}

export function claimsByStage(claims: ClaimRow[]): StageBucket[] {
  return CLAIM_STAGES.map((stage) => {
    const rows = claims.filter((c) => c.stage === stage);
    return {
      stage,
      count: rows.length,
      claimedInr: rows.reduce((s, c) => s + (c.claimed_amount_inr ?? 0), 0),
    };
  });
}

/* -------------------------------------------------------------- filters */

export interface ClaimFilters {
  state?: string;
  district?: string;
  stage?: ClaimStage | "all";
  peril?: ClaimPeril | "all";
  overdueOnly?: boolean;
  search?: string;
}

export function filterClaims(claims: ClaimRow[], f: ClaimFilters, now = new Date()): ClaimRow[] {
  const q = (f.search ?? "").trim().toLowerCase();
  return claims.filter((c) => {
    if (f.state && c.state_name !== f.state) return false;
    if (f.district && c.district !== f.district) return false;
    if (f.stage && f.stage !== "all" && c.stage !== f.stage) return false;
    if (f.peril && f.peril !== "all" && c.peril !== f.peril) return false;
    if (f.overdueOnly && !isOverdue(c, now)) return false;
    if (q) {
      const hay = `${c.claim_reference} ${c.fpo_name} ${c.registration_number} ${c.district ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export function claimStates(claims: ClaimRow[]): string[] {
  return [...new Set(claims.map((c) => c.state_name).filter((s): s is string => Boolean(s)))].sort();
}

export function formatInr(value: number): string {
  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}
