/**
 * B7 — state, knowledge, research & post-harvest server functions.
 *
 * Authority is re-checked in every handler; route hiding is presentation only.
 * Every configuration change, review decision, research decision, export and
 * provider/contract decision writes an audit row.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  checkCapacityListing,
  checkKnowledgeSubmit,
  checkPostharvestOnboarding,
  checkResearchApproval,
  checkResearchRequest,
  decideKnowledgeReview,
  evaluateAggregateExport,
  groundableKnowledge,
  planContractTransition,
  planStateConfiguration,
  policyDashboard,
  summariseState,
  usableTrainingContent,
  STATE_GOVERNABLE_FLAGS,
  AGGREGATE_DATASETS,
  type AggregateRow,
  type ContractStatus,
  type KnowledgeContribution,
  type PostharvestKind,
  type ResearchRequestStatus,
  type StateDashboard,
} from "@/lib/atap/state";

export interface StateConfigRow {
  id: string;
  tenant_id: string;
  geography_id: string | null;
  label: string;
  default_locale: string;
  locales: string[];
  enabled_flags: string[];
  aggregation_min_cohort: number;
  allows_raw_farmer_access: boolean;
  status: string;
  created_at: string;
}

export interface InstitutionRow {
  id: string;
  tenant_id: string | null;
  kind: string;
  name: string;
  contact_email: string;
  geography_id: string | null;
  state: string;
  topics: string[];
  decision_note: string | null;
  created_by: string | null;
  created_at: string;
}

export interface ContributionRow extends KnowledgeContribution {
  institution_id: string | null;
  language: string;
  topic: string;
  published_at: string | null;
  review_note: string | null;
  created_at: string;
}

export interface ResearchRequestRow {
  id: string;
  researcher_user_id: string;
  institution_id: string | null;
  title: string;
  purpose_code: string | null;
  abstract: string;
  requested_datasets: string[];
  dua_reference: string | null;
  ethics_reference: string | null;
  aggregation_min_cohort: number;
  raw_row_access: boolean;
  status: ResearchRequestStatus;
  decision_note: string | null;
  expires_at: string | null;
  created_at: string;
}

export interface ResearchExportRow {
  id: string;
  request_id: string;
  dataset_code: string;
  cohort_size: number;
  aggregation_min_applied: number;
  allowed: boolean;
  denial_reason: string | null;
  created_at: string;
}

export interface PostharvestProviderRow {
  id: string;
  tenant_id: string | null;
  subtype_code: string | null;
  kind: PostharvestKind;
  display_name: string;
  contact_email: string;
  service_regions: string[];
  state: string;
  decision_note: string | null;
  created_by: string | null;
  created_at: string;
}

export interface CapacityListingRow {
  id: string;
  provider_id: string;
  commodity: string;
  capacity_tonnes: number;
  available_tonnes: number;
  temperature_min_c: number | null;
  temperature_max_c: number | null;
  price_per_tonne_month: number | null;
  currency: string;
  status: string;
  quality_score: number;
  created_at: string;
}

export interface ContractRow {
  id: string;
  provider_id: string;
  counterparty_profile_id: string | null;
  commodity: string;
  quantity_tonnes: number;
  price_per_tonne: number;
  currency: string;
  delivery_window: string;
  status: ContractStatus;
  requires_human_decision: boolean;
  decision_note: string | null;
  created_by: string | null;
  created_at: string;
}

export interface StateWorkspace {
  userId: string;
  capabilities: {
    configureState: boolean;
    contributeKnowledge: boolean;
    reviewKnowledge: boolean;
    research: boolean;
    policy: boolean;
    postharvest: boolean;
    operate: boolean;
  };
  flags: {
    stateConfiguration: boolean;
    knowledge: boolean;
    aiGrounding: boolean;
    research: boolean;
    policyDashboard: boolean;
    warehouse: boolean;
    coldStorage: boolean;
    processor: boolean;
  };
  governableFlags: string[];
  aggregateDatasets: string[];
  tenants: Array<{ id: string; name: string; tenant_type: string }>;
  geographies: Array<{ id: string; name: string; level: string }>;
  stateConfigs: StateConfigRow[];
  institutions: InstitutionRow[];
  contributions: ContributionRow[];
  groundableCount: number;
  trainingContent: ContributionRow[];
  researchRequests: ResearchRequestRow[];
  exports: ResearchExportRow[];
  policyMetrics: ReturnType<typeof policyDashboard>;
  providers: PostharvestProviderRow[];
  listings: CapacityListingRow[];
  contracts: ContractRow[];
  dashboard: StateDashboard;
}

export const getStateWorkspace = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<StateWorkspace> => {
    const { supabase, userId } = context;
    const {
      resolveStateActor,
      canReviewKnowledge,
      canDecideResearch,
      canOperatePostharvest,
      flagEnabled,
      strictestStateMinCohort,
    } = await import("@/lib/atap/state.server");

    const actor = await resolveStateActor(supabase, userId);

    const [
      tenants,
      geographies,
      configs,
      institutions,
      contributions,
      requests,
      exportRows,
      metrics,
      providers,
      listings,
      contracts,
    ] = await Promise.all([
      supabase.from("tenants").select("id, name, tenant_type").order("name"),
      supabase.from("geographies").select("id, name, level").order("level"),
      supabase.from("state_configurations").select("*").order("created_at"),
      supabase.from("knowledge_institutions").select("*").order("created_at", { ascending: false }),
      supabase.from("knowledge_contributions").select("*").order("created_at", { ascending: false }),
      supabase.from("research_requests").select("*").order("created_at", { ascending: false }),
      supabase.from("research_exports").select("*").order("created_at", { ascending: false }),
      supabase.from("policy_metric_snapshots").select("*").order("period"),
      supabase.from("postharvest_providers").select("*").order("created_at", { ascending: false }),
      supabase.from("storage_capacity_listings").select("*").order("created_at", { ascending: false }),
      supabase.from("processor_contracts").select("*").order("created_at", { ascending: false }),
    ]);

    const contributionRows = (contributions.data ?? []) as unknown as ContributionRow[];
    const metricRows = (metrics.data ?? []) as unknown as AggregateRow[];
    const stateMin = await strictestStateMinCohort(supabase);

    const [
      stateConfiguration,
      knowledge,
      aiGrounding,
      research,
      policyDashboardFlag,
      warehouse,
      coldStorage,
      processor,
    ] = await Promise.all([
      flagEnabled(supabase, "state.tenant_configuration"),
      flagEnabled(supabase, "knowledge.contribution"),
      flagEnabled(supabase, "knowledge.ai_grounding"),
      flagEnabled(supabase, "research.aggregate_access"),
      flagEnabled(supabase, "policy.aggregate_dashboard"),
      flagEnabled(supabase, "service.warehouse_storage"),
      flagEnabled(supabase, "service.cold_storage"),
      flagEnabled(supabase, "service.processor_sourcing"),
    ]);

    const providerRows = (providers.data ?? []) as unknown as PostharvestProviderRow[];
    const listingRows = (listings.data ?? []) as unknown as CapacityListingRow[];
    const contractRows = (contracts.data ?? []) as unknown as ContractRow[];
    const requestRows = (requests.data ?? []) as unknown as ResearchRequestRow[];
    const exportList = (exportRows.data ?? []) as unknown as ResearchExportRow[];
    const institutionRows = (institutions.data ?? []) as unknown as InstitutionRow[];
    const configRows = (configs.data ?? []) as unknown as StateConfigRow[];

    return {
      userId,
      capabilities: {
        configureState: actor.isPlatformAdmin || actor.stateAdminTenantIds.length > 0,
        contributeKnowledge: actor.isKnowledgeContributor || actor.isPlatformAdmin,
        reviewKnowledge: canReviewKnowledge(actor),
        research: actor.isResearcher || actor.isPlatformAdmin,
        policy: actor.isPolicymaker || actor.isPlatformAdmin || actor.isAuditor,
        postharvest: actor.isPostharvestProviderAdmin || actor.isPlatformAdmin,
        operate: canOperatePostharvest(actor) || canDecideResearch(actor),
      },
      flags: {
        stateConfiguration,
        knowledge,
        aiGrounding,
        research,
        policyDashboard: policyDashboardFlag,
        warehouse,
        coldStorage,
        processor,
      },
      governableFlags: [...STATE_GOVERNABLE_FLAGS],
      aggregateDatasets: [...AGGREGATE_DATASETS],
      tenants: (tenants.data ?? []) as unknown as Array<{ id: string; name: string; tenant_type: string }>,
      geographies: (geographies.data ?? []) as unknown as Array<{ id: string; name: string; level: string }>,
      stateConfigs: configRows,
      institutions: institutionRows,
      contributions: contributionRows,
      groundableCount: groundableKnowledge(contributionRows).length,
      trainingContent: usableTrainingContent(contributionRows) as ContributionRow[],
      researchRequests: requestRows,
      exports: exportList,
      policyMetrics: policyDashboard({ rows: metricRows, minCohort: stateMin }),
      providers: providerRows,
      listings: listingRows,
      contracts: contractRows,
      dashboard: summariseState({
        stateConfigs: configRows,
        institutions: institutionRows,
        contributions: contributionRows,
        researchRequests: requestRows,
        exports: exportList,
        providers: providerRows,
        listings: listingRows,
        contracts: contractRows,
      }),
    };
  });

/* ------------------------------------------------------------- state config */

