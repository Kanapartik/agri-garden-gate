/**
 * FPO billing & collections — maker / checker / approver pure domain logic.
 *
 * This module holds no I/O. It encodes a simple internal-control chain over the
 * existing FPO transaction register: a *maker* prepares a collection or expense
 * voucher, a *checker* verifies it against evidence, and an *approver* sanctions
 * it. Only a sanctioned voucher may be settled, so money movement can never be
 * recorded by a single person acting alone. Nothing here decides anything on the
 * FPO's behalf: every transition is an explicit human act, and every authority
 * decision below is re-checked server-side in `fpoBilling.functions.ts`.
 */
import type { AppRole } from "@/lib/atap/policy";
import type { LedgerCategory, LedgerDirection } from "@/lib/atap/fpoAccounts";

/* ---------------------------------------------------------------- stages */

export const VOUCHER_STAGES = [
  "draft",
  "pending_check",
  "checked",
  "approved",
  "returned",
] as const;
export type VoucherStage = (typeof VOUCHER_STAGES)[number];

export const VOUCHER_STAGE_LABEL: Record<VoucherStage, string> = {
  draft: "Draft",
  pending_check: "Awaiting verification",
  checked: "Verified, awaiting approval",
  approved: "Approved",
  returned: "Returned for correction",
};

export const VOUCHER_STAGE_HINT: Record<VoucherStage, string> = {
  draft: "The maker is still preparing this voucher.",
  pending_check: "A checker must verify the amount and evidence.",
  checked: "An approver must sanction this voucher before settlement.",
  approved: "Sanctioned. Settlement and bank reconciliation can proceed.",
  returned: "Returned to the maker with remarks; correct and resubmit.",
};

/** Stages that still owe somebody an action. */
export const OPEN_VOUCHER_STAGES: VoucherStage[] = [
  "draft",
  "pending_check",
  "checked",
  "returned",
];

export function isVoucherStage(value: string): value is VoucherStage {
  return (VOUCHER_STAGES as readonly string[]).includes(value);
}

/* --------------------------------------------------------------- actions */

export const VOUCHER_ACTIONS = ["submit", "check", "approve", "return", "revise"] as const;
export type VoucherAction = (typeof VOUCHER_ACTIONS)[number];

export const VOUCHER_ACTION_LABEL: Record<VoucherAction, string> = {
  submit: "Send for verification",
  check: "Verify",
  approve: "Approve",
  return: "Return for correction",
  revise: "Reopen as draft",
};

const TRANSITIONS: Record<VoucherAction, { from: VoucherStage[]; to: VoucherStage }> = {
  submit: { from: ["draft", "returned"], to: "pending_check" },
  check: { from: ["pending_check"], to: "checked" },
  approve: { from: ["checked"], to: "approved" },
  return: { from: ["pending_check", "checked"], to: "returned" },
  revise: { from: ["returned", "pending_check"], to: "draft" },
};

export function nextStage(action: VoucherAction): VoucherStage {
  return TRANSITIONS[action].to;
}

/* ----------------------------------------------------------------- roles */

/** Preparing a voucher is an operational act, open to FPO staff. */
export function canMakeVoucher(roles: AppRole[]): boolean {
  return (
    roles.includes("platform_admin") ||
    roles.includes("tenant_admin") ||
    roles.includes("onboarding_officer") ||
    roles.includes("field_agent")
  );
}

/** Verification is a control act: finance or audit authority only. */
export function canCheckVoucher(roles: AppRole[]): boolean {
  return (
    roles.includes("platform_admin") ||
    roles.includes("tenant_admin") ||
    roles.includes("auditor")
  );
}

/** Sanctioning money movement stays with FPO administration. */
export function canApproveVoucher(roles: AppRole[]): boolean {
  return roles.includes("platform_admin") || roles.includes("tenant_admin");
}

export function canActOnVoucher(action: VoucherAction, roles: AppRole[]): boolean {
  switch (action) {
    case "submit":
    case "revise":
      return canMakeVoucher(roles);
    case "check":
    case "return":
      return canCheckVoucher(roles);
    case "approve":
      return canApproveVoucher(roles);
  }
}

/* ------------------------------------------------------------ transition */

export interface VoucherLike {
  id?: string;
  workflow_stage: VoucherStage;
  amount: number;
  amount_settled: number;
  maker_user_id?: string | null;
  checker_user_id?: string | null;
  approver_user_id?: string | null;
}

export interface TransitionRequest {
  voucher: VoucherLike;
  action: VoucherAction;
  roles: AppRole[];
  actorUserId: string;
  /**
   * Segregation of duties. A platform administrator may act as break-glass
   * support in a sandbox or single-officer FPO; that act is still audited.
   */
  allowSelfAct?: boolean;
  reason?: string | null;
}

