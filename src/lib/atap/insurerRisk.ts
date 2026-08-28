/**
 * Slice I2 — Crop monitoring & risk surveillance (insurer), pure helpers.
 *
 * Everything here operates on aggregate district×crop signals only: no farmer
 * identity, plot geometry, contact or claim-level personal data. Alerts are
 * advisory surveillance signals — they never auto-trigger claims, payouts or
 * eligibility decisions; those stay with the authorised human/partner role.
 */

export const RISK_ADVISORY =
  "Advisory risk surveillance only, computed from synthetic weather/crop feeds and district aggregates. Not a claim decision, loss assessment, payout trigger or eligibility determination — claims stay with the authorised claims officer.";

export const RISK_AGGREGATE_NOTE =
  "Aggregate view: district×crop signals only. No farmer identity, plot geometry or claim-level personal data is read by this workspace.";

/* ------------------------------------------------------------------ types */

export type RiskEvent =
  | "drought"
  | "excess_rain"
  | "flood"
  | "hail"
  | "pest_outbreak"
  | "heatwave"
  | "cyclone";

export type RiskSeverity = "watch" | "advisory" | "severe";
export type AlertStatus = "open" | "acknowledged" | "dismissed";

export interface RiskCellRow {
  id: string;
  state_name: string;
  district: string;
  crop: string;
  season: string;
  event_type: RiskEvent;
  severity: RiskSeverity;
  rainfall_deviation_pct: number | null;
  affected_acres: number | null;
  affected_fpos: number;
  observed_at: string;
  source: string | null;
}

export interface WatchlistRow {
  id: string;
  insurer_tenant_id: string;
  state_name: string;
  district: string;
  crop: string;
  season: string;
  notes: string | null;
}

export interface AlertRuleRow {
  id: string;
  insurer_tenant_id: string;
  name: string;
  event_type: RiskEvent | null;
  min_severity: RiskSeverity;
  rainfall_deviation_threshold_pct: number | null;
  active: boolean;
}

export interface AlertRow {
  id: string;
  insurer_tenant_id: string;
  rule_id: string | null;
  risk_cell_id: string;
  severity: RiskSeverity;
  title: string;
  detail: string | null;
  status: AlertStatus;
  acknowledged_at: string | null;
  cell: RiskCellRow | null;
}

/* -------------------------------------------------------------- severity */

export const SEVERITY_ORDER: readonly RiskSeverity[] = ["watch", "advisory", "severe"];

export function severityAtLeast(sev: RiskSeverity, min: RiskSeverity): boolean {
  return SEVERITY_ORDER.indexOf(sev) >= SEVERITY_ORDER.indexOf(min);
}

export const SEVERITY_LABEL: Record<RiskSeverity, string> = {
  watch: "Watch",
  advisory: "Advisory",
  severe: "Severe",
};

export const EVENT_LABEL: Record<RiskEvent, string> = {
  drought: "Drought",
  excess_rain: "Excess rain",
  flood: "Flood",
  hail: "Hail",
  pest_outbreak: "Pest outbreak",
  heatwave: "Heatwave",
  cyclone: "Cyclone",
};

/* ----------------------------------------------------------- rule match */

/**
 * A rule matches a risk cell when the event type matches (or the rule is
 * event-agnostic), the cell severity meets the rule minimum, and — when the
 * rule sets a rainfall deviation threshold — the cell's absolute deviation
 * meets or exceeds it.
 */
export function ruleMatchesCell(rule: AlertRuleRow, cell: RiskCellRow): boolean {
  if (!rule.active) return false;
  if (rule.event_type && rule.event_type !== cell.event_type) return false;
  if (!severityAtLeast(cell.severity, rule.min_severity)) return false;
  if (rule.rainfall_deviation_threshold_pct != null) {
    const deviation = Math.abs(cell.rainfall_deviation_pct ?? 0);
    if (deviation < rule.rainfall_deviation_threshold_pct) return false;
  }
  return true;
}

