/**
 * FPO Management & Operations workspace — Phase 7 server functions.
 *
 * Finance reads are tenant-scoped and default-deny; writes require FPO admin
 * authority. Payment state is recomputed from recorded amounts, grant
 * utilization can never exceed funds received, and funder-side outcomes on a
 * utilization certificate (accepted / rejected) stay with a scheme reviewer or
 * platform admin. Every write is audited.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  ACCOUNTS_DISCLAIMER,
  canManageAccounts,
  canReconcile,
  canTransitionUc,
  canViewAccounts,
  categoryTotals,
  derivePaymentState,
  FUNDER_UC_STATES,
  grantPosition,
  isOverdue,
  memberLedger,
  outstandingAmount,
  summarizeLedger,
  utilizationCheck,
  utilizationTotal,
  type AccountsSummary,
  type CategoryTotal,
  type GrantPosition,
  type LedgerCategory,
  type LedgerDirection,
  type PaymentState,
  type UcState,
} from "@/lib/atap/fpoAccounts";
import type { AppRole } from "@/lib/atap/policy";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type AuthedClient = SupabaseClient<Database>;

export interface LedgerRow {
  id: string;
  entry_date: string;
  direction: LedgerDirection;
  category: LedgerCategory;
  description: string;
  party_name: string | null;
  member_id: string | null;
  member_name: string | null;
  amount: number;
  amount_settled: number;
  outstanding: number;
  payment_state: PaymentState;
  due_date: string | null;
  overdue: boolean;
  reference: string | null;
  bank_reference: string | null;
  is_reconciled: boolean;
  note: string | null;
  updated_at: string;
}

export interface GrantRow {
  id: string;
  title: string;
  funder_name: string;
  sanctioned_amount: number;
  received_amount: number;
  utilized_amount: number;
  sanctioned_on: string | null;
  next_installment_due: string | null;
  next_installment_amount: number | null;
  uc_state: UcState;
  reporting_deadline: string | null;
  note: string | null;
  position: GrantPosition;
}

export interface UtilizationRow {
  id: string;
  grant_id: string;
  purpose: string;
  amount: number;
  spent_on: string;
  voucher_reference: string | null;
  note: string | null;
}

export interface MemberLedgerView {
  memberId: string;
  memberName: string;
  entries: number;
  credited: number;
  debited: number;
  outstandingToMember: number;
  outstandingFromMember: number;
  net: number;
}

export interface AccountsBoard {
  tenantId: string;
  roles: AppRole[];
  canManage: boolean;
  canReconcile: boolean;
  summary: AccountsSummary;
  categories: CategoryTotal[];
  entries: LedgerRow[];
  members: MemberLedgerView[];
  grants: GrantRow[];
  utilizations: UtilizationRow[];
  utilizationTotal: number;
  memberOptions: Array<{ id: string; display_name: string }>;
  disclaimer: string;
}

const LEDGER_COLUMNS =
  "id, entry_date, direction, category, description, party_name, member_id, amount, amount_settled, payment_state, due_date, reference, bank_reference, is_reconciled, note, updated_at";
const GRANT_COLUMNS =
  "id, title, funder_name, sanctioned_amount, received_amount, utilized_amount, sanctioned_on, next_installment_due, next_installment_amount, uc_state, reporting_deadline, note";

/* -------------------------------------------------------------- internals */

async function tenantScope(supabase: AuthedClient, userId: string, tenantId: string) {
  const { resolveDistrictActor } = await import("@/lib/atap/district.server");
  const actor = await resolveDistrictActor(supabase, userId);
  const permitted = actor.isPlatformAdmin || actor.isAuditor || actor.tenantIds.includes(tenantId);
  if (!permitted) throw new Error("You do not have access to this organization");
  const roles = actor.tenantRoles
    .filter((r: { tenant_id: string | null }) => r.tenant_id === tenantId)
    .map((r: { role: AppRole }) => r.role) as AppRole[];
  const effective: AppRole[] = actor.isPlatformAdmin ? [...roles, "platform_admin"] : roles;
  if (actor.isAuditor && !effective.includes("auditor")) effective.push("auditor");
  return { actor, roles: effective };
}

async function logAudit(
  supabase: AuthedClient,
  input: {
    userId: string;
    tenantId: string;
    action: string;
    subjectType: string;
    subjectId: string;
    metadata?: Record<string, unknown>;
  },
) {
  const { audit } = await import("@/lib/atap/admin.server");
  await audit(supabase, {
    actor_user_id: input.userId,
    tenant_id: input.tenantId,
    action: input.action,
    subject_type: input.subjectType,
    subject_id: input.subjectId,
    decision: "allow",
    metadata: input.metadata ?? {},
  });
}

