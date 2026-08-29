/**
 * Season planning (B11) — pure logic.
 *
 * Turns the farmer's own recorded history plus district reference figures into
 * an advisory plan for the coming season: candidate crops, an input budget
 * drawn from the farmer's own cost history, and plain-language reasons.
 *
 * Advisory only. Nothing here approves credit, insurance or a scheme benefit,
 * and no candidate is presented as a guaranteed outcome.
 */
import {
  COST_HEADS,
  seasonEconomics,
  type AreaCropView,
  type CostBreakdown,
  type CostHead,
  type SeasonRecord,
} from "@/lib/atap/farmHistory";

export const PLANNING_DISCLAIMER =
  "Indicative planning figures built from your own recorded seasons and district reference data. Yields and prices vary with weather, pests and market conditions — this is not a guarantee, and no loan, insurance or scheme decision is made here.";

const round2 = (n: number) => Math.round(n * 100) / 100;
const round0 = (n: number) => Math.round(n);

/* ------------------------------------------------------------- candidates */

export type PlanConfidence = "own_history" | "own_and_area" | "area_only";

export interface CropCandidate {
  crop: string;
  score: number;
  expectedYieldPerAcre: number;
  expectedPricePerQuintal: number;
  expectedCostPerAcre: number;
  expectedGrossPerAcre: number;
  expectedNetPerAcre: number;
  ownSeasons: number;
  areaAdoptionShare: number;
  confidence: PlanConfidence;
  reasons: string[];
}

function ownAverages(records: readonly SeasonRecord[], crop: string) {
  const mine = records.filter((r) => r.crop.trim().toLowerCase() === crop.trim().toLowerCase());
  const eco = mine.map((r) => seasonEconomics(r));
  const yields = eco.map((e) => e.yieldPerAcre).filter((v): v is number => typeof v === "number");
  const costs = eco.map((e) => e.costPerAcre).filter((v): v is number => typeof v === "number");
  const prices = mine
    .map((r) => r.price_per_quintal)
    .filter((v): v is number => typeof v === "number" && v > 0);
  const avg = (list: readonly number[]) =>
    list.length ? round2(list.reduce((a, b) => a + b, 0) / list.length) : null;
  return {
    seasons: mine.length,
    yieldPerAcre: avg(yields),
    costPerAcre: avg(costs),
    pricePerQuintal: avg(prices),
  };
}

/**
 * Builds scored candidates for the coming season. Own history is weighted
 * higher than area typicals, because the farmer's own field record is the more
 * reliable signal for their own plots.
 */
export function planCandidates(input: {
  history: readonly SeasonRecord[];
  areaCrops: readonly AreaCropView[];
  limit?: number;
}): CropCandidate[] {
  const candidates: CropCandidate[] = input.areaCrops.map((view) => {
    const own = ownAverages(input.history, view.crop);
    const expectedYield = own.yieldPerAcre ?? view.avgYieldPerAcre;
    const expectedPrice = own.pricePerQuintal ?? view.avgPricePerQuintal;
    const expectedCost = own.costPerAcre ?? view.avgCostPerAcre;
    const gross = round2(expectedYield * expectedPrice);
    const net = round2(gross - expectedCost);

    const confidence: PlanConfidence =
      own.seasons >= 2 ? "own_history" : own.seasons === 1 ? "own_and_area" : "area_only";

    const reasons: string[] = [];
    if (own.seasons > 0) {
      reasons.push(`You recorded ${own.seasons} season(s) of ${view.crop}.`);
    } else {
      reasons.push(`No history of your own for ${view.crop} — figures come from district averages.`);
    }
    if (own.yieldPerAcre !== null && view.avgYieldPerAcre > 0) {
      const gap = round2(((own.yieldPerAcre - view.avgYieldPerAcre) / view.avgYieldPerAcre) * 100);
      reasons.push(
        gap >= 0
          ? `Your yield ran ${gap}% above the district average.`
          : `Your yield ran ${Math.abs(gap)}% below the district average.`,
      );
    }
    if (view.adoptionShare >= 15) {
      reasons.push(`Widely grown in your district (${view.adoptionShare}% of area).`);
    }
    if (net <= 0) {
      reasons.push("Indicative margin is thin or negative at these reference prices.");
    }

    // Score: margin per acre normalised, plus a bonus for own experience and
    // local adoption (proxy for input/market availability).
    const marginScore = Math.max(0, net) / 1000;
    const experienceBonus = own.seasons >= 2 ? 12 : own.seasons === 1 ? 6 : 0;
    const adoptionBonus = Math.min(10, view.adoptionShare / 4);

    return {
      crop: view.crop,
      score: round2(marginScore + experienceBonus + adoptionBonus),
      expectedYieldPerAcre: expectedYield,
      expectedPricePerQuintal: expectedPrice,
      expectedCostPerAcre: expectedCost,
      expectedGrossPerAcre: gross,
      expectedNetPerAcre: net,
      ownSeasons: own.seasons,
      areaAdoptionShare: view.adoptionShare,
      confidence,
      reasons,
    } satisfies CropCandidate;
  });

  return candidates
    .sort((a, b) => b.score - a.score || b.expectedNetPerAcre - a.expectedNetPerAcre)
    .slice(0, input.limit ?? 6);
}

