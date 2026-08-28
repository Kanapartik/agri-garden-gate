/**
 * Configuration tests for the expanded service subtype catalogue.
 *
 * The subtypes are catalogue rows: adding a new provider kind must never need a
 * code fork, must never activate implicitly, and must always carry a dispute
 * flow and a human evidence decision.
 */
import { describe, expect, it } from "vitest";
import {
  evaluateSubtypeActivation,
  missingProfileFields,
  subtypeCatalogueReady,
  usableSubtypes,
  type ServiceSubtypeConfig,
} from "@/lib/atap/expansion";

interface CatalogueRow extends ServiceSubtypeConfig {
  label: string;
  activation_trigger: string;
  profile_fields: Array<{ key: string; label: string; required: boolean }>;
}

/** Mirrors the migrated catalogue configuration. */
const CATALOGUE: CatalogueRow[] = [
  row("packaging_provider", "Packaging provider", "logistics", "Approved service listing", [
    "service_regions",
    "packaging_types",
  ]),
  row("logistics", "Logistics provider", "logistics", "Booking / lead endpoint ready", [
    "service_regions",
    "vehicle_capacity_class",
    "tracking_integration",
  ]),
  row("certification_agency", "Certification agency", "advisory_service", "Verified certification service", [
    "accreditation_evidence",
    "certification_domains",
    "service_regions",
  ]),
  row(
    "testing_soil_lab",
    "Testing / soil lab",
    "advisory_service",
    "Test/referral profile plus an approved data contribution path",
    ["lab_capability", "test_catalog", "evidence_submission_method", "data_contribution_path"],
  ),
  row("cold_storage", "Cold storage", "logistics", "Verified capacity listing", [
    "facility_location",
    "storage_capacity",
    "storage_type",
    "booking_receipt_capability",
  ]),
  row("warehouse_storage", "Warehouse storage", "logistics", "Verified capacity listing", [
    "facility_location",
    "storage_capacity",
  ]),
  row("chc_equipment_rental", "CHC / equipment rental", "chc_equipment_rental", "Rental listing", [
    "equipment_inventory",
    "facility_location",
    "availability",
    "rental_terms",
  ]),
  row("drone_operator", "Drone operator", "chc_equipment_rental", "Service job eligibility", [
    "coverage_regions",
    "equipment_service_class",
    "credentials_permissions",
  ]),
  row("export_facilitator", "Export facilitator", "advisory_service", "Service listing / referral flow", [
    "target_markets",
    "support_scope",
    "service_regions",
  ]),
];

function row(
  code: string,
  label: string,
  domain: string,
  trigger: string,
  fieldKeys: string[],
): CatalogueRow {
  return {
    code,
    label,
    domain,
    evidence_gate: "not_evaluated",
    verification_checks: [{ code: "entity_proof", label: "Registered entity proof" }],
    dispute_categories: ["billing_dispute"],
    requires_human_decision: true,
    is_active: false,
    flagEnabled: false,
    activation_trigger: trigger,
    profile_fields: fieldKeys.map((key) => ({ key, label: key, required: true })),
  };
}

describe("service subtype catalogue", () => {
  it("covers every requested subtype", () => {
    expect(CATALOGUE.map((r) => r.code).sort()).toEqual(
      [
        "certification_agency",
        "chc_equipment_rental",
        "cold_storage",
        "drone_operator",
        "export_facilitator",
        "logistics",
        "packaging_provider",
        "testing_soil_lab",
        "warehouse_storage",
      ].sort(),
    );
  });

  it("declares profile data and an activation trigger for every subtype", () => {
    for (const r of CATALOGUE) {
      expect(subtypeCatalogueReady(r), r.code).toEqual({ ok: true, errors: [] });
    }
  });

  it("keeps every subtype inactive and default-deny until a human approves evidence", () => {
    for (const r of CATALOGUE) {
      expect(usableSubtypes([r]), r.code).toEqual([]);
      expect(evaluateSubtypeActivation({ subtype: r }).errors, r.code).toContain(
        "evidence_gate_not_approved",
      );
      expect(r.requires_human_decision, r.code).toBe(true);
    }
  });

  it("still refuses activation when the flag is on but evidence is not approved", () => {
    const r: ServiceSubtypeConfig = { ...CATALOGUE[0]!, flagEnabled: true, is_active: true };
    expect(usableSubtypes([r])).toEqual([]);
  });

  it("activates only with an approved gate, checks, disputes and the flag on", () => {
    const r: ServiceSubtypeConfig = {
      ...CATALOGUE[0]!,
      evidence_gate: "approved",
      flagEnabled: true,
      is_active: true,
    };
    expect(usableSubtypes([r]).map((s) => s.code)).toEqual(["packaging_provider"]);
  });

  it("blocks the export facilitator from becoming an export marketplace domain", () => {
    const r = CATALOGUE.find((c) => c.code === "export_facilitator")!;
    expect(r.domain).toBe("advisory_service");
    const marketplace: ServiceSubtypeConfig = {
      ...r,
      domain: "export_marketplace",
      evidence_gate: "approved",
      flagEnabled: true,
      is_active: true,
    };
    expect(usableSubtypes([marketplace])).toEqual([]);
  });

  it("reports missing required profile data per subtype", () => {
    const lab = CATALOGUE.find((c) => c.code === "testing_soil_lab")!;
    expect(missingProfileFields(lab, {})).toEqual([
      "lab_capability",
      "test_catalog",
      "evidence_submission_method",
      "data_contribution_path",
    ]);
    expect(
      missingProfileFields(lab, {
        lab_capability: "Soil NPK, micro-nutrients",
        test_catalog: ["soil_npk"],
        evidence_submission_method: "portal_upload",
        data_contribution_path: "  ",
      }),
    ).toEqual(["data_contribution_path"]);
  });

  it("treats an incomplete catalogue row as not offerable", () => {
    expect(
      subtypeCatalogueReady({
        profile_fields: [],
        activation_trigger: null,
        verification_checks: [],
        dispute_categories: [],
      }).errors,
    ).toEqual([
      "profile_fields_missing",
      "activation_trigger_missing",
      "verification_checks_missing",
      "dispute_flow_missing",
    ]);
  });
});
