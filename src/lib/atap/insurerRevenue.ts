/**
 * Slice I1 — Insurer Revenue Intelligence (Sales), pure helpers.
 *
 * "Who should I insure?" only. Everything here is aggregate market maths on
 * district/crop and FPO-level figures: no farmer identity, contact, bank or
 * plot-level personal data enters this module.
 *
 * The opportunity score is an advisory prioritisation hint with every driver
 * exposed. It is never a quote, a price, an underwriting result or a sanction —
 * those stay with the authorised human/partner role.
 */

export const INSURER_ADVISORY =
  "Advisory sales prioritisation only, computed from synthetic market baselines and FPO registry aggregates. Not a quote, premium rate, underwriting decision or eligibility determination — pricing and acceptance stay with the authorised underwriter.";

export const AGGREGATE_ONLY_NOTE =
  "Aggregate view: no farmer identity, contact, bank or land-parcel data is read by this workspace.";

/* ------------------------------------------------------------------ types */

export interface MarketCellRow {
  state_name: string;
  district: string;
  crop: string;
  potential_farmers: number;
  cultivated_acres: number;
  insured_farmers: number;
  insured_acres: number;
  premium_per_acre: number;
  source: string | null;
  last_verified: string | null;
}

export interface ChannelRow {
  id: string;
  insurer_tenant_id: string;
  registration_number: string;
  fpo_name: string;
  state_name: string;
  district: string | null;
  block_mandal: string | null;
  commodity_group: string | null;
  primary_commodity: string | null;
  member_count: number | null;
  cultivated_acres: number | null;
  insured_members: number;
  policies_count: number;
  premium_inr: number;
  potential_premium_inr: number;
  accessibility: string | null;
  owner_name: string | null;
  opportunity_score: number;
  score_drivers: ScoreDriver[];
  last_reviewed: string | null;
  /** Insurer-internal only; stripped before an FPO counterpart ever sees a row. */
  internal_notes?: string | null;
}

export type FunnelStage =
  | "lead"
  | "contacted"
  | "interested"
  | "documents_initiated"
  | "verified"
  | "quote_generated"
  | "premium_pending"
  | "enrolled"
  | "dropped";

export const FUNNEL_ORDER: FunnelStage[] = [
  "lead",
  "contacted",
  "interested",
  "documents_initiated",
  "verified",
  "quote_generated",
  "premium_pending",
  "enrolled",
];

export const FUNNEL_LABEL: Record<FunnelStage, string> = {
  lead: "Lead",
  contacted: "Contacted",
  interested: "Interested",
  documents_initiated: "Documents initiated",
  verified: "Verified",
  quote_generated: "Quote generated",
  premium_pending: "Premium pending",
  enrolled: "Enrolled",
  dropped: "Dropped",
};

export interface FunnelRow {
  id: string;
  registration_number: string;
  fpo_name: string;
  state_name: string;
  district: string | null;
  stage: FunnelStage;
  farmer_count: number;
  acres: number;
  premium_opportunity_inr: number;
  owner_name: string | null;
  notes?: string | null;
}

export type CampaignState = "draft" | "active" | "paused" | "completed" | "cancelled";

export interface CampaignRow {
  id: string;
  name: string;
  season: string | null;
  state_name: string | null;
  district: string | null;
  commodity: string | null;
  target_farmers: number;
  target_acres: number;
  premium_opportunity_inr: number;
  owner_name: string | null;
  state: CampaignState;
  starts_on: string | null;
  ends_on: string | null;
  notes: string | null;
  targets: Array<{ registration_number: string; fpo_name: string; target_farmers: number }>;
}

/* ------------------------------------------------------- market maths */

/** Share of potential farmers already insured, 0–100 with one decimal. */
export function penetrationPct(insured: number, potential: number): number {
  if (potential <= 0) return 0;
  return Math.round((insured / potential) * 1000) / 10;
}

export interface MarketOpportunity extends MarketCellRow {
  penetration: number;
  uninsured_farmers: number;
  opportunity_acres: number;
  premium_potential_inr: number;
}

export function marketOpportunity(cell: MarketCellRow): MarketOpportunity {
  const uninsured = Math.max(cell.potential_farmers - cell.insured_farmers, 0);
  const acres = Math.max(cell.cultivated_acres - cell.insured_acres, 0);
  return {
    ...cell,
    penetration: penetrationPct(cell.insured_farmers, cell.potential_farmers),
    uninsured_farmers: uninsured,
    opportunity_acres: acres,
    premium_potential_inr: Math.round(acres * cell.premium_per_acre),
  };
}

export interface MarketTotals {
  cells: number;
  districts: number;
  potentialFarmers: number;
  insuredFarmers: number;
  penetration: number;
  uninsuredFarmers: number;
  opportunityAcres: number;
  premiumPotentialInr: number;
}

