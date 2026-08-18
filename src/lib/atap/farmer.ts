/**
 * B2 — Farmer & assisted onboarding: pure, IO-free domain logic.
 *
 * Nothing here talks to the network or the database, so every acceptance rule
 * (offline dedupe, assisted/self metrics, consent separation, manual-review
 * fallback) is directly unit-testable and reusable from server functions.
 */
import { evaluateDataAccess, type AccessDecision, type ConsentGrantLike } from "@/lib/atap/policy";
import type { AtapEnv, FlagDef } from "@/lib/atap/onboarding";
import { isFlagActive } from "@/lib/atap/onboarding";

/* ------------------------------------------------------------- channels */

export type OnboardingChannel =
  | "self_service"
  | "fpo_assisted"
  | "govt_camp_assisted"
  | "field_agent_assisted";

export const ASSISTED_CHANNELS: readonly OnboardingChannel[] = [
  "fpo_assisted",
  "govt_camp_assisted",
  "field_agent_assisted",
];

export const CHANNEL_LABEL: Record<OnboardingChannel, string> = {
  self_service: "Self-service",
  fpo_assisted: "FPO-assisted",
  govt_camp_assisted: "Government camp",
  field_agent_assisted: "Field agent",
};

export function isAssistedChannel(channel: OnboardingChannel): boolean {
  return ASSISTED_CHANNELS.includes(channel);
}

/** Assisted mode always separates the acting user from the data subject. */
export interface ActorSubject {
  actorUserId: string;
  subjectUserId: string;
  channel: OnboardingChannel;
}

export type ActorSubjectCheck = { ok: true; actorIsSubject: boolean } | { ok: false; reason: string };

export function checkActorSubject(input: ActorSubject): ActorSubjectCheck {
  const assisted = isAssistedChannel(input.channel);
  if (!assisted && input.actorUserId !== input.subjectUserId) {
    return { ok: false, reason: "self_service_requires_actor_is_subject" };
  }
  return { ok: true, actorIsSubject: input.actorUserId === input.subjectUserId };
}

/**
 * Consent is never delegated. An assisted actor may capture farm data, but the
 * data subject alone accepts or revokes consent.
 */
export function mayAcceptConsentFor(actorUserId: string, subjectUserId: string): boolean {
  return actorUserId === subjectUserId;
}

/* -------------------------------------------------------------- parcels */

export interface BoundaryPoint {
  lat: number;
  lng: number;
}

export type BoundaryCheck = { ok: true } | { ok: false; reason: string };

export function validateBoundary(points: readonly BoundaryPoint[]): BoundaryCheck {
  if (points.length === 0) return { ok: false, reason: "boundary_empty" };
  if (points.length < 3) return { ok: false, reason: "boundary_needs_three_points" };
  if (points.length > 64) return { ok: false, reason: "boundary_too_many_points" };
  for (const p of points) {
    if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) {
      return { ok: false, reason: "boundary_point_not_numeric" };
    }
    if (p.lat < -90 || p.lat > 90 || p.lng < -180 || p.lng > 180) {
      return { ok: false, reason: "boundary_point_out_of_range" };
    }
  }
  return { ok: true };
}

export function centroidOf(points: readonly BoundaryPoint[]): BoundaryPoint | null {
  if (points.length === 0) return null;
  const lat = points.reduce((s, p) => s + p.lat, 0) / points.length;
  const lng = points.reduce((s, p) => s + p.lng, 0) / points.length;
  return { lat: round6(lat), lng: round6(lng) };
}

