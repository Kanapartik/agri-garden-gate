/**
 * Server-only helpers for the B6 expansion slice. Imported only from inside
 * server-function handler bodies.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { ServiceSubtypeConfig } from "@/lib/atap/expansion";

export type AuthedClient = SupabaseClient<Database>;

export interface ExpansionActor {
  userId: string;
  isPlatformAdmin: boolean;
  isAuditor: boolean;
  isExpansionManager: boolean;
  isSupportAgent: boolean;
  tenantIds: string[];
}

export async function resolveExpansionActor(
  supabase: AuthedClient,
  userId: string,
): Promise<ExpansionActor> {
  const { data } = await supabase.from("user_roles").select("role, tenant_id").eq("user_id", userId);
  const rows = (data ?? []) as Array<{ role: string; tenant_id: string | null }>;
  const global = (role: string) => rows.some((r) => r.role === role && r.tenant_id === null);
  return {
    userId,
    isPlatformAdmin: global("platform_admin"),
    isAuditor: global("auditor"),
    isExpansionManager: global("expansion_manager"),
    isSupportAgent: global("support_agent"),
    tenantIds: Array.from(new Set(rows.flatMap((r) => (r.tenant_id ? [r.tenant_id] : [])))),
  };
}

/** District templates, clones, effort figures and subtype activation. */
export function canConfigureExpansion(actor: ExpansionActor): boolean {
  return actor.isPlatformAdmin || actor.isExpansionManager;
}

/** Service and support disputes are always decided by an internal human role. */
export function canDecideSupport(actor: ExpansionActor): boolean {
  return actor.isPlatformAdmin || actor.isSupportAgent;
}

export async function flagEnabled(supabase: AuthedClient, key: string): Promise<boolean> {
  const { data } = await supabase.from("feature_flags").select("enabled").eq("key", key).maybeSingle();
  return Boolean((data as { enabled?: boolean } | null)?.enabled);
}

export interface SubtypeRow {
  code: string;
  label: string;
  domain: string;
  description: string;
  feature_flag_key: string | null;
  evidence_gate: ServiceSubtypeConfig["evidence_gate"];
  evidence_note: string | null;
  verification_checks: Array<{ code: string; label: string }>;
  dispute_categories: string[];
  requires_human_decision: boolean;
  is_active: boolean;
  sort_order: number;
}

/** Joins subtype configuration with its activation flag into the pure-rule shape. */
export async function loadSubtypes(
  supabase: AuthedClient,
): Promise<Array<SubtypeRow & { flagEnabled: boolean }>> {
  const { data } = await supabase.from("service_subtypes").select("*").order("sort_order");
  const rows = (data ?? []) as unknown as SubtypeRow[];
  const { data: flagRows } = await supabase.from("feature_flags").select("key, enabled");
  const flags = new Map(
    ((flagRows ?? []) as Array<{ key: string; enabled: boolean }>).map((f) => [f.key, f.enabled]),
  );
  return rows.map((r) => ({
    ...r,
    flagEnabled: r.feature_flag_key ? Boolean(flags.get(r.feature_flag_key)) : false,
  }));
}

export function toSubtypeConfig(row: SubtypeRow & { flagEnabled: boolean }): ServiceSubtypeConfig {
  return {
    code: row.code,
    domain: row.domain,
    evidence_gate: row.evidence_gate,
    verification_checks: row.verification_checks,
    dispute_categories: row.dispute_categories,
    requires_human_decision: row.requires_human_decision,
    is_active: row.is_active,
    flagEnabled: row.flagEnabled,
  };
}
