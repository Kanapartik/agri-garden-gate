/**
 * B6 — multi-district repeatability & first service expansion server functions.
 *
 * Authority is re-checked in every handler; route hiding is presentation only.
 * Every configuration change, activation, approval, dispute and support
 * decision writes an audit row.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  certifiedBadgeVisible,
  checkProviderSubmit,
  compareDistrictEffort,
  evaluateCertification,
  evaluateSubtypeActivation,
  isDomainInScope,
  planDistrictClone,
  planProviderApproval,
  planSupportTransition,
  routeServiceDispute,
  routeSupportCase,
  summariseEffort,
  summariseExpansion,
  usableSubtypes,
  type CertificationCriterion,
  type DistrictTemplate,
  type EffortMetric,
  type EffortVerdict,
  type ExpansionDashboard,
  type ServiceProviderState,
  type ServiceSubtypeConfig,
  type Severity,
  type SupportCaseStatus,
} from "@/lib/atap/expansion";

export interface TemplateRow extends DistrictTemplate {
  id: string;
  label: string;
  description: string;
}

export interface CloneRow {
  id: string;
  template_id: string;
  template_version: number;
  rollout_id: string;
  geography_id: string;
  locale: string;
  cloned_scheme_codes: string[];
  local_roles: string[];
  forked_code: boolean;
  sequence_index: number;
  created_at: string;
}

export interface RolloutLite {
  id: string;
  label: string;
  status: string;
  geography_id: string;
  template_code: string;
}

export interface EffortRow extends EffortMetric {
  id: string;
  currency: string;
  notes: string;
  created_at: string;
}

export interface ProviderRow {
  id: string;
  subtype_code: string;
  display_name: string;
  contact_email: string;
  service_regions: string[];
  state: ServiceProviderState;
  decision_note: string | null;
  created_by: string | null;
  created_at: string;
}

export interface ProviderCheckRow {
  id: string;
  provider_id: string;
  check_code: string;
  label: string;
  status: string;
  note: string | null;
  adapter_name: string;
}

export interface EngagementRow {
  id: string;
  provider_id: string;
  subtype_code: string;
  requester_user_id: string | null;
  title: string;
  status: string;
  scheduled_for: string | null;
  created_at: string;
}

export interface ServiceDisputeRow {
  id: string;
  engagement_id: string;
  subtype_code: string;
  category: string;
  summary: string;
  status: string;
  resolution_note: string | null;
  created_at: string;
}

export interface CertificationRow {
  id: string;
  subject_type: string;
  subject_id: string;
  programme_code: string;
  criteria: CertificationCriterion[];
  state: "draft" | "submitted" | "in_review" | "certified" | "declined" | "revoked";
  badge_awarded_at: string | null;
  badge_expires_at: string | null;
  decision_note: string | null;
  created_by: string | null;
  created_at: string;
}

export interface SupportCaseRow {
  id: string;
  case_type: string;
  subject_type: string;
  subject_id: string;
  rollout_id: string | null;
  severity: string;
  queue: string;
  sla_hours: number;
  summary: string;
  status: SupportCaseStatus;
  assigned_to: string | null;
  resolution_note: string | null;
  created_at: string;
}

export interface ExpansionWorkspace {
  userId: string;
  canConfigure: boolean;
  canSupport: boolean;
  flags: {
    templates: boolean;
    effort: boolean;
    serviceFramework: boolean;
    certification: boolean;
    managedOnboarding: boolean;
  };
  templates: TemplateRow[];
  rollouts: RolloutLite[];
  clones: CloneRow[];
  effort: EffortRow[];
  effortByRollout: ReturnType<typeof summariseEffort>[];
  effortVerdict: EffortVerdict | null;
  subtypes: Array<
    ServiceSubtypeConfig & {
      label: string;
      description: string;
      feature_flag_key: string | null;
      evidence_note: string | null;
      usable: boolean;
      activationErrors: string[];
    }
  >;
  providers: ProviderRow[];
  providerChecks: ProviderCheckRow[];
  engagements: EngagementRow[];
  disputes: ServiceDisputeRow[];
  certifications: Array<CertificationRow & { badgeVisible: boolean }>;
  supportCases: SupportCaseRow[];
  dashboard: ExpansionDashboard;
}

export const getExpansionWorkspace = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ExpansionWorkspace> => {
    const { supabase, userId } = context;
    const {
      resolveExpansionActor,
      canConfigureExpansion,
      canDecideSupport,
      flagEnabled,
      loadSubtypes,
      toSubtypeConfig,
    } = await import("@/lib/atap/expansion.server");

    const actor = await resolveExpansionActor(supabase, userId);
    const canConfigure = canConfigureExpansion(actor);
    const canSupport = canDecideSupport(actor);

    const [templates, rollouts, clones, effort, providers, checks, engagements, disputes, certs, cases] =
      await Promise.all([
        supabase.from("district_templates").select("*").order("code"),
        supabase.from("district_rollouts").select("id, label, status, geography_id, template_code"),
        supabase.from("district_template_clones").select("*").order("sequence_index"),
        supabase.from("onboarding_effort_metrics").select("*").order("created_at"),
        supabase.from("service_providers").select("*").order("created_at", { ascending: false }),
        supabase.from("service_provider_checks").select("*"),
        supabase.from("service_engagements").select("*").order("created_at", { ascending: false }),
        supabase.from("service_disputes").select("*").order("created_at", { ascending: false }),
        supabase.from("partner_certifications").select("*").order("created_at", { ascending: false }),
        supabase.from("support_cases").select("*").order("created_at", { ascending: false }),
      ]);

    const subtypeRows = await loadSubtypes(supabase);
    const subtypes = subtypeRows.map((row) => {
      const config = toSubtypeConfig(row);
      const activation = evaluateSubtypeActivation({ subtype: config });
      return {
        ...config,
        label: row.label,
        description: row.description,
        feature_flag_key: row.feature_flag_key,
        evidence_note: row.evidence_note,
        usable: usableSubtypes([config]).length === 1,
        activationErrors: activation.errors,
      };
    });

    const rolloutRows = (rollouts.data ?? []) as unknown as RolloutLite[];
    const cloneRows = (clones.data ?? []) as unknown as CloneRow[];
    const effortRows = (effort.data ?? []) as unknown as EffortRow[];
    const disputeRows = (disputes.data ?? []) as unknown as ServiceDisputeRow[];
    const caseRows = (cases.data ?? []) as unknown as SupportCaseRow[];
    const certRows = (certs.data ?? []) as unknown as CertificationRow[];
    const now = new Date();

    const ordered = [...cloneRows].sort((a, b) => a.sequence_index - b.sequence_index);
    const baseline = ordered[0]?.rollout_id ?? rolloutRows[0]?.id ?? null;
    const candidate = ordered[1]?.rollout_id ?? rolloutRows[1]?.id ?? null;

    return {
      userId,
      canConfigure,
      canSupport,
      flags: {
        templates: await flagEnabled(supabase, "expansion.district_templates"),
        effort: await flagEnabled(supabase, "expansion.effort_instrumentation"),
        serviceFramework: await flagEnabled(supabase, "expansion.service_framework"),
        certification: await flagEnabled(supabase, "expansion.partner_certification"),
        managedOnboarding: await flagEnabled(supabase, "expansion.managed_onboarding"),
      },
      templates: (templates.data ?? []) as unknown as TemplateRow[],
      rollouts: rolloutRows,
      clones: cloneRows,
      effort: effortRows,
      effortByRollout: rolloutRows.map((r) => summariseEffort(r.id, effortRows)),
      effortVerdict:
        baseline && candidate && baseline !== candidate
          ? compareDistrictEffort({
              baselineRolloutId: baseline,
              candidateRolloutId: candidate,
              metrics: effortRows,
            })
          : null,
      subtypes,
      providers: (providers.data ?? []) as unknown as ProviderRow[],
      providerChecks: (checks.data ?? []) as unknown as ProviderCheckRow[],
      engagements: (engagements.data ?? []) as unknown as EngagementRow[],
      disputes: disputeRows,
      certifications: certRows.map((c) => ({
        ...c,
        badgeVisible: certifiedBadgeVisible({
          state: c.state,
          badgeExpiresAt: c.badge_expires_at,
          now,
        }).visible,
      })),
      supportCases: caseRows,
      dashboard: summariseExpansion({
        rolloutIds: rolloutRows.map((r) => r.id),
        clones: cloneRows,
        subtypes,
        providers: (providers.data ?? []) as unknown as Array<{ state: ServiceProviderState }>,
        disputes: disputeRows,
        supportCases: caseRows,
        now,
      }),
    };
  });

/* ------------------------------------------------- district repeatability */

