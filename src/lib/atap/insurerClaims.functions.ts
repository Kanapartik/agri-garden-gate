/**
 * Slice I3 server functions — insurer claims intake & settlement lifecycle.
 *
 * Thin wrappers only: authority checks, queries and audit writes live in
 * `insurerClaims.server.ts`.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ClaimDocStatus, ClaimPeril, ClaimStage } from "@/lib/atap/insurerClaims";
import type { ClaimsWorkspace } from "@/lib/atap/insurerClaims.server";

export const getInsurerClaimsWorkspace = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId?: string } | undefined) => input ?? {})
  .handler(async ({ data, context }): Promise<ClaimsWorkspace> => {
    const { loadClaimsWorkspace } = await import("@/lib/atap/insurerClaims.server");
    return loadClaimsWorkspace(context.supabase, context.userId, data.tenantId);
  });

export const createInsurerClaim = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      tenantId: string;
      registrationNumber: string;
      fpoName: string;
      stateName?: string | null;
      district?: string | null;
      crop?: string | null;
      season?: string;
      peril: ClaimPeril;
      affectedMembers?: number;
      reportedAcres?: number | null;
      claimedAmountInr?: number;
      responseDueDays?: number;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { createClaim } = await import("@/lib/atap/insurerClaims.server");
    return createClaim(context.supabase, context.userId, data);
  });

export const moveInsurerClaimStage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      tenantId: string;
      claimId: string;
      toStage: ClaimStage;
      note?: string | null;
      approvedAmountInr?: number | null;
      assessedLossPct?: number | null;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { moveClaimStage } = await import("@/lib/atap/insurerClaims.server");
    return moveClaimStage(context.supabase, context.userId, data);
  });

export const setInsurerClaimDocStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { tenantId: string; claimId: string; documentId: string; status: ClaimDocStatus }) =>
      input,
  )
  .handler(async ({ data, context }) => {
    const { setClaimDocStatus } = await import("@/lib/atap/insurerClaims.server");
    return setClaimDocStatus(context.supabase, context.userId, data);
  });

export const updateInsurerClaimDetails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      tenantId: string;
      claimId: string;
      surveyorName?: string | null;
      internalNotes?: string | null;
      assessedLossPct?: number | null;
      approvedAmountInr?: number | null;
      responseDueAt?: string | null;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { updateClaimDetails } = await import("@/lib/atap/insurerClaims.server");
    return updateClaimDetails(context.supabase, context.userId, data);
  });

export const getFpoClaims = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Record<string, never> | undefined) => input ?? {})
  .handler(async ({ context }) => {
    const { loadFpoClaims } = await import("@/lib/atap/insurerClaims.server");
    return loadFpoClaims(context.supabase, context.userId);
  });
