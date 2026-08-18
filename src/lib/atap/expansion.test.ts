import { describe, expect, it } from "vitest";
import {
  CLONEABLE_LOCAL_ROLES,
  MATERIAL_EFFORT_IMPROVEMENT,
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
  type DistrictTemplate,
  type EffortMetric,
  type ServiceSubtypeConfig,
} from "./expansion";

const template: DistrictTemplate = {
  code: "anchor_district_v1",
  version: 1,
  default_locale: "en",
  locales: ["en", "te", "hi"],
  scheme_codes: ["seed_subsidy", "drip_irrigation_support"],
  local_roles: ["tenant_admin", "onboarding_officer", "field_agent"],
  checklist: [{ key: "geography_configured", label: "Geography", required: true }],
  config: { identity_adapter: "mock_jurisdiction", effort_baseline_person_days: 120 },
  is_active: true,
};

const activeSubtype: ServiceSubtypeConfig = {
  code: "chc_equipment_rental",
  domain: "chc_equipment_rental",
  evidence_gate: "approved",
  verification_checks: [
    { code: "entity_proof", label: "Entity proof" },
    { code: "insurance_cover", label: "Insurance" },
  ],
  dispute_categories: ["equipment_not_delivered", "billing_dispute"],
  requires_human_decision: true,
  is_active: true,
  flagEnabled: true,
};

describe("district template cloning is configuration, not a fork", () => {
  it("clones an active template into a district geography", () => {
    const plan = planDistrictClone({
      template,
      geographyId: "geo-2",
      geographyLevel: "district",
      locale: "te",
    });
    expect(plan.ok).toBe(true);
    expect(plan.forkedCode).toBe(false);
    expect(plan.templateVersion).toBe(1);
    expect(plan.locale).toBe("te");
    expect(plan.schemeCodes).toEqual(template.scheme_codes);
  });

  it("merges configuration overrides over template config", () => {
    const plan = planDistrictClone({
      template,
      geographyId: "geo-2",
      geographyLevel: "district",
      locale: "en",
      configOverrides: { effort_baseline_person_days: 80, new_key: true },
    });
    expect(plan.appliedConfig).toMatchObject({
      identity_adapter: "mock_jurisdiction",
      effort_baseline_person_days: 80,
      new_key: true,
    });
  });

  it("rejects a locale the template does not declare", () => {
    const plan = planDistrictClone({
      template,
      geographyId: "geo-2",
      geographyLevel: "district",
      locale: "fr",
    });
    expect(plan.ok).toBe(false);
    expect(plan.errors).toContain("locale_not_in_template");
  });

  it("rejects schemes and roles outside the template", () => {
    const plan = planDistrictClone({
      template,
      geographyId: "geo-2",
      geographyLevel: "district",
      locale: "en",
      schemeCodes: ["mystery_scheme"],
      localRoles: ["platform_admin"],
    });
    expect(plan.ok).toBe(false);
    expect(plan.errors.some((e) => e.startsWith("scheme_not_in_template"))).toBe(true);
    expect(plan.errors.some((e) => e.startsWith("role_not_cloneable"))).toBe(true);
  });

  it("never allows platform-level authority to be cloned into a district", () => {
    expect(CLONEABLE_LOCAL_ROLES).not.toContain("platform_admin");
    expect(CLONEABLE_LOCAL_ROLES).not.toContain("auditor");
    expect(CLONEABLE_LOCAL_ROLES).not.toContain("expansion_manager");
  });

  it("rejects village-level and inactive templates", () => {
    expect(
      planDistrictClone({ template, geographyId: "g", geographyLevel: "village", locale: "en" }).errors,
    ).toContain("geography_level_not_cloneable");
    expect(
      planDistrictClone({
        template: { ...template, is_active: false },
        geographyId: "g",
        geographyLevel: "district",
        locale: "en",
      }).errors,
    ).toContain("template_inactive");
  });

  it("uses the identical template version for district #1 and #2 (same core code path)", () => {
    const a = planDistrictClone({ template, geographyId: "g1", geographyLevel: "district", locale: "en" });
    const b = planDistrictClone({ template, geographyId: "g2", geographyLevel: "district", locale: "te" });
    expect(a.templateVersion).toBe(b.templateVersion);
    expect(a.forkedCode).toBe(b.forkedCode);
  });
});