export const cloneDistrictTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      templateId: string;
      geographyId: string;
      label: string;
      locale: string;
      schemeCodes?: string[];
      localRoles?: string[];
      configOverrides?: Record<string, string | number | boolean>;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { resolveExpansionActor, canConfigureExpansion, flagEnabled } = await import(
      "@/lib/atap/expansion.server"
    );
    const { writeAuditRow } = await import("@/lib/atap/onboarding.server");

    const actor = await resolveExpansionActor(supabase, userId);
    if (!canConfigureExpansion(actor)) throw new Error("not_authorized");
    if (!(await flagEnabled(supabase, "expansion.district_templates"))) {
      throw new Error("district_templates_disabled");
    }

    const { data: templateRow } = await supabase
      .from("district_templates")
      .select("*")
      .eq("id", data.templateId)
      .maybeSingle();
    if (!templateRow) throw new Error("template_not_found");
    const template = templateRow as unknown as TemplateRow;

    const { data: geoRow } = await supabase
      .from("geographies")
      .select("id, level, code, name")
      .eq("id", data.geographyId)
      .maybeSingle();
    if (!geoRow) throw new Error("geography_not_found");
    const geo = geoRow as unknown as { id: string; level: string; code: string; name: string };

    const plan = planDistrictClone({
      template,
      geographyId: data.geographyId,
      geographyLevel: geo.level,
      locale: data.locale,
      ...(data.schemeCodes ? { schemeCodes: data.schemeCodes } : {}),
      ...(data.localRoles ? { localRoles: data.localRoles } : {}),
      ...(data.configOverrides ? { configOverrides: data.configOverrides } : {}),
    });
    if (!plan.ok) {
      await writeAuditRow(supabase, {
        actor_user_id: userId,
        action: "expansion.district.clone",
        subject_type: "district_template",
        subject_id: data.templateId,
        decision: "deny",
        metadata: { errors: plan.errors },
      });
      throw new Error(plan.errors.join(" "));
    }

    const { data: rolloutRow, error: rolloutError } = await supabase
      .from("district_rollouts")
      .insert({
        geography_id: data.geographyId,
        template_code: template.code,
        label: data.label || `${geo.name} rollout`,
        status: "configuring",
        checklist: plan.checklist,
        config: { ...plan.appliedConfig, locale: plan.locale },
        is_synthetic: true,
        created_by: userId,
      } as never)
      .select("id")
      .single();
    if (rolloutError || !rolloutRow) throw new Error("rollout_create_failed");
    const rolloutId = (rolloutRow as { id: string }).id;

    const { count } = await supabase
      .from("district_template_clones")
      .select("id", { count: "exact", head: true })
      .eq("template_id", data.templateId);

    const { data: cloneRow, error: cloneError } = await supabase
      .from("district_template_clones")
      .insert({
        template_id: data.templateId,
        template_version: template.version,
        rollout_id: rolloutId,
        geography_id: data.geographyId,
        locale: plan.locale,
        applied_config: plan.appliedConfig,
        config_overrides: data.configOverrides ?? {},
        cloned_scheme_codes: plan.schemeCodes,
        local_roles: plan.localRoles,
        forked_code: plan.forkedCode,
        sequence_index: (count ?? 0) + 1,
        is_synthetic: true,
        created_by: userId,
      } as never)
      .select("id, sequence_index")
      .single();
    if (cloneError || !cloneRow) throw new Error("clone_record_failed");

    await writeAuditRow(supabase, {
      actor_user_id: userId,
      action: "expansion.district.clone",
      subject_type: "district_rollout",
      subject_id: rolloutId,
      decision: "allow",
      metadata: {
        template_code: template.code,
        template_version: template.version,
        locale: plan.locale,
        forked_code: false,
        sequence_index: (cloneRow as { sequence_index: number }).sequence_index,
      },
    });

    return {
      rolloutId,
      cloneId: (cloneRow as { id: string }).id,
      sequenceIndex: (cloneRow as { sequence_index: number }).sequence_index,
    };
  });

