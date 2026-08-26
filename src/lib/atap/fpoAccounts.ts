/**
 * FPO Management & Operations workspace — Phase 7 pure domain logic.
 *
 * Accounts here are deliberately a transaction and settlement register, not a
 * general ledger or ERP: every figure is derived by explicit arithmetic from
 * recorded entries so an FPO can explain any number to its members and to a
 * funder. No balance, receivable or grant status is inferred by a model, and
 * no payment or utilization is auto-approved — release and certification stay
 * with the authorized human role. This module performs no I/O; every authority
 * decision is re-checked server-side in `fpoAccounts.functions.ts`.
 */
import type { AppRole } from "@/lib/atap/policy";

/* ------------------------------------------------------------ vocabulary */

export const LEDGER_DIRECTIONS = ["inflow", "outflow"] as const;
export type LedgerDirection = (typeof LEDGER_DIRECTIONS)[number];

export const LEDGER_CATEGORIES = [
  "procurement",
  "produce_sale",
  "membership_fee",
  "scheme_grant",
  "expense",
  "loan",
  "other",
] as const;
export type LedgerCategory = (typeof LEDGER_CATEGORIES)[number];

export const LEDGER_CATEGORY_LABEL: Record<LedgerCategory, string> = {
  procurement: "Procurement",
  produce_sale: "Produce sales",
  membership_fee: "Member collections",
  scheme_grant: "Scheme / grant funds",
  expense: "Expenses",
  loan: "Loan / credit",
  other: "Other",
};

export const PAYMENT_STATES = ["pending", "partial", "paid", "waived"] as const;
export type PaymentState = (typeof PAYMENT_STATES)[number];

export const PAYMENT_STATE_LABEL: Record<PaymentState, string> = {
  pending: "Pending",
  partial: "Partially settled",
  paid: "Settled",
  waived: "Waived",
};

export const UC_STATES = ["not_due", "pending", "submitted", "accepted", "rejected"] as const;
export type UcState = (typeof UC_STATES)[number];

export const UC_STATE_LABEL: Record<UcState, string> = {
  not_due: "Not due",
  pending: "Pending with FPO",
  submitted: "Submitted to funder",
  accepted: "Accepted by funder",
  rejected: "Returned by funder",
};

export const ACCOUNTS_DISCLAIMER =
  "This is a transaction and settlement register for FPO operations, not a statutory book of accounts. " +
  "Figures are computed from the entries recorded here and must be reconciled against bank statements before " +
  "any statutory filing, audit submission or utilization certificate.";

/* ----------------------------------------------------------------- roles */

/** Finance authority is narrower than the rest of the workspace. */
export function canManageAccounts(roles: AppRole[]): boolean {
  return roles.includes("platform_admin") || roles.includes("tenant_admin");
}

/** Read-only visibility for other FPO staff who need operational context. */
export function canViewAccounts(roles: AppRole[]): boolean {
  return (
    canManageAccounts(roles) ||
    roles.includes("auditor") ||
    roles.includes("viewer") ||
    roles.includes("onboarding_officer") ||
    roles.includes("field_agent")
  );
}

/** Marking a bank line reconciled is a finance act, never an operational one. */
export function canReconcile(roles: AppRole[]): boolean {
  return canManageAccounts(roles);
}

/** Certifying grant utilization to a funder stays with FPO finance authority. */
export function canCertifyGrant(roles: AppRole[]): boolean {
  return canManageAccounts(roles);
}

/* ------------------------------------------------------------ settlement */

export interface LedgerEntryLike {
  id?: string;
  direction: LedgerDirection;
  category: LedgerCategory;
  amount: number;
  amount_settled: number;
  payment_state: PaymentState;
  due_date?: string | null;
  is_reconciled?: boolean;
  member_id?: string | null;
}

export function outstandingAmount(entry: LedgerEntryLike): number {
  if (entry.payment_state === "waived") return 0;
  return Math.max(0, round2(entry.amount - entry.amount_settled));
}

/** Payment state is derived from amounts so it can never contradict the money. */
export function derivePaymentState(
  amount: number,
  settled: number,
  current: PaymentState,
): PaymentState {
  if (current === "waived") return "waived";
  if (settled <= 0) return "pending";
  if (settled + 0.005 >= amount) return "paid";
  return "partial";
}

