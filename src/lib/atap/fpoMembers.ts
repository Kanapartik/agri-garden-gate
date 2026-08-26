/**
 * FPO Management & Operations workspace — Phase 2 pure domain logic.
 *
 * Membership is a *relationship* between an FPO tenant and an existing AgriGhar
 * farmer identity. Nothing here creates or mutates farmer master data: tags and
 * segments are an FPO-local classification layer, and every Farmer 360 field
 * group is gated by an explicit, purpose-scoped, revocable farmer consent.
 *
 * All decisions in this module are re-checked server-side.
 */

/* ---------------------------------------------------------- lifecycle */

export const MEMBERSHIP_STATES = [
  "invited",
  "approval_pending",
  "active",
  "suspended",
  "exited",
  "removed",
] as const;

export type MembershipState = (typeof MEMBERSHIP_STATES)[number];

export const MEMBERSHIP_STATE_LABEL: Record<MembershipState, string> = {
  invited: "Invited",
  approval_pending: "Farmer approval pending",
  active: "Active",
  suspended: "Suspended",
  exited: "Exited",
  removed: "Removed",
};

const MEMBERSHIP_TRANSITIONS: Record<MembershipState, MembershipState[]> = {
  invited: ["approval_pending", "active", "exited", "removed"],
  approval_pending: ["active", "invited", "exited", "removed"],
  active: ["suspended", "exited", "removed"],
  suspended: ["active", "exited", "removed"],
  exited: ["invited", "active"],
  removed: [],
};

