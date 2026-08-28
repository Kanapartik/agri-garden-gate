/**
 * Server-only helpers for slice I2 (insurer crop monitoring & risk
 * surveillance).
 *
 * Authority rules, default-deny:
 *  - reads reuse the slice I1 insurer scope (insurer membership, or
 *    platform_admin / auditor oversight);
 *  - writes (watchlist, alert rules, alert status, alert generation) require
 *    tenant_admin of that insurer tenant, or platform_admin;
 *  - risk cells are aggregate district×crop signals readable by any signed-in
 *    user; they carry no farmer-level data;
 *  - every write is audited (allow AND deny);
 *  - alerts are advisory: nothing here touches claims.
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
  buildAlertDetail,
  buildAlertTitle,
  RISK_ADVISORY,
  RISK_AGGREGATE_NOTE,
  ruleMatchesCell,
  type AlertRow,
  type AlertRuleRow,
  type AlertStatus,
  type RiskCellRow,
  type RiskEvent,
  type RiskSeverity,
  type WatchlistRow,
} from "@/lib/atap/insurerRisk";

export type AuthedClient = SupabaseClient<Database>;

const RISK_COLUMNS =
  "id, state_name, district, crop, season, event_type, severity, rainfall_deviation_pct, affected_acres, affected_fpos, observed_at, source";
const WATCH_COLUMNS = "id, insurer_tenant_id, state_name, district, crop, season, notes";
const RULE_COLUMNS =
  "id, insurer_tenant_id, name, event_type, min_severity, rainfall_deviation_threshold_pct, active";
const ALERT_COLUMNS =
  "id, insurer_tenant_id, rule_id, risk_cell_id, severity, title, detail, status, acknowledged_at";

export interface RiskWorkspace {
  scope: InsurerScope;
  tenantOptions: InsurerTenantOption[];
  advisory: string;
  aggregateNote: string;
  cells: RiskCellRow[];
  watchlist: WatchlistRow[];
  rules: AlertRuleRow[];
  alerts: AlertRow[];
  exposure: Array<{
    registration_number: string;
    fpo_name: string;
    district: string | null;
    member_count: number | null;
    insured_members: number;
    policies_count: number;
    premium_inr: number;
  }>;
}

export async function loadRiskWorkspace(
  supabase: AuthedClient,
  userId: string,
  requestedTenantId?: string,
): Promise<RiskWorkspace> {
  const { scope, options } = await resolveInsurerScope(supabase, userId, requestedTenantId);

  const [cells, watchlist, rules, alerts, channel] = await Promise.all([
    supabase.from("insurer_risk_cells").select(RISK_COLUMNS).order("observed_at", { ascending: false }).limit(1000),
    supabase.from("insurer_watchlist").select(WATCH_COLUMNS).eq("insurer_tenant_id", scope.tenantId),
    supabase.from("insurer_alert_rules").select(RULE_COLUMNS).eq("insurer_tenant_id", scope.tenantId),
    supabase
      .from("insurer_alerts")
      .select(ALERT_COLUMNS)
      .eq("insurer_tenant_id", scope.tenantId)
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("insurer_fpo_channel")
      .select("registration_number, fpo_name, district, member_count, insured_members, policies_count, premium_inr")
      .eq("insurer_tenant_id", scope.tenantId)
      .limit(2000),
  ]);

  const failure = cells.error ?? watchlist.error ?? rules.error ?? alerts.error ?? channel.error;
  if (failure) throw new Error(failure.message);

  const cellById = new Map(((cells.data ?? []) as unknown as RiskCellRow[]).map((c) => [c.id, c]));

  return {
    scope,
    tenantOptions: options,
    advisory: RISK_ADVISORY,
    aggregateNote: RISK_AGGREGATE_NOTE,
    cells: (cells.data ?? []) as unknown as RiskCellRow[],
    watchlist: (watchlist.data ?? []) as unknown as WatchlistRow[],
    rules: (rules.data ?? []) as unknown as AlertRuleRow[],
    alerts: ((alerts.data ?? []) as unknown as AlertRow[]).map((a) => ({
      ...a,
      cell: cellById.get(a.risk_cell_id),
    })),
    exposure: (channel.data ?? []) as unknown as RiskWorkspace["exposure"],
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
      subject_type: "insurer_risk",
      decision: "deny",
      metadata: { reason: "not_insurer_admin" },
    });
    throw new Error("Only an insurer administrator can change risk surveillance settings");
  }
  return scope;
}

export async function saveWatchEntry(
  supabase: AuthedClient,
  userId: string,
  input: {
    tenantId: string;
    watchId?: string;
    stateName: string;
    district: string;
    crop: string;
    season: string;
    notes?: string | null;
  },
): Promise<{ ok: true }> {
  await requireManage(supabase, userId, input.tenantId, "insurer.watchlist.save");

  const row = {
    insurer_tenant_id: input.tenantId,
    state_name: input.stateName,
    district: input.district,
    crop: input.crop,
    season: input.season,
    notes: input.notes ?? null,
    ...(input.watchId ? {} : { created_by: userId }),
  };

  const query = input.watchId
    ? supabase.from("insurer_watchlist").update(row as never).eq("id", input.watchId).eq("insurer_tenant_id", input.tenantId)
    : supabase.from("insurer_watchlist").upsert(row as never, { onConflict: "insurer_tenant_id,district,crop,season" });
  const { error } = await query;
  if (error) throw new Error(error.message);

  await audit(supabase, {
    actor_user_id: userId,
    tenant_id: input.tenantId,
    action: "insurer.watchlist.save",
    subject_type: "insurer_watchlist",
    subject_id: input.watchId ?? null,
    decision: "allow",
    metadata: { district: input.district, crop: input.crop, season: input.season },
  });
  return { ok: true };
}

export async function removeWatchEntry(
  supabase: AuthedClient,
  userId: string,
  input: { tenantId: string; watchId: string },
): Promise<{ ok: true }> {
  await requireManage(supabase, userId, input.tenantId, "insurer.watchlist.remove");
  const { error } = await supabase
    .from("insurer_watchlist")
    .delete()
    .eq("id", input.watchId)
    .eq("insurer_tenant_id", input.tenantId);
  if (error) throw new Error(error.message);
  await audit(supabase, {
    actor_user_id: userId,
    tenant_id: input.tenantId,
    action: "insurer.watchlist.remove",
    subject_type: "insurer_watchlist",
    subject_id: input.watchId,
    decision: "allow",
    metadata: {},
  });
  return { ok: true };
}

export async function saveAlertRule(
  supabase: AuthedClient,
  userId: string,
  input: {
    tenantId: string;
    ruleId?: string;
    name: string;
    eventType?: RiskEvent | null;
    minSeverity?: RiskSeverity;
    rainfallDeviationThresholdPct?: number | null;
    active?: boolean;
  },
): Promise<{ ok: true }> {
  await requireManage(supabase, userId, input.tenantId, "insurer.alert_rule.save");

  const row = {
    insurer_tenant_id: input.tenantId,
    name: input.name,
    event_type: input.eventType ?? null,
    min_severity: input.minSeverity ?? "advisory",
    rainfall_deviation_threshold_pct: input.rainfallDeviationThresholdPct ?? null,
    active: input.active ?? true,
    ...(input.ruleId ? {} : { created_by: userId }),
  };

  const query = input.ruleId
    ? supabase.from("insurer_alert_rules").update(row as never).eq("id", input.ruleId).eq("insurer_tenant_id", input.tenantId)
    : supabase.from("insurer_alert_rules").insert(row as never);
  const { error } = await query;
  if (error) throw new Error(error.message);

  await audit(supabase, {
    actor_user_id: userId,
    tenant_id: input.tenantId,
    action: "insurer.alert_rule.save",
    subject_type: "insurer_alert_rule",
    subject_id: input.ruleId ?? null,
    decision: "allow",
    metadata: { name: input.name },
  });
  return { ok: true };
}

export async function setAlertStatus(
  supabase: AuthedClient,
  userId: string,
  input: { tenantId: string; alertId: string; status: AlertStatus },
): Promise<{ ok: true; status: AlertStatus }> {
  await requireManage(supabase, userId, input.tenantId, "insurer.alert.status");

  const patch =
    input.status === "acknowledged"
      ? { status: input.status, acknowledged_by: userId, acknowledged_at: new Date().toISOString() }
      : { status: input.status, acknowledged_by: null, acknowledged_at: null };

  const { error } = await supabase
    .from("insurer_alerts")
    .update(patch as never)
    .eq("id", input.alertId)
    .eq("insurer_tenant_id", input.tenantId);
  if (error) throw new Error(error.message);

  await audit(supabase, {
    actor_user_id: userId,
    tenant_id: input.tenantId,
    action: "insurer.alert.status",
    subject_type: "insurer_alert",
    subject_id: input.alertId,
    decision: "allow",
    metadata: { status: input.status },
  });
  return { ok: true, status: input.status };
}

/**
 * Evaluate the insurer's active rules over current risk cells and create
 * alerts for matches (deduplicated by the unique tenant×cell constraint).
 * Advisory only — never touches claims. Returns how many alerts were created.
 */
