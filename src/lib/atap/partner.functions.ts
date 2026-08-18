/**
 * B4 — Bank, insurer & agritech developer onboarding: server functions.
 *
 * Authority is re-checked in every handler. Reads run through the caller's
 * RLS-scoped client; privileged provisioning writes (credential issue, consumer
 * creation, call logging) run through the admin client ONLY after the caller
 * has been authorized, and every sensitive step writes an audit event.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  DEVELOPER_GUIDE,
  SCOPE_CATALOGUE,
  canConfigureWebhook,
  canIssueProductionCredential,
  checkProductionRequest,
  checkRegistrationSubmit,
  deriveRegistrationState,
  evaluateApiAccess,
  isProductionEligible,
  planCaseTransition,
  planConsentBrokerRequest,
  scopeDef,
  scopesForKind,
  summariseCalls,
  summariseSignals,
  type CallRecordLike,
  type GateStatus,
  type PartnerAnalytics,
  type PartnerCaseKind,
  type PartnerCaseStatus,
  type PartnerEnv,
  type PartnerKind,
  type PartnerRegState,
  type RegistrationLike,
} from "@/lib/atap/partner";
import type { ConsumerTier } from "@/lib/atap/policy";

/* ------------------------------------------------------------------ types */

export interface RegistrationRow {
  id: string;
  partner_kind: PartnerKind;
  display_name: string;
  contact_email: string;
  intended_use: string;
  requested_purposes: string[];
  state: PartnerRegState;
  legal_status: GateStatus;
  legal_note: string | null;
  security_status: GateStatus;
  security_note: string | null;
  tenant_id: string | null;
  sandbox_tenant_id: string | null;
  created_at: string;
}

export interface AppRow {
  id: string;
  registration_id: string;
  consumer_id: string | null;
  name: string;
  environment: PartnerEnv;
  tier: ConsumerTier;
  scopes: string[];
  rate_limit_per_min: number;
  status: string;
  created_at: string;
}

export interface CredentialRow {
  id: string;
  app_id: string;
  environment: PartnerEnv;
  client_id: string;
  secret_prefix: string;
  scopes: string[];
  status: string;
  issued_at: string;
  revoked_at: string | null;
}

export interface ProductionRequestRow {
  id: string;
  registration_id: string;
  app_id: string;
  requested_scopes: string[];
  requested_tier: ConsumerTier;
  justification: string;
  status: GateStatus;
  decision_note: string | null;
  created_at: string;
}

export interface BrokerRequestRow {
  id: string;
  app_id: string;
  subject_user_id: string;
  purpose_code: string;
  environment: PartnerEnv;
  requested_scopes: string[];
  status: string;
  reason: string;
  created_at: string;
  decided_at: string | null;
}

export interface CaseRow {
  id: string;
  app_id: string;
  registration_id: string;
  kind: PartnerCaseKind;
  environment: PartnerEnv;
  subject_user_id: string | null;
  purpose_code: string | null;
  status: PartnerCaseStatus;
  payload: Record<string, unknown>;
  signals: Record<string, unknown>;
  evidence: unknown[];
  requires_human_decision: boolean;
  decision_note: string | null;
  decided_at: string | null;
  created_at: string;
}

export interface WebhookRow {
  id: string;
  app_id: string;
  environment: PartnerEnv;
  target_url: string;
  event_types: string[];
  secret_prefix: string;
  is_active: boolean;
  created_at: string;
}

export interface DeveloperPortal {
  userId: string;
  guide: typeof DEVELOPER_GUIDE;
  scopeCatalogue: typeof SCOPE_CATALOGUE;
  registrations: RegistrationRow[];
  apps: AppRow[];
  credentials: CredentialRow[];
  productionRequests: ProductionRequestRow[];
  brokerRequests: BrokerRequestRow[];
  cases: CaseRow[];
  webhooks: WebhookRow[];
  analytics: PartnerAnalytics;
  flags: { portal: boolean; broker: boolean; production: boolean; webhooks: boolean };
  isPlatformAdmin: boolean;
}

const KINDS: PartnerKind[] = ["bank", "insurer", "agritech"];
const ENVS: PartnerEnv[] = ["sandbox", "production"];

function asRegistration(row: RegistrationRow): RegistrationLike {
  return {
    state: row.state,
    legal_status: row.legal_status,
    security_status: row.security_status,
    partner_kind: row.partner_kind,
  };
}

/* ---------------------------------------------------------- portal read */