/* ----------------------------------------------------------------- budget */

export interface BudgetLine {
  head: CostHead;
  perAcre: number;
  total: number;
}

export interface SeasonBudget {
  crop: string;
  acres: number;
  basis: "own_history" | "area_benchmark";
  lines: BudgetLine[];
  costPerAcre: number;
  totalCost: number;
  expectedGross: number;
  expectedNet: number;
  breakEvenYieldPerAcre: number | null;
  breakEvenPricePerQuintal: number | null;
}

const DEFAULT_SHARES: Record<CostHead, number> = {
  seed: 0.14,
  fertiliser: 0.25,
  protection: 0.16,
  labour: 0.27,
  machinery: 0.13,
  other: 0.05,
};

function ownCostShares(records: readonly SeasonRecord[], crop: string): CostBreakdown | null {
  const mine = records.filter(
    (r) => r.crop.trim().toLowerCase() === crop.trim().toLowerCase() && r.area_acres > 0,
  );
  if (mine.length === 0) return null;
  const totals: Partial<Record<CostHead, number>> = {};
  let acres = 0;
  let any = false;
  for (const record of mine) {
    acres += record.area_acres;
    for (const head of COST_HEADS) {
      const value = record.input_costs[head];
      if (typeof value === "number" && value > 0) {
        totals[head] = (totals[head] ?? 0) + value;
        any = true;
      }
    }
  }
  if (!any || acres === 0) return null;
  const perAcre: CostBreakdown = {};
  for (const head of COST_HEADS) {
    const value = totals[head];
    if (value) perAcre[head] = round2(value / acres);
  }
  return perAcre;
}

/**
 * Builds the input budget for a chosen crop and acreage. Head-wise splits come
 * from the farmer's own cost entries when available, otherwise from the
 * district cost per acre distributed over standard heads.
 */
