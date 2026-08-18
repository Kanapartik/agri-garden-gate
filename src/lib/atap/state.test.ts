import { describe, expect, it } from "vitest";
import {
  PLATFORM_MIN_COHORT,
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
  stateConfigVisibleTo,
  summariseState,
  usableTrainingContent,
  type AggregateRow,
  type KnowledgeContribution,
} from "./state";

const allowedFlags = [
  "state.tenant_configuration",
  "knowledge.contribution",
  "research.aggregate_access",
  "policy.aggregate_dashboard",
];

function contribution(over: Partial<KnowledgeContribution> = {}): KnowledgeContribution {
  return {
    id: "k1",
    status: "submitted",
    author_user_id: "author",
    reviewed_by: null,
    institution_state: "approved",
    title: "Rabi maize spacing guidance",
    summary: "Field-tested spacing guidance for rabi maize in the anchor district.",
    body: "x".repeat(200),
    citations: ["KVK trial 2025/11"],
    is_training_content: false,
    ai_grounding_enabled: false,
    ...over,
  };
}

describe("state configuration stays inside its own tenant boundary", () => {
  const base = {
    tenantId: "t-state",
    tenantType: "govt_dept",
    geographyLevel: "state",
    defaultLocale: "te",
    locales: ["en", "te"],
    enabledFlags: ["knowledge.contribution"],
    aggregationMinCohort: 10,
    allowedFlags,
  };

  it("accepts a state-level configuration and scopes it to one tenant", () => {
    const plan = planStateConfiguration(base);
    expect(plan.ok).toBe(true);
    expect(plan.scopedTenantIds).toEqual(["t-state"]);
    expect(plan.allowsRawFarmerAccess).toBe(false);
  });

  it("rejects non-state geography and non-state tenant types", () => {
    expect(planStateConfiguration({ ...base, geographyLevel: "district" }).errors).toContain(
      "geography_level_must_be_state",
    );
    expect(planStateConfiguration({ ...base, tenantType: "bank" }).errors).toContain(
      "tenant_type_not_state_capable",
    );
  });

  it("refuses flags the platform does not delegate to states", () => {
    const plan = planStateConfiguration({ ...base, enabledFlags: ["market.listings"] });
    expect(plan.ok).toBe(false);
    expect(plan.errors.some((e) => e.startsWith("flag_not_state_governable"))).toBe(true);
    expect(plan.enabledFlags).toEqual([]);
  });

  it("never grants raw farmer access and never drops below the cohort floor", () => {
    const plan = planStateConfiguration({
      ...base,
      aggregationMinCohort: 2,
      requestedRawFarmerAccess: true,
    });
    expect(plan.ok).toBe(false);
    expect(plan.errors).toContain("raw_farmer_access_not_grantable");
    expect(plan.aggregationMinCohort).toBe(PLATFORM_MIN_COHORT);
    expect(plan.allowsRawFarmerAccess).toBe(false);
  });

  it("does not leak a state config to another tenant's staff", () => {
    const cfg = { tenant_id: "t-state" };
    expect(
      stateConfigVisibleTo(cfg, { isPlatformAdmin: false, isAuditor: false, tenantIds: ["t-other"] }),
    ).toBe(false);
    expect(
      stateConfigVisibleTo(cfg, { isPlatformAdmin: false, isAuditor: false, tenantIds: ["t-state"] }),
    ).toBe(true);
    expect(
      stateConfigVisibleTo(cfg, { isPlatformAdmin: false, isAuditor: true, tenantIds: [] }),
    ).toBe(true);
  });
});

