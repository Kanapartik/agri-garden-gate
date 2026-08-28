/**
 * FPO opportunity intelligence (AP + Telangana) — pure helpers.
 *
 * Scores and top-scheme recommendations are imported reference data used as an
 * advisory prioritisation hint. They are never an eligibility decision: any
 * sanction or approval stays with the authorized human/partner role.
 */

export const OPPORTUNITY_ADVISORY =
  "Advisory prioritisation only, compiled from official public sources. Scheme limits, windows and eligibility must be re-verified at application time; sanction decisions stay with the implementing agency.";

export interface OpportunityProfileRow {
  registration_number: string;
  state_name: string;
  district: string | null;
  block_mandal: string | null;
  fpo_name: string;
  cbbo: string | null;
  primary_commodity: string | null;
  commodity_group: string | null;
  member_count: number | null;
  annual_turnover_lakh: number | null;
  priority_need: string | null;
  existing_infrastructure: string | null;
  enam_status: string | null;
  benefits_10k_status: string | null;
  loan_requirement_lakh: number | null;
  gst_status: string | null;
  fssai_status: string | null;
  udyam_status: string | null;
  data_readiness_score: number | null;
  opportunity_score: number | null;
  top_scheme_1: string | null;
  top_scheme_2: string | null;
  top_scheme_3: string | null;
  recommended_next_action: string | null;
  verification_status: string | null;
  last_verified: string | null;
  owner_name: string | null;
  notes: string | null;
  source_url: string | null;
}

export interface SchemeMatrixRow {
  registration_number: string;
  state_name: string;
  district: string | null;
  fpo_name: string;
  commodity_group: string | null;
  priority_need: string | null;
  flag_10k_benefits: string | null;
  flag_enam: string | null;
  flag_aif: string | null;
  flag_pmfme: string | null;
  flag_midh: string | null;
  flag_mechanisation_chc: string | null;
  flag_pm_rkvy: string | null;
  flag_sampada: string | null;
  flag_nmeo_op: string | null;
  flag_pmmsy: string | null;
  flag_state_micro_irrigation: string | null;
  flag_state_income_support: string | null;
  flag_state_other_benefit: string | null;
}

export interface SchemeCatalogRow {
  scheme_id: string;
  scheme_name: string;
  level: string | null;
  applicable_state: string | null;
  beneficiary: string | null;
  category: string | null;
  fpo_relevance: string | null;
  key_benefit: string | null;
  indicative_limit: string | null;
  eligibility_trigger: string | null;
  implementer: string | null;
  application_window: string | null;
  source_url: string | null;
  data_note: string | null;
}

export const MATRIX_FLAG_LABEL: Record<keyof SchemeMatrixFlags, string> = {
  flag_10k_benefits: "10K FPO benefits",
  flag_enam: "e-NAM",
  flag_aif: "AIF",
  flag_pmfme: "PMFME",
  flag_midh: "MIDH",
  flag_mechanisation_chc: "Mechanisation / CHC",
  flag_pm_rkvy: "PM-RKVY",
  flag_sampada: "PM Kisan SAMPADA",
  flag_nmeo_op: "NMEO-OP",
  flag_pmmsy: "PMMSY",
  flag_state_micro_irrigation: "State micro irrigation",
  flag_state_income_support: "State income support",
  flag_state_other_benefit: "State other benefit",
};

export type SchemeMatrixFlags = Pick<
  SchemeMatrixRow,
  | "flag_10k_benefits"
  | "flag_enam"
  | "flag_aif"
  | "flag_pmfme"
  | "flag_midh"
  | "flag_mechanisation_chc"
  | "flag_pm_rkvy"
  | "flag_sampada"
  | "flag_nmeo_op"
  | "flag_pmmsy"
  | "flag_state_micro_irrigation"
  | "flag_state_income_support"
  | "flag_state_other_benefit"
>;

export const MATRIX_FLAG_KEYS = Object.keys(MATRIX_FLAG_LABEL) as Array<keyof SchemeMatrixFlags>;

export type ScoreBand = "high" | "medium" | "low";

export const SCORE_BAND_LABEL: Record<ScoreBand, string> = {
  high: "High priority (60+)",
  medium: "Medium priority (35–59)",
  low: "Baseline (under 35)",
};

export function scoreBand(score: number | null): ScoreBand {
  const s = score ?? 0;
  if (s >= 60) return "high";
  if (s >= 35) return "medium";
  return "low";
}

export interface OpportunityFilters {
  search?: string;
  state?: string;
  district?: string;
  commodityGroup?: string;
  priorityNeed?: string;
  band?: ScoreBand | "";
}