export const getDeveloperPortal = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DeveloperPortal> => {
    const { supabase, userId } = context;
    const { resolvePartnerActor, flagEnabled } = await import("@/lib/atap/partner.server");
    const actor = await resolvePartnerActor(supabase, userId);

    const [regs, apps, creds, prod, broker, cases, hooks, calls] = await Promise.all([
      supabase.from("partner_registrations").select("*").order("created_at", { ascending: false }),
      supabase.from("partner_apps").select("*").order("created_at", { ascending: false }),
      supabase.from("partner_credentials").select("*").order("issued_at", { ascending: false }),
      supabase.from("partner_production_requests").select("*").order("created_at", { ascending: false }),
      supabase.from("consent_broker_requests").select("*").order("created_at", { ascending: false }).limit(100),
      supabase.from("partner_workflow_cases").select("*").order("created_at", { ascending: false }).limit(100),
      supabase.from("partner_webhooks").select("*").order("created_at", { ascending: false }),
      supabase.from("partner_api_calls").select("*").order("created_at", { ascending: false }).limit(500),
    ]);

    const [portal, brokerFlag, production, webhooks] = await Promise.all([
      flagEnabled(supabase, "partner.developer_portal"),
      flagEnabled(supabase, "partner.consent_broker"),
      flagEnabled(supabase, "partner.production_access"),
      flagEnabled(supabase, "partner.webhooks"),
    ]);

    return {
      userId,
      guide: DEVELOPER_GUIDE,
      scopeCatalogue: SCOPE_CATALOGUE,
      registrations: (regs.data ?? []) as unknown as RegistrationRow[],
      apps: (apps.data ?? []) as unknown as AppRow[],
      credentials: (creds.data ?? []) as unknown as CredentialRow[],
      productionRequests: (prod.data ?? []) as unknown as ProductionRequestRow[],
      brokerRequests: (broker.data ?? []) as unknown as BrokerRequestRow[],
      cases: (cases.data ?? []) as unknown as CaseRow[],
      webhooks: (hooks.data ?? []) as unknown as WebhookRow[],
      analytics: summariseCalls((calls.data ?? []) as unknown as CallRecordLike[]),
      flags: { portal, broker: brokerFlag, production, webhooks },
      isPlatformAdmin: actor.isPlatformAdmin,
    };
  });

/* ------------------------------------------------------- registration */

export const createPartnerRegistration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { partnerKind: PartnerKind; displayName: string; contactEmail: string }) => {
    if (!KINDS.includes(input.partnerKind)) throw new Error("invalid_partner_kind");
    if ((input.displayName ?? "").trim().length < 3) throw new Error("invalid_display_name");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { flagEnabled } = await import("@/lib/atap/partner.server");
    const { writeAuditRow } = await import("@/lib/atap/onboarding.server");
    if (!(await flagEnabled(supabase, "partner.developer_portal"))) {
      throw new Error("developer_portal_disabled");
    }

    const { data: row, error } = await supabase
      .from("partner_registrations")
      .insert({
        partner_kind: data.partnerKind,
        display_name: data.displayName.trim(),
        contact_email: data.contactEmail.trim(),
        created_by: userId,
        is_synthetic: true,
      } as never)
      .select("id")
      .single();
    if (error || !row) throw new Error("registration_create_failed");

    await writeAuditRow(supabase, {
      actor_user_id: userId,
      action: "partner.registration.create",
      subject_type: "partner_registration",
      subject_id: row.id,
      decision: "allow",
      metadata: { partner_kind: data.partnerKind, synthetic: true },
    });
    return { id: row.id as string };
  });

export const submitPartnerRegistration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      registrationId: string;
      intendedUse: string;
      requestedPurposes: string[];
      contactEmail: string;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { isPartnerStaff } = await import("@/lib/atap/partner.server");
    const { writeAuditRow } = await import("@/lib/atap/onboarding.server");

    if (!(await isPartnerStaff(supabase, userId, data.registrationId))) {
      await writeAuditRow(supabase, {
        actor_user_id: userId,
        action: "partner.registration.submit",
        subject_type: "partner_registration",
        subject_id: data.registrationId,
        decision: "deny",
        metadata: { reason: "not_partner_staff" },
      });
      throw new Error("not_partner_staff");
    }

    const { data: reg } = await supabase
      .from("partner_registrations")
      .select("*")
      .eq("id", data.registrationId)
      .maybeSingle();
    if (!reg) throw new Error("registration_not_found");
    const row = reg as unknown as RegistrationRow;

    const check = checkRegistrationSubmit({
      display_name: row.display_name,
      contact_email: data.contactEmail || row.contact_email,
      intended_use: data.intendedUse,
      requested_purposes: data.requestedPurposes,
      partner_kind: row.partner_kind,
      state: row.state,
    });
    if (!check.ok) throw new Error(check.errors.join(" "));

    // Sandbox tenancy + a sandbox API consumer are provisioned on submission so
    // developers can build against synthetic data during legal/security review.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const tenantType =
      row.partner_kind === "bank" ? "bank" : row.partner_kind === "insurer" ? "insurer" : "agri_business";
    const { data: tenant } = await supabaseAdmin
      .from("tenants")
      .insert({
        name: `${row.display_name} — sandbox (synthetic)`,
        tenant_type: tenantType,
        status: "active",
      } as never)
      .select("id")
      .single();

    await supabase
      .from("partner_registrations")
      .update({
        intended_use: data.intendedUse.trim(),
        requested_purposes: data.requestedPurposes,
        contact_email: (data.contactEmail || row.contact_email).trim(),
        state: "submitted",
        sandbox_tenant_id: tenant?.id ?? null,
      } as never)
      .eq("id", data.registrationId);

    // Both gates open in parallel.
    await supabase
      .from("partner_registrations")
      .update({ state: deriveRegistrationState({ ...row, state: "submitted" }) } as never)
      .eq("id", data.registrationId);

    await writeAuditRow(supabase, {
      actor_user_id: userId,
      action: "partner.registration.submit",
      subject_type: "partner_registration",
      subject_id: data.registrationId,
      decision: "allow",
      metadata: {
        requested_purposes: data.requestedPurposes,
        sandbox_tenant_id: tenant?.id ?? null,
      },
    });
    return { ok: true, sandboxTenantId: tenant?.id ?? null };
  });

