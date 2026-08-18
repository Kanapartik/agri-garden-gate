import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  baselineConsentActive,
  centroidOf,
  checkActorSubject,
  decideIdentityCheck,
  estimateAreaAcres,
  firstValueActions,
  funnelMetrics,
  mayAcceptConsentFor,
  partnerConsentCards,
  partnerReadDecision,
  planFarmSync,
  validateBoundary,
  type BoundaryPoint,
  type ConsumerLike,
  type FirstValueAction,
  type FunnelEventRow,
  type FunnelMetrics,
  type IdentityCheckStatus,
  type LocalFarmDraft,
  type OnboardingChannel,
  type PartnerConsentCard,
  type PurposeLike,
  type ServerFarmRecord,
} from "@/lib/atap/farmer";
import type { AtapEnv, FlagDef } from "@/lib/atap/onboarding";
import type { ConsumerTier } from "@/lib/atap/policy";

const CHANNELS: OnboardingChannel[] = [
  "self_service",
  "fpo_assisted",
  "govt_camp_assisted",
  "field_agent_assisted",
];

export interface FarmRow {
  id: string;
  client_draft_id: string;
  label: string;
  plot_ref: string;
  village_code: string | null;
  primary_crop: string | null;
  area_acres: number | null;
  boundary: BoundaryPoint[];
  baseline_profile: Record<string, string | number | boolean | null>;
  sync_state: string;
  channel: OnboardingChannel;
  captured_by_user_id: string | null;
  farmer_user_id: string;
  client_updated_at: string | null;
  updated_at: string;
}

export interface FarmerWorkspace {
  env: AtapEnv;
  flags: FlagDef[];
  userId: string;
  canAssist: boolean;
  farms: FarmRow[];
  identityChecks: Array<{
    id: string;
    status: IdentityCheckStatus;
    reason_category: string | null;
    adapter_name: string;
    jurisdiction_code: string;
    subject_user_id: string;
    manual_review_note: string | null;
    created_at: string;
  }>;
  baselinePolicyVersion: string;
  baselineAccepted: boolean;
  partnerCards: PartnerConsentCard[];
  firstValue: FirstValueAction[];
  metrics: FunnelMetrics;
  canSeeMetrics: boolean;
}

/** Everything the signed-in farmer (or assisting agent) may see. */
export const getFarmerWorkspace = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<FarmerWorkspace> => {
    const { supabase, userId } = context;
    const { atapEnv } = await import("@/lib/atap/onboarding.server");
    const { assistedActorRoles, baselinePolicyVersion, isPlatformAdmin } = await import(
      "@/lib/atap/farmer.server"
    );

    const [
      flagsRes,
      farmsRes,
      checksRes,
      consentsRes,
      grantsRes,
      consumersRes,
      purposesRes,
      funnelRes,
      actor,
      admin,
      version,
    ] = await Promise.all([
      supabase.from("feature_flags").select("key, label, enabled, environments"),
      supabase
        .from("farm_records")
        .select(
          "id, client_draft_id, label, plot_ref, village_code, primary_crop, area_acres, boundary, baseline_profile, sync_state, channel, captured_by_user_id, farmer_user_id, client_updated_at, updated_at",
        )
        .order("updated_at", { ascending: false })
        .limit(50),
      supabase
        .from("identity_verification_checks")
        .select(
          "id, status, reason_category, adapter_name, jurisdiction_code, subject_user_id, manual_review_note, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(20),
      supabase.from("baseline_consents").select("policy_version, revoked_at").eq("subject_user_id", userId),
      supabase
        .from("consent_grants")
        .select("purpose_code, consumer_id, revoked_at, expires_at")
        .eq("subject_user_id", userId),
      supabase.from("api_consumers").select("id, name, tier, status, is_first_party"),
      supabase.from("data_purposes").select("code, label, description, requires_explicit_consent"),
      supabase
        .from("onboarding_funnel_events")
        .select("event_code, channel, subject_user_id")
        .limit(1000),
      assistedActorRoles(supabase, userId),
      isPlatformAdmin(supabase, userId),
      baselinePolicyVersion(supabase),
    ]);

    const flags = (flagsRes.data ?? []).map((f) => ({
      key: f.key,
      label: f.label,
      enabled: f.enabled,
      environments: Array.isArray(f.environments) ? (f.environments as string[]) : [],
    }));
    const env = atapEnv();

    return {
      env,
      flags,
      userId,
      canAssist: actor.canAssist,
      farms: (farmsRes.data ?? []) as unknown as FarmRow[],
      identityChecks: (checksRes.data ?? []) as FarmerWorkspace["identityChecks"],
      baselinePolicyVersion: version,
      baselineAccepted: baselineConsentActive(consentsRes.data ?? [], version),
      partnerCards: partnerConsentCards(
        (consumersRes.data ?? []) as unknown as ConsumerLike[],
        (purposesRes.data ?? []) as unknown as PurposeLike[],
        grantsRes.data ?? [],
      ),
      firstValue: firstValueActions(flags, env),
      metrics: funnelMetrics((funnelRes.data ?? []) as unknown as FunnelEventRow[]),
      canSeeMetrics: admin || actor.canAssist,
    };
  });

