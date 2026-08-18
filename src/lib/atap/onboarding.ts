/**
 * B0 onboarding scaffold — pure, dependency-free logic.
 *
 * Everything here is driven by configuration rows (`feature_flags`,
 * `role_definitions`, `onboarding_step_definitions`), never by hardcoded
 * journeys. Adding a role or a step is a data change, not a code change.
 */

export type AtapEnv = "development" | "sandbox" | "production";

export type FieldType =
  | "text"
  | "tel"
  | "number"
  | "textarea"
  | "select"
  | "multiselect"
  | "geography";

export interface FieldDef {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
  options?: string[];
  level?: string;
}

export interface EvidenceDef {
  code: string;
  label: string;
  optional_in_sandbox?: boolean;
}

export interface StepDef {
  step_key: string;
  role_code: string;
  label: string;
  help_text: string | null;
  sort_order: number;
  is_required: boolean;
  fields: FieldDef[];
  evidence_required: EvidenceDef[];
}

export interface RoleDef {
  code: string;
  label: string;
  description: string;
  journey_kind: string;
  is_public_selectable: boolean;
  feature_flag_key: string | null;
  authority_note: string | null;
  sort_order: number;
}

export interface FlagDef {
  key: string;
  label: string;
  enabled: boolean;
  environments: string[];
}

export type OnboardingStatus = "draft" | "pending" | "activated" | "rejected" | "withdrawn";
export type StepStatus = "not_started" | "in_progress" | "complete";

export type FormValue = string | number | boolean | string[] | null;
export type FormValues = Record<string, FormValue>;

/* ------------------------------------------------------------------ flags */

/** A flag is active only when it is enabled AND scoped to the running env. */
export function isFlagActive(flags: FlagDef[], key: string | null, env: AtapEnv): boolean {
  if (!key) return true; // no controlling flag => always visible
  const flag = flags.find((f) => f.key === key);
  if (!flag) return false; // unknown flag is default-off
  return flag.enabled && flag.environments.includes(env);
}

/** Role cards shown on the public selector, purely from configuration. */
export function visibleRoleCards(roles: RoleDef[], flags: FlagDef[], env: AtapEnv): RoleDef[] {
  return roles
    .filter((r) => r.is_public_selectable && isFlagActive(flags, r.feature_flag_key, env))
    .sort((a, b) => a.sort_order - b.sort_order || a.code.localeCompare(b.code));
}

export function stepsForRole(steps: StepDef[], roleCode: string): StepDef[] {
  return steps
    .filter((s) => s.role_code === roleCode)
    .sort((a, b) => a.sort_order - b.sort_order || a.step_key.localeCompare(b.step_key));
}

/* ------------------------------------------------------------- validation */

function isEmpty(value: FormValue | undefined): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/** Field-level validation for one step. Returns `{}` when the step is valid. */
export function validateStepValues(step: StepDef, values: FormValues): Record<string, string> {
  const errors: Record<string, string> = {};

  for (const field of step.fields) {
    const value = values[field.name];

    if (isEmpty(value)) {
      if (field.required) errors[field.name] = `${field.label} is required`;
      continue;
    }

    if (field.type === "number") {
      const num = typeof value === "number" ? value : Number(value);
      if (Number.isNaN(num)) {
        errors[field.name] = `${field.label} must be a number`;
        continue;
      }
      if (field.min !== undefined && num < field.min) {
        errors[field.name] = `${field.label} must be at least ${field.min}`;
        continue;
      }
      if (field.max !== undefined && num > field.max) {
        errors[field.name] = `${field.label} must be at most ${field.max}`;
        continue;
      }
      continue;
    }

    if (field.type === "multiselect") {
      const list = Array.isArray(value) ? value : [];
      const bad = field.options ? list.filter((v) => !field.options!.includes(String(v))) : [];
      if (bad.length > 0) errors[field.name] = `${field.label} has an unsupported choice`;
      continue;
    }

    const text = String(value).trim();
    if (field.maxLength !== undefined && text.length > field.maxLength) {
      errors[field.name] = `${field.label} must be ${field.maxLength} characters or fewer`;
      continue;
    }
    if (field.pattern && !new RegExp(field.pattern).test(text)) {
      errors[field.name] = `${field.label} is not in the expected format`;
      continue;
    }
    if (
      (field.type === "select" || field.type === "geography") &&
      field.options &&
      !field.options.includes(text)
    ) {
      errors[field.name] = `${field.label} has an unsupported choice`;
    }
  }

  return errors;
}

export function stepStatus(step: StepDef, values: FormValues): StepStatus {
  if (step.fields.length === 0) return "complete";
  const touched = step.fields.some((f) => !isEmpty(values[f.name]));
  if (!touched) return "not_started";
  return Object.keys(validateStepValues(step, values)).length === 0 ? "complete" : "in_progress";
}

/** Every required step must validate before an application may be submitted. */
export function incompleteRequiredSteps(steps: StepDef[], values: FormValues): string[] {
  return steps
    .filter((s) => s.is_required && stepStatus(s, values) !== "complete")
    .map((s) => s.step_key);
}

/* ------------------------------------------------------- status machine */

export interface TransitionContext {
  env: AtapEnv;
  isSynthetic: boolean;
  syntheticActivationEnabled: boolean;
  actor: "applicant" | "reviewer";
}

export type TransitionResult = { ok: true } | { ok: false; reason: string };

const ALLOWED: Record<OnboardingStatus, OnboardingStatus[]> = {
  draft: ["pending", "withdrawn"],
  pending: ["activated", "rejected", "withdrawn"],
  activated: [],
  rejected: [],
  withdrawn: [],
};

/**
 * B0 rule: activation is a NON-PRODUCTION, synthetic-only workflow behind the
 * `onboarding.synthetic_activation` flag. Real activation waits for the
 * identity-verification slice.
 */
export function canTransition(
  from: OnboardingStatus,
  to: OnboardingStatus,
  ctx: TransitionContext,
): TransitionResult {
  if (!ALLOWED[from].includes(to)) return { ok: false, reason: "transition_not_allowed" };

  if (to === "pending" && ctx.actor !== "applicant") {
    return { ok: false, reason: "only_applicant_may_submit" };
  }

  if (to === "activated" || to === "rejected") {
    if (ctx.actor !== "reviewer") return { ok: false, reason: "reviewer_role_required" };
    if (ctx.env === "production") return { ok: false, reason: "activation_disabled_in_production" };
    if (!ctx.isSynthetic) return { ok: false, reason: "synthetic_applications_only" };
    if (!ctx.syntheticActivationEnabled) {
      return { ok: false, reason: "synthetic_activation_flag_off" };
    }
  }

  return { ok: true };
}

export const STATUS_LABEL: Record<OnboardingStatus, string> = {
  draft: "Draft",
  pending: "Pending review",
  activated: "Activated",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};
