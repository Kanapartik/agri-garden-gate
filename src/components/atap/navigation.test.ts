import { describe, expect, it } from "vitest";
import { navItemsForRoles } from "@/components/atap/AppShell";

const labels = (
  roles: Parameters<typeof navItemsForRoles>[0],
  signedIn = true,
  tenantTypes: string[] = [],
) => navItemsForRoles(roles, signedIn, tenantTypes).map((i) => i.label);

describe("role-aware navigation", () => {
  it("shows only public entries when signed out", () => {
    expect(labels([], false)).toEqual([
      "Overview",
      "Platform",
      "Roles",
      "Team",
      "Architecture",
    ]);
  });

  it("gives a plain member no reviewer or configuration entries", () => {
    const items = labels(["viewer"]);
    expect(items).toContain("My onboarding");
    expect(items).not.toContain("Review queue");
    expect(items).not.toContain("Configuration");
  });

  it("gives an onboarding officer the review queue but not configuration", () => {
    const items = labels(["onboarding_officer"], true, ["fpo"]);
    expect(items).toContain("Review queue");
    expect(items).not.toContain("Configuration");
  });

  it("gives a platform admin review and configuration", () => {
    const items = labels(["platform_admin"]);
    expect(items).toContain("Review queue");
    expect(items).toContain("Configuration");
    expect(items).toContain("Admin");
  });

  it("gives FPO staff the FPO workspace but no government surface", () => {
    const items = labels(["onboarding_officer"], true, ["fpo"]);
    expect(items).toContain("FPO workspace");
    expect(items).not.toContain("Government");
    expect(items).not.toContain("District");
  });

  it("gives a scheme reviewer the government surface but no FPO workspace", () => {
    const items = labels(["scheme_reviewer"], true, ["govt_dept"]);
    expect(items).toContain("Government");
    expect(items).not.toContain("FPO workspace");
  });

  it("gives every signed-in user scheme discovery", () => {
    expect(labels(["viewer"])).toContain("Schemes");
    expect(labels([], false)).not.toContain("Schemes");
  });

  it("gives an auditor the admin timeline but not configuration", () => {
    const items = labels(["auditor"]);
    expect(items).toContain("Admin");
    expect(items).not.toContain("Configuration");
  });

  it("keeps engineering surfaces away from a plain farmer", () => {
    const items = labels(["viewer"]);
    expect(items).toContain("My profile");
    expect(items).not.toContain("Architecture");
    expect(items).not.toContain("Access console");
    expect(items).not.toContain("Configuration");
  });

  it("keeps engineering surfaces for operators", () => {
    expect(labels(["platform_admin"])).toContain("Architecture");
    expect(labels(["auditor"])).toContain("Architecture");
    expect(labels(["onboarding_officer"])).toContain("Access console");
  });
});

describe("tenant-type aware navigation", () => {
  const FARMER_MENUS = ["My farm", "Farm intelligence", "Training", "Inputs & protection", "Soil care", "Marketplace"];
  const FPO_MENUS = ["FPO workspace", "Opportunity intelligence"];
  const INSURER_MENUS = ["Insurer revenue", "Risk surveillance", "Claims management", "Policies & enrolment"];

  it("hides farmer, FPO and marketplace menus from a pure insurer tenant admin", () => {
    const items = labels(["tenant_admin"], true, ["insurer"]);
    for (const m of FARMER_MENUS) expect(items).not.toContain(m);
    for (const m of FPO_MENUS) expect(items).not.toContain(m);
    for (const m of INSURER_MENUS) expect(items).toContain(m);
    // Individual surfaces still apply.
    expect(items).toContain("My profile");
    expect(items).toContain("My onboarding");
    expect(items).toContain("Consent");
    expect(items).toContain("Schemes");
  });

  it("hides insurer menus from a pure FPO tenant admin", () => {
    const items = labels(["tenant_admin"], true, ["fpo"]);
    for (const m of INSURER_MENUS) expect(items).not.toContain(m);
    for (const m of FARMER_MENUS) expect(items).toContain(m);
    for (const m of FPO_MENUS) expect(items).toContain(m);
  });

  it("shows farmer menus to a plain individual with no tenant membership", () => {
    const items = labels(["viewer"], true, []);
    for (const m of FARMER_MENUS) expect(items).toContain(m);
  });

  it("hides FPO workspace from FPO-type members without a staff role", () => {
    const items = labels(["viewer"], true, ["fpo"]);
    for (const m of FPO_MENUS) expect(items).not.toContain(m);
  });

  it("keeps oversight visibility of both FPO and insurer workspaces", () => {
    const items = labels(["platform_admin"], true, []);
    for (const m of FPO_MENUS) expect(items).toContain(m);
    for (const m of INSURER_MENUS) expect(items).toContain(m);
  });

  it("gives a multi-tenant user the union of their tenant workspaces", () => {
    const items = labels(["tenant_admin"], true, ["fpo", "insurer"]);
    for (const m of [...FPO_MENUS, ...INSURER_MENUS, ...FARMER_MENUS]) expect(items).toContain(m);
  });
});
