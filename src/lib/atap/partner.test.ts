import { describe, expect, it } from "vitest";
import {
  brokerGrantPurpose,
  canConfigureWebhook,
  canIssueProductionCredential,
  checkEnvironment,
  checkProductionRequest,
  checkRegistrationSubmit,
  deriveRegistrationState,
  evaluateApiAccess,
  isProductionEligible,
  planCaseTransition,
  planConsentBrokerRequest,
  scopesForKind,
  summariseCalls,
  summariseSignals,
  type ApiAccessRequest,
  type CallRecordLike,
  type CredentialLike,
  type RegistrationLike,
} from "@/lib/atap/partner";
import type { ConsentGrantLike } from "@/lib/atap/policy";

const approvedBank: RegistrationLike = {
  state: "approved",
  legal_status: "approved",
  security_status: "approved",
  partner_kind: "bank",
};

const sandboxOnlyBank: RegistrationLike = {
  state: "security_review",
  legal_status: "approved",
  security_status: "pending",
  partner_kind: "bank",
};

const cred = (over: Partial<CredentialLike> = {}): CredentialLike => ({
  environment: "sandbox",
  status: "active",
  revoked_at: null,
  scopes: ["credit.signal.read", "catalogue.read"],
  ...over,
});

const request = (over: Partial<ApiAccessRequest> = {}): ApiAccessRequest => ({
  scope: "credit.signal.read",
  targetEnvironment: "sandbox",
  credential: cred(),
  appScopes: ["credit.signal.read", "catalogue.read"],
  tier: "standard",
  consumerId: "consumer-1",
  consumerStatus: "active",
  registration: approvedBank,
  subjectUserId: "farmer-1",
  ...over,
});

const activeGrant = (over: Partial<ConsentGrantLike> = {}): ConsentGrantLike => ({
  purpose_code: "credit_assessment",
  consumer_id: "consumer-1",
  revoked_at: null,
  expires_at: null,
  ...over,
});

/* ============================ ACCEPTANCE GATE 1 ============================
   Equivalent first-party and third-party consumers at the same tier take the
   same access path and get the same decision. */

describe("gate 1 — first/third-party tier equivalence", () => {
  it("evaluates identical inputs identically regardless of party (no party input exists)", () => {
    const firstParty = evaluateApiAccess(request({ consumerId: "first-party" }), [
      activeGrant({ consumer_id: "first-party" }),
    ]);
    const thirdParty = evaluateApiAccess(request({ consumerId: "third-party" }), [
      activeGrant({ consumer_id: "third-party" }),
    ]);
    expect(firstParty).toEqual(thirdParty);
    expect(firstParty.decision).toBe("allow");
  });

  it("denies a first-party caller exactly like a third-party caller when consent is missing", () => {
    const firstParty = evaluateApiAccess(request({ consumerId: "first-party" }), []);
    const thirdParty = evaluateApiAccess(request({ consumerId: "third-party" }), []);
    expect(firstParty.decision).toBe("deny");
    expect(firstParty.reason).toBe("no_consent_grant");
    expect(firstParty).toEqual(thirdParty);
  });

  it("applies the same rate limit to both at the same tier", () => {
    expect(evaluateApiAccess(request(), [activeGrant()]).rateLimitPerMin).toBe(300);
  });

  it("reports tier-level neutrality from the call log", () => {
    const calls: CallRecordLike[] = [
      { environment: "sandbox", outcome: "allow", deny_reason: null, status_code: 200, latency_ms: 40, is_first_party: true, tier: "standard" },
      { environment: "sandbox", outcome: "allow", deny_reason: null, status_code: 200, latency_ms: 60, is_first_party: false, tier: "standard" },
    ];
    const summary = summariseCalls(calls);
    expect(summary.neutrality[0]?.equivalent).toBe(true);
    expect(summary.neutrality[0]?.firstPartyAllowRate).toBe(summary.neutrality[0]?.thirdPartyAllowRate);
  });
});

/* ============================ ACCEPTANCE GATE 2 ============================
   Bank API returns no farmer data without valid scope + consent. */