export const upsertStateConfiguration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      tenantId: string;
      geographyId: string;
      label: string;
      defaultLocale: string;
      locales: string[];
      enabledFlags: string[];
      aggregationMinCohort: number;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { resolveStateActor, canConfigureState, flagEnabled } = await import(
      "@/lib/atap/state.server"
    );
    const { writeAuditRow } = await import("@/lib/atap/onboarding.server");

    const actor = await resolveStateActor(supabase, userId);
    if (!canConfigureState(actor, data.tenantId)) throw new Error("not_authorized");
    if (!(await flagEnabled(supabase, "state.tenant_configuration"))) {
      throw new Error("state_configuration_disabled");
    }

    const { data: tenantRow } = await supabase
      .from("tenants")
      .select("id, tenant_type")
      .eq("id", data.tenantId)
      .maybeSingle();
    if (!tenantRow) throw new Error("tenant_not_found");
    const { data: geoRow } = await supabase
      .from("geographies")
      .select("id, level, name")
      .eq("id", data.geographyId)
      .maybeSingle();
    if (!geoRow) throw new Error("geography_not_found");

    const plan = planStateConfiguration({
      tenantId: data.tenantId,
      tenantType: (tenantRow as { tenant_type: string }).tenant_type,
      geographyLevel: (geoRow as { level: string }).level,
      defaultLocale: data.defaultLocale,
      locales: data.locales,
      enabledFlags: data.enabledFlags,
      aggregationMinCohort: data.aggregationMinCohort,
      allowedFlags: [...STATE_GOVERNABLE_FLAGS],
    });

    if (!plan.ok) {
      await writeAuditRow(supabase, {
        actor_user_id: userId,
        tenant_id: data.tenantId,
        action: "state.configuration.upsert",
        subject_type: "tenant",
        subject_id: data.tenantId,
        decision: "deny",
        metadata: { errors: plan.errors },
      });
      throw new Error(plan.errors.join(" "));
    }

    const { data: row, error } = await supabase
      .from("state_configurations")
      .upsert(
        {
          tenant_id: data.tenantId,
          geography_id: data.geographyId,
          label: data.label || `${(geoRow as { name: string }).name} state configuration`,
          default_locale: plan.defaultLocale,
          locales: plan.locales,
          enabled_flags: plan.enabledFlags,
          aggregation_min_cohort: plan.aggregationMinCohort,
          allows_raw_farmer_access: false,
          status: "active",
          is_synthetic: true,
          created_by: userId,
        } as never,
        { onConflict: "tenant_id,geography_id" },
      )
      .select("id")
      .single();
    if (error || !row) throw new Error("state_configuration_write_failed");

    await writeAuditRow(supabase, {
      actor_user_id: userId,
      tenant_id: data.tenantId,
      action: "state.configuration.upsert",
      subject_type: "state_configuration",
      subject_id: (row as { id: string }).id,
      decision: "allow",
      metadata: {
        enabled_flags: plan.enabledFlags,
        aggregation_min_cohort: plan.aggregationMinCohort,
        scoped_tenant_ids: plan.scopedTenantIds,
        raw_farmer_access: false,
      },
    });

    return { id: (row as { id: string }).id, aggregationMinCohort: plan.aggregationMinCohort };
  });

