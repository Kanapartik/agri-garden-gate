import { describe, expect, it } from "vitest";
import {
  canCertifyGrant,
  canManageAccounts,
  canReconcile,
  canTransitionUc,
  canViewAccounts,
  categoryTotals,
  derivePaymentState,
  grantPosition,
  isOverdue,
  memberLedger,
  outstandingAmount,
  summarizeLedger,
  utilizationCheck,
  utilizationTotal,
  type LedgerEntryLike,
} from "@/lib/atap/fpoAccounts";

const NOW = new Date("2026-08-27T00:00:00Z");

function entry(over: Partial<LedgerEntryLike> = {}): LedgerEntryLike {
  return {
    direction: "inflow",
    category: "produce_sale",
    amount: 1000,
    amount_settled: 0,
    payment_state: "pending",
    ...over,
  };
}

describe("fpo accounts roles", () => {
  it("limits finance writes to FPO admins", () => {
    expect(canManageAccounts(["tenant_admin"])).toBe(true);
    expect(canManageAccounts(["platform_admin"])).toBe(true);
    expect(canManageAccounts(["field_agent"])).toBe(false);
    expect(canReconcile(["field_agent"])).toBe(false);
    expect(canCertifyGrant(["viewer"])).toBe(false);
  });

  it("allows other FPO staff read-only visibility", () => {
    expect(canViewAccounts(["field_agent"])).toBe(true);
    expect(canViewAccounts(["auditor"])).toBe(true);
    expect(canViewAccounts(["market_operator"])).toBe(false);
  });
});

describe("settlement arithmetic", () => {
  it("computes outstanding and ignores waived entries", () => {
    expect(outstandingAmount(entry({ amount: 1000, amount_settled: 400 }))).toBe(600);
    expect(
      outstandingAmount(entry({ amount: 1000, amount_settled: 0, payment_state: "waived" })),
    ).toBe(0);
  });

  it("derives payment state from amounts", () => {
    expect(derivePaymentState(1000, 0, "pending")).toBe("pending");
    expect(derivePaymentState(1000, 400, "pending")).toBe("partial");
    expect(derivePaymentState(1000, 1000, "partial")).toBe("paid");
    expect(derivePaymentState(1000, 0, "waived")).toBe("waived");
  });

  it("flags overdue only when money is still open", () => {
    expect(isOverdue(entry({ due_date: "2026-08-01" }), NOW)).toBe(true);
    expect(
      isOverdue(entry({ due_date: "2026-08-01", amount_settled: 1000, payment_state: "paid" }), NOW),
    ).toBe(false);
    expect(isOverdue(entry({ due_date: "2026-09-30" }), NOW)).toBe(false);
  });
});

describe("ledger summaries", () => {
  const entries: LedgerEntryLike[] = [
    entry({ amount: 1000, amount_settled: 1000, payment_state: "paid", is_reconciled: true }),
    entry({ amount: 500, amount_settled: 0, due_date: "2026-08-01" }),
    entry({
      direction: "outflow",
      category: "procurement",
      amount: 800,
      amount_settled: 300,
      payment_state: "partial",
      due_date: "2026-08-10",
    }),
    entry({ direction: "outflow", category: "expense", amount: 200, amount_settled: 0 }),
  ];

  it("splits receivables, payables and reconciliation", () => {
    const s = summarizeLedger(entries, NOW);
    expect(s.inflow).toBe(1000);
    expect(s.outflow).toBe(300);
    expect(s.net).toBe(700);
    expect(s.receivable).toBe(500);
    expect(s.payable).toBe(700);
    expect(s.overdueReceivable).toBe(500);
    expect(s.overduePayable).toBe(500);
    expect(s.unreconciled).toBe(1);
    expect(s.unreconciledAmount).toBe(300);
    expect(s.entries).toBe(4);
  });

  it("reports only categories that have entries", () => {
    const totals = categoryTotals(entries);
    expect(totals.map((t) => t.category).sort()).toEqual(["expense", "procurement", "produce_sale"]);
    const produce = totals.find((t) => t.category === "produce_sale");
    expect(produce?.inflow).toBe(1000);
    expect(produce?.outstanding).toBe(500);
  });

  it("keeps member dues and member payables separate", () => {
    const rows = memberLedger([
      entry({ member_id: "m1", direction: "outflow", amount: 900, amount_settled: 900, payment_state: "paid" }),
      entry({ member_id: "m1", direction: "inflow", amount: 400, amount_settled: 100, payment_state: "partial" }),
      entry({ member_id: "m2", direction: "outflow", amount: 700, amount_settled: 0 }),
      entry({ amount: 100 }),
    ]);
    expect(rows).toHaveLength(2);
    const m1 = rows.find((r) => r.memberId === "m1")!;
    expect(m1.credited).toBe(900);
    expect(m1.debited).toBe(100);
    expect(m1.outstandingFromMember).toBe(300);
    expect(m1.outstandingToMember).toBe(0);
    expect(m1.net).toBe(800);
    const m2 = rows.find((r) => r.memberId === "m2")!;
    expect(m2.outstandingToMember).toBe(700);
  });
});

describe("grant funds", () => {
  it("derives balance, pending release and utilization percent", () => {
    const pos = grantPosition(
      {
        sanctioned_amount: 1500000,
        received_amount: 750000,
        utilized_amount: 512000,
        uc_state: "pending",
        reporting_deadline: "2026-09-10",
      },
      NOW,
    );
    expect(pos.balance).toBe(238000);
    expect(pos.awaitingRelease).toBe(750000);
    expect(pos.utilizationPercent).toBe(68);
    expect(pos.actions.some((a) => a.includes("pending"))).toBe(true);
    expect(pos.actions.some((a) => a.includes("2026-09-10"))).toBe(true);
  });

  it("surfaces over-utilization instead of hiding it", () => {
    const pos = grantPosition(
      { sanctioned_amount: 100, received_amount: 100, utilized_amount: 140, uc_state: "not_due" },
      NOW,
    );
    expect(pos.actions.some((a) => a.includes("exceeds"))).toBe(true);
  });

  it("restricts utilization certificate transitions", () => {
    expect(canTransitionUc("pending", "submitted")).toBe(true);
    expect(canTransitionUc("submitted", "accepted")).toBe(true);
    expect(canTransitionUc("not_due", "accepted")).toBe(false);
    expect(canTransitionUc("accepted", "rejected")).toBe(false);
  });

  it("blocks utilization beyond funds received", () => {
    const grant = {
      sanctioned_amount: 1000,
      received_amount: 600,
      utilized_amount: 500,
      uc_state: "pending" as const,
    };
    expect(utilizationCheck(grant, 50).allowed).toBe(true);
    const bad = utilizationCheck(grant, 200);
    expect(bad.allowed).toBe(false);
    expect(bad.reasons[0]).toContain("exceed");
    expect(utilizationCheck(grant, 0).allowed).toBe(false);
  });

  it("totals utilization rows", () => {
    expect(utilizationTotal([{ amount: 320000 }, { amount: 192000 }])).toBe(512000);
    expect(utilizationTotal([])).toBe(0);
  });
});