export async function generateAlerts(
  supabase: AuthedClient,
  userId: string,
  input: { tenantId: string },
): Promise<{ ok: true; created: number }> {
  await requireManage(supabase, userId, input.tenantId, "insurer.alerts.generate");

  const [rules, cells] = await Promise.all([
    supabase.from("insurer_alert_rules").select(RULE_COLUMNS).eq("insurer_tenant_id", input.tenantId),
    supabase.from("insurer_risk_cells").select(RISK_COLUMNS),
  ]);
  if (rules.error) throw new Error(rules.error.message);
  if (cells.error) throw new Error(cells.error.message);

  const ruleRows = (rules.data ?? []) as unknown as AlertRuleRow[];
  const cellRows = (cells.data ?? []) as unknown as RiskCellRow[];

  const inserts: Array<Record<string, unknown>> = [];
  const seen = new Set<string>();
  for (const cell of cellRows) {
    const match = ruleRows.find((r) => ruleMatchesCell(r, cell));
    if (!match || seen.has(cell.id)) continue;
    seen.add(cell.id);
    inserts.push({
      insurer_tenant_id: input.tenantId,
      rule_id: match.id,
      risk_cell_id: cell.id,
      severity: cell.severity,
      title: buildAlertTitle(cell),
      detail: buildAlertDetail(cell),
      status: "open",
    });
  }

  let created = 0;
  if (inserts.length > 0) {
    const { data, error } = await supabase
      .from("insurer_alerts")
      .upsert(inserts as never, { onConflict: "insurer_tenant_id,risk_cell_id", ignoreDuplicates: true })
      .select("id");
    if (error) throw new Error(error.message);
    created = (data ?? []).length;
  }

  await audit(supabase, {
    actor_user_id: userId,
    tenant_id: input.tenantId,
    action: "insurer.alerts.generate",
    subject_type: "insurer_alert",
    decision: "allow",
    metadata: { evaluated: cellRows.length, rules: ruleRows.length, created },
  });
  return { ok: true, created };
}