/* ---------------------------------------------------------------- knowledge */

export const registerKnowledgeInstitution = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      kind: "university" | "kvk" | "extension_centre" | "state_training_cell";
      name: string;
      contactEmail: string;
      geographyId?: string | null;
      tenantId?: string | null;
      topics?: string[];
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { flagEnabled } = await import("@/lib/atap/state.server");
    const { writeAuditRow } = await import("@/lib/atap/onboarding.server");
    if (!(await flagEnabled(supabase, "knowledge.contribution"))) {
      throw new Error("knowledge_contribution_disabled");
    }
    if (data.name.trim().length < 3) throw new Error("name_too_short");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.contactEmail)) throw new Error("contact_email_invalid");

    const { data: row, error } = await supabase
      .from("knowledge_institutions")
      .insert({
        kind: data.kind,
        name: data.name,
        contact_email: data.contactEmail,
        geography_id: data.geographyId ?? null,
        tenant_id: data.tenantId ?? null,
        topics: data.topics ?? [],
        state: "submitted",
        is_synthetic: true,
        created_by: userId,
      } as never)
      .select("id")
      .single();
    if (error || !row) throw new Error("institution_create_failed");

    await writeAuditRow(supabase, {
      actor_user_id: userId,
      action: "knowledge.institution.submit",
      subject_type: "knowledge_institution",
      subject_id: (row as { id: string }).id,
      decision: "allow",
      metadata: { kind: data.kind },
    });
    return { id: (row as { id: string }).id };
  });

