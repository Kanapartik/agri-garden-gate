/**
 * Server-only helpers for the B4 partner integration slice. Imported only from
 * `partner.functions.ts` handler bodies — never from components.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { sha256 } from "@/lib/atap/admin.server";
import type { AppRole } from "@/lib/atap/policy";
import type { PartnerEnv } from "@/lib/atap/partner";

export type AuthedClient = SupabaseClient<Database>;

export interface PartnerActor {
  userId: string;
  isPlatformAdmin: boolean;
  isAuditor: boolean;
  tenantIds: string[];
  roles: Array<{ role: AppRole; tenant_id: string | null }>;
}

export async function resolvePartnerActor(
  supabase: AuthedClient,
  userId: string,
): Promise<PartnerActor> {
  const { data } = await supabase.from("user_roles").select("role, tenant_id").eq("user_id", userId);
  const rows = (data ?? []) as Array<{ role: AppRole; tenant_id: string | null }>;
  return {
    userId,
    isPlatformAdmin: rows.some((r) => r.role === "platform_admin" && r.tenant_id === null),
    isAuditor: rows.some((r) => r.role === "auditor" && r.tenant_id === null),
    tenantIds: Array.from(new Set(rows.flatMap((r) => (r.tenant_id ? [r.tenant_id] : [])))),
    roles: rows,
  };
}

/** RLS already scopes rows; this is the explicit server-side re-check. */
export async function isPartnerStaff(
  supabase: AuthedClient,
  userId: string,
  registrationId: string,
): Promise<boolean> {
  const { data } = await supabase.rpc("is_partner_staff", {
    _user_id: userId,
    _registration_id: registrationId,
  });
  return Boolean(data);
}

/* ------------------------------------------------------------ credentials */

function randomToken(length: number): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(36).padStart(2, "0"))
    .join("")
    .slice(0, length);
}

export interface IssuedCredential {
  clientId: string;
  clientSecret: string;
  secretPrefix: string;
  secretHash: string;
}

/**
 * OAuth-style client credential metadata. The secret is returned once to the
 * caller and stored only as a SHA-256 hash + display prefix.
 */
export async function mintCredential(environment: PartnerEnv): Promise<IssuedCredential> {
  const prefix = environment === "production" ? "prod" : "sbx";
  const clientId = `${prefix}_cid_${randomToken(20)}`;
  const clientSecret = `${prefix}_sec_${randomToken(40)}`;
  return {
    clientId,
    clientSecret,
    secretPrefix: clientSecret.slice(0, 12),
    secretHash: await sha256(clientSecret),
  };
}

export async function webhookSecret(): Promise<{ secret: string; prefix: string; hash: string }> {
  const secret = `whsec_${randomToken(40)}`;
  return { secret, prefix: secret.slice(0, 12), hash: await sha256(secret) };
}

/* -------------------------------------------------------------- analytics */

export interface CallLogInput {
  app_id: string;
  registration_id: string;
  environment: PartnerEnv;
  endpoint: string;
  purpose_code?: string | null;
  subject_user_id?: string | null;
  outcome: "allow" | "deny" | "error";
  deny_reason?: string | null;
  status_code: number;
  latency_ms: number;
  is_first_party: boolean;
  tier: Database["public"]["Enums"]["consumer_tier"];
}

/** Every governed API call is logged, allow or deny. */
export async function logApiCall(supabase: AuthedClient, input: CallLogInput) {
  await supabase.from("partner_api_calls").insert(input as never);
}

/** Feature flags are configuration; code never hardcodes activation. */
export async function flagEnabled(supabase: AuthedClient, key: string): Promise<boolean> {
  const { data } = await supabase
    .from("feature_flags")
    .select("enabled")
    .eq("key", key)
    .maybeSingle();
  return Boolean(data?.enabled);
}

/**
 * Synthetic sandbox dataset. Sandbox NEVER reads production farmer rows; every
 * sandbox response is generated from this deterministic synthetic source.
 * [VALIDATE] production signal sources (core banking, bureau, GIS) are mocked.
 */
export function syntheticSandboxSubject(subjectRef: string) {
  let seed = 0;
  for (const ch of subjectRef) seed = (seed * 31 + ch.charCodeAt(0)) % 100000;
  const bands = ["low", "medium", "high"] as const;
  return {
    synthetic: true as const,
    subject_ref: `synthetic:${subjectRef.slice(0, 8)}`,
    parcel_count: (seed % 3) + 1,
    total_area_ha: Math.round(((seed % 400) / 100 + 0.4) * 100) / 100,
    repayment_band: bands[seed % 3],
    seasons_observed: (seed % 5) + 1,
  };
}
