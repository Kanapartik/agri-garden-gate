import { describe, expect, it } from "vitest";
import {
  ADVISORY_DISCLAIMER,
  bucketCounts,
  buildCards,
  buildSchemeCards,
  canManageOpportunities,
  canReadOpportunities,
  canSetBucket,
  canTransitionTracking,
  daysUntil,
  explainEligibility,
  filterCards,
  geographyMatches,
  isDecisionBucket,
  isOpen,
  recommendationScore,
  trackingCounts,
  type OpportunityRow,
} from "@/lib/atap/fpoOpportunities";

const NOW = new Date("2026-06-01T00:00:00Z");

function opp(over: Partial<OpportunityRow> = {}): OpportunityRow {
  return {
    id: over.id ?? "o1",
    tenant_id: null,
    category: "scheme",
    title: "Storage support",
    provider_name: "State dept",
    benefit_summary: "Subsidy",
    eligibility_summary: "Registered FPO",
    required_documents: ["Registration certificate"],
    commodities: ["chilli"],
    state_code: "AP",
    district_code: "GUNTUR",
    geography_note: null,
    application_deadline: "2026-06-20",
    source_name: "synthetic_catalogue",
    source_url: null,
    last_verified_at: null,
    is_active: true,
    ...over,
  };
}

const FPO = { state_code: "AP", district_code: "GUNTUR", commodities: ["chilli", "paddy"] };

describe("opportunity geography and deadlines", () => {
  it("treats an unscoped opportunity as applying everywhere", () => {
    expect(geographyMatches(opp({ state_code: null, district_code: null }), FPO)).toBe(true);
  });

  it("excludes an opportunity scoped to a different district", () => {
    expect(geographyMatches(opp({ district_code: "KRISHNA" }), FPO)).toBe(false);
  });

  it("computes days left and open state", () => {
    expect(daysUntil("2026-06-20", NOW)).toBe(19);
    expect(isOpen(opp(), NOW)).toBe(true);
    expect(isOpen(opp({ application_deadline: "2026-05-01" }), NOW)).toBe(false);
    expect(isOpen(opp({ is_active: false }), NOW)).toBe(false);
  });
});

describe("recommendation scoring", () => {
  it("ranks district + commodity matches above unscoped ones", () => {
    const near = recommendationScore(opp(), FPO, NOW);
    const far = recommendationScore(
      opp({ state_code: null, district_code: null, commodities: [] }),
      FPO,
      NOW,
    );
    expect(near).toBeGreaterThan(far);
  });

  it("penalises closed opportunities", () => {
    expect(
      recommendationScore(opp({ application_deadline: "2026-01-01" }), FPO, NOW),
    ).toBeLessThan(recommendationScore(opp(), FPO, NOW));
  });
});

describe("cards, tracking and filtering", () => {
  const rows = [opp(), opp({ id: "o2", title: "Credit line", category: "credit", commodities: [] })];

  it("defaults untracked opportunities to new and sorts by score", () => {
    const cards = buildCards(rows, [{ opportunity_id: "o2", status: "applied" }], FPO, NOW);
    expect(cards[0]!.id).toBe("o1");
    expect(cards.find((c) => c.id === "o1")!.status).toBe("new");
    expect(cards.find((c) => c.id === "o2")!.status).toBe("applied");
    expect(trackingCounts(cards).applied).toBe(1);
  });

  it("filters by search, category, status and geography", () => {
    const cards = buildCards(rows, [], FPO, NOW);
    expect(filterCards(cards, { search: "credit" })).toHaveLength(1);
    expect(filterCards(cards, { categories: ["scheme"] })).toHaveLength(1);
    expect(filterCards(cards, { statuses: ["applied"] })).toHaveLength(0);
    expect(filterCards(cards, { onlyMyGeography: true })).toHaveLength(2);
  });

  it("guards tracking transitions", () => {
    expect(canTransitionTracking("new", "shortlisted")).toBe(true);
    expect(canTransitionTracking("applied", "new")).toBe(false);
  });
});

describe("advisory scheme eligibility", () => {
  const scheme = {
    id: "s1",
    code: "STORAGE",
    title: "Storage",
    summary: "Storage support",
    state_code: "AP",
    district_code: "GUNTUR",
    commodities: ["chilli"],
    min_active_members: 100,
    required_documents: ["registration_certificate"],
  };

  it("marks likely eligible only when nothing is missing", () => {
    const out = explainEligibility(scheme, {
      state_code: "AP",
      district_code: "GUNTUR",
      commodities: ["chilli"],
      active_members: 372,
      verification_state: "verified",
      document_types: ["registration_certificate"],
    });
    expect(out.bucket).toBe("likely_eligible");
    expect(out.advisory).toBe(ADVISORY_DISCLAIMER);
  });

  it("falls back to needs verification when facts are unrecorded", () => {
    const out = explainEligibility(scheme, {
      state_code: "AP",
      district_code: "GUNTUR",
      commodities: ["chilli"],
      verification_state: "pending",
      document_types: [],
    });
    expect(out.bucket).toBe("needs_verification");
    expect(out.missing.length).toBeGreaterThan(0);
  });

  it("marks not eligible on a hard geography or threshold mismatch", () => {
    const out = explainEligibility(scheme, {
      state_code: "TG",
      district_code: "KARIMNAGAR",
      commodities: ["paddy"],
      active_members: 10,
      verification_state: "verified",
      document_types: ["registration_certificate"],
    });
    expect(out.bucket).toBe("not_eligible");
  });

  it("prefers a stored assessment over a derived one", () => {
    const cards = buildSchemeCards(
      [scheme],
      [
        {
          scheme_id: "s1",
          bucket: "approved",
          reasons: ["Officer approved."],
          missing_information: [],
          advisory_note: null,
          source_name: "reviewer",
          assessed_at: "2026-05-01T00:00:00Z",
        },
      ],
      {},
    );
    expect(cards[0]!.bucket).toBe("approved");
    expect(bucketCounts(cards).approved).toBe(1);
  });

  it("keeps decision buckets out of FPO hands", () => {
    expect(isDecisionBucket("approved")).toBe(true);
    expect(canSetBucket("approved", false)).toBe(false);
    expect(canSetBucket("approved", true)).toBe(true);
    expect(canSetBucket("needs_verification", false)).toBe(true);
  });
});

describe("authorization", () => {
  it("separates reading from managing", () => {
    expect(canReadOpportunities(["viewer"], false)).toBe(true);
    expect(canReadOpportunities([], false)).toBe(false);
    expect(canManageOpportunities(["viewer"], false)).toBe(false);
    expect(canManageOpportunities(["tenant_admin"], false)).toBe(true);
    expect(canManageOpportunities([], true)).toBe(true);
  });
});