export function isOverdue(entry: LedgerEntryLike, now = new Date()): boolean {
  if (!entry.due_date) return false;
  if (outstandingAmount(entry) <= 0) return false;
  return new Date(entry.due_date).getTime() < startOfDay(now).getTime();
}

/* ------------------------------------------------------------- summaries */

export interface AccountsSummary {
  inflow: number;
  outflow: number;
  net: number;
  receivable: number;
  payable: number;
  overdueReceivable: number;
  overduePayable: number;
  unreconciled: number;
  unreconciledAmount: number;
  entries: number;
}

export function summarizeLedger(
  entries: LedgerEntryLike[],
  now = new Date(),
): AccountsSummary {
  let inflow = 0;
  let outflow = 0;
  let receivable = 0;
  let payable = 0;
  let overdueReceivable = 0;
  let overduePayable = 0;
  let unreconciled = 0;
  let unreconciledAmount = 0;

  for (const e of entries) {
    const settled = e.payment_state === "waived" ? 0 : e.amount_settled;
    const open = outstandingAmount(e);
    const overdue = isOverdue(e, now);

    if (e.direction === "inflow") {
      inflow += settled;
      receivable += open;
      if (overdue) overdueReceivable += open;
    } else {
      outflow += settled;
      payable += open;
      if (overdue) overduePayable += open;
    }

    if (!e.is_reconciled && settled > 0) {
      unreconciled += 1;
      unreconciledAmount += settled;
    }
  }

  return {
    inflow: round2(inflow),
    outflow: round2(outflow),
    net: round2(inflow - outflow),
    receivable: round2(receivable),
    payable: round2(payable),
    overdueReceivable: round2(overdueReceivable),
    overduePayable: round2(overduePayable),
    unreconciled,
    unreconciledAmount: round2(unreconciledAmount),
    entries: entries.length,
  };
}

export interface CategoryTotal {
  category: LedgerCategory;
  label: string;
  inflow: number;
  outflow: number;
  outstanding: number;
  entries: number;
}

export function categoryTotals(entries: LedgerEntryLike[]): CategoryTotal[] {
  const map = new Map<LedgerCategory, CategoryTotal>();
  for (const category of LEDGER_CATEGORIES) {
    map.set(category, {
      category,
      label: LEDGER_CATEGORY_LABEL[category],
      inflow: 0,
      outflow: 0,
      outstanding: 0,
      entries: 0,
    });
  }
  for (const e of entries) {
    const row = map.get(e.category);
    if (!row) continue;
    const settled = e.payment_state === "waived" ? 0 : e.amount_settled;
    if (e.direction === "inflow") row.inflow = round2(row.inflow + settled);
    else row.outflow = round2(row.outflow + settled);
    row.outstanding = round2(row.outstanding + outstandingAmount(e));
    row.entries += 1;
  }
  return [...map.values()].filter((r) => r.entries > 0);
}

export interface MemberLedgerRow {
  memberId: string;
  entries: number;
  credited: number;
  debited: number;
  outstandingToMember: number;
  outstandingFromMember: number;
  net: number;
}

/**
 * Per-member position. `inflow` entries are money the member owes the FPO
 * (collections); `outflow` entries are money the FPO owes the member
 * (produce settlements), so the two open figures are reported separately
 * rather than netted into one ambiguous number.
 */
export function memberLedger(entries: LedgerEntryLike[]): MemberLedgerRow[] {
  const map = new Map<string, MemberLedgerRow>();
  for (const e of entries) {
    if (!e.member_id) continue;
    const row =
      map.get(e.member_id) ??
      ({
        memberId: e.member_id,
        entries: 0,
        credited: 0,
        debited: 0,
        outstandingToMember: 0,
        outstandingFromMember: 0,
        net: 0,
      } satisfies MemberLedgerRow);
    const settled = e.payment_state === "waived" ? 0 : e.amount_settled;
    const open = outstandingAmount(e);
    if (e.direction === "outflow") {
      row.credited = round2(row.credited + settled);
      row.outstandingToMember = round2(row.outstandingToMember + open);
    } else {
      row.debited = round2(row.debited + settled);
      row.outstandingFromMember = round2(row.outstandingFromMember + open);
    }
    row.entries += 1;
    row.net = round2(row.credited - row.debited);
    map.set(e.member_id, row);
  }
  return [...map.values()].sort((a, b) => b.entries - a.entries);
}