describe("gate 2 — bank API returns no farmer data without valid scope consent", () => {
  it("allows and flags farmer data only with an active purpose-scoped grant", () => {
    const result = evaluateApiAccess(request(), [activeGrant()]);
    expect(result.decision).toBe("allow");
    expect(result.returnsFarmerData).toBe(true);
    expect(result.purposeCode).toBe("credit_assessment");
  });

  it("denies with no grant at all (default-deny)", () => {
    const r = evaluateApiAccess(request(), []);
    expect(r).toMatchObject({ decision: "deny", reason: "no_consent_grant", returnsFarmerData: false });
  });

  it("denies a revoked grant", () => {
    const r = evaluateApiAccess(request(), [activeGrant({ revoked_at: new Date().toISOString() })]);
    expect(r.reason).toBe("consent_revoked");
    expect(r.returnsFarmerData).toBe(false);
  });

  it("denies an expired grant", () => {
    const r = evaluateApiAccess(request(), [activeGrant({ expires_at: "2020-01-01T00:00:00Z" })]);
    expect(r.reason).toBe("consent_expired");
  });

  it("denies a grant for a different purpose", () => {
    const r = evaluateApiAccess(request(), [activeGrant({ purpose_code: "advisory" })]);
    expect(r.reason).toBe("no_consent_grant");
  });

  it("denies a grant belonging to a different consumer", () => {
    const r = evaluateApiAccess(request(), [activeGrant({ consumer_id: "someone-else" })]);
    expect(r.reason).toBe("no_consent_grant");
  });

  it("denies when the scope is not on the app or the credential", () => {
    expect(evaluateApiAccess(request({ appScopes: ["catalogue.read"] }), [activeGrant()]).reason).toBe(
      "scope_not_granted_to_app",
    );
    expect(
      evaluateApiAccess(request({ credential: cred({ scopes: ["catalogue.read"] }) }), [activeGrant()])
        .reason,
    ).toBe("scope_not_on_credential");
  });

  it("denies a farmer-data call with no subject", () => {
    expect(evaluateApiAccess(request({ subjectUserId: null }), [activeGrant()]).reason).toBe(
      "subject_required_for_farmer_data",
    );
  });

  it("denies a suspended consumer even with an active grant", () => {
    expect(evaluateApiAccess(request({ consumerStatus: "suspended" }), [activeGrant()]).reason).toBe(
      "consumer_not_active",
    );
  });

  it("allows non-farmer-data scopes without consent and returns no farmer data", () => {
    const r = evaluateApiAccess(request({ scope: "catalogue.read" }), []);
    expect(r).toMatchObject({ decision: "allow", returnsFarmerData: false, purposeCode: null });
  });

  it("keeps insurer-only scopes away from a bank partner", () => {
    const r = evaluateApiAccess(
      request({
        scope: "insurance.evidence.read",
        appScopes: ["insurance.evidence.read"],
        credential: cred({ scopes: ["insurance.evidence.read"] }),
      }),
      [activeGrant({ purpose_code: "crop_insurance" })],
    );
    expect(r.reason).toBe("scope_not_available_for_partner_kind");
  });

  it("offers only kind-appropriate scopes in the catalogue", () => {
    expect(scopesForKind("bank").map((s) => s.code)).toContain("credit.signal.read");
    expect(scopesForKind("bank").map((s) => s.code)).not.toContain("insurance.evidence.read");
    expect(scopesForKind("agritech").map((s) => s.code)).toEqual([
      "profile.read",
      "catalogue.read",
      "farm.summary.read",
      "scheme.eligibility.read",
    ]);
  });

  it("never widens the granted purpose for a paid tier", () => {
    expect(brokerGrantPurpose("advisory", "premium")).toBe("advisory");
    expect(brokerGrantPurpose("credit_assessment", "standard")).toBe("credit_assessment");
  });
});

/* ============================ ACCEPTANCE GATE 3 ============================
   Sandbox credentials cannot call production. */