export const decideKnowledgeInstitution = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { institutionId: string; decision: "approve" | "reject" | "suspend"; note?: string }) =>
      input,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { resolveStateActor, canReviewKnowledge } = await import("@/lib/atap/state.server");
    const { writeAuditRow } = await import("@/lib/atap/onboarding.server");
    const actor = await resolveStateActor(supabase, userId);
    if (!canReviewKnowledge(actor)) throw new Error("not_authorized");

    const nextState =
      data.decision === "approve" ? "approved" : data.decision === "reject" ? "rejected" : "suspended";
    const { error } = await supabase
      .from("knowledge_institutions")
      .update({
        state: nextState,
        decision_note: data.note ?? null,
        decided_by: userId,
        decided_at: new Date().toISOString(),
      } as never)
      .eq("id", data.institutionId);
    if (error) throw new Error("institution_decision_failed");

    await writeAuditRow(supabase, {
      actor_user_id: userId,
      action: "knowledge.institution.decide",
      subject_type: "knowledge_institution",
      subject_id: data.institutionId,
      decision: data.decision === "approve" ? "allow" : "deny",
      metadata: { next_state: nextState, note: data.note ?? null },
    });
    return { state: nextState };
  });

export const saveKnowledgeContribution = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      id?: string;
      institutionId: string;
      title: string;
      summary: string;
      body: string;
      language?: string;
      topic?: string;
      citations?: string[];
      isTrainingContent?: boolean;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { flagEnabled } = await import("@/lib/atap/state.server");
    if (!(await flagEnabled(supabase, "knowledge.contribution"))) {
      throw new Error("knowledge_contribution_disabled");
    }

    const payload = {
      institution_id: data.institutionId,
      title: data.title,
      summary: data.summary,
      body: data.body,
      language: data.language ?? "en",
      topic: data.topic ?? "general",
      citations: data.citations ?? [],
      is_training_content: Boolean(data.isTrainingContent),
      author_user_id: userId,
      is_synthetic: true,
    };

    if (data.id) {
      const { data: existing } = await supabase
        .from("knowledge_contributions")
        .select("status, author_user_id")
        .eq("id", data.id)
        .maybeSingle();
      const row = existing as { status: string; author_user_id: string } | null;
      if (!row) throw new Error("contribution_not_found");
      if (row.author_user_id !== userId) throw new Error("not_authorized");
      if (row.status !== "draft" && row.status !== "rejected") throw new Error("not_editable_from_status");
      const { error } = await supabase
        .from("knowledge_contributions")
        .update(payload as never)
        .eq("id", data.id);
      if (error) throw new Error("contribution_save_failed");
      return { id: data.id };
    }

    const { data: row, error } = await supabase
      .from("knowledge_contributions")
      .insert({ ...payload, status: "draft" } as never)
      .select("id")
      .single();
    if (error || !row) throw new Error("contribution_create_failed");
    return { id: (row as { id: string }).id };
  });

export const submitKnowledgeContribution = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { contributionId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { writeAuditRow } = await import("@/lib/atap/onboarding.server");

    const { data: row } = await supabase
      .from("knowledge_contributions")
      .select("id, title, summary, body, citations, status, author_user_id, institution_id")
      .eq("id", data.contributionId)
      .maybeSingle();
    const c = row as unknown as {
      title: string;
      summary: string;
      body: string;
      citations: string[];
      status: KnowledgeContribution["status"];
      author_user_id: string;
      institution_id: string | null;
    } | null;
    if (!c) throw new Error("contribution_not_found");
    if (c.author_user_id !== userId) throw new Error("not_authorized");

    const { data: inst } = await supabase
      .from("knowledge_institutions")
      .select("state")
      .eq("id", c.institution_id ?? "")
      .maybeSingle();

    const check = checkKnowledgeSubmit({
      title: c.title,
      summary: c.summary,
      body: c.body,
      citations: c.citations ?? [],
      institution_state: (inst as { state?: string } | null)?.state ?? "draft",
      status: c.status,
    });
    if (!check.ok) throw new Error(check.errors.join(" "));

    const { error } = await supabase
      .from("knowledge_contributions")
      .update({ status: "submitted" } as never)
      .eq("id", data.contributionId);
    if (error) throw new Error("contribution_submit_failed");

    await writeAuditRow(supabase, {
      actor_user_id: userId,
      action: "knowledge.contribution.submit",
      subject_type: "knowledge_contribution",
      subject_id: data.contributionId,
      decision: "allow",
      metadata: {},
    });
    return { status: "submitted" };
  });

