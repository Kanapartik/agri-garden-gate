/**
 * FPO billing & collections — maker / checker / approver server functions.
 *
 * Reads are tenant-scoped and default-deny. Every transition re-checks the
 * caller's tenant roles server-side through `evaluateTransition`, so a client
 * that hides or forges a button changes nothing. Settlement is refused unless
 * the voucher is approved, and each step is written to the append-only audit
 * trail with the named actor.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  BILLING_DISCLAIMER,
  canApproveVoucher,
  canCheckVoucher,
  canMakeVoucher,
  evaluateTransition,
  settlementAllowed,
  summarizeBilling,
  type BillingSummary,
  type VoucherAction,
  type VoucherStage,
} from "@/lib/atap/fpoBilling";
import {
  canViewAccounts,
  derivePaymentState,
  isOverdue,
  outstandingAmount,
  type LedgerCategory,
  type LedgerDirection,
  type PaymentState,
} from "@/lib/atap/fpoAccounts";
import type { AppRole } from "@/lib/atap/policy";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type AuthedClient = SupabaseClient<Database>;

export interface VoucherRow {
  id: string;
  voucher_number: string | null;
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
  note: string | null;
  workflow_stage: VoucherStage;
  maker_user_id: string | null;
  maker_name: string | null;
  maker_at: string | null;
  checker_user_id: string | null;
  checker_name: string | null;
  checker_at: string | null;
  approver_user_id: string | null;
  approver_name: string | null;
  approver_at: string | null;
  returned_reason: string | null;
  is_reconciled: boolean;
  updated_at: string;
}

export interface BillingMemberOption {
  id: string;
  display_name: string;
  village: string | null;
  /** Money the member still owes the FPO on approved collections. */
  owesFpo: number;
  /** Money the FPO still owes the member on approved payouts. */
  fpoOwes: number;
}

export interface BillingBoard {
  tenantId: string;
  roles: AppRole[];
  actorUserId: string;
  canMake: boolean;
  canCheck: boolean;
  canApprove: boolean;
  summary: BillingSummary;
  vouchers: VoucherRow[];
  members: BillingMemberOption[];
  disclaimer: string;
}

const VOUCHER_COLUMNS =
  "id, voucher_number, entry_date, direction, category, description, party_name, member_id, amount, amount_settled, payment_state, due_date, reference, note, workflow_stage, maker_user_id, maker_at, checker_user_id, checker_at, approver_user_id, approver_at, returned_reason, is_reconciled, updated_at";

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
    subjectId: string;
    metadata?: Record<string, unknown>;
  },
) {
  const { audit } = await import("@/lib/atap/admin.server");
  await audit(supabase, {
    actor_user_id: input.userId,
    tenant_id: input.tenantId,
    action: input.action,
    subject_type: "fpo_ledger_entry",
    subject_id: input.subjectId,
    decision: "allow",
    metadata: input.metadata ?? {},
  });
}

function num(v: unknown): number {
  return v === null || v === undefined ? 0 : Number(v);
}

async function nameMap(
  supabase: AuthedClient,
  ids: string[],
): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return new Map();
  const { data } = await supabase.from("profiles").select("id, full_name").in("id", unique);
  const map = new Map<string, string>();
  for (const row of (data ?? []) as Array<{ id: string; full_name: string | null }>) {
    if (row.full_name) map.set(row.id, row.full_name);
  }
  return map;
}

/* ------------------------------------------------------------- board read */

