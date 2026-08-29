import { describe, expect, it } from "vitest";
import {
  bindCoverForFarmer,
  buildSyncPlan,
  claimAdvisories,
  coverSnapshotRow,
  cropYearFor,
  pickPolicyForFarmer,
  policyCoverState,
  policyMatchesFarmer,
  seasonCodeFor,
  type BindablePolicy,
  type FarmerCoverSubject,
} from "@/lib/atap/insuranceBridge";
import { resolvePolicyBindingSource } from "@/lib/adapters/insuranceBinding";

const policy = (over: Partial<BindablePolicy> = {}): BindablePolicy => ({
  id: "p1",
  policy_reference: "POL-1",
  scheme_code: "PMFBY",
  scheme_name: "PMFBY Kharif",
  state_name: "Andhra Pradesh",
  district: "Guntur",
  crop: "Chilli",
  season: "Kharif 2025",
  status: "active",
  coverage_start: "2025-06-01",
  coverage_end: "2025-11-30",
  sum_insured_per_acre_inr: 40000,
  actuarial_rate_pct: 10,
  farmer_share_pct: 5,
  ...over,
});

const subject = (over: Partial<FarmerCoverSubject> = {}): FarmerCoverSubject => ({
  farmerUserId: "f1",
  district: "Guntur",
  crops: ["Chilli"],
  acres: 4,
  ...over,
});

describe("season parsing", () => {
  it("normalises season labels and crop years", () => {
    expect(seasonCodeFor("Kharif 2025")).toBe("kharif");
    expect(seasonCodeFor("RABI 2024-25")).toBe("rabi");
    expect(cropYearFor("Kharif 2025", 2020)).toBe(2025);
    expect(cropYearFor("Kharif", 2026)).toBe(2026);
  });
});

describe("policy matching", () => {
  it("matches on district and crop", () => {
    expect(policyMatchesFarmer(policy(), subject())).toBe(true);
    expect(policyMatchesFarmer(policy(), subject({ district: "Krishna" }))).toBe(false);
    expect(policyMatchesFarmer(policy(), subject({ crops: ["Paddy"] }))).toBe(false);
  });

  it("treats a crop-agnostic, state-wide policy as matching", () => {
    const p = policy({ district: null, crop: null });
    expect(policyMatchesFarmer(p, subject({ district: "Krishna", crops: [] }))).toBe(true);
  });

  it("default-denies a farmer with no roster crops against a crop-specific policy", () => {
    expect(policyMatchesFarmer(policy(), subject({ crops: [] }))).toBe(false);
  });

  it("prefers the strongest binding, then latest cover", () => {
    const chosen = pickPolicyForFarmer(
      [
        policy({ id: "draft", status: "draft" }),
        policy({ id: "pending", status: "pending_enrolment" }),
        policy({ id: "active-old", status: "active", coverage_start: "2023-06-01" }),
        policy({ id: "active-new", status: "active", coverage_start: "2025-06-01" }),
      ],
      subject(),
    );
    expect(chosen?.id).toBe("active-new");
  });

  it("maps status to a binding state", () => {
    expect(policyCoverState("active")).toBe("bound");
    expect(policyCoverState("pending_enrolment")).toBe("pending");
    expect(policyCoverState("cancelled")).toBe("none");
  });
});

describe("cover binding arithmetic", () => {
  it("computes per-acre and total figures", () => {
    const cover = bindCoverForFarmer(policy(), subject());
    expect(cover.sumInsuredPerAcre).toBe(40000);
    expect(cover.indicativePremiumPerAcre).toBe(4000);
    expect(cover.farmerSharePerAcre).toBe(2000);
    expect(cover.estimatedSumInsured).toBe(160000);
    expect(cover.estimatedFarmerShare).toBe(8000);
    expect(cover.coverState).toBe("bound");
  });

  it("never charges more than the notified farmer share cap", () => {
    const cover = bindCoverForFarmer(policy(), subject(), { notifiedFarmerSharePct: 2 });
    expect(cover.farmerSharePerAcre).toBe(800);
    expect(cover.notifiedFarmerSharePct).toBe(2);
  });

  it("keeps the lower of policy share and cap", () => {
    const cover = bindCoverForFarmer(policy({ farmer_share_pct: 1.5 }), subject(), {
      notifiedFarmerSharePct: 2,
    });
    expect(cover.farmerSharePerAcre).toBe(600);
  });

  it("writes a non-synthetic snapshot row attributed to the policy", () => {
    const row = coverSnapshotRow(bindCoverForFarmer(policy(), subject()), "f1");
    expect(row["source"]).toBe("insurer_policy");
    expect(row["is_synthetic"]).toBe(false);
    expect(row["cover_state"]).toBe("covered");
    expect(row["contact_label"]).toContain("POL-1");
  });

  it("marks a pending policy as eligible, not covered", () => {
    const row = coverSnapshotRow(
      bindCoverForFarmer(policy({ status: "pending_enrolment" }), subject()),
      "f1",
    );
    expect(row["cover_state"]).toBe("eligible");
  });
});