export function buildSeasonBudget(input: {
  crop: string;
  acres: number;
  history: readonly SeasonRecord[];
  candidate: Pick<
    CropCandidate,
    "expectedCostPerAcre" | "expectedYieldPerAcre" | "expectedPricePerQuintal"
  >;
}): SeasonBudget {
  const acres = input.acres > 0 ? input.acres : 1;
  const own = ownCostShares(input.history, input.crop);

  let lines: BudgetLine[];
  let basis: SeasonBudget["basis"];
  if (own) {
    basis = "own_history";
    lines = COST_HEADS.flatMap((head) => {
      const perAcre = own[head];
      if (!perAcre) return [];
      return [{ head, perAcre: round2(perAcre), total: round0(perAcre * acres) }];
    });
  } else {
    basis = "area_benchmark";
    lines = COST_HEADS.map((head) => {
      const perAcre = round2(input.candidate.expectedCostPerAcre * DEFAULT_SHARES[head]);
      return { head, perAcre, total: round0(perAcre * acres) };
    });
  }

  const costPerAcre = round2(lines.reduce((sum, l) => sum + l.perAcre, 0));
  const totalCost = round0(costPerAcre * acres);
  const expectedGross = round0(
    input.candidate.expectedYieldPerAcre * input.candidate.expectedPricePerQuintal * acres,
  );

  return {
    crop: input.crop,
    acres: round2(acres),
    basis,
    lines,
    costPerAcre,
    totalCost,
    expectedGross,
    expectedNet: round0(expectedGross - totalCost),
    breakEvenYieldPerAcre:
      input.candidate.expectedPricePerQuintal > 0
        ? round2(costPerAcre / input.candidate.expectedPricePerQuintal)
        : null,
    breakEvenPricePerQuintal:
      input.candidate.expectedYieldPerAcre > 0
        ? round2(costPerAcre / input.candidate.expectedYieldPerAcre)
        : null,
  };
}

/* ------------------------------------------------------------------ risks */

export interface PlanRisk {
  code: string;
  severity: "info" | "watch" | "high";
  message: string;
}

export function planRisks(input: {
  candidate: CropCandidate;
  budget: SeasonBudget;
  areaView: AreaCropView | null;
  insuranceCovered: boolean;
}): PlanRisk[] {
  const risks: PlanRisk[] = [];

  if (input.candidate.confidence === "area_only") {
    risks.push({
      code: "no_own_history",
      severity: "watch",
      message: `You have not recorded ${input.candidate.crop} before, so every figure here is a district average. Start small or talk to your extension officer.`,
    });
  }

  if (input.areaView) {
    const [low, high] = input.areaView.priceBand;
    if (high > 0 && low > 0 && (high - low) / low > 0.25) {
      risks.push({
        code: "price_volatility",
        severity: "watch",
        message: `District prices for ${input.candidate.crop} moved between ₹${Math.round(low)} and ₹${Math.round(high)} per quintal over the last five years — plan for the lower end.`,
      });
    }
    const worstCaseGross =
      input.areaView.yieldBand[0] * low * input.budget.acres;
    if (worstCaseGross < input.budget.totalCost) {
      risks.push({
        code: "downside_below_cost",
        severity: "high",
        message: "In a low-yield, low-price year this plan does not cover its own input cost.",
      });
    }
  }

  if (!input.insuranceCovered) {
    risks.push({
      code: "no_cover",
      severity: "watch",
      message: "No active crop cover is recorded for you. Check the insurance corner before sowing; enrolment is decided by the authorised insurer/officer.",
    });
  }

  if (input.budget.basis === "area_benchmark") {
    risks.push({
      code: "budget_from_area",
      severity: "info",
      message: "Input budget is split using standard district shares because your own cost entries for this crop are missing.",
    });
  }

  return risks;
}

/* ------------------------------------------------------------- saved plans */

export interface SavedPlanSnapshot {
  crop: string;
  season_code: string;
  crop_year: number;
  acres: number;
  budget: SeasonBudget;
  candidate: CropCandidate;
  risks: PlanRisk[];
  disclaimer: string;
  advisory_only: true;
}

export function planSnapshot(input: {
  crop: string;
  seasonCode: string;
  cropYear: number;
  acres: number;
  budget: SeasonBudget;
  candidate: CropCandidate;
  risks: readonly PlanRisk[];
}): SavedPlanSnapshot {
  return {
    crop: input.crop,
    season_code: input.seasonCode,
    crop_year: input.cropYear,
    acres: round2(input.acres),
    budget: input.budget,
    candidate: input.candidate,
    risks: [...input.risks],
    disclaimer: PLANNING_DISCLAIMER,
    advisory_only: true,
  };
}