export const getBillingBoard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string }) => input)
  .handler(async ({ data, context }): Promise<BillingBoard> => {
    const { supabase, userId } = context;
    const { roles } = await tenantScope(supabase, userId, data.tenantId);
    if (!canViewAccounts(roles)) {
      throw new Error("You are not permitted to view FPO billing records");
    }

    const [voucherRes, memberRes] = await Promise.all([
      supabase
        .from("fpo_ledger_entries")
        .select(`${VOUCHER_COLUMNS}, fpo_members(display_name, village_cluster)`)
        .eq("tenant_id", data.tenantId)
        .order("entry_date", { ascending: false })
        .limit(400),
      supabase
        .from("fpo_members")
        .select("id, display_name, village_cluster")
        .eq("tenant_id", data.tenantId)
        .eq("status", "active")
        .order("display_name")
        .limit(300),
    ]);

    const raw = (voucherRes.data ?? []) as Array<
      Record<string, unknown> & {
        fpo_members: { display_name: string; village_cluster: string | null } | null;
      }
    >;

    const names = await nameMap(
      supabase,
      raw.flatMap((r) => [
        (r["maker_user_id"] as string | null) ?? "",
        (r["checker_user_id"] as string | null) ?? "",
        (r["approver_user_id"] as string | null) ?? "",
      ]),
    );

    const vouchers: VoucherRow[] = raw.map((r) => {
      const base = {
        direction: r["direction"] as LedgerDirection,
        category: r["category"] as LedgerCategory,
        amount: num(r["amount"]),
        amount_settled: num(r["amount_settled"]),
        payment_state: r["payment_state"] as PaymentState,
        due_date: (r["due_date"] as string | null) ?? null,
        member_id: (r["member_id"] as string | null) ?? null,
      };
      const makerId = (r["maker_user_id"] as string | null) ?? null;
      const checkerId = (r["checker_user_id"] as string | null) ?? null;
      const approverId = (r["approver_user_id"] as string | null) ?? null;
      return {
        id: r["id"] as string,
        voucher_number: (r["voucher_number"] as string | null) ?? null,
        entry_date: r["entry_date"] as string,
        description: r["description"] as string,
        party_name: (r["party_name"] as string | null) ?? null,
        member_name: r.fpo_members?.display_name ?? null,
        outstanding: outstandingAmount(base),
        overdue: isOverdue(base),
        reference: (r["reference"] as string | null) ?? null,
        note: (r["note"] as string | null) ?? null,
        workflow_stage: r["workflow_stage"] as VoucherStage,
        maker_user_id: makerId,
        maker_name: makerId ? (names.get(makerId) ?? null) : null,
        maker_at: (r["maker_at"] as string | null) ?? null,
        checker_user_id: checkerId,
        checker_name: checkerId ? (names.get(checkerId) ?? null) : null,
        checker_at: (r["checker_at"] as string | null) ?? null,
        approver_user_id: approverId,
        approver_name: approverId ? (names.get(approverId) ?? null) : null,
        approver_at: (r["approver_at"] as string | null) ?? null,
        returned_reason: (r["returned_reason"] as string | null) ?? null,
        is_reconciled: Boolean(r["is_reconciled"]),
        updated_at: r["updated_at"] as string,
        ...base,
      };
    });

    const owes = new Map<string, { owesFpo: number; fpoOwes: number }>();
    for (const v of vouchers) {
      if (!v.member_id || v.workflow_stage !== "approved" || v.outstanding <= 0) continue;
      const row = owes.get(v.member_id) ?? { owesFpo: 0, fpoOwes: 0 };
      if (v.direction === "inflow") row.owesFpo += v.outstanding;
      else row.fpoOwes += v.outstanding;
      owes.set(v.member_id, row);
    }

    const members: BillingMemberOption[] = (
      (memberRes.data ?? []) as Array<{
        id: string;
        display_name: string;
        village_cluster: string | null;
      }>
    ).map((m) => ({
      id: m.id,
      display_name: m.display_name,
      village: m.village_cluster ?? null,
      owesFpo: Math.round((owes.get(m.id)?.owesFpo ?? 0) * 100) / 100,
      fpoOwes: Math.round((owes.get(m.id)?.fpoOwes ?? 0) * 100) / 100,
    }));

    return {
      tenantId: data.tenantId,
      roles,
      actorUserId: userId,
      canMake: canMakeVoucher(roles),
      canCheck: canCheckVoucher(roles),
      canApprove: canApproveVoucher(roles),
      summary: summarizeBilling(vouchers),
      vouchers,
      members,
      disclaimer: BILLING_DISCLAIMER,
    };
  });

/* -------------------------------------------------------------- maker step */

export const createVoucher = createServerFn({ method: "POST" })
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
      dueDate?: string | null;
      reference?: string | null;
      note?: string | null;
      submit?: boolean;
    }) => input,
  )
  .handler(
    async ({
      data,
      context,
    }): Promise<{ id: string; voucher_number: string | null; workflow_stage: VoucherStage }> => {
      const { supabase, userId } = context;
      const { roles } = await tenantScope(supabase, userId, data.tenantId);
      if (!canMakeVoucher(roles)) {
        throw new Error("You are not permitted to prepare FPO vouchers");
      }
      if (!data.description.trim()) throw new Error("A description is required");
      if (!(data.amount > 0)) throw new Error("Amount must be greater than zero");

      const now = new Date().toISOString();
      const stage: VoucherStage = data.submit ? "pending_check" : "draft";

      const { data: row, error } = await supabase
        .from("fpo_ledger_entries")
        .insert({
          tenant_id: data.tenantId,
          entry_date: data.entryDate || now.slice(0, 10),
          direction: data.direction,
          category: data.category,
          description: data.description.trim(),
          party_name: data.partyName?.trim() || null,
          member_id: data.memberId || null,
          amount: data.amount,
          amount_settled: 0,
          payment_state: "pending",
          due_date: data.dueDate || null,
          reference: data.reference?.trim() || null,
          note: data.note?.trim() || null,
          workflow_stage: stage,
          maker_user_id: userId,
          maker_at: now,
          created_by_user_id: userId,
        })
        .select("id, voucher_number, workflow_stage")
        .single();
      if (error) throw new Error(error.message);

      await logAudit(supabase, {
        userId,
        tenantId: data.tenantId,
        action: "fpo.billing.voucher_prepared",
        subjectId: row.id,
        metadata: {
          voucher_number: row.voucher_number,
          direction: data.direction,
          category: data.category,
          amount: data.amount,
          workflow_stage: stage,
        },
      });

      return {
        id: row.id,
        voucher_number: row.voucher_number ?? null,
        workflow_stage: row.workflow_stage as VoucherStage,
      };
    },
  );