/* --------------------------------------------- identity verification */

export const runIdentityCheck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      reference: string;
      subjectUserId?: string;
      channel: OnboardingChannel;
      applicationId?: string;
    }) => {
      const reference = (input.reference ?? "").trim();
      if (reference.length < 4 || reference.length > 64) throw new Error("invalid_reference");
      if (!CHANNELS.includes(input.channel)) throw new Error("invalid_channel");
      return { ...input, reference };
    },
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { adapters } = await import("@/lib/adapters");
    const { assistedActorRoles, hashIdentityReference, jurisdictionCode, logFunnelEvent } =
      await import("@/lib/atap/farmer.server");
    const { writeAuditRow } = await import("@/lib/atap/onboarding.server");

    const subjectUserId = data.subjectUserId || userId;
    const gate = checkActorSubject({ actorUserId: userId, subjectUserId, channel: data.channel });
    if (!gate.ok) throw new Error(gate.reason);

    if (subjectUserId !== userId) {
      const actor = await assistedActorRoles(supabase, userId);
      if (!actor.canAssist) {
        await writeAuditRow(supabase, {
          actor_user_id: userId,
          action: "identity.check.run",
          subject_type: "user",
          subject_id: subjectUserId,
          decision: "deny",
          metadata: { reason: "assisted_role_required", channel: data.channel },
        });
        throw new Error("assisted_role_required");
      }
    }

    const jurisdiction = await jurisdictionCode(supabase);
    const referenceHash = await hashIdentityReference(jurisdiction, data.reference);

    // Duplicate identity detection: same reference already attached to another subject.
    const { data: dupes } = await supabase
      .from("identity_verification_checks")
      .select("id, subject_user_id")
      .eq("reference_hash", referenceHash)
      .neq("subject_user_id", subjectUserId)
      .limit(1);

    const result = await adapters.jurisdictionIdentity.verify({
      jurisdictionCode: jurisdiction,
      referenceHash,
    });
    const decision = decideIdentityCheck(result, { duplicateExists: (dupes ?? []).length > 0 });

    const { data: inserted, error } = await supabase
      .from("identity_verification_checks")
      .insert({
        subject_user_id: subjectUserId,
        requested_by_user_id: userId,
        application_id: data.applicationId ?? null,
        jurisdiction_code: jurisdiction,
        adapter_name: adapters.jurisdictionIdentity.name,
        status: decision.status,
        reference_hash: referenceHash,
        evidence_ref: result.evidenceRef,
        reason_category: decision.reasonCategory,
        is_synthetic: result.synthetic,
      } as never)
      .select("id")
      .single();
    if (error || !inserted) throw new Error("identity_check_write_failed");

    await writeAuditRow(supabase, {
      actor_user_id: userId,
      action: "identity.check.run",
      subject_type: "identity_verification_check",
      subject_id: inserted.id,
      decision: "allow",
      metadata: {
        status: decision.status,
        reason_category: decision.reasonCategory,
        adapter: adapters.jurisdictionIdentity.name,
        channel: data.channel,
        actor_is_subject: gate.actorIsSubject,
        synthetic: result.synthetic,
      },
    });

    await logFunnelEvent(supabase, {
      subject_user_id: subjectUserId,
      actor_user_id: userId,
      application_id: data.applicationId ?? null,
      role_code: "farmer",
      channel: data.channel,
      event_code: decision.requiresHumanReview ? "ManualReviewRequested" : "VerificationPassed",
      metadata: { status: decision.status, reason_category: decision.reasonCategory },
    });

    return { id: inserted.id, ...decision };
  });

