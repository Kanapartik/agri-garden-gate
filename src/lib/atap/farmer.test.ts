import { describe, expect, it } from "vitest";
import {
  baselineConsentActive,
  centroidOf,
  checkActorSubject,
  decideIdentityCheck,
  estimateAreaAcres,
  firstValueActions,
  funnelMetrics,
  identityBlocksProgress,
  isAssistedChannel,
  mayAcceptConsentFor,
  partnerConsentCards,
  partnerReadDecision,
  planFarmSync,
  validateBoundary,
  type LocalFarmDraft,
  type ServerFarmRecord,
} from "@/lib/atap/farmer";
import { mockJurisdictionIdentity } from "@/lib/adapters";

const SQUARE = [
  { lat: 17.386, lng: 78.485 },
  { lat: 17.386, lng: 78.489 },
  { lat: 17.383, lng: 78.489 },
  { lat: 17.383, lng: 78.485 },
];

function draft(overrides: Partial<LocalFarmDraft> = {}): LocalFarmDraft {
  return {
    clientDraftId: "draft_a",
    label: "North field",
    plotRef: "TG-1/1",
    boundary: SQUARE,
    clientUpdatedAt: "2026-08-18T10:00:00.000Z",
    channel: "self_service",
    ...overrides,
  };
}

describe("actor / subject separation", () => {
  it("requires actor to be the subject in self-service", () => {
    const res = checkActorSubject({ actorUserId: "a", subjectUserId: "b", channel: "self_service" });
    expect(res).toEqual({ ok: false, reason: "self_service_requires_actor_is_subject" });
  });

  it("allows an assisting actor to differ from the subject and flags it", () => {
    const res = checkActorSubject({
      actorUserId: "agent",
      subjectUserId: "farmer",
      channel: "field_agent_assisted",
    });
    expect(res).toEqual({ ok: true, actorIsSubject: false });
  });

  it("never lets an assisted actor consent on the farmer's behalf", () => {
    expect(mayAcceptConsentFor("agent", "farmer")).toBe(false);
    expect(mayAcceptConsentFor("farmer", "farmer")).toBe(true);
  });

  it("classifies assisted channels", () => {
    expect(isAssistedChannel("self_service")).toBe(false);
    expect(isAssistedChannel("fpo_assisted")).toBe(true);
  });
});

describe("parcel boundary", () => {
  it("rejects boundaries with too few points and out-of-range coordinates", () => {
    expect(validateBoundary([])).toEqual({ ok: false, reason: "boundary_empty" });
    expect(validateBoundary(SQUARE.slice(0, 2))).toEqual({
      ok: false,
      reason: "boundary_needs_three_points",
    });
    expect(validateBoundary([...SQUARE, { lat: 99, lng: 0 }])).toEqual({
      ok: false,
      reason: "boundary_point_out_of_range",
    });
  });

  it("accepts a valid polygon and derives centroid plus an area estimate", () => {
    expect(validateBoundary(SQUARE)).toEqual({ ok: true });
    expect(centroidOf(SQUARE)).toEqual({ lat: 17.3845, lng: 78.487 });
    const acres = estimateAreaAcres(SQUARE)!;
    expect(acres).toBeGreaterThan(20);
    expect(acres).toBeLessThan(50);
  });
});

describe("offline draft sync (acceptance: no duplicate farm record)", () => {
  it("inserts new drafts and dedupes repeated queue entries", () => {
    const actions = planFarmSync([draft(), draft()], []);
    expect(actions).toHaveLength(1);
    expect(actions[0]!.kind).toBe("insert");
  });

  it("replaying a queue after reconnect updates the same record, never duplicates", () => {
    const server: ServerFarmRecord[] = [
      { id: "farm_1", client_draft_id: "draft_a", plot_ref: "TG-1/1", client_updated_at: "2026-08-18T09:00:00.000Z" },
    ];
    const actions = planFarmSync([draft()], server);
    expect(actions[0]).toMatchObject({ kind: "update", recordId: "farm_1" });

    const replay = planFarmSync([draft()], [
      { ...server[0]!, client_updated_at: "2026-08-18T10:00:00.000Z" },
    ]);
    expect(replay[0]).toMatchObject({ kind: "skip", reason: "already_current" });
  });

  it("holds a different draft claiming an existing plot reference as a conflict", () => {
    const actions = planFarmSync([draft({ clientDraftId: "draft_b" })], [
      { id: "farm_1", client_draft_id: "draft_a", plot_ref: "TG-1/1", client_updated_at: null },
    ]);
    expect(actions[0]).toMatchObject({ kind: "conflict", reason: "plot_ref_already_registered" });
  });
});

