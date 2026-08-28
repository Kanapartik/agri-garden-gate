/**
 * Server-only helpers for slice I3 (insurer claims intake & settlement).
 *
 * Authority rules, default-deny:
 *  - reads reuse the slice I1 insurer scope (insurer membership, or
 *    platform_admin / auditor oversight);
 *  - writes require tenant_admin of that insurer tenant, or platform_admin;
 *  - the FPO counterpart read is scoped to the caller's own FPO registration
 *    numbers and never returns insurer-internal notes or surveyor identity;
 *  - approval requires verified mandatory evidence AND a human decision note;
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
  blocksApproval,
  canMoveClaimStage,
  CLAIMS_AGGREGATE_NOTE,
  CLAIMS_HUMAN_DECISION_NOTE,
  requiresDecisionNote,
  type ClaimDocRow,
  type ClaimDocStatus,
  type ClaimEventRow,
  type ClaimPeril,
  type ClaimRow,
  type ClaimStage,
} from "@/lib/atap/insurerClaims";

export type AuthedClient = SupabaseClient<Database>;

const CLAIM_COLUMNS =
  "id, insurer_tenant_id, claim_reference, registration_number, fpo_name, state_name, district, crop, season, peril, stage, risk_cell_id, affected_members, reported_acres, assessed_loss_pct, claimed_amount_inr, approved_amount_inr, surveyor_name, internal_notes, decision_note, decided_at, reported_at, response_due_at";

/** Same shape minus insurer-internal columns, for the FPO counterpart read. */
const CLAIM_COLUMNS_SHARED =
  "id, insurer_tenant_id, claim_reference, registration_number, fpo_name, state_name, district, crop, season, peril, stage, affected_members, reported_acres, assessed_loss_pct, claimed_amount_inr, approved_amount_inr, decision_note, decided_at, reported_at, response_due_at";

const DOC_COLUMNS = "id, claim_id, doc_type, label, required, status, received_at";
const EVENT_COLUMNS = "id, claim_id, from_stage, to_stage, note, created_at";

/** Default configurable evidence checklist for a new claim. */
export const DEFAULT_EVIDENCE: Array<{ doc_type: string; label: string; required: boolean }> = [
  { doc_type: "intimation_form", label: "Loss intimation form", required: true },
  { doc_type: "sowing_certificate", label: "Sowing certificate", required: true },
  { doc_type: "survey_report", label: "Field survey report", required: true },
  { doc_type: "fpo_resolution", label: "FPO board resolution", required: false },
];

export interface ClaimsWorkspace {
  scope: InsurerScope;
  tenantOptions: InsurerTenantOption[];
  humanDecisionNote: string;
  aggregateNote: string;
  claims: ClaimRow[];
  channel: Array<{ registration_number: string; fpo_name: string; state_name: string | null; district: string | null }>;
}

export async function loadClaimsWorkspace(
  supabase: AuthedClient,
  userId: string,
  requestedTenantId?: string,
): Promise<ClaimsWorkspace> {
  const { scope, options } = await resolveInsurerScope(supabase, userId, requestedTenantId);

  const [claims, channel] = await Promise.all([
    supabase
      .from("insurer_claims")
      .select(CLAIM_COLUMNS)
      .eq("insurer_tenant_id", scope.tenantId)
      .order("reported_at", { ascending: false })
      .limit(1000),
    supabase
      .from("insurer_fpo_channel")
      .select("registration_number, fpo_name, state_name, district")
      .eq("insurer_tenant_id", scope.tenantId)
      .order("fpo_name")
      .limit(2000),
  ]);
  if (claims.error) throw new Error(claims.error.message);
  if (channel.error) throw new Error(channel.error.message);

  const rows = (claims.data ?? []) as unknown as ClaimRow[];
  const ids = rows.map((r) => r.id);

  let docs: ClaimDocRow[] = [];
  let events: ClaimEventRow[] = [];
  if (ids.length) {
    const [docRes, evtRes] = await Promise.all([
      supabase.from("insurer_claim_documents").select(DOC_COLUMNS).in("claim_id", ids),
      supabase
        .from("insurer_claim_events")
        .select(EVENT_COLUMNS)
        .in("claim_id", ids)
        .order("created_at", { ascending: true }),
    ]);
    if (docRes.error) throw new Error(docRes.error.message);
    if (evtRes.error) throw new Error(evtRes.error.message);
    docs = (docRes.data ?? []) as unknown as ClaimDocRow[];
    events = (evtRes.data ?? []) as unknown as ClaimEventRow[];
  }

  return {
    scope,
    tenantOptions: options,
    humanDecisionNote: CLAIMS_HUMAN_DECISION_NOTE,
    aggregateNote: CLAIMS_AGGREGATE_NOTE,
    claims: rows.map((c) => ({
      ...c,
      documents: docs.filter((d) => d.claim_id === c.id),
      events: events.filter((e) => e.claim_id === c.id),
    })),
    channel: (channel.data ?? []) as unknown as ClaimsWorkspace["channel"],
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
      subject_type: "insurer_claim",
      decision: "deny",
      metadata: { reason: "not_insurer_admin" },
    });
    throw new Error("Only an insurer administrator can work on claims");
  }
  return scope;
}