/** Manual-review fallback: only a platform admin resolves a held check. */
export const resolveIdentityCheck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { checkId: string; status: "verified" | "failed"; note?: string }) => {
    if (input.status !== "verified" && input.status !== "failed") throw new Error("invalid_status");
    if (!input.checkId) throw new Error("invalid_input");
    return { ...input, note: (input.note ?? "").slice(0, 500) };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { isPlatformAdmin } = await import("@/lib/atap/farmer.server");
    const { writeAuditRow } = await import("@/lib/atap/onboarding.server");

    if (!(await isPlatformAdmin(supabase, userId))) {
      await writeAuditRow(supabase, {
        actor_user_id: userId,
        action: "identity.check.resolve",
        subject_type: "identity_verification_check",
        subject_id: data.checkId,
        decision: "deny",
        metadata: { reason: "not_authorized" },
      });
      throw new Error("not_authorized");
    }

    const { error } = await supabase
      .from("identity_verification_checks")
      .update({
        status: data.status,
        manual_review_note: data.note || null,
        decided_by: userId,
        decided_at: new Date().toISOString(),
      } as never)
      .eq("id", data.checkId);
    if (error) throw new Error("resolve_failed");

    await writeAuditRow(supabase, {
      actor_user_id: userId,
      action: "identity.check.resolve",
      subject_type: "identity_verification_check",
      subject_id: data.checkId,
      decision: "allow",
      metadata: { status: data.status, human_reviewer: true },
    });
    return { ok: true };
  });

/* -------------------------------------------------- farm/parcel sync */

/**
 * Idempotent sync of offline parcel drafts. Replaying the same queue after a
 * reconnect updates the same records (keyed by `client_draft_id`) and never
 * creates a duplicate farm.
 */
export const syncFarmDrafts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { drafts: LocalFarmDraft[]; subjectUserId?: string; applicationId?: string }) => {
      if (!Array.isArray(input.drafts) || input.drafts.length === 0) throw new Error("no_drafts");
      if (input.drafts.length > 20) throw new Error("too_many_drafts");
      for (const draft of input.drafts) {
        if (!draft.clientDraftId || draft.clientDraftId.length > 80) throw new Error("invalid_draft_id");
        if (!draft.plotRef || draft.plotRef.length > 40) throw new Error("invalid_plot_ref");
        if (!draft.label || draft.label.length > 120) throw new Error("invalid_label");
        if (!CHANNELS.includes(draft.channel)) throw new Error("invalid_channel");
        const check = validateBoundary(draft.boundary ?? []);
        if (!check.ok) throw new Error(check.reason);
      }
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { assistedActorRoles, logFunnelEvent } = await import("@/lib/atap/farmer.server");
    const { writeAuditRow } = await import("@/lib/atap/onboarding.server");

    const subjectUserId = data.subjectUserId || userId;
    const assisted = subjectUserId !== userId;
    if (assisted) {
      const actor = await assistedActorRoles(supabase, userId);
      if (!actor.canAssist) throw new Error("assisted_role_required");
    }

    const { data: existing } = await supabase
      .from("farm_records")
      .select("id, client_draft_id, plot_ref, client_updated_at")
      .eq("farmer_user_id", subjectUserId);

    const actions = planFarmSync(data.drafts, (existing ?? []) as unknown as ServerFarmRecord[]);
    const results: Array<{ clientDraftId: string; outcome: string; farmId?: string }> = [];

    for (const action of actions) {
      const draft = action.draft;
      const centroid = centroidOf(draft.boundary);
      const payload = {
        farmer_user_id: subjectUserId,
        captured_by_user_id: userId,
        application_id: data.applicationId ?? null,
        channel: draft.channel,
        client_draft_id: draft.clientDraftId,
        label: draft.label,
        plot_ref: draft.plotRef,
        village_code: draft.villageCode ?? null,
        primary_crop: draft.primaryCrop ?? null,
        area_acres: draft.areaAcres ?? estimateAreaAcres(draft.boundary),
        boundary: draft.boundary,
        centroid_lat: centroid?.lat ?? null,
        centroid_lng: centroid?.lng ?? null,
        baseline_profile: draft.baselineProfile ?? {},
        sync_state: "synced",
        client_updated_at: draft.clientUpdatedAt,
      };

      if (action.kind === "insert") {
        const { data: row, error } = await supabase
          .from("farm_records")
          .insert(payload as never)
          .select("id")
          .single();
        if (error || !row) {
          results.push({ clientDraftId: draft.clientDraftId, outcome: "insert_failed" });
          continue;
        }
        results.push({ clientDraftId: draft.clientDraftId, outcome: "created", farmId: row.id });
      } else if (action.kind === "update") {
        const { error } = await supabase
          .from("farm_records")
          .update(payload as never)
          .eq("id", action.recordId);
        results.push({
          clientDraftId: draft.clientDraftId,
          outcome: error ? "update_failed" : "updated",
          farmId: action.recordId,
        });
      } else if (action.kind === "skip") {
        results.push({ clientDraftId: draft.clientDraftId, outcome: "already_current", farmId: action.recordId });
      } else {
        await supabase
          .from("farm_records")
          .update({ sync_state: "conflict" } as never)
          .eq("id", action.recordId);
        results.push({ clientDraftId: draft.clientDraftId, outcome: action.reason, farmId: action.recordId });
      }

      await logFunnelEvent(supabase, {
        subject_user_id: subjectUserId,
        actor_user_id: userId,
        application_id: data.applicationId ?? null,
        role_code: "farmer",
        channel: draft.channel,
        event_code: "FarmDraftSynced",
        metadata: { outcome: results[results.length - 1]?.outcome, plot_ref: draft.plotRef },
      });
    }

    await writeAuditRow(supabase, {
      actor_user_id: userId,
      action: "farm.draft.sync",
      subject_type: "user",
      subject_id: subjectUserId,
      decision: "allow",
      metadata: { assisted, results },
    });

    return { results };
  });

