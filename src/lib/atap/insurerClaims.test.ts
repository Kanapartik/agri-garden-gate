import { describe, expect, it } from "vitest";
import {
  blocksApproval,
  canMoveClaimStage,
  claimAgeDays,
  claimsByStage,
  claimStates,
  evidenceState,
  filterClaims,
  isOverdue,
  nextStages,
  requiresDecisionNote,
  summarizeClaims,
  type ClaimDocRow,
  type ClaimRow,
} from "@/lib/atap/insurerClaims";

const NOW = new Date("2026-03-10T00:00:00Z");

function doc(over: Partial<ClaimDocRow> = {}): ClaimDocRow {
  return {
    id: over.id ?? "d1",
    claim_id: "c1",
    doc_type: "loss_report",
    label: "Loss report",
    required: true,
    status: "pending",
    ...over,
  } as ClaimDocRow;
}

function claim(over: Partial<ClaimRow> = {}): ClaimRow {
  return {
    id: "c1",
    insurer_tenant_id: "t1",
    claim_reference: "CLM-0001",
    registration_number: "REG1",
    fpo_name: "Guntur Chilli Growers",
    state_name: "Andhra Pradesh",
    district: "Guntur",
    crop: "Chilli",
    season: "Rabi 2025-26",
    peril: "drought",
    stage: "reported",
    affected_members: 40,
    reported_acres: 120,
    claimed_amount_inr: 500000,
    approved_amount_inr: null,
    reported_at: "2026-03-01T00:00:00Z",
    response_due_at: "2026-03-15T00:00:00Z",
    documents: [],
    events: [],
    ...over,
  } as ClaimRow;
}

describe("claim stage model", () => {
  it("allows only configured forward transitions", () => {
    expect(canMoveClaimStage("reported", "documents_pending")).toBe(true);
    expect(canMoveClaimStage("reported", "settled")).toBe(false);
  });

  it("has no next stage from terminal stages", () => {
    expect(nextStages("settled")).toHaveLength(0);
    expect(nextStages("rejected")).toHaveLength(0);
  });

  it("requires a decision note for high-stakes outcomes", () => {
    expect(requiresDecisionNote("approved")).toBe(true);
    expect(requiresDecisionNote("rejected")).toBe(true);
    expect(requiresDecisionNote("survey_assigned")).toBe(false);
  });
});

describe("evidence gating", () => {
  it("counts required vs verified evidence", () => {
    const st = evidenceState([
      doc({ id: "a", status: "verified" }),
      doc({ id: "b", status: "pending" }),
      doc({ id: "c", required: false, status: "pending" }),
    ]);
    expect(st.required).toBe(2);
    expect(st.verified).toBe(1);
    expect(st.complete).toBe(false);
  });

  it("blocks approval until required evidence is verified", () => {
    const docs = [doc({ id: "a", status: "pending" })];
    expect(blocksApproval("approved", docs)).toBe(true);
    expect(blocksApproval("approved", [doc({ id: "a", status: "verified" })])).toBe(false);
    expect(blocksApproval("survey_assigned", docs)).toBe(false);
  });
});

describe("ageing and SLA", () => {
  it("computes age in days from reported date", () => {
    expect(claimAgeDays(claim(), NOW)).toBe(9);
  });

  it("flags overdue only for open claims past the response window", () => {
    expect(isOverdue(claim({ response_due_at: "2026-03-05T00:00:00Z" }), NOW)).toBe(true);
    expect(isOverdue(claim(), NOW)).toBe(false);
    expect(
      isOverdue(claim({ stage: "settled", response_due_at: "2026-03-05T00:00:00Z" }), NOW),
    ).toBe(false);
  });
});

describe("workspace roll-ups", () => {
  const rows = [
    claim({ id: "1", stage: "reported" }),
    claim({ id: "2", stage: "approved", approved_amount_inr: 300000 }),
    claim({ id: "3", stage: "rejected", district: "Krishna", state_name: "Andhra Pradesh" }),
    claim({ id: "4", stage: "settled", approved_amount_inr: 200000, state_name: "Telangana" }),
  ];

  it("summarizes claimed, approved and open counts", () => {
    const s = summarizeClaims(rows, NOW);
    expect(s.total).toBe(4);
    expect(s.claimedInr).toBe(2000000);
    expect(s.approvedInr).toBe(500000);
    expect(s.open).toBe(2);
  });

  it("buckets claims by stage", () => {
    const buckets = claimsByStage(rows);
    const reported = buckets.find((b) => b.stage === "reported");
    expect(reported?.count).toBe(1);
  });

  it("filters by state, stage and search", () => {
    expect(filterClaims(rows, { state: "Telangana" }, NOW)).toHaveLength(1);
    expect(filterClaims(rows, { stage: "approved" }, NOW)).toHaveLength(1);
    expect(filterClaims(rows, { search: "krishna" }, NOW)).toHaveLength(1);
  });

  it("lists distinct states", () => {
    expect(claimStates(rows)).toEqual(["Andhra Pradesh", "Telangana"]);
  });
});
