import { describe, expect, it } from "vitest";
import { navItemsForRoles } from "@/components/atap/AppShell";

const labels = (roles: Parameters<typeof navItemsForRoles>[0], signedIn = true) =>
  navItemsForRoles(roles, signedIn).map((i) => i.label);

describe("role-aware navigation", () => {
  it("shows only public entries when signed out", () => {
    expect(labels([], false)).toEqual(["Overview", "Roles", "Architecture"]);
  });

  it("gives a plain member no reviewer or configuration entries", () => {
    const items = labels(["viewer"]);
    expect(items).toContain("My onboarding");
    expect(items).not.toContain("Review queue");
    expect(items).not.toContain("Configuration");
  });

  it("gives an onboarding officer the review queue but not configuration", () => {
    const items = labels(["onboarding_officer"]);
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
    const items = labels(["onboarding_officer"]);
    expect(items).toContain("FPO workspace");
    expect(items).not.toContain("Government");
    expect(items).not.toContain("District");
  });

  it("gives a scheme reviewer the government surface but no FPO workspace", () => {
    const items = labels(["scheme_reviewer"]);
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
});
