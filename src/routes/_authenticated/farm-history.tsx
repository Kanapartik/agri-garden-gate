import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/atap/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  deleteFarmSeason,
  getFarmHistoryWorkspace,
  saveFarmSeason,
} from "@/lib/atap/farmHistory.functions";
import {
  COST_HEADS,
  COST_HEAD_LABEL,
  COVER_LABEL,
  SEASON_CODES,
  SEASON_LABEL,
  seasonEconomics,
  totalCost,
  type CostBreakdown,
  type CostHead,
} from "@/lib/atap/farmHistory";
import {
  PLANNING_DISCLAIMER,
  buildSeasonBudget,
  planCandidates,
  planRisks,
  planSnapshot,
} from "@/lib/atap/seasonPlanning";
import {
  deleteSeasonPlan,
  listSeasonPlans,
  saveSeasonPlan,
} from "@/lib/atap/seasonPlanning.functions";

const TITLE = "My farm history & command centre — AgriGhar ATAP";
const DESCRIPTION =
  "Five years of your own crops, input costs, yields and income next to district averages, your crop-insurance indicators and the drone, machinery and post-harvest services near you.";

export const Route = createFileRoute("/_authenticated/farm-history")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: FarmHistoryPage,
  errorComponent: () => (
    <main className="mx-auto max-w-3xl px-6 py-20 text-sm text-muted-foreground">
      Your farm history could not be loaded. Try refreshing.
    </main>
  ),
});

const inr = (value: number | null | undefined) =>
  value === null || value === undefined
    ? "—"
    : `₹${Math.round(value).toLocaleString("en-IN")}`;

const qtl = (value: number | null | undefined) =>
  value === null || value === undefined ? "—" : `${value.toLocaleString("en-IN")} qtl`;

const SERVICE_LABEL: Record<string, string> = {
  drone_service: "Drone / spraying",
  farm_machinery: "Machinery hiring",
  soil_lab: "Soil testing lab",
  chc: "Custom hiring centre",
  warehouse: "Warehouse",
  cold_storage: "Cold storage",
  processor: "Processing unit",
  logistics: "Logistics",
  kvk: "KVK / extension",
  fpo: "FPO",
  extension_centre: "Extension centre",
};

type Tab = "overview" | "history" | "area" | "plan" | "insurance" | "services";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "overview", label: "Command centre" },
  { id: "history", label: "My 5-year history" },
  { id: "area", label: "What my area grows" },
  { id: "plan", label: "Next season plan" },
  { id: "insurance", label: "Insurance corner" },
  { id: "services", label: "Services near me" },
];

interface DraftState {
  id?: string;
  crop_year: string;
  season_code: string;
  crop: string;
  area_acres: string;
  yield_quintal: string;
  price_per_quintal: string;
  farm_id: string;
  notes: string;
  costs: Record<CostHead, string>;
}

function emptyDraft(year: number, season: string, crop: string): DraftState {
  return {
    crop_year: String(year),
    season_code: season,
    crop,
    area_acres: "",
    yield_quintal: "",
    price_per_quintal: "",
    farm_id: "",
    notes: "",
    costs: COST_HEADS.reduce(
      (acc, head) => ({ ...acc, [head]: "" }),
      {} as Record<CostHead, string>,
    ),
  };
}

function Stat({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-bold tabular-nums">{value}</p>
      {helper ? <p className="mt-1 text-xs text-muted-foreground">{helper}</p> : null}
    </div>
  );
}

