import { describe, expect, it } from "vitest";
import {
  batchesByState,
  blocksPolicyIssuance,
  canMoveEnrolmentState,
  canMovePolicyStatus,
  coverageWindowIsValid,
  enrolmentIsOpen,
  filterPolicies,
  grossPremium,
  nextEnrolmentStates,
  nextPolicyStatuses,
  policyIsInForce,
  reconcileBatch,
  requiresEnrolmentDecisionNote,
  requiresPolicyDecisionNote,
  sharesAreValid,
  splitPremium,
  summarizePortfolio,
  type EnrolmentBatchRow,
  type PolicyRow,
} from "@/lib/atap/insurerPolicies";

const NOW = new Date("2026-07-01T00:00:00Z");

function policy(over: Partial<PolicyRow> = {}): PolicyRow {
  return {
    id: "p1",
    insurer_tenant_id: "t1",
    policy_reference: "POL-0001",
    registration_number: "REG1",
    fpo_name: "Guntur Chilli Growers",
    state_name: "Andhra Pradesh",
    district: "Guntur",
    scheme_code: "PMFBY",
    scheme_name: "Pradhan Mantri Fasal Bima Yojana",
    crop: "Chilli",
    season: "Kharif 2026",
    status: "pending_enrolment",
    coverage_start: "2026-06-15",
    coverage_end: "2026-11-30",
    enrolment_cutoff: "2026-07-31",
    sum_insured_per_acre_inr: 40000,
    actuarial_rate_pct: 10,
    farmer_share_pct: 2,
    centre_share_pct: 49,
    state_share_pct: 49,
    insured_acres: 500,
    insured_members: 120,
    gross_premium_inr: 2000000,
    ...over,
  };
}

function batch(over: Partial<EnrolmentBatchRow> = {}): EnrolmentBatchRow {
  return {
    id: "b1",
    insurer_tenant_id: "t1",
    policy_id: "p1",
    batch_reference: "ENR-0001",
    registration_number: "REG1",
    fpo_name: "Guntur Chilli Growers",
    state_name: "Andhra Pradesh",
    district: "Guntur",
    crop: "Chilli",
    season: "Kharif 2026",
    state: "verified",
    member_count: 120,
    acres: 500,
    premium_due_inr: 2000000,
    farmer_premium_inr: 40000,
    subsidy_premium_inr: 1960000,
    submitted_at: "2026-06-20T00:00:00Z",
    verified_at: "2026-06-25T00:00:00Z",
    remittances: [],
    ...over,
  };
}

describe("premium arithmetic", () => {
  it("computes gross premium from acres, sum insured and rate", () => {
    expect(grossPremium(500, 40000, 10)).toBe(2000000);
    expect(grossPremium(0, 40000, 10)).toBe(0);
    expect(grossPremium(500, 40000, 0)).toBe(0);
  });

  it("splits premium into farmer, centre and state shares totalling gross", () => {
    const s = splitPremium(2000000, {
      farmer_share_pct: 2,
      centre_share_pct: 49,
      state_share_pct: 49,
    });
    expect(s.farmerInr).toBe(40000);
    expect(s.farmerInr + s.centreInr + s.stateInr).toBe(2000000);
  });

  it("rejects share sets that do not total 100%", () => {
    expect(sharesAreValid({ farmer_share_pct: 2, centre_share_pct: 49, state_share_pct: 49 })).toBe(
      true,
    );
    expect(sharesAreValid({ farmer_share_pct: 5, centre_share_pct: 49, state_share_pct: 49 })).toBe(
      false,
    );
  });
});

describe("coverage and enrolment windows", () => {
  it("requires start before end", () => {
    expect(coverageWindowIsValid(policy())).toBe(true);
    expect(
      coverageWindowIsValid(policy({ coverage_start: "2026-12-01", coverage_end: "2026-06-01" })),
    ).toBe(false);
    expect(coverageWindowIsValid(policy({ coverage_end: null }))).toBe(false);
  });

  it("closes enrolment after the cutoff", () => {
    expect(enrolmentIsOpen(policy(), NOW)).toBe(true);
    expect(enrolmentIsOpen(policy({ enrolment_cutoff: "2026-06-01" }), NOW)).toBe(false);
  });

  it("treats only issued/active policies inside the window as in force", () => {
    expect(policyIsInForce(policy({ status: "active" }), NOW)).toBe(true);
    expect(policyIsInForce(policy({ status: "draft" }), NOW)).toBe(false);
    expect(
      policyIsInForce(policy({ status: "active" }), new Date("2026-12-15T00:00:00Z")),
    ).toBe(false);
  });
});

