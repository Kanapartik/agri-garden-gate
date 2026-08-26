/**
 * FPO Management & Operations workspace — Phase 4 pure domain logic.
 *
 * FPO-as-applicant scheme application tracking, plus member scheme
 * facilitation (assisted campaigns). No I/O here; every authority decision is
 * re-checked server-side in `fpoApplications.functions.ts`.
 *
 * Non-negotiables encoded here:
 * - The FPO can never submit a farmer's application without recorded farmer
 *   authorization (`AUTHORIZED_STATES`).
 * - Approval / rejection / benefit outcomes are recorded by the authorized
 *   reviewer, never derived by the platform or claimed by the FPO.
 * - Submission can be gated to an authorized signatory.
 */
import type { AppRole } from "@/lib/atap/policy";

/* ------------------------------------------------------- application flow */

export const APPLICATION_STATUSES = [
  "draft",
  "documents_pending",
  "ready_to_submit",
  "submitted",
  "under_review",
  "additional_info_requested",
  "approved",
  "rejected",
  "benefit_pending",
  "benefit_received",
  "closed",
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const APPLICATION_STATUS_LABEL: Record<ApplicationStatus, string> = {
  draft: "Draft",
  documents_pending: "Documents pending",
  ready_to_submit: "Ready to submit",
  submitted: "Submitted",
  under_review: "Under review",
  additional_info_requested: "Additional info requested",
  approved: "Approved",
  rejected: "Rejected",
  benefit_pending: "Benefit pending",
  benefit_received: "Benefit received",
  closed: "Closed",
};

const APPLICATION_TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  draft: ["documents_pending", "ready_to_submit", "closed"],
  documents_pending: ["ready_to_submit", "draft", "closed"],
  ready_to_submit: ["submitted", "documents_pending", "closed"],
  submitted: ["under_review", "additional_info_requested", "approved", "rejected", "closed"],
  under_review: ["additional_info_requested", "approved", "rejected", "closed"],
  additional_info_requested: ["under_review", "submitted", "rejected", "closed"],
  approved: ["benefit_pending", "benefit_received", "closed"],
  rejected: ["closed"],
  benefit_pending: ["benefit_received", "closed"],
  benefit_received: ["closed"],
  closed: [],
};

/** Outcomes that belong to the scheme's authorized reviewer, not the FPO. */
export const DECISION_STATUSES: ApplicationStatus[] = [
  "approved",
  "rejected",
  "benefit_pending",
  "benefit_received",
];

export function isDecisionStatus(status: ApplicationStatus): boolean {
  return DECISION_STATUSES.includes(status);
}

export function canTransitionApplication(
  from: ApplicationStatus,
  to: ApplicationStatus,
): boolean {
  return APPLICATION_TRANSITIONS[from].includes(to);
}

export function nextApplicationStatuses(from: ApplicationStatus): ApplicationStatus[] {
  return [...APPLICATION_TRANSITIONS[from]];
}

export interface ApplicationLike {
  status: ApplicationStatus;
  pending_documents?: string[] | null;
  requires_signatory?: boolean | null;
}

export interface SubmissionReadiness {
  ready: boolean;
  blockers: string[];
}

/**
 * Submission readiness. `isSignatory` is the caller's recorded leadership
 * signatory flag — an FPO admin without it cannot submit a signatory-gated
 * application, they can only prepare it.
 */
export function submissionReadiness(
  application: ApplicationLike,
  opts: { isSignatory: boolean },
): SubmissionReadiness {
  const blockers: string[] = [];
  if (application.status !== "ready_to_submit" && application.status !== "additional_info_requested") {
    blockers.push("Application must be marked ready to submit first");
  }
  const pending = application.pending_documents ?? [];
  if (pending.length > 0) {
    blockers.push(`${pending.length} document(s) still pending`);
  }
  if (application.requires_signatory && !opts.isSignatory) {
    blockers.push("Only an authorized signatory can submit this application");
  }
  return { ready: blockers.length === 0, blockers };
}

export function applicationCounts(
  rows: Array<{ status: ApplicationStatus }>,
): Record<ApplicationStatus, number> {
  const counts = Object.fromEntries(APPLICATION_STATUSES.map((s) => [s, 0])) as Record<
    ApplicationStatus,
    number
  >;
  for (const row of rows) counts[row.status] += 1;
  return counts;
}