export async function createClaim(
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
    peril: ClaimPeril;
    affectedMembers?: number;
    reportedAcres?: number | null;
    claimedAmountInr?: number;
    responseDueDays?: number;
  },
): Promise<{ ok: true; claimId: string; reference: string }> {
  await requireManage(supabase, userId, input.tenantId, "insurer.claim.create");

  const { count } = await supabase
    .from("insurer_claims")
    .select("id", { count: "exact", head: true })
    .eq("insurer_tenant_id", input.tenantId);
  const reference = `CLM-2026-${String((count ?? 0) + 1).padStart(5, "0")}`;
  const dueDays = input.responseDueDays ?? 21;

  const { data, error } = await supabase
    .from("insurer_claims")
    .insert({
      insurer_tenant_id: input.tenantId,
      claim_reference: reference,
      registration_number: input.registrationNumber,
      fpo_name: input.fpoName,
      state_name: input.stateName ?? null,
      district: input.district ?? null,
      crop: input.crop ?? null,
      season: input.season ?? "Kharif 2026",
      peril: input.peril,
      stage: "reported",
      affected_members: input.affectedMembers ?? 0,
      reported_acres: input.reportedAcres ?? null,
      claimed_amount_inr: input.claimedAmountInr ?? 0,
      response_due_at: new Date(Date.now() + dueDays * 86_400_000).toISOString(),
      created_by: userId,
    } as never)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  const claimId = (data as unknown as { id: string }).id;

  await supabase.from("insurer_claim_documents").insert(
    DEFAULT_EVIDENCE.map((d) => ({
      claim_id: claimId,
      insurer_tenant_id: input.tenantId,
      doc_type: d.doc_type,
      label: d.label,
      required: d.required,
      status: "pending",
    })) as never,
  );
  await supabase.from("insurer_claim_events").insert({
    claim_id: claimId,
    insurer_tenant_id: input.tenantId,
    from_stage: null,
    to_stage: "reported",
    note: "Claim intimated.",
    actor_user_id: userId,
  } as never);

  await audit(supabase, {
    actor_user_id: userId,
    tenant_id: input.tenantId,
    action: "insurer.claim.create",
    subject_type: "insurer_claim",
    subject_id: claimId,
    decision: "allow",
    metadata: { reference, registration_number: input.registrationNumber, peril: input.peril },
  });
  return { ok: true, claimId, reference };
}

export async function moveClaimStage(
  supabase: AuthedClient,
  userId: string,
  input: {
    tenantId: string;
    claimId: string;
    toStage: ClaimStage;
    note?: string | null;
    approvedAmountInr?: number | null;
    assessedLossPct?: number | null;
  },
): Promise<{ ok: true; stage: ClaimStage }> {
  await requireManage(supabase, userId, input.tenantId, "insurer.claim.stage");

  const { data, error } = await supabase
    .from("insurer_claims")
    .select("id, stage")
    .eq("id", input.claimId)
    .eq("insurer_tenant_id", input.tenantId)
    .single();
  if (error || !data) throw new Error("Claim not found in your insurer workspace");
  const current = (data as unknown as { stage: ClaimStage }).stage;

  if (!canMoveClaimStage(current, input.toStage)) {
    await audit(supabase, {
      actor_user_id: userId,
      tenant_id: input.tenantId,
      action: "insurer.claim.stage",
      subject_type: "insurer_claim",
      subject_id: input.claimId,
      decision: "deny",
      metadata: { reason: "invalid_transition", from: current, to: input.toStage },
    });
    throw new Error(`A claim cannot move from ${current} to ${input.toStage}`);
  }

  if (requiresDecisionNote(input.toStage) && !(input.note ?? "").trim()) {
    throw new Error("A decision note is required for approve, reject and withdraw");
  }

  if (input.toStage === "approved") {
    const docs = await supabase
      .from("insurer_claim_documents")
      .select(DOC_COLUMNS)
      .eq("claim_id", input.claimId);
    if (docs.error) throw new Error(docs.error.message);
    if (blocksApproval("approved", (docs.data ?? []) as unknown as ClaimDocRow[])) {
      await audit(supabase, {
        actor_user_id: userId,
        tenant_id: input.tenantId,
        action: "insurer.claim.stage",
        subject_type: "insurer_claim",
        subject_id: input.claimId,
        decision: "deny",
        metadata: { reason: "evidence_incomplete", to: input.toStage },
      });
      throw new Error("Mandatory evidence must be verified before approval");
    }
  }

  const decisionStage =
    input.toStage === "approved" || input.toStage === "rejected" || input.toStage === "withdrawn";

  const patch: Record<string, unknown> = { stage: input.toStage };
  if (input.note != null) patch["decision_note"] = input.note;
  if (input.approvedAmountInr != null) patch["approved_amount_inr"] = input.approvedAmountInr;
  if (input.assessedLossPct != null) patch["assessed_loss_pct"] = input.assessedLossPct;
  if (decisionStage) {
    patch["decided_by"] = userId;
    patch["decided_at"] = new Date().toISOString();
  }

  const upd = await supabase
    .from("insurer_claims")
    .update(patch as never)
    .eq("id", input.claimId)
    .eq("insurer_tenant_id", input.tenantId);
  if (upd.error) throw new Error(upd.error.message);

  await supabase.from("insurer_claim_events").insert({
    claim_id: input.claimId,
    insurer_tenant_id: input.tenantId,
    from_stage: current,
    to_stage: input.toStage,
    note: input.note ?? null,
    actor_user_id: userId,
  } as never);

  await audit(supabase, {
    actor_user_id: userId,
    tenant_id: input.tenantId,
    action: "insurer.claim.stage",
    subject_type: "insurer_claim",
    subject_id: input.claimId,
    decision: "allow",
    metadata: { from: current, to: input.toStage, human_decision: decisionStage },
  });
  return { ok: true, stage: input.toStage };
}