function round6(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

const METRES_PER_DEGREE = 111_320;
const SQM_PER_ACRE = 4046.86;

/**
 * Local equirectangular shoelace estimate — good enough for a capture hint and
 * deliberately labelled as an estimate. Authoritative area stays with the GIS /
 * land-record adapter [VALIDATE provider].
 */
export function estimateAreaAcres(points: readonly BoundaryPoint[]): number | null {
  if (points.length < 3) return null;
  const lat0 = (points.reduce((s, p) => s + p.lat, 0) / points.length) * (Math.PI / 180);
  const xy = points.map((p) => ({
    x: p.lng * METRES_PER_DEGREE * Math.cos(lat0),
    y: p.lat * METRES_PER_DEGREE,
  }));
  let twiceArea = 0;
  for (let i = 0; i < xy.length; i += 1) {
    const a = xy[i]!;
    const b = xy[(i + 1) % xy.length]!;
    twiceArea += a.x * b.y - b.x * a.y;
  }
  const acres = Math.abs(twiceArea / 2) / SQM_PER_ACRE;
  return Math.round(acres * 100) / 100;
}

/* ------------------------------------------------- offline draft sync */

export interface LocalFarmDraft {
  clientDraftId: string;
  label: string;
  plotRef: string;
  villageCode?: string | null;
  primaryCrop?: string | null;
  areaAcres?: number | null;
  boundary: BoundaryPoint[];
  baselineProfile?: Record<string, string | number | null>;
  clientUpdatedAt: string;
  channel: OnboardingChannel;
}

export interface ServerFarmRecord {
  id: string;
  client_draft_id: string;
  plot_ref: string;
  client_updated_at: string | null;
}

export type SyncAction =
  | { kind: "insert"; draft: LocalFarmDraft }
  | { kind: "update"; draft: LocalFarmDraft; recordId: string }
  | { kind: "skip"; draft: LocalFarmDraft; recordId: string; reason: "already_current" }
  | { kind: "conflict"; draft: LocalFarmDraft; recordId: string; reason: string };

/**
 * Idempotent, offline-safe sync plan.
 *
 * `client_draft_id` is the idempotency key, so replaying a queue after a
 * reconnect updates the same farm record instead of creating a duplicate. A
 * different draft claiming a plot_ref that already belongs to another record is
 * a conflict for human resolution, never a silent overwrite.
 */
export function planFarmSync(
  drafts: readonly LocalFarmDraft[],
  serverRecords: readonly ServerFarmRecord[],
): SyncAction[] {
  const byDraftId = new Map(serverRecords.map((r) => [r.client_draft_id, r]));
  const byPlot = new Map(serverRecords.map((r) => [r.plot_ref, r]));
  const seen = new Set<string>();
  const actions: SyncAction[] = [];

  for (const draft of drafts) {
    if (seen.has(draft.clientDraftId)) continue; // duplicate queue entry
    seen.add(draft.clientDraftId);

    const existing = byDraftId.get(draft.clientDraftId);
    if (existing) {
      if (existing.client_updated_at && existing.client_updated_at >= draft.clientUpdatedAt) {
        actions.push({ kind: "skip", draft, recordId: existing.id, reason: "already_current" });
      } else {
        actions.push({ kind: "update", draft, recordId: existing.id });
      }
      continue;
    }

    const plotOwner = byPlot.get(draft.plotRef);
    if (plotOwner) {
      actions.push({
        kind: "conflict",
        draft,
        recordId: plotOwner.id,
        reason: "plot_ref_already_registered",
      });
      continue;
    }
    actions.push({ kind: "insert", draft });
  }

  return actions;
}

/* -------------------------------------------- identity verification */

export type IdentityCheckStatus =
  | "pending"
  | "verified"
  | "failed"
  | "manual_review"
  | "duplicate_hold";

export interface AdapterIdentityResult {
  status: "verified" | "unverified" | "pending";
  evidenceRef: string;
  synthetic: boolean;
  reasonCategory?: string;
}

export interface IdentityDecision {
  status: IdentityCheckStatus;
  reasonCategory: string | null;
  requiresHumanReview: boolean;
}

/**
 * Adapter output never activates anything on its own. Duplicates and
 * unverifiable subjects fall back to a human manual-review queue with no data
 * loss (PRD §8.1 failure path).
 */
export function decideIdentityCheck(
  result: AdapterIdentityResult,
  opts: { duplicateExists: boolean },
): IdentityDecision {
  if (opts.duplicateExists) {
    return { status: "duplicate_hold", reasonCategory: "duplicate_identity", requiresHumanReview: true };
  }
  if (result.status === "verified") {
    return { status: "verified", reasonCategory: null, requiresHumanReview: false };
  }
  if (result.status === "pending") {
    return {
      status: "manual_review",
      reasonCategory: result.reasonCategory ?? "provider_pending",
      requiresHumanReview: true,
    };
  }
  return {
    status: "manual_review",
    reasonCategory: result.reasonCategory ?? "verification_unavailable",
    requiresHumanReview: true,
  };
}

/** Statuses that let a farmer continue capturing without losing their work. */
export function identityBlocksProgress(status: IdentityCheckStatus): boolean {
  return status === "duplicate_hold" || status === "failed";
}

/* ------------------------------------------------------------- consent */

export interface BaselineConsentRow {
  policy_version: string;
  revoked_at: string | null;
}

export function baselineConsentActive(
  rows: readonly BaselineConsentRow[],
  currentVersion: string,
): boolean {
  return rows.some((r) => r.policy_version === currentVersion && r.revoked_at === null);
}

export interface PartnerConsentCard {
  consumerId: string;
  consumerName: string;
  purposeCode: string;
  purposeLabel: string;
  description: string;
  requiresExplicitConsent: boolean;
  granted: boolean;
  expiresAt: string | null;
}

export interface ConsumerLike {
  id: string;
  name: string;
  tier: string;
  status: string;
  is_first_party: boolean;
}

export interface PurposeLike {
  code: string;
  label: string;
  description: string;
  requires_explicit_consent: boolean;
}

/**
 * Partner cards are built ONLY from real, active consumers and purposes, kept
 * strictly separate from baseline platform consent (never bundled). First-party
 * and third-party consumers produce identical cards — no neutrality gap.
 */
export function partnerConsentCards(
  consumers: readonly ConsumerLike[],
  purposes: readonly PurposeLike[],
  grants: readonly ConsentGrantLike[],
): PartnerConsentCard[] {
  const cards: PartnerConsentCard[] = [];
  for (const consumer of consumers) {
    if (consumer.status !== "active") continue;
    for (const purpose of purposes) {
      if (!purpose.requires_explicit_consent) continue;
      const grant = grants.find(
        (g) => g.consumer_id === consumer.id && g.purpose_code === purpose.code && g.revoked_at === null,
      );
      cards.push({
        consumerId: consumer.id,
        consumerName: consumer.name,
        purposeCode: purpose.code,
        purposeLabel: purpose.label,
        description: purpose.description,
        requiresExplicitConsent: true,
        granted: Boolean(grant),
        expiresAt: grant?.expires_at ?? null,
      });
    }
  }
  return cards;
}

/** Partner read decision — same primitive used by the integration test. */
export function partnerReadDecision(
  request: Parameters<typeof evaluateDataAccess>[0],
  grants: readonly ConsentGrantLike[],
  now?: Date,
): AccessDecision {
  return evaluateDataAccess(request, grants, now);
}

/* ------------------------------------------------------ first value */

export interface FirstValueAction {
  key: string;
  label: string;
  description: string;
  flagKey: string | null;
  available: boolean;
}

const FIRST_VALUE_CATALOG: ReadonlyArray<Omit<FirstValueAction, "available">> = [
  {
    key: "scheme_discovery",
    label: "See schemes you may qualify for",
    description:
      "Discovery only. Eligibility and approval stay with the authorised government or partner role.",
    flagKey: null,
  },
  {
    key: "crop_cycle",
    label: "Set up this season's crop cycle",
    description: "Record what you are growing so future advisories and records line up.",
    flagKey: null,
  },
  {
    key: "advisory_intro",
    label: "Read your first plain-language advisory",
    description: "Human-curated context. No autonomous advisory is generated in this slice.",
    flagKey: "advisory.baseline_cards",
  },
  {
    key: "marketplace_intro",
    label: "Browse market activity",
    description: "Marketplace transactions stay deactivated until a later slice.",
    flagKey: "domain.marketplace",
  },
];

/** First-value options are configuration, not code branches. */
export function firstValueActions(flags: readonly FlagDef[], env: AtapEnv): FirstValueAction[] {
  return FIRST_VALUE_CATALOG.map((action) => ({
    ...action,
    available: isFlagActive(flags as FlagDef[], action.flagKey, env),
  }));
}

/* ----------------------------------------------------------- funnel */

export const FUNNEL_EVENTS = [
  "OnboardingStarted",
  "RoleSelected",
  "ContactVerified",
  "VerificationSubmitted",
  "VerificationPassed",
  "ManualReviewRequested",
  "FarmParcelCaptured",
  "FarmDraftSynced",
  "AgreementAccepted",
  "ConsentGranted",
  "ConsentRevoked",
  "OnboardingActivated",
  "FirstValueActionCompleted",
] as const;

export type FunnelEventCode = (typeof FUNNEL_EVENTS)[number];

export interface FunnelEventRow {
  event_code: string;
  channel: OnboardingChannel;
  subject_user_id: string;
}

export interface FunnelMetrics {
  total: number;
  byStage: Array<{ event_code: string; count: number; subjects: number }>;
  assisted: number;
  selfService: number;
  /** Share of events captured in an assisted channel, 0..1. */
  assistedShare: number;
  byChannel: Array<{ channel: OnboardingChannel; count: number }>;
}

export function funnelMetrics(rows: readonly FunnelEventRow[]): FunnelMetrics {
  const byStage = FUNNEL_EVENTS.map((code) => {
    const matching = rows.filter((r) => r.event_code === code);
    return {
      event_code: code as string,
      count: matching.length,
      subjects: new Set(matching.map((r) => r.subject_user_id)).size,
    };
  }).filter((s) => s.count > 0);

  const assisted = rows.filter((r) => isAssistedChannel(r.channel)).length;
  const channels = new Map<OnboardingChannel, number>();
  for (const row of rows) channels.set(row.channel, (channels.get(row.channel) ?? 0) + 1);

  return {
    total: rows.length,
    byStage,
    assisted,
    selfService: rows.length - assisted,
    assistedShare: rows.length === 0 ? 0 : Math.round((assisted / rows.length) * 100) / 100,
    byChannel: [...channels.entries()].map(([channel, count]) => ({ channel, count })),
  };
}
