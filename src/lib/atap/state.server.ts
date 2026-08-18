/**
 * Server-only helpers for the B7 state/knowledge/research/post-harvest slice.
 * Imported only from inside server-function handler bodies.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type AuthedClient = SupabaseClient<Database>;

export interface StateActor {
  userId: string;
  isPlatformAdmin: boolean;
  isAuditor: boolean;
  isStateAdmin: boolean;
  isKnowledgeContributor: boolean;
  isKnowledgeReviewer: boolean;
  isResearcher: boolean;
  isPolicymaker: boolean;
  isPostharvestProviderAdmin: boolean;
  isMarketOperator: boolean;
  isExpansionManager: boolean;
  /** Tenants the actor is an active member of; the state-config boundary. */
  tenantIds: string[];
  /** Tenants where the actor holds state_admin. */
  stateAdminTenantIds: string[];
}

export async function resolveStateActor(
  supabase: AuthedClient,
  userId: string,
): Promise<StateActor> {
  const { data } = await supabase.from("user_roles").select("role, tenant_id").eq("user_id", userId);
  const rows = (data ?? []) as Array<{ role: string; tenant_id: string | null }>;
  const has = (role: string) => rows.some((r) => r.role === role);
  return {
    userId,
    isPlatformAdmin: rows.some((r) => r.role === "platform_admin" && r.tenant_id === null),
    isAuditor: rows.some((r) => r.role === "auditor" && r.tenant_id === null),
    isStateAdmin: has("state_admin"),
    isKnowledgeContributor: has("knowledge_contributor"),
    isKnowledgeReviewer: has("knowledge_reviewer"),
    isResearcher: has("researcher"),
    isPolicymaker: has("policymaker"),
    isPostharvestProviderAdmin: has("postharvest_provider_admin"),
    isMarketOperator: has("market_operator"),
    isExpansionManager: has("expansion_manager"),
    tenantIds: Array.from(new Set(rows.flatMap((r) => (r.tenant_id ? [r.tenant_id] : [])))),
    stateAdminTenantIds: Array.from(
      new Set(rows.filter((r) => r.role === "state_admin" && r.tenant_id).map((r) => r.tenant_id!)),
    ),
  };
}

/** State governance configuration is platform-admin or that state's own admin. */
export function canConfigureState(actor: StateActor, tenantId: string): boolean {
  return actor.isPlatformAdmin || actor.stateAdminTenantIds.includes(tenantId);
}

/** Knowledge approval/publish authority; never the author (checked separately). */
export function canReviewKnowledge(actor: StateActor): boolean {
  return actor.isPlatformAdmin || actor.isKnowledgeReviewer;
}

/** DUA/ethics decisions stay with platform oversight (human role). */
export function canDecideResearch(actor: StateActor): boolean {
  return actor.isPlatformAdmin;
}

export function canOperatePostharvest(actor: StateActor): boolean {
  return actor.isPlatformAdmin || actor.isExpansionManager || actor.isMarketOperator;
}

export async function flagEnabled(supabase: AuthedClient, key: string): Promise<boolean> {
  const { data } = await supabase.from("feature_flags").select("enabled").eq("key", key).maybeSingle();
  return Boolean((data as { enabled?: boolean } | null)?.enabled);
}

export interface SubtypeGateRow {
  code: string;
  evidence_gate: string;
  is_active: boolean;
  flagEnabled: boolean;
  verification_checks: Array<{ code: string; label: string }>;
  dispute_categories: string[];
}

/** Loads a service subtype together with its feature-flag activation state. */
export async function loadSubtypeGate(
  supabase: AuthedClient,
  code: string,
): Promise<SubtypeGateRow | null> {
  const { data } = await supabase
    .from("service_subtypes")
    .select("code, evidence_gate, is_active, feature_flag_key, verification_checks, dispute_categories")
    .eq("code", code)
    .maybeSingle();
  if (!data) return null;
  const row = data as unknown as {
    code: string;
    evidence_gate: string;
    is_active: boolean;
    feature_flag_key: string | null;
    verification_checks: Array<{ code: string; label: string }>;
    dispute_categories: string[];
  };
  return {
    code: row.code,
    evidence_gate: row.evidence_gate,
    is_active: row.is_active,
    flagEnabled: row.feature_flag_key ? await flagEnabled(supabase, row.feature_flag_key) : false,
    verification_checks: row.verification_checks ?? [],
    dispute_categories: row.dispute_categories ?? [],
  };
}

/** Effective aggregation floor: platform floor vs. the strictest state config. */
export async function strictestStateMinCohort(supabase: AuthedClient): Promise<number> {
  const { data } = await supabase.from("state_configurations").select("aggregation_min_cohort");
  const rows = (data ?? []) as Array<{ aggregation_min_cohort: number }>;
  return rows.reduce((max, r) => Math.max(max, r.aggregation_min_cohort), 0);
}
