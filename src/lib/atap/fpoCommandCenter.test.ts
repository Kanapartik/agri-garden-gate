import { describe, expect, it } from "vitest";
import type { MetricCard } from "@/lib/atap/fpo";
import {
  FPO_CORE_MODULES,
  FPO_DASHBOARD_LENSES,
  FPO_OPERATING_CHAIN,
  buildFpoAttention,
  defaultFpoDashboardLens,
  deriveFpoReadiness,
} from "@/lib/atap/fpoCommandCenter";

describe("FPO intelligence and governance command centre", () => {
  it("connects ten core modules to delivered workspace sections", () => {
    expect(FPO_CORE_MODULES).toHaveLength(10);
    expect(new Set(FPO_CORE_MODULES.map((module) => module.key)).size).toBe(10);
    expect(FPO_CORE_MODULES.filter((module) => module.status === "operational")).toHaveLength(7);
    expect(FPO_CORE_MODULES.map((module) => module.key)).toEqual(
      expect.arrayContaining([
        "farmer_360",
        "crop_intelligence",
        "inputs",
        "procurement_quality",
        "inventory_traceability",
        "market_logistics",
        "finance",
        "insurance",
        "governance",
        "revenue_intelligence",
      ]),
    );
    expect(FPO_CORE_MODULES.every((module) => Boolean(module.section))).toBe(true);
  });

  it("models the complete farmer-to-settlement operating chain", () => {
    expect(FPO_OPERATING_CHAIN.map((stage) => stage.key)).toEqual([
      "member",
      "plan",
      "input",
      "aggregate",
      "quality",
      "market",
      "settle",
    ]);
    expect(FPO_OPERATING_CHAIN[0]?.section).toBe("farmers");
    expect(FPO_OPERATING_CHAIN.at(-1)?.section).toBe("accounts");
  });

  it("offers distinct role lenses without changing authority", () => {
    expect(FPO_DASHBOARD_LENSES.map((lens) => lens.key)).toEqual([
      "executive",
      "operations",
      "market_finance",
      "governance",
    ]);
    expect(defaultFpoDashboardLens(["tenant_admin"])).toBe("executive");
    expect(defaultFpoDashboardLens(["field_agent"])).toBe("operations");
    expect(defaultFpoDashboardLens(["auditor"])).toBe("governance");
    expect(defaultFpoDashboardLens(["viewer"])).toBe("market_finance");
  });

  it("derives transparent operating readiness from recorded foundations", () => {
    expect(
      deriveFpoReadiness({
        onboardingCompleteness: 80,
        totalMembers: 100,
        activeMembers: 80,
        missingDocuments: 1,
        complianceActions: 1,
      }),
    ).toEqual({ score: 78, onboarding: 80, memberActivation: 80, compliance: 70 });

    expect(
      deriveFpoReadiness({
        onboardingCompleteness: 100,
        totalMembers: 50,
        activeMembers: 50,
        missingDocuments: 0,
        complianceActions: 0,
      }).score,
    ).toBe(100);
  });

  it("builds actionable priorities from existing overview counters", () => {
    const metrics: MetricCard[] = [
      {
        key: "pendingApprovals",
        label: "Pending farmer approvals",
        value: "3",
        section: "farmers",
        pending: false,
      },
      {
        key: "compliance",
        label: "Compliance actions due",
        value: "2",
        section: "documents",
        pending: false,
      },
    ];
    const attention = buildFpoAttention({
      completeness: 65,
      missingDocuments: ["pan"],
      metrics,
    });

    expect(attention.map((item) => item.key)).toEqual([
      "onboarding",
      "missing_documents",
      "compliance",
      "member_approvals",
    ]);
    expect(attention.filter((item) => item.tone === "urgent")).toHaveLength(2);
  });

  it("routes a fully ready organization to operational insights", () => {
    const attention = buildFpoAttention({
      completeness: 100,
      missingDocuments: [],
      metrics: [],
    });
    expect(attention).toEqual([
      {
        key: "ready",
        label: "Core organization records are ready — review operational insights",
        section: "insights",
        tone: "ready",
      },
    ]);
  });
});
