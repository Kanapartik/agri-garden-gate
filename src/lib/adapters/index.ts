/**
 * External-system adapter seams.
 *
 * Slice 1 ships interfaces plus synthetic implementations only. No real KYC,
 * GIS, payment, government, bank, insurer or employment calls exist yet; later
 * slices swap the implementation behind these interfaces without touching
 * callers.
 */

export interface IdentityKycAdapter {
  readonly name: string;
  verify(input: { referenceId: string }): Promise<{
    status: "verified" | "unverified" | "pending";
    evidenceRef: string;
    synthetic: boolean;
  }>;
}

export interface GisAdapter {
  readonly name: string;
  resolvePlot(input: { plotRef: string }): Promise<{
    plotRef: string;
    areaHectares: number;
    centroid: { lat: number; lng: number };
    synthetic: boolean;
  }>;
}

export interface PaymentsAdapter {
  readonly name: string;
  quote(input: { amountMinor: number; currency: string }): Promise<{
    amountMinor: number;
    currency: string;
    feeMinor: number;
    synthetic: boolean;
  }>;
}

export interface GovtRegistryAdapter {
  readonly name: string;
  lookupScheme(input: { schemeCode: string }): Promise<{
    schemeCode: string;
    /** Adapters never decide eligibility; an authorized role does. */
    decision: "requires_human_review";
    synthetic: boolean;
  }>;
}

export const syntheticIdentityKyc: IdentityKycAdapter = {
  name: "synthetic-identity-kyc",
  async verify({ referenceId }) {
    return {
      status: referenceId.endsWith("0") ? "pending" : "verified",
      evidenceRef: `synthetic:kyc:${referenceId}`,
      synthetic: true,
    };
  },
};

export const syntheticGis: GisAdapter = {
  name: "synthetic-gis",
  async resolvePlot({ plotRef }) {
    return {
      plotRef,
      areaHectares: 1.25,
      centroid: { lat: 19.7515, lng: 75.7139 },
      synthetic: true,
    };
  },
};

export const syntheticPayments: PaymentsAdapter = {
  name: "synthetic-payments",
  async quote({ amountMinor, currency }) {
    return { amountMinor, currency, feeMinor: Math.round(amountMinor * 0.01), synthetic: true };
  },
};

export const syntheticGovtRegistry: GovtRegistryAdapter = {
  name: "synthetic-govt-registry",
  async lookupScheme({ schemeCode }) {
    return { schemeCode, decision: "requires_human_review", synthetic: true };
  },
};

/**
 * Jurisdiction-configured identity verification (B2). The adapter never
 * activates anyone: it returns evidence and a provider status, and the platform
 * routes anything short of `verified` to a human manual-review queue.
 * Real jurisdiction providers plug in here — [VALIDATE provider].
 */
export interface JurisdictionIdentityAdapter {
  readonly name: string;
  verify(input: { jurisdictionCode: string; referenceHash: string }): Promise<{
    status: "verified" | "unverified" | "pending";
    evidenceRef: string;
    reasonCategory?: string;
    synthetic: boolean;
  }>;
}

/**
 * Mock jurisdiction adapter with deterministic, testable outcomes:
 *  - hash ending in `0` → pending  → manual review
 *  - hash ending in `f` → unverified → manual review
 *  - anything else      → verified
 */
export const mockJurisdictionIdentity: JurisdictionIdentityAdapter = {
  name: "mock-jurisdiction-identity",
  async verify({ jurisdictionCode, referenceHash }) {
    const last = referenceHash.slice(-1).toLowerCase();
    const status = last === "0" ? "pending" : last === "f" ? "unverified" : "verified";
    return {
      status,
      evidenceRef: `synthetic:${jurisdictionCode}:${referenceHash.slice(0, 12)}`,
      ...(status === "verified" ? {} : { reasonCategory: status === "pending" ? "provider_pending" : "reference_not_matched" }),
      synthetic: true,
    };
  },
};

export * from "./farmIntelligence";
import { farmIntelligenceAdapters } from "./farmIntelligence";

export const adapters = {
  identityKyc: syntheticIdentityKyc,
  jurisdictionIdentity: mockJurisdictionIdentity,
  gis: syntheticGis,
  payments: syntheticPayments,
  govtRegistry: syntheticGovtRegistry,
  ...farmIntelligenceAdapters,
} as const;