export const recordEffortMetric = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      rolloutId: string;
      cloneId?: string | null;
      phase: string;
      personDays: number;
      costAmount: number;
      onboardedCount: number;
      isOperational: boolean;
      notes: string;
    }) => {
      if (!input.phase.trim()) throw new Error("phase_required");
      if (input.personDays < 0 || input.costAmount < 0) throw new Error("negative_effort");
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { resolveExpansionActor, canConfigureExpansion, flagEnabled } = await import(
      "@/lib/atap/expansion.server"
    );
    const { writeAuditRow } = await import("@/lib/atap/onboarding.server");
    const actor = await resolveExpansionActor(supabase, userId);
    if (!canConfigureExpansion(actor)) throw new Error("not_authorized");
    if (!(await flagEnabled(supabase, "expansion.effort_instrumentation"))) {
      throw new Error("effort_instrumentation_disabled");
    }

    const { data: row, error } = await supabase
      .from("onboarding_effort_metrics")
      .insert({
        rollout_id: data.rolloutId,
        clone_id: data.cloneId ?? null,
        phase: data.phase.trim(),
        person_days: data.personDays,
        cost_amount: data.costAmount,
        onboarded_count: data.onboardedCount,
        is_operational: data.isOperational,
        notes: data.notes,
        is_synthetic: !data.isOperational,
        recorded_by: userId,
      } as never)
      .select("id")
      .single();
    if (error || !row) throw new Error("effort_record_failed");

    await writeAuditRow(supabase, {
      actor_user_id: userId,
      action: "expansion.effort.record",
      subject_type: "district_rollout",
      subject_id: data.rolloutId,
      decision: "allow",
      metadata: {
        phase: data.phase,
        person_days: data.personDays,
        operational: data.isOperational,
      },
    });
    return { id: (row as { id: string }).id };
  });