function FarmHistoryPage() {
  const queryClient = useQueryClient();
  const fetchWorkspace = useServerFn(getFarmHistoryWorkspace);
  const saveSeason = useServerFn(saveFarmSeason);
  const removeSeason = useServerFn(deleteFarmSeason);

  const [tab, setTab] = useState<Tab>("overview");
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [serviceKind, setServiceKind] = useState<string>("all");
  const [planCrop, setPlanCrop] = useState<string>("");
  const [planAcres, setPlanAcres] = useState<string>("");
  const [planParcel, setPlanParcel] = useState<string>("");

  const workspace = useQuery({
    queryKey: ["atap", "farm-history"],
    queryFn: () => fetchWorkspace(),
  });

  const data = workspace.data;

  const saveMutation = useMutation({
    mutationFn: async (input: DraftState) => {
      const costs: CostBreakdown = {};
      for (const head of COST_HEADS) {
        const value = Number(input.costs[head]);
        if (Number.isFinite(value) && value > 0) costs[head] = value;
      }
      return saveSeason({
        data: {
          ...(input.id ? { id: input.id } : {}),
          farm_id: input.farm_id || null,
          crop_year: Number(input.crop_year),
          season_code: input.season_code,
          crop: input.crop,
          area_acres: Number(input.area_acres) || 0,
          input_costs: costs,
          yield_quintal: Number(input.yield_quintal) || null,
          price_per_quintal: Number(input.price_per_quintal) || null,
          notes: input.notes || null,
        },
      });
    },
    onSuccess: async () => {
      toast.success("Season saved");
      setDraft(null);
      await queryClient.invalidateQueries({ queryKey: ["atap", "farm-history"] });
    },
    onError: () => toast.error("Could not save this season"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => removeSeason({ data: { id } }),
    onSuccess: async () => {
      toast.success("Season removed");
      await queryClient.invalidateQueries({ queryKey: ["atap", "farm-history"] });
    },
    onError: () => toast.error("Could not remove this season"),
  });

  const fetchPlans = useServerFn(listSeasonPlans);
  const savePlan = useServerFn(saveSeasonPlan);
  const removePlan = useServerFn(deleteSeasonPlan);

  const plans = useQuery({
    queryKey: ["atap", "season-plans"],
    queryFn: () => fetchPlans(),
  });

  const savePlanMutation = useMutation({
    mutationFn: (input: Parameters<typeof savePlan>[0]) => savePlan(input),
    onSuccess: async () => {
      toast.success("Advisory plan saved");
      await queryClient.invalidateQueries({ queryKey: ["atap", "season-plans"] });
    },
    onError: (e: Error) => toast.error(e.message || "Could not save this plan"),
  });

  const deletePlanMutation = useMutation({
    mutationFn: (planId: string) => removePlan({ data: { planId } }),
    onSuccess: async () => {
      toast.success("Plan removed");
      await queryClient.invalidateQueries({ queryKey: ["atap", "season-plans"] });
    },
    onError: () => toast.error("Could not remove this plan"),
  });

  const candidates = useMemo(
    () =>
      data
        ? planCandidates({ history: data.seasons, areaCrops: data.areaCrops, limit: 6 })
        : [],
    [data],
  );

  const activeCandidate = useMemo(
    () => candidates.find((c) => c.crop === planCrop) ?? candidates[0] ?? null,
    [candidates, planCrop],
  );

  const planBudget = useMemo(() => {
    if (!data || !activeCandidate) return null;
    const acres = Number(planAcres) || data.totalAcres || 1;
    return buildSeasonBudget({
      crop: activeCandidate.crop,
      acres,
      history: data.seasons,
      candidate: activeCandidate,
    });
  }, [data, activeCandidate, planAcres]);

  const planWarnings = useMemo(() => {
    if (!data || !activeCandidate || !planBudget) return [];
    return planRisks({
      candidate: activeCandidate,
      budget: planBudget,
      areaView: data.areaCrops.find((c) => c.crop === activeCandidate.crop) ?? null,
      insuranceCovered: data.insurance.coverState === "covered",
    });
  }, [data, activeCandidate, planBudget]);

  const seasonsSorted = useMemo(
    () =>
      [...(data?.seasons ?? [])].sort(
        (a, b) => b.crop_year - a.crop_year || a.season_code.localeCompare(b.season_code),
      ),
    [data?.seasons],
  );

  const filteredServices = useMemo(
    () =>
      (data?.services ?? []).filter((s) => serviceKind === "all" || s.kind === serviceKind),
    [data?.services, serviceKind],
  );

  const scaleTone =
    data?.scale.scale === "large"
      ? "default"
      : data?.scale.scale === "medium"
        ? "secondary"
        : "outline";

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Farmer command centre"
        title="My farm history"
        description="Your own crops, costs, yields and income for the last five years — compared with what your district typically achieves, plus insurance indicators and field services near you. Everything here is advisory; approvals stay with the authorised officer."
        actions={
          data ? (
            <div className="flex items-center gap-2">
              <Badge variant={scaleTone}>{data.scale.label}</Badge>
              <Button
                onClick={() =>
                  setDraft(
                    emptyDraft(
                      data.currentYear,
                      data.currentSeason,
                      data.cropOptions[0] ?? "Paddy",
                    ),
                  )
                }
              >
                Add a season
              </Button>
            </div>
          ) : null
        }
      />

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={
              tab === t.id
                ? "rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
                : "rounded-full border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {workspace.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading your farm history…</p>
      ) : null}

      {data ? (
        <>
          {tab === "overview" ? (
            <section className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Stat
                  label="Total extent"
                  value={`${data.totalAcres.toLocaleString("en-IN")} acres`}
                  helper={`${data.parcels.length} parcel${data.parcels.length === 1 ? "" : "s"} · ${data.scale.helper}`}
                />
                <Stat
                  label="Avg net income / acre"
                  value={inr(data.summary.avgNetPerAcre)}
                  helper={`${data.summary.yearsCovered} year(s) recorded · trend ${data.summary.trend.replace("_", " ")}`}
                />
                <Stat
                  label="Best year"
                  value={
                    data.summary.bestYear
                      ? `${data.summary.bestYear.crop_year} · ${inr(data.summary.bestYear.netPerAcre)}/ac`
                      : "—"
                  }
                  helper={data.summary.bestYear?.crops.join(", ") || "Add a season to see this"}
                />
                <Stat
                  label="Insurance"
                  value={COVER_LABEL[data.insurance.coverState]}
                  helper={`Indicative farmer share ${inr(data.insurance.estimatedFarmerShare)} · advisory only`}
                />
              </div>

              <div className="rounded-xl border border-border bg-card p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-base font-semibold">Five-year completeness</h2>
                  <Badge variant="secondary">{data.readiness.score}%</Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{data.readiness.message}</p>
                {data.readiness.yearsMissing.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {data.readiness.yearsMissing.map((year) => (
                      <Button
                        key={year}
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setDraft(
                            emptyDraft(year, data.currentSeason, data.cropOptions[0] ?? "Paddy"),
                          )
                        }
                      >
                        Add {year}
                      </Button>
                    ))}
                  </div>
                ) : null}
              </div>

              {data.summary.years.length ? (
                <div className="overflow-hidden rounded-xl border border-border bg-card">
                  <table className="w-full text-sm">
                    <thead className="bg-secondary text-secondary-foreground">
                      <tr>
                        <th className="p-3 text-left">Year</th>
                        <th className="p-3 text-left">Crops</th>
                        <th className="p-3 text-right">Acres</th>
                        <th className="p-3 text-right">Cost</th>
                        <th className="p-3 text-right">Revenue</th>
                        <th className="p-3 text-right">Net / acre</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...data.summary.years].reverse().map((y) => (
                        <tr key={y.crop_year} className="border-t border-border">
                          <td className="p-3 font-medium">{y.crop_year}</td>
                          <td className="p-3 text-muted-foreground">{y.crops.join(", ") || "—"}</td>
                          <td className="p-3 text-right tabular-nums">{y.acres}</td>
                          <td className="p-3 text-right tabular-nums">{inr(y.cost)}</td>
                          <td className="p-3 text-right tabular-nums">{inr(y.revenue)}</td>
                          <td className="p-3 text-right font-semibold tabular-nums">
                            {inr(y.netPerAcre)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
                  No season history yet. Add your first season — even one crop, one cost figure and
                  one yield is enough to start the comparison with your district.
                </p>
              )}

              {data.scale.showParcelBreakdown && data.parcels.length ? (
                <div className="rounded-xl border border-border bg-card p-5">
                  <h2 className="text-base font-semibold">Parcel-wise view</h2>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {data.parcels.map((p) => (
                      <div key={p.id} className="rounded-lg border border-border p-4">
                        <p className="text-sm font-medium">{p.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {p.area_acres ?? "—"} acres · {p.primary_crop ?? "crop not set"}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}

          {tab === "history" ? (
            <section className="space-y-4">
              {seasonsSorted.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
                  Nothing recorded yet. Use “Add a season” to record what you sowed, what it cost and
                  what you earned.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-border bg-card">
                  <table className="w-full text-sm">
                    <thead className="bg-secondary text-secondary-foreground">
                      <tr>
                        <th className="p-3 text-left">Season</th>
                        <th className="p-3 text-left">Crop</th>
                        <th className="p-3 text-right">Acres</th>
                        <th className="p-3 text-right">Input cost</th>
                        <th className="p-3 text-right">Yield</th>
                        <th className="p-3 text-right">Price</th>
                        <th className="p-3 text-right">Revenue</th>
                        <th className="p-3 text-right">Net</th>
                        <th className="p-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {seasonsSorted.map((s) => {
                        const eco = seasonEconomics(s);
                        return (
                          <tr key={s.id} className="border-t border-border">
                            <td className="p-3">
                              <span className="font-medium">{s.crop_year}</span>
                              <span className="block text-xs text-muted-foreground">
                                {SEASON_LABEL[s.season_code] ?? s.season_code}
                              </span>
                            </td>
                            <td className="p-3">{s.crop}</td>
                            <td className="p-3 text-right tabular-nums">{s.area_acres}</td>
                            <td className="p-3 text-right tabular-nums">{inr(eco.cost)}</td>
                            <td className="p-3 text-right tabular-nums">{qtl(s.yield_quintal)}</td>
                            <td className="p-3 text-right tabular-nums">
                              {inr(s.price_per_quintal)}
                            </td>
                            <td className="p-3 text-right tabular-nums">{inr(eco.revenue)}</td>
                            <td className="p-3 text-right font-semibold tabular-nums">
                              {inr(eco.netMargin)}
                              {eco.returnOnCostPct !== null ? (
                                <span className="block text-xs font-normal text-muted-foreground">
                                  {eco.returnOnCostPct}% on cost
                                </span>
                              ) : null}
                            </td>
                            <td className="p-3 text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    setDraft({
                                      id: s.id,
                                      crop_year: String(s.crop_year),
                                      season_code: s.season_code,
                                      crop: s.crop,
                                      area_acres: String(s.area_acres ?? ""),
                                      yield_quintal: s.yield_quintal ? String(s.yield_quintal) : "",
                                      price_per_quintal: s.price_per_quintal
                                        ? String(s.price_per_quintal)
                                        : "",
                                      farm_id: s.farm_id ?? "",
                                      notes: s.notes ?? "",
                                      costs: COST_HEADS.reduce(
                                        (acc, head) => ({
                                          ...acc,
                                          [head]: s.input_costs[head]
                                            ? String(s.input_costs[head])
                                            : "",
                                        }),
                                        {} as Record<CostHead, string>,
                                      ),
                                    })
                                  }
                                >
                                  Edit
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => deleteMutation.mutate(s.id)}
                                >
                                  Delete
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Every figure here is entered by you and stored against your account only. No other
                organisation can read your season records.
              </p>
            </section>
          ) : null}

          {tab === "area" ? (
            <section className="space-y-5">
              <p className="text-sm text-muted-foreground">
                District averages for {data.district ?? "your area"} over the last five years —
                aggregate reference data, never another farmer's records.
              </p>
              <div className="overflow-x-auto rounded-xl border border-border bg-card">
                <table className="w-full text-sm">
                  <thead className="bg-secondary text-secondary-foreground">
                    <tr>
                      <th className="p-3 text-left">Crop</th>
                      <th className="p-3 text-right">Typical yield / acre</th>
                      <th className="p-3 text-right">Typical cost / acre</th>
                      <th className="p-3 text-right">Typical price / qtl</th>
                      <th className="p-3 text-right">Indicative net / acre</th>
                      <th className="p-3 text-right">Area share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.areaCrops.map((c) => (
                      <tr key={c.crop} className="border-t border-border">
                        <td className="p-3 font-medium">{c.crop}</td>
                        <td className="p-3 text-right tabular-nums">
                          {c.avgYieldPerAcre}
                          <span className="block text-xs text-muted-foreground">
                            band {c.yieldBand[0]}–{c.yieldBand[1]}
                          </span>
                        </td>
                        <td className="p-3 text-right tabular-nums">{inr(c.avgCostPerAcre)}</td>
                        <td className="p-3 text-right tabular-nums">
                          {inr(c.avgPricePerQuintal)}
                          <span className="block text-xs text-muted-foreground">
                            {inr(c.priceBand[0])}–{inr(c.priceBand[1])}
                          </span>
                        </td>
                        <td className="p-3 text-right font-semibold tabular-nums">
                          {inr(c.indicativeNetPerAcre)}
                        </td>
                        <td className="p-3 text-right tabular-nums">{c.adoptionShare}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="rounded-xl border border-border bg-card p-5">
                <h2 className="text-base font-semibold">My yield vs my area</h2>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {data.comparison.map((row) => (
                    <div key={row.crop} className="rounded-lg border border-border p-4">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium">{row.crop}</p>
                        <Badge
                          variant={
                            row.verdict === "above_area"
                              ? "default"
                              : row.verdict === "below_area"
                                ? "destructive"
                                : "secondary"
                          }
                        >
                          {row.verdict === "no_own_data"
                            ? "no history"
                            : row.verdict.replace("_", " ")}
                        </Badge>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Mine {row.ownYieldPerAcre ?? "—"} qtl/ac · area {row.areaYieldPerAcre} qtl/ac
                        {row.yieldGapPct !== null ? ` · gap ${row.yieldGapPct}%` : ""}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          ) : null}

          {tab === "plan" ? (
            <section className="space-y-5">
              <p className="text-sm text-muted-foreground">{PLANNING_DISCLAIMER}</p>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {candidates.map((c) => {
                  const active = activeCandidate?.crop === c.crop;
                  return (
                    <button
                      key={c.crop}
                      type="button"
                      onClick={() => setPlanCrop(c.crop)}
                      className={
                        active
                          ? "rounded-xl border-2 border-primary bg-card p-5 text-left"
                          : "rounded-xl border border-border bg-card p-5 text-left"
                      }
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium">{c.crop}</p>
                        <Badge variant={active ? "default" : "outline"}>score {c.score}</Badge>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Indicative net {inr(c.expectedNetPerAcre)}/acre · yield{" "}
                        {c.expectedYieldPerAcre} qtl/ac
                      </p>
                      <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                        {c.reasons.slice(0, 2).map((r) => (
                          <li key={r}>• {r}</li>
                        ))}
                      </ul>
                    </button>
                  );
                })}
                {candidates.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
                    Add a season or wait for district reference data to see planning options.
                  </p>
                ) : null}
              </div>

              {activeCandidate && planBudget ? (
                <div className="rounded-xl border border-border bg-card p-5">
                  <h2 className="text-base font-semibold">
                    Input budget — {activeCandidate.crop}
                  </h2>
                  <div className="mt-4 grid gap-4 sm:grid-cols-3">
                    <div>
                      <Label htmlFor="plan-acres">Acres you plan to sow</Label>
                      <Input
                        id="plan-acres"
                        inputMode="decimal"
                        value={planAcres}
                        placeholder={String(data.totalAcres || 1)}
                        onChange={(e) => setPlanAcres(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="plan-parcel">Parcel</Label>
                      <select
                        id="plan-parcel"
                        className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                        value={planParcel}
                        onChange={(e) => setPlanParcel(e.target.value)}
                      >
                        <option value="">Select a parcel</option>
                        {data.parcels.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.label || p.id.slice(0, 8)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-end">
                      <Button
                        disabled={!planParcel || savePlanMutation.isPending}
                        onClick={() =>
                          savePlanMutation.mutate({
                            data: {
                              farmId: planParcel,
                              crop: activeCandidate.crop,
                              seasonCode: data.currentSeason,
                              cropYear: data.currentYear,
                              acres: planBudget.acres,
                              snapshot: planSnapshot({
                                crop: activeCandidate.crop,
                                seasonCode: data.currentSeason,
                                cropYear: data.currentYear,
                                acres: planBudget.acres,
                                budget: planBudget,
                                candidate: activeCandidate,
                                risks: planWarnings,
                              }),
                            },
                          })
                        }
                      >
                        Save advisory plan
                      </Button>
                    </div>
                  </div>

                  <div className="mt-5 overflow-x-auto rounded-lg border border-border">
                    <table className="w-full text-sm">
                      <thead className="bg-secondary text-secondary-foreground">
                        <tr>
                          <th className="p-3 text-left">Input head</th>
                          <th className="p-3 text-right">Per acre</th>
                          <th className="p-3 text-right">
                            Total ({planBudget.acres} ac)
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {planBudget.lines.map((line) => (
                          <tr key={line.head} className="border-t border-border">
                            <td className="p-3">{COST_HEAD_LABEL[line.head]}</td>
                            <td className="p-3 text-right tabular-nums">{inr(line.perAcre)}</td>
                            <td className="p-3 text-right tabular-nums">{inr(line.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <Stat label="Total input budget" value={inr(planBudget.totalCost)} />
                    <Stat label="Indicative gross" value={inr(planBudget.expectedGross)} />
                    <Stat label="Indicative net" value={inr(planBudget.expectedNet)} />
                    <Stat
                      label="Break-even"
                      value={
                        planBudget.breakEvenYieldPerAcre !== null
                          ? `${planBudget.breakEvenYieldPerAcre} qtl/ac`
                          : "—"
                      }
                      {...(planBudget.breakEvenPricePerQuintal !== null
                        ? { helper: `or ${inr(planBudget.breakEvenPricePerQuintal)}/qtl` }
                        : {})}
                    />
                  </div>

                  {planWarnings.length > 0 ? (
                    <ul className="mt-4 space-y-2 text-xs">
                      {planWarnings.map((r) => (
                        <li key={r.code} className="flex items-start gap-2">
                          <Badge
                            variant={
                              r.severity === "high"
                                ? "destructive"
                                : r.severity === "watch"
                                  ? "secondary"
                                  : "outline"
                            }
                          >
                            {r.severity}
                          </Badge>
                          <span className="text-muted-foreground">{r.message}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}

              <div className="rounded-xl border border-border bg-card p-5">
                <h2 className="text-base font-semibold">Saved plans</h2>
                {(plans.data ?? []).length === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">
                    No advisory plan saved yet.
                  </p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {(plans.data ?? []).map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
                      >
                        <div>
                          <p className="text-sm font-medium">
                            {p.crop} · {SEASON_LABEL[p.snapshot.season_code] ?? p.snapshot.season_code}{" "}
                            {p.snapshot.crop_year}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {p.snapshot.acres} ac · budget {inr(p.snapshot.budget?.totalCost)}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deletePlanMutation.mutate(p.id)}
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          ) : null}

          {tab === "insurance" ? (
            <section className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Stat label="Cover status" value={COVER_LABEL[data.insurance.coverState]} />
                <Stat
                  label="Sum insured (indicative)"
                  value={inr(data.insurance.estimatedSumInsured)}
                  helper={`${inr(data.insurance.sumInsuredPerAcre)} per acre`}
                />
                <Stat
                  label="Your share (indicative)"
                  value={inr(data.insurance.estimatedFarmerShare)}
                  helper={`${inr(data.insurance.farmerSharePerAcre)} per acre`}
                />
                <Stat
                  label="Season"
                  value={`${SEASON_LABEL[data.insurance.seasonCode] ?? data.insurance.seasonCode} ${data.insurance.cropYear}`}
                  helper={data.insurance.crop ?? "crop not set"}
                />
              </div>

              <div className="rounded-xl border border-border bg-secondary p-5 text-sm text-secondary-foreground">
                These are indicative figures for planning only. Enrolment, eligibility and any claim
                outcome are decided by the authorised insurer or government officer — never
                automatically here.
                {data.insurance.contactLabel ? (
                  <span className="mt-2 block font-medium">
                    Contact route: {data.insurance.contactLabel}
                  </span>
                ) : null}
              </div>

              <div className="rounded-xl border border-border bg-card p-5">
                <h2 className="text-base font-semibold">My applications</h2>
                {data.insuranceApplications.length === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">
                    No applications yet. Open Schemes to see what you can apply for; a human reviewer
                    decides each one.
                  </p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {data.insuranceApplications.map((a) => (
                      <div
                        key={a.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-4"
                      >
                        <div>
                          <p className="text-sm font-medium">{a.title}</p>
                          <p className="text-xs text-muted-foreground">{a.code}</p>
                        </div>
                        <Badge variant="secondary">{a.status}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          ) : null}

          {tab === "services" ? (
            <section className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setServiceKind("all")}
                  className={
                    serviceKind === "all"
                      ? "rounded-full bg-primary px-3 py-1.5 text-xs text-primary-foreground"
                      : "rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground"
                  }
                >
                  All services
                </button>
                {data.serviceKinds.map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => setServiceKind(kind)}
                    className={
                      serviceKind === kind
                        ? "rounded-full bg-primary px-3 py-1.5 text-xs text-primary-foreground"
                        : "rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground"
                    }
                  >
                    {SERVICE_LABEL[kind] ?? kind}
                  </button>
                ))}
              </div>

              {filteredServices.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
                  No services listed for your area yet.
                </p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredServices.map((s) => (
                    <div key={s.id} className="rounded-xl border border-border bg-card p-5">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium">{s.name}</p>
                        <Badge variant="outline">{SERVICE_LABEL[s.kind] ?? s.kind}</Badge>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {s.district_name ?? "—"}
                        {s.distanceKm !== null ? ` · ${s.distanceKm} km away` : ""}
                      </p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {s.contact_label ?? "Contact via your FPO or extension officer"}
                      </p>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Listing is discovery only — booking and payment are not part of this release.
              </p>
            </section>
          ) : null}
        </>
      ) : null}

      {draft ? (
        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-base font-semibold">
            {draft.id ? "Edit season" : "Add a season"}
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <Label htmlFor="year">Crop year</Label>
              <Input
                id="year"
                inputMode="numeric"
                value={draft.crop_year}
                onChange={(e) => setDraft({ ...draft, crop_year: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="season">Season</Label>
              <select
                id="season"
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={draft.season_code}
                onChange={(e) => setDraft({ ...draft, season_code: e.target.value })}
              >
                {SEASON_CODES.map((code) => (
                  <option key={code} value={code}>
                    {SEASON_LABEL[code]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="crop">Crop</Label>
              <Input
                id="crop"
                value={draft.crop}
                onChange={(e) => setDraft({ ...draft, crop: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="acres">Area (acres)</Label>
              <Input
                id="acres"
                inputMode="decimal"
                value={draft.area_acres}
                onChange={(e) => setDraft({ ...draft, area_acres: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="yield">Yield (quintals)</Label>
              <Input
                id="yield"
                inputMode="decimal"
                value={draft.yield_quintal}
                onChange={(e) => setDraft({ ...draft, yield_quintal: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="price">Price realised (₹ / quintal)</Label>
              <Input
                id="price"
                inputMode="decimal"
                value={draft.price_per_quintal}
                onChange={(e) => setDraft({ ...draft, price_per_quintal: e.target.value })}
              />
            </div>
            {data?.parcels.length ? (
              <div>
                <Label htmlFor="parcel">Parcel (optional)</Label>
                <select
                  id="parcel"
                  className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={draft.farm_id}
                  onChange={(e) => setDraft({ ...draft, farm_id: e.target.value })}
                >
                  <option value="">Whole farm</option>
                  {data.parcels.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Input
                id="notes"
                value={draft.notes}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              />
            </div>
          </div>

          <h3 className="mt-6 text-sm font-semibold">Input costs (₹)</h3>
          <div className="mt-3 grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {COST_HEADS.map((head) => (
              <div key={head}>
                <Label htmlFor={`cost-${head}`}>{COST_HEAD_LABEL[head]}</Label>
                <Input
                  id={`cost-${head}`}
                  inputMode="decimal"
                  value={draft.costs[head]}
                  onChange={(e) =>
                    setDraft({ ...draft, costs: { ...draft.costs, [head]: e.target.value } })
                  }
                />
              </div>
            ))}
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            Total input cost:{" "}
            <span className="font-semibold text-foreground">
              {inr(
                totalCost(
                  COST_HEADS.reduce((acc, head) => {
                    const value = Number(draft.costs[head]);
                    return Number.isFinite(value) && value > 0 ? { ...acc, [head]: value } : acc;
                  }, {} as CostBreakdown),
                ),
              )}
            </span>
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Button
              onClick={() => saveMutation.mutate(draft)}
              disabled={saveMutation.isPending || !draft.crop.trim()}
            >
              {saveMutation.isPending ? "Saving…" : "Save season"}
            </Button>
            <Button variant="outline" onClick={() => setDraft(null)}>
              Cancel
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
