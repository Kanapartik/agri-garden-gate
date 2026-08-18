/**
 * Server-only helpers for the B5 marketplace slice. Imported only inside
 * server-function handler bodies.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { AppRole } from "@/lib/atap/policy";
import { entitlementFor, type CommerceEntitlement } from "@/lib/atap/marketplace";

export type AuthedClient = SupabaseClient<Database>;

export interface MarketActor {
  userId: string;
  roles: Array<{ role: AppRole | "market_operator"; tenant_id: string | null }>;
  isPlatformAdmin: boolean;
  isAuditor: boolean;
  isMarketOperator: boolean;
  tenantIds: string[];
}

export async function resolveMarketActor(
  supabase: AuthedClient,
  userId: string,
): Promise<MarketActor> {
  const { data } = await supabase.from("user_roles").select("role, tenant_id").eq("user_id", userId);
  const rows = (data ?? []) as Array<{ role: AppRole | "market_operator"; tenant_id: string | null }>;
  const hasGlobal = (role: string) => rows.some((r) => r.role === role && r.tenant_id === null);
  return {
    userId,
    roles: rows,
    isPlatformAdmin: hasGlobal("platform_admin"),
    isAuditor: hasGlobal("auditor"),
    isMarketOperator: hasGlobal("market_operator"),
    tenantIds: Array.from(new Set(rows.flatMap((r) => (r.tenant_id ? [r.tenant_id] : [])))),
  };
}

/** Listing review and dispute decisions are internal human roles only. */
export function canReviewMarketplace(actor: MarketActor): boolean {
  return actor.isPlatformAdmin || actor.isMarketOperator;
}

export async function flagEnabled(supabase: AuthedClient, key: string): Promise<boolean> {
  const { data } = await supabase.from("feature_flags").select("enabled").eq("key", key).maybeSingle();
  return Boolean(data?.enabled);
}

/**
 * Entitlement lookup. A missing row means the base plan — never elevated
 * capability — and pricing fields are ignored (no pricing assumed in B5).
 */
export async function entitlementForProfile(
  supabase: AuthedClient,
  profileId: string,
): Promise<CommerceEntitlement> {
  const { data } = await supabase
    .from("commerce_entitlements")
    .select("plan_code, status")
    .eq("profile_id", profileId)
    .order("starts_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const row = data as { plan_code: string; status: CommerceEntitlement["status"] } | null;
  return entitlementFor(row?.plan_code ?? "base", row?.status ?? "active");
}

/**
 * Delegated purchasing authority for FPO aggregated demand. Mirrors the B3
 * guard: authority must be recorded as an approved platform config rule for the
 * tenant, not inferred from tenancy or plan.
 * [VALIDATE] the legal instrument that constitutes delegated purchasing
 * authority per jurisdiction is still an open decision (D-08).
 */
export async function delegatedPurchasingApproved(
  supabase: AuthedClient,
  tenantId: string | null,
): Promise<boolean> {
  if (!tenantId) return false;
  const { data } = await supabase
    .from("platform_config")
    .select("config_value")
    .eq("tenant_id", tenantId)
    .eq("config_key", "delegated_purchasing_authority")
    .maybeSingle();
  const value = (data?.config_value ?? null) as { approved?: boolean } | null;
  return value?.approved === true;
}
