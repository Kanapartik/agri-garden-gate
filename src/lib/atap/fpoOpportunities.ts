/**
 * FPO Management & Operations workspace — Phase 3 pure domain logic.
 *
 * Opportunity Center + FPO scheme intelligence. Everything here is advisory:
 * eligibility is an explanation aid for an authorized human, never an automated
 * benefit decision. All authority checks are re-applied server-side.
 */

/* ------------------------------------------------------- opportunities */

export const OPPORTUNITY_CATEGORIES = [
  "scheme",
  "input_procurement",
  "collective_sale",
  "credit",
  "insurance",
  "training",
  "infrastructure",
  "processing",
  "storage",
  "equipment",
  "export",
  "certification",
  "market_linkage",
] as const;

export type OpportunityCategory = (typeof OPPORTUNITY_CATEGORIES)[number];

export const OPPORTUNITY_CATEGORY_LABEL: Record<OpportunityCategory, string> = {
  scheme: "Scheme",
  input_procurement: "Input procurement",
  collective_sale: "Collective sale",
  credit: "Credit",
  insurance: "Insurance",
  training: "Training",
  infrastructure: "Infrastructure",
  processing: "Processing",
  storage: "Storage",
  equipment: "Equipment",
  export: "Export",
  certification: "Certification",
  market_linkage: "Market linkage",
};

export const TRACK_STATUSES = [
  "new",
  "reviewing",
  "shortlisted",
  "applied",
  "not_relevant",
  "closed",
] as const;

export type TrackStatus = (typeof TRACK_STATUSES)[number];

export const TRACK_STATUS_LABEL: Record<TrackStatus, string> = {
  new: "New",
  reviewing: "Reviewing",
  shortlisted: "Shortlisted",
  applied: "Applied",
  not_relevant: "Not relevant",
  closed: "Closed",
};

const TRACK_TRANSITIONS: Record<TrackStatus, TrackStatus[]> = {
  new: ["reviewing", "shortlisted", "not_relevant", "closed"],
  reviewing: ["shortlisted", "applied", "not_relevant", "closed"],
  shortlisted: ["reviewing", "applied", "not_relevant", "closed"],
  applied: ["closed"],
  not_relevant: ["reviewing", "closed"],
  closed: ["reviewing"],
};

export function canTransitionTracking(from: TrackStatus, to: TrackStatus): boolean {
  return TRACK_TRANSITIONS[from]?.includes(to) ?? false;
}

export interface OpportunityRow {
  id: string;
  tenant_id: string | null;
  category: OpportunityCategory;
  title: string;
  provider_name: string;
  benefit_summary: string;
  eligibility_summary: string;
  required_documents: string[];
  commodities: string[];
  state_code: string | null;
  district_code: string | null;
  geography_note: string | null;
  application_deadline: string | null;
  source_name: string;
  source_url: string | null;
  last_verified_at: string | null;
  is_active: boolean;
}

export interface OpportunityFilters {
  search?: string | undefined;
  categories?: OpportunityCategory[] | undefined;
  statuses?: TrackStatus[] | undefined;
  commodities?: string[] | undefined;
  onlyMyGeography?: boolean | undefined;
  openOnly?: boolean | undefined;
}

export interface FpoGeography {
  state_code?: string | null;
  district_code?: string | null;
  commodities?: string[] | null;
}

/** A null scope means "applies everywhere"; a set scope must match the FPO. */
export function geographyMatches(row: OpportunityRow, fpo: FpoGeography): boolean {
  if (row.state_code && row.state_code !== (fpo.state_code ?? null)) return false;
  if (row.district_code && row.district_code !== (fpo.district_code ?? null)) return false;
  return true;
}

export function daysUntil(deadline: string | null, now = new Date()): number | null {
  if (!deadline) return null;
  const end = new Date(`${deadline.slice(0, 10)}T00:00:00Z`).getTime();
  const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((end - start) / 86_400_000);
}

export function isOpen(row: OpportunityRow, now = new Date()): boolean {
  const days = daysUntil(row.application_deadline, now);
  return row.is_active && (days === null || days >= 0);
}

/**
 * Recommendation is a transparent, explainable score — commodity overlap and
 * geography specificity first, urgency second. It never hides an opportunity.
 */
export function recommendationScore(
  row: OpportunityRow,
  fpo: FpoGeography,
  now = new Date(),
): number {
  let score = 0;
  const fpoCrops = (fpo.commodities ?? []).map((c) => c.toLowerCase());
  const overlap = row.commodities.filter((c) => fpoCrops.includes(c.toLowerCase())).length;
  score += overlap * 20;
  if (row.district_code && row.district_code === fpo.district_code) score += 25;
  else if (row.state_code && row.state_code === fpo.state_code) score += 15;
  else if (!row.state_code && !row.district_code) score += 5;
  const days = daysUntil(row.application_deadline, now);
  if (days !== null && days >= 0) score += days <= 14 ? 15 : days <= 30 ? 10 : 5;
  if (!isOpen(row, now)) score -= 40;
  return score;
}

