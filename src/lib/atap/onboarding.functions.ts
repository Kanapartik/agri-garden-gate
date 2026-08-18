import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  canTransition,
  incompleteRequiredSteps,
  isFlagActive,
  stepStatus,
  stepsForRole,
  validateStepValues,
  type AtapEnv,
  type FlagDef,
  type FormValues,
  type OnboardingStatus,
  type RoleDef,
  type StepDef,
} from "@/lib/atap/onboarding";
import {
  atapEnv,
  fetchScaffoldRows,
  readAppRows,
  requireReviewer,
  writeAuditRow,
  type ScaffoldRows,
} from "@/lib/atap/onboarding.server";

export interface Scaffold extends ScaffoldRows {
  env: AtapEnv;
}

/**
 * Public, read-only configuration used by the landing page and role selector.
 * No personal data: flags, geography, role definitions and step definitions
 * only. Unauthenticated on purpose so SSR/prerender can render the selector.
 */
export const getOnboardingScaffold = createServerFn({ method: "GET" }).handler(
  async (): Promise<Scaffold> => {
    const rows = await fetchScaffoldRows();
    return { ...rows, env: atapEnv() };
  },
);

export interface ApplicationRow {
  id: string;
  role_code: string;
  status: OnboardingStatus;
  current_step_key: string | null;
  form_data: FormValues;
  is_synthetic: boolean;
  tenant_id: string | null;
  updated_at: string;
  submitted_at: string | null;
  decided_at: string | null;
  decision_note: string | null;
}

export interface OnboardingWorkspace extends Scaffold {
  mine: ApplicationRow[];
  reviewQueue: ApplicationRow[];
  canReview: boolean;
}

/** Everything the signed-in user may see in the onboarding workspace. */
export const getOnboardingWorkspace = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<OnboardingWorkspace> => {
    const { supabase, userId } = context;
    const [rows, apps, roles] = await Promise.all([
      fetchScaffoldRows(),
      readAppRows(supabase),
      supabase.from("user_roles").select("role, tenant_id").eq("user_id", userId),
    ]);

    const canReview = (roles.data ?? []).some(
      (r) => r.role === "onboarding_officer" || r.role === "tenant_admin" || r.role === "platform_admin",
    );

    return {
      ...rows,
      env: atapEnv(),
      mine: apps.filter((a) => a.applicant_user_id === userId),
      reviewQueue: canReview ? apps.filter((a) => a.applicant_user_id !== userId) : [],
      canReview,
    };
  });

function scaffoldFor(rows: ScaffoldRows, roleCode: string) {
  const role = rows.roles.find((r: RoleDef) => r.code === roleCode);
  const steps = stepsForRole(rows.steps as StepDef[], roleCode);
  return { role, steps };
}

/** Start a synthetic draft application for a configured, flag-enabled role. */
export const startApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { roleCode: string }) => {
    if (!input.roleCode || input.roleCode.length > 60) throw new Error("invalid_input");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const env = atapEnv();
    const rows = await fetchScaffoldRows();
    const { role, steps } = scaffoldFor(rows, data.roleCode);

    if (!role) throw new Error("role_not_configured");
    if (!isFlagActive(rows.flags as FlagDef[], role.feature_flag_key, env)) {
      throw new Error("role_journey_disabled");
    }

    const { data: inserted, error } = await supabase
      .from("onboarding_applications")
      .insert({
        applicant_user_id: userId,
        role_code: role.code,
        status: "draft",
        current_step_key: steps[0]?.step_key ?? null,
        form_data: {},
        is_synthetic: env !== "production",
      })
      .select("id")
      .single();
    if (error || !inserted) throw new Error("application_create_failed");

    await writeAuditRow(supabase, {
      actor_user_id: userId,
      action: "onboarding.application.start",
      subject_type: "onboarding_application",
      subject_id: inserted.id,
      decision: "allow",
      metadata: { role_code: role.code, env },
    });

    return { id: inserted.id };
  });

/** Autosave one step. Draft-only; server re-validates and recomputes status. */
export const saveStepDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { applicationId: string; stepKey: string; values: FormValues }) => {
    if (!input.applicationId || !input.stepKey) throw new Error("invalid_input");
    if (typeof input.values !== "object" || input.values === null) throw new Error("invalid_input");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: app } = await supabase
      .from("onboarding_applications")
      .select("id, applicant_user_id, role_code, status, form_data")
      .eq("id", data.applicationId)
      .maybeSingle();

    if (!app || app.applicant_user_id !== userId) throw new Error("not_found");
    if (app.status !== "draft") throw new Error("application_not_editable");

    const rows = await fetchScaffoldRows();
    const { steps } = scaffoldFor(rows, app.role_code);
    const step = steps.find((s) => s.step_key === data.stepKey);
    if (!step) throw new Error("step_not_configured");

    const allowed = new Set(step.fields.map((f) => f.name));
    const clean: FormValues = {};
    for (const [k, v] of Object.entries(data.values)) if (allowed.has(k)) clean[k] = v;

    const merged: FormValues = { ...((app.form_data as FormValues) ?? {}), ...clean };
    const errors = validateStepValues(step, merged);
    const status = stepStatus(step, merged);

    const [appRes, progressRes] = await Promise.all([
      supabase
        .from("onboarding_applications")
        .update({ form_data: merged as never, current_step_key: step.step_key })
        .eq("id", app.id),
      supabase.from("onboarding_step_progress").upsert(
        {
          application_id: app.id,
          step_key: step.step_key,
          status,
          data: clean as never,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "application_id,step_key" },
      ),
    ]);
    if (appRes.error || progressRes.error) throw new Error("autosave_failed");

    return { savedAt: new Date().toISOString(), stepStatus: status, errors };
  });