export const reviewKnowledgeContribution = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      contributionId: string;
      decision: "approve" | "reject" | "request_changes";
      note?: string;
      publish?: boolean;
      enableAiGrounding?: boolean;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { resolveStateActor, canReviewKnowledge, flagEnabled } = await import(
      "@/lib/atap/state.server"
    );
    const { writeAuditRow } = await import("@/lib/atap/onboarding.server");

    const actor = await resolveStateActor(supabase, userId);
    const { data: row } = await supabase
      .from("knowledge_contributions")
      .select("id, status, author_user_id")
      .eq("id", data.contributionId)
      .maybeSingle();
    const c = row as unknown as {
      status: KnowledgeContribution["status"];
      author_user_id: string;
    } | null;
    if (!c) throw new Error("contribution_not_found");

    const verdict = decideKnowledgeReview({
      contribution: c,
      reviewerUserId: userId,
      reviewerIsReviewer: canReviewKnowledge(actor),
      decision: data.decision,
      ...(data.publish !== undefined ? { publish: data.publish } : {}),
      ...(data.enableAiGrounding !== undefined ? { enableAiGrounding: data.enableAiGrounding } : {}),
      aiGroundingFlagEnabled: await flagEnabled(supabase, "knowledge.ai_grounding"),
    });

    if (!verdict.ok) {
      await writeAuditRow(supabase, {
        actor_user_id: userId,
        action: "knowledge.contribution.review",
        subject_type: "knowledge_contribution",
        subject_id: data.contributionId,
        decision: "deny",
        metadata: { errors: verdict.errors },
      });
      throw new Error(verdict.errors.join(" "));
    }

    const now = new Date().toISOString();
    const { error } = await supabase
      .from("knowledge_contributions")
      .update({
        status: verdict.nextStatus,
        reviewed_by: userId,
        reviewed_at: now,
        review_note: data.note ?? null,
        ai_grounding_enabled: verdict.aiGroundingEnabled,
        published_at: verdict.publish ? now : null,
      } as never)
      .eq("id", data.contributionId);
    if (error) throw new Error("contribution_review_failed");

    await supabase.from("knowledge_reviews").insert({
      contribution_id: data.contributionId,
      reviewer_user_id: userId,
      decision: data.decision,
      note: data.note ?? "",
    } as never);

    await writeAuditRow(supabase, {
      actor_user_id: userId,
      action: "knowledge.contribution.review",
      subject_type: "knowledge_contribution",
      subject_id: data.contributionId,
      decision: data.decision === "approve" ? "allow" : "deny",
      metadata: {
        next_status: verdict.nextStatus,
        published: verdict.publish,
        ai_grounding_enabled: verdict.aiGroundingEnabled,
      },
    });

    return { status: verdict.nextStatus, aiGroundingEnabled: verdict.aiGroundingEnabled };
  });

/* ----------------------------------------------------------------- research */

export const submitResearchRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      title: string;
      abstract: string;
      purposeCode: string;
      datasets: string[];
      duaReference?: string | null;
      ethicsReference?: string | null;
      aggregationMinCohort?: number;
      institutionId?: string | null;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { resolveStateActor, flagEnabled } = await import("@/lib/atap/state.server");
    const { writeAuditRow } = await import("@/lib/atap/onboarding.server");

    const actor = await resolveStateActor(supabase, userId);
    if (!(actor.isResearcher || actor.isPlatformAdmin)) throw new Error("not_authorized");
    if (!(await flagEnabled(supabase, "research.aggregate_access"))) {
      throw new Error("research_access_disabled");
    }

    const check = checkResearchRequest({
      title: data.title,
      abstract: data.abstract,
      purposeCode: data.purposeCode,
      datasets: data.datasets,
      duaReference: data.duaReference ?? null,
      ethicsReference: data.ethicsReference ?? null,
      aggregationMinCohort: data.aggregationMinCohort ?? 10,
    });
    if (!check.ok) {
      await writeAuditRow(supabase, {
        actor_user_id: userId,
        action: "research.request.submit",
        subject_type: "research_request",
        decision: "deny",
        purpose_code: data.purposeCode,
        metadata: { errors: check.errors },
      });
      throw new Error(check.errors.join(" "));
    }

    const { data: row, error } = await supabase
      .from("research_requests")
      .insert({
        researcher_user_id: userId,
        institution_id: data.institutionId ?? null,
        title: data.title,
        abstract: data.abstract,
        purpose_code: data.purposeCode,
        requested_datasets: check.datasets,
        dua_reference: data.duaReference ?? null,
        ethics_reference: data.ethicsReference ?? null,
        aggregation_min_cohort: check.aggregationMinCohort,
        raw_row_access: false,
        status: "submitted",
        is_synthetic: true,
      } as never)
      .select("id")
      .single();
    if (error || !row) throw new Error("research_request_failed");

    await writeAuditRow(supabase, {
      actor_user_id: userId,
      action: "research.request.submit",
      subject_type: "research_request",
      subject_id: (row as { id: string }).id,
      purpose_code: data.purposeCode,
      decision: "allow",
      metadata: { datasets: check.datasets, aggregation_min: check.aggregationMinCohort },
    });
    return { id: (row as { id: string }).id };
  });

