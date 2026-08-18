/**
 * Server-only helpers for the B2 farmer / assisted onboarding loop.
 * Imported only from `farmer.functions.ts` handler bodies.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { sha256 } from "@/lib/atap/admin.server";
import type { OnboardingChannel } from "@/lib/atap/farmer";

export type AuthedClient = SupabaseClient<Database>;

export const DEFAULT_BASELINE_POLICY_VERSION = "2026-08-baseline-v1";

/** Baseline consent version is configuration, not a constant in code. */
export async function baselinePolicyVersion(supabase: AuthedClient): Promise<string> {
  const { data } = await supabase
    .from("platform_config")
    .select("config_value")
    .eq("config_key", "consent.baseline_policy_version")
    .is("tenant_id", null)
    .maybeSingle();
  const value = data?.config_value;
  return typeof value === "string" ? value : DEFAULT_BASELINE_POLICY_VERSION;
}

export async function jurisdictionCode(supabase: AuthedClient): Promise<string> {
  const { data } = await supabase
    .from("platform_config")
    .select("config_value")
    .eq("config_key", "identity.jurisdiction_default")
    .is("tenant_id", null)
    .maybeSingle();
  const value = data?.config_value;
  return typeof value === "string" ? value : "IN-TG";
}

/** Identity references are never stored in the clear. */
export async function hashIdentityReference(jurisdiction: string, reference: string) {
  return sha256(`${jurisdiction}:${reference.trim().toLowerCase()}`);
}

export interface FunnelEventInput {
  subject_user_id: string;
  actor_user_id: string;
  application_id?: string | null;
  role_code?: string | null;
  channel: OnboardingChannel;
  event_code: string;
  metadata?: Record<string, unknown>;
}

/** Funnel events are analytics; audit events remain the security record. */
export async function logFunnelEvent(supabase: AuthedClient, event: FunnelEventInput) {
  await supabase.from("onboarding_funnel_events").insert({ metadata: {}, ...event } as never);
}

export async function isPlatformAdmin(supabase: AuthedClient, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "platform_admin" });
  return Boolean(data);
}

/** Assisted capture requires a real, tenant-scoped operational role. */
export async function assistedActorRoles(supabase: AuthedClient, userId: string) {
  const { data } = await supabase.from("user_roles").select("role, tenant_id").eq("user_id", userId);
  const rows = (data ?? []) as Array<{ role: string; tenant_id: string | null }>;
  return {
    canAssist: rows.some(
      (r) =>
        r.role === "field_agent" ||
        r.role === "onboarding_officer" ||
        r.role === "tenant_admin" ||
        (r.role === "platform_admin" && r.tenant_id === null),
    ),
    roles: rows,
  };
}