describe("effort instrumentation and the acceptance gate", () => {
  const metrics: EffortMetric[] = [
    { rollout_id: "d1", phase: "setup", person_days: 60, cost_amount: 300000, onboarded_count: 0, is_operational: true },
    { rollout_id: "d1", phase: "onboarding", person_days: 60, cost_amount: 200000, onboarded_count: 400, is_operational: true },
    { rollout_id: "d2", phase: "setup", person_days: 20, cost_amount: 90000, onboarded_count: 0, is_operational: true },
    { rollout_id: "d2", phase: "onboarding", person_days: 40, cost_amount: 120000, onboarded_count: 500, is_operational: true },
  ];

  it("summarises person-days, cost and effort per onboarding", () => {
    const s = summariseEffort("d1", metrics);
    expect(s.personDays).toBe(120);
    expect(s.cost).toBe(500000);
    expect(s.onboarded).toBe(400);
    expect(s.personDaysPerOnboarding).toBeCloseTo(0.3);
  });

  it("reports materially lower effort for district #2", () => {
    const verdict = compareDistrictEffort({
      baselineRolloutId: "d1",
      candidateRolloutId: "d2",
      metrics,
    });
    expect(verdict.status).toBe("compared");
    if (verdict.status !== "compared") return;
    expect(verdict.candidate.personDaysPerOnboarding).toBeCloseTo(0.12);
    expect(verdict.improvementPct).toBeGreaterThan(MATERIAL_EFFORT_IMPROVEMENT);
    expect(verdict.materiallyLower).toBe(true);
  });

  it("does not claim improvement when the drop is immaterial", () => {
    const verdict = compareDistrictEffort({
      baselineRolloutId: "d1",
      candidateRolloutId: "d2",
      metrics: [
        metrics[0]!,
        metrics[1]!,
        { rollout_id: "d2", phase: "all", person_days: 115, cost_amount: 1, onboarded_count: 400, is_operational: true },
      ],
    });
    expect(verdict.status).toBe("compared");
    if (verdict.status !== "compared") return;
    expect(verdict.materiallyLower).toBe(false);
  });

  it("returns insufficient_data when figures are projections, not operational", () => {
    const projected = metrics.map((m) => ({ ...m, is_operational: false }));
    expect(
      compareDistrictEffort({ baselineRolloutId: "d1", candidateRolloutId: "d2", metrics: projected }).status,
    ).toBe("insufficient_data");
  });

  it("returns insufficient_data when no onboarding volume was recorded", () => {
    const noVolume: EffortMetric[] = [
      { rollout_id: "d1", phase: "setup", person_days: 10, cost_amount: 0, onboarded_count: 0, is_operational: true },
      { rollout_id: "d2", phase: "setup", person_days: 5, cost_amount: 0, onboarded_count: 0, is_operational: true },
    ];
    const v = compareDistrictEffort({ baselineRolloutId: "d1", candidateRolloutId: "d2", metrics: noVolume });
    expect(v.status).toBe("insufficient_data");
    if (v.status === "insufficient_data") expect(v.reason).toBe("no_onboarding_volume");
  });
});

describe("service subtype activation is evidence-gated", () => {
  it("approves activation only with an approved evidence gate", () => {
    expect(evaluateSubtypeActivation({ subtype: activeSubtype }).ok).toBe(true);
    expect(
      evaluateSubtypeActivation({ subtype: { ...activeSubtype, evidence_gate: "not_evaluated" } }).errors,
    ).toContain("evidence_gate_not_approved");
    expect(
      evaluateSubtypeActivation({ subtype: { ...activeSubtype, evidence_gate: "evidence_pending" } }).ok,
    ).toBe(false);
  });

  it("refuses activation without verification checks or a dispute flow", () => {
    expect(
      evaluateSubtypeActivation({ subtype: { ...activeSubtype, verification_checks: [] } }).errors,
    ).toContain("verification_checks_missing");
    expect(
      evaluateSubtypeActivation({ subtype: { ...activeSubtype, dispute_categories: [] } }).errors,
    ).toContain("dispute_flow_missing");
  });

  it("refuses activation for a domain that would auto-decide", () => {
    expect(
      evaluateSubtypeActivation({ subtype: { ...activeSubtype, requires_human_decision: false } }).errors,
    ).toContain("human_decision_required");
  });

  it("does not activate subtypes implicitly: each needs its own gate and flag", () => {
    const subtypes: ServiceSubtypeConfig[] = [
      activeSubtype,
      { ...activeSubtype, code: "logistics", domain: "logistics", evidence_gate: "not_evaluated", is_active: false, flagEnabled: false },
      { ...activeSubtype, code: "ngo_csr_program", domain: "ngo_csr_program", evidence_gate: "approved", is_active: true, flagEnabled: false },
    ];
    expect(usableSubtypes(subtypes).map((s) => s.code)).toEqual(["chc_equipment_rental"]);
  });

  it("keeps export marketplace and talent domains out of scope", () => {
    expect(isDomainInScope("export_marketplace")).toBe(false);
    expect(isDomainInScope("talent")).toBe(false);
    expect(isDomainInScope("logistics")).toBe(true);
    expect(
      usableSubtypes([{ ...activeSubtype, code: "talent_pool", domain: "talent" }]),
    ).toEqual([]);
  });
});