export async function setClaimDocStatus(
  supabase: AuthedClient,
  userId: string,
  input: { tenantId: string; claimId: string; documentId: string; status: ClaimDocStatus },
): Promise<{ ok: true; status: ClaimDocStatus }> {
  await requireManage(supabase, userId, input.tenantId, "insurer.claim.document");

  const patch =
    input.status === "pending"
      ? { status: input.status, received_at: null }
      : { status: input.status, received_at: new Date().toISOString() };

  const { error } = await supabase
    .from("insurer_claim_documents")
    .update(patch as never)
    .eq("id", input.documentId)
    .eq("claim_id", input.claimId)
    .eq("insurer_tenant_id", input.tenantId);
  if (error) throw new Error(error.message);

  await audit(supabase, {
    actor_user_id: userId,
    tenant_id: input.tenantId,
    action: "insurer.claim.document",
    subject_type: "insurer_claim_document",
    subject_id: input.documentId,
    decision: "allow",
    metadata: { claim_id: input.claimId, status: input.status },
  });
  return { ok: true, status: input.status };
}

export async function updateClaimDetails(
  supabase: AuthedClient,
  userId: string,
  input: {
    tenantId: string;
    claimId: string;
    surveyorName?: string | null;
    internalNotes?: string | null;
    assessedLossPct?: number | null;
    approvedAmountInr?: number | null;
    responseDueAt?: string | null;
  },
): Promise<{ ok: true }> {
  await requireManage(supabase, userId, input.tenantId, "insurer.claim.update");

  const patch: Record<string, unknown> = {};
  if (input.surveyorName !== undefined) patch["surveyor_name"] = input.surveyorName;
  if (input.internalNotes !== undefined) patch["internal_notes"] = input.internalNotes;
  if (input.assessedLossPct !== undefined) patch["assessed_loss_pct"] = input.assessedLossPct;
  if (input.approvedAmountInr !== undefined) patch["approved_amount_inr"] = input.approvedAmountInr;
  if (input.responseDueAt !== undefined) patch["response_due_at"] = input.responseDueAt;

  if (Object.keys(patch).length === 0) return { ok: true };

  const { error } = await supabase
    .from("insurer_claims")
    .update(patch as never)
    .eq("id", input.claimId)
    .eq("insurer_tenant_id", input.tenantId);
  if (error) throw new Error(error.message);

  await audit(supabase, {
    actor_user_id: userId,
    tenant_id: input.tenantId,
    action: "insurer.claim.update",
    subject_type: "insurer_claim",
    subject_id: input.claimId,
    decision: "allow",
    metadata: { fields: Object.keys(patch) },
  });
  return { ok: true };
}

/* ------------------------------------------------------- FPO counterpart */

/**
 * Read the claims raised for the caller's own FPO tenant(s). Insurer-internal
 * notes and surveyor identity are excluded by column selection, not by UI.
 */
export async function loadFpoClaims(
  supabase: AuthedClient,
  userId: string,
): Promise<{ claims: ClaimRow[]; humanDecisionNote: string }> {
  const { data: members } = await supabase
    .from("tenant_members")
    .select("tenant_id")
    .eq("user_id", userId);
  const tenantIds = ((members ?? []) as Array<{ tenant_id: string }>).map((m) => m.tenant_id);
  if (!tenantIds.length) return { claims: [], humanDecisionNote: CLAIMS_HUMAN_DECISION_NOTE };

  const { data: profiles } = await supabase
    .from("fpo_profiles")
    .select("registration_number")
    .in("tenant_id", tenantIds);
  const regs = ((profiles ?? []) as Array<{ registration_number: string | null }>)
    .map((p) => p.registration_number)
    .filter((r): r is string => Boolean(r));
  if (!regs.length) return { claims: [], humanDecisionNote: CLAIMS_HUMAN_DECISION_NOTE };

  const { data, error } = await supabase
    .from("insurer_claims")
    .select(CLAIM_COLUMNS_SHARED)
    .in("registration_number", regs)
    .order("reported_at", { ascending: false })
    .limit(500);
  if (error) throw new Error(error.message);

  return {
    claims: (data ?? []) as unknown as ClaimRow[],
    humanDecisionNote: CLAIMS_HUMAN_DECISION_NOTE,
  };
}
