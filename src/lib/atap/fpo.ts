/**
 * FPO Management & Operations workspace — Phase 1 pure domain logic.
 *
 * This module holds no I/O. Every authority decision made here is re-checked
 * server-side in `fpo.functions.ts`; the workspace sections and dashboard
 * counters below are presentation state derived from data the caller is
 * already permitted to read.
 */

/* ------------------------------------------------------------- sections */

export const FPO_SECTIONS = [
  "overview",
  "farmers",
  "schemes",
  "procurement",
  "produce",
  "accounts",
  "opportunities",
  "documents",
  "notifications",
  "tasks",
  "insights",
  "team",
  "settings",
] as const;

export type FpoSection = (typeof FPO_SECTIONS)[number];

export interface SectionDef {
  key: FpoSection;
  label: string;
  labelKey: string;
  /** Phase of the approved plan that lands this section. */
  phase: number;
}

export const FPO_SECTION_DEFS: SectionDef[] = [
  { key: "overview", label: "Overview", labelKey: "fpo.section.overview", phase: 1 },
  { key: "farmers", label: "Farmers", labelKey: "fpo.section.farmers", phase: 2 },
  { key: "schemes", label: "Schemes", labelKey: "fpo.section.schemes", phase: 3 },
  { key: "procurement", label: "Procurement", labelKey: "fpo.section.procurement", phase: 5 },
  { key: "produce", label: "Produce & market", labelKey: "fpo.section.produce", phase: 6 },
  { key: "accounts", label: "Accounts", labelKey: "fpo.section.accounts", phase: 7 },
  { key: "opportunities", label: "Opportunities", labelKey: "fpo.section.opportunities", phase: 3 },
  { key: "documents", label: "Documents", labelKey: "fpo.section.documents", phase: 1 },
  { key: "notifications", label: "Notifications", labelKey: "fpo.section.notifications", phase: 8 },
  { key: "tasks", label: "Tasks", labelKey: "fpo.section.tasks", phase: 8 },
  { key: "insights", label: "Insights", labelKey: "fpo.section.insights", phase: 10 },
  { key: "team", label: "Team", labelKey: "fpo.section.team", phase: 1 },
  { key: "settings", label: "Settings", labelKey: "fpo.section.settings", phase: 1 },
];

export function isFpoSection(value: string): value is FpoSection {
  return (FPO_SECTIONS as readonly string[]).includes(value);
}

/** Phases delivered so far; later sections render a scoped placeholder. */
export const DELIVERED_PHASES = 2;

export function sectionAvailable(key: FpoSection): boolean {
  const def = FPO_SECTION_DEFS.find((s) => s.key === key);
  return def ? def.phase <= DELIVERED_PHASES : false;
}

/* ---------------------------------------------------------- onboarding */

export const FPO_ONBOARDING_STEPS = [
  "basic_details",
  "registration",
  "location",
  "leadership",
  "bank_details",
  "documents",
  "commodities",
  "verification",
  "activation",
] as const;

export type FpoOnboardingStep = (typeof FPO_ONBOARDING_STEPS)[number];

export const FPO_STEP_LABEL: Record<FpoOnboardingStep, string> = {
  basic_details: "Basic details",
  registration: "Registration",
  location: "Location",
  leadership: "Leadership",
  bank_details: "Bank details",
  documents: "Documents",
  commodities: "Commodities",
  verification: "Verification",
  activation: "Activation",
};

export type FpoProfileState =
  "draft" | "in_progress" | "submitted" | "verified" | "active" | "suspended";

export interface FpoProfileLike {
  legal_name?: string | null;
  display_name?: string | null;
  registration_number?: string | null;
  incorporation_date?: string | null;
  org_type?: string | null;
  pan?: string | null;
  phone?: string | null;
  email?: string | null;
  registered_address?: string | null;
  state_code?: string | null;
  district_code?: string | null;
  mandal?: string | null;
  village?: string | null;
  pin_code?: string | null;
  primary_crops?: string[] | null;
  input_categories?: string[] | null;
  produce_categories?: string[] | null;
  registered_farmers?: number | null;
  active_farmers?: number | null;
  total_acres?: number | null;
  state?: FpoProfileState;
}

