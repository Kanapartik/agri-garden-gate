import { describe, expect, it } from "vitest";
import {
  buildReferralSummary,
  candidateDiscoverableByEmployers,
  certificationIsTrustworthy,
  checkCandidateProfile,
  checkCourse,
  checkEmployerSubmit,
  checkEntitlement,
  checkJobListing,
  checkTrainingPartnerSubmit,
  decideReferral,
  evaluateTalentGate,
  planCertificationIssue,
  planCompletion,
  planEmployerApproval,
  planEnrollment,
  planGateDecision,
  planReferral,
  planVisibilityChange,
  rankCandidates,
  summariseTalent,
  type CandidateProfile,
  type CertificationView,
  type EvidenceGate,
} from "@/lib/atap/talent";

const approvedGate: EvidenceGate = {
  code: "D-16",
  status: "approved",
  demand_validated: true,
  policy_validated: true,
  commercial_validated: true,
};

const hidden: CandidateProfile = {
  id: "cand-hidden",
  user_id: "u1",
  full_name: "Anita Rao",
  headline: "B.Sc Agriculture final year",
  skills: ["soil testing", "drone spraying"],
  visibility: "hidden",
  visibility_consent_at: null,
  seeking: true,
};

const optedIn: CandidateProfile = {
  ...hidden,
  id: "cand-optin",
  visibility: "employers_optin",
  visibility_consent_at: "2026-08-01T00:00:00Z",
};

const verifiedCert: CertificationView = {
  id: "cert-1",
  issuer_name: "Telangana Agri Skills KVK",
  credential_ref: "TAS-2026-0001",
  verification_status: "verified",
  provenance: { courseCode: "SOIL-101" },
};

describe("D-16 evidence gate", () => {
  it("blocks the whole domain when the gate is pending", () => {
    const d = evaluateTalentGate({ gate: null, domainFlagEnabled: true });
    expect(d.activated).toBe(false);
    expect(d.errors).toContain("evidence_gate_missing");
  });

  it("requires demand, policy and commercial validation together", () => {
    const d = evaluateTalentGate({
      gate: { ...approvedGate, commercial_validated: false },
      domainFlagEnabled: true,
    });
    expect(d.activated).toBe(false);
    expect(d.errors).toContain("commercial_model_not_validated");
  });

  it("still blocks when the domain flag is off", () => {
    expect(evaluateTalentGate({ gate: approvedGate, domainFlagEnabled: false }).activated).toBe(
      false,
    );
  });

  it("activates only with an approved gate plus enabled flags", () => {
    expect(
      evaluateTalentGate({
        gate: approvedGate,
        domainFlagEnabled: true,
        featureFlagEnabled: true,
      }).activated,
    ).toBe(true);
  });

  it("gate approval is a human decision needing all three axes", () => {
    const plan = planGateDecision({
      decision: "approved",
      demandValidated: true,
      policyValidated: false,
      commercialValidated: true,
      reviewerIsAuthorized: true,
    });
    expect(plan.requiresHumanDecision).toBe(true);
    expect(plan.ok).toBe(false);
  });
});

describe("candidate visibility", () => {
  it("validates the profile draft", () => {
    expect(checkCandidateProfile({ fullName: "Jo", headline: "", skills: [] }).ok).toBe(false);
    expect(
      checkCandidateProfile({ fullName: "Anita Rao", headline: "", skills: ["soil testing"] }).ok,
    ).toBe(true);
  });

  it("cannot leave hidden without explicit consent", () => {
    const denied = planVisibilityChange({
      requested: "employers_optin",
      consentGiven: false,
      now: "2026-08-18T00:00:00Z",
    });
    expect(denied).toEqual({ ok: false, errors: ["visibility_consent_required"] });
  });

  it("records consent time when opting in and clears it when hiding", () => {
    const optIn = planVisibilityChange({
      requested: "employers_optin",
      consentGiven: true,
      now: "2026-08-18T00:00:00Z",
    });
    expect(optIn).toEqual({
      ok: true,
      visibility: "employers_optin",
      visibilityConsentAt: "2026-08-18T00:00:00Z",
    });
    expect(
      planVisibilityChange({ requested: "hidden", consentGiven: true, now: "x" }),
    ).toEqual({ ok: true, visibility: "hidden", visibilityConsentAt: null });
  });

  it("hidden and platform-only candidates are not discoverable by employers", () => {
    expect(candidateDiscoverableByEmployers(hidden)).toBe(false);
    expect(
      candidateDiscoverableByEmployers({ ...optedIn, visibility: "platform_only" }),
    ).toBe(false);
    expect(candidateDiscoverableByEmployers(optedIn)).toBe(true);
  });
});

