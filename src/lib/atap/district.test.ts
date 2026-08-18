import { describe, expect, it } from "vitest";
import {
  canManageRoster,
  canReadRoster,
  checkInviteAcceptance,
  checkStaffInvite,
  checklistsForRoles,
  delegatedPurchasingAllowed,
  evaluateSchemeRules,
  invitableRoles,
  isRolloutScopeAllowed,
  planApplicationTransition,
  planMemberImport,
  planSchemeVersion,
  prefillFromFarmProfile,
  rolloutReadiness,
  rosterGrantedPurposes,
  trainingProgress,
  validateSchemeRules,
  TRAINING_CHECKLISTS,
  type RosterActor,
  type SchemeRule,
} from "@/lib/atap/district";
import type { FlagDef } from "@/lib/atap/onboarding";

const FPO = "22222222-2222-2222-2222-222222222222";
const GOVT = "33333333-3333-3333-3333-333333333333";

const rosterActor = (overrides: Partial<RosterActor> = {}): RosterActor => ({
  userId: "u1",
  isPlatformAdmin: false,
  isAuditor: false,
  tenantRoles: [],
  ...overrides,
});

describe("staff invites and delegations", () => {
  it("lets an FPO tenant admin delegate FPO-scoped roles", () => {
    const check = checkStaffInvite("onboarding_officer", FPO, "fpo", "staff@example.org", {
      isPlatformAdmin: false,
      tenantAdminOf: [FPO],
    });
    expect(check.ok).toBe(true);
  });

  it("never delegates platform-only roles through an invite", () => {
    for (const role of ["platform_admin", "auditor"] as const) {
      const check = checkStaffInvite(role, FPO, "fpo", "staff@example.org", {
        isPlatformAdmin: true,
        tenantAdminOf: [FPO],
      });
      expect(check).toEqual({
        ok: false,
        reason: "platform_role_requires_privileged_workflow",
      });
    }
  });

  it("does not let an FPO delegate government scheme roles", () => {
    expect(invitableRoles("fpo")).not.toContain("scheme_reviewer");
    const check = checkStaffInvite("scheme_reviewer", FPO, "fpo", "staff@example.org", {
      isPlatformAdmin: false,
      tenantAdminOf: [FPO],
    });
    expect(check).toEqual({ ok: false, reason: "role_not_invitable_for_tenant_type" });
  });

  it("lets a government department delegate publisher/reviewer/viewer", () => {
    expect(invitableRoles("govt_dept")).toEqual(
      expect.arrayContaining(["scheme_publisher", "scheme_reviewer", "viewer"]),
    );
  });

  it("rejects invites from someone who is not that tenant's admin", () => {
    const check = checkStaffInvite("viewer", FPO, "fpo", "staff@example.org", {
      isPlatformAdmin: false,
      tenantAdminOf: [GOVT],
    });
    expect(check).toEqual({ ok: false, reason: "not_authorized" });
  });

  it("rejects malformed invite addresses", () => {
    const check = checkStaffInvite("viewer", FPO, "fpo", "not-an-email", {
      isPlatformAdmin: true,
      tenantAdminOf: [],
    });
    expect(check).toEqual({ ok: false, reason: "invalid_email" });
  });

  it("only accepts a pending, unexpired invite matching the signed-in address", () => {
    const base = {
      status: "pending" as const,
      invited_email: "Staff@Example.org",
      expires_at: "2026-12-01T00:00:00.000Z",
    };
    const now = new Date("2026-08-18T00:00:00.000Z");
    expect(checkInviteAcceptance(base, "staff@example.org", now)).toEqual({ ok: true });
    expect(checkInviteAcceptance(base, "other@example.org", now)).toEqual({
      ok: false,
      reason: "invite_email_mismatch",
    });
    expect(
      checkInviteAcceptance({ ...base, expires_at: "2026-01-01T00:00:00.000Z" }, "staff@example.org", now),
    ).toEqual({ ok: false, reason: "invite_expired" });
    expect(checkInviteAcceptance({ ...base, status: "revoked" }, "staff@example.org", now)).toEqual({
      ok: false,
      reason: "invite_not_pending",
    });
  });
});