const STEP_REQUIREMENTS: Record<FpoOnboardingStep, Array<(p: FpoProfileLike) => boolean>> = {
  basic_details: [
    (p) => Boolean(p.legal_name?.trim()),
    (p) => Boolean(p.display_name?.trim()),
    (p) => Boolean(p.phone?.trim() || p.email?.trim()),
  ],
  registration: [
    (p) => Boolean(p.registration_number?.trim()),
    (p) => Boolean(p.incorporation_date),
    (p) => Boolean(p.org_type?.trim()),
    (p) => Boolean(p.pan?.trim()),
  ],
  location: [
    (p) => Boolean(p.registered_address?.trim()),
    (p) => Boolean(p.state_code?.trim()),
    (p) => Boolean(p.district_code?.trim()),
    (p) => Boolean(p.pin_code?.trim()),
  ],
  leadership: [],
  bank_details: [],
  documents: [],
  commodities: [
    (p) => (p.primary_crops ?? []).length > 0,
    (p) => Number(p.registered_farmers ?? 0) > 0,
    (p) => Number(p.total_acres ?? 0) > 0,
  ],
  verification: [],
  activation: [],
};

export interface StepState {
  step: FpoOnboardingStep;
  label: string;
  status: "not_started" | "in_progress" | "complete";
  satisfied: number;
  required: number;
}

export interface OnboardingCounts {
  leadership: number;
  signatories: number;
  bankAccounts: number;
  verifiedDocuments: number;
  documents: number;
  profileState: FpoProfileState;
}

/**
 * Step completion is derived from stored data, never from a "next" click, so a
 * half-finished profile always reopens on the first incomplete step.
 */
export function onboardingSteps(
  profile: FpoProfileLike | null,
  counts: OnboardingCounts,
): StepState[] {
  const p = profile ?? {};
  return FPO_ONBOARDING_STEPS.map((step) => {
    let satisfied: number;
    let required: number;

    if (step === "leadership") {
      required = 2;
      satisfied = (counts.leadership > 0 ? 1 : 0) + (counts.signatories > 0 ? 1 : 0);
    } else if (step === "bank_details") {
      required = 1;
      satisfied = counts.bankAccounts > 0 ? 1 : 0;
    } else if (step === "documents") {
      required = 1;
      satisfied = counts.documents > 0 ? 1 : 0;
    } else if (step === "verification") {
      required = 1;
      satisfied = counts.verifiedDocuments > 0 ? 1 : 0;
    } else if (step === "activation") {
      required = 1;
      satisfied = counts.profileState === "active" ? 1 : 0;
    } else {
      const checks = STEP_REQUIREMENTS[step];
      required = checks.length;
      satisfied = checks.filter((c) => c(p)).length;
    }

    return {
      step,
      label: FPO_STEP_LABEL[step],
      required,
      satisfied,
      status: satisfied === 0 ? "not_started" : satisfied >= required ? "complete" : "in_progress",
    };
  });
}

export function firstIncompleteStep(steps: StepState[]): FpoOnboardingStep {
  return (steps.find((s) => s.status !== "complete")?.step ?? "activation") as FpoOnboardingStep;
}

export function profileCompleteness(steps: StepState[]): number {
  const required = steps.reduce((sum, s) => sum + s.required, 0);
  if (required === 0) return 0;
  const satisfied = steps.reduce((sum, s) => sum + Math.min(s.satisfied, s.required), 0);
  return Math.round((satisfied / required) * 100);
}

/* ----------------------------------------------------------- documents */

export type FpoDocStatus = "uploaded" | "under_review" | "verified" | "rejected" | "expired";

export const FPO_DOC_TYPES = [
  "certificate_of_incorporation",
  "pan",
  "gst",
  "bank_proof",
  "board_resolution",
  "authorized_signatory",
  "license",
  "financial_statement",
  "audit_report",
  "government_registration",
  "certification",
] as const;

export type FpoDocType = (typeof FPO_DOC_TYPES)[number];

export const FPO_DOC_LABEL: Record<FpoDocType, string> = {
  certificate_of_incorporation: "Certificate of incorporation",
  pan: "PAN",
  gst: "GST",
  bank_proof: "Bank proof",
  board_resolution: "Board resolution",
  authorized_signatory: "Authorized signatory",
  license: "License",
  financial_statement: "Financial statement",
  audit_report: "Audit report",
  government_registration: "Government / FPO registration",
  certification: "Certification",
};

const DOC_TRANSITIONS: Record<FpoDocStatus, FpoDocStatus[]> = {
  uploaded: ["under_review", "rejected", "expired"],
  under_review: ["verified", "rejected", "expired"],
  verified: ["expired", "under_review"],
  rejected: ["uploaded", "expired"],
  expired: ["uploaded"],
};

export function canTransitionDocument(from: FpoDocStatus, to: FpoDocStatus): boolean {
  return DOC_TRANSITIONS[from].includes(to);
}

