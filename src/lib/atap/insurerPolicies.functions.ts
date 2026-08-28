/**
 * Slice I4 server functions — insurer policy & enrolment lifecycle.
 * Thin wrappers: authority, queries and audit live in insurerPolicies.server.ts.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type {
  EnrolmentState,
  PolicyStatus,
  RemittanceState,
} from "@/lib/atap/insurerPolicies";
import type { FpoPolicyView, PoliciesWorkspace } from "@/lib/atap/insurerPolicies.server";

export const getInsurerPoliciesWorkspace = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId?: string } | undefined) => input ?? {})
  .handler(async ({ data, context }): Promise<PoliciesWorkspace> => {
    const { loadPoliciesWorkspace } = await import("@/lib/atap/insurerPolicies.server");
    return loadPoliciesWorkspace(context.supabase, context.userId, data.tenantId);
  });

export const createInsurerPolicy = createServerFn({ method: "POST" })
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
      coverageStart?: string | null;
      coverageEnd?: string | null;
      enrolmentCutoff?: string | null;
      sumInsuredPerAcreInr?: number;
      actuarialRatePct?: number;
      farmerSharePct?: number;
      centreSharePct?: number;
      stateSharePct?: number;
      insuredAcres?: number;
      insuredMembers?: number;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { createPolicy } = await import("@/lib/atap/insurerPolicies.server");
    return createPolicy(context.supabase, context.userId, data);
  });

export const moveInsurerPolicyStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      tenantId: string;
      policyId: string;
      toStatus: PolicyStatus;
      note?: string | null;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { movePolicyStatus } = await import("@/lib/atap/insurerPolicies.server");
    return movePolicyStatus(context.supabase, context.userId, data);
  });

export const createInsurerEnrolmentBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { tenantId: string; policyId: string; memberCount: number; acres: number }) => input,
  )
  .handler(async ({ data, context }) => {
    const { createEnrolmentBatch } = await import("@/lib/atap/insurerPolicies.server");
    return createEnrolmentBatch(context.supabase, context.userId, data);
  });

export const moveInsurerEnrolmentState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      tenantId: string;
      batchId: string;
      toState: EnrolmentState;
      note?: string | null;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { moveEnrolmentState } = await import("@/lib/atap/insurerPolicies.server");
    return moveEnrolmentState(context.supabase, context.userId, data);
  });

export const recordInsurerRemittance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      tenantId: string;
      batchId: string;
      amountInr: number;
      method?: string;
      state?: RemittanceState;
      note?: string | null;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { recordRemittance } = await import("@/lib/atap/insurerPolicies.server");
    return recordRemittance(context.supabase, context.userId, data);
  });

export const reconcileInsurerRemittance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      tenantId: string;
      remittanceId: string;
      state: RemittanceState;
      note?: string | null;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { reconcileRemittance } = await import("@/lib/atap/insurerPolicies.server");
    return reconcileRemittance(context.supabase, context.userId, data);
  });

export const getFpoPolicies = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Record<string, never> | undefined) => input ?? {})
  .handler(async ({ context }): Promise<FpoPolicyView> => {
    const { loadFpoPolicies } = await import("@/lib/atap/insurerPolicies.server");
    return loadFpoPolicies(context.supabase, context.userId);
  });
