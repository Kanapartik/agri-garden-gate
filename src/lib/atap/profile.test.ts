import { describe, expect, it } from "vitest";
import {
  accountLast4,
  deriveAge,
  mapExtraction,
  maskAccount,
  normalizeIfsc,
  profileCompleteness,
  provenanceAfterConfirm,
  schemeContextValues,
  type FarmerProfile,
} from "@/lib/atap/profile";

const complete: FarmerProfile = {
  full_name: "Sailaja Kondepudi",
  photo_path: "u1/photo-1.jpg",
  date_of_birth: "1984-06-12",
  gender: "female",
  social_category: "obc",
  ownership_type: "owner",
  total_extent_acres: 3.5,
  irrigation_source: "borewell",
  state_geography_id: "geo-ap",
  district_geography_id: "geo-guntur",
  village_code: "GNT-PDL-004",
  bank_account_holder: "Sailaja Kondepudi",
  bank_name: "Krishna Grameena Bank",
  bank_branch: "Pedanandipadu",
  bank_ifsc: "KGBK0001234",
  bank_account_last4: "8821",
  field_provenance: {},
};

const geographies = [
  { id: "geo-ap", code: "IN-AP", name: "Andhra Pradesh", level: "state" },
  { id: "geo-guntur", code: "IN-AP-GNT", name: "Guntur", level: "district" },
];

describe("age derivation", () => {
  it("derives whole years and respects the birthday boundary", () => {
    expect(deriveAge("1984-06-12", new Date("2026-06-11T00:00:00Z"))).toBe(41);
    expect(deriveAge("1984-06-12", new Date("2026-06-12T00:00:00Z"))).toBe(42);
  });

  it("returns null for missing or unusable dates", () => {
    expect(deriveAge(null)).toBeNull();
    expect(deriveAge("not-a-date")).toBeNull();
  });
});

describe("bank detail handling", () => {
  it("keeps only the last four digits", () => {
    expect(accountLast4("3021 4455 8821")).toBe("8821");
    expect(accountLast4("12")).toBeNull();
    expect(maskAccount("8821")).toBe("••••••8821");
  });

  it("accepts only well-formed IFSC codes", () => {
    expect(normalizeIfsc(" kgbk0001234 ")).toBe("KGBK0001234");
    expect(normalizeIfsc("BADIFSC")).toBeNull();
  });
});

describe("profile completeness", () => {
  it("is scheme ready only when every required field is present", () => {
    expect(profileCompleteness(complete, 1).schemeReady).toBe(true);
    expect(profileCompleteness(complete, 1).score).toBe(100);

    const partial = { ...complete, social_category: null, bank_account_last4: null };
    const result = profileCompleteness(partial, 0);
    expect(result.schemeReady).toBe(false);
    expect(result.missingRequired).toContain("Social category");
    expect(result.missingRequired).toContain("Bank passbook details");
  });

  it("treats a missing profile as not scheme ready", () => {
    expect(profileCompleteness(null, 0).schemeReady).toBe(false);
  });
});

describe("scheme context values", () => {
  it("supplies the rule inputs schemes actually evaluate", () => {
    const values = schemeContextValues({
      profile: complete,
      farm: {
        primary_crop: "chilli",
        area_acres: 2.25,
        village_code: "GNT-PDL-004",
        plot_ref: "112/3A",
        label: "Home plot",
      },
      geographies,
      today: new Date("2026-08-19T00:00:00Z"),
    });

    expect(values["applicant_age"]).toBe(42);
    expect(values["social_category"]).toBe("obc");
    expect(values["ownership_type"]).toBe("owner");
    expect(values["state_code"]).toBe("IN-AP");
    expect(values["district_code"]).toBe("IN-AP-GNT");
    expect(values["bank_linked"]).toBe("yes");
    // A captured parcel is more specific than the declared total extent.
    expect(values["land_area_acres"]).toBe(2.25);
  });

  it("falls back to declared extent and reports missing bank linkage", () => {
    const values = schemeContextValues({
      profile: { ...complete, bank_account_last4: null },
      farm: null,
      geographies,
    });
    expect(values["land_area_acres"]).toBe(3.5);
    expect(values["bank_linked"]).toBe("no");
  });

  it("omits rule inputs it cannot derive rather than guessing", () => {
    const values = schemeContextValues({ profile: null, farm: null, geographies });
    expect(values["applicant_age"]).toBeUndefined();
    expect(values["state_code"]).toBeUndefined();
  });
});

describe("document extraction mapping", () => {
  it("maps a passbook reading and drops an invalid IFSC", () => {
    const suggestions = mapExtraction(
      {
        account_holder_name: "Sailaja Kondepudi",
        bank_name: "Krishna Grameena Bank",
        ifsc: "kgbk0001234",
        account_number: "30214455 8821",
        confidence: 0.82,
      },
      "bank_passbook",
    );
    const fields = suggestions.map((s) => s.field);
    expect(fields).toContain("bank_ifsc");
    expect(fields).toContain("bank_account_number");
    expect(suggestions.every((s) => s.confidence <= 0.99)).toBe(true);

    const bad = mapExtraction({ ifsc: "NOPE", account_number: "12" }, "bank_passbook");
    expect(bad).toHaveLength(0);
  });

  it("maps a land record and rejects an unknown ownership word", () => {
    const suggestions = mapExtraction(
      { survey_number: "112/3A", extent_acres: "2.25 acres", ownership_type: "tenant" },
      "land_record",
    );
    const fields = suggestions.map((s) => s.field);
    expect(fields).toContain("land_record_ref");
    expect(suggestions.find((s) => s.field === "total_extent_acres")?.value).toBe(2.25);
    expect(fields).not.toContain("ownership_type");
  });

  it("never returns an identity number from an ID proof", () => {
    const suggestions = mapExtraction(
      { full_name: "Ramesh Naik", date_of_birth: "1979-02-04", confidence: 0.7 },
      "id_proof",
    );
    expect(suggestions.map((s) => s.field).sort()).toEqual(["date_of_birth", "full_name"]);
  });
});

describe("provenance", () => {
  it("marks AI-read fields as farmer_confirmed only after confirmation", () => {
    const next = provenanceAfterConfirm({ bank_ifsc: "ai_extracted" }, ["bank_ifsc"], ["full_name"]);
    expect(next["bank_ifsc"]).toBe("farmer_confirmed");
    expect(next["full_name"]).toBe("farmer_entered");
  });
});