describe("member bulk onboarding", () => {
  it("accepts valid rows and reports each rejected row with a reason", () => {
    const plan = planMemberImport(
      [
        "M-001, Lakshmi D., IN-TS-WGL-B1-V1",
        "M-002, Ravi K.",
        ", Missing Ref",
        "M-004,",
        "M-002, Duplicate In File",
        "M-EXIST, Already A Member",
        "a,b,c,d,e",
      ].join("\n"),
      ["M-EXIST"],
    );

    expect(plan.rowCount).toBe(7);
    expect(plan.accepted.map((r) => r.member_ref)).toEqual(["M-001", "M-002"]);
    expect(plan.errors.map((e) => e.reason)).toEqual([
      "missing_member_ref",
      "missing_display_name",
      "duplicate_in_file",
      "duplicate_existing_member",
      "too_many_columns",
    ]);
  });

  it("re-importing the same file adds no duplicate members", () => {
    const rows = "M-001, Lakshmi D.\nM-002, Ravi K.";
    const first = planMemberImport(rows, []);
    const second = planMemberImport(rows, first.accepted.map((r) => r.member_ref));
    expect(second.accepted).toHaveLength(0);
    expect(second.errors.every((e) => e.reason === "duplicate_existing_member")).toBe(true);
  });
});

describe("FPO staff see only authorized scoped data", () => {
  const staff = rosterActor({
    tenantRoles: [{ role: "onboarding_officer", tenant_id: FPO }],
  });

  it("reads only its own tenant roster", () => {
    expect(canReadRoster(staff, FPO)).toBe(true);
    expect(canReadRoster(staff, GOVT)).toBe(false);
  });

  it("field agents can read but not manage the roster", () => {
    const agent = rosterActor({ tenantRoles: [{ role: "field_agent", tenant_id: FPO }] });
    expect(canReadRoster(agent, FPO)).toBe(true);
    expect(canManageRoster(agent, FPO)).toBe(false);
  });

  it("a viewer role grants no roster access at all", () => {
    const viewer = rosterActor({ tenantRoles: [{ role: "viewer", tenant_id: FPO }] });
    expect(canReadRoster(viewer, FPO)).toBe(false);
  });

  it("roster authority never yields farmer-data purposes", () => {
    expect(rosterGrantedPurposes(staff, FPO)).toEqual([]);
    const admin = rosterActor({ isPlatformAdmin: true });
    expect(rosterGrantedPurposes(admin, FPO)).toEqual([]);
  });
});

