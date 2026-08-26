import { describe, expect, it } from "vitest";
import {
  activePurposes,
  applyFilters,
  canActivateMembership,
  canAddMembers,
  canClassifyMembers,
  canTransitionMembership,
  membershipNumber,
  nextSequence,
  normalizeTagCode,
  registrySummary,
  stripNeverShared,
  tabAllowed,
  validateTag,
  visibleTabs,
  type MemberRow,
} from "./fpoMembers";

const members: MemberRow[] = [
  {
    id: "1",
    member_ref: "M-001",
    membership_number: "MFPC/M-000001",
    display_name: "Lakshmi Devi",
    status: "active",
    member_type: "shareholder",
    village_cluster: "Jadcherla",
    crops: ["paddy", "maize"],
    acreage: 4.5,
    farmer_user_id: "u1",
    tagCodes: ["paddy_cluster"],
    consentPurposes: ["fpo_member_management"],
  },
  {
    id: "2",
    member_ref: "M-002",
    membership_number: "MFPC/M-000002",
    display_name: "Ravi Kumar",
    status: "approval_pending",
    member_type: "associate",
    village_cluster: "Devarkadra",
    crops: ["cotton"],
    acreage: 12,
    farmer_user_id: null,
    tagCodes: [],
    consentPurposes: [],
  },
  {
    id: "3",
    member_ref: "M-003",
    membership_number: "MFPC/M-000003",
    display_name: "Sunitha Rao",
    status: "suspended",
    member_type: "shareholder",
    village_cluster: "Jadcherla",
    crops: ["paddy"],
    acreage: 2,
    farmer_user_id: "u3",
    tagCodes: ["paddy_cluster", "kcc_pending"],
    consentPurposes: ["fpo_member_management", "fpo_scheme_assistance"],
  },
];

describe("membership lifecycle", () => {
  it("allows the documented transitions only", () => {
    expect(canTransitionMembership("invited", "approval_pending")).toBe(true);
    expect(canTransitionMembership("active", "suspended")).toBe(true);
    expect(canTransitionMembership("suspended", "active")).toBe(true);
    expect(canTransitionMembership("removed", "active")).toBe(false);
    expect(canTransitionMembership("invited", "suspended")).toBe(false);
  });

  it("refuses activation until a farmer identity is linked", () => {
    expect(canActivateMembership({ status: "approval_pending", farmer_user_id: null })).toEqual({
      ok: false,
      reason: "farmer_identity_not_linked",
    });
    expect(canActivateMembership({ status: "approval_pending", farmer_user_id: "u1" }).ok).toBe(true);
    expect(canActivateMembership({ status: "removed", farmer_user_id: "u1" }).reason).toBe(
      "invalid_transition",
    );
  });
});

describe("membership numbering", () => {
  it("formats and increments without reusing numbers", () => {
    expect(membershipNumber("mfpc", 12)).toBe("MFPC/M-000012");
    expect(nextSequence(["MFPC/M-000002", null, "MFPC/M-000041"])).toBe(42);
    expect(nextSequence([])).toBe(1);
  });
});

describe("tags", () => {
  it("normalizes labels into stable codes", () => {
    expect(normalizeTagCode("  Paddy Cluster — A ")).toBe("paddy_cluster_a");
    expect(validateTag("x").ok).toBe(false);
    expect(validateTag("KCC pending")).toEqual({ ok: true, code: "kcc_pending" });
  });
});

describe("registry filtering", () => {
  it("filters by search, status, crop and tags", () => {
    expect(applyFilters(members, { search: "ravi" }).map((m) => m.id)).toEqual(["2"]);
    expect(applyFilters(members, { status: ["active", "suspended"] }).length).toBe(2);
    expect(applyFilters(members, { crops: ["cotton"] }).map((m) => m.id)).toEqual(["2"]);
    expect(applyFilters(members, { tagCodes: ["paddy_cluster", "kcc_pending"] }).map((m) => m.id)).toEqual([
      "3",
    ]);
  });

  it("filters by linkage, acreage and consent purpose", () => {
    expect(applyFilters(members, { linkedOnly: true }).length).toBe(2);
    expect(applyFilters(members, { minAcreage: 5 }).map((m) => m.id)).toEqual(["2"]);
    expect(
      applyFilters(members, { consentedPurpose: "fpo_scheme_assistance" }).map((m) => m.id),
    ).toEqual(["3"]);
  });

  it("summarizes the registry", () => {
    const s = registrySummary(members);
    expect(s).toMatchObject({ total: 3, active: 1, approvalPending: 1, suspended: 1, linked: 2, unlinked: 1, consented: 2 });
    expect(s.acreage).toBeCloseTo(18.5);
  });
});

describe("Farmer 360 consent gating", () => {
  it("ignores revoked and expired consents", () => {
    const purposes = activePurposes(
      [
        { purpose_code: "fpo_member_management" },
        { purpose_code: "fpo_scheme_assistance", revoked_at: "2026-01-01T00:00:00Z" },
        { purpose_code: "fpo_market_linkage", expires_at: "2020-01-01T00:00:00Z" },
      ],
      new Date("2026-06-01T00:00:00Z"),
    );
    expect(purposes).toEqual(["fpo_member_management"]);
  });

  it("shows membership without consent and gates every other tab", () => {
    expect(visibleTabs([])).toEqual(["membership"]);
    expect(tabAllowed("profile", [])).toBe(false);
    expect(visibleTabs(["fpo_member_management"])).toEqual([
      "membership",
      "profile",
      "farms",
      "crops",
    ]);
    expect(tabAllowed("schemes", ["fpo_scheme_assistance"])).toBe(true);
  });

  it("never exposes bank or identity fields even when consent exists", () => {
    const stripped = stripNeverShared({
      full_name: "Lakshmi Devi",
      bank_ifsc: "SBIN0001",
      bank_account_last4: "4321",
      date_of_birth: "1980-01-01",
      village: "Jadcherla",
    });
    expect(stripped).toEqual({ full_name: "Lakshmi Devi", village: "Jadcherla" });
  });
});

describe("membership authorization", () => {
  it("lets field officers add members but not classify or consent", () => {
    expect(canAddMembers(["field_agent"], false)).toBe(true);
    expect(canClassifyMembers(["field_agent"], false)).toBe(false);
    expect(canClassifyMembers(["tenant_admin"], false)).toBe(true);
    expect(canAddMembers(["viewer"], false)).toBe(false);
    expect(canClassifyMembers([], true)).toBe(true);
  });
});
