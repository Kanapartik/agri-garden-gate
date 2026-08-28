/**
 * Slice I2 server functions — insurer crop monitoring & risk surveillance.
 *
 * Thin wrappers only: authority checks, queries and audit writes live in
 * `insurerRisk.server.ts`.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { AlertStatus, RiskEvent, RiskSeverity } from "@/lib/atap/insurerRisk";
import type { RiskWorkspace } from "@/lib/atap/insurerRisk.server";

export const getInsurerRiskWorkspace = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId?: string } | undefined) => input ?? {})
  .handler(async ({ data, context }): Promise<RiskWorkspace> => {
    const { loadRiskWorkspace } = await import("@/lib/atap/insurerRisk.server");
    return loadRiskWorkspace(context.supabase, context.userId, data.tenantId);
  });

export const saveInsurerWatchEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      tenantId: string;
      watchId?: string;
      stateName: string;
      district: string;
      crop: string;
      season: string;
      notes?: string | null;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { saveWatchEntry } = await import("@/lib/atap/insurerRisk.server");
    return saveWatchEntry(context.supabase, context.userId, data);
  });

export const removeInsurerWatchEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string; watchId: string }) => input)
  .handler(async ({ data, context }) => {
    const { removeWatchEntry } = await import("@/lib/atap/insurerRisk.server");
    return removeWatchEntry(context.supabase, context.userId, data);
  });

export const saveInsurerAlertRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      tenantId: string;
      ruleId?: string;
      name: string;
      eventType?: RiskEvent | null;
      minSeverity?: RiskSeverity;
      rainfallDeviationThresholdPct?: number | null;
      active?: boolean;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { saveAlertRule } = await import("@/lib/atap/insurerRisk.server");
    return saveAlertRule(context.supabase, context.userId, data);
  });

export const setInsurerAlertStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string; alertId: string; status: AlertStatus }) => input)
  .handler(async ({ data, context }) => {
    const { setAlertStatus } = await import("@/lib/atap/insurerRisk.server");
    return setAlertStatus(context.supabase, context.userId, data);
  });

export const generateInsurerAlerts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string }) => input)
  .handler(async ({ data, context }) => {
    const { generateAlerts } = await import("@/lib/atap/insurerRisk.server");
    return generateAlerts(context.supabase, context.userId, data);
  });
