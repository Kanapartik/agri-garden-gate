/**
 * Slice I1 server functions — insurer revenue intelligence (sales).
 *
 * Thin wrappers only: authority checks, queries and audit writes live in
 * `insurerRevenue.server.ts`.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { CampaignState, FunnelStage } from "@/lib/atap/insurerRevenue";
import type { FpoInsurerView, InsurerWorkspace } from "@/lib/atap/insurerRevenue.server";

export const getInsurerWorkspace = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId?: string } | undefined) => input ?? {})
  .handler(async ({ data, context }): Promise<InsurerWorkspace> => {
    const { loadWorkspace } = await import("@/lib/atap/insurerRevenue.server");
    return loadWorkspace(context.supabase, context.userId, data.tenantId);
  });

export const moveInsurerFunnelStage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { tenantId: string; entryId: string; to: FunnelStage; notes?: string }) => input,
  )
  .handler(async ({ data, context }) => {
    const { moveStage } = await import("@/lib/atap/insurerRevenue.server");
    return moveStage(context.supabase, context.userId, data);
  });

export const updateInsurerChannelRow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      tenantId: string;
      channelId: string;
      ownerName?: string | null;
      accessibility?: string | null;
      internalNotes?: string | null;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { updateChannelRow } = await import("@/lib/atap/insurerRevenue.server");
    return updateChannelRow(context.supabase, context.userId, data);
  });

export const recomputeInsurerScores = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string }) => input)
  .handler(async ({ data, context }) => {
    const { recomputeScores } = await import("@/lib/atap/insurerRevenue.server");
    return recomputeScores(context.supabase, context.userId, data);
  });

export const saveInsurerCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      tenantId: string;
      campaignId?: string;
      name: string;
      season?: string | null;
      stateName?: string | null;
      district?: string | null;
      commodity?: string | null;
      ownerName?: string | null;
      state?: CampaignState;
      notes?: string | null;
      registrationNumbers?: string[];
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { saveCampaign } = await import("@/lib/atap/insurerRevenue.server");
    return saveCampaign(context.supabase, context.userId, data);
  });

export const getFpoInsurerView = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string }) => input)
  .handler(async ({ data, context }): Promise<FpoInsurerView> => {
    const { loadFpoCounterpartView } = await import("@/lib/atap/insurerRevenue.server");
    return loadFpoCounterpartView(context.supabase, context.userId, data.tenantId);
  });
