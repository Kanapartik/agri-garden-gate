/**
 * Slice B10 server functions — farmer history & command centre.
 *
 * Thin wrappers only: queries, adapter calls and audit writes live in
 * `farmHistory.server.ts`. Every handler runs as the signed-in farmer.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { FarmHistoryWorkspace, SeasonInput } from "@/lib/atap/farmHistory.server";

export type { FarmHistoryWorkspace, SeasonInput };

export const getFarmHistoryWorkspace = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<FarmHistoryWorkspace> => {
    const { loadWorkspace } = await import("@/lib/atap/farmHistory.server");
    return loadWorkspace(context.supabase, context.userId);
  });

export const saveFarmSeason = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: SeasonInput) => input)
  .handler(async ({ data, context }) => {
    const { saveSeason } = await import("@/lib/atap/farmHistory.server");
    return saveSeason(context.supabase, context.userId, data);
  });

export const deleteFarmSeason = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { deleteSeason } = await import("@/lib/atap/farmHistory.server");
    return deleteSeason(context.supabase, context.userId, data.id);
  });