describe("ACCEPTANCE: hidden profile cannot reach a recruiter/employer", () => {
  it("returns no fields for a pending referral", () => {
    const s = buildReferralSummary({
      profile: optedIn,
      status: "candidate_consent_pending",
      sharedFields: ["full_name", "skills"],
    });
    expect(s.fields).toBeNull();
    expect(s.redactionReason).toBe("candidate_consent_missing");
  });

  it("returns no fields for a hidden profile even if a referral says shared", () => {
    const s = buildReferralSummary({
      profile: hidden,
      status: "shared",
      sharedFields: ["full_name"],
    });
    expect(s.fields).toBeNull();
    expect(s.redactionReason).toBe("profile_hidden");
  });

  it("shares only the consented allow-listed fields", () => {
    const s = buildReferralSummary({
      profile: optedIn,
      status: "shared",
      sharedFields: ["headline", "user_id", "district_geo_id"],
    });
    expect(s.fields).toEqual({ headline: "B.Sc Agriculture final year" });
  });

  it("hidden candidates never appear in ranking", () => {
    const rows = rankCandidates({
      jobSkills: ["soil testing"],
      candidates: [
        { ...hidden, certifications: [] },
        { ...optedIn, certifications: [verifiedCert] },
      ],
    });
    expect(rows.map((r) => r.candidateId)).toEqual(["cand-optin"]);
  });

  it("paid entitlements do not change ranking order", () => {
    const paidLowSkill = {
      ...optedIn,
      id: "cand-paid",
      skills: ["marketing"],
      certifications: [],
      hasPaidEntitlement: true,
    };
    const rows = rankCandidates({
      jobSkills: ["soil testing", "drone spraying"],
      candidates: [paidLowSkill, { ...optedIn, certifications: [verifiedCert] }],
    });
    expect(rows[0]?.candidateId).toBe("cand-optin");
  });
});

describe("referral consent", () => {
  it("cannot refer a hidden candidate or a closed job", () => {
    expect(
      planReferral({
        jobStatus: "open",
        employerState: "approved",
        candidate: hidden,
        matchingEnabled: true,
        alreadyReferred: false,
      }),
    ).toMatchObject({ ok: false });
    expect(
      planReferral({
        jobStatus: "draft",
        employerState: "approved",
        candidate: optedIn,
        matchingEnabled: true,
        alreadyReferred: false,
      }),
    ).toMatchObject({ ok: false });
  });

  it("starts pending on the candidate's own decision", () => {
    const plan = planReferral({
      jobStatus: "open",
      employerState: "approved",
      candidate: optedIn,
      matchingEnabled: true,
      alreadyReferred: false,
    });
    expect(plan.ok).toBe(true);
    expect(plan.status).toBe("candidate_consent_pending");
  });

  it("only the candidate may accept or decline", () => {
    expect(
      decideReferral({
        current: "candidate_consent_pending",
        decision: "accept",
        actorIsCandidate: false,
        sharedFields: ["full_name"],
      }).errors,
    ).toContain("only_candidate_may_decide");
  });

  it("accept records the allow-listed shared fields; decline shares nothing", () => {
    expect(
      decideReferral({
        current: "candidate_consent_pending",
        decision: "accept",
        actorIsCandidate: true,
        sharedFields: ["full_name", "id"],
      }),
    ).toEqual({ ok: true, errors: [], status: "shared", sharedFields: ["full_name"] });
    expect(
      decideReferral({
        current: "candidate_consent_pending",
        decision: "decline",
        actorIsCandidate: true,
        sharedFields: ["full_name"],
      }),
    ).toEqual({ ok: true, errors: [], status: "declined_by_candidate", sharedFields: [] });
  });

  it("a shared referral can still be withdrawn by the candidate", () => {
    expect(
      decideReferral({
        current: "shared",
        decision: "withdraw",
        actorIsCandidate: true,
        sharedFields: [],
      }).status,
    ).toBe("withdrawn");
  });
});

