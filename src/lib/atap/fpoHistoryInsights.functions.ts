/**
 * FPO-side history insights (B11) — server functions.
 *
 * Authority chain enforced here, in the handler:
 *  1. caller must hold a read role inside this tenant (roster authority),
 *  2. each contributing member must have an active, purpose-scoped consent row,
 *  3. only aggregates leave the server, with small cohorts suppressed,
 *  4. the read itself is audited with its purpose code.
 *
 * Member season records are owner-only under RLS, so the consented subset is
 * read with the service client strictly after steps 1–2 and strictly filtered
 * to the consented farmer ids.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  HISTORY_INSIGHTS_DISCLAIMER,
  HISTORY_INSIGHTS_PURPOSE,
  MIN_COHORT,
  aggregateCropYears,
  canViewMemberHistoryInsights,
  cohortCoverage,
  consentedFarmerIds,
  cropTrends,
  inputDemandPlan,
  procurementSignals,
  type AreaReference,
  type CohortAggregate,
  type CohortCoverage,
  type CropTrend,
  type InputDemandLine,
  type MemberSeasonRow,
  type ProcurementSignal,
} from "@/lib/atap/fpoHistoryInsights";
import type { AppRole } from "@/lib/atap/policy";

export interface MemberHistoryBoard {
  tenantId: string;
  canView: boolean;
  minCohort: number;
  disclaimer: string;
  coverage: CohortCoverage;
  aggregates: CohortAggregate[];
  trends: CropTrend[];
  demand: InputDemandLine[];
  signals: ProcurementSignal[];
  districts: string[];
  yearsCovered: number[];
  growthPct: number;
}

const EMPTY = (tenantId: string, growthPct: number): MemberHistoryBoard => ({
  tenantId,
  canView: false,
  minCohort: MIN_COHORT,
  disclaimer: HISTORY_INSIGHTS_DISCLAIMER,
  coverage: cohortCoverage({
    members: 0,
    consentedMembers: 0,
    contributingMembers: 0,
    aggregates: [],
  }),
  aggregates: [],
  trends: [],
  demand: [],
  signals: [],
  districts: [],
  yearsCovered: [],
  growthPct,
});

export const getMemberHistoryInsights = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string; growthPct?: number }) => input)
  .handler(async ({ data, context }): Promise<MemberHistoryBoard> => {
    const { supabase, userId } = context;
    const growthPct = Math.max(-50, Math.min(50, data.growthPct ?? 0));
    if (!data.tenantId) return EMPTY("", growthPct);

    /* 1 — tenant scope */
    const { resolveDistrictActor } = await import("@/lib/atap/district.server");
    const actor = await resolveDistrictActor(supabase, userId);
    const permitted =
      actor.isPlatformAdmin || actor.isAuditor || actor.tenantIds.includes(data.tenantId);
    if (!permitted) throw new Error("You do not have access to this organization");

    const roles = (
      actor.isPlatformAdmin
        ? (["platform_admin"] as AppRole[])
        : actor.tenantRoles
            .filter((r: { tenant_id: string | null }) => r.tenant_id === data.tenantId)
            .map((r: { role: AppRole }) => r.role)
    ) as AppRole[];
    if (actor.isAuditor && !roles.includes("auditor")) roles.push("auditor");

    if (!canViewMemberHistoryInsights(roles)) {
      return { ...EMPTY(data.tenantId, growthPct), canView: false };
    }

    /* 2 — consent gate */
    const [{ data: memberRows }, { data: consentRows }] = await Promise.all([
      supabase
        .from("fpo_members")
        .select("farmer_user_id, status, village_cluster")
        .eq("tenant_id", data.tenantId),
      supabase
        .from("fpo_farmer_consents")
        .select("farmer_user_id, purpose_code, revoked_at, expires_at")
        .eq("tenant_id", data.tenantId)
        .eq("purpose_code", HISTORY_INSIGHTS_PURPOSE),
    ]);

    const members = (memberRows ?? []) as Array<{
      farmer_user_id: string | null;
      status: string;
      village_cluster: string | null;
    }>;
    const memberIds = new Set(
      members.filter((m) => m.farmer_user_id).map((m) => m.farmer_user_id as string),
    );
    const consented = consentedFarmerIds(
      (consentRows ?? []) as Array<{
        farmer_user_id: string;
        purpose_code: string;
        revoked_at: string | null;
        expires_at: string | null;
      }>,
    ).filter((id) => memberIds.has(id));

    if (consented.length === 0) {
      return {
        ...EMPTY(data.tenantId, growthPct),
        canView: true,
        coverage: cohortCoverage({
          members: memberIds.size,
          consentedMembers: 0,
          contributingMembers: 0,
          aggregates: [],
        }),
      };
    }

    /* 3 — consented aggregate read (service client, ids strictly filtered) */
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const currentYear = new Date().getUTCFullYear();
    const { data: seasonRows } = await supabaseAdmin
      .from("farm_season_records")
      .select(
        "farmer_user_id, crop_year, season_code, crop, area_acres, input_cost_total, yield_quintal, revenue_inr",
      )
      .in("farmer_user_id", consented)
      .gte("crop_year", currentYear - 4);

    const rows: MemberSeasonRow[] = ((seasonRows ?? []) as Array<Record<string, unknown>>).map(
      (r) => ({
        farmer_user_id: r["farmer_user_id"] as string,
        crop_year: Number(r["crop_year"]),
        season_code: r["season_code"] as string,
        crop: r["crop"] as string,
        area_acres: Number(r["area_acres"] ?? 0),
        input_cost_total: Number(r["input_cost_total"] ?? 0),
        yield_quintal: r["yield_quintal"] === null ? null : Number(r["yield_quintal"]),
        revenue_inr: r["revenue_inr"] === null ? null : Number(r["revenue_inr"]),
      }),
    );

    const aggregates = aggregateCropYears(rows);
    const trends = cropTrends(aggregates);
    const demand = inputDemandPlan(aggregates, { growthPct });

    /* district reference figures — aggregate public data only */
    const districts = [
      ...new Set(members.map((m) => m.village_cluster).filter((v): v is string => Boolean(v))),
    ].sort();

    let references: AreaReference[] = [];
    if (trends.length > 0) {
      const { data: benchmarks } = await supabase
        .from("area_crop_benchmarks")
        .select("crop, typical_yield_quintal_per_acre, typical_price_per_quintal, crop_year")
        .in(
          "crop",
          trends.map((t) => t.crop),
        )
        .gte("crop_year", currentYear - 4);
      const grouped = new Map<string, { yields: number[]; prices: number[] }>();
      for (const b of (benchmarks ?? []) as Array<Record<string, unknown>>) {
        const crop = b["crop"] as string;
        const entry = grouped.get(crop) ?? { yields: [], prices: [] };
        entry.yields.push(Number(b["typical_yield_quintal_per_acre"] ?? 0));
        entry.prices.push(Number(b["typical_price_per_quintal"] ?? 0));
        grouped.set(crop, entry);
      }
      const avg = (list: number[]) =>
        list.length ? Math.round((list.reduce((a, b) => a + b, 0) / list.length) * 100) / 100 : 0;
      references = [...grouped.entries()].map(([crop, v]) => ({
        crop,
        avgYieldPerAcre: avg(v.yields),
        avgPricePerQuintal: avg(v.prices),
      }));
    }

    const signals = procurementSignals(trends, references);
    const contributing = new Set(rows.map((r) => r.farmer_user_id)).size;

    /* 4 — audit the purpose-scoped aggregate read */
    const { writeAuditRow } = await import("@/lib/atap/onboarding.server");
    await writeAuditRow(supabase, {
      actor_user_id: userId,
      tenant_id: data.tenantId,
      action: "fpo.member_history.aggregate_read",
      subject_type: "fpo_members",
      subject_id: data.tenantId,
      decision: "allow",
      purpose_code: HISTORY_INSIGHTS_PURPOSE,
      metadata: {
        consented_members: consented.length,
        contributing_members: contributing,
        cohorts: aggregates.length,
        suppressed_cohorts: aggregates.filter((a) => a.suppressed).length,
        min_cohort: MIN_COHORT,
      },
    });

    return {
      tenantId: data.tenantId,
      canView: true,
      minCohort: MIN_COHORT,
      disclaimer: HISTORY_INSIGHTS_DISCLAIMER,
      coverage: cohortCoverage({
        members: memberIds.size,
        consentedMembers: consented.length,
        contributingMembers: contributing,
        aggregates,
      }),
      aggregates,
      trends,
      demand,
      signals,
      districts,
      yearsCovered: [...new Set(aggregates.map((a) => a.crop_year))].sort((a, b) => b - a),
      growthPct,
    };
  });