describe("gate 3 — environment separation", () => {
  it("hard-denies sandbox credentials against production", () => {
    expect(checkEnvironment(cred({ environment: "sandbox" }), "production")).toEqual({
      decision: "deny",
      reason: "sandbox_credential_cannot_call_production",
    });
  });

  it("denies sandbox→production even for an approved partner with valid consent", () => {
    const r = evaluateApiAccess(request({ targetEnvironment: "production" }), [activeGrant()]);
    expect(r.decision).toBe("deny");
    expect(r.reason).toBe("sandbox_credential_cannot_call_production");
    expect(r.returnsFarmerData).toBe(false);
  });

  it("denies production credentials used against sandbox", () => {
    expect(checkEnvironment(cred({ environment: "production" }), "sandbox").decision).toBe("deny");
  });

  it("denies a revoked credential in its own environment", () => {
    expect(checkEnvironment(cred({ revoked_at: new Date().toISOString() }), "sandbox")).toEqual({
      decision: "deny",
      reason: "credential_revoked",
    });
  });

  it("allows a production credential in production for an approved partner", () => {
    const r = evaluateApiAccess(
      request({ targetEnvironment: "production", credential: cred({ environment: "production" }) }),
      [activeGrant()],
    );
    expect(r.decision).toBe("allow");
  });

  it("denies production traffic before legal and security approval", () => {
    const r = evaluateApiAccess(
      request({
        targetEnvironment: "production",
        credential: cred({ environment: "production" }),
        registration: sandboxOnlyBank,
      }),
      [activeGrant()],
    );
    expect(r.reason).toBe("production_access_not_approved");
  });

  it("denies a suspended partner outright", () => {
    const r = evaluateApiAccess(
      request({ registration: { ...approvedBank, state: "suspended" } }),
      [activeGrant()],
    );
    expect(r.reason).toBe("partner_suspended");
  });
});

/* ================= legal/security approval + production workflow ========== */

describe("legal & security approval gates", () => {
  it("requires both gates before approval", () => {
    expect(deriveRegistrationState({ state: "submitted", legal_status: "pending", security_status: "pending" })).toBe("legal_review");
    expect(deriveRegistrationState({ state: "legal_review", legal_status: "approved", security_status: "pending" })).toBe("security_review");
    expect(deriveRegistrationState({ state: "security_review", legal_status: "approved", security_status: "approved" })).toBe("approved");
  });

  it("rejects when either gate rejects", () => {
    expect(deriveRegistrationState({ state: "security_review", legal_status: "approved", security_status: "rejected" })).toBe("rejected");
    expect(deriveRegistrationState({ state: "legal_review", legal_status: "rejected", security_status: "approved" })).toBe("rejected");
  });

  it("never auto-reinstates a suspended partner", () => {
    expect(deriveRegistrationState({ state: "suspended", legal_status: "approved", security_status: "approved" })).toBe("suspended");
  });

  it("blocks production eligibility unless fully approved", () => {
    expect(isProductionEligible(approvedBank)).toBe(true);
    expect(isProductionEligible(sandboxOnlyBank)).toBe(false);
  });

  it("validates the registration submission form", () => {
    const bad = checkRegistrationSubmit({
      display_name: "A",
      contact_email: "nope",
      intended_use: "short",
      requested_purposes: [],
      partner_kind: "bank",
      state: "draft",
    });
    expect(bad.ok).toBe(false);
    expect(bad.errors).toHaveLength(4);

    const good = checkRegistrationSubmit({
      display_name: "Green Valley Bank",
      contact_email: "dev@greenvalley.example",
      intended_use: "Credit signal retrieval for smallholder loan pre-assessment.",
      requested_purposes: ["credit_assessment"],
      partner_kind: "bank",
      state: "draft",
    });
    expect(good).toEqual({ ok: true, errors: [] });
  });

  it("refuses to issue production credentials without approval chain", () => {
    expect(canIssueProductionCredential({ registration: sandboxOnlyBank, productionRequestStatus: "approved" })).toEqual({
      ok: false,
      reason: "legal_and_security_approval_required",
    });
    expect(canIssueProductionCredential({ registration: approvedBank, productionRequestStatus: "pending" })).toEqual({
      ok: false,
      reason: "production_request_not_approved",
    });
    expect(canIssueProductionCredential({ registration: approvedBank, productionRequestStatus: "approved" }).ok).toBe(true);
  });

  it("validates production requests against tier and partner kind", () => {
    expect(
      checkProductionRequest({
        registration: approvedBank,
        requestedScopes: ["credit.signal.read"],
        requestedTier: "sandbox",
        justification: "We need production access for pilot lending.",
        hasOpenRequest: false,
      }).errors,
    ).toContain("Production access requires a standard or premium tier.");

    expect(
      checkProductionRequest({
        registration: approvedBank,
        requestedScopes: ["scheme.eligibility.read"],
        requestedTier: "standard",
        justification: "We need production access for pilot lending.",
        hasOpenRequest: false,
      }).errors,
    ).toContain("Scope scheme.eligibility.read requires a higher tier.");

    expect(
      checkProductionRequest({
        registration: approvedBank,
        requestedScopes: ["credit.signal.read"],
        requestedTier: "standard",
        justification: "Production pilot with 200 consented borrowers in one district.",
        hasOpenRequest: false,
      }),
    ).toEqual({ ok: true, errors: [] });
  });
});

