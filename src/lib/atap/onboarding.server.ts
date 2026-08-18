/**
 * Server-only helpers for the onboarding scaffold. Never imported by
 * components: only by `onboarding.functions.ts` handlers.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type {
  AtapEnv,
  FlagDef,
  FormValues,
  OnboardingStatus,
  RoleDef,
  StepDef,
} from "@/lib/atap/onboarding";

export type AuthedClient = SupabaseClient<Database>;

export interface ScaffoldRows {
  flags: FlagDef[];
  roles: RoleDef[];
  steps: StepDef[];
  geographies: Array<{
    id: string;
    code: string;
    name: string;
    level: string;
    parent_id: string | null;
  }>;
}

/**
 * Which environment the flags apply to. B0 runs as `development` unless the
 * deployment sets ATAP_ENV. Production activation stays closed by default.
 */
export function atapEnv(): AtapEnv {
  const raw = process.env["ATAP_ENV"];
  if (raw === "production" || raw === "sandbox" || raw === "development") return raw;
  return process.env["NODE_ENV"] === "production" ? "production" : "development";
}

/** Publishable-key client for the public, non-personal configuration reads. */
function publicClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
          h.delete("Authorization");
        }
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

export async function fetchScaffoldRows(): Promise<ScaffoldRows> {
  const supabase = publicClient();
  const [flags, roles, steps, geographies] = await Promise.all([
    supabase.from("feature_flags").select("key, label, enabled, environments"),
    supabase
      .from("role_definitions")
      .select(
        "code, label, description, journey_kind, is_public_selectable, feature_flag_key, authority_note, sort_order",
      ),
    supabase
      .from("onboarding_step_definitions")
      .select("role_code, step_key, label, help_text, sort_order, is_required, fields, evidence_required"),
    supabase.from("geographies").select("id, code, name, level, parent_id"),
  ]);

  return {
    flags: (flags.data ?? []).map((f) => ({
      key: f.key,
      label: f.label,
      enabled: f.enabled,
      environments: Array.isArray(f.environments) ? (f.environments as string[]) : [],
    })),
    roles: (roles.data ?? []) as RoleDef[],
    steps: (steps.data ?? []).map((s) => ({
      ...s,
      fields: Array.isArray(s.fields) ? (s.fields as unknown as StepDef["fields"]) : [],
      evidence_required: Array.isArray(s.evidence_required)
        ? (s.evidence_required as unknown as StepDef["evidence_required"])
        : [],
    })) as StepDef[],
    geographies: geographies.data ?? [],
  };
}

export interface AppRow {
  id: string;
  applicant_user_id: string;
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

/** RLS decides which applications come back; this never widens visibility. */
export async function readAppRows(supabase: AuthedClient): Promise<AppRow[]> {
  const { data } = await supabase
    .from("onboarding_applications")
    .select(
      "id, applicant_user_id, role_code, status, current_step_key, form_data, is_synthetic, tenant_id, updated_at, submitted_at, decided_at, decision_note",
    )
    .order("updated_at", { ascending: false })
    .limit(100);
  return ((data ?? []) as unknown as AppRow[]).map((row) => ({
    ...row,
    form_data: (row.form_data ?? {}) as FormValues,
  }));
}

/** Reviewer authority is checked in the database, as the calling user. */
export async function requireReviewer(
  supabase: AuthedClient,
  userId: string,
  tenantId: string | null,
): Promise<boolean> {
  const { data: isPlatformAdmin } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "platform_admin",
  });
  if (isPlatformAdmin) return true;
  if (!tenantId) return false;

  const [{ data: isOfficer }, { data: isTenantAdmin }] = await Promise.all([
    supabase.rpc("has_tenant_role", {
      _user_id: userId,
      _tenant_id: tenantId,
      _role: "onboarding_officer",
    }),
    supabase.rpc("has_tenant_role", {
      _user_id: userId,
      _tenant_id: tenantId,
      _role: "tenant_admin",
    }),
  ]);
  return Boolean(isOfficer || isTenantAdmin);
}

export async function writeAuditRow(
  supabase: AuthedClient,
  event: {
    actor_user_id: string;
    tenant_id?: string | null;
    action: string;
    subject_type?: string;
    subject_id?: string;
    purpose_code?: string | null;
    decision: string;
    metadata?: Record<string, unknown>;
  },
) {
  await supabase.from("audit_events").insert({ metadata: {}, ...event } as never);
}