describe("training partners, courses and certifications", () => {
  it("requires accreditation and a named issuer", () => {
    expect(
      checkTrainingPartnerSubmit({
        name: "KVK",
        contactEmail: "bad",
        certificationIssuerName: "",
        accreditationRef: "",
      }).ok,
    ).toBe(false);
    expect(
      checkTrainingPartnerSubmit({
        name: "Telangana Agri Skills KVK",
        contactEmail: "skills@kvk.example",
        certificationIssuerName: "Telangana Agri Skills KVK",
        accreditationRef: "ASCI/2026/114",
      }).ok,
    ).toBe(true);
  });

  it("charges a course fee only when the commercial model is approved", () => {
    const draft = {
      code: "SOIL-101",
      title: "Soil testing technician",
      hours: 40,
      feeAmount: 1500,
      certificationIssuerName: "Telangana Agri Skills KVK",
    };
    expect(
      checkCourse({ draft, partnerState: "approved", commercialEntitlementsEnabled: false }).ok,
    ).toBe(false);
    expect(
      checkCourse({ draft, partnerState: "approved", commercialEntitlementsEnabled: true }).ok,
    ).toBe(true);
    expect(
      checkCourse({ draft, partnerState: "submitted", commercialEntitlementsEnabled: true }),
    ).toMatchObject({ ok: false });
  });

  it("enrollment needs a published course from an approved partner", () => {
    expect(
      planEnrollment({ coursePublished: false, partnerState: "approved", alreadyEnrolled: false })
        .ok,
    ).toBe(false);
    expect(
      planEnrollment({ coursePublished: true, partnerState: "approved", alreadyEnrolled: false }).ok,
    ).toBe(true);
  });

  it("only the issuing partner may complete and certify", () => {
    expect(planCompletion({ status: "in_progress", actorIsIssuingPartner: false }).ok).toBe(false);
    expect(planCompletion({ status: "in_progress", actorIsIssuingPartner: true }).nextStatus).toBe(
      "completed",
    );
    expect(
      planCertificationIssue({
        enrollmentStatus: "in_progress",
        actorIsIssuingPartner: true,
        provenance: {
          issuerName: "Telangana Agri Skills KVK",
          issuerPartnerId: "p1",
          credentialRef: "TAS-2026-0001",
          courseCode: "SOIL-101",
          hours: 40,
          verifiedBy: null,
        },
      }).ok,
    ).toBe(false);
  });

  it("ACCEPTANCE: a certification without issuer/provenance cannot be issued", () => {
    const bad = planCertificationIssue({
      enrollmentStatus: "completed",
      actorIsIssuingPartner: true,
      provenance: {
        issuerName: "",
        issuerPartnerId: "",
        credentialRef: "",
        courseCode: "",
        hours: 0,
        verifiedBy: null,
      },
    });
    expect(bad.ok).toBe(false);
    expect(bad.ok === false && bad.errors).toEqual(
      expect.arrayContaining([
        "issuer_name_required",
        "issuer_partner_required",
        "credential_ref_required",
        "course_code_required",
      ]),
    );
    expect(certificationIsTrustworthy(verifiedCert)).toBe(true);
    expect(
      certificationIsTrustworthy({ ...verifiedCert, verification_status: "pending" }),
    ).toBe(false);
  });
});

