/**
 * Server-only helpers for slice I1 (insurer revenue intelligence).
 *
 * Authority rules, default-deny:
 *  - insurer workspace reads require membership of that insurer tenant, or
 *    platform_admin / auditor oversight;
 *  - writes require tenant_admin of that insurer tenant, or platform_admin;
 *  - the FPO counterpart read is scoped to the caller's own FPO tenant and
 *    never returns insurer-internal notes;
 *  - every write is audited (allow AND deny).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import type { AppRole } from "@/lib/atap/policy";
import { audit } from "@/lib/atap/admin.server";
import { resolveDistrictActor } from "@/lib/atap/district.server";
import {
  AGGREGATE_ONLY_NOTE,
  INSURER_ADVISORY,
  canMoveStage,
  marketOpportunity,
  opportunityScore,
  penetrationPct,
  scoreDrivers,
  type CampaignRow,
  type CampaignState,
  type ChannelRow,
  type FunnelRow,
  type FunnelStage,
  type MarketOpportunity,
  type ScoreDriver,
} from "@/lib/atap/insurerRevenue";

export type AuthedClient = SupabaseClient<Database>;

const CHANNEL_COLUMNS =
  "id, insurer_tenant_id, registration_number, fpo_name, state_name, district, block_mandal, commodity_group, primary_commodity, member_count, cultivated_acres, insured_members, policies_count, premium_inr, potential_premium_inr, accessibility, owner_name, opportunity_score, score_drivers, internal_notes, last_reviewed";

/** Same row shape without insurer-internal columns, for the FPO counterpart. */
const CHANNEL_COLUMNS_SHARED =
  "id, insurer_tenant_id, registration_number, fpo_name, state_name, district, commodity_group, primary_commodity, member_count, insured_members, policies_count, potential_premium_inr, opportunity_score, last_reviewed";

export interface InsurerScope {
  tenantId: string;
  tenantName: string;
  roles: AppRole[];
  canManage: boolean;
  oversightOnly: boolean;
}

export interface InsurerTenantOption {
  id: string;
  name: string;
}

async function insurerTenants(supabase: AuthedClient): Promise<InsurerTenantOption[]> {
  const { data } = await supabase
    .from("tenants")
    .select("id, name")
    .eq("tenant_type", "insurer")
    .order("name");
  return (data ?? []) as InsurerTenantOption[];
}

/** Resolve which insurer tenant this caller may act on, and with what power. */
export async function resolveInsurerScope(
  supabase: AuthedClient,
  userId: string,
  requestedTenantId?: string,
): Promise<{ scope: InsurerScope; options: InsurerTenantOption[] }> {
  const actor = await resolveDistrictActor(supabase, userId);
  const options = await insurerTenants(supabase);
  const oversight = actor.isPlatformAdmin || actor.isAuditor;

  const memberOf = options.filter((t) => actor.tenantIds.includes(t.id));
  const pool = oversight ? options : memberOf;
  const chosen =
    (requestedTenantId ? pool.find((t) => t.id === requestedTenantId) : undefined) ?? pool[0];

  if (!chosen) throw new Error("You do not have access to an insurer workspace");

  const roles = actor.tenantRoles
    .filter((r) => r.tenant_id === chosen.id)
    .map((r) => r.role) as AppRole[];

  return {
    scope: {
      tenantId: chosen.id,
      tenantName: chosen.name,
      roles,
      canManage: actor.isPlatformAdmin || roles.includes("tenant_admin"),
      oversightOnly: !memberOf.some((t) => t.id === chosen.id) && oversight,
    },
    options: pool,
  };
}

function toDrivers(value: Json | null): ScoreDriver[] {
  return Array.isArray(value) ? (value as unknown as ScoreDriver[]) : [];
}

function mapChannel(row: Record<string, unknown>): ChannelRow {
  return {
    ...(row as unknown as ChannelRow),
    score_drivers: toDrivers((row as { score_drivers?: Json }).score_drivers ?? null),
  };
}

/* --------------------------------------------------------------- reads */

export interface InsurerWorkspace {
  scope: InsurerScope;
  tenantOptions: InsurerTenantOption[];
  advisory: string;
  aggregateNote: string;
  market: MarketOpportunity[];
  channel: ChannelRow[];
  funnel: FunnelRow[];
  campaigns: CampaignRow[];
}