export interface DocLike {
  doc_type: string;
  status: FpoDocStatus;
  expires_at?: string | null;
}

/** Compliance work the FPO owes: expired, rejected, or expiring within 60 days. */
export function complianceActions(docs: DocLike[], now = new Date()): DocLike[] {
  const horizon = new Date(now.getTime() + 60 * 24 * 3600 * 1000);
  return docs.filter((d) => {
    if (d.status === "expired" || d.status === "rejected") return true;
    if (!d.expires_at) return false;
    const due = new Date(d.expires_at);
    return due <= horizon;
  });
}

export function missingRequiredDocs(docs: DocLike[]): FpoDocType[] {
  const required: FpoDocType[] = [
    "certificate_of_incorporation",
    "pan",
    "bank_proof",
    "board_resolution",
  ];
  const present = new Set(
    docs
      .filter((d) => d.status === "verified" || d.status === "under_review")
      .map((d) => d.doc_type),
  );
  return required.filter((r) => !present.has(r));
}

/* ---------------------------------------------------------------- bank */

/** Only the last four digits ever leave the server, for any role. */
export function maskAccount(last4: string | null | undefined): string {
  const digits = (last4 ?? "").replace(/\D/g, "").slice(-4);
  return digits.length === 4 ? `XXXX XXXX ${digits}` : "Not provided";
}

/**
 * Finance visibility is deliberately narrower than the rest of the profile.
 * Phase 9 adds the dedicated finance roles; until then only a tenant admin of
 * that FPO (or a platform admin) may see bank details.
 */
export function canViewFinance(roles: string[], isPlatformAdmin: boolean): boolean {
  return isPlatformAdmin || roles.includes("tenant_admin");
}

export function canManageProfile(roles: string[], isPlatformAdmin: boolean): boolean {
  return isPlatformAdmin || roles.includes("tenant_admin");
}

/* ----------------------------------------------------------- dashboard */

export interface DashboardInput {
  profile: FpoProfileLike | null;
  members: Array<{ status: string }>;
  docs: DocLike[];
  eligibleSchemes: number;
  applicationsInProgress: number;
  procurementOpportunities: number;
  produceAvailable: number;
  pendingReceivables: number;
  unreadNotifications: number;
}

export interface MetricCard {
  key: string;
  label: string;
  value: string;
  section: FpoSection;
  /** True when the number comes from a section not yet implemented. */
  pending: boolean;
}

export function dashboardMetrics(input: DashboardInput): MetricCard[] {
  const members = input.members;
  const active = members.filter((m) => m.status === "active").length;
  const pendingApprovals = members.filter((m) => m.status === "invited").length;
  const compliance = complianceActions(input.docs).length;

  return [
    {
      key: "members",
      label: "Total members",
      value: String(members.length),
      section: "farmers",
      pending: false,
    },
    {
      key: "active",
      label: "Active farmers",
      value: String(active),
      section: "farmers",
      pending: false,
    },
    {
      key: "pendingApprovals",
      label: "Pending farmer approvals",
      value: String(pendingApprovals),
      section: "farmers",
      pending: false,
    },
    {
      key: "area",
      label: "Farm area covered",
      value: `${Number(input.profile?.total_acres ?? 0).toLocaleString("en-IN")} ac`,
      section: "farmers",
      pending: false,
    },
    {
      key: "crops",
      label: "Active crops",
      value: String((input.profile?.primary_crops ?? []).length),
      section: "settings",
      pending: false,
    },
    {
      key: "eligible",
      label: "Eligible schemes",
      value: String(input.eligibleSchemes),
      section: "schemes",
      pending: true,
    },
    {
      key: "applications",
      label: "Scheme applications in progress",
      value: String(input.applicationsInProgress),
      section: "schemes",
      pending: true,
    },
    {
      key: "procurement",
      label: "Procurement opportunities",
      value: String(input.procurementOpportunities),
      section: "procurement",
      pending: true,
    },
    {
      key: "produce",
      label: "Produce available for sale",
      value: String(input.produceAvailable),
      section: "produce",
      pending: true,
    },
    {
      key: "receivables",
      label: "Pending payments / receivables",
      value: `₹${Number(input.pendingReceivables).toLocaleString("en-IN")}`,
      section: "accounts",
      pending: true,
    },
    {
      key: "compliance",
      label: "Compliance actions due",
      value: String(compliance),
      section: "documents",
      pending: false,
    },
    {
      key: "notifications",
      label: "Unread notifications",
      value: String(input.unreadNotifications),
      section: "notifications",
      pending: true,
    },
  ];
}