describe("lifecycle transitions", () => {
  it("allows only configured policy transitions", () => {
    expect(canMovePolicyStatus("pending_enrolment", "issued")).toBe(true);
    expect(canMovePolicyStatus("draft", "active")).toBe(false);
    expect(nextPolicyStatuses("expired")).toHaveLength(0);
  });

  it("allows only configured enrolment transitions", () => {
    expect(canMoveEnrolmentState("submitted", "under_verification")).toBe(true);
    expect(canMoveEnrolmentState("submitted", "policy_linked")).toBe(false);
    expect(nextEnrolmentStates("rejected")).toHaveLength(0);
  });

  it("requires decision notes on high-stakes outcomes", () => {
    expect(requiresPolicyDecisionNote("issued")).toBe(true);
    expect(requiresPolicyDecisionNote("active")).toBe(false);
    expect(requiresEnrolmentDecisionNote("verified")).toBe(true);
    expect(requiresEnrolmentDecisionNote("under_verification")).toBe(false);
  });

  it("blocks issuance without valid arithmetic and a verified batch", () => {
    expect(blocksPolicyIssuance(policy(), [batch()])).toBeNull();
    expect(blocksPolicyIssuance(policy(), [batch({ state: "submitted" })])).toMatch(/verified/i);
    expect(blocksPolicyIssuance(policy({ farmer_share_pct: 10 }), [batch()])).toMatch(/100%/);
    expect(blocksPolicyIssuance(policy({ gross_premium_inr: 0 }), [batch()])).toMatch(/premium/i);
  });
});

describe("premium reconciliation", () => {
  it("matches when receipts equal the farmer share", () => {
    const r = reconcileBatch(
      batch({
        remittances: [
          {
            id: "r1",
            batch_id: "b1",
            remittance_reference: "RMT-1",
            amount_inr: 40000,
            method: "neft",
            state: "received",
            received_at: null,
            reconciled_at: null,
          },
        ],
      }),
    );
    expect(r.status).toBe("matched");
    expect(r.varianceInr).toBe(0);
  });

  it("flags short and excess receipts and ignores expected-only rows", () => {
    const short = reconcileBatch(
      batch({
        remittances: [
          {
            id: "r1",
            batch_id: "b1",
            remittance_reference: "RMT-1",
            amount_inr: 30000,
            method: "neft",
            state: "received",
            received_at: null,
            reconciled_at: null,
          },
        ],
      }),
    );
    expect(short.status).toBe("short");
    expect(short.varianceInr).toBe(-10000);

    const awaiting = reconcileBatch(
      batch({
        remittances: [
          {
            id: "r2",
            batch_id: "b1",
            remittance_reference: "RMT-2",
            amount_inr: 40000,
            method: "neft",
            state: "expected",
            received_at: null,
            reconciled_at: null,
          },
        ],
      }),
    );
    expect(awaiting.status).toBe("awaiting");
  });
});

describe("roll-ups and filters", () => {
  const policies = [
    policy({ id: "p1", status: "active" }),
    policy({ id: "p2", status: "draft", state_name: "Telangana", fpo_name: "Warangal Growers" }),
  ];
  const batches = [batch({ id: "b1" }), batch({ id: "b2", state: "submitted" })];

  it("summarizes portfolio totals and in-force count", () => {
    const s = summarizePortfolio(policies, batches, NOW);
    expect(s.policies).toBe(2);
    expect(s.activePolicies).toBe(1);
    expect(s.insuredAcres).toBe(1000);
    expect(s.farmerPremiumInr).toBe(80000);
  });

  it("buckets batches by state, dropping empty states", () => {
    const buckets = batchesByState(batches);
    expect(buckets.map((b) => b.state)).toEqual(["submitted", "verified"]);
  });

  it("filters policies by state, status and search", () => {
    expect(filterPolicies(policies, { state: "Telangana" })).toHaveLength(1);
    expect(filterPolicies(policies, { status: "active" })).toHaveLength(1);
    expect(filterPolicies(policies, { search: "warangal" })).toHaveLength(1);
  });
});