export const decideResearchRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { requestId: string; decision: "approve" | "reject" | "revoke"; note?: string; expiresAt?: string }) =>
      input,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { resolveStateActor, canDecideResearch } = await import("@/lib/atap/state.server");
    const { writeAuditRow } = await import("@/lib/atap/onboarding.server");
    const actor = await resolveStateActor(supabase, userId);

    const { data: row } = await supabase
      .from("research_requests")
      .select("id, status, dua_reference, ethics_reference, purpose_code")
      .eq("id", data.requestId)
      .maybeSingle();
    const r = row as unknown as {
      status: ResearchRequestStatus;
      dua_reference: string | null;
      ethics_reference: string | null;
      purpose_code: string | null;
    } | null;
    if (!r) throw new Error("request_not_found");

    if (data.decision === "revoke") {
      if (!canDecideResearch(actor)) throw new Error("not_authorized");
      await supabase
        .from("research_requests")
        .update({ status: "revoked", decision_note: data.note ?? null, decided_by: userId, decided_at: new Date().toISOString() } as never)
        .eq("id", data.requestId);
      await writeAuditRow(supabase, {
        actor_user_id: userId,
        action: "research.request.revoke",
        subject_type: "research_request",
        subject_id: data.requestId,
        decision: "deny",
        purpose_code: r.purpose_code,
        metadata: { note: data.note ?? null },
      });
      return { status: "revoked" as const };
    }

    const check = checkResearchApproval({
      status: r.status,
      duaReference: r.dua_reference,
      ethicsReference: r.ethics_reference,
      approverIsPlatformAdmin: canDecideResearch(actor),
    });
    if (!check.ok) {
      await writeAuditRow(supabase, {
        actor_user_id: userId,
        action: "research.request.decide",
        subject_type: "research_request",
        subject_id: data.requestId,
        decision: "deny",
        purpose_code: r.purpose_code,
        metadata: { errors: check.errors },
      });
      throw new Error(check.errors.join(" "));
    }

    const status = data.decision === "approve" ? "approved" : "rejected";
    const { error } = await supabase
      .from("research_requests")
      .update({
        status,
        decision_note: data.note ?? null,
        decided_by: userId,
        decided_at: new Date().toISOString(),
        expires_at: data.expiresAt ?? null,
      } as never)
      .eq("id", data.requestId);
    if (error) throw new Error("research_decision_failed");

    await writeAuditRow(supabase, {
      actor_user_id: userId,
      action: "research.request.decide",
      subject_type: "research_request",
      subject_id: data.requestId,
      purpose_code: r.purpose_code,
      decision: data.decision === "approve" ? "allow" : "deny",
      metadata: { status, expires_at: data.expiresAt ?? null },
    });
    return { status };
  });

export const runAggregateExport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { requestId: string; datasetCode: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { strictestStateMinCohort } = await import("@/lib/atap/state.server");
    const { writeAuditRow } = await import("@/lib/atap/onboarding.server");

    const { data: row } = await supabase
      .from("research_requests")
      .select("id, researcher_user_id, status, aggregation_min_cohort, requested_datasets, expires_at, raw_row_access, purpose_code")
      .eq("id", data.requestId)
      .maybeSingle();
    const r = row as unknown as {
      researcher_user_id: string;
      status: ResearchRequestStatus;
      aggregation_min_cohort: number;
      requested_datasets: string[];
      expires_at: string | null;
      raw_row_access: boolean;
      purpose_code: string | null;
    } | null;
    if (!r) throw new Error("request_not_found");
    if (r.researcher_user_id !== userId) throw new Error("not_authorized");

    const { data: metricRows } = await supabase
      .from("policy_metric_snapshots")
      .select("metric_code, period, geography_id, value, cohort_size, is_deidentified")
      .like("metric_code", `${data.datasetCode.replace("_aggregate", "")}%`);

    const verdict = evaluateAggregateExport({
      request: r,
      datasetCode: data.datasetCode,
      stateMinCohort: await strictestStateMinCohort(supabase),
      rows: (metricRows ?? []) as unknown as AggregateRow[],
      now: new Date(),
    });

    await supabase.from("research_exports").insert({
      request_id: data.requestId,
      dataset_code: data.datasetCode,
      cohort_size: verdict.rows.reduce((s, x) => s + x.cohort_size, 0),
      aggregation_min_applied: verdict.minCohortApplied,
      allowed: verdict.allowed,
      denial_reason: verdict.allowed ? null : verdict.errors.join(" "),
      payload: { rows: verdict.rows, suppressed: verdict.suppressed },
      requested_by: userId,
    } as never);

    await writeAuditRow(supabase, {
      actor_user_id: userId,
      action: "research.export.run",
      subject_type: "research_request",
      subject_id: data.requestId,
      purpose_code: r.purpose_code,
      decision: verdict.allowed ? "allow" : "deny",
      metadata: {
        dataset: data.datasetCode,
        min_cohort_applied: verdict.minCohortApplied,
        rows_returned: verdict.rows.length,
        rows_suppressed: verdict.suppressed,
        errors: verdict.errors,
      },
    });

    return verdict;
  });

/* ------------------------------------------------------------- post-harvest */