export function summarizeMarket(rows: MarketOpportunity[]): MarketTotals {
  const potential = rows.reduce((a, r) => a + r.potential_farmers, 0);
  const insured = rows.reduce((a, r) => a + r.insured_farmers, 0);
  return {
    cells: rows.length,
    districts: new Set(rows.map((r) => `${r.state_name}::${r.district}`)).size,
    potentialFarmers: potential,
    insuredFarmers: insured,
    penetration: penetrationPct(insured, potential),
    uninsuredFarmers: rows.reduce((a, r) => a + r.uninsured_farmers, 0),
    opportunityAcres: rows.reduce((a, r) => a + r.opportunity_acres, 0),
    premiumPotentialInr: rows.reduce((a, r) => a + r.premium_potential_inr, 0),
  };
}

export interface MarketFilters {
  search?: string;
  state?: string;
  district?: string;
  crop?: string;
}

export function filterMarket(rows: MarketOpportunity[], f: MarketFilters): MarketOpportunity[] {
  const term = (f.search ?? "").trim().toLowerCase();
  return rows.filter((r) => {
    if (f.state && r.state_name !== f.state) return false;
    if (f.district && r.district !== f.district) return false;
    if (f.crop && r.crop !== f.crop) return false;
    if (term && !`${r.district} ${r.crop}`.toLowerCase().includes(term)) return false;
    return true;
  });
}

/* ------------------------------------------- opportunity score (advisory) */

export interface ScoreDriver {
  key: string;
  label: string;
  points: number;
  max: number;
  detail: string;
}

export interface ScoreInput {
  member_count: number | null;
  cultivated_acres: number | null;
  insured_members: number;
  potential_premium_inr: number;
  commodity_group: string | null;
  primary_commodity: string | null;
  accessibility: string | null;
}

/** Indicative crop-value bands — synthetic, [VALIDATE] with insurer pricing. */
const HIGH_VALUE = ["chilli", "turmeric", "horticulture", "spices", "cotton", "oil palm"];
const MID_VALUE = ["paddy", "rice", "maize", "groundnut", "pulses", "oilseeds"];

function cropBand(input: ScoreInput): { points: number; label: string } {
  const text = `${input.commodity_group ?? ""} ${input.primary_commodity ?? ""}`.toLowerCase();
  if (HIGH_VALUE.some((c) => text.includes(c))) return { points: 10, label: "high-value crop" };
  if (MID_VALUE.some((c) => text.includes(c))) return { points: 6, label: "mid-value crop" };
  return { points: 2, label: "crop not recorded" };
}

function clamp(value: number, max: number): number {
  return Math.max(0, Math.min(max, Math.round(value)));
}

/**
 * Weighted 0–100 composite. Weights are a first proposal pending insurer sales
 * sign-off — [VALIDATE weights].
 */
export function scoreDrivers(input: ScoreInput): ScoreDriver[] {
  const members = input.member_count ?? 0;
  const acres = input.cultivated_acres ?? 0;
  const uninsured = Math.max(members - input.insured_members, 0);
  const gap = members > 0 ? uninsured / members : 0;
  const crop = cropBand(input);
  const access = (input.accessibility ?? "").toLowerCase();
  const accessPoints = access === "easy" ? 5 : access === "moderate" ? 3 : access === "remote" ? 1 : 2;
  const filled = [
    input.member_count !== null,
    input.cultivated_acres !== null,
    Boolean(input.commodity_group || input.primary_commodity),
    Boolean(input.accessibility),
  ].filter(Boolean).length;

  return [
    {
      key: "farmer_base",
      label: "Farmer base",
      points: clamp((members / 1500) * 20, 20),
      max: 20,
      detail: `${members.toLocaleString("en-IN")} members`,
    },
    {
      key: "acreage",
      label: "Acreage",
      points: clamp((acres / 3000) * 15, 15),
      max: 15,
      detail: `${Math.round(acres).toLocaleString("en-IN")} acres`,
    },
    {
      key: "penetration_gap",
      label: "Penetration gap",
      points: clamp(gap * 25, 25),
      max: 25,
      detail: `${uninsured.toLocaleString("en-IN")} uninsured members (${Math.round(gap * 100)}%)`,
    },
    {
      key: "premium_potential",
      label: "Premium potential",
      points: clamp((input.potential_premium_inr / 1_500_000) * 20, 20),
      max: 20,
      detail: `₹${Math.round(input.potential_premium_inr).toLocaleString("en-IN")} indicative`,
    },
    { key: "crop_value", label: "Crop value", points: crop.points, max: 10, detail: crop.label },
    {
      key: "accessibility",
      label: "Accessibility",
      points: accessPoints,
      max: 5,
      detail: input.accessibility ?? "not recorded",
    },
    {
      key: "data_completeness",
      label: "Data completeness",
      points: clamp((filled / 4) * 5, 5),
      max: 5,
      detail: `${filled} of 4 key fields recorded`,
    },
  ];
}