/** Platform admin records the legal or security review outcome. */
export const decidePartnerGate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      registrationId: string;
      gate: "legal" | "security";
      decision: Exclude<GateStatus, "pending">;
      note: string;
    }) => {
      if (input.gate !== "legal" && input.gate !== "security") throw new Error("invalid_gate");
      if ((input.note ?? "").trim().length < 10) throw new Error("decision_note_required");
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { resolvePartnerActor } = await import("@/lib/atap/partner.server");
    const { writeAuditRow } = await import("@/lib/atap/onboarding.server");
    const actor = await resolvePartnerActor(supabase, userId);
    if (!actor.isPlatformAdmin) {
      await writeAuditRow(supabase, {
        actor_user_id: userId,
        action: `partner.gate.${data.gate}`,
        subject_type: "partner_registration",
        subject_id: data.registrationId,
        decision: "deny",
        metadata: { reason: "platform_admin_required" },
      });
      throw new Error("platform_admin_required");
    }

    const { data: reg } = await supabase
      .from("partner_registrations")
      .select("*")
      .eq("id", data.registrationId)
      .maybeSingle();
    if (!reg) throw new Error("registration_not_found");
    const row = reg as unknown as RegistrationRow;

    const patch: Record<string, unknown> =
      data.gate === "legal"
        ? {
            legal_status: data.decision,
            legal_note: data.note.trim(),
            legal_decided_by: userId,
            legal_decided_at: new Date().toISOString(),
          }
        : {
            security_status: data.decision,
            security_note: data.note.trim(),
            security_decided_by: userId,
            security_decided_at: new Date().toISOString(),
          };

    const nextState = deriveRegistrationState({
      state: row.state === "draft" ? "submitted" : row.state,
      legal_status: data.gate === "legal" ? data.decision : row.legal_status,
      security_status: data.gate === "security" ? data.decision : row.security_status,
    });

    await supabase
      .from("partner_registrations")
      .update({ ...patch, state: nextState } as never)
      .eq("id", data.registrationId);

    await writeAuditRow(supabase, {
      actor_user_id: userId,
      action: `partner.gate.${data.gate}`,
      subject_type: "partner_registration",
      subject_id: data.registrationId,
      decision: "allow",
      metadata: { outcome: data.decision, note: data.note.trim(), next_state: nextState },
    });
    return { state: nextState };
  });

export const suspendPartner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { registrationId: string; note: string }) => {
    if ((input.note ?? "").trim().length < 10) throw new Error("decision_note_required");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { resolvePartnerActor } = await import("@/lib/atap/partner.server");
    const { writeAuditRow } = await import("@/lib/atap/onboarding.server");
    const actor = await resolvePartnerActor(supabase, userId);
    if (!actor.isPlatformAdmin) throw new Error("platform_admin_required");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabase
      .from("partner_registrations")
      .update({ state: "suspended" } as never)
      .eq("id", data.registrationId);
    // Suspension revokes every live credential for the partner.
    const { data: apps } = await supabase
      .from("partner_apps")
      .select("id")
      .eq("registration_id", data.registrationId);
    const appIds = (apps ?? []).map((a) => (a as { id: string }).id);
    if (appIds.length > 0) {
      await supabaseAdmin
        .from("partner_credentials")
        .update({ status: "revoked", revoked_at: new Date().toISOString() } as never)
        .in("app_id", appIds);
    }

    await writeAuditRow(supabase, {
      actor_user_id: userId,
      action: "partner.suspend",
      subject_type: "partner_registration",
      subject_id: data.registrationId,
      decision: "allow",
      metadata: { note: data.note.trim(), credentials_revoked: appIds.length },
    });
    return { ok: true };
  });

/* ------------------------------------------------------------ app + creds */

export const registerPartnerApp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { registrationId: string; name: string; scopes: string[]; redirectUris: string[] }) => {
      if ((input.name ?? "").trim().length < 3) throw new Error("invalid_app_name");
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { isPartnerStaff } = await import("@/lib/atap/partner.server");
    const { writeAuditRow } = await import("@/lib/atap/onboarding.server");
    if (!(await isPartnerStaff(supabase, userId, data.registrationId))) {
      throw new Error("not_partner_staff");
    }

    const { data: reg } = await supabase
      .from("partner_registrations")
      .select("*")
      .eq("id", data.registrationId)
      .maybeSingle();
    if (!reg) throw new Error("registration_not_found");
    const row = reg as unknown as RegistrationRow;
    if (row.state === "draft") throw new Error("submit_registration_first");
    if (row.state === "suspended" || row.state === "rejected") throw new Error("partner_not_active");

    const allowed = scopesForKind(row.partner_kind).map((s) => s.code);
    const scopes = data.scopes.filter((s) => allowed.includes(s));
    if (scopes.length === 0) throw new Error("no_valid_scopes");

    // New apps are ALWAYS sandbox at the sandbox tier: production is a separate
    // approved request, never a client-supplied field.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: consumer } = await supabaseAdmin
      .from("api_consumers")
      .insert({
        name: `${row.display_name} — ${data.name.trim()} (sandbox)`,
        tenant_id: row.sandbox_tenant_id,
        tier: "sandbox",
        status: "active",
        is_first_party: false,
      } as never)
      .select("id")
      .single();

    const { data: app, error } = await supabase
      .from("partner_apps")
      .insert({
        registration_id: data.registrationId,
        consumer_id: consumer?.id ?? null,
        name: data.name.trim(),
        environment: "sandbox",
        tier: "sandbox",
        scopes,
        redirect_uris: data.redirectUris.filter((u) => /^https:\/\//.test(u)),
        rate_limit_per_min: 30,
        created_by: userId,
      } as never)
      .select("id")
      .single();
    if (error || !app) throw new Error("app_create_failed");

    await writeAuditRow(supabase, {
      actor_user_id: userId,
      action: "partner.app.register",
      subject_type: "partner_app",
      subject_id: app.id,
      decision: "allow",
      metadata: { scopes, environment: "sandbox", consumer_id: consumer?.id ?? null },
    });
    return { id: app.id as string };
  });