describe("knowledge contribution cannot publish or ground AI before approval", () => {
  it("requires a complete draft from an approved institution", () => {
    expect(checkKnowledgeSubmit(contribution({ status: "draft" })).ok).toBe(true);
    expect(
      checkKnowledgeSubmit(contribution({ status: "draft", citations: [] })).errors,
    ).toContain("citation_required");
    expect(
      checkKnowledgeSubmit(contribution({ status: "draft", institution_state: "submitted" })).errors,
    ).toContain("institution_not_approved");
  });

  it("blocks self-review (separation of duties)", () => {
    const verdict = decideKnowledgeReview({
      contribution: contribution(),
      reviewerUserId: "author",
      reviewerIsReviewer: true,
      decision: "approve",
      publish: true,
    });
    expect(verdict.ok).toBe(false);
    expect(verdict.errors).toContain("reviewer_separation_violated");
    expect(verdict.publish).toBe(false);
    expect(verdict.nextStatus).toBe("submitted");
  });

  it("blocks review by a non-reviewer", () => {
    const verdict = decideKnowledgeReview({
      contribution: contribution(),
      reviewerUserId: "someone",
      reviewerIsReviewer: false,
      decision: "approve",
    });
    expect(verdict.errors).toContain("reviewer_role_required");
  });

  it("publishes only through a separate reviewer's approval", () => {
    const verdict = decideKnowledgeReview({
      contribution: contribution(),
      reviewerUserId: "reviewer",
      reviewerIsReviewer: true,
      decision: "approve",
      publish: true,
    });
    expect(verdict.ok).toBe(true);
    expect(verdict.nextStatus).toBe("published");
  });

  it("refuses AI grounding while the grounding flag is off", () => {
    const off = decideKnowledgeReview({
      contribution: contribution(),
      reviewerUserId: "reviewer",
      reviewerIsReviewer: true,
      decision: "approve",
      publish: true,
      enableAiGrounding: true,
      aiGroundingFlagEnabled: false,
    });
    expect(off.ok).toBe(false);
    expect(off.errors).toContain("ai_grounding_flag_disabled");
    expect(off.aiGroundingEnabled).toBe(false);

    const on = decideKnowledgeReview({
      contribution: contribution(),
      reviewerUserId: "reviewer",
      reviewerIsReviewer: true,
      decision: "approve",
      publish: true,
      enableAiGrounding: true,
      aiGroundingFlagEnabled: true,
    });
    expect(on.ok).toBe(true);
    expect(on.aiGroundingEnabled).toBe(true);
  });

  it("never grounds unapproved, unpublished or unreviewed content", () => {
    const rows = [
      contribution({ id: "a", status: "submitted", ai_grounding_enabled: true, reviewed_by: null }),
      contribution({ id: "b", status: "approved", ai_grounding_enabled: true, reviewed_by: "r" }),
      contribution({ id: "c", status: "published", ai_grounding_enabled: false, reviewed_by: "r" }),
      contribution({ id: "d", status: "published", ai_grounding_enabled: true, reviewed_by: "r" }),
    ];
    expect(groundableKnowledge(rows).map((r) => r.id)).toEqual(["d"]);
  });

  it("only serves training content once published by a reviewer", () => {
    const rows = [
      contribution({ id: "t1", is_training_content: true, status: "approved", reviewed_by: "r" }),
      contribution({ id: "t2", is_training_content: true, status: "published", reviewed_by: "r" }),
    ];
    expect(usableTrainingContent(rows).map((r) => r.id)).toEqual(["t2"]);
  });
});