function num(v: unknown): number {
  return v === null || v === undefined ? 0 : Number(v);
}

async function loadEntry(supabase: AuthedClient, tenantId: string, entryId: string) {
  const { data } = await supabase
    .from("fpo_ledger_entries")
    .select(LEDGER_COLUMNS)
    .eq("tenant_id", tenantId)
    .eq("id", entryId)
    .maybeSingle();
  if (!data) throw new Error("Ledger entry not found");
  return data as unknown as Record<string, unknown>;
}

async function loadGrant(supabase: AuthedClient, tenantId: string, grantId: string) {
  const { data } = await supabase
    .from("fpo_grant_funds")
    .select(GRANT_COLUMNS)
    .eq("tenant_id", tenantId)
    .eq("id", grantId)
    .maybeSingle();
  if (!data) throw new Error("Grant fund not found");
  const row = data as unknown as Record<string, unknown>;
  return {
    id: row["id"] as string,
    sanctioned_amount: num(row["sanctioned_amount"]),
    received_amount: num(row["received_amount"]),
    utilized_amount: num(row["utilized_amount"]),
    uc_state: row["uc_state"] as UcState,
    next_installment_due: (row["next_installment_due"] as string | null) ?? null,
    reporting_deadline: (row["reporting_deadline"] as string | null) ?? null,
  };
}

/* ------------------------------------------------------------- board read */

export const getAccountsBoard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string }) => input)
  .handler(async ({ data, context }): Promise<AccountsBoard> => {
    const { supabase, userId } = context;
    const { roles } = await tenantScope(supabase, userId, data.tenantId);
    if (!canViewAccounts(roles)) {
      throw new Error("You are not permitted to view FPO finance records");
    }

    const [ledgerRes, grantRes, utilRes, memberRes] = await Promise.all([
      supabase
        .from("fpo_ledger_entries")
        .select(`${LEDGER_COLUMNS}, fpo_members(display_name)`)
        .eq("tenant_id", data.tenantId)
        .order("entry_date", { ascending: false })
        .limit(500),
      supabase
        .from("fpo_grant_funds")
        .select(GRANT_COLUMNS)
        .eq("tenant_id", data.tenantId)
        .order("created_at", { ascending: false }),
      supabase
        .from("fpo_grant_utilizations")
        .select("id, grant_id, purpose, amount, spent_on, voucher_reference, note")
        .eq("tenant_id", data.tenantId)
        .order("spent_on", { ascending: false })
        .limit(300),
      supabase
        .from("fpo_members")
        .select("id, display_name")
        .eq("tenant_id", data.tenantId)
        .eq("status", "active")
        .order("display_name")
        .limit(300),
    ]);

    const rawEntries = (ledgerRes.data ?? []) as Array<
      Record<string, unknown> & { fpo_members: { display_name: string } | null }
    >;

    const entries: LedgerRow[] = rawEntries.map((r) => {
      const base = {
        direction: r["direction"] as LedgerDirection,
        category: r["category"] as LedgerCategory,
        amount: num(r["amount"]),
        amount_settled: num(r["amount_settled"]),
        payment_state: r["payment_state"] as PaymentState,
        due_date: (r["due_date"] as string | null) ?? null,
        is_reconciled: Boolean(r["is_reconciled"]),
        member_id: (r["member_id"] as string | null) ?? null,
      };
      return {
        id: r["id"] as string,
        entry_date: r["entry_date"] as string,
        description: r["description"] as string,
        party_name: (r["party_name"] as string | null) ?? null,
        member_name: r.fpo_members?.display_name ?? null,
        outstanding: outstandingAmount(base),
        overdue: isOverdue(base),
        reference: (r["reference"] as string | null) ?? null,
        bank_reference: (r["bank_reference"] as string | null) ?? null,
        note: (r["note"] as string | null) ?? null,
        updated_at: r["updated_at"] as string,
        ...base,
      };
    });

    const memberOptions = ((memberRes.data ?? []) as Array<{ id: string; display_name: string }>).map(
      (m) => ({ id: m.id, display_name: m.display_name }),
    );
    const nameById = new Map(memberOptions.map((m) => [m.id, m.display_name]));
    const entryNameById = new Map(
      entries.filter((e) => e.member_id).map((e) => [e.member_id as string, e.member_name]),
    );

    const grants: GrantRow[] = ((grantRes.data ?? []) as Array<Record<string, unknown>>).map((r) => {
      const g = {
        sanctioned_amount: num(r["sanctioned_amount"]),
        received_amount: num(r["received_amount"]),
        utilized_amount: num(r["utilized_amount"]),
        uc_state: r["uc_state"] as UcState,
        next_installment_due: (r["next_installment_due"] as string | null) ?? null,
        reporting_deadline: (r["reporting_deadline"] as string | null) ?? null,
      };
      return {
        id: r["id"] as string,
        title: r["title"] as string,
        funder_name: r["funder_name"] as string,
        sanctioned_on: (r["sanctioned_on"] as string | null) ?? null,
        next_installment_amount:
          r["next_installment_amount"] === null ? null : num(r["next_installment_amount"]),
        note: (r["note"] as string | null) ?? null,
        position: grantPosition(g),
        ...g,
      };
    });

    const utilizations: UtilizationRow[] = (
      (utilRes.data ?? []) as Array<Record<string, unknown>>
    ).map((r) => ({
      id: r["id"] as string,
      grant_id: r["grant_id"] as string,
      purpose: r["purpose"] as string,
      amount: num(r["amount"]),
      spent_on: r["spent_on"] as string,
      voucher_reference: (r["voucher_reference"] as string | null) ?? null,
      note: (r["note"] as string | null) ?? null,
    }));

    return {
      tenantId: data.tenantId,
      roles,
      canManage: canManageAccounts(roles),
      canReconcile: canReconcile(roles),
      summary: summarizeLedger(entries),
      categories: categoryTotals(entries),
      entries,
      members: memberLedger(entries).map((m) => ({
        ...m,
        memberName: nameById.get(m.memberId) ?? entryNameById.get(m.memberId) ?? "Member",
      })),
      grants,
      utilizations,
      utilizationTotal: utilizationTotal(utilizations),
      memberOptions,
      disclaimer: ACCOUNTS_DISCLAIMER,
    };
  });