export async function loadWorkspace(
  supabase: AuthedClient,
  userId: string,
  requestedTenantId?: string,
): Promise<InsurerWorkspace> {
  const { scope, options } = await resolveInsurerScope(supabase, userId, requestedTenantId);

  const [cells, channel, funnel, campaigns, targets] = await Promise.all([
    supabase
      .from("insurer_market_cells")
      .select(
        "state_name, district, crop, potential_farmers, cultivated_acres, insured_farmers, insured_acres, premium_per_acre, source, last_verified",
      ),
    supabase
      .from("insurer_fpo_channel")
      .select(CHANNEL_COLUMNS)
      .eq("insurer_tenant_id", scope.tenantId)
      .order("opportunity_score", { ascending: false })
      .limit(2000),
    supabase
      .from("insurer_funnel_entries")
      .select(
        "id, registration_number, fpo_name, state_name, district, stage, farmer_count, acres, premium_opportunity_inr, owner_name, notes",
      )
      .eq("insurer_tenant_id", scope.tenantId)
      .limit(2000),
    supabase
      .from("insurer_campaigns")
      .select(
        "id, name, season, state_name, district, commodity, target_farmers, target_acres, premium_opportunity_inr, owner_name, state, starts_on, ends_on, notes",
      )
      .eq("insurer_tenant_id", scope.tenantId)
      .order("created_at", { ascending: false }),
    supabase
      .from("insurer_campaign_targets")
      .select("campaign_id, registration_number, fpo_name, target_farmers"),
  ]);

  const failure = cells.error ?? channel.error ?? funnel.error ?? campaigns.error ?? targets.error;
  if (failure) throw new Error(failure.message);

  const targetRows = (targets.data ?? []) as Array<{
    campaign_id: string;
    registration_number: string;
    fpo_name: string;
    target_farmers: number;
  }>;

  return {
    scope,
    tenantOptions: options,
    advisory: INSURER_ADVISORY,
    aggregateNote: AGGREGATE_ONLY_NOTE,
    market: (cells.data ?? []).map((c) => marketOpportunity(c as never)),
    channel: ((channel.data ?? []) as Array<Record<string, unknown>>).map(mapChannel),
    funnel: (funnel.data ?? []) as unknown as FunnelRow[],
    campaigns: ((campaigns.data ?? []) as unknown as CampaignRow[]).map((c) => ({
      ...c,
      targets: targetRows.filter((t) => t.campaign_id === c.id),
    })),
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
      subject_type: "insurer_sales",
      decision: "deny",
      metadata: { reason: "not_insurer_admin" },
    });
    throw new Error("Only an insurer administrator can change the sales pipeline");
  }
  return scope;
}

export async function moveStage(
  supabase: AuthedClient,
  userId: string,
  input: { tenantId: string; entryId: string; to: FunnelStage; notes?: string },
): Promise<{ ok: true; stage: FunnelStage }> {
  await requireManage(supabase, userId, input.tenantId, "insurer.funnel.stage_change");

  const { data: current, error } = await supabase
    .from("insurer_funnel_entries")
    .select("id, stage, registration_number")
    .eq("id", input.entryId)
    .eq("insurer_tenant_id", input.tenantId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!current) throw new Error("Pipeline entry not found");

  const from = (current as { stage: FunnelStage }).stage;
  if (!canMoveStage(from, input.to)) {
    await audit(supabase, {
      actor_user_id: userId,
      tenant_id: input.tenantId,
      action: "insurer.funnel.stage_change",
      subject_type: "insurer_funnel_entry",
      subject_id: input.entryId,
      decision: "deny",
      metadata: { from, to: input.to, reason: "stage_not_adjacent" },
    });
    throw new Error(`Cannot move directly from ${from} to ${input.to}`);
  }

  const { error: upErr } = await supabase
    .from("insurer_funnel_entries")
    .update({ stage: input.to, ...(input.notes ? { notes: input.notes } : {}) } as never)
    .eq("id", input.entryId)
    .eq("insurer_tenant_id", input.tenantId);
  if (upErr) throw new Error(upErr.message);

  await audit(supabase, {
    actor_user_id: userId,
    tenant_id: input.tenantId,
    action: "insurer.funnel.stage_change",
    subject_type: "insurer_funnel_entry",
    subject_id: input.entryId,
    decision: "allow",
    metadata: { from, to: input.to },
  });
  return { ok: true, stage: input.to };
}

export async function updateChannelRow(
  supabase: AuthedClient,
  userId: string,
  input: {
    tenantId: string;
    channelId: string;
    ownerName?: string | null;
    accessibility?: string | null;
    internalNotes?: string | null;
  },
): Promise<{ ok: true }> {
  await requireManage(supabase, userId, input.tenantId, "insurer.channel.update");

  const patch: Record<string, unknown> = { last_reviewed: new Date().toISOString().slice(0, 10) };
  if (input.ownerName !== undefined) patch["owner_name"] = input.ownerName;
  if (input.accessibility !== undefined) patch["accessibility"] = input.accessibility;
  if (input.internalNotes !== undefined) patch["internal_notes"] = input.internalNotes;

  const { error } = await supabase
    .from("insurer_fpo_channel")
    .update(patch as never)
    .eq("id", input.channelId)
    .eq("insurer_tenant_id", input.tenantId);
  if (error) throw new Error(error.message);

  await audit(supabase, {
    actor_user_id: userId,
    tenant_id: input.tenantId,
    action: "insurer.channel.update",
    subject_type: "insurer_fpo_channel",
    subject_id: input.channelId,
    decision: "allow",
    metadata: { fields: Object.keys(patch) },
  });
  return { ok: true };
}