describe("research and policy access obeys aggregation controls", () => {
  const req = {
    title: "Storage utilisation study",
    abstract: "Aggregate study of storage utilisation across two anchor districts over one season.",
    purposeCode: "research_aggregate",
    datasets: ["storage_utilisation_aggregate"],
    duaReference: "DUA-2026-01",
    ethicsReference: "ETH-2026-07",
    aggregationMinCohort: 10,
  };

  it("accepts an aggregate-scoped request", () => {
    const check = checkResearchRequest(req);
    expect(check.ok).toBe(true);
    expect(check.rawRowAccess).toBe(false);
  });

  it("rejects raw-row requests, non-aggregate purposes and unknown datasets", () => {
    expect(checkResearchRequest({ ...req, requestedRawRows: true }).errors).toContain(
      "raw_row_access_not_available",
    );
    expect(checkResearchRequest({ ...req, purposeCode: "credit_assessment" }).errors).toContain(
      "purpose_not_aggregate_scoped",
    );
    expect(
      checkResearchRequest({ ...req, datasets: ["farm_records"] }).errors.some((e) =>
        e.startsWith("dataset_not_aggregate"),
      ),
    ).toBe(true);
  });

  it("requires DUA and ethics references plus platform authority to approve", () => {
    expect(
      checkResearchApproval({
        status: "submitted",
        duaReference: null,
        ethicsReference: "ETH-1",
        approverIsPlatformAdmin: true,
      }).errors,
    ).toContain("dua_reference_required");
    expect(
      checkResearchApproval({
        status: "submitted",
        duaReference: "DUA-1",
        ethicsReference: "ETH-1",
        approverIsPlatformAdmin: false,
      }).errors,
    ).toContain("not_authorized");
    expect(
      checkResearchApproval({
        status: "ethics_review",
        duaReference: "DUA-1",
        ethicsReference: "ETH-1",
        approverIsPlatformAdmin: true,
      }).ok,
    ).toBe(true);
  });

  const rows: AggregateRow[] = [
    { metric_code: "storage_utilisation", period: "2026-Q1", geography_id: "g1", value: 62, cohort_size: 40, is_deidentified: true },
    { metric_code: "storage_utilisation", period: "2026-Q1", geography_id: "g2", value: 71, cohort_size: 4, is_deidentified: true },
  ];

  it("suppresses small cohorts and honours the strictest minimum", () => {
    const verdict = evaluateAggregateExport({
      request: {
        status: "approved",
        aggregation_min_cohort: 10,
        requested_datasets: ["storage_utilisation_aggregate"],
        expires_at: null,
      },
      datasetCode: "storage_utilisation_aggregate",
      stateMinCohort: 25,
      rows,
      now: new Date("2026-04-01T00:00:00Z"),
    });
    expect(verdict.allowed).toBe(true);
    expect(verdict.minCohortApplied).toBe(25);
    expect(verdict.rows).toHaveLength(1);
    expect(verdict.suppressed).toBe(1);
  });

  it("denies exports for unapproved, expired or out-of-scope requests", () => {
    const base = {
      datasetCode: "storage_utilisation_aggregate",
      rows,
      now: new Date("2026-04-01T00:00:00Z"),
    };
    expect(
      evaluateAggregateExport({
        ...base,
        request: { status: "submitted", aggregation_min_cohort: 10, requested_datasets: ["storage_utilisation_aggregate"], expires_at: null },
      }).errors,
    ).toContain("request_not_approved");
    expect(
      evaluateAggregateExport({
        ...base,
        request: { status: "approved", aggregation_min_cohort: 10, requested_datasets: ["storage_utilisation_aggregate"], expires_at: "2026-01-01T00:00:00Z" },
      }).errors,
    ).toContain("request_expired");
    expect(
      evaluateAggregateExport({
        ...base,
        request: { status: "approved", aggregation_min_cohort: 10, requested_datasets: ["market_price_aggregate"], expires_at: null },
      }).errors,
    ).toContain("dataset_not_in_request");
  });

  it("rejects any identified row outright", () => {
    const verdict = evaluateAggregateExport({
      request: { status: "approved", aggregation_min_cohort: 10, requested_datasets: ["storage_utilisation_aggregate"], expires_at: null },
      datasetCode: "storage_utilisation_aggregate",
      rows: [{ ...rows[0]!, is_deidentified: false }],
      now: new Date("2026-04-01T00:00:00Z"),
    });
    expect(verdict.allowed).toBe(false);
    expect(verdict.errors).toContain("identified_rows_rejected");
    expect(verdict.rows).toEqual([]);
  });

  it("suppresses small cohorts on policymaker dashboards too", () => {
    const dash = policyDashboard({ rows, minCohort: 10 });
    expect(dash.metrics).toHaveLength(1);
    expect(dash.suppressed).toBe(1);
  });
});

