/**
 * Talent journey configuration tests.
 *
 * These mirror the configuration rows for the four talent onboarding
 * journeys: candidate, training/certification partner, recruiter agency and
 * employer company. They assert flag gating, step configuration and the
 * retirement of the combined employer/recruiter card — all configuration,
 * never hardcoded journeys.
 */
import { describe, expect, it } from "vitest";
import type { FlagDef, RoleDef, StepDef } from "@/lib/atap/onboarding";
import { isFlagActive, stepsForRole, visibleRoleCards } from "@/lib/atap/onboarding";

const flags: FlagDef[] = [
  { key: "talent.domain", label: "Talent domain", enabled: true, environments: ["development", "sandbox"] },
  {
    key: "talent.candidate_profiles",
    label: "Candidate profiles",
    enabled: true,
    environments: ["development", "sandbox"],
  },
  {
    key: "talent.training_partners",
    label: "Training partners",
    enabled: true,
    environments: ["development", "sandbox"],
  },
  { key: "talent.employers", label: "Employers", enabled: true, environments: ["development", "sandbox"] },
  {
    key: "talent.exchange_integration",
    label: "Exchange integration",
    enabled: false,
    environments: ["sandbox"],
  },
];

function role(
  code: string,
  label: string,
  flagKey: string,
  sortOrder: number,
  selectable = true,
): RoleDef {
  return {
    code,
    label,
    description: `${label} journey`,
    journey_kind: "onboarding",
    is_public_selectable: selectable,
    feature_flag_key: flagKey,
    authority_note: "Verification and approval remain a human decision.",
    sort_order: sortOrder,
  };
}

const roles: RoleDef[] = [
  role("talent_candidate", "Agri Student / Job Seeker", "talent.candidate_profiles", 610),
  role("training_partner_admin", "Training / Certification Partner", "talent.training_partners", 620),
  role("recruiter_agency", "Recruiter / HR Agency", "talent.employers", 631),
  role("employer_company", "Employer / Company / Startup", "talent.employers", 632),
  // retired combined card
  role("employer_recruiter", "Employer / recruiter", "talent.employers", 630, false),
  role("employment_exchange_admin", "Employment exchange admin", "talent.exchange_integration", 640),
];

function step(roleCode: string, key: string, order: number, required = true): StepDef {
  return {
    step_key: key,
    role_code: roleCode,
    label: key,
    help_text: null,
    sort_order: order,
    is_required: required,
    fields: [],
    evidence_required: [],
  };
}

const steps: StepDef[] = [
  step("talent_candidate", "identity", 10),
  step("talent_candidate", "education", 20),
  step("talent_candidate", "skills", 30, false),
  step("talent_candidate", "preferences", 40),
  step("talent_candidate", "visibility_consent", 50),
  step("talent_candidate", "review", 60),
  step("training_partner_admin", "institution", 10),
  step("training_partner_admin", "accreditation", 20),
  step("training_partner_admin", "signatory", 30),
  step("training_partner_admin", "course_listing", 40),
  step("training_partner_admin", "review", 50),
  step("recruiter_agency", "business", 10),
  step("recruiter_agency", "verification", 20),
  step("recruiter_agency", "authorisation", 30),
  step("recruiter_agency", "role_listing", 40),
  step("recruiter_agency", "review", 50),
  step("employer_company", "business", 10),
  step("employer_company", "verification", 20),
  step("employer_company", "hiring_contact", 30),
  step("employer_company", "job_requisition", 40),
  step("employer_company", "review", 50),
];

describe("talent journey configuration", () => {
  it("shows the four talent cards when their flags are on", () => {
    const visible = visibleRoleCards(roles, flags, "development").map((r) => r.code);
    expect(visible).toEqual([
      "talent_candidate",
      "training_partner_admin",
      "recruiter_agency",
      "employer_company",
    ]);
  });

  it("hides the retired combined employer/recruiter card", () => {
    const visible = visibleRoleCards(roles, flags, "development").map((r) => r.code);
    expect(visible).not.toContain("employer_recruiter");
  });

  it("keeps the government employment exchange journey off", () => {
    expect(isFlagActive(flags, "talent.exchange_integration", "development")).toBe(false);
    expect(isFlagActive(flags, "talent.exchange_integration", "sandbox")).toBe(false);
  });

  it("does not expose talent journeys in production", () => {
    expect(visibleRoleCards(roles, flags, "production")).toHaveLength(0);
  });

  it("configures a complete candidate journey ending in review", () => {
    const journey = stepsForRole(steps, "talent_candidate");
    expect(journey.map((s) => s.step_key)).toEqual([
      "identity",
      "education",
      "skills",
      "preferences",
      "visibility_consent",
      "review",
    ]);
    expect(journey.filter((s) => s.is_required).map((s) => s.step_key)).toContain("visibility_consent");
  });

  it("gates institution journeys on a listing step before review", () => {
    for (const [code, listing] of [
      ["training_partner_admin", "course_listing"],
      ["recruiter_agency", "role_listing"],
      ["employer_company", "job_requisition"],
    ] as const) {
      const keys = stepsForRole(steps, code).map((s) => s.step_key);
      expect(keys).toContain("verification");
      expect(keys.indexOf(listing)).toBeGreaterThan(keys.indexOf("verification"));
      expect(keys.indexOf(listing)).toBeLessThan(keys.indexOf("review"));
    }
  });

  it("binds recruiter and employer cards to the same underlying authority", () => {
    const recruiter = roles.find((r) => r.code === "recruiter_agency")!;
    const employer = roles.find((r) => r.code === "employer_company")!;
    expect(recruiter.feature_flag_key).toBe(employer.feature_flag_key);
    expect(recruiter.sort_order).toBeLessThan(employer.sort_order);
  });
});
