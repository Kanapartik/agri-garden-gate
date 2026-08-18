/**
 * Server-only helpers for the B9 talent & skills slice. Imported only from
 * inside server-function handler bodies.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { evaluateTalentGate, type EvidenceGate, type TalentFlag } from "@/lib/atap/talent";

export type AuthedClient = SupabaseClient<Database>;

export interface TalentActor {
  userId: string;
  isPlatformAdmin: boolean;
  isAuditor: boolean;
  isTalentOperator: boolean;
  isCandidate: boolean;
  isTrainingPartnerAdmin: boolean;
  isEmployerRecruiter: boolean;
  isEmploymentExchangeAdmin: boolean;
  tenantIds: string[];
}

export async function resolveTalentActor(
  supabase: AuthedClient,
  userId: string,
): Promise<TalentActor> {
  const { data } = await supabase.from("user_roles").select("role, tenant_id").eq("user_id", userId);
  const rows = (data ?? []) as Array<{ role: string; tenant_id: string | null }>;
  const has = (role: string) => rows.some((r) => r.role === role);
  return {
    userId,
    isPlatformAdmin: rows.some((r) => r.role === "platform_admin" && r.tenant_id === null),
    isAuditor: rows.some((r) => r.role === "auditor" && r.tenant_id === null),
    isTalentOperator: has("talent_operator"),
    isCandidate: has("talent_candidate"),
    isTrainingPartnerAdmin: has("training_partner_admin"),
    isEmployerRecruiter: has("employer_recruiter"),
    isEmploymentExchangeAdmin: has("employment_exchange_admin"),
    tenantIds: Array.from(new Set(rows.flatMap((r) => (r.tenant_id ? [r.tenant_id] : [])))),
  };
}

/** Talent entity review (partner/employer/certification) is a human decision. */
export function canReviewTalentEntity(actor: TalentActor): boolean {
  return actor.isPlatformAdmin || actor.isTalentOperator;
}

/** D-16 approval and commercial entitlements sit with platform leadership. */
export function canDecideGate(actor: TalentActor): boolean {
  return actor.isPlatformAdmin;
}

export async function flagEnabled(supabase: AuthedClient, key: string): Promise<boolean> {
  const { data } = await supabase
    .from("feature_flags")
    .select("enabled")
    .eq("key", key)
    .maybeSingle();
  return Boolean((data as { enabled?: boolean } | null)?.enabled);
}

export async function loadTalentGate(supabase: AuthedClient): Promise<EvidenceGate | null> {
  const { data } = await supabase
    .from("talent_evidence_gates")
    .select("code, status, demand_validated, policy_validated, commercial_validated")
    .eq("code", "D-16")
    .maybeSingle();
  return (data as unknown as EvidenceGate | null) ?? null;
}

/**
 * Every talent mutation starts here. Throws when the D-16 evidence gate or the
 * specific feature flag is not approved — the domain simply does not respond.
 */
export async function requireTalentDomain(
  supabase: AuthedClient,
  feature?: TalentFlag,
): Promise<void> {
  const [gate, domainFlagEnabled, featureEnabled] = await Promise.all([
    loadTalentGate(supabase),
    flagEnabled(supabase, "talent.domain"),
    feature ? flagEnabled(supabase, feature) : Promise.resolve(true),
  ]);
  const decision = evaluateTalentGate({
    gate,
    domainFlagEnabled,
    featureFlagEnabled: featureEnabled,
  });
  if (!decision.activated) {
    throw new Error(`talent_domain_unavailable:${decision.errors.join(",")}`);
  }
}

export async function myCandidateProfileId(
  supabase: AuthedClient,
  userId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("talent_candidate_profiles")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  return (data as { id?: string } | null)?.id ?? null;
}