/* ------------------------------------------------- evidence-gated domains */

export const decideEvidenceGate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      subtypeCode: string;
      gate: "evidence_pending" | "approved" | "rejected";
      note: string;
      activate: boolean;
    }) => {
      if ((input.note ?? "").trim().length < 10) throw new Error("evidence_note_required");
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { resolveExpansionActor, canConfigureExpansion, loadSubtypes, toSubtypeConfig } =
      await import("@/lib/atap/expansion.server");
    const { writeAuditRow } = await import("@/lib/atap/onboarding.server");

    const actor = await resolveExpansionActor(supabase, userId);
    if (!canConfigureExpansion(actor)) throw new Error("not_authorized");

    const rows = await loadSubtypes(supabase);
    const row = rows.find((r) => r.code === data.subtypeCode);
    if (!row) throw new Error("subtype_not_found");
    if (!isDomainInScope(row.domain)) throw new Error("domain_out_of_scope");

    const proposed = { ...toSubtypeConfig(row), evidence_gate: data.gate };
    const activation = evaluateSubtypeActivation({ subtype: proposed });
    const activate = data.activate && activation.ok;
    if (data.activate && !activation.ok) {
      await writeAuditRow(supabase, {
        actor_user_id: userId,
        action: "expansion.subtype.activate",
        subject_type: "service_subtype",
        subject_id: data.subtypeCode,
        decision: "deny",
        metadata: { errors: activation.errors },
      });
      throw new Error(activation.errors.join(" "));
    }

    await supabase
      .from("service_subtypes")
      .update({
        evidence_gate: data.gate,
        evidence_note: data.note.trim(),
        evidence_decided_by: userId,
        evidence_decided_at: new Date().toISOString(),
        is_active: activate ? true : row.is_active && data.gate === "approved",
      } as never)
      .eq("code", data.subtypeCode);

    if (row.feature_flag_key) {
      await supabase
        .from("feature_flags")
        .update({ enabled: activate } as never)
        .eq("key", row.feature_flag_key);
    }

    await writeAuditRow(supabase, {
      actor_user_id: userId,
      action: "expansion.subtype.gate",
      subject_type: "service_subtype",
      subject_id: data.subtypeCode,
      decision: "allow",
      metadata: { gate: data.gate, activated: activate, note: data.note.trim() },
    });
    return { ok: true, activated: activate };
  });

/* ------------------------------------------------- service providers */