/**
 * Recompute the advisory opportunity score from stored aggregates. The formula
 * lives in the pure module so the drivers shown in the UI are exactly the ones
 * persisted here.
 */
export async function recomputeScores(
  supabase: AuthedClient,
  userId: string,
  input: { tenantId: string },
): Promise<{ ok: true; updated: number }> {
  await requireManage(supabase, userId, input.tenantId, "insurer.channel.recompute_score");

  const { data, error } = await supabase
    .from("insurer_fpo_channel")
    .select(
      "id, member_count, cultivated_acres, insured_members, potential_premium_inr, commodity_group, primary_commodity, accessibility",
    )
    .eq("insurer_tenant_id", input.tenantId)
    .limit(2000);
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as Array<{ id: string } & Parameters<typeof opportunityScore>[0]>;
  for (const row of rows) {
    const drivers = scoreDrivers(row);
    const { error: upErr } = await supabase
      .from("insurer_fpo_channel")
      .update({
        opportunity_score: opportunityScore(row),
        score_drivers: drivers as unknown as Json,
      } as never)
      .eq("id", row.id);
    if (upErr) throw new Error(upErr.message);
  }

  await audit(supabase, {
    actor_user_id: userId,
    tenant_id: input.tenantId,
    action: "insurer.channel.recompute_score",
    subject_type: "insurer_fpo_channel",
    decision: "allow",
    metadata: { updated: rows.length, basis: "advisory_prioritisation" },
  });
  return { ok: true, updated: rows.length };
}

