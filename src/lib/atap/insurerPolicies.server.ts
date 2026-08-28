/**
 * Server-only helpers for slice I4 (insurer policy & enrolment lifecycle).
 *
 * Authority rules, default-deny:
 *  - reads reuse the slice I1 insurer scope (insurer membership, or
 *    platform_admin / auditor oversight);
 *  - writes require tenant_admin of that insurer tenant, or platform_admin;
 *  - policy issuance and enrolment verification require a human decision note;
 *  - the FPO counterpart read is scoped to the caller's own registration
 *    numbers and never returns insurer-internal notes;
 *  - every write is audited (allow AND deny).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { audit } from "@/lib/atap/admin.server";
import {
  resolveInsurerScope,
  type InsurerScope,
  type InsurerTenantOption,
} from "@/lib/atap/insurerRevenue.server";
import {
  blocksPolicyIssuance,
  canMoveEnrolmentState,
  canMovePolicyStatus,
  grossPremium,
  POLICY_AGGREGATE_NOTE,
  POLICY_HUMAN_DECISION_NOTE,
  requiresEnrolmentDecisionNote,
  requiresPolicyDecisionNote,
  sharesAreValid,
  splitPremium,
  type EnrolmentBatchRow,
  type EnrolmentState,
  type PolicyRow,
  type PolicyStatus,
  type RemittanceRow,
  type RemittanceState,
} from "@/lib/atap/insurerPolicies";

export type AuthedClient = SupabaseClient<Database>;

const POLICY_COLUMNS =
  "id, insurer_tenant_id, policy_reference, registration_number, fpo_name, state_name, district, scheme_code, scheme_name, crop, season, status, coverage_start, coverage_end, enrolment_cutoff, sum_insured_per_acre_inr, actuarial_rate_pct, farmer_share_pct, centre_share_pct, state_share_pct, insured_acres, insured_members, gross_premium_inr, decision_note";

const BATCH_COLUMNS =
  "id, insurer_tenant_id, policy_id, batch_reference, registration_number, fpo_name, state_name, district, crop, season, state, member_count, acres, premium_due_inr, farmer_premium_inr, subsidy_premium_inr, submitted_at, verified_at, verification_note";

/** FPO-facing projection: no insurer-internal notes. */
const BATCH_COLUMNS_SHARED =
  "id, insurer_tenant_id, policy_id, batch_reference, registration_number, fpo_name, state_name, district, crop, season, state, member_count, acres, premium_due_inr, farmer_premium_inr, subsidy_premium_inr, submitted_at, verified_at";

const REMITTANCE_COLUMNS =
  "id, batch_id, remittance_reference, amount_inr, method, state, received_at, reconciled_at";

export interface PoliciesWorkspace {
  scope: InsurerScope;
  tenantOptions: InsurerTenantOption[];
  humanDecisionNote: string;
  aggregateNote: string;
  policies: PolicyRow[];
  batches: EnrolmentBatchRow[];
  channel: Array<{
    registration_number: string;
    fpo_name: string;
    state_name: string | null;
    district: string | null;
  }>;
}

export async function loadPoliciesWorkspace(
  supabase: AuthedClient,
  userId: string,
  requestedTenantId?: string,
): Promise<PoliciesWorkspace> {
  const { scope, options } = await resolveInsurerScope(supabase, userId, requestedTenantId);

  const [policies, batches, channel] = await Promise.all([
    supabase
      .from("insurer_policies")
      .select(POLICY_COLUMNS)
      .eq("insurer_tenant_id", scope.tenantId)
      .order("fpo_name")
      .limit(1000),
    supabase
      .from("insurer_enrolment_batches")
      .select(BATCH_COLUMNS)
      .eq("insurer_tenant_id", scope.tenantId)
      .order("created_at", { ascending: false })
      .limit(1000),
    supabase
      .from("insurer_fpo_channel")
      .select("registration_number, fpo_name, state_name, district")
      .eq("insurer_tenant_id", scope.tenantId)
      .order("fpo_name")
      .limit(2000),
  ]);
  if (policies.error) throw new Error(policies.error.message);
  if (batches.error) throw new Error(batches.error.message);
  if (channel.error) throw new Error(channel.error.message);

  const batchRows = (batches.data ?? []) as unknown as EnrolmentBatchRow[];
  let remittances: RemittanceRow[] = [];
  if (batchRows.length) {
    const res = await supabase
      .from("insurer_premium_remittances")
      .select(REMITTANCE_COLUMNS)
      .in(
        "batch_id",
        batchRows.map((b) => b.id),
      );
    if (res.error) throw new Error(res.error.message);
    remittances = (res.data ?? []) as unknown as RemittanceRow[];
  }

  return {
    scope,
    tenantOptions: options,
    humanDecisionNote: POLICY_HUMAN_DECISION_NOTE,
    aggregateNote: POLICY_AGGREGATE_NOTE,
    policies: (policies.data ?? []) as unknown as PolicyRow[],
    batches: batchRows.map((b) => ({
      ...b,
      remittances: remittances.filter((r) => r.batch_id === b.id),
    })),
    channel: (channel.data ?? []) as unknown as PoliciesWorkspace["channel"],
  };
}

