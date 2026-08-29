/**
 * Slice C3 server functions — insurer policy binding & claim-status sync.
 * Thin wrappers: authority, queries and audit live in insuranceBridge.server.ts.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type {
  CoverSyncResult,
  FarmerCoverDetail,
  FpoCoverBoard,
} from "@/lib/atap/insuranceBridge.server";

export const getFpoCoverBoard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string }) => input)
  .handler(async ({ data, context }): Promise<FpoCoverBoard> => {
    const { loadFpoCoverBoard } = await import("@/lib/atap/insuranceBridge.server");
    return loadFpoCoverBoard(context.supabase, context.userId, data.tenantId);
  });

export const syncFpoMemberCover = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string }) => input)
  .handler(async ({ data, context }): Promise<CoverSyncResult> => {
    const { syncMemberCover } = await import("@/lib/atap/insuranceBridge.server");
    return syncMemberCover(context.supabase, context.userId, data);
  });

export const getFarmerCoverDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Record<string, never> | undefined) => input ?? {})
  .handler(async ({ context }): Promise<FarmerCoverDetail> => {
    const { loadFarmerCoverDetail } = await import("@/lib/atap/insuranceBridge.server");
    return loadFarmerCoverDetail(context.supabase, context.userId);
  });