export interface TrackingRow {
  opportunity_id: string;
  status: TrackStatus;
  owner_user_id?: string | null;
  note?: string | null;
}

export interface OpportunityCard extends OpportunityRow {
  status: TrackStatus;
  note: string | null;
  score: number;
  daysLeft: number | null;
  open: boolean;
  inGeography: boolean;
}

export function buildCards(
  rows: OpportunityRow[],
  tracking: TrackingRow[],
  fpo: FpoGeography,
  now = new Date(),
): OpportunityCard[] {
  const byId = new Map(tracking.map((t) => [t.opportunity_id, t]));
  return rows
    .map((row) => {
      const t = byId.get(row.id);
      return {
        ...row,
        status: t?.status ?? "new",
        note: t?.note ?? null,
        score: recommendationScore(row, fpo, now),
        daysLeft: daysUntil(row.application_deadline, now),
        open: isOpen(row, now),
        inGeography: geographyMatches(row, fpo),
      };
    })
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
}

export function filterCards(
  cards: OpportunityCard[],
  filters: OpportunityFilters,
): OpportunityCard[] {
  const term = (filters.search ?? "").trim().toLowerCase();
  return cards.filter((c) => {
    if (term) {
      const hay = [c.title, c.provider_name, c.benefit_summary, c.eligibility_summary]
        .join(" ")
        .toLowerCase();
      if (!hay.includes(term)) return false;
    }
    if (filters.categories?.length && !filters.categories.includes(c.category)) return false;
    if (filters.statuses?.length && !filters.statuses.includes(c.status)) return false;
    if (
      filters.commodities?.length &&
      !filters.commodities.some((x) => c.commodities.includes(x))
    ) {
      return false;
    }
    if (filters.onlyMyGeography && !c.inGeography) return false;
    if (filters.openOnly && !c.open) return false;
    return true;
  });
}

export function trackingCounts(cards: OpportunityCard[]): Record<TrackStatus, number> {
  const out = Object.fromEntries(TRACK_STATUSES.map((s) => [s, 0])) as Record<TrackStatus, number>;
  for (const c of cards) out[c.status] += 1;
  return out;
}

/* -------------------------------------------------- scheme eligibility */

export const ELIGIBILITY_BUCKETS = [
  "likely_eligible",
  "needs_verification",
  "not_eligible",
  "applied",
  "approved",
  "rejected",
  "benefit_received",
  "closed",
] as const;

export type EligibilityBucket = (typeof ELIGIBILITY_BUCKETS)[number];

export const ELIGIBILITY_BUCKET_LABEL: Record<EligibilityBucket, string> = {
  likely_eligible: "Eligible / likely",
  needs_verification: "Needs verification",
  not_eligible: "Not eligible",
  applied: "Applied",
  approved: "Approved",
  rejected: "Rejected",
  benefit_received: "Benefit received",
  closed: "Closed",
};

/** Buckets an FPO team may set itself; decision buckets belong to the reviewer. */
export const FPO_SETTABLE_BUCKETS: EligibilityBucket[] = [
  "likely_eligible",
  "needs_verification",
  "not_eligible",
  "applied",
  "closed",
];

export const DECISION_BUCKETS: EligibilityBucket[] = ["approved", "rejected", "benefit_received"];

export function isDecisionBucket(bucket: EligibilityBucket): boolean {
  return DECISION_BUCKETS.includes(bucket);
}

export function canSetBucket(bucket: EligibilityBucket, isPlatformAdmin: boolean): boolean {
  return isPlatformAdmin || FPO_SETTABLE_BUCKETS.includes(bucket);
}

export interface EligibilityProfileInput {
  state_code?: string | null;
  district_code?: string | null;
  commodities?: string[] | null;
  active_members?: number | null;
  registered_members?: number | null;
  total_acreage?: number | null;
  verification_state?: string | null;
  has_bank_account?: boolean;
  document_types?: string[];
}

export interface SchemeInput {
  id: string;
  code: string;
  title: string;
  summary: string;
  state_code?: string | null;
  district_code?: string | null;
  commodities?: string[] | null;
  min_active_members?: number | null;
  required_documents?: string[] | null;
}

export interface EligibilityExplanation {
  bucket: EligibilityBucket;
  reasons: string[];
  missing: string[];
  advisory: string;
}

export const ADVISORY_DISCLAIMER =
  "Advisory only — this is an explanation, not a decision. A government or partner officer verifies eligibility before any benefit is granted.";

/**
 * Plain-language explanation derived only from FPO profile facts. Anything the
 * platform cannot confirm becomes a "missing information" item and pushes the
 * assessment to `needs_verification` rather than asserting eligibility.
 */