/* --------------------------------------------------------------- mutations */

export const recordLedgerEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      tenantId: string;
      entryDate?: string | null;
      direction: LedgerDirection;
      category: LedgerCategory;
      description: string;
      partyName?: string | null;
      memberId?: string | null;
      amount: number;
      amountSettled?: number;
      dueDate?: string | null;
      reference?: string | null;
      note?: string | null;
    }) => input,
  )
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const { supabase, userId } = context;
    const { roles } = await tenantScope(supabase, userId, data.tenantId);
    if (!canManageAccounts(roles)) {
      throw new Error("Only FPO finance administrators can record transactions");
    }
    if (!data.description.trim()) throw new Error("A description is required");
    if (!(data.amount > 0)) throw new Error("Amount must be greater than zero");
    const settled = Math.max(0, Number(data.amountSettled ?? 0));
    if (settled > data.amount) throw new Error("Settled amount cannot exceed the entry amount");

    const { data: row, error } = await supabase
      .from("fpo_ledger_entries")
      .insert({
        tenant_id: data.tenantId,
        entry_date: data.entryDate || new Date().toISOString().slice(0, 10),
        direction: data.direction,
        category: data.category,
        description: data.description.trim(),
        party_name: data.partyName?.trim() || null,
        member_id: data.memberId || null,
        amount: data.amount,
        amount_settled: settled,
        payment_state: derivePaymentState(data.amount, settled, "pending"),
        due_date: data.dueDate || null,
        reference: data.reference?.trim() || null,
        note: data.note?.trim() || null,
        created_by_user_id: userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await logAudit(supabase, {
      userId,
      tenantId: data.tenantId,
      action: "fpo.accounts.entry_recorded",
      subjectType: "fpo_ledger_entry",
      subjectId: row.id,
      metadata: {
        direction: data.direction,
        category: data.category,
        amount: data.amount,
        amount_settled: settled,
      },
    });
    return { id: row.id };
  });

