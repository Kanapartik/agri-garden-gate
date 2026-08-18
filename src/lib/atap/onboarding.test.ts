import { describe, expect, it } from "vitest";
import {
  canTransition,
  incompleteRequiredSteps,
  isFlagActive,
  stepStatus,
  stepsForRole,
  validateStepValues,
  visibleRoleCards,
  type FlagDef,
  type RoleDef,
  type StepDef,
  type TransitionContext,
} from "./onboarding";

const flags: FlagDef[] = [
  { key: "role.farmer", label: "Farmer", enabled: true, environments: ["development", "production"] },
  { key: "role.fpo", label: "FPO", enabled: true, environments: ["development"] },
  { key: "role.bank_officer", label: "Bank", enabled: false, environments: ["development"] },
  {
    key: "onboarding.synthetic_activation",
    label: "Synthetic activation",
    enabled: true,
    environments: ["development", "sandbox"],
  },
];

const roles: RoleDef[] = [
  {
    code: "farmer",
    label: "Farmer",
    description: "",
    journey_kind: "onboarding",
    is_public_selectable: true,
    feature_flag_key: "role.farmer",
    authority_note: null,
    sort_order: 10,
  },
  {
    code: "fpo",
    label: "FPO",
    description: "",
    journey_kind: "onboarding",
    is_public_selectable: true,
    feature_flag_key: "role.fpo",
    authority_note: null,
    sort_order: 20,
  },
  {
    code: "bank_officer",
    label: "Bank officer",
    description: "",
    journey_kind: "onboarding",
    is_public_selectable: false,
    feature_flag_key: "role.bank_officer",
    authority_note: null,
    sort_order: 30,
  },
];

const identityStep: StepDef = {
  role_code: "farmer",
  step_key: "identity",
  label: "Who you are",
  help_text: null,
  sort_order: 10,
  is_required: true,
  fields: [
    { name: "full_name", label: "Full name", type: "text", required: true, maxLength: 10 },
    { name: "phone", label: "Mobile number", type: "tel", required: true, pattern: "^[0-9]{10}$" },
    { name: "area", label: "Area", type: "number", required: false, min: 1, max: 5 },
  ],
  evidence_required: [],
};

const reviewStep: StepDef = {
  ...identityStep,
  step_key: "review",
  label: "Review",
  sort_order: 20,
  fields: [],
};

describe("feature-flag driven role cards (no code edits)", () => {
  it("hides a role whose flag is disabled and shows one whose flag is on", () => {
    const visible = visibleRoleCards(roles, flags, "development").map((r) => r.code);
    expect(visible).toEqual(["farmer", "fpo"]);
  });

  it("changes the cards when only the flag data changes", () => {
    const withFpoOff = flags.map((f) => (f.key === "role.fpo" ? { ...f, enabled: false } : f));
    expect(visibleRoleCards(roles, withFpoOff, "development").map((r) => r.code)).toEqual(["farmer"]);
  });

  it("respects per-environment scoping", () => {
    expect(visibleRoleCards(roles, flags, "production").map((r) => r.code)).toEqual(["farmer"]);
  });

  it("treats an unknown flag as off and a null flag as always on", () => {
    expect(isFlagActive(flags, "role.unknown", "development")).toBe(false);
    expect(isFlagActive(flags, null, "production")).toBe(true);
  });
});

describe("step definitions and validation", () => {
  it("orders steps from configuration", () => {
    expect(stepsForRole([reviewStep, identityStep], "farmer").map((s) => s.step_key)).toEqual([
      "identity",
      "review",
    ]);
  });

  it("reports required, format, length and range errors", () => {
    const errors = validateStepValues(identityStep, {
      full_name: "A very long name",
      phone: "12345",
      area: 99,
    });
    expect(errors["full_name"]).toContain("10 characters");
    expect(errors["phone"]).toContain("expected format");
    expect(errors["area"]).toContain("at most 5");
  });

  it("passes a valid step and tracks partial progress", () => {
    const valid = { full_name: "Lakshmi", phone: "9876543210" };
    expect(validateStepValues(identityStep, valid)).toEqual({});
    expect(stepStatus(identityStep, valid)).toBe("complete");
    expect(stepStatus(identityStep, {})).toBe("not_started");
    expect(stepStatus(identityStep, { full_name: "Lakshmi" })).toBe("in_progress");
  });

  it("blocks submit while a required step is incomplete", () => {
    const steps = [identityStep, reviewStep];
    expect(incompleteRequiredSteps(steps, {})).toEqual(["identity"]);
    expect(incompleteRequiredSteps(steps, { full_name: "Lakshmi", phone: "9876543210" })).toEqual([]);
  });
});

describe("draft -> pending -> activated in non-production only", () => {
  const base: TransitionContext = {
    env: "development",
    isSynthetic: true,
    syntheticActivationEnabled: true,
    actor: "applicant",
  };

  it("walks the synthetic happy path", () => {
    expect(canTransition("draft", "pending", base)).toEqual({ ok: true });
    expect(canTransition("pending", "activated", { ...base, actor: "reviewer" })).toEqual({ ok: true });
  });

  it("refuses activation in production, for non-synthetic rows, or with the flag off", () => {
    const reviewer = { ...base, actor: "reviewer" as const };
    expect(canTransition("pending", "activated", { ...reviewer, env: "production" })).toEqual({
      ok: false,
      reason: "activation_disabled_in_production",
    });
    expect(canTransition("pending", "activated", { ...reviewer, isSynthetic: false })).toEqual({
      ok: false,
      reason: "synthetic_applications_only",
    });
    expect(
      canTransition("pending", "activated", { ...reviewer, syntheticActivationEnabled: false }),
    ).toEqual({ ok: false, reason: "synthetic_activation_flag_off" });
  });

  it("keeps the decision with a reviewer and submission with the applicant", () => {
    expect(canTransition("pending", "activated", base)).toEqual({
      ok: false,
      reason: "reviewer_role_required",
    });
    expect(canTransition("draft", "pending", { ...base, actor: "reviewer" })).toEqual({
      ok: false,
      reason: "only_applicant_may_submit",
    });
  });

  it("does not allow skipping review or reopening a decided application", () => {
    expect(canTransition("draft", "activated", { ...base, actor: "reviewer" })).toEqual({
      ok: false,
      reason: "transition_not_allowed",
    });
    expect(canTransition("activated", "draft", base).ok).toBe(false);
    expect(canTransition("rejected", "pending", base).ok).toBe(false);
  });
});