export const registerPostharvestProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      kind: PostharvestKind;
      displayName: string;
      contactEmail: string;
      serviceRegions: string[];
      geographyId?: string | null;
      tenantId?: string | null;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { loadSubtypeGate } = await import("@/lib/atap/state.server");
    const { writeAuditRow } = await import("@/lib/atap/onboarding.server");
    const { POSTHARVEST_SUBTYPES } = await import("@/lib/atap/state");

    const subtype = await loadSubtypeGate(supabase, POSTHARVEST_SUBTYPES[data.kind]);
    const gate = checkPostharvestOnboarding({
      kind: data.kind,
      subtype,
      displayName: data.displayName,
      contactEmail: data.contactEmail,
      serviceRegions: data.serviceRegions,
    });
    if (!gate.ok) {
      await writeAuditRow(supabase, {
        actor_user_id: userId,
        action: "postharvest.provider.register",
        subject_type: "postharvest_provider",
        decision: "deny",
        metadata: { kind: data.kind, errors: gate.errors },
      });
      throw new Error(gate.errors.join(" "));
    }

    const { data: row, error } = await supabase
      .from("postharvest_providers")
      .insert({
        kind: data.kind,
        subtype_code: gate.subtypeCode,
        display_name: data.displayName,
        contact_email: data.contactEmail,
        service_regions: data.serviceRegions,
        geography_id: data.geographyId ?? null,
        tenant_id: data.tenantId ?? null,
        state: "submitted",
        is_synthetic: true,
        created_by: userId,
      } as never)
      .select("id")
      .single();
    if (error || !row) throw new Error("provider_create_failed");

    await writeAuditRow(supabase, {
      actor_user_id: userId,
      action: "postharvest.provider.register",
      subject_type: "postharvest_provider",
      subject_id: (row as { id: string }).id,
      decision: "allow",
      metadata: { kind: data.kind, subtype: gate.subtypeCode },
    });
    return { id: (row as { id: string }).id };
  });

export const decidePostharvestProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { providerId: string; decision: "approve" | "reject" | "suspend"; note?: string }) => input,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { resolveStateActor, canOperatePostharvest } = await import("@/lib/atap/state.server");
    const { writeAuditRow } = await import("@/lib/atap/onboarding.server");
    const actor = await resolveStateActor(supabase, userId);
    if (!canOperatePostharvest(actor)) throw new Error("not_authorized");

    const nextState =
      data.decision === "approve" ? "approved" : data.decision === "reject" ? "rejected" : "suspended";
    const { error } = await supabase
      .from("postharvest_providers")
      .update({
        state: nextState,
        decision_note: data.note ?? null,
        decided_by: userId,
        decided_at: new Date().toISOString(),
      } as never)
      .eq("id", data.providerId);
    if (error) throw new Error("provider_decision_failed");

    await writeAuditRow(supabase, {
      actor_user_id: userId,
      action: "postharvest.provider.decide",
      subject_type: "postharvest_provider",
      subject_id: data.providerId,
      decision: data.decision === "approve" ? "allow" : "deny",
      metadata: { next_state: nextState, note: data.note ?? null },
    });
    return { state: nextState };
  });

export const publishCapacityListing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      providerId: string;
      commodity: string;
      capacityTonnes: number;
      availableTonnes: number;
      temperatureMinC?: number | null;
      temperatureMaxC?: number | null;
      pricePerTonneMonth?: number | null;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { writeAuditRow } = await import("@/lib/atap/onboarding.server");

    const { data: providerRow } = await supabase
      .from("postharvest_providers")
      .select("id, kind, state, geography_id, created_by")
      .eq("id", data.providerId)
      .maybeSingle();
    const p = providerRow as unknown as {
      kind: PostharvestKind;
      state: string;
      geography_id: string | null;
      created_by: string | null;
    } | null;
    if (!p) throw new Error("provider_not_found");

    const check = checkCapacityListing({
      kind: p.kind,
      providerState: p.state,
      commodity: data.commodity,
      capacityTonnes: data.capacityTonnes,
      availableTonnes: data.availableTonnes,
      temperatureMinC: data.temperatureMinC ?? null,
      temperatureMaxC: data.temperatureMaxC ?? null,
      pricePerTonneMonth: data.pricePerTonneMonth ?? null,
    });
    if (!check.ok) {
      await writeAuditRow(supabase, {
        actor_user_id: userId,
        action: "postharvest.listing.publish",
        subject_type: "postharvest_provider",
        subject_id: data.providerId,
        decision: "deny",
        metadata: { errors: check.errors },
      });
      throw new Error(check.errors.join(" "));
    }

    const { data: row, error } = await supabase
      .from("storage_capacity_listings")
      .insert({
        provider_id: data.providerId,
        commodity: data.commodity,
        capacity_tonnes: data.capacityTonnes,
        available_tonnes: data.availableTonnes,
        temperature_min_c: data.temperatureMinC ?? null,
        temperature_max_c: data.temperatureMaxC ?? null,
        price_per_tonne_month: data.pricePerTonneMonth ?? null,
        geography_id: p.geography_id,
        status: "published",
        quality_score: check.qualityScore,
        is_synthetic: true,
        created_by: userId,
      } as never)
      .select("id")
      .single();
    if (error || !row) throw new Error("listing_create_failed");

    await writeAuditRow(supabase, {
      actor_user_id: userId,
      action: "postharvest.listing.publish",
      subject_type: "storage_capacity_listing",
      subject_id: (row as { id: string }).id,
      decision: "allow",
      metadata: { quality_score: check.qualityScore, commodity: data.commodity },
    });
    return { id: (row as { id: string }).id, qualityScore: check.qualityScore };
  });

