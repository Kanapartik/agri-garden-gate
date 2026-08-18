import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";
import {
  evaluateDataAccess,
  requiresHumanDecision,
  type AppRole,
  type ConsumerTier,
} from "@/lib/atap/policy";

export interface MyContext {
  profile: { id: string; full_name: string | null; locale: string } | null;
  tenants: Array<{
    id: string;
    name: string;
    tenant_type: string;
    region_code: string | null;
    membership_status: string;
  }>;
  roles: Array<{ role: AppRole; tenant_id: string | null }>;
  config: Array<{ config_key: string; config_value: Json }>;
  canReadAudit: boolean;
}

/** Everything the signed-in user is allowed to see about their own access. */
export const getMyContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyContext> => {
    const { supabase, userId } = context;

    const [profileRes, membersRes, rolesRes, configRes] = await Promise.all([
      supabase.from("profiles").select("id, full_name, locale").eq("id", userId).maybeSingle(),
      supabase
        .from("tenant_members")
        .select("status, tenants ( id, name, tenant_type, region_code )")
        .eq("user_id", userId),
      supabase.from("user_roles").select("role, tenant_id").eq("user_id", userId),
      supabase.from("platform_config").select("config_key, config_value").is("tenant_id", null),
    ]);

    const roles = (rolesRes.data ?? []) as Array<{ role: AppRole; tenant_id: string | null }>;

    const tenants = (membersRes.data ?? []).flatMap((row) => {
      const t = row.tenants as unknown as {
        id: string;
        name: string;
        tenant_type: string;
        region_code: string | null;
      } | null;
      return t
        ? [{ ...t, membership_status: row.status as string }]
        : [];
    });

    return {
      profile: profileRes.data ?? null,
      tenants,
      roles,
      config: (configRes.data ?? []) as Array<{ config_key: string; config_value: Json }>,
      canReadAudit: roles.some(
        (r) => r.tenant_id === null && (r.role === "auditor" || r.role === "platform_admin"),
      ),
    };
  });

/** Audit feed. RLS already restricts reads to auditor / platform_admin. */
export const listAuditEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("audit_events")
      .select("id, action, decision, subject_type, subject_id, purpose_code, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) return { events: [], error: "audit_unavailable" as const };
    return { events: data ?? [], error: null };
  });

async function writeAudit(
  supabase: { from: (t: string) => { insert: (v: unknown) => Promise<{ error: unknown }> } },
  event: {
    actor_user_id: string;
    tenant_id?: string | null;
    action: string;
    subject_type?: string;
    subject_id?: string;
    purpose_code?: string | null;
    decision: string;
    metadata?: Record<string, unknown>;
  },
) {
  await supabase.from("audit_events").insert({ metadata: {}, ...event });
}

/**
 * Grant a role inside one organisation. Authorization is enforced here, on the
 * server: only a platform_admin or a tenant_admin OF THAT tenant may grant, and
 * nobody may grant platform-wide roles through this path.
 */
export const grantTenantRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string; targetUserId: string; role: AppRole }) => {
    const allowed: AppRole[] = [
      "tenant_admin",
      "onboarding_officer",
      "field_agent",
      "consumer_api_manager",
      "viewer",
    ];
    if (!allowed.includes(input.role)) throw new Error("role_not_grantable_at_tenant_scope");
    if (!input.tenantId || !input.targetUserId) throw new Error("invalid_input");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const [{ data: isPlatformAdmin }, { data: isTenantAdmin }] = await Promise.all([
      supabase.rpc("has_role", { _user_id: userId, _role: "platform_admin" }),
      supabase.rpc("has_tenant_role", {
        _user_id: userId,
        _tenant_id: data.tenantId,
        _role: "tenant_admin",
      }),
    ]);

    if (!isPlatformAdmin && !isTenantAdmin) {
      await writeAudit(supabase as never, {
        actor_user_id: userId,
        tenant_id: data.tenantId,
        action: "role.grant",
        subject_type: "user",
        subject_id: data.targetUserId,
        decision: "deny",
        metadata: { role: data.role, reason: "not_authorized" },
      });
      throw new Error("Forbidden");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("user_roles")
      .insert({
        user_id: data.targetUserId,
        tenant_id: data.tenantId,
        role: data.role,
        granted_by: userId,
      });
    if (error && !`${error.message}`.includes("duplicate")) throw new Error("grant_failed");

    await writeAudit(supabase as never, {
      actor_user_id: userId,
      tenant_id: data.tenantId,
      action: "role.grant",
      subject_type: "user",
      subject_id: data.targetUserId,
      decision: "allow",
      metadata: { role: data.role },
    });

    return { ok: true };
  });

/** The subject records or revokes their own consent. Always audited. */
export const recordConsentDecision = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { purposeCode: string; consumerId: string; decision: "grant" | "revoke" }) => {
      if (input.decision !== "grant" && input.decision !== "revoke") {
        throw new Error("invalid_decision");
      }
      if (!input.purposeCode || !input.consumerId) throw new Error("invalid_input");
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    if (data.decision === "grant") {
      const { error } = await supabase.from("consent_grants").upsert(
        {
          subject_user_id: userId,
          purpose_code: data.purposeCode,
          consumer_id: data.consumerId,
          granted_at: new Date().toISOString(),
          revoked_at: null,
        },
        { onConflict: "subject_user_id,purpose_code,consumer_id" },
      );
      if (error) throw new Error("consent_write_failed");
    } else {
      const { error } = await supabase
        .from("consent_grants")
        .update({ revoked_at: new Date().toISOString() })
        .eq("subject_user_id", userId)
        .eq("purpose_code", data.purposeCode)
        .eq("consumer_id", data.consumerId);
      if (error) throw new Error("consent_write_failed");
    }

    await writeAudit(supabase as never, {
      actor_user_id: userId,
      action: `consent.${data.decision}`,
      subject_type: "user",
      subject_id: userId,
      purpose_code: data.purposeCode,
      decision: "allow",
      metadata: { consumer_id: data.consumerId },
    });

    return { ok: true };
  });

/**
 * Default-deny purpose-scoped access check for the signed-in subject's own
 * data. The same code path serves first-party and third-party consumers of the
 * same tier: only `tier` reaches the policy.
 */
export const evaluateMyDataAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { purposeCode: string; consumerId: string }) => {
    if (!input.purposeCode || !input.consumerId) throw new Error("invalid_input");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: consumer } = await supabase
      .from("api_consumers")
      .select("id, tier, status")
      .eq("id", data.consumerId)
      .maybeSingle();

    const { data: grants } = await supabase
      .from("consent_grants")
      .select("purpose_code, consumer_id, revoked_at, expires_at")
      .eq("subject_user_id", userId);

    const result = consumer
      ? evaluateDataAccess(
          {
            purposeCode: data.purposeCode,
            consumerId: data.consumerId,
            consumerTier: consumer.tier as ConsumerTier,
            consumerStatus: consumer.status as "active" | "suspended" | "revoked",
          },
          grants ?? [],
        )
      : ({ decision: "deny", reason: "consumer_not_active" } as const);

    await writeAudit(supabase as never, {
      actor_user_id: userId,
      action: "data_access.evaluate",
      subject_type: "user",
      subject_id: userId,
      purpose_code: data.purposeCode,
      decision: result.decision,
      metadata: { consumer_id: data.consumerId, reason: result.reason },
    });

    return {
      ...result,
      requiresHumanDecision: requiresHumanDecision(data.purposeCode),
    };
  });