export const recordSettlement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      tenantId: string;
      entryId: string;
      amountSettled: number;
      waive?: boolean;
    }) => input,
  )
  .handler(async ({ data, context }): Promise<{ payment_state: PaymentState }> => {
    const { supabase, userId } = context;
    const { roles } = await tenantScope(supabase, userId, data.tenantId);
    if (!canManageAccounts(roles)) {
      throw new Error("Only FPO finance administrators can record settlements");
    }
    const existing = await loadEntry(supabase, data.tenantId, data.entryId);
    const amount = num(existing["amount"]);
    const settled = data.waive ? num(existing["amount_settled"]) : Math.max(0, data.amountSettled);
    if (!data.waive && settled > amount) {
      throw new Error("Settled amount cannot exceed the entry amount");
    }
    const state: PaymentState = data.waive
      ? "waived"
      : derivePaymentState(amount, settled, existing["payment_state"] as PaymentState);

    const { error } = await supabase
      .from("fpo_ledger_entries")
      .update({ amount_settled: settled, payment_state: state })
      .eq("tenant_id", data.tenantId)
      .eq("id", data.entryId);
    if (error) throw new Error(error.message);

    await logAudit(supabase, {
      userId,
      tenantId: data.tenantId,
      action: data.waive ? "fpo.accounts.entry_waived" : "fpo.accounts.settlement_recorded",
      subjectType: "fpo_ledger_entry",
      subjectId: data.entryId,
      metadata: { amount, amount_settled: settled, payment_state: state },
    });
    return { payment_state: state };
  });

export const reconcileLedgerEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      tenantId: string;
      entryId: string;
      bankReference: string;
      reconciled: boolean;
    }) => input,
  )
  .handler(async ({ data, context }): Promise<{ is_reconciled: boolean }> => {
    const { supabase, userId } = context;
    const { roles } = await tenantScope(supabase, userId, data.tenantId);
    if (!canReconcile(roles)) {
      throw new Error("Only FPO finance administrators can reconcile bank lines");
    }
    if (data.reconciled && !data.bankReference.trim()) {
      throw new Error("A bank reference is required to mark a line reconciled");
    }
    await loadEntry(supabase, data.tenantId, data.entryId);

    const { error } = await supabase
      .from("fpo_ledger_entries")
      .update({
        bank_reference: data.reconciled ? data.bankReference.trim() : null,
        is_reconciled: data.reconciled,
        reconciled_at: data.reconciled ? new Date().toISOString() : null,
        reconciled_by_user_id: data.reconciled ? userId : null,
      })
      .eq("tenant_id", data.tenantId)
      .eq("id", data.entryId);
    if (error) throw new Error(error.message);

    await logAudit(supabase, {
      userId,
      tenantId: data.tenantId,
      action: data.reconciled
        ? "fpo.accounts.entry_reconciled"
        : "fpo.accounts.entry_reconciliation_cleared",
      subjectType: "fpo_ledger_entry",
      subjectId: data.entryId,
      metadata: { bank_reference: data.reconciled ? data.bankReference.trim() : null },
    });
    return { is_reconciled: data.reconciled };
  });

export const recordGrantFund = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      tenantId: string;
      title: string;
      funderName: string;
      sanctionedAmount: number;
      receivedAmount?: number;
      sanctionedOn?: string | null;
      nextInstallmentDue?: string | null;
      nextInstallmentAmount?: number | null;
      reportingDeadline?: string | null;
      note?: string | null;
    }) => input,
  )
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const { supabase, userId } = context;
    const { roles } = await tenantScope(supabase, userId, data.tenantId);
    if (!canManageAccounts(roles)) {
      throw new Error("Only FPO finance administrators can record grant funds");
    }
    if (!data.title.trim() || !data.funderName.trim()) {
      throw new Error("A grant title and funder name are required");
    }
    const received = Math.max(0, Number(data.receivedAmount ?? 0));
    if (received > data.sanctionedAmount) {
      throw new Error("Received amount cannot exceed the sanctioned amount");
    }

    const { data: row, error } = await supabase
      .from("fpo_grant_funds")
      .insert({
        tenant_id: data.tenantId,
        title: data.title.trim(),
        funder_name: data.funderName.trim(),
        sanctioned_amount: data.sanctionedAmount,
        received_amount: received,
        utilized_amount: 0,
        sanctioned_on: data.sanctionedOn || null,
        next_installment_due: data.nextInstallmentDue || null,
        next_installment_amount: data.nextInstallmentAmount ?? null,
        reporting_deadline: data.reportingDeadline || null,
        uc_state: received > 0 ? "pending" : "not_due",
        note: data.note?.trim() || null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await logAudit(supabase, {
      userId,
      tenantId: data.tenantId,
      action: "fpo.accounts.grant_recorded",
      subjectType: "fpo_grant_fund",
      subjectId: row.id,
      metadata: { sanctioned: data.sanctionedAmount, received },
    });
    return { id: row.id };
  });

