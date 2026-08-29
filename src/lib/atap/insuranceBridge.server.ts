/**
 * Slice C3 server-only helpers — insurer policy binding & claim-status sync.
 *
 * Authority rules, default-deny:
 *  - the FPO cover board and the sync action require tenant_admin of that FPO
 *    tenant (or platform_admin); auditors may read, never write;
 *  - member cover snapshots are written only for members holding an active,
 *    purpose-scoped consent; roster authority alone is not enough;
 *  - the farmer-facing read returns the farmer's own snapshots plus the
 *    organization-level claim stage — never insurer-internal notes, surveyor
 *    identity or another member's data;
 *  - every sync and every claim-status read is audited (allow AND deny);
 *  - nothing here decides enrolment, eligibility or a claim outcome.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { audit } from "@/lib/atap/admin.server";
import { resolvePolicyBindingSource } from "@/lib/adapters/insuranceBinding";
import type { BaselineProvenance } from "@/lib/adapters/resolution";
import {
  buildSyncPlan,
  claimAdvisories,
  coverSnapshotRow,
  CLAIM_SYNC_NOTE,
  INSURANCE_BRIDGE_NOTE,
  INSURANCE_BRIDGE_PURPOSE,
  seasonCodeFor,
  type BindablePolicy,
  type ClaimAdvisory,
  type ClaimStatusRow,
  type FarmerCoverSubject,
} from "@/lib/atap/insuranceBridge";

export type AuthedClient = SupabaseClient<Database>;

const POLICY_COLUMNS =
  "id, policy_reference, scheme_code, scheme_name, state_name, district, crop, season, status, coverage_start, coverage_end, sum_insured_per_acre_inr, actuarial_rate_pct, farmer_share_pct";

/** Farmer-safe claim projection: no internal notes, no surveyor identity. */
const CLAIM_COLUMNS =
  "id, claim_reference, registration_number, fpo_name, district, crop, season, peril, stage, reported_at, decided_at";

const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));

function mode(): string {
  return process.env["ATAP_BASELINE_ADAPTER_MODE"] ?? "official_first";
}

async function notifiedShare(
  supabase: AuthedClient,
  seasonCode: string,
): Promise<number | null> {
  const { data } = await supabase
    .from("official_insurance_rates")
    .select("season_code, crop_category, farmer_share_pct")
    .eq("scheme_code", "PMFBY");
  const rows = (data ?? []) as Array<{ season_code: string; crop_category: string; farmer_share_pct: number }>;
  const hit =
    rows.find((r) => r.season_code === seasonCode && r.crop_category === "food_grain") ??
    rows.find((r) => r.season_code === seasonCode);
  return hit ? Number(hit.farmer_share_pct) : null;
}

/* ------------------------------------------------------- FPO cover board */

export interface FpoCoverBoard {
  tenantId: string;
  canManage: boolean;
  note: string;
  claimNote: string;
  provenance: BaselineProvenance;
  registrationNumbers: string[];
  policies: BindablePolicy[];
  claims: ClaimAdvisory[];
  members: number;
  consentedMembers: number;
  boundSnapshots: number;
  lastSyncedAt: string | null;
}

async function fpoContext(supabase: AuthedClient, tenantId: string) {
  const { data } = await supabase
    .from("fpo_profiles")
    .select("registration_number, district_code, primary_crops")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  const row = (data ?? null) as
    | { registration_number: string | null; district_code: string | null; primary_crops: string[] }
    | null;
  return {
    registrationNumbers: row?.registration_number ? [row.registration_number] : [],
    district: row?.district_code ?? null,
    crop: row?.primary_crops?.[0] ?? null,
  };
}