/** Returns the client secret ONCE; only its hash is persisted. */
export const issuePartnerCredential = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { appId: string; environment: PartnerEnv }) => {
    if (!ENVS.includes(input.environment)) throw new Error("invalid_environment");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { isPartnerStaff, mintCredential } = await import("@/lib/atap/partner.server");
    const { writeAuditRow } = await import("@/lib/atap/onboarding.server");

    const { data: appRow } = await supabase
      .from("partner_apps")
      .select("*")
      .eq("id", data.appId)
      .maybeSingle();
    if (!appRow) throw new Error("app_not_found");
    const app = appRow as unknown as AppRow;
    if (!(await isPartnerStaff(supabase, userId, app.registration_id))) {
      throw new Error("not_partner_staff");
    }

    const { data: reg } = await supabase
      .from("partner_registrations")
      .select("*")
      .eq("id", app.registration_id)
      .maybeSingle();
    const registration = asRegistration(reg as unknown as RegistrationRow);

    if (data.environment === "production") {
      const { data: prod } = await supabase
        .from("partner_production_requests")
        .select("status")
        .eq("app_id", data.appId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const gate = canIssueProductionCredential({
        registration,
        productionRequestStatus: (prod?.status as GateStatus) ?? null,
      });
      if (!gate.ok) {
        await writeAuditRow(supabase, {
          actor_user_id: userId,
          action: "partner.credential.issue",
          subject_type: "partner_app",
          subject_id: data.appId,
          decision: "deny",
          metadata: { environment: "production", reason: gate.reason },
        });
        throw new Error(gate.reason);
      }
    }

    const minted = await mintCredential(data.environment);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: cred, error } = await supabaseAdmin
      .from("partner_credentials")
      .insert({
        app_id: data.appId,
        environment: data.environment,
        client_id: minted.clientId,
        secret_prefix: minted.secretPrefix,
        secret_hash: minted.secretHash,
        scopes: app.scopes,
        issued_by: userId,
      } as never)
      .select("id")
      .single();
    if (error || !cred) throw new Error("credential_issue_failed");

    await writeAuditRow(supabase, {
      actor_user_id: userId,
      action: "partner.credential.issue",
      subject_type: "partner_credential",
      subject_id: cred.id,
      decision: "allow",
      metadata: { environment: data.environment, client_id: minted.clientId, scopes: app.scopes },
    });

    return { clientId: minted.clientId, clientSecret: minted.clientSecret, id: cred.id as string };
  });

export const revokePartnerCredential = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { credentialId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { isPartnerStaff, resolvePartnerActor } = await import("@/lib/atap/partner.server");
    const { writeAuditRow } = await import("@/lib/atap/onboarding.server");

    const { data: cred } = await supabase
      .from("partner_credentials")
      .select("id, app_id")
      .eq("id", data.credentialId)
      .maybeSingle();
    if (!cred) throw new Error("credential_not_found");
    const { data: app } = await supabase
      .from("partner_apps")
      .select("registration_id")
      .eq("id", (cred as { app_id: string }).app_id)
      .maybeSingle();
    const actor = await resolvePartnerActor(supabase, userId);
    const staff = app
      ? await isPartnerStaff(supabase, userId, (app as { registration_id: string }).registration_id)
      : false;
    if (!staff && !actor.isPlatformAdmin) throw new Error("not_authorized");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("partner_credentials")
      .update({ status: "revoked", revoked_at: new Date().toISOString() } as never)
      .eq("id", data.credentialId);

    await writeAuditRow(supabase, {
      actor_user_id: userId,
      action: "partner.credential.revoke",
      subject_type: "partner_credential",
      subject_id: data.credentialId,
      decision: "allow",
      metadata: {},
    });
    return { ok: true };
  });

/* ------------------------------------------------------ production access */

export const requestProductionAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { appId: string; requestedScopes: string[]; requestedTier: ConsumerTier; justification: string }) =>
      input,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { isPartnerStaff, flagEnabled } = await import("@/lib/atap/partner.server");
    const { writeAuditRow } = await import("@/lib/atap/onboarding.server");
    if (!(await flagEnabled(supabase, "partner.production_access"))) {
      throw new Error("production_access_disabled");
    }

    const { data: appRow } = await supabase
      .from("partner_apps")
      .select("*")
      .eq("id", data.appId)
      .maybeSingle();
    if (!appRow) throw new Error("app_not_found");
    const app = appRow as unknown as AppRow;
    if (!(await isPartnerStaff(supabase, userId, app.registration_id))) {
      throw new Error("not_partner_staff");
    }

    const { data: reg } = await supabase
      .from("partner_registrations")
      .select("*")
      .eq("id", app.registration_id)
      .maybeSingle();
    const registration = asRegistration(reg as unknown as RegistrationRow);

    const { data: open } = await supabase
      .from("partner_production_requests")
      .select("id")
      .eq("app_id", data.appId)
      .eq("status", "pending");

    const check = checkProductionRequest({
      registration,
      requestedScopes: data.requestedScopes,
      requestedTier: data.requestedTier,
      justification: data.justification,
      hasOpenRequest: (open ?? []).length > 0,
    });
    if (!check.ok) throw new Error(check.errors.join(" "));

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("partner_production_requests")
      .insert({
        registration_id: app.registration_id,
        app_id: data.appId,
        requested_scopes: data.requestedScopes,
        requested_tier: data.requestedTier,
        justification: data.justification.trim(),
        requested_by: userId,
      } as never)
      .select("id")
      .single();
    if (error || !row) throw new Error("production_request_failed");

    await writeAuditRow(supabase, {
      actor_user_id: userId,
      action: "partner.production.request",
      subject_type: "partner_production_request",
      subject_id: row.id,
      decision: "allow",
      metadata: { scopes: data.requestedScopes, tier: data.requestedTier },
    });
    return { id: row.id as string };
  });

