import { describe, expect, it } from "vitest";
import {
  activeFlags,
  catalogForState,
  countBy,
  filterProfiles,
  recommendedSchemes,
  schemeDemand,
  scoreBand,
  summarizeProfiles,
  type OpportunityProfileRow,
  type SchemeCatalogRow,
  type SchemeMatrixRow,
} from "@/lib/atap/fpoOpportunityIntel";

const base: OpportunityProfileRow = {
  registration_number: "U0001AP2023PTC000001",
  state_name: "Andhra Pradesh",
  district: "Guntur",
  block_mandal: "Tenali",
  fpo_name: "Guntur Chilli FPC",
  cbbo: "APMAS",
  primary_commodity: "Chilli",
  commodity_group: "Spices",
  member_count: 500,
  annual_turnover_lakh: 120,
  priority_need: "Cold storage",
  existing_infrastructure: null,
  enam_status: "Registered",
  benefits_10k_status: null,
  loan_requirement_lakh: 200,
  gst_status: "Active",
  fssai_status: null,
  udyam_status: null,
  data_readiness_score: 70,
  opportunity_score: 80,
  top_scheme_1: "Agriculture Infrastructure Fund (AIF)",
  top_scheme_2: null,
  top_scheme_3: null,
  recommended_next_action: "Prepare AIF DPR",
  verification_status: "Not Assessed",
  last_verified: null,
  owner_name: null,
  notes: null,
  source_url: null,
};

const other: OpportunityProfileRow = {
  ...base,
  registration_number: "U0002TG2021PTC000002",
  state_name: "Telangana",
  district: "Adilabad",
  fpo_name: "Adilabad Cotton FPC",
  primary_commodity: null,
  commodity_group: null,
  annual_turnover_lakh: null,
  opportunity_score: 25,
  data_readiness_score: 0,
  top_scheme_1: "10K FPO Scheme - Utilisation Check",
};

const catalog: SchemeCatalogRow[] = [
  {
    scheme_id: "CENT_AIF",
    scheme_name: "Agriculture Infrastructure Fund (AIF)",
    level: "Central",
    applicable_state: "Both",
    beneficiary: "FPOs",
    category: "Infrastructure / Debt",
    fpo_relevance: "Direct",
    key_benefit: "Post-harvest infrastructure financing",
    indicative_limit: "3% interest subvention up to ₹2 crore",
    eligibility_trigger: "Eligible project",
    implementer: "DA&FW",
    application_window: "Ongoing",
    source_url: "https://example.gov.in/aif",
    data_note: null,
  },
  {
    scheme_id: "AP_ONLY",
    scheme_name: "AP Micro Irrigation Project",
    level: "State",
    applicable_state: "Andhra Pradesh",
    beneficiary: "Farmers",
    category: "Irrigation",
    fpo_relevance: "Indirect",
    key_benefit: "Drip subsidy",
    indicative_limit: "Up to 90%",
    eligibility_trigger: "Land record",
    implementer: "APMIP",
    application_window: "Seasonal",
    source_url: null,
    data_note: null,
  },
];

const matrixRow: SchemeMatrixRow = {
  registration_number: base.registration_number,
  state_name: base.state_name,
  district: base.district,
  fpo_name: base.fpo_name,
  commodity_group: "Spices",
  priority_need: "Cold storage",
  flag_10k_benefits: "EXISTING - Verify utilisation",
  flag_enam: "POTENTIAL",
  flag_aif: "POTENTIAL",
  flag_pmfme: null,
  flag_midh: null,
  flag_mechanisation_chc: null,
  flag_pm_rkvy: null,
  flag_sampada: null,
  flag_nmeo_op: null,
  flag_pmmsy: null,
  flag_state_micro_irrigation: null,
  flag_state_income_support: null,
  flag_state_other_benefit: null,
};

describe("fpo opportunity intelligence", () => {
  it("bands opportunity scores", () => {
    expect(scoreBand(80)).toBe("high");
    expect(scoreBand(40)).toBe("medium");
    expect(scoreBand(25)).toBe("low");
    expect(scoreBand(null)).toBe("low");
  });

  it("filters by state, district, band and search", () => {
    const rows = [base, other];
    expect(filterProfiles(rows, { state: "Telangana" })).toHaveLength(1);
    expect(filterProfiles(rows, { district: "Guntur" })[0]?.fpo_name).toBe("Guntur Chilli FPC");
    expect(filterProfiles(rows, { band: "high" })).toHaveLength(1);
    expect(filterProfiles(rows, { search: "cotton" })[0]?.state_name).toBe("Telangana");
    expect(filterProfiles(rows, { commodityGroup: "Spices" })).toHaveLength(1);
  });

  it("summarises coverage and enrichment backlog", () => {
    const k = summarizeProfiles([base, other]);
    expect(k.total).toBe(2);
    expect(k.states).toBe(2);
    expect(k.districts).toBe(2);
    expect(k.avgOpportunityScore).toBe(52.5);
    expect(k.missingCommodity).toBe(1);
    expect(k.missingTurnover).toBe(1);
    expect(k.highPriority).toBe(1);
  });

  it("counts groups with a fallback label", () => {
    expect(countBy([base, other], (r) => r.commodity_group ?? "")).toEqual([
      { key: "Not recorded", count: 1 },
      { key: "Spices", count: 1 },
    ]);
  });

  it("splits existing vs potential scheme demand", () => {
    const demand = schemeDemand([matrixRow]);
    const tenK = demand.find((d) => d.key === "flag_10k_benefits")!;
    expect(tenK.existing).toBe(1);
    expect(tenK.potential).toBe(0);
    expect(demand.find((d) => d.key === "flag_aif")!.potential).toBe(1);
    expect(demand.find((d) => d.key === "flag_pmmsy")!.total).toBe(0);
  });

  it("lists only the flags set on a matrix row", () => {
    expect(activeFlags(matrixRow).map((f) => f.label)).toEqual([
      "10K FPO benefits",
      "e-NAM",
      "AIF",
    ]);
  });

  it("scopes the catalogue to the FPO state, keeping Both", () => {
    expect(catalogForState(catalog, "Telangana").map((c) => c.scheme_id)).toEqual(["CENT_AIF"]);
    expect(catalogForState(catalog, "Andhra Pradesh")).toHaveLength(2);
  });

  it("resolves top scheme recommendations to catalogue entries", () => {
    const [first] = recommendedSchemes(base, catalog);
    expect(first?.scheme?.scheme_id).toBe("CENT_AIF");
    const unresolved = recommendedSchemes(other, catalog)[0];
    expect(unresolved?.scheme).toBeNull();
  });

  it("returns no recommendations when none are recorded", () => {
    expect(recommendedSchemes({ ...base, top_scheme_1: null }, catalog)).toHaveLength(0);
  });
});