/* ------------------------------------------------------------ alert text */

export function buildAlertTitle(cell: RiskCellRow): string {
  return `${EVENT_LABEL[cell.event_type]} — ${cell.district} (${cell.crop}, ${cell.season})`;
}

export function buildAlertDetail(cell: RiskCellRow): string {
  const parts = [
    `Severity: ${SEVERITY_LABEL[cell.severity]}`,
    cell.rainfall_deviation_pct != null
      ? `Rainfall deviation: ${Math.round(cell.rainfall_deviation_pct)}%`
      : null,
    cell.affected_acres != null
      ? `Affected acreage (aggregate): ${Math.round(cell.affected_acres).toLocaleString("en-IN")}`
      : null,
    `FPOs in signal area: ${cell.affected_fpos}`,
    "Advisory only — no claim action is triggered by this alert.",
  ];
  return parts.filter(Boolean).join(" · ");
}

/* --------------------------------------------------------- watchlist hit */

/** True when the cell falls inside any tracked watchlist entry. */
export function cellOnWatchlist(cell: RiskCellRow, watchlist: WatchlistRow[]): boolean {
  return watchlist.some(
    (w) => w.district === cell.district && w.crop === cell.crop && w.season === cell.season,
  );
}

/* ----------------------------------------------------- exposure rollup */

export interface ExposureInput {
  registration_number: string;
  fpo_name: string;
  district: string | null;
  member_count: number | null;
  insured_members: number;
  policies_count: number;
  premium_inr: number;
}

export interface DistrictExposure {
  district: string;
  fpos: number;
  members: number;
  insuredMembers: number;
  policies: number;
  premiumInr: number;
}

/**
 * Roll an insurer's FPO channel up per district so a risk cell can show the
 * insurer's own aggregate exposure there. Aggregate counts only.
 */
export function exposureByDistrict(channel: ExposureInput[]): DistrictExposure[] {
  const map = new Map<string, DistrictExposure>();
  for (const row of channel) {
    const key = row.district ?? "Unknown";
    const acc =
      map.get(key) ??
      ({ district: key, fpos: 0, members: 0, insuredMembers: 0, policies: 0, premiumInr: 0 } as DistrictExposure);
    acc.fpos += 1;
    acc.members += row.member_count ?? 0;
    acc.insuredMembers += row.insured_members;
    acc.policies += row.policies_count;
    acc.premiumInr += row.premium_inr;
    map.set(key, acc);
  }
  return [...map.values()].sort((a, b) => b.premiumInr - a.premiumInr);
}

export function exposureForDistrict(
  channel: ExposureInput[],
  district: string,
): DistrictExposure {
  return (
    exposureByDistrict(channel).find((e) => e.district === district) ?? {
      district,
      fpos: 0,
      members: 0,
      insuredMembers: 0,
      policies: 0,
      premiumInr: 0,
    }
  );
}

/* ------------------------------------------------------------- filtering */

export function filterRiskCells(
  cells: RiskCellRow[],
  filter: { state?: string; severity?: RiskSeverity | "all"; event?: RiskEvent | "all" },
): RiskCellRow[] {
  return cells.filter(
    (c) =>
      (!filter.state || c.state_name === filter.state) &&
      (!filter.severity || filter.severity === "all" || c.severity === filter.severity) &&
      (!filter.event || filter.event === "all" || c.event_type === filter.event),
  );
}

export function summarizeRisk(cells: RiskCellRow[]) {
  const severe = cells.filter((c) => c.severity === "severe").length;
  const advisory = cells.filter((c) => c.severity === "advisory").length;
  const acres = cells.reduce((s, c) => s + (c.affected_acres ?? 0), 0);
  const fpos = cells.reduce((s, c) => s + c.affected_fpos, 0);
  return { total: cells.length, severe, advisory, acres, fpos };
}