describe("sync plan", () => {
  it("binds eligible members and reports every skip", () => {
    const plan = buildSyncPlan(
      [
        subject({ farmerUserId: "a" }),
        subject({ farmerUserId: "b", acres: 0 }),
        subject({ farmerUserId: "c", crops: ["Paddy"] }),
      ],
      [policy()],
      { notifiedFarmerSharePct: 2 },
    );
    expect(plan.entries.map((e) => e.farmerUserId)).toEqual(["a"]);
    expect(plan.skippedNoAcreage).toBe(1);
    expect(plan.skippedNoPolicy).toBe(1);
    expect(plan.eligibleMembers).toBe(3);
  });

  it("binds nothing when only cancelled policies exist", () => {
    const plan = buildSyncPlan([subject()], [policy({ status: "cancelled" })]);
    expect(plan.entries).toHaveLength(0);
    expect(plan.skippedNoPolicy).toBe(1);
  });
});

describe("claim advisory", () => {
  const rows = [
    {
      id: "c1",
      claim_reference: "CLM-1",
      registration_number: "REG1",
      fpo_name: "Guntur Chilli Growers",
      district: "Guntur",
      crop: "Chilli",
      season: "Kharif 2025",
      peril: "excess_rainfall",
      stage: "survey_assigned",
      reported_at: "2025-08-01T00:00:00Z",
      decided_at: null,
    },
    {
      id: "c2",
      claim_reference: "CLM-2",
      registration_number: "REG1",
      fpo_name: "Guntur Chilli Growers",
      district: "Krishna",
      crop: "Paddy",
      season: "Kharif 2025",
      peril: "drought",
      stage: "settled",
      reported_at: "2025-09-01T00:00:00Z",
      decided_at: "2025-10-01T00:00:00Z",
    },
  ];

  it("labels stages in farmer-facing language, newest first", () => {
    const list = claimAdvisories(rows, { district: "Guntur", crops: ["Chilli"] });
    expect(list[0]?.id).toBe("c2");
    expect(list.find((c) => c.id === "c1")?.stageLabel).toBe("Field survey assigned");
    expect(list.find((c) => c.id === "c1")?.relevantToFarmer).toBe(true);
    expect(list.find((c) => c.id === "c2")?.relevantToFarmer).toBe(false);
  });

  it("carries no insurer-internal fields", () => {
    const [first] = claimAdvisories(rows, { district: "Guntur", crops: ["Chilli"] });
    expect(Object.keys(first ?? {})).not.toContain("internal_notes");
    expect(Object.keys(first ?? {})).not.toContain("surveyor_name");
  });
});

describe("binding source resolution", () => {
  const fallback = { district: "Guntur", crop: "Chilli", season: "Kharif 2025" };

  it("prefers real insurer policies and labels provenance", () => {
    const res = resolvePolicyBindingSource({ policies: [policy()], claims: [], fallback });
    expect(res.provenance.synthetic).toBe(false);
    expect(res.provenance.label).toBe("Notified insurer policy");
    expect(res.source.policies).toHaveLength(1);
  });

  it("falls back to a declared synthetic policy when nothing is linked", () => {
    const res = resolvePolicyBindingSource({ policies: [], claims: [], fallback });
    expect(res.provenance.synthetic).toBe(true);
    expect(res.source.policies[0]?.policy_reference).toBe("SYNTHETIC-COVER");
  });

  it("forbids the synthetic fallback in official_only mode", () => {
    const res = resolvePolicyBindingSource({
      policies: [],
      claims: [],
      fallback,
      mode: "official_only",
    });
    expect(res.source.policies).toHaveLength(0);
    expect(res.provenance.synthetic).toBe(false);
  });

  it("ignores cancelled policies when deciding the source", () => {
    const res = resolvePolicyBindingSource({
      policies: [policy({ status: "cancelled" })],
      claims: [],
      fallback,
    });
    expect(res.provenance.synthetic).toBe(true);
  });
});