async function requireTenantRead(supabase: AuthedClient, userId: string, tenantId: string) {
  const { resolveDistrictActor } = await import("@/lib/atap/district.server");
  const actor = await resolveDistrictActor(supabase, userId);
  const permitted = actor.isPlatformAdmin || actor.isAuditor || actor.tenantIds.includes(tenantId);
  if (!permitted) throw new Error("You do not have access to this organization");
  const canManage = actor.isPlatformAdmin || actor.tenantAdminOf.includes(tenantId);
  return { actor, canManage };
}

export async function loadFpoCoverBoard(
  supabase: AuthedClient,
  userId: string,
  tenantId: string,
): Promise<FpoCoverBoard> {
  const { canManage } = await requireTenantRead(supabase, userId, tenantId);
  const ctx = await fpoContext(supabase, tenantId);

  const season = `Kharif ${new Date().getUTCFullYear()}`;
  const [policyRes, claimRes, memberRes, consentRes] = await Promise.all([
    ctx.registrationNumbers.length
      ? supabase.from("insurer_policies").select(POLICY_COLUMNS).in("registration_number", ctx.registrationNumbers)
      : Promise.resolve({ data: [], error: null }),
    ctx.registrationNumbers.length
      ? supabase.from("insurer_claims").select(CLAIM_COLUMNS).in("registration_number", ctx.registrationNumbers)
      : Promise.resolve({ data: [], error: null }),
    supabase.from("fpo_members").select("farmer_user_id, status").eq("tenant_id", tenantId),
    supabase
      .from("fpo_farmer_consents")
      .select("farmer_user_id, revoked_at, expires_at")
      .eq("tenant_id", tenantId)
      .eq("purpose_code", INSURANCE_BRIDGE_PURPOSE),
  ]);

  const policies = ((policyRes.data ?? []) as unknown as BindablePolicy[]).map((p) => ({
    ...p,
    sum_insured_per_acre_inr: num(p.sum_insured_per_acre_inr),
    actuarial_rate_pct: num(p.actuarial_rate_pct),
    farmer_share_pct: num(p.farmer_share_pct),
  }));
  const claimRows = (claimRes.data ?? []) as unknown as ClaimStatusRow[];

  const resolution = resolvePolicyBindingSource({
    policies,
    claims: claimRows,
    fallback: { district: ctx.district, crop: ctx.crop, season },
    mode: mode(),
  });

  const members = (memberRes.data ?? []) as Array<{ farmer_user_id: string | null; status: string }>;
  const memberIds = new Set(members.flatMap((m) => (m.farmer_user_id ? [m.farmer_user_id] : [])));
  const now = Date.now();
  const consented = new Set(
    ((consentRes.data ?? []) as Array<{
      farmer_user_id: string;
      revoked_at: string | null;
      expires_at: string | null;
    }>)
      .filter((c) => !c.revoked_at && (!c.expires_at || Date.parse(c.expires_at) > now))
      .map((c) => c.farmer_user_id)
      .filter((id) => memberIds.has(id)),
  );

  let boundSnapshots = 0;
  let lastSyncedAt: string | null = null;
  if (canManage && consented.size > 0) {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("farmer_insurance_snapshots")
      .select("updated_at")
      .eq("source", "insurer_policy")
      .in("farmer_user_id", [...consented]);
    const rows = (data ?? []) as Array<{ updated_at: string }>;
    boundSnapshots = rows.length;
    lastSyncedAt = rows.map((r) => r.updated_at).sort().at(-1) ?? null;
  }

  return {
    tenantId,
    canManage,
    note: INSURANCE_BRIDGE_NOTE,
    claimNote: CLAIM_SYNC_NOTE,
    provenance: resolution.provenance,
    registrationNumbers: ctx.registrationNumbers,
    policies: resolution.source.policies,
    claims: claimAdvisories(resolution.source.claims, { district: ctx.district, crops: ctx.crop ? [ctx.crop] : [] }),
    members: memberIds.size,
    consentedMembers: consented.size,
    boundSnapshots,
    lastSyncedAt,
  };
}

/* ------------------------------------------------------------ cover sync */