export const recordGrantReceipt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string; grantId: string; amount: number }) => input)
  .handler(async ({ data, context }): Promise<{ received_amount: number }> => {
    const { supabase, userId } = context;
    const { roles } = await tenantScope(supabase, userId, data.tenantId);
    if (!canManageAccounts(roles)) {
      throw new Error("Only FPO finance administrators can record grant receipts");
    }
    if (!(data.amount > 0)) throw new Error("Receipt amount must be greater than zero");
    const grant = await loadGrant(supabase, data.tenantId, data.grantId);
    const received = grant.received_amount + data.amount;
    if (received > grant.sanctioned_amount + 0.005) {
      throw new Error("Total receipts cannot exceed the sanctioned amount");
    }

    const { error } = await supabase
      .from("fpo_grant_funds")
      .update({
        received_amount: received,
        uc_state: grant.uc_state === "not_due" ? "pending" : grant.uc_state,
      })
      .eq("tenant_id", data.tenantId)
      .eq("id", data.grantId);
    if (error) throw new Error(error.message);

    await logAudit(supabase, {
      userId,
      tenantId: data.tenantId,
      action: "fpo.accounts.grant_receipt_recorded",
      subjectType: "fpo_grant_fund",
      subjectId: data.grantId,
      metadata: { amount: data.amount, received_amount: received },
    });
    return { received_amount: received };
  });

export const recordGrantUtilization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      tenantId: string;
      grantId: string;
      purpose: string;
      amount: number;
      spentOn?: string | null;
      voucherReference?: string | null;
      note?: string | null;
    }) => input,
  )
  .handler(async ({ data, context }): Promise<{ id: string; utilized_amount: number }> => {
    const { supabase, userId } = context;
    const { roles } = await tenantScope(supabase, userId, data.tenantId);
    if (!canManageAccounts(roles)) {
      throw new Error("Only FPO finance administrators can record grant utilization");
    }
    if (!data.purpose.trim()) throw new Error("A utilization purpose is required");

    const grant = await loadGrant(supabase, data.tenantId, data.grantId);
    const check = utilizationCheck(grant, data.amount);
    if (!check.allowed) throw new Error(check.reasons.join(" "));

    const { data: row, error } = await supabase
      .from("fpo_grant_utilizations")
      .insert({
        tenant_id: data.tenantId,
        grant_id: data.grantId,
        purpose: data.purpose.trim(),
        amount: data.amount,
        spent_on: data.spentOn || new Date().toISOString().slice(0, 10),
        voucher_reference: data.voucherReference?.trim() || null,
        note: data.note?.trim() || null,
        recorded_by_user_id: userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    const utilized = grant.utilized_amount + data.amount;
    await supabase
      .from("fpo_grant_funds")
      .update({ utilized_amount: utilized })
      .eq("tenant_id", data.tenantId)
      .eq("id", data.grantId);

    await logAudit(supabase, {
      userId,
      tenantId: data.tenantId,
      action: "fpo.accounts.grant_utilization_recorded",
      subjectType: "fpo_grant_utilization",
      subjectId: row.id,
      metadata: { grant_id: data.grantId, amount: data.amount, utilized_amount: utilized },
    });
    return { id: row.id, utilized_amount: utilized };
  });

export const setGrantUcState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string; grantId: string; state: UcState }) => input)
  .handler(async ({ data, context }): Promise<{ uc_state: UcState }> => {
    const { supabase, userId } = context;
    const { roles } = await tenantScope(supabase, userId, data.tenantId);
    const grant = await loadGrant(supabase, data.tenantId, data.grantId);

    const funderOutcome = FUNDER_UC_STATES.includes(data.state);
    if (funderOutcome) {
      const permitted = roles.includes("platform_admin") || roles.includes("scheme_reviewer");
      if (!permitted) {
        throw new Error(
          "Only the funder side (scheme reviewer or platform administrator) can accept or return a utilization certificate",
        );
      }
    } else if (!canCertify(roles)) {
      throw new Error("Only FPO finance administrators can prepare or submit a utilization certificate");
    }
    if (!canTransitionUc(grant.uc_state, data.state)) {
      throw new Error(`A utilization certificate cannot move from ${grant.uc_state} to ${data.state}`);
    }

    const { error } = await supabase
      .from("fpo_grant_funds")
      .update({ uc_state: data.state })
      .eq("tenant_id", data.tenantId)
      .eq("id", data.grantId);
    if (error) throw new Error(error.message);

    await logAudit(supabase, {
      userId,
      tenantId: data.tenantId,
      action: "fpo.accounts.grant_uc_state_changed",
      subjectType: "fpo_grant_fund",
      subjectId: data.grantId,
      metadata: { from: grant.uc_state, to: data.state, funder_outcome: funderOutcome },
    });
    return { uc_state: data.state };
  });

function canCertify(roles: AppRole[]): boolean {
  return canManageAccounts(roles);
}