export async function saveCampaign(
  supabase: AuthedClient,
  userId: string,
  input: {
    tenantId: string;
    campaignId?: string;
    name: string;
    season?: string | null;
    stateName?: string | null;
    district?: string | null;
    commodity?: string | null;
    ownerName?: string | null;
    state?: CampaignState;
    notes?: string | null;
    registrationNumbers?: string[];
  },
): Promise<{ ok: true; campaignId: string }> {
  await requireManage(supabase, userId, input.tenantId, "insurer.campaign.save");
  if (!input.name.trim()) throw new Error("Campaign needs a name");

  const regs = input.registrationNumbers ?? [];
  let targetRows: Array<{
    registration_number: string;
    fpo_name: string;
    registry_id: string | null;
    target_farmers: number;
    premium_opportunity_inr: number;
  }> = [];

  if (regs.length) {
    const { data, error } = await supabase
      .from("insurer_fpo_channel")
      .select(
        "registration_number, fpo_name, registry_id, member_count, insured_members, cultivated_acres, potential_premium_inr",
      )
      .eq("insurer_tenant_id", input.tenantId)
      .in("registration_number", regs.slice(0, 200));
    if (error) throw new Error(error.message);
    targetRows = ((data ?? []) as Array<{
      registration_number: string;
      fpo_name: string;
      registry_id: string | null;
      member_count: number | null;
      insured_members: number;
      potential_premium_inr: number;
    }>).map((r) => ({
      registration_number: r.registration_number,
      fpo_name: r.fpo_name,
      registry_id: r.registry_id,
      target_farmers: Math.max((r.member_count ?? 0) - r.insured_members, 0),
      premium_opportunity_inr: r.potential_premium_inr,
    }));
  }

  const header = {
    insurer_tenant_id: input.tenantId,
    name: input.name.trim(),
    season: input.season ?? null,
    state_name: input.stateName ?? null,
    district: input.district ?? null,
    commodity: input.commodity ?? null,
    owner_name: input.ownerName ?? null,
    state: input.state ?? "draft",
    notes: input.notes ?? null,
    target_farmers: targetRows.reduce((a, r) => a + r.target_farmers, 0),
    target_acres: 0,
    premium_opportunity_inr: targetRows.reduce((a, r) => a + r.premium_opportunity_inr, 0),
    created_by: userId,
  };

  let campaignId = input.campaignId ?? "";
  if (campaignId) {
    const { error } = await supabase
      .from("insurer_campaigns")
      .update(header as never)
      .eq("id", campaignId)
      .eq("insurer_tenant_id", input.tenantId);
    if (error) throw new Error(error.message);
    await supabase.from("insurer_campaign_targets").delete().eq("campaign_id", campaignId);
  } else {
    const { data, error } = await supabase
      .from("insurer_campaigns")
      .insert(header as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    campaignId = (data as { id: string }).id;
  }

  if (targetRows.length) {
    const { error } = await supabase
      .from("insurer_campaign_targets")
      .insert(targetRows.map((r) => ({ ...r, campaign_id: campaignId })) as never);
    if (error) throw new Error(error.message);
  }

  await audit(supabase, {
    actor_user_id: userId,
    tenant_id: input.tenantId,
    action: "insurer.campaign.save",
    subject_type: "insurer_campaign",
    subject_id: campaignId,
    decision: "allow",
    metadata: { targets: targetRows.length, state: header.state },
  });
  return { ok: true, campaignId };
}

/* ------------------------------------------------- FPO counterpart view */

export interface FpoInsurerView {
  fpoTenantId: string;
  registrationNumber: string | null;
  fpoName: string | null;
  memberCount: number | null;
  insuredMembers: number;
  penetration: number;
  potentialPremiumInr: number;
  interestedInsurers: Array<{
    insurerName: string;
    insuredMembers: number;
    policiesCount: number;
    opportunityScore: number;
    stage: FunnelStage | null;
    lastReviewed: string | null;
  }>;
  campaigns: Array<{ insurerName: string; name: string; season: string | null; state: CampaignState }>;
  advisory: string;
  aggregateNote: string;
}

/**
 * What an FPO administrator may see of the insurer layer: only rows about their
 * own FPO, and never insurer-internal notes or another FPO's figures.
 */
export async function loadFpoCounterpartView(
  supabase: AuthedClient,
  userId: string,
  fpoTenantId: string,
): Promise<FpoInsurerView> {
  const actor = await resolveDistrictActor(supabase, userId);
  const permitted =
    actor.isPlatformAdmin || actor.isAuditor || actor.tenantIds.includes(fpoTenantId);
  if (!permitted) throw new Error("You do not have access to this organization");

  const { data: profile } = await supabase
    .from("fpo_profiles")
    .select("registration_number, cin, legal_name, registered_farmers")
    .eq("tenant_id", fpoTenantId)
    .maybeSingle();

  const prof = (profile ?? null) as {
    registration_number: string | null;
    cin: string | null;
    legal_name: string | null;
    registered_farmers: number | null;
  } | null;
  const reg = prof?.registration_number ?? prof?.cin ?? null;

  const base: FpoInsurerView = {
    fpoTenantId,
    registrationNumber: reg,
    fpoName: prof?.legal_name ?? null,
    memberCount: prof?.registered_farmers ?? null,
    insuredMembers: 0,
    penetration: 0,
    potentialPremiumInr: 0,
    interestedInsurers: [],
    campaigns: [],
    advisory: INSURER_ADVISORY,
    aggregateNote: AGGREGATE_ONLY_NOTE,
  };
  if (!reg) return base;

  const [channel, funnel, tenants] = await Promise.all([
    supabase.from("insurer_fpo_channel").select(CHANNEL_COLUMNS_SHARED).eq("registration_number", reg),
    supabase
      .from("insurer_funnel_entries")
      .select("insurer_tenant_id, stage")
      .eq("registration_number", reg),
    supabase.from("tenants").select("id, name").eq("tenant_type", "insurer"),
  ]);

  const names = new Map(
    ((tenants.data ?? []) as InsurerTenantOption[]).map((t) => [t.id, t.name] as const),
  );
  const stages = new Map(
    ((funnel.data ?? []) as Array<{ insurer_tenant_id: string; stage: FunnelStage }>).map(
      (f) => [f.insurer_tenant_id, f.stage] as const,
    ),
  );
  const rows = (channel.data ?? []) as Array<{
    insurer_tenant_id: string;
    fpo_name: string;
    member_count: number | null;
    insured_members: number;
    policies_count: number;
    potential_premium_inr: number;
    opportunity_score: number;
    last_reviewed: string | null;
  }>;

  const memberCount = base.memberCount ?? rows[0]?.member_count ?? null;
  const insured = rows.reduce((a, r) => a + r.insured_members, 0);

  return {
    ...base,
    fpoName: base.fpoName ?? rows[0]?.fpo_name ?? null,
    memberCount,
    insuredMembers: insured,
    penetration: penetrationPct(insured, memberCount ?? 0),
    potentialPremiumInr: rows.reduce((a, r) => a + r.potential_premium_inr, 0),
    interestedInsurers: rows.map((r) => ({
      insurerName: names.get(r.insurer_tenant_id) ?? "Insurer",
      insuredMembers: r.insured_members,
      policiesCount: r.policies_count,
      opportunityScore: r.opportunity_score,
      stage: stages.get(r.insurer_tenant_id) ?? null,
      lastReviewed: r.last_reviewed,
    })),
  };
}