export const registerServiceProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      subtypeCode: string;
      displayName: string;
      contactEmail: string;
      serviceRegions: string[];
      capacity?: Record<string, string | number | boolean>;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { flagEnabled, loadSubtypes, toSubtypeConfig } = await import(
      "@/lib/atap/expansion.server"
    );
    const { writeAuditRow } = await import("@/lib/atap/onboarding.server");
    if (!(await flagEnabled(supabase, "expansion.service_framework"))) {
      throw new Error("service_framework_disabled");
    }

    const rows = await loadSubtypes(supabase);
    const row = rows.find((r) => r.code === data.subtypeCode);
    const subtype = row ? toSubtypeConfig(row) : null;
    const check = checkProviderSubmit({
      draft: {
        subtypeCode: data.subtypeCode,
        displayName: data.displayName,
        contactEmail: data.contactEmail,
        serviceRegions: data.serviceRegions,
      },
      subtype,
    });
    if (!check.ok) {
      await writeAuditRow(supabase, {
        actor_user_id: userId,
        action: "expansion.provider.register",
        subject_type: "service_subtype",
        subject_id: data.subtypeCode,
        decision: "deny",
        metadata: { errors: check.errors },
      });
      throw new Error(check.errors.join(" "));
    }

    const { data: provider, error } = await supabase
      .from("service_providers")
      .insert({
        subtype_code: data.subtypeCode,
        display_name: data.displayName.trim(),
        contact_email: data.contactEmail.trim(),
        service_regions: data.serviceRegions,
        capacity: data.capacity ?? {},
        state: "submitted",
        is_synthetic: true,
        created_by: userId,
      } as never)
      .select("id")
      .single();
    if (error || !provider) throw new Error("provider_create_failed");
    const providerId = (provider as { id: string }).id;

    // Materialise the subtype's configured verification checks as pending rows.
    const checks = (subtype?.verification_checks ?? []).map((c) => ({
      provider_id: providerId,
      check_code: c.code,
      label: c.label,
      status: "pending",
      adapter_name: "synthetic",
    }));
    if (checks.length > 0) await supabase.from("service_provider_checks").insert(checks as never);

    await supabase
      .from("service_providers")
      .update({ state: "verification" } as never)
      .eq("id", providerId);

    await writeAuditRow(supabase, {
      actor_user_id: userId,
      action: "expansion.provider.register",
      subject_type: "service_provider",
      subject_id: providerId,
      decision: "allow",
      metadata: { subtype: data.subtypeCode, checks: checks.length },
    });
    return { id: providerId, checks: checks.length };
  });

export const decideProviderCheck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { checkId: string; status: "passed" | "failed"; note: string; evidenceRef?: string | null }) =>
      input,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { resolveExpansionActor, canConfigureExpansion } = await import(
      "@/lib/atap/expansion.server"
    );
    const { writeAuditRow } = await import("@/lib/atap/onboarding.server");
    const actor = await resolveExpansionActor(supabase, userId);
    if (!canConfigureExpansion(actor)) throw new Error("not_authorized");

    await supabase
      .from("service_provider_checks")
      .update({
        status: data.status,
        note: data.note,
        evidence_ref: data.evidenceRef ?? null,
        decided_by: userId,
        decided_at: new Date().toISOString(),
      } as never)
      .eq("id", data.checkId);

    await writeAuditRow(supabase, {
      actor_user_id: userId,
      action: "expansion.provider.check",
      subject_type: "service_provider_check",
      subject_id: data.checkId,
      decision: data.status === "passed" ? "allow" : "deny",
      metadata: { note: data.note },
    });
    return { ok: true };
  });

export const decideServiceProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      providerId: string;
      decision: "approved" | "rejected" | "suspended";
      note: string;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { resolveExpansionActor, canConfigureExpansion, loadSubtypes, toSubtypeConfig } =
      await import("@/lib/atap/expansion.server");
    const { writeAuditRow } = await import("@/lib/atap/onboarding.server");
    const actor = await resolveExpansionActor(supabase, userId);

    const { data: providerRow } = await supabase
      .from("service_providers")
      .select("*")
      .eq("id", data.providerId)
      .maybeSingle();
    if (!providerRow) throw new Error("provider_not_found");
    const provider = providerRow as unknown as ProviderRow;

    const { data: checkRows } = await supabase
      .from("service_provider_checks")
      .select("check_code, status")
      .eq("provider_id", data.providerId);

    const rows = await loadSubtypes(supabase);
    const row = rows.find((r) => r.code === provider.subtype_code);

    const plan = planProviderApproval({
      subtype: row ? toSubtypeConfig(row) : null,
      currentState: provider.state,
      checks: (checkRows ?? []) as Array<{ check_code: string; status: string }>,
      reviewerIsAuthorized: canConfigureExpansion(actor),
      decision: data.decision,
      note: data.note,
    });
    if (!plan.ok) {
      await writeAuditRow(supabase, {
        actor_user_id: userId,
        action: "expansion.provider.decide",
        subject_type: "service_provider",
        subject_id: data.providerId,
        decision: "deny",
        metadata: { errors: plan.errors },
      });
      throw new Error(plan.errors.join(" "));
    }

    await supabase
      .from("service_providers")
      .update({
        state: plan.nextState,
        decision_note: data.note.trim(),
        decided_by: userId,
        decided_at: new Date().toISOString(),
      } as never)
      .eq("id", data.providerId);

    await writeAuditRow(supabase, {
      actor_user_id: userId,
      action: "expansion.provider.decide",
      subject_type: "service_provider",
      subject_id: data.providerId,
      decision: data.decision === "approved" ? "allow" : "deny",
      metadata: { decision: data.decision, human_decision: true, note: data.note.trim() },
    });
    return { ok: true, state: plan.nextState };
  });