export interface TransitionResult {
  allowed: boolean;
  reasons: string[];
  stage: VoucherStage;
}

export function evaluateTransition(req: TransitionRequest): TransitionResult {
  const { voucher, action, roles, actorUserId } = req;
  const target = TRANSITIONS[action];
  const reasons: string[] = [];

  if (!target.from.includes(voucher.workflow_stage)) {
    reasons.push(
      `A voucher that is "${VOUCHER_STAGE_LABEL[voucher.workflow_stage]}" cannot be ${VOUCHER_ACTION_LABEL[action].toLowerCase()}.`,
    );
  }
  if (!canActOnVoucher(action, roles)) {
    reasons.push(`Your role is not permitted to ${VOUCHER_ACTION_LABEL[action].toLowerCase()}.`);
  }
  if (action === "return" && !req.reason?.trim()) {
    reasons.push("Returning a voucher requires remarks for the maker.");
  }
  if (!(voucher.amount > 0)) {
    reasons.push("The voucher amount must be greater than zero.");
  }

  const selfAllowed = req.allowSelfAct === true || roles.includes("platform_admin");
  if (!selfAllowed) {
    if (action === "check" && voucher.maker_user_id === actorUserId) {
      reasons.push("The person who prepared a voucher cannot verify it.");
    }
    if (action === "approve") {
      if (voucher.maker_user_id === actorUserId) {
        reasons.push("The person who prepared a voucher cannot approve it.");
      }
      if (voucher.checker_user_id === actorUserId) {
        reasons.push("The person who verified a voucher cannot also approve it.");
      }
    }
  }

  return {
    allowed: reasons.length === 0,
    reasons,
    stage: reasons.length === 0 ? target.to : voucher.workflow_stage,
  };
}

/** Money only moves against a sanctioned voucher. */
export function settlementAllowed(stage: VoucherStage): boolean {
  return stage === "approved";
}

/* ------------------------------------------------------------- summaries */

export interface BillingQueueLane {
  stage: VoucherStage;
  label: string;
  hint: string;
  count: number;
  amount: number;
}

export interface BillingSummary {
  lanes: BillingQueueLane[];
  /** Vouchers waiting on somebody, across all open stages. */
  openCount: number;
  openAmount: number;
  awaitingCheck: number;
  awaitingApproval: number;
  returned: number;
  approvedUnsettled: number;
  approvedUnsettledAmount: number;
}

export interface BillingEntryLike extends VoucherLike {
  direction: LedgerDirection;
  category?: LedgerCategory;
}

export function summarizeBilling(entries: BillingEntryLike[]): BillingSummary {
  const lanes: BillingQueueLane[] = VOUCHER_STAGES.map((stage) => ({
    stage,
    label: VOUCHER_STAGE_LABEL[stage],
    hint: VOUCHER_STAGE_HINT[stage],
    count: 0,
    amount: 0,
  }));
  const laneByStage = new Map(lanes.map((l) => [l.stage, l]));

  let approvedUnsettled = 0;
  let approvedUnsettledAmount = 0;

  for (const e of entries) {
    const lane = laneByStage.get(e.workflow_stage);
    if (lane) {
      lane.count += 1;
      lane.amount = round2(lane.amount + e.amount);
    }
    if (e.workflow_stage === "approved" && e.amount_settled + 0.005 < e.amount) {
      approvedUnsettled += 1;
      approvedUnsettledAmount = round2(approvedUnsettledAmount + (e.amount - e.amount_settled));
    }
  }

  const open = lanes.filter((l) => OPEN_VOUCHER_STAGES.includes(l.stage));

  return {
    lanes,
    openCount: open.reduce((s, l) => s + l.count, 0),
    openAmount: round2(open.reduce((s, l) => s + l.amount, 0)),
    awaitingCheck: laneByStage.get("pending_check")?.count ?? 0,
    awaitingApproval: laneByStage.get("checked")?.count ?? 0,
    returned: laneByStage.get("returned")?.count ?? 0,
    approvedUnsettled,
    approvedUnsettledAmount,
  };
}

/** Actions the signed-in user can take right now, for button rendering. */
export function availableActions(
  voucher: VoucherLike,
  roles: AppRole[],
  actorUserId: string,
): VoucherAction[] {
  return VOUCHER_ACTIONS.filter(
    (action) =>
      evaluateTransition({
        voucher,
        action,
        roles,
        actorUserId,
        // `return` always needs remarks typed in the form, so ignore that gate here.
        reason: action === "return" ? "placeholder" : null,
      }).allowed,
  );
}

export const BILLING_DISCLAIMER =
  "Maker, checker and approver steps are internal controls recorded by named people. " +
  "The platform never approves, verifies or releases a payment on its own, and an approved " +
  "voucher is still not a statutory book entry until reconciled against the bank statement.";

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