/* ------------------------------------------------- checker / approver step */

export const actOnVoucher = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      tenantId: string;
      voucherId: string;
      action: VoucherAction;
      reason?: string | null;
    }) => input,
  )
  .handler(async ({ data, context }): Promise<{ workflow_stage: VoucherStage }> => {
    const { supabase, userId } = context;
    const { roles } = await tenantScope(supabase, userId, data.tenantId);

    const { data: existing } = await supabase
      .from("fpo_ledger_entries")
      .select(
        "id, amount, amount_settled, workflow_stage, maker_user_id, checker_user_id, approver_user_id",
      )
      .eq("tenant_id", data.tenantId)
      .eq("id", data.voucherId)
      .maybeSingle();
    if (!existing) throw new Error("Voucher not found");

    const voucher = {
      id: existing.id,
      workflow_stage: existing.workflow_stage as VoucherStage,
      amount: num(existing.amount),
      amount_settled: num(existing.amount_settled),
      maker_user_id: existing.maker_user_id,
      checker_user_id: existing.checker_user_id,
      approver_user_id: existing.approver_user_id,
    };

    const verdict = evaluateTransition({
      voucher,
      action: data.action,
      roles,
      actorUserId: userId,
      reason: data.reason ?? null,
    });
    if (!verdict.allowed) throw new Error(verdict.reasons.join(" "));

    const now = new Date().toISOString();
    const patch: Database["public"]["Tables"]["fpo_ledger_entries"]["Update"] = {
      workflow_stage: verdict.stage,
    };
    if (data.action === "check") {
      patch["checker_user_id"] = userId;
      patch["checker_at"] = now;
      patch["returned_reason"] = null;
    }
    if (data.action === "approve") {
      patch["approver_user_id"] = userId;
      patch["approver_at"] = now;
      patch["returned_reason"] = null;
    }
    if (data.action === "return") {
      patch["returned_reason"] = data.reason?.trim() ?? null;
      patch["checker_user_id"] = userId;
      patch["checker_at"] = now;
      patch["approver_user_id"] = null;
      patch["approver_at"] = null;
    }
    if (data.action === "submit") {
      patch["returned_reason"] = null;
      patch["checker_user_id"] = null;
      patch["checker_at"] = null;
      patch["approver_user_id"] = null;
      patch["approver_at"] = null;
    }
    if (data.action === "revise") {
      patch["checker_user_id"] = null;
      patch["checker_at"] = null;
      patch["approver_user_id"] = null;
      patch["approver_at"] = null;
    }

    const { error } = await supabase
      .from("fpo_ledger_entries")
      .update(patch)
      .eq("tenant_id", data.tenantId)
      .eq("id", data.voucherId);
    if (error) throw new Error(error.message);

    await logAudit(supabase, {
      userId,
      tenantId: data.tenantId,
      action: `fpo.billing.voucher_${data.action}`,
      subjectId: data.voucherId,
      metadata: {
        from_stage: voucher.workflow_stage,
        to_stage: verdict.stage,
        amount: voucher.amount,
        reason: data.reason?.trim() || null,
      },
    });

    return { workflow_stage: verdict.stage };
  });

/* ---------------------------------------------------------- settlement step */

export const settleVoucher = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      tenantId: string;
      voucherId: string;
      amountSettled: number;
      bankReference?: string | null;
    }) => input,
  )
  .handler(async ({ data, context }): Promise<{ payment_state: PaymentState }> => {
    const { supabase, userId } = context;
    const { roles } = await tenantScope(supabase, userId, data.tenantId);
    if (!canApproveVoucher(roles)) {
      throw new Error("Only FPO finance administrators can record settlements");
    }

    const { data: existing } = await supabase
      .from("fpo_ledger_entries")
      .select("id, amount, amount_settled, payment_state, workflow_stage")
      .eq("tenant_id", data.tenantId)
      .eq("id", data.voucherId)
      .maybeSingle();
    if (!existing) throw new Error("Voucher not found");

    const stage = existing.workflow_stage as VoucherStage;
    if (!settlementAllowed(stage)) {
      throw new Error("Only an approved voucher can be settled");
    }

    const amount = num(existing.amount);
    const settled = Math.max(0, data.amountSettled);
    if (settled > amount) throw new Error("Settled amount cannot exceed the voucher amount");

    const state = derivePaymentState(amount, settled, existing.payment_state as PaymentState);
    const reference = data.bankReference?.trim() || null;

    const { error } = await supabase
      .from("fpo_ledger_entries")
      .update({
        amount_settled: settled,
        payment_state: state,
        ...(reference ? { bank_reference: reference } : {}),
      })
      .eq("tenant_id", data.tenantId)
      .eq("id", data.voucherId);
    if (error) throw new Error(error.message);

    await logAudit(supabase, {
      userId,
      tenantId: data.tenantId,
      action: "fpo.billing.settlement_recorded",
      subjectId: data.voucherId,
      metadata: { amount, amount_settled: settled, payment_state: state, bank_reference: reference },
    });

    return { payment_state: state };
  });