/* ------------------------------------------------- engagements & disputes */

export const requestServiceEngagement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { providerId: string; title: string; details?: Record<string, string | number | boolean> }) =>
      input,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { loadSubtypes, toSubtypeConfig } = await import("@/lib/atap/expansion.server");
    const { writeAuditRow } = await import("@/lib/atap/onboarding.server");

    const { data: providerRow } = await supabase
      .from("service_providers")
      .select("id, subtype_code, state")
      .eq("id", data.providerId)
      .maybeSingle();
    if (!providerRow) throw new Error("provider_not_found");
    const provider = providerRow as unknown as { id: string; subtype_code: string; state: string };
    if (provider.state !== "approved") throw new Error("provider_not_approved");

    const rows = await loadSubtypes(supabase);
    const row = rows.find((r) => r.code === provider.subtype_code);
    if (!row || usableSubtypes([toSubtypeConfig(row)]).length === 0) {
      throw new Error("subtype_not_activated");
    }
    if (!data.title.trim()) throw new Error("title_required");

    const { data: engagement, error } = await supabase
      .from("service_engagements")
      .insert({
        provider_id: data.providerId,
        subtype_code: provider.subtype_code,
        requester_user_id: userId,
        title: data.title.trim(),
        details: data.details ?? {},
        status: "requested",
        is_synthetic: true,
      } as never)
      .select("id")
      .single();
    if (error || !engagement) throw new Error("engagement_create_failed");

    await writeAuditRow(supabase, {
      actor_user_id: userId,
      action: "expansion.engagement.request",
      subject_type: "service_engagement",
      subject_id: (engagement as { id: string }).id,
      decision: "allow",
      metadata: { provider_id: data.providerId, subtype: provider.subtype_code },
    });
    return { id: (engagement as { id: string }).id };
  });

export const raiseServiceDispute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { engagementId: string; category: string; summary: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { loadSubtypes, toSubtypeConfig } = await import("@/lib/atap/expansion.server");
    const { writeAuditRow } = await import("@/lib/atap/onboarding.server");

    const { data: engagementRow } = await supabase
      .from("service_engagements")
      .select("id, provider_id, subtype_code, requester_user_id")
      .eq("id", data.engagementId)
      .maybeSingle();
    if (!engagementRow) throw new Error("engagement_not_found");
    const engagement = engagementRow as unknown as {
      id: string;
      provider_id: string;
      subtype_code: string;
      requester_user_id: string | null;
    };

    const { data: providerRow } = await supabase
      .from("service_providers")
      .select("created_by")
      .eq("id", engagement.provider_id)
      .maybeSingle();
    const actorIsParty =
      engagement.requester_user_id === userId ||
      (providerRow as { created_by: string | null } | null)?.created_by === userId;

    const rows = await loadSubtypes(supabase);
    const row = rows.find((r) => r.code === engagement.subtype_code);

    const route = routeServiceDispute({
      subtype: row ? toSubtypeConfig(row) : null,
      category: data.category,
      summary: data.summary,
      actorIsParty,
    });
    if (!route.ok) {
      await writeAuditRow(supabase, {
        actor_user_id: userId,
        action: "expansion.dispute.raise",
        subject_type: "service_engagement",
        subject_id: data.engagementId,
        decision: "deny",
        metadata: { errors: route.errors },
      });
      throw new Error(route.errors.join(" "));
    }

    const { data: dispute, error } = await supabase
      .from("service_disputes")
      .insert({
        engagement_id: data.engagementId,
        subtype_code: engagement.subtype_code,
        raised_by: userId,
        category: data.category,
        summary: data.summary.trim(),
        status: route.status,
      } as never)
      .select("id")
      .single();
    if (error || !dispute) throw new Error("dispute_create_failed");

    await supabase
      .from("service_engagements")
      .update({ status: "disputed", status_note: "dispute raised" } as never)
      .eq("id", data.engagementId);

    await writeAuditRow(supabase, {
      actor_user_id: userId,
      action: "expansion.dispute.raise",
      subject_type: "service_dispute",
      subject_id: (dispute as { id: string }).id,
      decision: "allow",
      metadata: { routed_to: "human_review", auto_resolved: false, category: data.category },
    });
    return { id: (dispute as { id: string }).id, status: route.status };
  });