export interface ApplicationFilter {
  search?: string;
  status?: ApplicationStatus | "";
  assignedUserId?: string | "";
}

export function filterApplications<
  T extends {
    title: string;
    reference_no?: string | null;
    status: ApplicationStatus;
    assigned_user_id?: string | null;
  },
>(rows: T[], filter: ApplicationFilter): T[] {
  const term = (filter.search ?? "").trim().toLowerCase();
  return rows.filter((row) => {
    if (filter.status && row.status !== filter.status) return false;
    if (filter.assignedUserId && row.assigned_user_id !== filter.assignedUserId) return false;
    if (term && !`${row.title} ${row.reference_no ?? ""}`.toLowerCase().includes(term)) return false;
    return true;
  });
}

/* ------------------------------------------------------ facilitation flow */

export const FACILITATION_STATES = [
  "identified",
  "notified",
  "authorization_pending",
  "authorized",
  "application_started",
  "application_submitted",
  "declined",
  "not_eligible",
] as const;

export type FacilitationState = (typeof FACILITATION_STATES)[number];

export const FACILITATION_STATE_LABEL: Record<FacilitationState, string> = {
  identified: "Identified",
  notified: "Farmer notified",
  authorization_pending: "Authorization pending",
  authorized: "Farmer authorized",
  application_started: "Application started",
  application_submitted: "Application submitted",
  declined: "Farmer declined",
  not_eligible: "Not eligible",
};

const FACILITATION_TRANSITIONS: Record<FacilitationState, FacilitationState[]> = {
  identified: ["notified", "not_eligible", "declined"],
  notified: ["authorization_pending", "declined", "not_eligible"],
  authorization_pending: ["authorized", "declined"],
  authorized: ["application_started", "declined"],
  application_started: ["application_submitted", "declined"],
  application_submitted: [],
  declined: ["identified"],
  not_eligible: ["identified"],
};

/** States in which documented farmer authorization exists. */
export const AUTHORIZED_STATES: FacilitationState[] = [
  "authorized",
  "application_started",
  "application_submitted",
];

export function canTransitionFacilitation(
  from: FacilitationState,
  to: FacilitationState,
): boolean {
  return FACILITATION_TRANSITIONS[from].includes(to);
}

export function nextFacilitationStates(from: FacilitationState): FacilitationState[] {
  return [...FACILITATION_TRANSITIONS[from]];
}

/**
 * An FPO may only start or submit a farmer application once authorization is
 * recorded for the assistance purpose. Consent, not membership, is the gate.
 */
export function canAssistFarmerApplication(input: {
  state: FacilitationState;
  hasAssistanceConsent: boolean;
}): boolean {
  return input.hasAssistanceConsent && AUTHORIZED_STATES.includes(input.state);
}

export function facilitationCounts(
  rows: Array<{ state: FacilitationState }>,
): Record<FacilitationState, number> {
  const counts = Object.fromEntries(FACILITATION_STATES.map((s) => [s, 0])) as Record<
    FacilitationState,
    number
  >;
  for (const row of rows) counts[row.state] += 1;
  return counts;
}

export const CAMPAIGN_STATUSES = ["draft", "active", "paused", "closed"] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export const CAMPAIGN_STATUS_LABEL: Record<CampaignStatus, string> = {
  draft: "Draft",
  active: "Active",
  paused: "Paused",
  closed: "Closed",
};

/* ------------------------------------------------------------- authority */

const MANAGE_ROLES: AppRole[] = ["tenant_admin", "onboarding_officer"];

export function canManageApplications(roles: AppRole[], isPlatformAdmin: boolean): boolean {
  return isPlatformAdmin || roles.some((r) => MANAGE_ROLES.includes(r));
}

/** Only a platform-authorized reviewer records a scheme decision outcome. */
export function canRecordDecision(isPlatformAdmin: boolean, roles: AppRole[]): boolean {
  return isPlatformAdmin || roles.includes("scheme_reviewer");
}

export function canRunCampaigns(roles: AppRole[], isPlatformAdmin: boolean): boolean {
  return canManageApplications(roles, isPlatformAdmin) || roles.includes("field_agent");
}

export const FACILITATION_DISCLAIMER =
  "AgriGhar records assistance only. Scheme approval, rejection and benefit release remain with the authorized government reviewer, and no farmer application is submitted without that farmer's recorded authorization.";