export function filterProfiles(
  rows: OpportunityProfileRow[],
  filters: OpportunityFilters,
): OpportunityProfileRow[] {
  const term = (filters.search ?? "").trim().toLowerCase();
  return rows.filter((r) => {
    if (filters.state && r.state_name !== filters.state) return false;
    if (filters.district && r.district !== filters.district) return false;
    if (filters.commodityGroup && (r.commodity_group ?? "") !== filters.commodityGroup)
      return false;
    if (filters.priorityNeed && (r.priority_need ?? "") !== filters.priorityNeed) return false;
    if (filters.band && scoreBand(r.opportunity_score) !== filters.band) return false;
    if (
      term &&
      !`${r.fpo_name} ${r.registration_number} ${r.district ?? ""} ${r.cbbo ?? ""} ${
        r.primary_commodity ?? ""
      } ${r.top_scheme_1 ?? ""}`
        .toLowerCase()
        .includes(term)
    )
      return false;
    return true;
  });
}

function average(values: number[]): number {
  if (!values.length) return 0;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
}

export interface OpportunityKpis {
  total: number;
  states: number;
  districts: number;
  avgOpportunityScore: number;
  avgDataReadiness: number;
  missingCommodity: number;
  missingTurnover: number;
  highPriority: number;
}

export function summarizeProfiles(rows: OpportunityProfileRow[]): OpportunityKpis {
  return {
    total: rows.length,
    states: new Set(rows.map((r) => r.state_name)).size,
    districts: new Set(rows.map((r) => `${r.state_name}::${r.district ?? ""}`)).size,
    avgOpportunityScore: average(rows.map((r) => r.opportunity_score ?? 0)),
    avgDataReadiness: average(rows.map((r) => r.data_readiness_score ?? 0)),
    missingCommodity: rows.filter((r) => !r.commodity_group && !r.primary_commodity).length,
    missingTurnover: rows.filter((r) => r.annual_turnover_lakh === null).length,
    highPriority: rows.filter((r) => scoreBand(r.opportunity_score) === "high").length,
  };
}

export interface GroupCount {
  key: string;
  count: number;
}

export function countBy(
  rows: OpportunityProfileRow[],
  pick: (r: OpportunityProfileRow) => string,
): GroupCount[] {
  const map = new Map<string, number>();
  for (const r of rows) {
    const k = pick(r) || "Not recorded";
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return Array.from(map, ([key, count]) => ({ key, count })).sort(
    (a, b) => b.count - a.count || a.key.localeCompare(b.key),
  );
}

export interface SchemeDemand {
  key: keyof SchemeMatrixFlags;
  label: string;
  existing: number;
  potential: number;
  total: number;
}

/** How many FPOs the matrix marks as an existing vs potential fit per scheme. */
export function schemeDemand(rows: SchemeMatrixRow[]): SchemeDemand[] {
  return MATRIX_FLAG_KEYS.map((key) => {
    let existing = 0;
    let potential = 0;
    for (const r of rows) {
      const v = (r[key] ?? "").toUpperCase();
      if (!v) continue;
      if (v.startsWith("EXISTING")) existing += 1;
      else potential += 1;
    }
    return { key, label: MATRIX_FLAG_LABEL[key], existing, potential, total: existing + potential };
  }).sort((a, b) => b.total - a.total);
}

export function activeFlags(row: SchemeMatrixRow): Array<{ label: string; value: string }> {
  return MATRIX_FLAG_KEYS.flatMap((k) => {
    const v = row[k];
    return v ? [{ label: MATRIX_FLAG_LABEL[k], value: v }] : [];
  });
}

/** Catalogue entries applicable to a state ("Both" always applies). */
export function catalogForState(
  catalog: SchemeCatalogRow[],
  stateName: string,
): SchemeCatalogRow[] {
  return catalog.filter((c) => {
    const s = (c.applicable_state ?? "Both").toLowerCase();
    return s === "both" || s.includes(stateName.toLowerCase());
  });
}

/** Resolve the FPO's top-three recommendation strings to catalogue entries. */
export function recommendedSchemes(
  profile: OpportunityProfileRow,
  catalog: SchemeCatalogRow[],
): Array<{ recommendation: string; scheme: SchemeCatalogRow | null }> {
  const picks = [profile.top_scheme_1, profile.top_scheme_2, profile.top_scheme_3].filter(
    (v): v is string => Boolean(v && v.trim()),
  );
  const pool = catalogForState(catalog, profile.state_name);
  return picks.map((recommendation) => {
    const needle = recommendation.toLowerCase();
    const scheme =
      pool.find((c) => needle.includes(c.scheme_name.toLowerCase())) ??
      pool.find((c) => c.scheme_name.toLowerCase().split(" ").some((w) => w.length > 4 && needle.includes(w))) ??
      null;
    return { recommendation, scheme };
  });
}
