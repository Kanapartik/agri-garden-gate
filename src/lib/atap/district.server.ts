/**
 * Server-only helpers for the B3 FPO / government district slice. Imported only
 * from `district.functions.ts` handler bodies.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { AppRole } from "@/lib/atap/policy";
import { sha256 } from "@/lib/atap/admin.server";
import type { RosterActor } from "@/lib/atap/district";

export type AuthedClient = SupabaseClient<Database>;

export interface DistrictActor extends RosterActor {
  tenantAdminOf: string[];
  schemePublisherOf: string[];
  schemeReviewerOf: string[];
  tenantIds: string[];
}

/** Single resolution point for every B3 authority check. */
export async function resolveDistrictActor(
  supabase: AuthedClient,
  userId: string,
): Promise<DistrictActor> {
  const { data } = await supabase.from("user_roles").select("role, tenant_id").eq("user_id", userId);
  const rows = (data ?? []) as Array<{ role: AppRole; tenant_id: string | null }>;
  const scoped = (role: AppRole) =>
    rows.flatMap((r) => (r.role === role && r.tenant_id ? [r.tenant_id] : []));

  return {
    userId,
    isPlatformAdmin: rows.some((r) => r.role === "platform_admin" && r.tenant_id === null),
    isAuditor: rows.some((r) => r.role === "auditor" && r.tenant_id === null),
    tenantRoles: rows,
    tenantAdminOf: scoped("tenant_admin"),
    schemePublisherOf: scoped("scheme_publisher"),
    schemeReviewerOf: scoped("scheme_reviewer"),
    tenantIds: Array.from(
      new Set(rows.flatMap((r) => (r.tenant_id ? [r.tenant_id] : []))),
    ),
  };
}

export async function inviteTokenHash(tenantId: string, email: string, nonce: string) {
  return sha256(`${tenantId}:${email.trim().toLowerCase()}:${nonce}`);
}

export async function tenantTypeOf(supabase: AuthedClient, tenantId: string) {
  const { data } = await supabase
    .from("tenants")
    .select("tenant_type, name, status")
    .eq("id", tenantId)
    .maybeSingle();
  return data ?? null;
}

/** Signed-in user's own email, used only to match an invitation. */
export async function currentUserEmail(supabase: AuthedClient): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.email ?? null;
}