export function explainEligibility(
  scheme: SchemeInput,
  fpo: EligibilityProfileInput,
): EligibilityExplanation {
  const reasons: string[] = [];
  const missing: string[] = [];
  let disqualified = false;

  if (scheme.state_code) {
    if (fpo.state_code === scheme.state_code) {
      reasons.push(`This FPO is registered in the scheme's state (${scheme.state_code}).`);
    } else if (!fpo.state_code) {
      missing.push("Confirm the FPO's registered state in the profile.");
    } else {
      reasons.push(
        `The scheme is limited to ${scheme.state_code}; this FPO is in ${fpo.state_code}.`,
      );
      disqualified = true;
    }
  }

  if (scheme.district_code) {
    if (fpo.district_code === scheme.district_code) {
      reasons.push(`The FPO's district (${fpo.district_code}) is covered by this scheme.`);
    } else if (!fpo.district_code) {
      missing.push("Confirm the FPO's district in the profile.");
    } else {
      reasons.push(
        `The scheme covers ${scheme.district_code}; this FPO is recorded in ${fpo.district_code}.`,
      );
      disqualified = true;
    }
  }

  const schemeCrops = (scheme.commodities ?? []).map((c) => c.toLowerCase());
  const fpoCrops = (fpo.commodities ?? []).map((c) => c.toLowerCase());
  if (schemeCrops.length) {
    const shared = schemeCrops.filter((c) => fpoCrops.includes(c));
    if (shared.length) {
      reasons.push(`Member crops overlap the scheme focus (${shared.join(", ")}).`);
    } else if (!fpoCrops.length) {
      missing.push("Record the FPO's primary commodities.");
    } else {
      reasons.push("No recorded member crop matches this scheme's commodity focus.");
      disqualified = true;
    }
  }

  if (scheme.min_active_members != null) {
    const active = fpo.active_members ?? null;
    if (active == null) {
      missing.push("Record the active member count.");
    } else if (active >= scheme.min_active_members) {
      reasons.push(
        `Active members (${active}) meet the indicative minimum of ${scheme.min_active_members}.`,
      );
    } else {
      reasons.push(
        `Active members (${active}) are below the indicative minimum of ${scheme.min_active_members}.`,
      );
      disqualified = true;
    }
  }

  for (const doc of scheme.required_documents ?? []) {
    if (!(fpo.document_types ?? []).includes(doc)) {
      missing.push(`Upload and verify: ${doc}.`);
    }
  }

  if (fpo.verification_state && fpo.verification_state !== "verified") {
    missing.push("Complete FPO verification before submitting an application.");
  }

  if (!reasons.length) reasons.push("This scheme records no FPO-specific restriction.");

  const bucket: EligibilityBucket = disqualified
    ? "not_eligible"
    : missing.length
      ? "needs_verification"
      : "likely_eligible";

  return { bucket, reasons, missing, advisory: ADVISORY_DISCLAIMER };
}

export interface EligibilityRow {
  scheme_id: string;
  bucket: EligibilityBucket;
  reasons: string[];
  missing_information: string[];
  advisory_note: string | null;
  source_name: string;
  assessed_at: string;
}

export interface SchemeCard extends SchemeInput {
  bucket: EligibilityBucket;
  reasons: string[];
  missing: string[];
  advisory: string;
  assessedAt: string | null;
  sourceName: string | null;
}

export function buildSchemeCards(
  schemes: SchemeInput[],
  rows: EligibilityRow[],
  fpo: EligibilityProfileInput,
): SchemeCard[] {
  const byScheme = new Map(rows.map((r) => [r.scheme_id, r]));
  return schemes.map((s) => {
    const stored = byScheme.get(s.id);
    if (stored) {
      return {
        ...s,
        bucket: stored.bucket,
        reasons: stored.reasons,
        missing: stored.missing_information,
        advisory: stored.advisory_note ?? ADVISORY_DISCLAIMER,
        assessedAt: stored.assessed_at,
        sourceName: stored.source_name,
      };
    }
    const derived = explainEligibility(s, fpo);
    return {
      ...s,
      bucket: derived.bucket,
      reasons: derived.reasons,
      missing: derived.missing,
      advisory: derived.advisory,
      assessedAt: null,
      sourceName: null,
    };
  });
}

export function bucketCounts(cards: SchemeCard[]): Record<EligibilityBucket, number> {
  const out = Object.fromEntries(ELIGIBILITY_BUCKETS.map((b) => [b, 0])) as Record<
    EligibilityBucket,
    number
  >;
  for (const c of cards) out[c.bucket] += 1;
  return out;
}

/* ------------------------------------------------------- authorization */

/** Any FPO staff member may read the catalogue; only admins may track/assess. */
export function canReadOpportunities(roles: string[], isPlatformAdmin: boolean): boolean {
  return isPlatformAdmin || roles.length > 0;
}

export function canManageOpportunities(roles: string[], isPlatformAdmin: boolean): boolean {
  return isPlatformAdmin || roles.includes("tenant_admin") || roles.includes("scheme_reviewer");
}