export const decideServiceDispute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { disputeId: string; next: "resolved" | "rejected"; resolutionNote: string }) => {
      if ((input.resolutionNote ?? "").trim().length < 10) throw new Error("resolution_note_required");
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { resolveExpansionActor, canDecideSupport } = await import("@/lib/atap/expansion.server");
    const { writeAuditRow } = await import("@/lib/atap/onboarding.server");
    const actor = await resolveExpansionActor(supabase, userId);
    if (!canDecideSupport(actor)) throw new Error("not_authorized");

    await supabase
      .from("service_disputes")
      .update({
        status: data.next,
        resolution_note: data.resolutionNote.trim(),
        decided_by: userId,
        decided_at: new Date().toISOString(),
      } as never)
      .eq("id", data.disputeId);

    await writeAuditRow(supabase, {
      actor_user_id: userId,
      action: "expansion.dispute.decide",
      subject_type: "service_dispute",
      subject_id: data.disputeId,
      decision: data.next === "resolved" ? "allow" : "deny",
      metadata: { human_decision: true, note: data.resolutionNote.trim() },
    });
    return { ok: true };
  });

/* ------------------------------------------------- certification */

export const requestCertification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      subjectType: string;
      subjectId: string;
      programmeCode: string;
      criteria: CertificationCriterion[];
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { flagEnabled } = await import("@/lib/atap/expansion.server");
    const { writeAuditRow } = await import("@/lib/atap/onboarding.server");
    if (!(await flagEnabled(supabase, "expansion.partner_certification"))) {
      throw new Error("certification_disabled");
    }
    const evaluation = evaluateCertification({
      programmeCode: data.programmeCode,
      criteria: data.criteria,
    });

    const { data: row, error } = await supabase
      .from("partner_certifications")
      .insert({
        subject_type: data.subjectType,
        subject_id: data.subjectId,
        programme_code: data.programmeCode,
        criteria: data.criteria,
        state: "submitted",
        is_synthetic: true,
        created_by: userId,
      } as never)
      .select("id")
      .single();
    if (error || !row) throw new Error("certification_create_failed");

    await writeAuditRow(supabase, {
      actor_user_id: userId,
      action: "expansion.certification.request",
      subject_type: "partner_certification",
      subject_id: (row as { id: string }).id,
      decision: "allow",
      metadata: { programme: data.programmeCode, eligible_on_submit: evaluation.eligible },
    });
    return { id: (row as { id: string }).id, eligible: evaluation.eligible, missing: evaluation.missing };
  });

export const decideCertification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      certificationId: string;
      decision: "certified" | "declined" | "revoked";
      note: string;
      validMonths?: number;
    }) => {
      if ((input.note ?? "").trim().length < 10) throw new Error("decision_note_required");
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { resolveExpansionActor, canConfigureExpansion } = await import(
      "@/lib/atap/expansion.server"
    );
    const { writeAuditRow } = await import("@/lib/atap/onboarding.server");
    const actor = await resolveExpansionActor(supabase, userId);
    if (!canConfigureExpansion(actor)) throw new Error("not_authorized");

    const { data: certRow } = await supabase
      .from("partner_certifications")
      .select("*")
      .eq("id", data.certificationId)
      .maybeSingle();
    if (!certRow) throw new Error("certification_not_found");
    const cert = certRow as unknown as CertificationRow;

    if (data.decision === "certified") {
      const evaluation = evaluateCertification({
        programmeCode: cert.programme_code,
        criteria: cert.criteria,
      });
      if (!evaluation.eligible) {
        await writeAuditRow(supabase, {
          actor_user_id: userId,
          action: "expansion.certification.decide",
          subject_type: "partner_certification",
          subject_id: data.certificationId,
          decision: "deny",
          metadata: { missing: evaluation.missing },
        });
        throw new Error(`criteria_unmet:${evaluation.missing.join(",")}`);
      }
    }

    const now = new Date();
    const expires = new Date(now);
    expires.setMonth(expires.getMonth() + (data.validMonths ?? 12));

    await supabase
      .from("partner_certifications")
      .update({
        state: data.decision,
        decision_note: data.note.trim(),
        decided_by: userId,
        decided_at: now.toISOString(),
        badge_awarded_at: data.decision === "certified" ? now.toISOString() : null,
        badge_expires_at: data.decision === "certified" ? expires.toISOString() : null,
      } as never)
      .eq("id", data.certificationId);

    await writeAuditRow(supabase, {
      actor_user_id: userId,
      action: "expansion.certification.decide",
      subject_type: "partner_certification",
      subject_id: data.certificationId,
      decision: data.decision === "certified" ? "allow" : "deny",
      metadata: { decision: data.decision, human_decision: true },
    });
    return { ok: true };
  });