/** Applicant submits: every required step must validate server-side. */
export const submitApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { applicationId: string }) => {
    if (!input.applicationId) throw new Error("invalid_input");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const env = atapEnv();

    const { data: app } = await supabase
      .from("onboarding_applications")
      .select("id, applicant_user_id, role_code, status, form_data, is_synthetic")
      .eq("id", data.applicationId)
      .maybeSingle();
    if (!app || app.applicant_user_id !== userId) throw new Error("not_found");

    const rows = await fetchScaffoldRows();
    const { steps } = scaffoldFor(rows, app.role_code);
    const syntheticActivationEnabled = isFlagActive(
      rows.flags as FlagDef[],
      "onboarding.synthetic_activation",
      env,
    );

    const gate = canTransition(app.status as OnboardingStatus, "pending", {
      env,
      isSynthetic: app.is_synthetic,
      syntheticActivationEnabled,
      actor: "applicant",
    });
    if (!gate.ok) throw new Error(gate.reason);

    const missing = incompleteRequiredSteps(steps, (app.form_data as FormValues) ?? {});
    if (missing.length > 0) {
      await writeAuditRow(supabase, {
        actor_user_id: userId,
        action: "onboarding.application.submit",
        subject_type: "onboarding_application",
        subject_id: app.id,
        decision: "deny",
        metadata: { reason: "incomplete_required_steps", missing },
      });
      return { ok: false as const, missing };
    }

    const { error } = await supabase
      .from("onboarding_applications")
      .update({ status: "pending", submitted_at: new Date().toISOString() })
      .eq("id", app.id);
    if (error) throw new Error("submit_failed");

    await writeAuditRow(supabase, {
      actor_user_id: userId,
      action: "onboarding.application.submit",
      subject_type: "onboarding_application",
      subject_id: app.id,
      decision: "allow",
      metadata: { role_code: app.role_code },
    });

    return { ok: true as const, missing: [] as string[] };
  });

/**
 * Reviewer decision. Non-production, synthetic-only in B0: no production
 * activation path exists yet, and no AI or automatic decisioning is involved.
 */
export const decideApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { applicationId: string; decision: "activated" | "rejected"; note?: string }) => {
    if (input.decision !== "activated" && input.decision !== "rejected") {
      throw new Error("invalid_decision");
    }
    if (!input.applicationId) throw new Error("invalid_input");
    return { ...input, note: (input.note ?? "").slice(0, 500) };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const env = atapEnv();

    const { data: app } = await supabase
      .from("onboarding_applications")
      .select("id, status, tenant_id, is_synthetic, role_code")
      .eq("id", data.applicationId)
      .maybeSingle();
    if (!app) throw new Error("not_found");

    const isReviewer = await requireReviewer(supabase, userId, app.tenant_id);
    const rows = await fetchScaffoldRows();
    const gate = canTransition(app.status as OnboardingStatus, data.decision, {
      env,
      isSynthetic: app.is_synthetic,
      syntheticActivationEnabled: isFlagActive(
        rows.flags as FlagDef[],
        "onboarding.synthetic_activation",
        env,
      ),
      actor: isReviewer ? "reviewer" : "applicant",
    });

    if (!gate.ok) {
      await writeAuditRow(supabase, {
        actor_user_id: userId,
        tenant_id: app.tenant_id,
        action: `onboarding.application.${data.decision}`,
        subject_type: "onboarding_application",
        subject_id: app.id,
        decision: "deny",
        metadata: { reason: gate.reason, env },
      });
      throw new Error(gate.reason);
    }

    const { error } = await supabase
      .from("onboarding_applications")
      .update({
        status: data.decision,
        decided_at: new Date().toISOString(),
        decided_by: userId,
        decision_note: data.note || null,
      })
      .eq("id", app.id);
    if (error) throw new Error("decision_failed");

    await writeAuditRow(supabase, {
      actor_user_id: userId,
      tenant_id: app.tenant_id,
      action: `onboarding.application.${data.decision}`,
      subject_type: "onboarding_application",
      subject_id: app.id,
      decision: "allow",
      metadata: { role_code: app.role_code, human_reviewer: true, env },
    });

    return { ok: true };
  });