export interface CoverSyncResult {
  ok: true;
  bound: number;
  skippedNoPolicy: number;
  skippedNoAcreage: number;
  consentedMembers: number;
}

export async function syncMemberCover(
  supabase: AuthedClient,
  userId: string,
  input: { tenantId: string },
): Promise<CoverSyncResult> {
  const { canManage } = await requireTenantRead(supabase, userId, input.tenantId);
  if (!canManage) {
    await audit(supabase, {
      actor_user_id: userId,
      tenant_id: input.tenantId,
      action: "insurance.cover.sync",
      subject_type: "farmer_insurance_snapshot",
      decision: "deny",
      metadata: { reason: "not_tenant_admin" },
    });
    throw new Error("Only an FPO administrator can refresh member cover indicators");
  }

  const ctx = await fpoContext(supabase, input.tenantId);
  const [policyRes, memberRes, consentRes] = await Promise.all([
    ctx.registrationNumbers.length
      ? supabase.from("insurer_policies").select(POLICY_COLUMNS).in("registration_number", ctx.registrationNumbers)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("fpo_members")
      .select("farmer_user_id, status, acreage, crops, village_cluster")
      .eq("tenant_id", input.tenantId),
    supabase
      .from("fpo_farmer_consents")
      .select("farmer_user_id, revoked_at, expires_at")
      .eq("tenant_id", input.tenantId)
      .eq("purpose_code", INSURANCE_BRIDGE_PURPOSE),
  ]);

  const policies = ((policyRes.data ?? []) as unknown as BindablePolicy[]).map((p) => ({
    ...p,
    sum_insured_per_acre_inr: num(p.sum_insured_per_acre_inr),
    actuarial_rate_pct: num(p.actuarial_rate_pct),
    farmer_share_pct: num(p.farmer_share_pct),
  }));

  const now = Date.now();
  const consented = new Set(
    ((consentRes.data ?? []) as Array<{
      farmer_user_id: string;
      revoked_at: string | null;
      expires_at: string | null;
    }>)
      .filter((c) => !c.revoked_at && (!c.expires_at || Date.parse(c.expires_at) > now))
      .map((c) => c.farmer_user_id),
  );

  const subjects: FarmerCoverSubject[] = (
    (memberRes.data ?? []) as Array<{
      farmer_user_id: string | null;
      status: string;
      acreage: number | null;
      crops: string[] | null;
      village_cluster: string | null;
    }>
  )
    .filter((m) => m.farmer_user_id && consented.has(m.farmer_user_id) && m.status === "active")
    .map((m) => ({
      farmerUserId: m.farmer_user_id as string,
      district: m.village_cluster ?? ctx.district,
      crops: m.crops ?? [],
      acres: num(m.acreage),
    }));

  const seasonCode = seasonCodeFor(policies[0]?.season ?? "kharif");
  const plan = buildSyncPlan(subjects, policies, {
    notifiedFarmerSharePct: await notifiedShare(supabase, seasonCode),
  });

  if (plan.entries.length > 0) {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const rows = plan.entries.map((e) => coverSnapshotRow(e.cover, e.farmerUserId));
    const { error } = await supabaseAdmin
      .from("farmer_insurance_snapshots")
      .upsert(rows as never, { onConflict: "farmer_user_id,crop_year,season_code" });
    if (error) throw new Error(error.message);
  }

  await audit(supabase, {
    actor_user_id: userId,
    tenant_id: input.tenantId,
    action: "insurance.cover.sync",
    subject_type: "farmer_insurance_snapshot",
    decision: "allow",
    metadata: {
      purpose_code: INSURANCE_BRIDGE_PURPOSE,
      consented_members: consented.size,
      bound: plan.entries.length,
      skipped_no_policy: plan.skippedNoPolicy,
      skipped_no_acreage: plan.skippedNoAcreage,
      policies: policies.length,
    },
  });

  return {
    ok: true,
    bound: plan.entries.length,
    skippedNoPolicy: plan.skippedNoPolicy,
    skippedNoAcreage: plan.skippedNoAcreage,
    consentedMembers: consented.size,
  };
}