describe("employers, exchange integration and listings", () => {
  it("ACCEPTANCE: employment exchange needs agreement, data scope and its flag", () => {
    const draft = {
      kind: "government_exchange" as const,
      name: "Telangana Employment Exchange",
      contactEmail: "exchange@ts.gov.example",
      agreementRef: "",
      dataScope: [],
    };
    const blocked = checkEmployerSubmit({ draft, exchangeIntegrationEnabled: false });
    expect(blocked.ok).toBe(false);
    expect(blocked.ok === false && blocked.errors).toEqual(
      expect.arrayContaining([
        "exchange_integration_disabled",
        "agreement_ref_required",
        "data_scope_required",
      ]),
    );

    const denied = planEmployerApproval({
      kind: "government_exchange",
      currentState: "submitted",
      decision: "approved",
      reviewerIsAuthorized: true,
      agreementRef: "MOU/TS/2026/07",
      dataScope: ["consented_referral_summary"],
      dataScopeApproved: false,
    });
    expect(denied.ok).toBe(false);
    expect(denied.errors).toContain("data_scope_not_approved");

    const allowed = planEmployerApproval({
      kind: "government_exchange",
      currentState: "submitted",
      decision: "approved",
      reviewerIsAuthorized: true,
      agreementRef: "MOU/TS/2026/07",
      dataScope: ["consented_referral_summary"],
      dataScopeApproved: true,
    });
    expect(allowed).toMatchObject({ ok: true, nextState: "approved", requiresHumanDecision: true });
  });

  it("rejects unknown data scopes", () => {
    expect(
      checkEmployerSubmit({
        draft: {
          kind: "recruiter",
          name: "AgriHire",
          contactEmail: "hr@agrihire.example",
          agreementRef: "",
          dataScope: ["raw_candidate_export"],
        },
        exchangeIntegrationEnabled: true,
      }),
    ).toMatchObject({ ok: false });
  });

  it("sponsored listings must be labelled and employers approved", () => {
    const base = {
      title: "Field agronomist",
      skills: ["soil testing"],
      positions: 2,
      compensationMin: 20000,
      compensationMax: 30000,
    };
    expect(
      checkJobListing({
        draft: { ...base, isSponsored: true, sponsoredLabel: "" },
        employerState: "approved",
      }),
    ).toMatchObject({ ok: false });
    expect(
      checkJobListing({
        draft: { ...base, isSponsored: true, sponsoredLabel: "Sponsored listing" },
        employerState: "approved",
      }).ok,
    ).toBe(true);
    expect(
      checkJobListing({
        draft: { ...base, isSponsored: false, sponsoredLabel: "" },
        employerState: "draft",
      }),
    ).toMatchObject({ ok: false });
  });
});

describe("commercial entitlements", () => {
  it("cannot buy ranking advantage and needs the approved commercial model", () => {
    expect(
      checkEntitlement({
        subjectKind: "employer_subscription",
        feeAmount: 9000,
        grantsRankingAdvantage: true,
        commercialFlagEnabled: true,
        approverIsAuthorized: true,
      }),
    ).toMatchObject({ ok: false });
    expect(
      checkEntitlement({
        subjectKind: "employer_subscription",
        feeAmount: 9000,
        grantsRankingAdvantage: false,
        commercialFlagEnabled: false,
        approverIsAuthorized: true,
      }),
    ).toMatchObject({ ok: false });
    expect(
      checkEntitlement({
        subjectKind: "employer_subscription",
        feeAmount: 9000,
        grantsRankingAdvantage: false,
        commercialFlagEnabled: true,
        approverIsAuthorized: true,
      }).ok,
    ).toBe(true);
  });
});

describe("dashboard", () => {
  it("counts hidden vs opted-in candidates and gate state", () => {
    const d = summariseTalent({
      gate: approvedGate,
      candidates: [hidden, optedIn],
      partners: [{ state: "approved" }, { state: "submitted" }],
      courses: [{ is_published: true }],
      enrollments: [{ status: "completed" }, { status: "enrolled" }],
      certifications: [verifiedCert, { ...verifiedCert, verification_status: "pending" }],
      employers: [{ state: "approved", kind: "government_exchange" }],
      jobs: [{ status: "open", is_sponsored: true }],
      referrals: [{ status: "shared" }, { status: "candidate_consent_pending" }],
    });
    expect(d).toMatchObject({
      gateApproved: true,
      candidates: 2,
      hiddenCandidates: 1,
      optedInCandidates: 1,
      certifications: { total: 2, verified: 1 },
      employers: { exchanges: 1 },
      referrals: { pending: 1, shared: 1 },
    });
  });
});