/* --------------------------------------------------------- consent */

export const acceptBaselineConsent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { channel: OnboardingChannel; locale?: string; subjectUserId?: string }) => {
      if (!CHANNELS.includes(input.channel)) throw new Error("invalid_channel");
      return { ...input, locale: (input.locale ?? "en").slice(0, 12) };
    },
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { baselinePolicyVersion, logFunnelEvent } = await import("@/lib/atap/farmer.server");
    const { writeAuditRow } = await import("@/lib/atap/onboarding.server");

    const subjectUserId = data.subjectUserId || userId;
    if (!mayAcceptConsentFor(userId, subjectUserId)) {
      await writeAuditRow(supabase, {
        actor_user_id: userId,
        action: "consent.baseline.accept",
        subject_type: "user",
        subject_id: subjectUserId,
        decision: "deny",
        metadata: { reason: "consent_cannot_be_delegated", channel: data.channel },
      });
      throw new Error("consent_cannot_be_delegated");
    }

    const version = await baselinePolicyVersion(supabase);
    const { error } = await supabase.from("baseline_consents").upsert(
      {
        subject_user_id: userId,
        kind: "baseline_platform",
        policy_version: version,
        locale: data.locale,
        channel: data.channel,
        purposes: ["platform_account", "onboarding_verification"],
        accepted_at: new Date().toISOString(),
        revoked_at: null,
      } as never,
      { onConflict: "subject_user_id,kind,policy_version" },
    );
    if (error) throw new Error("consent_write_failed");

    await writeAuditRow(supabase, {
      actor_user_id: userId,
      action: "consent.baseline.accept",
      subject_type: "user",
      subject_id: userId,
      decision: "allow",
      metadata: { policy_version: version, channel: data.channel },
    });
    await logFunnelEvent(supabase, {
      subject_user_id: userId,
      actor_user_id: userId,
      role_code: "farmer",
      channel: data.channel,
      event_code: "AgreementAccepted",
      metadata: { policy_version: version },
    });
    return { ok: true, policyVersion: version };
  });

export const revokeBaselineConsent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { baselinePolicyVersion, logFunnelEvent } = await import("@/lib/atap/farmer.server");
    const { writeAuditRow } = await import("@/lib/atap/onboarding.server");
    const version = await baselinePolicyVersion(supabase);

    const { error } = await supabase
      .from("baseline_consents")
      .update({ revoked_at: new Date().toISOString() } as never)
      .eq("subject_user_id", userId)
      .eq("policy_version", version);
    if (error) throw new Error("consent_write_failed");

    await writeAuditRow(supabase, {
      actor_user_id: userId,
      action: "consent.baseline.revoke",
      subject_type: "user",
      subject_id: userId,
      decision: "allow",
      metadata: { policy_version: version },
    });
    await logFunnelEvent(supabase, {
      subject_user_id: userId,
      actor_user_id: userId,
      role_code: "farmer",
      channel: "self_service",
      event_code: "ConsentRevoked",
      metadata: { scope: "baseline_platform", policy_version: version },
    });
    return { ok: true };
  });