export const decideProductionAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { requestId: string; decision: Exclude<GateStatus, "pending">; note: string }) => {
      if ((input.note ?? "").trim().length < 10) throw new Error("decision_note_required");
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { resolvePartnerActor } = await import("@/lib/atap/partner.server");
    const { writeAuditRow } = await import("@/lib/atap/onboarding.server");
    const actor = await resolvePartnerActor(supabase, userId);
    if (!actor.isPlatformAdmin) {
      await writeAuditRow(supabase, {
        actor_user_id: userId,
        action: "partner.production.decide",
        subject_type: "partner_production_request",
        subject_id: data.requestId,
        decision: "deny",
        metadata: { reason: "platform_admin_required" },
      });
      throw new Error("platform_admin_required");
    }

    const { data: reqRow } = await supabase
      .from("partner_production_requests")
      .select("*")
      .eq("id", data.requestId)
      .maybeSingle();
    if (!reqRow) throw new Error("request_not_found");
    const request = reqRow as unknown as ProductionRequestRow;

    const { data: reg } = await supabase
      .from("partner_registrations")
      .select("*")
      .eq("id", request.registration_id)
      .maybeSingle();
    const registration = asRegistration(reg as unknown as RegistrationRow);

    // Approval is impossible before both legal and security signed off.
    if (data.decision === "approved" && !isProductionEligible(registration)) {
      await writeAuditRow(supabase, {
        actor_user_id: userId,
        action: "partner.production.decide",
        subject_type: "partner_production_request",
        subject_id: data.requestId,
        decision: "deny",
        metadata: { reason: "legal_and_security_approval_required" },
      });
      throw new Error("legal_and_security_approval_required");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("partner_production_requests")
      .update({
        status: data.decision,
        decision_note: data.note.trim(),
        decided_by: userId,
        decided_at: new Date().toISOString(),
      } as never)
      .eq("id", data.requestId);

    let productionAppId: string | null = null;
    if (data.decision === "approved") {
      // A separate production app + production consumer: environments never share
      // a consumer identity or a credential.
      const { data: sandboxApp } = await supabase
        .from("partner_apps")
        .select("*")
        .eq("id", request.app_id)
        .maybeSingle();
      const app = sandboxApp as unknown as AppRow;
      const { data: consumer } = await supabaseAdmin
        .from("api_consumers")
        .insert({
          name: `${app.name} (production)`,
          tier: request.requested_tier,
          status: "active",
          is_first_party: false,
        } as never)
        .select("id")
        .single();
      const { data: prodApp } = await supabaseAdmin
        .from("partner_apps")
        .insert({
          registration_id: request.registration_id,
          consumer_id: consumer?.id ?? null,
          name: `${app.name} (production)`,
          environment: "production",
          tier: request.requested_tier,
          scopes: request.requested_scopes,
          rate_limit_per_min: request.requested_tier === "premium" ? 3000 : 300,
          created_by: userId,
        } as never)
        .select("id")
        .single();
      productionAppId = (prodApp?.id as string) ?? null;
    }

    await writeAuditRow(supabase, {
      actor_user_id: userId,
      action: "partner.production.decide",
      subject_type: "partner_production_request",
      subject_id: data.requestId,
      decision: "allow",
      metadata: {
        outcome: data.decision,
        note: data.note.trim(),
        production_app_id: productionAppId,
      },
    });
    return { ok: true, productionAppId };
  });

/* --------------------------------------------------------- consent broker */

export const createConsentBrokerRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { appId: string; subjectEmail?: string; subjectUserId?: string; scope: string; reason: string }) =>
      input,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { isPartnerStaff, flagEnabled } = await import("@/lib/atap/partner.server");
    const { writeAuditRow } = await import("@/lib/atap/onboarding.server");
    if (!(await flagEnabled(supabase, "partner.consent_broker"))) throw new Error("consent_broker_disabled");

    const { data: appRow } = await supabase.from("partner_apps").select("*").eq("id", data.appId).maybeSingle();
    if (!appRow) throw new Error("app_not_found");
    const app = appRow as unknown as AppRow;
    if (!(await isPartnerStaff(supabase, userId, app.registration_id))) throw new Error("not_partner_staff");

    const { data: reg } = await supabase
      .from("partner_registrations")
      .select("*")
      .eq("id", app.registration_id)
      .maybeSingle();
    const registration = asRegistration(reg as unknown as RegistrationRow);

    const subjectUserId = (data.subjectUserId ?? "").trim() || null;
    const plan = planConsentBrokerRequest({
      scope: data.scope,
      registration,
      tier: app.tier,
      environment: app.environment,
      subjectUserId,
      reason: data.reason,
    });
    if (!plan.ok || !plan.purposeCode || !subjectUserId) {
      throw new Error(plan.errors.join(" ") || "invalid_consent_request");
    }
    if (!app.scopes.includes(data.scope)) throw new Error("scope_not_granted_to_app");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("consent_broker_requests")
      .insert({
        app_id: data.appId,
        consumer_id: app.consumer_id,
        subject_user_id: subjectUserId,
        purpose_code: plan.purposeCode,
        environment: app.environment,
        requested_scopes: [data.scope],
        reason: data.reason.trim(),
      } as never)
      .select("id")
      .single();
    if (error || !row) throw new Error("consent_request_failed");

    await writeAuditRow(supabase, {
      actor_user_id: userId,
      action: "consent.broker.request",
      subject_type: "user",
      subject_id: subjectUserId,
      purpose_code: plan.purposeCode,
      decision: "allow",
      metadata: { app_id: data.appId, scope: data.scope, environment: app.environment },
    });
    return { id: row.id as string, purposeCode: plan.purposeCode };
  });