/* --------------------------------------------------------------- writes */

async function requireManage(
  supabase: AuthedClient,
  userId: string,
  tenantId: string,
  action: string,
): Promise<InsurerScope> {
  const { scope } = await resolveInsurerScope(supabase, userId, tenantId);
  if (scope.tenantId !== tenantId || !scope.canManage) {
    await audit(supabase, {
      actor_user_id: userId,
      tenant_id: tenantId,
      action,
      subject_type: "insurer_policy",
      decision: "deny",
      metadata: { reason: "not_insurer_admin" },
    });
    throw new Error("Only an insurer administrator can manage policies and enrolment");
  }
  return scope;
}

function reference(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
}

export async function createPolicy(
  supabase: AuthedClient,
  userId: string,
  input: {
    tenantId: string;
    registrationNumber: string;
    fpoName: string;
    stateName?: string | null;
    district?: string | null;
    crop?: string | null;
    season?: string;
    schemeCode?: string;
    schemeName?: string;
    coverageStart?: string | null;
    coverageEnd?: string | null;
    enrolmentCutoff?: string | null;
    sumInsuredPerAcreInr?: number;
    actuarialRatePct?: number;
    farmerSharePct?: number;
    centreSharePct?: number;
    stateSharePct?: number;
    insuredAcres?: number;
    insuredMembers?: number;
  },
): Promise<{ id: string; reference: string }> {
  await requireManage(supabase, userId, input.tenantId, "insurer.policy.create");

  const shares = {
    farmer_share_pct: input.farmerSharePct ?? 2,
    centre_share_pct: input.centreSharePct ?? 49,
    state_share_pct: input.stateSharePct ?? 49,
  };
  if (!sharesAreValid(shares)) throw new Error("Premium shares must total 100%");

  const acres = input.insuredAcres ?? 0;
  const sumInsured = input.sumInsuredPerAcreInr ?? 0;
  const rate = input.actuarialRatePct ?? 0;
  const policyReference = reference("POL");

  const { data, error } = await supabase
    .from("insurer_policies")
    .insert({
      insurer_tenant_id: input.tenantId,
      policy_reference: policyReference,
      registration_number: input.registrationNumber,
      fpo_name: input.fpoName,
      state_name: input.stateName ?? null,
      district: input.district ?? null,
      crop: input.crop ?? null,
      season: input.season ?? "Kharif 2026",
      scheme_code: input.schemeCode ?? "PMFBY",
      scheme_name: input.schemeName ?? "Pradhan Mantri Fasal Bima Yojana",
      status: "draft",
      coverage_start: input.coverageStart ?? null,
      coverage_end: input.coverageEnd ?? null,
      enrolment_cutoff: input.enrolmentCutoff ?? null,
      sum_insured_per_acre_inr: sumInsured,
      actuarial_rate_pct: rate,
      ...shares,
      insured_acres: acres,
      insured_members: input.insuredMembers ?? 0,
      gross_premium_inr: grossPremium(acres, sumInsured, rate),
      created_by: userId,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  await audit(supabase, {
    actor_user_id: userId,
    tenant_id: input.tenantId,
    action: "insurer.policy.create",
    subject_type: "insurer_policy",
    subject_id: data.id,
    decision: "allow",
    metadata: { policy_reference: policyReference, registration_number: input.registrationNumber },
  });

  return { id: data.id, reference: policyReference };
}

export async function movePolicyStatus(
  supabase: AuthedClient,
  userId: string,
  input: {
    tenantId: string;
    policyId: string;
    toStatus: PolicyStatus;
    note?: string | null;
  },
): Promise<{ status: PolicyStatus }> {
  await requireManage(supabase, userId, input.tenantId, "insurer.policy.status");

  const { data: policy, error } = await supabase
    .from("insurer_policies")
    .select(POLICY_COLUMNS)
    .eq("id", input.policyId)
    .eq("insurer_tenant_id", input.tenantId)
    .single();
  if (error) throw new Error(error.message);
  const row = policy as unknown as PolicyRow;

  if (!canMovePolicyStatus(row.status, input.toStatus)) {
    throw new Error(`Cannot move policy from ${row.status} to ${input.toStatus}`);
  }
  if (requiresPolicyDecisionNote(input.toStatus) && !input.note?.trim()) {
    throw new Error("A decision note is required for this policy outcome");
  }
  if (input.toStatus === "issued") {
    const { data: batches } = await supabase
      .from("insurer_enrolment_batches")
      .select(BATCH_COLUMNS)
      .eq("policy_id", input.policyId);
    const blocker = blocksPolicyIssuance(
      row,
      (batches ?? []) as unknown as EnrolmentBatchRow[],
    );
    if (blocker) throw new Error(blocker);
  }

  const patch: {
    status: PolicyStatus;
    decision_note?: string;
    decided_by?: string;
    decided_at?: string;
  } = { status: input.toStatus };
  if (input.note?.trim()) {
    patch.decision_note = input.note.trim();
    patch.decided_by = userId;
    patch.decided_at = new Date().toISOString();
  }

  const upd = await supabase
    .from("insurer_policies")
    .update(patch)
    .eq("id", input.policyId)
    .eq("insurer_tenant_id", input.tenantId);
  if (upd.error) throw new Error(upd.error.message);

  await audit(supabase, {
    actor_user_id: userId,
    tenant_id: input.tenantId,
    action: "insurer.policy.status",
    subject_type: "insurer_policy",
    subject_id: input.policyId,
    decision: "allow",
    metadata: { from: row.status, to: input.toStatus, has_note: Boolean(input.note?.trim()) },
  });

  return { status: input.toStatus };
}

export async function createEnrolmentBatch(
  supabase: AuthedClient,
  userId: string,
  input: {
    tenantId: string;
    policyId: string;
    memberCount: number;
    acres: number;
  },
): Promise<{ id: string; reference: string }> {
  await requireManage(supabase, userId, input.tenantId, "insurer.enrolment.create");

  const { data: policy, error } = await supabase
    .from("insurer_policies")
    .select(POLICY_COLUMNS)
    .eq("id", input.policyId)
    .eq("insurer_tenant_id", input.tenantId)
    .single();
  if (error) throw new Error(error.message);
  const row = policy as unknown as PolicyRow;

  const gross = grossPremium(input.acres, row.sum_insured_per_acre_inr, row.actuarial_rate_pct);
  const split = splitPremium(gross, row);
  const batchReference = reference("ENR");

  const ins = await supabase
    .from("insurer_enrolment_batches")
    .insert({
      insurer_tenant_id: input.tenantId,
      policy_id: input.policyId,
      batch_reference: batchReference,
      registration_number: row.registration_number,
      fpo_name: row.fpo_name,
      state_name: row.state_name,
      district: row.district,
      crop: row.crop,
      season: row.season,
      state: "submitted",
      member_count: Math.max(0, Math.round(input.memberCount)),
      acres: Math.max(0, input.acres),
      premium_due_inr: split.grossInr,
      farmer_premium_inr: split.farmerInr,
      subsidy_premium_inr: split.centreInr + split.stateInr,
      submitted_at: new Date().toISOString(),
      created_by: userId,
    })
    .select("id")
    .single();
  if (ins.error) throw new Error(ins.error.message);

  await audit(supabase, {
    actor_user_id: userId,
    tenant_id: input.tenantId,
    action: "insurer.enrolment.create",
    subject_type: "insurer_enrolment_batch",
    subject_id: ins.data.id,
    decision: "allow",
    metadata: {
      batch_reference: batchReference,
      registration_number: row.registration_number,
      member_count: input.memberCount,
    },
  });

  return { id: ins.data.id, reference: batchReference };
}

export async function moveEnrolmentState(
  supabase: AuthedClient,
  userId: string,
  input: {
    tenantId: string;
    batchId: string;
    toState: EnrolmentState;
    note?: string | null;
  },
): Promise<{ state: EnrolmentState }> {
  await requireManage(supabase, userId, input.tenantId, "insurer.enrolment.state");

  const { data: batch, error } = await supabase
    .from("insurer_enrolment_batches")
    .select(BATCH_COLUMNS)
    .eq("id", input.batchId)
    .eq("insurer_tenant_id", input.tenantId)
    .single();
  if (error) throw new Error(error.message);
  const row = batch as unknown as EnrolmentBatchRow;

  if (!canMoveEnrolmentState(row.state, input.toState)) {
    throw new Error(`Cannot move enrolment batch from ${row.state} to ${input.toState}`);
  }
  if (requiresEnrolmentDecisionNote(input.toState) && !input.note?.trim()) {
    throw new Error("A decision note is required for this enrolment outcome");
  }

  const patch: {
    state: EnrolmentState;
    decision_note?: string;
    decided_by?: string;
    verified_at?: string;
    verification_note?: string | null;
  } = { state: input.toState };
  if (input.note?.trim()) {
    patch.decision_note = input.note.trim();
    patch.decided_by = userId;
  }
  if (input.toState === "verified") {
    patch.verified_at = new Date().toISOString();
    patch.verification_note = input.note?.trim() ?? null;
  }

  const upd = await supabase
    .from("insurer_enrolment_batches")
    .update(patch)
    .eq("id", input.batchId)
    .eq("insurer_tenant_id", input.tenantId);
  if (upd.error) throw new Error(upd.error.message);

  await audit(supabase, {
    actor_user_id: userId,
    tenant_id: input.tenantId,
    action: "insurer.enrolment.state",
    subject_type: "insurer_enrolment_batch",
    subject_id: input.batchId,
    decision: "allow",
    metadata: { from: row.state, to: input.toState, has_note: Boolean(input.note?.trim()) },
  });

  return { state: input.toState };
}

export async function recordRemittance(
  supabase: AuthedClient,
  userId: string,
  input: {
    tenantId: string;
    batchId: string;
    amountInr: number;
    method?: string;
    state?: RemittanceState;
    note?: string | null;
  },
): Promise<{ id: string; reference: string }> {
  await requireManage(supabase, userId, input.tenantId, "insurer.remittance.record");

  const remittanceReference = reference("RMT");
  const { data, error } = await supabase
    .from("insurer_premium_remittances")
    .insert({
      insurer_tenant_id: input.tenantId,
      batch_id: input.batchId,
      remittance_reference: remittanceReference,
      amount_inr: Math.max(0, Math.round(input.amountInr)),
      method: input.method ?? "neft",
      state: input.state ?? "received",
      received_at: new Date().toISOString(),
      reconciliation_note: input.note?.trim() ?? null,
      created_by: userId,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  await audit(supabase, {
    actor_user_id: userId,
    tenant_id: input.tenantId,
    action: "insurer.remittance.record",
    subject_type: "insurer_premium_remittance",
    subject_id: data.id,
    decision: "allow",
    metadata: { batch_id: input.batchId, amount_inr: input.amountInr },
  });

  return { id: data.id, reference: remittanceReference };
}

export async function reconcileRemittance(
  supabase: AuthedClient,
  userId: string,
  input: {
    tenantId: string;
    remittanceId: string;
    state: RemittanceState;
    note?: string | null;
  },
): Promise<{ state: RemittanceState }> {
  await requireManage(supabase, userId, input.tenantId, "insurer.remittance.reconcile");

  const upd = await supabase
    .from("insurer_premium_remittances")
    .update({
      state: input.state,
      reconciled_at: new Date().toISOString(),
      reconciliation_note: input.note?.trim() ?? null,
    })
    .eq("id", input.remittanceId)
    .eq("insurer_tenant_id", input.tenantId);
  if (upd.error) throw new Error(upd.error.message);

  await audit(supabase, {
    actor_user_id: userId,
    tenant_id: input.tenantId,
    action: "insurer.remittance.reconcile",
    subject_type: "insurer_premium_remittance",
    subject_id: input.remittanceId,
    decision: "allow",
    metadata: { state: input.state },
  });

  return { state: input.state };
}

/* --------------------------------------------------- FPO counterpart */

export interface FpoPolicyView {
  registrationNumbers: string[];
  policies: PolicyRow[];
  batches: EnrolmentBatchRow[];
  aggregateNote: string;
}

export async function loadFpoPolicies(
  supabase: AuthedClient,
  userId: string,
): Promise<FpoPolicyView> {
  const { data: memberships } = await supabase
    .from("tenant_members")
    .select("tenant_id")
    .eq("user_id", userId);
  const tenantIds = (memberships ?? []).map((m) => m.tenant_id);
  if (!tenantIds.length) {
    return { registrationNumbers: [], policies: [], batches: [], aggregateNote: POLICY_AGGREGATE_NOTE };
  }

  const { data: profiles } = await supabase
    .from("fpo_profiles")
    .select("registration_number")
    .in("tenant_id", tenantIds);
  const regs = [
    ...new Set(
      (profiles ?? []).map((p) => p.registration_number).filter(Boolean) as string[],
    ),
  ];
  if (!regs.length) {
    return { registrationNumbers: [], policies: [], batches: [], aggregateNote: POLICY_AGGREGATE_NOTE };
  }

  const [policies, batches] = await Promise.all([
    supabase.from("insurer_policies").select(POLICY_COLUMNS).in("registration_number", regs),
    supabase
      .from("insurer_enrolment_batches")
      .select(BATCH_COLUMNS_SHARED)
      .in("registration_number", regs),
  ]);
  if (policies.error) throw new Error(policies.error.message);
  if (batches.error) throw new Error(batches.error.message);

  return {
    registrationNumbers: regs,
    policies: (policies.data ?? []) as unknown as PolicyRow[],
    batches: (batches.data ?? []) as unknown as EnrolmentBatchRow[],
    aggregateNote: POLICY_AGGREGATE_NOTE,
  };
}