/** Optional partner consent — granted or revoked by the data subject only. */
export const setPartnerConsent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { consumerId: string; purposeCode: string; decision: "grant" | "revoke" }) => {
      if (input.decision !== "grant" && input.decision !== "revoke") throw new Error("invalid_decision");
      if (!input.consumerId || !input.purposeCode) throw new Error("invalid_input");
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { logFunnelEvent } = await import("@/lib/atap/farmer.server");
    const { writeAuditRow } = await import("@/lib/atap/onboarding.server");

    if (data.decision === "grant") {
      const expires = new Date(Date.now() + 180 * 24 * 60 * 60_000).toISOString();
      const { error } = await supabase.from("consent_grants").upsert(
        {
          subject_user_id: userId,
          purpose_code: data.purposeCode,
          consumer_id: data.consumerId,
          granted_at: new Date().toISOString(),
          expires_at: expires,
          revoked_at: null,
        } as never,
        { onConflict: "subject_user_id,purpose_code,consumer_id" },
      );
      if (error) throw new Error("consent_write_failed");
    } else {
      const { error } = await supabase
        .from("consent_grants")
        .update({ revoked_at: new Date().toISOString() } as never)
        .eq("subject_user_id", userId)
        .eq("purpose_code", data.purposeCode)
        .eq("consumer_id", data.consumerId);
      if (error) throw new Error("consent_write_failed");
    }

    await writeAuditRow(supabase, {
      actor_user_id: userId,
      action: `consent.partner.${data.decision}`,
      subject_type: "consent_grant",
      subject_id: `${data.consumerId}:${data.purposeCode}`,
      purpose_code: data.purposeCode,
      decision: "allow",
      metadata: { consumer_id: data.consumerId },
    });
    await logFunnelEvent(supabase, {
      subject_user_id: userId,
      actor_user_id: userId,
      role_code: "farmer",
      channel: "self_service",
      event_code: data.decision === "grant" ? "ConsentGranted" : "ConsentRevoked",
      metadata: { consumer_id: data.consumerId, purpose_code: data.purposeCode },
    });
    return { ok: true };
  });

/**
 * Consent-scoped partner read of a farmer's baseline farm data. Same code path
 * for first-party and third-party consumers; default-deny without a matching,
 * live consent grant. Every attempt is audited with its deny reason.
 */
export const readFarmDataAsConsumer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { consumerId: string; purposeCode: string; subjectUserId: string }) => {
    if (!input.consumerId || !input.purposeCode || !input.subjectUserId) {
      throw new Error("invalid_input");
    }
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { writeAuditRow } = await import("@/lib/atap/onboarding.server");

    const [{ data: consumer }, { data: grants }] = await Promise.all([
      supabase
        .from("api_consumers")
        .select("id, tier, status, is_first_party")
        .eq("id", data.consumerId)
        .maybeSingle(),
      supabase
        .from("consent_grants")
        .select("purpose_code, consumer_id, revoked_at, expires_at")
        .eq("subject_user_id", data.subjectUserId)
        .eq("consumer_id", data.consumerId),
    ]);

    if (!consumer) throw new Error("consumer_not_found");

    const decision = partnerReadDecision(
      {
        purposeCode: data.purposeCode,
        consumerId: data.consumerId,
        consumerTier: consumer.tier as ConsumerTier,
        consumerStatus: consumer.status as "active" | "suspended" | "revoked",
      },
      grants ?? [],
    );

    await writeAuditRow(supabase, {
      actor_user_id: userId,
      action: "farm.data.read",
      subject_type: "user",
      subject_id: data.subjectUserId,
      purpose_code: data.purposeCode,
      decision: decision.decision,
      metadata: { consumer_id: data.consumerId, reason: decision.reason },
    });

    if (decision.decision === "deny") {
      return { decision: "deny" as const, reason: decision.reason, fields: null };
    }

    const { data: farms } = await supabase
      .from("farm_records")
      .select("id, village_code, area_acres, primary_crop")
      .eq("farmer_user_id", data.subjectUserId);

    return { decision: "allow" as const, reason: decision.reason, fields: farms ?? [] };
  });

/** Welcome / first-value launcher completion. */
export const completeFirstValueAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { actionKey: string; channel: OnboardingChannel }) => {
    if (!input.actionKey || input.actionKey.length > 60) throw new Error("invalid_input");
    if (!CHANNELS.includes(input.channel)) throw new Error("invalid_channel");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { logFunnelEvent } = await import("@/lib/atap/farmer.server");
    const { writeAuditRow } = await import("@/lib/atap/onboarding.server");

    await logFunnelEvent(supabase, {
      subject_user_id: userId,
      actor_user_id: userId,
      role_code: "farmer",
      channel: data.channel,
      event_code: "FirstValueActionCompleted",
      metadata: { action_key: data.actionKey },
    });
    await writeAuditRow(supabase, {
      actor_user_id: userId,
      action: "onboarding.first_value",
      subject_type: "user",
      subject_id: userId,
      decision: "allow",
      metadata: { action_key: data.actionKey, channel: data.channel },
    });
    return { ok: true };
  });