/** The farmer — and only the farmer — decides. */
export const respondToConsentBrokerRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { requestId: string; approve: boolean; durationDays?: number }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { writeAuditRow } = await import("@/lib/atap/onboarding.server");

    const { data: reqRow } = await supabase
      .from("consent_broker_requests")
      .select("*")
      .eq("id", data.requestId)
      .maybeSingle();
    if (!reqRow) throw new Error("request_not_found");
    const request = reqRow as unknown as BrokerRequestRow & { consumer_id: string | null };
    if (request.subject_user_id !== userId) {
      await writeAuditRow(supabase, {
        actor_user_id: userId,
        action: "consent.broker.respond",
        subject_type: "consent_broker_request",
        subject_id: data.requestId,
        decision: "deny",
        metadata: { reason: "not_consent_subject" },
      });
      throw new Error("not_consent_subject");
    }
    if (request.status !== "pending") throw new Error("request_already_decided");

    let grantId: string | null = null;
    if (data.approve && request.consumer_id) {
      const days = Math.min(Math.max(data.durationDays ?? 90, 1), 365);
      // Consent grant is written by the SUBJECT's own client under their RLS
      // policy — a partner can never author their own grant.
      const { data: grant, error } = await supabase
        .from("consent_grants")
        .insert({
          subject_user_id: userId,
          consumer_id: request.consumer_id,
          purpose_code: request.purpose_code,
          expires_at: new Date(Date.now() + days * 86_400_000).toISOString(),
        } as never)
        .select("id")
        .single();
      if (error || !grant) throw new Error("consent_grant_failed");
      grantId = grant.id as string;
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("consent_broker_requests")
      .update({
        status: data.approve ? "granted" : "refused",
        grant_id: grantId,
        decided_at: new Date().toISOString(),
      } as never)
      .eq("id", data.requestId);

    await writeAuditRow(supabase, {
      actor_user_id: userId,
      action: "consent.broker.respond",
      subject_type: "consent_broker_request",
      subject_id: data.requestId,
      purpose_code: request.purpose_code,
      decision: "allow",
      metadata: { approved: data.approve, grant_id: grantId },
    });
    return { ok: true, grantId };
  });

export const revokeBrokeredConsent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { requestId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { writeAuditRow } = await import("@/lib/atap/onboarding.server");

    const { data: reqRow } = await supabase
      .from("consent_broker_requests")
      .select("*")
      .eq("id", data.requestId)
      .maybeSingle();
    if (!reqRow) throw new Error("request_not_found");
    const request = reqRow as unknown as BrokerRequestRow & { grant_id: string | null };
    if (request.subject_user_id !== userId) throw new Error("not_consent_subject");

    if (request.grant_id) {
      await supabase
        .from("consent_grants")
        .update({ revoked_at: new Date().toISOString() } as never)
        .eq("id", request.grant_id)
        .eq("subject_user_id", userId);
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("consent_broker_requests")
      .update({ status: "revoked", decided_at: new Date().toISOString() } as never)
      .eq("id", data.requestId);

    await writeAuditRow(supabase, {
      actor_user_id: userId,
      action: "consent.broker.revoke",
      subject_type: "consent_broker_request",
      subject_id: data.requestId,
      purpose_code: request.purpose_code,
      decision: "allow",
      metadata: { grant_id: request.grant_id },
    });
    return { ok: true };
  });

/* ------------------------------------------------------- governed API call */

export interface ApiCallResult {
  decision: "allow" | "deny";
  reason: string;
  statusCode: number;
  latencyMs: number;
  purposeCode: string | null;
  humanDecisionRequired: boolean;
  /** Present only when consent allowed a farmer-data read. */
  payload: Record<string, unknown> | null;
}

/**
 * The single governed API entry point used by the bank credit-signal shell,
 * the insurer evidence shell and generic agritech access. First-party and
 * third-party callers reach the same evaluator with the same inputs.
 */
