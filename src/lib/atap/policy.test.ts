import { describe, expect, it } from "vitest";
import {
  evaluateDataAccess,
  requiresHumanDecision,
  resolveTierPolicy,
  tenantTypeGrantedRoles,
  type ConsentGrantLike,
} from "./policy";
import { SYNTHETIC_CONSUMERS, SYNTHETIC_TENANTS } from "./fixtures";

const SUBJECT_PURPOSE = "credit_assessment";
const firstParty = SYNTHETIC_CONSUMERS[0]!;
const thirdParty = SYNTHETIC_CONSUMERS[1]!;
const sandbox = SYNTHETIC_CONSUMERS[2]!;

function activeGrant(consumerId: string): ConsentGrantLike {
  return {
    purpose_code: SUBJECT_PURPOSE,
    consumer_id: consumerId,
    revoked_at: null,
    expires_at: null,
  };
}

describe("access-path neutrality", () => {
  it("resolves an identical policy for first-party and third-party consumers of the same tier", () => {
    expect(firstParty.tier).toBe(thirdParty.tier);
    expect(resolveTierPolicy(firstParty.tier)).toEqual(resolveTierPolicy(thirdParty.tier));
  });

  it("returns the same decision for both when consent state is equivalent", () => {
    const req = {
      purposeCode: SUBJECT_PURPOSE,
      consumerTier: "standard" as const,
      consumerStatus: "active" as const,
    };
    const a = evaluateDataAccess(
      { ...req, consumerId: firstParty.id },
      [activeGrant(firstParty.id)],
    );
    const b = evaluateDataAccess(
      { ...req, consumerId: thirdParty.id },
      [activeGrant(thirdParty.id)],
    );
    expect(a).toEqual(b);
    expect(a.decision).toBe("allow");
  });

  it("never grants consent bypass at any tier", () => {
    for (const tier of ["sandbox", "standard", "premium"] as const) {
      expect(resolveTierPolicy(tier).canBypassConsent).toBe(false);
    }
  });
});

describe("farmer data access is default-deny and purpose-scoped", () => {
  it("denies with no consent grant at all", () => {
    expect(
      evaluateDataAccess(
        {
          purposeCode: SUBJECT_PURPOSE,
          consumerId: thirdParty.id,
          consumerTier: "standard",
          consumerStatus: "active",
        },
        [],
      ),
    ).toEqual({ decision: "deny", reason: "no_consent_grant" });
  });

  it("denies when consent exists for a different purpose", () => {
    const grants = [{ ...activeGrant(thirdParty.id), purpose_code: "advisory" }];
    expect(
      evaluateDataAccess(
        {
          purposeCode: SUBJECT_PURPOSE,
          consumerId: thirdParty.id,
          consumerTier: "standard",
          consumerStatus: "active",
        },
        grants,
      ).decision,
    ).toBe("deny");
  });

  it("denies when consent exists for a different consumer", () => {
    expect(
      evaluateDataAccess(
        {
          purposeCode: SUBJECT_PURPOSE,
          consumerId: thirdParty.id,
          consumerTier: "standard",
          consumerStatus: "active",
        },
        [activeGrant(firstParty.id)],
      ).decision,
    ).toBe("deny");
  });

  it("denies revoked and expired consent", () => {
    expect(
      evaluateDataAccess(
        {
          purposeCode: SUBJECT_PURPOSE,
          consumerId: thirdParty.id,
          consumerTier: "standard",
          consumerStatus: "active",
        },
        [{ ...activeGrant(thirdParty.id), revoked_at: "2026-01-01T00:00:00Z" }],
      ).reason,
    ).toBe("consent_revoked");

    expect(
      evaluateDataAccess(
        {
          purposeCode: SUBJECT_PURPOSE,
          consumerId: thirdParty.id,
          consumerTier: "standard",
          consumerStatus: "active",
        },
        [{ ...activeGrant(thirdParty.id), expires_at: "2026-01-01T00:00:00Z" }],
        new Date("2026-06-01T00:00:00Z"),
      ).reason,
    ).toBe("consent_expired");
  });

  it("denies a suspended consumer even with active consent", () => {
    expect(
      evaluateDataAccess(
        {
          purposeCode: SUBJECT_PURPOSE,
          consumerId: thirdParty.id,
          consumerTier: "standard",
          consumerStatus: "suspended",
        },
        [activeGrant(thirdParty.id)],
      ).reason,
    ).toBe("consumer_not_active");
  });

  it("denies a purpose the tier may not request, even with consent recorded", () => {
    expect(
      evaluateDataAccess(
        {
          purposeCode: SUBJECT_PURPOSE,
          consumerId: sandbox.id,
          consumerTier: "sandbox",
          consumerStatus: "active",
        },
        [activeGrant(sandbox.id)],
      ).reason,
    ).toBe("purpose_not_requestable_at_tier");
  });
});

describe("tenancy grants no authority", () => {
  it("grants zero roles from any tenant type", () => {
    for (const tenant of SYNTHETIC_TENANTS) {
      expect(tenantTypeGrantedRoles(tenant.tenant_type)).toEqual([]);
    }
  });
});

describe("high-stakes decisions stay with a human role", () => {
  it("flags bank, insurance and government purposes", () => {
    expect(requiresHumanDecision("credit_assessment")).toBe(true);
    expect(requiresHumanDecision("crop_insurance")).toBe(true);
    expect(requiresHumanDecision("scheme_eligibility")).toBe(true);
    expect(requiresHumanDecision("advisory")).toBe(false);
  });
});
