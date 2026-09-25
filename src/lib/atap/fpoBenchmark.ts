/**
 * FPO performance comparison — pure scoring logic.
 * Scores are best-practice adoption indices (0–100). Advisory only; they
 * never decide funding, loans or grades for any FPO.
 */

export const BENCHMARK_MEASURES = [
  { key: "financial_discipline", label: "Financial discipline", weight: 0.2, hint: "Vouchers approved on time, books reconciled, audits filed" },
  { key: "scheme_coverage", label: "Scheme coverage", weight: 0.2, hint: "Share of eligible schemes actually applied for" },
  { key: "best_practices", label: "Best practice adoption", weight: 0.2, hint: "Members following recommended farm practices" },
  { key: "loan_repayment", label: "Member loan repayment", weight: 0.2, hint: "Loans and input credit repaid on schedule" },
  { key: "governance", label: "Governance", weight: 0.1, hint: "Board meetings, AGM, statutory filings" },
  { key: "member_engagement", label: "Member engagement", weight: 0.1, hint: "Active members in trainings and collective sales" },
] as const;

export type MeasureKey = (typeof BENCHMARK_MEASURES)[number]["key"];

export const BENCHMARK_DISCLAIMER =
  "Sample scores for comparison and learning only. They do not decide grants, loans or ratings.";

export type ScoreRow = { fpo_name: string; period: string; members: number } & Record<MeasureKey, number>;

export function overallScore(row: Record<MeasureKey, number>): number {
  const total = BENCHMARK_MEASURES.reduce((s, m) => s + Number(row[m.key] ?? 0) * m.weight, 0);
  return Math.round(total * 10) / 10;
}

export function band(score: number): "leading" | "on_track" | "needs_support" {
  if (score >= 75) return "leading";
  if (score >= 55) return "on_track";
  return "needs_support";
}

export const BAND_LABEL = { leading: "Leading", on_track: "On track", needs_support: "Needs support" } as const;

/** Rank rows by overall score (1 = best). */
export function rankRows<T extends Record<MeasureKey, number>>(rows: T[]): Array<T & { overall: number; rank: number }> {
  return rows
    .map((r) => ({ ...r, overall: overallScore(r) }))
    .sort((a, b) => b.overall - a.overall)
    .map((r, i) => ({ ...r, rank: i + 1 }));
}

export function peerAverage(rows: Array<Record<MeasureKey, number>>, key: MeasureKey): number {
  if (rows.length === 0) return 0;
  return Math.round((rows.reduce((s, r) => s + Number(r[key]), 0) / rows.length) * 10) / 10;
}

/** Weakest measures versus peer average — where to focus next. */
export function focusAreas(own: Record<MeasureKey, number>, peers: Array<Record<MeasureKey, number>>, n = 2) {
  return BENCHMARK_MEASURES.map((m) => ({ key: m.key, label: m.label, gap: Number(own[m.key]) - peerAverage(peers, m.key) }))
    .sort((a, b) => a.gap - b.gap)
    .slice(0, n);
}