export const callGovernedApi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { credentialId: string; scope: string; targetEnvironment: PartnerEnv; subjectUserId?: string }) => {
      if (!ENVS.includes(input.targetEnvironment)) throw new Error("invalid_environment");
      return input;
    },
  )
  .handler(async ({ data, context }): Promise<ApiCallResult> => {
    const started = Date.now();
    const { supabase, userId } = context;
    const { isPartnerStaff, logApiCall, syntheticSandboxSubject } = await import(
      "@/lib/atap/partner.server"
    );
    const { writeAuditRow } = await import("@/lib/atap/onboarding.server");

    const { data: credRow } = await supabase
      .from("partner_credentials")
      .select("*")
      .eq("id", data.credentialId)
      .maybeSingle();
    if (!credRow) throw new Error("credential_not_found");
    const credential = credRow as unknown as CredentialRow;

    const { data: appRow } = await supabase
      .from("partner_apps")
      .select("*")
      .eq("id", credential.app_id)
      .maybeSingle();
    if (!appRow) throw new Error("app_not_found");
    const app = appRow as unknown as AppRow;
    if (!(await isPartnerStaff(supabase, userId, app.registration_id))) throw new Error("not_partner_staff");

    const { data: regRow } = await supabase
      .from("partner_registrations")
      .select("*")
      .eq("id", app.registration_id)
      .maybeSingle();
    const registration = asRegistration(regRow as unknown as RegistrationRow);

    const { data: consumerRow } = app.consumer_id
      ? await supabase
          .from("api_consumers")
          .select("id, status, tier, is_first_party")
          .eq("id", app.consumer_id)
          .maybeSingle()
      : { data: null };
    const consumer = consumerRow as
      | { id: string; status: string; tier: ConsumerTier; is_first_party: boolean }
      | null;

    const subjectUserId = (data.subjectUserId ?? "").trim() || null;
    const purpose = scopeDef(data.scope)?.purposeCode ?? null;

    // Consent lookup runs with the service client because the caller is the
    // partner, not the subject — but it can only ever FIND grants, never make them.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const grants =
      purpose && subjectUserId && consumer
        ? ((
            await supabaseAdmin
              .from("consent_grants")
              .select("purpose_code, consumer_id, revoked_at, expires_at")
              .eq("subject_user_id", subjectUserId)
              .eq("consumer_id", consumer.id)
          ).data ?? [])
        : [];

    const result = evaluateApiAccess(
      {
        scope: data.scope,
        targetEnvironment: data.targetEnvironment,
        credential: {
          environment: credential.environment,
          status: credential.status,
          revoked_at: credential.revoked_at,
          scopes: credential.scopes,
        },
        appScopes: app.scopes,
        tier: consumer?.tier ?? app.tier,
        consumerId: consumer?.id ?? "unknown",
        consumerStatus: (consumer?.status as "active" | "suspended" | "revoked") ?? "revoked",
        registration,
        subjectUserId,
      },
      grants,
    );

    // Sandbox always answers from the synthetic dataset; production farmer data
    // is only ever reachable through an allowed, consented production call.
    let payload: Record<string, unknown> | null = null;
    if (result.decision === "allow") {
      payload = result.returnsFarmerData
        ? {
            ...syntheticSandboxSubject(subjectUserId ?? "anon"),
            environment: data.targetEnvironment,
            purpose_code: result.purposeCode,
            advisory_only: true,
          }
        : { scope: data.scope, environment: data.targetEnvironment, records: [] };
    }

    const latencyMs = Date.now() - started;
    const statusCode = result.decision === "allow" ? 200 : 403;

    await logApiCall(supabaseAdmin as never, {
      app_id: app.id,
      registration_id: app.registration_id,
      environment: data.targetEnvironment,
      endpoint: data.scope,
      purpose_code: result.purposeCode,
      subject_user_id: subjectUserId,
      outcome: result.decision,
      deny_reason: result.decision === "deny" ? result.reason : null,
      status_code: statusCode,
      latency_ms: latencyMs,
      is_first_party: consumer?.is_first_party ?? false,
      tier: consumer?.tier ?? app.tier,
    });

    await writeAuditRow(supabase, {
      actor_user_id: userId,
      action: "partner.api.call",
      subject_type: subjectUserId ? "user" : "partner_app",
      subject_id: subjectUserId ?? app.id,
      purpose_code: result.purposeCode,
      decision: result.decision,
      metadata: {
        scope: data.scope,
        environment: data.targetEnvironment,
        credential_environment: credential.environment,
        reason: result.reason,
        returned_farmer_data: result.returnsFarmerData,
        latency_ms: latencyMs,
        tier: consumer?.tier ?? app.tier,
        is_first_party: consumer?.is_first_party ?? false,
      },
    });

    return {
      decision: result.decision,
      reason: result.reason,
      statusCode,
      latencyMs,
      purposeCode: result.purposeCode,
      humanDecisionRequired: result.humanDecisionRequired,
      payload,
    };
  });

/* ------------------------------------------------------- workflow shells */

export const openWorkflowCase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { appId: string; kind: PartnerCaseKind; subjectUserId?: string; summary: string }) => input,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { isPartnerStaff, flagEnabled, syntheticSandboxSubject } = await import(
      "@/lib/atap/partner.server"
    );
    const { writeAuditRow } = await import("@/lib/atap/onboarding.server");

    const { data: appRow } = await supabase.from("partner_apps").select("*").eq("id", data.appId).maybeSingle();
    if (!appRow) throw new Error("app_not_found");
    const app = appRow as unknown as AppRow;
    if (!(await isPartnerStaff(supabase, userId, app.registration_id))) throw new Error("not_partner_staff");

    const flagKey =
      data.kind === "claim" ? "partner.insurer_claims_workflow" : "partner.bank_loan_workflow";
    if (data.kind !== "advisory" && !(await flagEnabled(supabase, flagKey))) {
      throw new Error("workflow_not_activated");
    }

    const purposeCode =
      data.kind === "claim" ? "crop_insurance" : data.kind === "advisory" ? "advisory" : "credit_assessment";
    const subjectUserId = (data.subjectUserId ?? "").trim() || null;
    const signals = subjectUserId ? syntheticSandboxSubject(subjectUserId) : {};

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("partner_workflow_cases")
      .insert({
        app_id: data.appId,
        registration_id: app.registration_id,
        kind: data.kind,
        environment: app.environment,
        subject_user_id: subjectUserId,
        purpose_code: purposeCode,
        payload: { summary: data.summary.trim() },
        signals,
        requires_human_decision: true,
        created_by: userId,
      } as never)
      .select("id")
      .single();
    if (error || !row) throw new Error("case_create_failed");

    await writeAuditRow(supabase, {
      actor_user_id: userId,
      action: "partner.case.open",
      subject_type: "partner_workflow_case",
      subject_id: row.id,
      purpose_code: purposeCode,
      decision: "allow",
      metadata: { kind: data.kind, environment: app.environment, ...summariseSignals(signals) },
    });
    return { id: row.id as string };
  });