/* ------------------------------------------------- support cases */

export const openSupportCase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      caseType: string;
      severity: Severity;
      subjectType: string;
      subjectId: string;
      rolloutId?: string | null;
      summary: string;
      hasManagedOnboarding?: boolean;
    }) => {
      if ((input.summary ?? "").trim().length < 10) throw new Error("summary_required");
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { flagEnabled } = await import("@/lib/atap/expansion.server");
    const { writeAuditRow } = await import("@/lib/atap/onboarding.server");
    if (
      data.caseType === "managed_onboarding" &&
      !(await flagEnabled(supabase, "expansion.managed_onboarding"))
    ) {
      throw new Error("managed_onboarding_disabled");
    }

    const route = routeSupportCase({
      caseType: data.caseType,
      severity: data.severity,
      hasManagedOnboarding: Boolean(data.hasManagedOnboarding),
    });

    const { data: row, error } = await supabase
      .from("support_cases")
      .insert({
        case_type: data.caseType,
        subject_type: data.subjectType,
        subject_id: data.subjectId,
        rollout_id: data.rolloutId ?? null,
        requester_user_id: userId,
        severity: data.severity,
        queue: route.queue,
        sla_hours: route.slaHours,
        summary: data.summary.trim(),
        status: "new",
        is_synthetic: true,
      } as never)
      .select("id")
      .single();
    if (error || !row) throw new Error("support_case_failed");

    await writeAuditRow(supabase, {
      actor_user_id: userId,
      action: "expansion.support.open",
      subject_type: "support_case",
      subject_id: (row as { id: string }).id,
      decision: "allow",
      metadata: { queue: route.queue, sla_hours: route.slaHours, severity: data.severity },
    });
    return { id: (row as { id: string }).id, queue: route.queue, slaHours: route.slaHours };
  });

export const transitionSupportCase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { caseId: string; next: SupportCaseStatus; note: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { resolveExpansionActor, canDecideSupport } = await import("@/lib/atap/expansion.server");
    const { writeAuditRow } = await import("@/lib/atap/onboarding.server");
    const actor = await resolveExpansionActor(supabase, userId);

    const { data: caseRow } = await supabase
      .from("support_cases")
      .select("status")
      .eq("id", data.caseId)
      .maybeSingle();
    if (!caseRow) throw new Error("case_not_found");

    const plan = planSupportTransition({
      current: (caseRow as { status: SupportCaseStatus }).status,
      next: data.next,
      actorIsSupport: canDecideSupport(actor),
      note: data.note,
    });
    if (!plan.ok) {
      await writeAuditRow(supabase, {
        actor_user_id: userId,
        action: "expansion.support.transition",
        subject_type: "support_case",
        subject_id: data.caseId,
        decision: "deny",
        metadata: { errors: plan.errors },
      });
      throw new Error(plan.errors.join(" "));
    }

    await supabase
      .from("support_cases")
      .update({
        status: data.next,
        assigned_to: userId,
        resolution_note:
          data.next === "resolved" || data.next === "closed" ? data.note.trim() : null,
      } as never)
      .eq("id", data.caseId);

    await writeAuditRow(supabase, {
      actor_user_id: userId,
      action: "expansion.support.transition",
      subject_type: "support_case",
      subject_id: data.caseId,
      decision: "allow",
      metadata: { next: data.next },
    });
    return { ok: true };
  });