export function opportunityScore(input: ScoreInput): number {
  return Math.min(
    100,
    scoreDrivers(input).reduce((a, d) => a + d.points, 0),
  );
}

export type ScoreBand = "priority" | "develop" | "watch";

export const SCORE_BAND_LABEL: Record<ScoreBand, string> = {
  priority: "Priority (65+)",
  develop: "Develop (40–64)",
  watch: "Watch (under 40)",
};

export function scoreBand(score: number): ScoreBand {
  if (score >= 65) return "priority";
  if (score >= 40) return "develop";
  return "watch";
}

/* --------------------------------------------------------- channel board */

export interface ChannelFilters {
  search?: string;
  state?: string;
  district?: string;
  commodityGroup?: string;
  band?: ScoreBand | "";
}

export function filterChannel(rows: ChannelRow[], f: ChannelFilters): ChannelRow[] {
  const term = (f.search ?? "").trim().toLowerCase();
  return rows.filter((r) => {
    if (f.state && r.state_name !== f.state) return false;
    if (f.district && r.district !== f.district) return false;
    if (f.commodityGroup && (r.commodity_group ?? "") !== f.commodityGroup) return false;
    if (f.band && scoreBand(r.opportunity_score) !== f.band) return false;
    if (
      term &&
      !`${r.fpo_name} ${r.registration_number} ${r.district ?? ""} ${r.owner_name ?? ""}`
        .toLowerCase()
        .includes(term)
    )
      return false;
    return true;
  });
}

export interface ChannelTotals {
  fpos: number;
  members: number;
  insuredMembers: number;
  penetration: number;
  premiumInr: number;
  potentialPremiumInr: number;
  priorityFpos: number;
  unowned: number;
}

export function summarizeChannel(rows: ChannelRow[]): ChannelTotals {
  const members = rows.reduce((a, r) => a + (r.member_count ?? 0), 0);
  const insured = rows.reduce((a, r) => a + r.insured_members, 0);
  return {
    fpos: rows.length,
    members,
    insuredMembers: insured,
    penetration: penetrationPct(insured, members),
    premiumInr: rows.reduce((a, r) => a + r.premium_inr, 0),
    potentialPremiumInr: rows.reduce((a, r) => a + r.potential_premium_inr, 0),
    priorityFpos: rows.filter((r) => scoreBand(r.opportunity_score) === "priority").length,
    unowned: rows.filter((r) => !r.owner_name).length,
  };
}

/* ----------------------------------------------------------------- funnel */

export interface FunnelStageSummary {
  stage: FunnelStage;
  label: string;
  fpos: number;
  farmers: number;
  premiumOpportunityInr: number;
}

export function summarizeFunnel(rows: FunnelRow[]): FunnelStageSummary[] {
  return [...FUNNEL_ORDER, "dropped" as FunnelStage].map((stage) => {
    const at = rows.filter((r) => r.stage === stage);
    return {
      stage,
      label: FUNNEL_LABEL[stage],
      fpos: at.length,
      farmers: at.reduce((a, r) => a + r.farmer_count, 0),
      premiumOpportunityInr: at.reduce((a, r) => a + r.premium_opportunity_inr, 0),
    };
  });
}

/** Conversion from the first stage to `stage`, as a percentage of FPOs. */
export function conversionPct(rows: FunnelRow[], stage: FunnelStage): number {
  if (!rows.length) return 0;
  const idx = FUNNEL_ORDER.indexOf(stage);
  if (idx < 0) return 0;
  const reached = rows.filter((r) => {
    const i = FUNNEL_ORDER.indexOf(r.stage);
    return i >= idx;
  }).length;
  return Math.round((reached / rows.length) * 1000) / 10;
}

/**
 * Pipeline moves are staff decisions: forward one step, or an explicit drop /
 * reinstatement. Skipping stages is refused so the audit trail stays readable.
 */
export function canMoveStage(from: FunnelStage, to: FunnelStage): boolean {
  if (from === to) return false;
  if (to === "dropped") return from !== "enrolled";
  if (from === "dropped") return to === "lead";
  const a = FUNNEL_ORDER.indexOf(from);
  const b = FUNNEL_ORDER.indexOf(to);
  if (a < 0 || b < 0) return false;
  return b === a + 1 || b === a - 1;
}

export function nextStage(from: FunnelStage): FunnelStage | null {
  const i = FUNNEL_ORDER.indexOf(from);
  if (i < 0 || i === FUNNEL_ORDER.length - 1) return null;
  return FUNNEL_ORDER[i + 1] ?? null;
}

/* -------------------------------------------------------------- formatting */

export function formatInr(value: number): string {
  if (value >= 1_00_00_000) return `₹${(value / 1_00_00_000).toFixed(2)} Cr`;
  if (value >= 1_00_000) return `₹${(value / 1_00_000).toFixed(2)} L`;
  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}

export function uniqueSorted(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.filter((v): v is string => Boolean(v && v.trim())))).sort((a, b) =>
    a.localeCompare(b),
  );
}