/* ============================= consent broker ============================= */

describe("consent broker", () => {
  it("plans a valid sandbox request", () => {
    expect(
      planConsentBrokerRequest({
        scope: "credit.signal.read",
        registration: sandboxOnlyBank,
        tier: "standard",
        environment: "sandbox",
        subjectUserId: "farmer-1",
        reason: "Loan pre-assessment for your application.",
      }),
    ).toEqual({ ok: true, errors: [], purposeCode: "credit_assessment" });
  });

  it("blocks production consent requests before approval", () => {
    const plan = planConsentBrokerRequest({
      scope: "credit.signal.read",
      registration: sandboxOnlyBank,
      tier: "standard",
      environment: "production",
      subjectUserId: "farmer-1",
      reason: "Loan pre-assessment for your application.",
    });
    expect(plan.ok).toBe(false);
    expect(plan.errors).toContain("Production consent requests require legal and security approval.");
  });

  it("rejects a consent request for a scope that reads no farmer data", () => {
    const plan = planConsentBrokerRequest({
      scope: "catalogue.read",
      registration: approvedBank,
      tier: "standard",
      environment: "sandbox",
      subjectUserId: "farmer-1",
      reason: "Catalogue sync for the mobile app.",
    });
    expect(plan.ok).toBe(false);
  });

  it("rejects a purpose above the partner tier", () => {
    const plan = planConsentBrokerRequest({
      scope: "credit.signal.read",
      registration: approvedBank,
      tier: "sandbox",
      environment: "sandbox",
      subjectUserId: "farmer-1",
      reason: "Loan pre-assessment for your application.",
    });
    expect(plan.errors).toContain("This purpose is not requestable at the partner's tier.");
  });
});

/* ========================= workflow shells (no autonomy) ================== */