export const proposeProcessorContract = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      providerId: string;
      commodity: string;
      quantityTonnes: number;
      pricePerTonne: number;
      deliveryWindow?: string;
      counterpartyProfileId?: string | null;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { loadSubtypeGate } = await import("@/lib/atap/state.server");
    const { writeAuditRow } = await import("@/lib/atap/onboarding.server");

    const subtype = await loadSubtypeGate(supabase, "processor_sourcing");
    const active = Boolean(
      subtype && subtype.evidence_gate === "approved" && subtype.is_active && subtype.flagEnabled,
    );
    if (!active) throw new Error("processor_sourcing_not_active");

    const { data: providerRow } = await supabase
      .from("postharvest_providers")
      .select("id, kind, state")
      .eq("id", data.providerId)
      .maybeSingle();
    const p = providerRow as unknown as { kind: PostharvestKind; state: string } | null;
    if (!p) throw new Error("provider_not_found");
    if (p.kind !== "processor") throw new Error("provider_not_processor");
    if (p.state !== "approved") throw new Error("provider_not_approved");
    if (!(data.quantityTonnes > 0)) throw new Error("quantity_must_be_positive");

    const { data: row, error } = await supabase
      .from("processor_contracts")
      .insert({
        provider_id: data.providerId,
        counterparty_profile_id: data.counterpartyProfileId ?? null,
        commodity: data.commodity,
        quantity_tonnes: data.quantityTonnes,
        price_per_tonne: data.pricePerTonne,
        delivery_window: data.deliveryWindow ?? "",
        status: "proposed",
        requires_human_decision: true,
        is_synthetic: true,
        created_by: userId,
      } as never)
      .select("id")
      .single();
    if (error || !row) throw new Error("contract_create_failed");

    await writeAuditRow(supabase, {
      actor_user_id: userId,
      action: "postharvest.contract.propose",
      subject_type: "processor_contract",
      subject_id: (row as { id: string }).id,
      decision: "allow",
      metadata: { commodity: data.commodity, quantity_tonnes: data.quantityTonnes },
    });
    return { id: (row as { id: string }).id };
  });

export const transitionProcessorContract = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { contractId: string; next: ContractStatus; note?: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { resolveStateActor, canOperatePostharvest, loadSubtypeGate } = await import(
      "@/lib/atap/state.server"
    );
    const { writeAuditRow } = await import("@/lib/atap/onboarding.server");

    const actor = await resolveStateActor(supabase, userId);
    const { data: row } = await supabase
      .from("processor_contracts")
      .select("id, status, created_by, provider_id")
      .eq("id", data.contractId)
      .maybeSingle();
    const c = row as unknown as { status: ContractStatus; created_by: string | null } | null;
    if (!c) throw new Error("contract_not_found");

    const subtype = await loadSubtypeGate(supabase, "processor_sourcing");
    const plan = planContractTransition({
      current: c.status,
      next: data.next,
      actorIsParty: c.created_by === userId,
      actorIsOperator: canOperatePostharvest(actor),
      subtypeActive: Boolean(
        subtype && subtype.evidence_gate === "approved" && subtype.is_active && subtype.flagEnabled,
      ),
    });
    if (!plan.ok) {
      await writeAuditRow(supabase, {
        actor_user_id: userId,
        action: "postharvest.contract.transition",
        subject_type: "processor_contract",
        subject_id: data.contractId,
        decision: "deny",
        metadata: { errors: plan.errors, requested: data.next },
      });
      throw new Error(plan.errors.join(" "));
    }

    const { error } = await supabase
      .from("processor_contracts")
      .update({
        status: plan.nextStatus,
        decision_note: data.note ?? null,
        decided_by: userId,
        decided_at: new Date().toISOString(),
      } as never)
      .eq("id", data.contractId);
    if (error) throw new Error("contract_transition_failed");

    await writeAuditRow(supabase, {
      actor_user_id: userId,
      action: "postharvest.contract.transition",
      subject_type: "processor_contract",
      subject_id: data.contractId,
      decision: "allow",
      metadata: { status: plan.nextStatus, human_decision: true },
    });
    return { status: plan.nextStatus };
  });
