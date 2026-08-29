/**
 * FPO-side history insights (B11) — pure logic.
 *
 * An FPO can plan input demand and procurement from member cropping history,
 * but membership authority is NOT farmer-data authority:
 *
 *  - Only members with an active, purpose-scoped consent row contribute.
 *  - Output is aggregate-only. Any cohort smaller than MIN_COHORT is suppressed
 *    so a single member's economics can never be reconstructed.
 *  - Nothing here decides eligibility, price or a benefit; it is planning input
 *    for the FPO's authorised staff.
 */
import type { AppRole } from "@/lib/atap/policy";

export const HISTORY_INSIGHTS_PURPOSE = "fpo_member_management";

export const MIN_COHORT = 5;

export const HISTORY_INSIGHTS_DISCLAIMER =
  "Aggregate planning view built only from members who gave an active membership & farm-planning authorization. Groups with fewer than 5 contributing members are suppressed, and no individual farmer figures are shown. Advisory only — procurement, credit and scheme decisions stay with the authorised role.";

const READ_ROLES: AppRole[] = [
  "platform_admin",
  "auditor",
  "tenant_admin",
  "onboarding_officer",
  "field_agent",
];

export function canViewMemberHistoryInsights(roles: readonly AppRole[]): boolean {
  return roles.some((r) => READ_ROLES.includes(r));
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const round0 = (n: number) => Math.round(n);

/* ------------------------------------------------------------- consent gate */

export interface ConsentRowLike {
  farmer_user_id: string;
  purpose_code: string;
  revoked_at: string | null;
  expires_at: string | null;
}

/** Default-deny: only unrevoked, unexpired rows for the exact purpose count. */
export function consentedFarmerIds(
  consents: readonly ConsentRowLike[],
  purposeCode: string = HISTORY_INSIGHTS_PURPOSE,
  now: Date = new Date(),
): string[] {
  const ids = new Set<string>();
  for (const c of consents) {
    if (c.purpose_code !== purposeCode) continue;
    if (c.revoked_at) continue;
    if (c.expires_at && new Date(c.expires_at).getTime() <= now.getTime()) continue;
    ids.add(c.farmer_user_id);
  }
  return [...ids].sort();
}

/* ------------------------------------------------------------- aggregation */

export interface MemberSeasonRow {
  farmer_user_id: string;
  crop_year: number;
  season_code: string;
  crop: string;
  area_acres: number;
  input_cost_total: number;
  input_costs?: Record<string, number>;
  yield_quintal: number | null;
  revenue_inr: number | null;
}

export interface CohortAggregate {
  crop: string;
  crop_year: number;
  members: number;
  acres: number;
  avgYieldPerAcre: number | null;
  avgCostPerAcre: number | null;
  avgRevenuePerAcre: number | null;
  avgNetPerAcre: number | null;
  suppressed: boolean;
}

/**
 * Crop × year aggregates over consented member rows. Suppressed cohorts keep
 * their label but drop every economic value.
 */
export function aggregateCropYears(
  rows: readonly MemberSeasonRow[],
  minCohort: number = MIN_COHORT,
): CohortAggregate[] {
  const buckets = new Map<
    string,
    {
      crop: string;
      crop_year: number;
      members: Set<string>;
      acres: number;
      yieldQtl: number;
      yieldAcres: number;
      cost: number;
      revenue: number;
      revenueAcres: number;
    }
  >();

  for (const row of rows) {
    const k = `${row.crop.trim().toLowerCase()}|${row.crop_year}`;
    const bucket =
      buckets.get(k) ??
      {
        crop: row.crop,
        crop_year: row.crop_year,
        members: new Set<string>(),
        acres: 0,
        yieldQtl: 0,
        yieldAcres: 0,
        cost: 0,
        revenue: 0,
        revenueAcres: 0,
      };
    bucket.members.add(row.farmer_user_id);
    bucket.acres += row.area_acres || 0;
    bucket.cost += row.input_cost_total || 0;
    if (row.yield_quintal !== null && row.area_acres > 0) {
      bucket.yieldQtl += row.yield_quintal;
      bucket.yieldAcres += row.area_acres;
    }
    if (row.revenue_inr !== null && row.area_acres > 0) {
      bucket.revenue += row.revenue_inr;
      bucket.revenueAcres += row.area_acres;
    }
    buckets.set(k, bucket);
  }

  return [...buckets.values()]
    .map((b) => {
      const members = b.members.size;
      const suppressed = members < minCohort;
      const costPerAcre = b.acres > 0 ? round0(b.cost / b.acres) : null;
      const revenuePerAcre = b.revenueAcres > 0 ? round0(b.revenue / b.revenueAcres) : null;
      return {
        crop: b.crop,
        crop_year: b.crop_year,
        members,
        acres: suppressed ? 0 : round2(b.acres),
        avgYieldPerAcre: suppressed || b.yieldAcres === 0 ? null : round2(b.yieldQtl / b.yieldAcres),
        avgCostPerAcre: suppressed ? null : costPerAcre,
        avgRevenuePerAcre: suppressed ? null : revenuePerAcre,
        avgNetPerAcre:
          suppressed || revenuePerAcre === null || costPerAcre === null
            ? null
            : round0(revenuePerAcre - costPerAcre),
        suppressed,
      } satisfies CohortAggregate;
    })
    .sort((a, b) => b.crop_year - a.crop_year || a.crop.localeCompare(b.crop));
}

export type CohortTrend = "improving" | "flat" | "declining" | "insufficient_data";

export interface CropTrend {
  crop: string
  years: number;
  latestYear: number | null;
  avgYieldPerAcre: number | null;
  avgNetPerAcre: number | null;
  acres: number;
  trend: CohortTrend;
}

export function cropTrends(aggregates: readonly CohortAggregate[]): CropTrend[] {
  const grouped = new Map<string, CohortAggregate[]>();
  for (const agg of aggregates) {
    if (agg.suppressed) continue;
    const list = grouped.get(agg.crop) ?? [];
    list.push(agg);
    grouped.set(agg.crop, list);
  }

  return [...grouped.entries()]
    .map(([crop, list]) => {
      const ordered = [...list].sort((a, b) => a.crop_year - b.crop_year);
      const yields = ordered
        .map((r) => r.avgYieldPerAcre)
        .filter((v): v is number => typeof v === "number");
      const nets = ordered
        .map((r) => r.avgNetPerAcre)
        .filter((v): v is number => typeof v === "number");
      const avg = (list2: readonly number[]) =>
        list2.length ? round2(list2.reduce((a, b) => a + b, 0) / list2.length) : null;

      let trend: CohortTrend = "insufficient_data";
      if (yields.length >= 2) {
        const first = yields[0]!;
        const last = yields[yields.length - 1]!;
        const deltaPct = first === 0 ? 0 : ((last - first) / first) * 100;
        trend = deltaPct > 5 ? "improving" : deltaPct < -5 ? "declining" : "flat";
      }

      return {
        crop,
        years: ordered.length,
        latestYear: ordered[ordered.length - 1]?.crop_year ?? null,
        avgYieldPerAcre: avg(yields),
        avgNetPerAcre: avg(nets),
        acres: round2(ordered.reduce((sum, r) => sum + r.acres, 0)),
        trend,
      } satisfies CropTrend;
    })
    .sort((a, b) => b.acres - a.acres);
}

/* --------------------------------------------------------- input demand plan */

export interface InputDemandLine {
  crop: string;
  /** Acres the cohort actually recorded in the reference year(s). */
  observedAcres: number;
  projectedAcres: number;
  indicativeCostPerAcre: number | null;
  indicativeBudget: number | null;
  contributingMembers: number;
  basis: "member_history" | "insufficient_cohort";
}

/**
 * Projects next-season input demand from the most recent consented cohort year.
 * `growthPct` is a planning assumption supplied by FPO staff, never inferred.
 */
export function inputDemandPlan(
  aggregates: readonly CohortAggregate[],
  options: { growthPct?: number } = {},
): InputDemandLine[] {
  const growth = 1 + (options.growthPct ?? 0) / 100;
  const latestByCrop = new Map<string, CohortAggregate>();
  for (const agg of aggregates) {
    const current = latestByCrop.get(agg.crop);
    if (!current || agg.crop_year > current.crop_year) latestByCrop.set(agg.crop, agg);
  }

  return [...latestByCrop.values()]
    .map((agg) => ({
      crop: agg.crop,
      observedAcres: agg.acres,
      projectedAcres: agg.suppressed ? 0 : round2(agg.acres * growth),
      indicativeCostPerAcre: agg.avgCostPerAcre,
      indicativeBudget:
        agg.suppressed || agg.avgCostPerAcre === null
          ? null
          : round0(agg.acres * growth * agg.avgCostPerAcre),
      contributingMembers: agg.members,
      basis: agg.suppressed ? ("insufficient_cohort" as const) : ("member_history" as const),
    }))
    .sort((a, b) => b.projectedAcres - a.projectedAcres);
}

/* -------------------------------------------------------- procurement signal */

export interface AreaReference {
  crop: string;
  avgYieldPerAcre: number;
  avgPricePerQuintal: number;
}

export interface ProcurementSignal {
  crop: string;
  cohortYieldPerAcre: number | null;
  areaYieldPerAcre: number | null;
  yieldGapPct: number | null;
  indicativeVolumeQuintal: number | null;
  signal: "aggregation_opportunity" | "yield_support_needed" | "steady" | "not_enough_data";
  note: string;
}

export function procurementSignals(
  trends: readonly CropTrend[],
  references: readonly AreaReference[],
): ProcurementSignal[] {
  const refByCrop = new Map(references.map((r) => [r.crop.trim().toLowerCase(), r]));

  return trends.map((t) => {
    const ref = refByCrop.get(t.crop.trim().toLowerCase()) ?? null;
    const gapPct =
      ref && ref.avgYieldPerAcre > 0 && t.avgYieldPerAcre !== null
        ? round2(((t.avgYieldPerAcre - ref.avgYieldPerAcre) / ref.avgYieldPerAcre) * 100)
        : null;
    const volume =
      t.avgYieldPerAcre !== null && t.acres > 0 ? round2(t.avgYieldPerAcre * t.acres) : null;

    let signal: ProcurementSignal["signal"] = "not_enough_data";
    let note = "Not enough consented member history for this crop yet.";
    if (t.avgYieldPerAcre !== null) {
      if (gapPct !== null && gapPct <= -10) {
        signal = "yield_support_needed";
        note = `Cohort yield is ${Math.abs(gapPct)}% below the district reference — consider advisory or input quality follow-up.`;
      } else if (volume !== null && volume >= 100) {
        signal = "aggregation_opportunity";
        note = `About ${volume} quintal of consented member volume — enough to plan an aggregated sale or RFQ.`;
      } else {
        signal = "steady";
        note = "Cohort is tracking the district reference; keep monitoring.";
      }
    }

    return {
      crop: t.crop,
      cohortYieldPerAcre: t.avgYieldPerAcre,
      areaYieldPerAcre: ref?.avgYieldPerAcre ?? null,
      yieldGapPct: gapPct,
      indicativeVolumeQuintal: volume,
      signal,
      note,
    } satisfies ProcurementSignal;
  });
}

/* ------------------------------------------------------------------ coverage */

export interface CohortCoverage {
  members: number;
  consentedMembers: number;
  contributingMembers: number;
  coveragePct: number;
  suppressedCohorts: number;
  message: string;
}

export function cohortCoverage(input: {
  members: number;
  consentedMembers: number;
  contributingMembers: number;
  aggregates: readonly CohortAggregate[];
}): CohortCoverage {
  const coveragePct =
    input.members > 0 ? round0((input.contributingMembers / input.members) * 100) : 0;
  const suppressedCohorts = input.aggregates.filter((a) => a.suppressed).length;
  const message =
    input.contributingMembers === 0
      ? "No member has both an active authorization and recorded season history yet, so no aggregate can be shown."
      : `${input.contributingMembers} of ${input.members} members contribute history under an active authorization (${coveragePct}% coverage).`;
  return {
    members: input.members,
    consentedMembers: input.consentedMembers,
    contributingMembers: input.contributingMembers,
    coveragePct,
    suppressedCohorts,
    message,
  };
}