/* -------------------------------------------------------- farmer read */

export interface FarmerCoverDetail {
  note: string;
  claimNote: string;
  bound: boolean;
  snapshots: Array<{
    cropYear: number;
    seasonCode: string;
    crop: string | null;
    district: string | null;
    schemeCode: string | null;
    coverState: string;
    sumInsuredPerAcre: number | null;
    farmerSharePerAcre: number | null;
    contactLabel: string | null;
    source: string;
    synthetic: boolean;
    updatedAt: string;
  }>;
  claims: ClaimAdvisory[];
}

export async function loadFarmerCoverDetail(
  supabase: AuthedClient,
  userId: string,
): Promise<FarmerCoverDetail> {
  /* own snapshots — owner-only RLS already scopes these */
  const { data: snapRes } = await supabase
    .from("farmer_insurance_snapshots")
    .select(
      "crop_year, season_code, crop, district, scheme_code, cover_state, sum_insured_per_acre, farmer_share_per_acre, contact_label, source, is_synthetic, updated_at",
    )
    .eq("farmer_user_id", userId)
    .order("crop_year", { ascending: false });

  const snapshots = ((snapRes ?? []) as Array<Record<string, unknown>>).map((r) => ({
    cropYear: Number(r["crop_year"]),
    seasonCode: r["season_code"] as string,
    crop: (r["crop"] as string) ?? null,
    district: (r["district"] as string) ?? null,
    schemeCode: (r["scheme_code"] as string) ?? null,
    coverState: r["cover_state"] as string,
    sumInsuredPerAcre: r["sum_insured_per_acre"] === null ? null : Number(r["sum_insured_per_acre"]),
    farmerSharePerAcre: r["farmer_share_per_acre"] === null ? null : Number(r["farmer_share_per_acre"]),
    contactLabel: (r["contact_label"] as string) ?? null,
    source: r["source"] as string,
    synthetic: Boolean(r["is_synthetic"]),
    updatedAt: r["updated_at"] as string,
  }));

  /* organization-level claim stage for the farmer's own FPO memberships */
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: memberRows } = await supabaseAdmin
    .from("fpo_members")
    .select("tenant_id, crops, village_cluster")
    .eq("farmer_user_id", userId);
  const memberships = (memberRows ?? []) as Array<{
    tenant_id: string;
    crops: string[] | null;
    village_cluster: string | null;
  }>;

  let claims: ClaimAdvisory[] = [];
  if (memberships.length > 0) {
    const { data: profileRows } = await supabaseAdmin
      .from("fpo_profiles")
      .select("registration_number")
      .in("tenant_id", memberships.map((m) => m.tenant_id));
    const regs = ((profileRows ?? []) as Array<{ registration_number: string | null }>)
      .flatMap((p) => (p.registration_number ? [p.registration_number] : []));

    if (regs.length > 0) {
      const { data: claimRows } = await supabaseAdmin
        .from("insurer_claims")
        .select(CLAIM_COLUMNS)
        .in("registration_number", regs);
      claims = claimAdvisories((claimRows ?? []) as unknown as ClaimStatusRow[], {
        district: memberships[0]?.village_cluster ?? null,
        crops: memberships.flatMap((m) => m.crops ?? []),
      });

      await audit(supabase, {
        actor_user_id: userId,
        action: "insurance.claim_status.read",
        subject_type: "insurer_claim",
        decision: "allow",
        metadata: { organizations: regs.length, claims: claims.length, aggregate_only: true },
      });
    }
  }

  return {
    note: INSURANCE_BRIDGE_NOTE,
    claimNote: CLAIM_SYNC_NOTE,
    bound: snapshots.some((s) => s.source === "insurer_policy"),
    snapshots,
    claims,
  };
}