describe("post-harvest onboarding rides the evidence gate", () => {
  const approvedSubtype = {
    code: "cold_storage",
    evidence_gate: "approved",
    is_active: true,
    flagEnabled: true,
    verification_checks: [{ code: "cold_chain_certificate", label: "Cold chain" }],
    dispute_categories: ["temperature_excursion"],
  };
  const provider = {
    kind: "cold_storage" as const,
    displayName: "Anchor Cold Chain (synthetic)",
    contactEmail: "ops@synthetic.example",
    serviceRegions: ["geo-district-1"],
  };

  it("onboards only when evidence is approved, checks and disputes exist and the flag is on", () => {
    expect(checkPostharvestOnboarding({ ...provider, subtype: approvedSubtype }).ok).toBe(true);
    expect(
      checkPostharvestOnboarding({
        ...provider,
        subtype: { ...approvedSubtype, evidence_gate: "evidence_pending", is_active: false, flagEnabled: false },
      }).errors,
    ).toEqual(
      expect.arrayContaining(["evidence_gate_not_approved", "subtype_inactive", "feature_flag_disabled"]),
    );
    expect(
      checkPostharvestOnboarding({
        ...provider,
        subtype: { ...approvedSubtype, dispute_categories: [] },
      }).errors,
    ).toContain("dispute_flow_missing");
  });

  it("requires a configured subtype", () => {
    expect(checkPostharvestOnboarding({ ...provider, subtype: null }).errors).toContain(
      "subtype_not_configured",
    );
  });

  it("validates capacity listings and cold-chain temperature ranges", () => {
    expect(
      checkCapacityListing({
        kind: "warehouse",
        providerState: "approved",
        commodity: "maize",
        capacityTonnes: 500,
        availableTonnes: 200,
        pricePerTonneMonth: 300,
      }).ok,
    ).toBe(true);
    expect(
      checkCapacityListing({
        kind: "cold_storage",
        providerState: "approved",
        commodity: "tomato",
        capacityTonnes: 100,
        availableTonnes: 50,
        pricePerTonneMonth: 900,
      }).errors,
    ).toContain("cold_chain_temperature_range_required");
    expect(
      checkCapacityListing({
        kind: "warehouse",
        providerState: "submitted",
        commodity: "maize",
        capacityTonnes: 100,
        availableTonnes: 400,
        pricePerTonneMonth: 100,
      }).errors,
    ).toEqual(expect.arrayContaining(["provider_not_approved", "available_exceeds_capacity"]));
  });

  it("keeps contract transitions human-decided and legal", () => {
    const ok = planContractTransition({
      current: "proposed",
      next: "accepted",
      actorIsParty: true,
      actorIsOperator: false,
      subtypeActive: true,
    });
    expect(ok.ok).toBe(true);
    expect(ok.requiresHumanDecision).toBe(true);

    expect(
      planContractTransition({
        current: "draft",
        next: "active",
        actorIsParty: true,
        actorIsOperator: false,
        subtypeActive: true,
      }).errors,
    ).toContain("illegal_transition");

    expect(
      planContractTransition({
        current: "proposed",
        next: "accepted",
        actorIsParty: false,
        actorIsOperator: false,
        subtypeActive: true,
      }).errors,
    ).toContain("not_authorized");

    expect(
      planContractTransition({
        current: "disputed",
        next: "completed",
        actorIsParty: true,
        actorIsOperator: false,
        subtypeActive: true,
      }).errors,
    ).toContain("dispute_resolution_requires_operator");

    expect(
      planContractTransition({
        current: "proposed",
        next: "accepted",
        actorIsParty: true,
        actorIsOperator: false,
        subtypeActive: false,
      }).errors,
    ).toContain("processor_sourcing_not_active");
  });
});

describe("state dashboard reports aggregate counts only", () => {
  it("summarises the slice", () => {
    const dash = summariseState({
      stateConfigs: [{ id: "s1" }],
      institutions: [{ state: "approved" }, { state: "submitted" }],
      contributions: [
        contribution({ id: "a", status: "submitted" }),
        contribution({ id: "b", status: "published", reviewed_by: "r", ai_grounding_enabled: true }),
      ],
      researchRequests: [{ status: "submitted" }, { status: "approved" }],
      exports: [{ allowed: true }, { allowed: false }],
      providers: [{ state: "approved" }, { state: "draft" }],
      listings: [{ id: "l1" }],
      contracts: [],
    });
    expect(dash.institutions).toEqual({ total: 2, approved: 1, pending: 1 });
    expect(dash.knowledge).toEqual({ total: 2, awaitingReview: 1, published: 1, groundable: 1 });
    expect(dash.research.deniedExports).toBe(1);
    expect(dash.aggregateOnly).toBe(true);
  });
});