/* ---------------------------------------------------------------- grants */

export interface GrantLike {
  id?: string;
  sanctioned_amount: number;
  received_amount: number;
  utilized_amount: number;
  next_installment_due?: string | null;
  reporting_deadline?: string | null;
  uc_state: UcState;
}

export interface GrantPosition {
  sanctioned: number;
  received: number;
  utilized: number;
  /** Money in hand: received but not yet spent. */
  balance: number;
  /** Sanctioned but not yet released by the funder. */
  awaitingRelease: number;
  utilizationPercent: number;
  ucState: UcState;
  ucLabel: string;
  /** Plain-language work the FPO owes; never an automated decision. */
  actions: string[];
}

export function grantPosition(grant: GrantLike, now = new Date()): GrantPosition {
  const balance = round2(Math.max(0, grant.received_amount - grant.utilized_amount));
  const awaitingRelease = round2(
    Math.max(0, grant.sanctioned_amount - grant.received_amount),
  );
  const utilizationPercent =
    grant.received_amount > 0
      ? Math.min(100, Math.round((grant.utilized_amount / grant.received_amount) * 100))
      : 0;

  const actions: string[] = [];
  if (grant.uc_state === "pending") {
    actions.push("Utilization certificate is pending with the FPO.");
  }
  if (grant.uc_state === "rejected") {
    actions.push("The funder returned the utilization certificate; corrections are required.");
  }
  if (grant.reporting_deadline && withinDays(grant.reporting_deadline, 30, now)) {
    actions.push(`Reporting deadline falls on ${grant.reporting_deadline}.`);
  }
  if (grant.next_installment_due && withinDays(grant.next_installment_due, 45, now)) {
    actions.push(`Next installment is expected around ${grant.next_installment_due}.`);
  }
  if (grant.utilized_amount > grant.received_amount) {
    actions.push("Recorded utilization exceeds funds received; verify the entries.");
  }

  return {
    sanctioned: round2(grant.sanctioned_amount),
    received: round2(grant.received_amount),
    utilized: round2(grant.utilized_amount),
    balance,
    awaitingRelease,
    utilizationPercent,
    ucState: grant.uc_state,
    ucLabel: UC_STATE_LABEL[grant.uc_state],
    actions,
  };
}

const UC_TRANSITIONS: Record<UcState, UcState[]> = {
  not_due: ["pending"],
  pending: ["submitted", "not_due"],
  submitted: ["accepted", "rejected"],
  accepted: ["pending"],
  rejected: ["pending", "submitted"],
};

export function canTransitionUc(from: UcState, to: UcState): boolean {
  return UC_TRANSITIONS[from].includes(to);
}

/** Only the funder side may accept or reject; the FPO can prepare and submit. */
export const FUNDER_UC_STATES: UcState[] = ["accepted", "rejected"];

export interface UtilizationLike {
  amount: number;
}

export function utilizationTotal(rows: UtilizationLike[]): number {
  return round2(rows.reduce((sum, r) => sum + r.amount, 0));
}

/**
 * Guard against certifying more than was received. Returned as reasons rather
 * than a silent clamp so the finance user sees exactly what is wrong.
 */
export function utilizationCheck(grant: GrantLike, addedAmount: number): {
  allowed: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];
  if (!(addedAmount > 0)) reasons.push("Utilization amount must be greater than zero.");
  if (grant.received_amount <= 0) {
    reasons.push("No grant funds have been received against this sanction yet.");
  }
  if (grant.utilized_amount + addedAmount > grant.received_amount + 0.005) {
    reasons.push(
      `Recording ₹${addedAmount.toLocaleString("en-IN")} would exceed the ₹${grant.received_amount.toLocaleString("en-IN")} received.`,
    );
  }
  return { allowed: reasons.length === 0, reasons };
}

/* ----------------------------------------------------------- helpers */

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function withinDays(date: string, days: number, now: Date): boolean {
  const target = new Date(date).getTime();
  const from = startOfDay(now).getTime();
  return target >= from - 365 * 86400000 && target <= from + days * 86400000;
}