describe("scheme rule configuration and versioning", () => {
  const rules: SchemeRule[] = [
    {
      key: "min_area",
      label: "Holding at least 0.5 acre",
      field: "land_area_acres",
      operator: "gte",
      value: 0.5,
      severity: "blocking",
    },
    {
      key: "district",
      label: "Within the anchor district",
      field: "district_code",
      operator: "eq",
      value: "IN-TS-WGL",
      severity: "blocking",
    },
    {
      key: "crop",
      label: "Priority crop",
      field: "primary_crop",
      operator: "in",
      value: ["cotton", "paddy"],
      severity: "advisory",
    },
  ];

  it("validates rule shape", () => {
    expect(validateSchemeRules(rules)).toEqual({ ok: true });
    expect(validateSchemeRules([])).toEqual({ ok: false, reason: "rules_empty" });
    expect(validateSchemeRules([rules[0]!, rules[0]!])).toEqual({
      ok: false,
      reason: "rule_key_duplicated",
    });
    expect(
      validateSchemeRules([{ ...rules[0]!, operator: "gte", value: "half" }]),
    ).toEqual({ ok: false, reason: "rule_threshold_requires_number" });
  });

  it("versions every rule change and demands a changelog", () => {
    const actor = { isPlatformAdmin: false, schemePublisherOf: [GOVT] };
    const ok = planSchemeVersion(
      { tenantId: GOVT, schemeStatus: "published", currentVersion: 2, rules, changelog: "Raise minimum area" },
      actor,
    );
    expect(ok).toEqual({ ok: true, plan: { version: 3, changelog: "Raise minimum area" } });

    expect(
      planSchemeVersion(
        { tenantId: GOVT, schemeStatus: "published", currentVersion: 2, rules, changelog: "x" },
        actor,
      ),
    ).toEqual({ ok: false, reason: "changelog_required" });
  });

  it("only a scoped scheme publisher (or platform admin) may version rules", () => {
    expect(
      planSchemeVersion(
        { tenantId: GOVT, schemeStatus: "draft", currentVersion: 0, rules, changelog: "Initial rules" },
        { isPlatformAdmin: false, schemePublisherOf: [FPO] },
      ),
    ).toEqual({ ok: false, reason: "not_authorized" });
  });

  it("evaluates rules as a recommendation, never a decision", () => {
    const pass = evaluateSchemeRules(rules, {
      land_area_acres: 1.2,
      district_code: "IN-TS-WGL",
      primary_crop: "cotton",
    });
    expect(pass.recommendation).toBe("recommend_approve");
    expect(pass.requiresHumanDecision).toBe(true);

    const fail = evaluateSchemeRules(rules, {
      land_area_acres: 0.2,
      district_code: "IN-TS-WGL",
      primary_crop: "cotton",
    });
    expect(fail.recommendation).toBe("recommend_reject");
    expect(fail.requiresHumanDecision).toBe(true);

    const partial = evaluateSchemeRules(rules, { land_area_acres: 1.2 });
    expect(partial.recommendation).toBe("needs_information");
  });

  it("an advisory rule failure does not force a rejection recommendation", () => {
    const advisoryOnly = evaluateSchemeRules(rules, {
      land_area_acres: 2,
      district_code: "IN-TS-WGL",
      primary_crop: "maize",
    });
    expect(advisoryOnly.recommendation).toBe("recommend_approve");
    expect(advisoryOnly.checks.find((c) => c.key === "crop")?.passed).toBe(false);
  });
});

describe("prefill from consented farm profile", () => {
  const farm = {
    label: "Home plot",
    plot_ref: "WGL/12/4",
    village_code: "IN-TS-WGL-B1-V1",
    primary_crop: "cotton",
    area_acres: 1.4,
  };

  it("prefills only when baseline consent is active", () => {
    const ok = prefillFromFarmProfile(farm, true);
    expect(ok.source).toBe("consented_farm_profile");
    expect(ok.values["land_area_acres"]).toBe(1.4);

    const denied = prefillFromFarmProfile(farm, false);
    expect(denied).toEqual({
      values: {},
      source: "none",
      blockedReason: "baseline_consent_missing",
    });
  });

  it("degrades gracefully with no farm profile", () => {
    expect(prefillFromFarmProfile(null, true).blockedReason).toBe("no_farm_profile");
  });
});