export const transitionWorkflowCase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { caseId: string; next: PartnerCaseStatus; decisionNote: string }) => input,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { isPartnerStaff } = await import("@/lib/atap/partner.server");
    const { writeAuditRow } = await import("@/lib/atap/onboarding.server");

    const { data: caseRow } = await supabase
      .from("partner_workflow_cases")
      .select("*")
      .eq("id", data.caseId)
      .maybeSingle();
    if (!caseRow) throw new Error("case_not_found");
    const kase = caseRow as unknown as CaseRow;
    const staff = await isPartnerStaff(supabase, userId, kase.registration_id);
    if (!staff) throw new Error("not_partner_staff");

    // Reaching review requires a currently-allowed consented read.
    let accessAllowed = true;
    if (data.next === "awaiting_human_decision" && kase.subject_user_id && kase.purpose_code) {
      const { data: ok } = await supabase.rpc("has_consent", {
        _subject_user_id: kase.subject_user_id,
        _purpose_code: kase.purpose_code,
        _consumer_id: (
          (await supabase.from("partner_apps").select("consumer_id").eq("id", kase.app_id).maybeSingle())
            .data as { consumer_id: string | null } | null
        )?.consumer_id as string,
      });
      accessAllowed = Boolean(ok);
    }

    const plan = planCaseTransition({
      kind: kase.kind,
      current: kase.status,
      next: data.next,
      // Only a signed-in authorized partner human may decide; automation cannot
      // reach this server function without a session.
      actorIsAuthorizedHuman: staff,
      decisionNote: data.decisionNote ?? "",
      accessAllowed,
    });
    if (!plan.ok) {
      await writeAuditRow(supabase, {
        actor_user_id: userId,
        action: "partner.case.transition",
        subject_type: "partner_workflow_case",
        subject_id: data.caseId,
        decision: "deny",
        metadata: { reason: plan.error, attempted: data.next },
      });
      throw new Error(plan.error);
    }

    const isDecision = data.next === "approved" || data.next === "declined";
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("partner_workflow_cases")
      .update({
        status: plan.status,
        decision_note: isDecision ? data.decisionNote.trim() : kase.decision_note,
        decided_by: isDecision ? userId : null,
        decided_at: isDecision ? new Date().toISOString() : null,
      } as never)
      .eq("id", data.caseId);

    await writeAuditRow(supabase, {
      actor_user_id: userId,
      action: "partner.case.transition",
      subject_type: "partner_workflow_case",
      subject_id: data.caseId,
      purpose_code: kase.purpose_code,
      decision: "allow",
      metadata: {
        from: kase.status,
        to: plan.status,
        human_decision: isDecision,
        note: isDecision ? data.decisionNote.trim() : null,
      },
    });
    return { status: plan.status };
  });

/* ------------------------------------------------------------- webhooks */

export const configurePartnerWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { appId: string; targetUrl: string; eventTypes: string[] }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { isPartnerStaff, flagEnabled, webhookSecret } = await import("@/lib/atap/partner.server");
    const { writeAuditRow } = await import("@/lib/atap/onboarding.server");

    const { data: appRow } = await supabase.from("partner_apps").select("*").eq("id", data.appId).maybeSingle();
    if (!appRow) throw new Error("app_not_found");
    const app = appRow as unknown as AppRow;
    if (!(await isPartnerStaff(supabase, userId, app.registration_id))) throw new Error("not_partner_staff");

    const { data: reg } = await supabase
      .from("partner_registrations")
      .select("*")
      .eq("id", app.registration_id)
      .maybeSingle();
    const registration = asRegistration(reg as unknown as RegistrationRow);

    const check = canConfigureWebhook({
      registration,
      flagEnabled: await flagEnabled(supabase, "partner.webhooks"),
      environment: app.environment,
      targetUrl: data.targetUrl,
    });
    if (!check.ok) throw new Error(check.errors.join(" "));

    const secret = await webhookSecret();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("partner_webhooks")
      .insert({
        app_id: data.appId,
        environment: app.environment,
        target_url: data.targetUrl.trim(),
        event_types: data.eventTypes,
        secret_prefix: secret.prefix,
        secret_hash: secret.hash,
        is_active: true,
        created_by: userId,
      } as never)
      .select("id")
      .single();
    if (error || !row) throw new Error("webhook_create_failed");

    await writeAuditRow(supabase, {
      actor_user_id: userId,
      action: "partner.webhook.configure",
      subject_type: "partner_webhook",
      subject_id: row.id,
      decision: "allow",
      metadata: { environment: app.environment, event_types: data.eventTypes },
    });
    return { id: row.id as string, signingSecret: secret.secret };
  });
