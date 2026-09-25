import { describe, expect, it } from "vitest";
import {
  availableActions,
  canApproveVoucher,
  canCheckVoucher,
  canMakeVoucher,
  evaluateTransition,
  nextStage,
  settlementAllowed,
  summarizeBilling,
  type BillingEntryLike,
  type VoucherLike,
} from "@/lib/atap/fpoBilling";

const MAKER = "user-maker";
const CHECKER = "user-checker";
const APPROVER = "user-approver";

function voucher(over: Partial<VoucherLike> = {}): VoucherLike {
  return {
    id: "v1",
    workflow_stage: "draft",
    amount: 5000,
    amount_settled: 0,
    maker_user_id: MAKER,
    checker_user_id: null,
    approver_user_id: null,
    ...over,
  };
}

describe("fpo billing roles", () => {
  it("opens preparation to field staff but not verification or approval", () => {
    expect(canMakeVoucher(["field_agent"])).toBe(true);
    expect(canCheckVoucher(["field_agent"])).toBe(false);
    expect(canApproveVoucher(["field_agent"])).toBe(false);
    expect(canApproveVoucher(["auditor"])).toBe(false);
    expect(canCheckVoucher(["auditor"])).toBe(true);
    expect(canApproveVoucher(["tenant_admin"])).toBe(true);
    expect(canMakeVoucher(["viewer"])).toBe(false);
  });
});

describe("voucher transitions", () => {
  it("moves draft to verification and on to approval", () => {
    const submitted = evaluateTransition({
      voucher: voucher(),
      action: "submit",
      roles: ["field_agent"],
      actorUserId: MAKER,
    });
    expect(submitted.allowed).toBe(true);
    expect(submitted.stage).toBe("pending_check");

    const checked = evaluateTransition({
      voucher: voucher({ workflow_stage: "pending_check" }),
      action: "check",
      roles: ["auditor"],
      actorUserId: CHECKER,
    });
    expect(checked.allowed).toBe(true);
    expect(checked.stage).toBe("checked");

    const approved = evaluateTransition({
      voucher: voucher({ workflow_stage: "checked", checker_user_id: CHECKER }),
      action: "approve",
      roles: ["tenant_admin"],
      actorUserId: APPROVER,
    });
    expect(approved.allowed).toBe(true);
    expect(approved.stage).toBe("approved");
    expect(nextStage("approve")).toBe("approved");
  });

  it("refuses to skip verification", () => {
    const result = evaluateTransition({
      voucher: voucher({ workflow_stage: "pending_check" }),
      action: "approve",
      roles: ["tenant_admin"],
      actorUserId: APPROVER,
    });
    expect(result.allowed).toBe(false);
    expect(result.stage).toBe("pending_check");
  });

  it("enforces segregation of duties", () => {
    const selfCheck = evaluateTransition({
      voucher: voucher({ workflow_stage: "pending_check" }),
      action: "check",
      roles: ["tenant_admin"],
      actorUserId: MAKER,
    });
    expect(selfCheck.allowed).toBe(false);
    expect(selfCheck.reasons.join(" ")).toMatch(/cannot verify/i);

    const selfApprove = evaluateTransition({
      voucher: voucher({ workflow_stage: "checked", checker_user_id: CHECKER }),
      action: "approve",
      roles: ["tenant_admin"],
      actorUserId: CHECKER,
    });
    expect(selfApprove.allowed).toBe(false);

    const breakGlass = evaluateTransition({
      voucher: voucher({ workflow_stage: "checked", checker_user_id: CHECKER }),
      action: "approve",
      roles: ["platform_admin"],
      actorUserId: CHECKER,
    });
    expect(breakGlass.allowed).toBe(true);
  });

  it("requires remarks when returning a voucher", () => {
    const blank = evaluateTransition({
      voucher: voucher({ workflow_stage: "pending_check" }),
      action: "return",
      roles: ["tenant_admin"],
      actorUserId: CHECKER,
      reason: "   ",
    });
    expect(blank.allowed).toBe(false);

    const withRemarks = evaluateTransition({
      voucher: voucher({ workflow_stage: "pending_check" }),
      action: "return",
      roles: ["tenant_admin"],
      actorUserId: CHECKER,
      reason: "Transport bill missing",
    });
    expect(withRemarks.allowed).toBe(true);
    expect(withRemarks.stage).toBe("returned");
  });

  it("rejects a zero-amount voucher at every stage", () => {
    const result = evaluateTransition({
      voucher: voucher({ amount: 0 }),
      action: "submit",
      roles: ["tenant_admin"],
      actorUserId: MAKER,
    });
    expect(result.allowed).toBe(false);
  });
});

describe("settlement gate", () => {
  it("only allows settlement against an approved voucher", () => {
    expect(settlementAllowed("approved")).toBe(true);
    expect(settlementAllowed("checked")).toBe(false);
    expect(settlementAllowed("draft")).toBe(false);
    expect(settlementAllowed("returned")).toBe(false);
  });
});

describe("billing summary", () => {
  const rows: BillingEntryLike[] = [
    { workflow_stage: "draft", amount: 1000, amount_settled: 0, direction: "outflow" },
    { workflow_stage: "pending_check", amount: 2000, amount_settled: 0, direction: "inflow" },
    { workflow_stage: "checked", amount: 3000, amount_settled: 0, direction: "outflow" },
    { workflow_stage: "returned", amount: 500, amount_settled: 0, direction: "outflow" },
    { workflow_stage: "approved", amount: 4000, amount_settled: 1000, direction: "inflow" },
    { workflow_stage: "approved", amount: 1500, amount_settled: 1500, direction: "outflow" },
  ];

  it("counts each lane and the open workload", () => {
    const summary = summarizeBilling(rows);
    expect(summary.awaitingCheck).toBe(1);
    expect(summary.awaitingApproval).toBe(1);
    expect(summary.returned).toBe(1);
    expect(summary.openCount).toBe(4);
    expect(summary.openAmount).toBe(6500);
  });

  it("flags approved vouchers that are not fully settled", () => {
    const summary = summarizeBilling(rows);
    expect(summary.approvedUnsettled).toBe(1);
    expect(summary.approvedUnsettledAmount).toBe(3000);
  });
});

describe("available actions", () => {
  it("offers only the actions the signed-in user may take", () => {
    expect(
      availableActions(voucher({ workflow_stage: "pending_check" }), ["auditor"], CHECKER),
    ).toEqual(["check", "return"]);
    expect(availableActions(voucher({ workflow_stage: "approved" }), ["tenant_admin"], APPROVER))
      .toEqual([]);
    expect(availableActions(voucher(), ["field_agent"], MAKER)).toEqual(["submit"]);
  });
});
