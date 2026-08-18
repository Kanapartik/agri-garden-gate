/**
 * AgriGhar ATAP — pure policy primitives.
 *
 * These functions contain NO IO so they can be unit-tested directly and reused
 * by server functions. They encode the platform non-negotiables:
 *  - access-path neutrality between first-party and third-party consumers
 *  - technical tenancy grants no authority
 *  - farmer data access is default-deny and purpose-scoped
 */

export type ConsumerTier = "sandbox" | "standard" | "premium";

export type TenantType =
  | "fpo"
  | "govt_dept"
  | "bank"
  | "insurer"
  | "agri_business"
  | "platform_ops";

export type AppRole =
  | "platform_admin"
  | "auditor"
  | "tenant_admin"
  | "onboarding_officer"
  | "field_agent"
  | "consumer_api_manager"
  | "scheme_publisher"
  | "scheme_reviewer"
  | "viewer";

export interface TierPolicy {
  tier: ConsumerTier;
  rateLimitPerMin: number;
  /** Purposes a consumer at this tier MAY request. Consent is still required. */
  requestablePurposes: readonly string[];
  /** Paid tiers never widen consent. */
  canBypassConsent: false;
}

const TIER_POLICIES: Record<ConsumerTier, TierPolicy> = {
  sandbox: {
    tier: "sandbox",
    rateLimitPerMin: 30,
    requestablePurposes: ["advisory", "onboarding_verification"],
    canBypassConsent: false,
  },
  standard: {
    tier: "standard",
    rateLimitPerMin: 300,
    requestablePurposes: [
      "advisory",
      "onboarding_verification",
      "credit_assessment",
      "crop_insurance",
    ],
    canBypassConsent: false,
  },
  premium: {
    tier: "premium",
    rateLimitPerMin: 3000,
    requestablePurposes: [
      "advisory",
      "onboarding_verification",
      "credit_assessment",
      "crop_insurance",
      "scheme_eligibility",
    ],
    canBypassConsent: false,
  },
};

/**
 * Resolve the access policy for a consumer. Deliberately takes ONLY the tier:
 * there is no `isFirstParty` parameter, so an equivalent first-party and
 * third-party consumer cannot diverge.
 */
export function resolveTierPolicy(tier: ConsumerTier): TierPolicy {
  return TIER_POLICIES[tier];
}

/**
 * Technical tenancy is descriptive metadata. A bank/govt/FPO tenant type never
 * implies government authority, support ownership, membership authority or
 * blanket farmer-data access.
 */
export function tenantTypeGrantedRoles(_tenantType: TenantType): readonly AppRole[] {
  return [];
}

export interface ConsentGrantLike {
  purpose_code: string;
  consumer_id: string;
  revoked_at: string | null;
  expires_at: string | null;
}

export interface AccessRequest {
  purposeCode: string;
  consumerId: string;
  consumerTier: ConsumerTier;
  consumerStatus: "active" | "suspended" | "revoked";
}

export type AccessDecision =
  | { decision: "allow"; reason: "consent_active" }
  | {
      decision: "deny";
      reason:
        | "consumer_not_active"
        | "purpose_not_requestable_at_tier"
        | "no_consent_grant"
        | "consent_revoked"
        | "consent_expired";
    };

/**
 * Default-deny, purpose-scoped access evaluation. Every non-allow path returns
 * an explicit deny reason so the decision is auditable.
 */
export function evaluateDataAccess(
  request: AccessRequest,
  grants: readonly ConsentGrantLike[],
  now: Date = new Date(),
): AccessDecision {
  if (request.consumerStatus !== "active") {
    return { decision: "deny", reason: "consumer_not_active" };
  }

  const policy = resolveTierPolicy(request.consumerTier);
  if (!policy.requestablePurposes.includes(request.purposeCode)) {
    return { decision: "deny", reason: "purpose_not_requestable_at_tier" };
  }

  const grant = grants.find(
    (g) => g.purpose_code === request.purposeCode && g.consumer_id === request.consumerId,
  );
  if (!grant) return { decision: "deny", reason: "no_consent_grant" };
  if (grant.revoked_at !== null) return { decision: "deny", reason: "consent_revoked" };
  if (grant.expires_at !== null && new Date(grant.expires_at) <= now) {
    return { decision: "deny", reason: "consent_expired" };
  }

  return { decision: "allow", reason: "consent_active" };
}

/**
 * High-stakes decisions (bank credit, insurance, government scheme) must stay
 * with an authorized human/partner role. AI may only advise.
 */
export const HIGH_STAKES_PURPOSES = [
  "credit_assessment",
  "crop_insurance",
  "scheme_eligibility",
] as const;

export function requiresHumanDecision(purposeCode: string): boolean {
  return (HIGH_STAKES_PURPOSES as readonly string[]).includes(purposeCode);
}
