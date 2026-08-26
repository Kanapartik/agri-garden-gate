import { describe, expect, it } from "vitest";
import {
  canTransitionDocument,
  canViewFinance,
  complianceActions,
  dashboardMetrics,
  firstIncompleteStep,
  isFpoSection,
  maskAccount,
  missingRequiredDocs,
  onboardingSteps,
  profileCompleteness,
  sectionAvailable,
  type DocLike,
  type OnboardingCounts,
} from "@/lib/atap/fpo";

const emptyCounts: OnboardingCounts = {
  leadership: 0,
  signatories: 0,
  bankAccounts: 0,
  verifiedDocuments: 0,
  documents: 0,
  profileState: "draft",
};

describe("fpo workspace sections", () => {
  it("recognises known sections only", () => {
    expect(isFpoSection("overview")).toBe(true);
    expect(isFpoSection("ledger")).toBe(false);
  });

  it("marks later-phase sections unavailable", () => {
    expect(sectionAvailable("overview")).toBe(true);
    expect(sectionAvailable("documents")).toBe(true);
    expect(sectionAvailable("procurement")).toBe(true);
    expect(sectionAvailable("produce")).toBe(true);
    expect(sectionAvailable("accounts")).toBe(true);
  });
});

describe("fpo onboarding derivation", () => {
  it("reports every step not started for an empty profile", () => {
    const steps = onboardingSteps(null, emptyCounts);
    expect(steps.every((s) => s.status === "not_started")).toBe(true);
    expect(firstIncompleteStep(steps)).toBe("basic_details");
    expect(profileCompleteness(steps)).toBe(0);
  });

  it("marks partially filled steps in progress", () => {
    const steps = onboardingSteps({ legal_name: "Test FPC" }, emptyCounts);
    expect(steps[0]?.status).toBe("in_progress");
  });

  it("advances the first incomplete step as data lands", () => {
    const steps = onboardingSteps(
      {
        legal_name: "Mahabubnagar Farmers Producer Company",
        display_name: "Mahabubnagar FPC",
        phone: "+91 90000 00000",
      },
      emptyCounts,
    );
    expect(steps[0]?.status).toBe("complete");
    expect(firstIncompleteStep(steps)).toBe("registration");
  });

  it("treats leadership as complete only with a signatory", () => {
    const withLeaders = onboardingSteps(null, { ...emptyCounts, leadership: 3 });
    expect(withLeaders.find((s) => s.step === "leadership")?.status).toBe("in_progress");
    const withSignatory = onboardingSteps(null, {
      ...emptyCounts,
      leadership: 3,
      signatories: 1,
    });
    expect(withSignatory.find((s) => s.step === "leadership")?.status).toBe("complete");
  });

  it("computes a completeness percentage between 0 and 100", () => {
    const steps = onboardingSteps(
      {
        legal_name: "A",
        display_name: "B",
        email: "a@b.test",
        registration_number: "R1",
        incorporation_date: "2021-01-01",
        org_type: "producer_company",
        pan: "AAAAA0000A",
      },
      { ...emptyCounts, leadership: 1, signatories: 1, bankAccounts: 1 },
    );
    const pct = profileCompleteness(steps);
    expect(pct).toBeGreaterThan(0);
    expect(pct).toBeLessThan(100);
  });
});

describe("fpo documents", () => {
  it("allows only defined status transitions", () => {
    expect(canTransitionDocument("uploaded", "under_review")).toBe(true);
    expect(canTransitionDocument("under_review", "verified")).toBe(true);
    expect(canTransitionDocument("uploaded", "verified")).toBe(false);
    expect(canTransitionDocument("verified", "uploaded")).toBe(false);
  });

  it("flags expired, rejected and soon-expiring documents", () => {
    const now = new Date("2026-08-26T00:00:00Z");
    const docs: DocLike[] = [
      { doc_type: "pan", status: "verified", expires_at: null },
      { doc_type: "license", status: "verified", expires_at: "2026-09-15" },
      { doc_type: "gst", status: "rejected" },
      { doc_type: "audit_report", status: "verified", expires_at: "2027-06-01" },
    ];
    const due = complianceActions(docs, now).map((d) => d.doc_type);
    expect(due).toEqual(["license", "gst"]);
  });

  it("lists required documents that are missing", () => {
    const missing = missingRequiredDocs([
      { doc_type: "pan", status: "verified" },
      { doc_type: "bank_proof", status: "under_review" },
      { doc_type: "board_resolution", status: "rejected" },
    ]);
    expect(missing).toEqual(["certificate_of_incorporation", "board_resolution"]);
  });
});

describe("fpo finance guards", () => {
  it("masks account numbers to the last four digits", () => {
    expect(maskAccount("4821")).toBe("XXXX XXXX 4821");
    expect(maskAccount(null)).toBe("Not provided");
  });

  it("restricts finance visibility to tenant admins and platform admins", () => {
    expect(canViewFinance(["field_agent"], false)).toBe(false);
    expect(canViewFinance(["tenant_admin"], false)).toBe(true);
    expect(canViewFinance([], true)).toBe(true);
  });
});

describe("fpo dashboard metrics", () => {
  it("derives member and compliance counters and marks later-phase cards", () => {
    const cards = dashboardMetrics({
      profile: { total_acres: 2846, primary_crops: ["Paddy", "Maize", "Cotton"] },
      members: [{ status: "active" }, { status: "active" }, { status: "invited" }],
      docs: [{ doc_type: "gst", status: "expired" }],
      eligibleSchemes: 0,
      applicationsInProgress: 0,
      procurementOpportunities: 0,
      produceAvailable: 0,
      pendingReceivables: 0,
      unreadNotifications: 0,
    });
    const byKey = Object.fromEntries(cards.map((c) => [c.key, c]));
    expect(byKey["members"]?.value).toBe("3");
    expect(byKey["active"]?.value).toBe("2");
    expect(byKey["pendingApprovals"]?.value).toBe("1");
    expect(byKey["crops"]?.value).toBe("3");
    expect(byKey["compliance"]?.value).toBe("1");
    expect(byKey["procurement"]?.pending).toBe(true);
    expect(byKey["members"]?.pending).toBe(false);
  });
});