describe("government review is a traceable human decision", () => {
  const reviewer = { userId: "rev", isPlatformAdmin: false, schemeReviewerOf: [GOVT] };

  it("moves submitted -> in_review -> approved with a note", () => {
    expect(
      planApplicationTransition({
        current: "submitted",
        next: "in_review",
        schemeTenantId: GOVT,
        applicantUserId: "farmer",
        decisionNote: "",
        actor: reviewer,
      }),
    ).toEqual({ ok: true, next: "in_review" });

    expect(
      planApplicationTransition({
        current: "in_review",
        next: "approved",
        schemeTenantId: GOVT,
        applicantUserId: "farmer",
        decisionNote: "Verified holding against district register",
        actor: reviewer,
      }),
    ).toEqual({ ok: true, next: "approved" });
  });

  it("requires a decision note for approve/reject", () => {
    expect(
      planApplicationTransition({
        current: "in_review",
        next: "rejected",
        schemeTenantId: GOVT,
        applicantUserId: "farmer",
        decisionNote: " ",
        actor: reviewer,
      }),
    ).toEqual({ ok: false, reason: "decision_note_required" });
  });

  it("denies review by FPO staff or an unrelated tenant", () => {
    expect(
      planApplicationTransition({
        current: "submitted",
        next: "in_review",
        schemeTenantId: GOVT,
        applicantUserId: "farmer",
        decisionNote: "",
        actor: { userId: "fpo-staff", isPlatformAdmin: false, schemeReviewerOf: [FPO] },
      }),
    ).toEqual({ ok: false, reason: "not_authorized" });
  });

  it("never lets an applicant decide their own application", () => {
    expect(
      planApplicationTransition({
        current: "in_review",
        next: "approved",
        schemeTenantId: GOVT,
        applicantUserId: "rev",
        decisionNote: "Looks fine to me",
        actor: reviewer,
      }),
    ).toEqual({ ok: false, reason: "applicant_cannot_decide" });
  });

  it("blocks illegal jumps such as submitted -> approved", () => {
    expect(
      planApplicationTransition({
        current: "submitted",
        next: "approved",
        schemeTenantId: GOVT,
        applicantUserId: "farmer",
        decisionNote: "Approved directly",
        actor: reviewer,
      }),
    ).toEqual({ ok: false, reason: "invalid_transition" });
  });
});

describe("role training checklists", () => {
  it("selects checklists by role context", () => {
    expect(checklistsForRoles(["scheme_reviewer"]).map((c) => c.code)).toEqual(["govt_staff_v1"]);
    expect(checklistsForRoles(["field_agent"]).map((c) => c.code)).toEqual([
      "fpo_staff_v1",
      "field_staff_v1",
    ]);
    expect(checklistsForRoles(["consumer_api_manager"])).toEqual([]);
  });

  it("reports readiness only when every required item is done", () => {
    const checklist = TRAINING_CHECKLISTS[0]!;
    const required = checklist.items.filter((i) => i.required).map((i) => i.key);
    expect(trainingProgress(checklist, []).ready).toBe(false);
    const done = trainingProgress(checklist, required);
    expect(done.ready).toBe(true);
    expect(done.requiredOutstanding).toEqual([]);
  });
});

describe("district rollout scope and D-08 guard", () => {
  it("computes readiness and go-live gating", () => {
    const readiness = rolloutReadiness([
      { key: "a", label: "A", done: true },
      { key: "b", label: "B", done: false },
    ]);
    expect(readiness).toMatchObject({ total: 2, done: 1, percent: 50, canGoLive: false });
    expect(
      rolloutReadiness([{ key: "a", label: "A", done: true }]).canGoLive,
    ).toBe(true);
  });

  it("keeps rollout scope at district level or below", () => {
    expect(isRolloutScopeAllowed("district")).toBe(true);
    expect(isRolloutScopeAllowed("state")).toBe(false);
    expect(isRolloutScopeAllowed("country")).toBe(false);
  });

  it("keeps FPO delegated purchasing disabled until D-08 is validated", () => {
    const off: FlagDef[] = [
      { key: "fpo.delegated_purchasing", label: "x", enabled: false, environments: [] },
    ];
    const forcedOn: FlagDef[] = [
      {
        key: "fpo.delegated_purchasing",
        label: "x",

        enabled: true,
        environments: ["development", "sandbox", "production"],
      },
    ];
    expect(delegatedPurchasingAllowed(off, "development")).toBe(false);
    expect(delegatedPurchasingAllowed(forcedOn, "production")).toBe(false);
  });
});