describe("service provider onboarding", () => {
  const draft = {
    subtypeCode: "chc_equipment_rental",
    displayName: "Warangal CHC (synthetic)",
    contactEmail: "chc@example.com",
    serviceRegions: ["TS-WGL"],
  };

  it("accepts a complete draft for an activated subtype", () => {
    expect(checkProviderSubmit({ draft, subtype: activeSubtype }).ok).toBe(true);
  });

  it("blocks submission when the subtype is not activated", () => {
    const res = checkProviderSubmit({
      draft,
      subtype: { ...activeSubtype, evidence_gate: "not_evaluated" },
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors).toContain("subtype_not_activated");
  });

  it("validates name, email and service region", () => {
    const res = checkProviderSubmit({
      draft: { ...draft, displayName: "X", contactEmail: "nope", serviceRegions: [] },
      subtype: activeSubtype,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors).toContain("display_name_too_short");
      expect(res.errors).toContain("contact_email_invalid");
      expect(res.errors).toContain("service_region_required");
    }
  });

  it("requires every configured verification check to pass before approval", () => {
    const plan = planProviderApproval({
      subtype: activeSubtype,
      currentState: "verification",
      checks: [{ check_code: "entity_proof", status: "passed" }],
      reviewerIsAuthorized: true,
      decision: "approved",
      note: "site visit completed",
    });
    expect(plan.ok).toBe(false);
    expect(plan.errors.some((e) => e.startsWith("checks_incomplete"))).toBe(true);
  });

  it("approves once all checks pass and an authorized human notes the decision", () => {
    const plan = planProviderApproval({
      subtype: activeSubtype,
      currentState: "verification",
      checks: [
        { check_code: "entity_proof", status: "passed" },
        { check_code: "insurance_cover", status: "passed" },
      ],
      reviewerIsAuthorized: true,
      decision: "approved",
      note: "all checks verified on site",
    });
    expect(plan.ok).toBe(true);
    expect(plan.nextState).toBe("approved");
    expect(plan.requiresHumanDecision).toBe(true);
  });

  it("rejects unauthorized reviewers, short notes and unsubmitted drafts", () => {
    expect(
      planProviderApproval({
        subtype: activeSubtype,
        currentState: "draft",
        checks: [],
        reviewerIsAuthorized: false,
        decision: "rejected",
        note: "no",
      }).errors,
    ).toEqual(expect.arrayContaining(["not_authorized", "decision_note_required", "provider_not_submitted"]));
  });
});

describe("every activated domain has a dispute flow reaching a human", () => {
  it("routes a configured dispute category to human review", () => {
    const r = routeServiceDispute({
      subtype: activeSubtype,
      category: "billing_dispute",
      summary: "Invoice charged twice for the same rental slot",
      actorIsParty: true,
    });
    expect(r.ok).toBe(true);
    expect(r.status).toBe("human_review");
    expect(r.autoResolved).toBe(false);
  });

  it("rejects unconfigured categories, non-parties and thin summaries", () => {
    const r = routeServiceDispute({
      subtype: activeSubtype,
      category: "spaceship_damage",
      summary: "bad",
      actorIsParty: false,
    });
    expect(r.errors).toEqual(
      expect.arrayContaining(["not_engagement_party", "dispute_category_not_configured", "summary_too_short"]),
    );
  });
});

describe("partner certification and certified badge", () => {
  it("is eligible only when every programme criterion is met", () => {
    const criteria = [
      { code: "sandbox_conformance", label: "", met: true },
      { code: "consent_handling_review", label: "", met: true },
      { code: "security_questionnaire", label: "", met: true },
      { code: "support_contact_published", label: "", met: false },
    ];
    const partial = evaluateCertification({ programmeCode: "partner_api_certified", criteria });
    expect(partial.eligible).toBe(false);
    expect(partial.missing).toEqual(["support_contact_published"]);

    const full = evaluateCertification({
      programmeCode: "partner_api_certified",
      criteria: criteria.map((c) => ({ ...c, met: true })),
    });
    expect(full.eligible).toBe(true);
    expect(full.requiresHumanDecision).toBe(true);
  });

  it("is never eligible for an unknown programme", () => {
    expect(evaluateCertification({ programmeCode: "made_up", criteria: [] }).eligible).toBe(false);
  });

  it("shows the badge only while certified and unexpired", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    expect(certifiedBadgeVisible({ state: "certified", badgeExpiresAt: null, now }).visible).toBe(true);
    expect(
      certifiedBadgeVisible({ state: "certified", badgeExpiresAt: "2025-01-01T00:00:00Z", now }).reason,
    ).toBe("badge_expired");
    expect(certifiedBadgeVisible({ state: "revoked", badgeExpiresAt: null, now }).visible).toBe(false);
    expect(certifiedBadgeVisible({ state: "in_review", badgeExpiresAt: null, now }).visible).toBe(false);
  });
});

