/**
 * Server-only helpers for the B1 admin control plane. Imported only by
 * `admin.functions.ts` handler bodies — never by components.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { AppRole } from "@/lib/atap/policy";
import {
  isPrivilegedSessionActive,
  type ContactVerificationChallenge,
  type ContactVerificationProvider,
  type ContactVerificationRequest,
} from "@/lib/atap/identity";

export type AuthedClient = SupabaseClient<Database>;

/* --------------------------------------------------------------- actor */

export interface AdminActor {
  userId: string;
  isPlatformAdmin: boolean;
  isAuditor: boolean;
  tenantAdminOf: string[];
  onboardingOfficerOf: string[];
  privilegedSessionActive: boolean;
}

export async function resolveActor(
  supabase: AuthedClient,
  userId: string,
): Promise<AdminActor> {
  const [{ data: roles }, { data: privilege }] = await Promise.all([
    supabase.from("user_roles").select("role, tenant_id").eq("user_id", userId),
    supabase
      .from("privileged_access_requests")
      .select("status, mfa_verified, expires_at, requester_user_id")
      .eq("requester_user_id", userId),
  ]);

  const rows = (roles ?? []) as Array<{ role: AppRole; tenant_id: string | null }>;
  return {
    userId,
    isPlatformAdmin: rows.some((r) => r.tenant_id === null && r.role === "platform_admin"),
    isAuditor: rows.some((r) => r.tenant_id === null && r.role === "auditor"),
    tenantAdminOf: rows.flatMap((r) =>
      r.role === "tenant_admin" && r.tenant_id ? [r.tenant_id] : [],
    ),
    onboardingOfficerOf: rows.flatMap((r) =>
      r.role === "onboarding_officer" && r.tenant_id ? [r.tenant_id] : [],
    ),
    privilegedSessionActive: isPrivilegedSessionActive(
      (privilege ?? []) as never,
      userId,
    ),
  };
}

/* --------------------------------------------------------------- audit */

export interface AuditInput {
  actor_user_id: string;
  tenant_id?: string | null;
  action: string;
  subject_type?: string;
  subject_id?: string;
  purpose_code?: string | null;
  decision: "allow" | "deny";
  metadata?: Record<string, unknown>;
}

/** Every sensitive workflow / permission change lands here, allow OR deny. */
export async function audit(supabase: AuthedClient, event: AuditInput) {
  await supabase.from("audit_events").insert({ metadata: {}, ...event } as never);
}

/* ---------------------------------------------- contact verification */

/**
 * Synthetic provider for development/sandbox. Real providers (email/SMS/OTP)
 * plug in behind this same interface — [VALIDATE provider].
 */
export const syntheticContactProvider: ContactVerificationProvider = {
  name: "synthetic",
  async start(req: ContactVerificationRequest): Promise<ContactVerificationChallenge> {
    const code = "000000";
    return {
      provider: "synthetic",
      providerRef: `syn_${req.channel}_${Date.now().toString(36)}`,
      codeHash: await sha256(code),
      expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
    };
  },
  async check(_providerRef, code, codeHash) {
    return (await sha256(code)) === codeHash;
  },
};

export async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function contactProvider(): ContactVerificationProvider {
  // Only the synthetic provider is wired in B1; production provider is unresolved.
  return syntheticContactProvider;
}