describe("jurisdiction identity adapter with manual review fallback", () => {
  it("verifies a normal synthetic reference", async () => {
    const result = await mockJurisdictionIdentity.verify({
      jurisdictionCode: "IN-TG",
      referenceHash: "abc123",
    });
    expect(decideIdentityCheck(result, { duplicateExists: false })).toEqual({
      status: "verified",
      reasonCategory: null,
      requiresHumanReview: false,
    });
  });

  it("routes unverifiable references to human manual review, not rejection", async () => {
    const result = await mockJurisdictionIdentity.verify({
      jurisdictionCode: "IN-TG",
      referenceHash: "abc12f",
    });
    const decision = decideIdentityCheck(result, { duplicateExists: false });
    expect(decision.status).toBe("manual_review");
    expect(decision.requiresHumanReview).toBe(true);
    expect(identityBlocksProgress(decision.status)).toBe(false);
  });

  it("holds duplicate identities regardless of adapter success", () => {
    const decision = decideIdentityCheck(
      { status: "verified", evidenceRef: "x", synthetic: true },
      { duplicateExists: true },
    );
    expect(decision).toEqual({
      status: "duplicate_hold",
      reasonCategory: "duplicate_identity",
      requiresHumanReview: true,
    });
    expect(identityBlocksProgress(decision.status)).toBe(true);
  });
});

describe("consent separation and default-deny partner reads", () => {
  const consumers = [
    { id: "c_first", name: "AgriGhar Advisory", tier: "standard", status: "active", is_first_party: true },
    { id: "c_third", name: "Neutral Bank", tier: "standard", status: "active", is_first_party: false },
    { id: "c_off", name: "Suspended Co", tier: "standard", status: "suspended", is_first_party: false },
  ];
  const purposes = [
    {
      code: "credit_assessment",
      label: "Credit assessment",
      description: "Share baseline farm data for a loan you request.",
      requires_explicit_consent: true,
    },
    {
      code: "platform_account",
      label: "Platform account",
      description: "Baseline account handling.",
      requires_explicit_consent: false,
    },
  ];

  it("builds identical cards for first-party and third-party consumers and excludes baseline purposes", () => {
    const cards = partnerConsentCards(consumers, purposes, []);
    expect(cards).toHaveLength(2);
    expect(cards.map((c) => c.consumerId)).toEqual(["c_first", "c_third"]);
    expect(cards.every((c) => c.purposeCode === "credit_assessment")).toBe(true);
    expect(new Set(cards.map((c) => c.requiresExplicitConsent))).toEqual(new Set([true]));
  });

  it("baseline consent only counts for the current version and while not revoked", () => {
    expect(baselineConsentActive([{ policy_version: "v1", revoked_at: null }], "v1")).toBe(true);
    expect(baselineConsentActive([{ policy_version: "v1", revoked_at: "now" }], "v1")).toBe(false);
    expect(baselineConsentActive([{ policy_version: "v0", revoked_at: null }], "v1")).toBe(false);
  });

  it("denies a partner read without consent and allows it only with a live grant (both consumer types)", () => {
    for (const consumerId of ["c_first", "c_third"]) {
      const request = {
        purposeCode: "credit_assessment",
        consumerId,
        consumerTier: "standard" as const,
        consumerStatus: "active" as const,
      };
      expect(partnerReadDecision(request, []).decision).toBe("deny");
      const allowed = partnerReadDecision(request, [
        {
          purpose_code: "credit_assessment",
          consumer_id: consumerId,
          revoked_at: null,
          expires_at: null,
        },
      ]);
      expect(allowed.decision).toBe("allow");
    }
  });

  it("revoking a grant restores default-deny", () => {
    const decision = partnerReadDecision(
      {
        purposeCode: "credit_assessment",
        consumerId: "c_third",
        consumerTier: "premium",
        consumerStatus: "active",
      },
      [
        {
          purpose_code: "credit_assessment",
          consumer_id: "c_third",
          revoked_at: "2026-08-18T00:00:00.000Z",
          expires_at: null,
        },
      ],
    );
    expect(decision.decision).toBe("deny");
  });
});

describe("first-value launcher and funnel metrics", () => {
  it("keeps deactivated domains unavailable", () => {
    const actions = firstValueActions(
      [
        { key: "advisory.baseline", label: "Advisory", enabled: true, environments: ["development"] },
        { key: "marketplace.core", label: "Marketplace", enabled: false, environments: ["development"] },
      ],
      "development",
    );
    expect(actions.find((a) => a.key === "scheme_discovery")!.available).toBe(true);
    expect(actions.find((a) => a.key === "advisory_intro")!.available).toBe(true);
    expect(actions.find((a) => a.key === "marketplace_intro")!.available).toBe(false);
  });

  it("reports assisted vs self-service share", () => {
    const metrics = funnelMetrics([
      { event_code: "OnboardingStarted", channel: "self_service", subject_user_id: "f1" },
      { event_code: "OnboardingStarted", channel: "fpo_assisted", subject_user_id: "f2" },
      { event_code: "FarmDraftSynced", channel: "field_agent_assisted", subject_user_id: "f2" },
      { event_code: "ConsentGranted", channel: "self_service", subject_user_id: "f1" },
    ]);
    expect(metrics.total).toBe(4);
    expect(metrics.assisted).toBe(2);
    expect(metrics.selfService).toBe(2);
    expect(metrics.assistedShare).toBe(0.5);
    expect(metrics.byStage.find((s) => s.event_code === "OnboardingStarted")).toEqual({
      event_code: "OnboardingStarted",
      count: 2,
      subjects: 2,
    });
  });
});