export function canTransitionMembership(from: MembershipState, to: MembershipState): boolean {
  return MEMBERSHIP_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * A membership only becomes active once the farmer identity is linked, because
 * an unlinked roster row cannot represent a farmer's own decision to join.
 */
export function canActivateMembership(member: {
  status: MembershipState;
  farmer_user_id?: string | null;
}): { ok: boolean; reason?: string } {
  if (!canTransitionMembership(member.status, "active")) {
    return { ok: false, reason: "invalid_transition" };
  }
  if (!member.farmer_user_id) return { ok: false, reason: "farmer_identity_not_linked" };
  return { ok: true };
}

export const MEMBER_TYPES = [
  "shareholder",
  "associate",
  "prospective",
  "tenant_farmer",
  "women_shg",
  "landless_service",
] as const;

export type MemberType = (typeof MEMBER_TYPES)[number];

/* --------------------------------------------------- membership number */

/** `FPO-<code>/M-000123` — stable, human-quotable, no farmer PII embedded. */
export function membershipNumber(fpoCode: string, sequence: number): string {
  const prefix = (fpoCode || "FPO").replace(/[^A-Za-z0-9-]/g, "").toUpperCase();
  return `${prefix}/M-${String(Math.max(1, Math.trunc(sequence))).padStart(6, "0")}`;
}

export function nextSequence(existing: Array<string | null | undefined>): number {
  const highest = existing.reduce((max, value) => {
    const match = /M-(\d+)$/.exec(value ?? "");
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return highest + 1;
}

/* ---------------------------------------------------------------- tags */

export function normalizeTagCode(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

export function validateTag(label: string): { ok: boolean; code?: string; reason?: string } {
  const code = normalizeTagCode(label);
  if (code.length < 2) return { ok: false, reason: "label_too_short" };
  return { ok: true, code };
}

/* ------------------------------------------------------------ segments */

export interface MemberRow {
  id: string;
  member_ref: string;
  membership_number?: string | null;
  display_name: string;
  status: MembershipState;
  member_type?: string | null;
  village_code?: string | null;
  village_cluster?: string | null;
  crops?: string[] | null;
  acreage?: number | null;
  farmer_user_id?: string | null;
  field_officer_user_id?: string | null;
  tagCodes?: string[];
  consentPurposes?: string[];
  verified?: boolean;
}

export interface SegmentFilters {
  search?: string | undefined;
  status?: MembershipState[] | undefined;
  memberTypes?: string[] | undefined;
  crops?: string[] | undefined;
  tagCodes?: string[] | undefined;
  villageClusters?: string[] | undefined;
  minAcreage?: number | undefined;
  maxAcreage?: number | undefined;
  linkedOnly?: boolean | undefined;
  consentedPurpose?: string | undefined;
}

/** Segment evaluation is pure and applied identically in UI and server exports. */
export function applyFilters(members: MemberRow[], filters: SegmentFilters): MemberRow[] {
  const term = (filters.search ?? "").trim().toLowerCase();
  return members.filter((m) => {
    if (term) {
      const haystack = [m.display_name, m.member_ref, m.membership_number, m.village_code]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(term)) return false;
    }
    if (filters.status?.length && !filters.status.includes(m.status)) return false;
    if (filters.memberTypes?.length && !filters.memberTypes.includes(m.member_type ?? "")) {
      return false;
    }
    if (filters.crops?.length) {
      const crops = m.crops ?? [];
      if (!filters.crops.some((c) => crops.includes(c))) return false;
    }
    if (filters.tagCodes?.length) {
      const tags = m.tagCodes ?? [];
      if (!filters.tagCodes.every((c) => tags.includes(c))) return false;
    }
    if (
      filters.villageClusters?.length &&
      !filters.villageClusters.includes(m.village_cluster ?? "")
    ) {
      return false;
    }
    if (filters.minAcreage != null && Number(m.acreage ?? 0) < filters.minAcreage) return false;
    if (filters.maxAcreage != null && Number(m.acreage ?? 0) > filters.maxAcreage) return false;
    if (filters.linkedOnly && !m.farmer_user_id) return false;
    if (
      filters.consentedPurpose &&
      !(m.consentPurposes ?? []).includes(filters.consentedPurpose)
    ) {
      return false;
    }
    return true;
  });
}

export interface RegistrySummary {
  total: number;
  active: number;
  invited: number;
  approvalPending: number;
  suspended: number;
  exited: number;
  linked: number;
  unlinked: number;
  consented: number;
  acreage: number;
}

export function registrySummary(members: MemberRow[]): RegistrySummary {
  const count = (s: MembershipState) => members.filter((m) => m.status === s).length;
  return {
    total: members.length,
    active: count("active"),
    invited: count("invited"),
    approvalPending: count("approval_pending"),
    suspended: count("suspended"),
    exited: count("exited"),
    linked: members.filter((m) => Boolean(m.farmer_user_id)).length,
    unlinked: members.filter((m) => !m.farmer_user_id).length,
    consented: members.filter((m) => (m.consentPurposes ?? []).length > 0).length,
    acreage: members.reduce((sum, m) => sum + Number(m.acreage ?? 0), 0),
  };
}

/* -------------------------------------------------- Farmer 360 consent */

export const FPO_PURPOSES = [
  "fpo_member_management",
  "fpo_scheme_assistance",
  "fpo_market_linkage",
] as const;

export type FpoPurpose = (typeof FPO_PURPOSES)[number];

export const FPO_PURPOSE_LABEL: Record<FpoPurpose, string> = {
  fpo_member_management: "Membership & farm planning",
  fpo_scheme_assistance: "Scheme assistance",
  fpo_market_linkage: "Market linkage",
};

export const FARMER_360_TABS = [
  "membership",
  "profile",
  "farms",
  "crops",
  "schemes",
  "market",
] as const;

export type Farmer360Tab = (typeof FARMER_360_TABS)[number];

/**
 * Tab visibility contract. `membership` is FPO-owned roster data and always
 * visible; every other tab requires the farmer's consent for that purpose.
 * Bank, insurance and partner data have no tab at all — they are never
 * surfaced to an FPO in this workspace.
 */
export const TAB_PURPOSE: Record<Farmer360Tab, FpoPurpose | null> = {
  membership: null,
  profile: "fpo_member_management",
  farms: "fpo_member_management",
  crops: "fpo_member_management",
  schemes: "fpo_scheme_assistance",
  market: "fpo_market_linkage",
};

export interface ConsentRow {
  purpose_code: string;
  revoked_at?: string | null;
  expires_at?: string | null;
}

export function activePurposes(consents: ConsentRow[], now = new Date()): string[] {
  return consents
    .filter((c) => !c.revoked_at)
    .filter((c) => !c.expires_at || new Date(c.expires_at) > now)
    .map((c) => c.purpose_code);
}

export function tabAllowed(tab: Farmer360Tab, purposes: string[]): boolean {
  const required = TAB_PURPOSE[tab];
  return required === null || purposes.includes(required);
}

export function visibleTabs(purposes: string[]): Farmer360Tab[] {
  return FARMER_360_TABS.filter((t) => tabAllowed(t, purposes));
}

/** Fields that must never cross the FPO boundary, whatever consent exists. */
export const NEVER_SHARED_FIELDS = [
  "bank_account_hash",
  "bank_account_last4",
  "bank_account_holder",
  "bank_ifsc",
  "bank_name",
  "bank_branch",
  "land_record_ref_hash",
  "date_of_birth",
] as const;

export function stripNeverShared<T extends Record<string, unknown>>(row: T): Partial<T> {
  const clone: Record<string, unknown> = { ...row };
  for (const field of NEVER_SHARED_FIELDS) delete clone[field];
  return clone as Partial<T>;
}

/* -------------------------------------------------------- authorization */

/** Field officers may add and edit members; only admins may tag, segment or exit. */
export function canAddMembers(roles: string[], isPlatformAdmin: boolean): boolean {
  return (
    isPlatformAdmin ||
    roles.includes("tenant_admin") ||
    roles.includes("field_agent") ||
    roles.includes("onboarding_officer")
  );
}

export function canClassifyMembers(roles: string[], isPlatformAdmin: boolean): boolean {
  return isPlatformAdmin || roles.includes("tenant_admin");
}

export function canRecordConsent(roles: string[], isPlatformAdmin: boolean): boolean {
  return isPlatformAdmin || roles.includes("tenant_admin");
}