describe("support routing and managed onboarding cases", () => {
  it("routes managed onboarding to customer success", () => {
    const r = routeSupportCase({ caseType: "managed_onboarding", severity: "normal", hasManagedOnboarding: true });
    expect(r.queue).toBe("customer_success");
    expect(r.slaHours).toBe(48);
    expect(r.requiresHumanOwner).toBe(true);
  });

  it("escalates high and critical severity regardless of case type", () => {
    expect(routeSupportCase({ caseType: "managed_onboarding", severity: "critical", hasManagedOnboarding: true }).queue).toBe("tier2_escalation");
    expect(routeSupportCase({ caseType: "generic", severity: "high", hasManagedOnboarding: false }).slaHours).toBe(8);
  });

  it("routes trust & safety separately and does not use commercial plan", () => {
    const a = routeSupportCase({ caseType: "trust_safety", severity: "normal", hasManagedOnboarding: false });
    const b = routeSupportCase({ caseType: "trust_safety", severity: "normal", hasManagedOnboarding: true });
    expect(a).toEqual(b);
    expect(a.queue).toBe("trust_safety");
  });

  it("enforces the support case state machine and resolution notes", () => {
    expect(planSupportTransition({ current: "new", next: "in_progress", actorIsSupport: true, note: "" }).errors).toContain("invalid_transition");
    expect(planSupportTransition({ current: "in_progress", next: "resolved", actorIsSupport: true, note: "short" }).errors).toContain("resolution_note_required");
    expect(planSupportTransition({ current: "in_progress", next: "resolved", actorIsSupport: false, note: "fixed with the district team" }).errors).toContain("not_authorized");
    expect(planSupportTransition({ current: "in_progress", next: "resolved", actorIsSupport: true, note: "fixed with the district team" }).ok).toBe(true);
  });
});

describe("operational dashboard", () => {
  it("summarises districts, activation and support health", () => {
    const now = new Date("2026-01-10T00:00:00Z");
    const dash = summariseExpansion({
      rolloutIds: ["d1", "d2", "d3"],
      clones: [
        { rollout_id: "d1", forked_code: false },
        { rollout_id: "d2", forked_code: false },
      ],
      subtypes: [activeSubtype, { ...activeSubtype, code: "logistics", domain: "logistics", evidence_gate: "evidence_pending", is_active: false, flagEnabled: false }],
      providers: [{ state: "verification" }, { state: "approved" }, { state: "submitted" }],
      disputes: [{ status: "human_review" }, { status: "resolved" }],
      supportCases: [
        { status: "new", sla_hours: 2, created_at: "2026-01-01T00:00:00Z" },
        { status: "in_progress", sla_hours: 720, created_at: "2026-01-09T00:00:00Z" },
        { status: "closed", sla_hours: 2, created_at: "2026-01-01T00:00:00Z" },
      ],
      now,
    });
    expect(dash).toMatchObject({
      districts: 3,
      clonedDistricts: 2,
      forkedDistricts: 0,
      activatedSubtypes: 1,
      pendingEvidenceGates: 1,
      providersInVerification: 2,
      disputesInHumanReview: 1,
      openSupportCases: 2,
      breachedSupportCases: 1,
    });
  });
});