describe("bank loan / insurer claim shells stay human-decided", () => {
  it("refuses an automated approval", () => {
    expect(
      planCaseTransition({
        kind: "loan",
        current: "awaiting_human_decision",
        next: "approved",
        actorIsAuthorizedHuman: false,
        decisionNote: "Model score 0.82 — auto approve",
        accessAllowed: true,
      }),
    ).toEqual({ ok: false, error: "human_decision_required" });
  });

  it("requires a decision note from the authorized human", () => {
    expect(
      planCaseTransition({
        kind: "claim",
        current: "awaiting_human_decision",
        next: "declined",
        actorIsAuthorizedHuman: true,
        decisionNote: "no",
        accessAllowed: true,
      }),
    ).toEqual({ ok: false, error: "decision_note_required" });
  });

  it("accepts a human decision with a note", () => {
    expect(
      planCaseTransition({
        kind: "loan",
        current: "awaiting_human_decision",
        next: "approved",
        actorIsAuthorizedHuman: true,
        decisionNote: "Branch credit officer approved after field verification.",
        accessAllowed: true,
      }),
    ).toEqual({ ok: true, status: "approved" });
  });

  it("cannot move to review without an allowed consented read", () => {
    expect(
      planCaseTransition({
        kind: "credit_signal",
        current: "open",
        next: "awaiting_human_decision",
        actorIsAuthorizedHuman: true,
        decisionNote: "",
        accessAllowed: false,
      }),
    ).toEqual({ ok: false, error: "consent_required_before_review" });
  });

  it("cannot reopen a closed case", () => {
    expect(
      planCaseTransition({
        kind: "loan",
        current: "approved",
        next: "open",
        actorIsAuthorizedHuman: true,
        decisionNote: "reopen please",
        accessAllowed: true,
      }),
    ).toEqual({ ok: false, error: "case_already_closed" });
  });

  it("marks automated signals advisory-only", () => {
    expect(summariseSignals({ repayment_band: "medium", parcel_count: 2 })).toEqual({
      advisory: true,
      decision: null,
      signalCount: 2,
    });
  });

  it("flags high-stakes purposes as needing a human", () => {
    expect(evaluateApiAccess(request(), [activeGrant()]).humanDecisionRequired).toBe(true);
    expect(evaluateApiAccess(request({ scope: "catalogue.read" }), []).humanDecisionRequired).toBe(false);
  });
});

/* ============================== analytics ================================ */

describe("partner analytics", () => {
  const calls: CallRecordLike[] = [
    { environment: "sandbox", outcome: "allow", deny_reason: null, status_code: 200, latency_ms: 20, is_first_party: false, tier: "standard" },
    { environment: "sandbox", outcome: "deny", deny_reason: "scope_not_granted_to_app", status_code: 403, latency_ms: 30, is_first_party: false, tier: "standard" },
    { environment: "sandbox", outcome: "deny", deny_reason: "no_consent_grant", status_code: 403, latency_ms: 40, is_first_party: false, tier: "standard" },
    { environment: "production", outcome: "error", deny_reason: null, status_code: 500, latency_ms: 900, is_first_party: false, tier: "standard" },
  ];

  it("summarises calls, errors, denials, scope denials and latency", () => {
    const s = summariseCalls(calls);
    expect(s.total).toBe(4);
    expect(s.errors).toBe(1);
    expect(s.denials).toBe(2);
    expect(s.scopeDenials).toBe(1);
    expect(s.byEnvironment).toEqual({ sandbox: 3, production: 1 });
    expect(s.p95LatencyMs).toBe(900);
  });

  it("handles an empty log", () => {
    expect(summariseCalls([])).toMatchObject({ total: 0, p50LatencyMs: 0, neutrality: [] });
  });
});

/* =============================== webhooks ================================ */

describe("webhook configuration", () => {
  it("is blocked while the P1 flag is off", () => {
    const r = canConfigureWebhook({
      registration: approvedBank,
      flagEnabled: false,
      environment: "sandbox",
      targetUrl: "https://partner.example/hook",
    });
    expect(r.ok).toBe(false);
    expect(r.errors[0]).toContain("P1");
  });

  it("requires https and approval for production", () => {
    expect(
      canConfigureWebhook({ registration: approvedBank, flagEnabled: true, environment: "sandbox", targetUrl: "http://insecure.example" }).errors,
    ).toContain("Webhook target must be an https URL.");
    expect(
      canConfigureWebhook({ registration: sandboxOnlyBank, flagEnabled: true, environment: "production", targetUrl: "https://partner.example/hook" }).ok,
    ).toBe(false);
  });

  it("allows an approved partner with the flag on", () => {
    expect(
      canConfigureWebhook({ registration: approvedBank, flagEnabled: true, environment: "production", targetUrl: "https://partner.example/hook" }),
    ).toEqual({ ok: true, errors: [] });
  });
});
