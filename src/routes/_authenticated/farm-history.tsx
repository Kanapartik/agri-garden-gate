import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useLanguage } from "@/components/atap/LanguageProvider";
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
import { getFarmerCoverDetail } from "@/lib/atap/insuranceBridge.functions";
import { useSeasonSync } from "@/hooks/useSeasonSync";
import {
  COST_HEADS,
  SEASON_CODES,
  seasonEconomics,
  totalCost,
  type CostBreakdown,
  type CostHead,
} from "@/lib/atap/farmHistory";
import {
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

type Tab = "overview" | "history" | "area" | "plan" | "insurance" | "services";

const TABS: Tab[] = ["overview", "history", "area", "plan", "insurance", "services"];

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
  const { t: tr, locale } = useLanguage();
  const number = (v: number) => v.toLocaleString(`${locale}-IN`);
  const inr = (value: number | null | undefined) => value == null ? "—" : new Intl.NumberFormat(`${locale}-IN`, { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Math.round(value));
  const qtl = (value: number | null | undefined) => value == null ? "—" : `${number(value)} ${tr("fh.qtl")}`;
  const seasonLabel = (code: string) => tr(`fh.season.${code}`);
  const costLabel = (head: string) => tr(`fh.costHead.${head}`);
  const coverLabel = (code: string) => tr(`fh.cover.${code}`);
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

  /* C4 — offline field capture. Season entries are queued on the device and
     replayed with a device-minted idempotency key when connectivity returns. */
  const sync = useSeasonSync(
    data?.userId ?? null,
    {
      upsert: ({ id, ...rest }) => saveSeason({ data: { ...(id ? { id } : {}), ...rest } }),
      remove: (input) => removeSeason({ data: input }),
      onFlushed: () => queryClient.invalidateQueries({ queryKey: ["atap", "farm-history"] }),
    },
    data?.seasons ?? [],
  );

  const saveMutation = useMutation({
    mutationFn: async (input: DraftState) => {
      const costs: CostBreakdown = {};
      for (const head of COST_HEADS) {
        const value = Number(input.costs[head]);
        if (Number.isFinite(value) && value > 0) costs[head] = value;
      }
      const payload = {
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
      };
      if (!sync.online) {
        sync.queueSeason(payload);
        return { queued: true as const };
      }
      return saveSeason({ data: payload });
    },
    onSuccess: async (result) => {
      toast.success(
        (result as { queued?: boolean })?.queued ? tr("fh.saveSeasonQueued") : tr("fh.saveSeasonOk"),
      );
      setDraft(null);
      await queryClient.invalidateQueries({ queryKey: ["atap", "farm-history"] });
    },
    onError: () => toast.error(tr("fh.saveSeasonErr")),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!sync.online) {
        sync.queueDelete(id);
        return { queued: true as const };
      }
      return removeSeason({ data: { id } });
    },
    onSuccess: async () => {
      toast.success(tr("fh.seasonRemoved"));
      await queryClient.invalidateQueries({ queryKey: ["atap", "farm-history"] });
    },
    onError: () => toast.error(tr("fh.removeSeasonErr")),
  });

  const fetchPlans = useServerFn(listSeasonPlans);
  const savePlan = useServerFn(saveSeasonPlan);
  const removePlan = useServerFn(deleteSeasonPlan);

  const plans = useQuery({
    queryKey: ["atap", "season-plans"],
    queryFn: () => fetchPlans(),
  });

  /* C3 — cover bound to a notified insurer policy + organization claim stage */
  const fetchCover = useServerFn(getFarmerCoverDetail);
  const cover = useQuery({
    queryKey: ["atap", "farmer-cover-detail"],
    queryFn: () => fetchCover({ data: {} }),
  });

  const savePlanMutation = useMutation({
    mutationFn: (input: Parameters<typeof savePlan>[0]) => savePlan(input),
    onSuccess: async () => {
      toast.success(tr("fh.planSaved"));
      await queryClient.invalidateQueries({ queryKey: ["atap", "season-plans"] });
    },
    onError: (e: Error) => toast.error(e.message || tr("fh.savePlanErr")),
  });

  const deletePlanMutation = useMutation({
    mutationFn: (planId: string) => removePlan({ data: { planId } }),
    onSuccess: async () => {
      toast.success(tr("fh.planRemoved"));
      await queryClient.invalidateQueries({ queryKey: ["atap", "season-plans"] });
    },
    onError: () => toast.error(tr("fh.removePlanErr")),
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
      [...(data?.seasons ?? [])]
        .filter((s) => !sync.deletedIds.includes(s.id))
        .sort(
          (a, b) => b.crop_year - a.crop_year || a.season_code.localeCompare(b.season_code),
        ),
    [data?.seasons, sync.deletedIds],
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
        eyebrow={tr("fh.eyebrow")}
        title={tr("fh.title")}
        description={tr("fh.description")}
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
                {tr("fh.addSeason")}
              </Button>
            </div>
          ) : null
        }
      />

      {/* C4 — field-capture sync state, always visible so a farmer knows
          whether an entry is on the device only or saved to the account. */}
      {sync.counts.total > 0 || !sync.online ? (
        <div
          className={
            sync.counts.blocked > 0
              ? "flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/40 bg-destructive/5 p-4"
              : "flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-secondary/40 p-4"
          }
        >
          <div className="flex items-center gap-2">
            <Badge variant={sync.online ? "secondary" : "outline"}>
              {sync.online ? tr("fh.online") : tr("fh.offline")}
            </Badge>
            <p className="text-sm">{sync.summary}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={!sync.online || sync.flushing || sync.counts.total === 0}
            onClick={() => void sync.flush()}
          >
            {sync.flushing ? tr("fh.syncing") : tr("fh.syncNow")}
          </Button>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {TABS.map((tabId) => (
          <button
            key={tabId}
            type="button"
            onClick={() => setTab(tabId)}
            className={
              tab === tabId
                ? "rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
                : "rounded-full border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
            }
          >
            {tr(`fh.tab.${tabId}`)}
          </button>
        ))}
      </div>

      {workspace.isLoading ? (
        <p className="text-sm text-muted-foreground">{tr("fh.loading")}</p>
      ) : null}

      {data ? (
        <>
          {tab === "overview" ? (
            <section className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Stat
                  label={tr("fh.totalExtent")}
                  value={`${number(data.totalAcres)} ${tr("fh.acres")}`}
                  helper={`${data.parcels.length} ${tr("fh.parcels")} · ${data.scale.helper}`}
                />
                <Stat
                  label={tr("fh.avgNet")}
                  value={inr(data.summary.avgNetPerAcre)}
                  helper={`${data.summary.yearsCovered} ${tr("fh.yearsRecorded")} · ${tr("fh.trend")} ${tr(`fh.trend.${data.summary.trend}`)}`}
                />
                <Stat
                  label={tr("fh.bestYear")}
                  value={
                    data.summary.bestYear
                      ? `${data.summary.bestYear.crop_year} · ${inr(data.summary.bestYear.netPerAcre)}/${tr("fh.acShort")}`
                      : "—"
                  }
                  helper={data.summary.bestYear?.crops.join(", ") || tr("fh.addToSee")}
                />
                <Stat
                  label={tr("fh.insurance")}
                  value={coverLabel(data.insurance.coverState)}
                  helper={`${tr("fh.indShare")} ${inr(data.insurance.estimatedFarmerShare)} · ${tr("fh.advisoryOnly")}`}
                />
              </div>

              <div className="rounded-xl border border-border bg-card p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-base font-semibold">{tr("fh.completeness")}</h2>
                  <Badge variant="secondary">{data.readiness.score}%</Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{tr(`fh.readiness.${data.readiness.score === 100 ? "complete" : "incomplete"}`)}</p>
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
                        {tr("fh.add")} {year}
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
                        <th className="p-3 text-left">{tr("fh.year")}</th>
                        <th className="p-3 text-left">{tr("fh.crops")}</th>
                        <th className="p-3 text-right">{tr("fh.acres")}</th>
                        <th className="p-3 text-right">{tr("fh.cost")}</th>
                        <th className="p-3 text-right">{tr("fh.revenue")}</th>
                        <th className="p-3 text-right">{tr("fh.netAcre")}</th>
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
                  {tr("fh.noHistory")}
                </p>
              )}

              {data.scale.showParcelBreakdown && data.parcels.length ? (
                <div className="rounded-xl border border-border bg-card p-5">
                  <h2 className="text-base font-semibold">{tr("fh.parcelView")}</h2>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {data.parcels.map((p) => (
                      <div key={p.id} className="rounded-lg border border-border p-4">
                        <p className="text-sm font-medium">{p.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {p.area_acres ?? "—"} {tr("fh.acres")} · {p.primary_crop ?? tr("fh.cropNotSet")}
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
              {sync.optimistic.length > 0 ? (
                <div className="space-y-2 rounded-xl border border-dashed border-border p-4">
                  <p className="text-sm font-semibold">{tr("fh.waitingSync")}</p>
                  {sync.optimistic.map((o) => (
                    <div
                      key={o.key}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card p-3"
                    >
                      <div>
                        <p className="text-sm font-medium">
                          {o.crop_year} {seasonLabel(o.season_code)} · {o.crop} ·{" "}
                          {o.area_acres} {tr("fh.acShort")}
                        </p>
                        {o.lastError ? (
                          <p className="text-xs text-destructive">{o.lastError}</p>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            {tr("fh.deviceOnly")}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={o.blocked ? "destructive" : "outline"}>
                          {o.blocked ? tr("fh.needsAttention") : tr("fh.queued")}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => sync.discard(o.clientOpId)}
                        >
                          {tr("fh.discard")}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              {seasonsSorted.length === 0 && sync.optimistic.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
                  {tr("fh.nothingRecorded")}
                </p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-border bg-card">
                  <table className="w-full text-sm">
                    <thead className="bg-secondary text-secondary-foreground">
                      <tr>
                        <th className="p-3 text-left">{tr("fh.season")}</th>
                        <th className="p-3 text-left">{tr("fh.crop")}</th>
                        <th className="p-3 text-right">{tr("fh.acres")}</th>
                        <th className="p-3 text-right">{tr("fh.inputCost")}</th>
                        <th className="p-3 text-right">{tr("fh.yield")}</th>
                        <th className="p-3 text-right">{tr("fh.price")}</th>
                        <th className="p-3 text-right">{tr("fh.revenue")}</th>
                        <th className="p-3 text-right">{tr("fh.net")}</th>
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
                                {seasonLabel(s.season_code)}
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
                                  {eco.returnOnCostPct}% {tr("fh.onCost")}
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
                                  {tr("fh.edit")}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => deleteMutation.mutate(s.id)}
                                >
                                  {tr("fh.delete")}
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
                {tr("fh.privacy")}
              </p>
            </section>
          ) : null}

          {tab === "area" ? (
            <section className="space-y-5">
              <p className="text-sm text-muted-foreground">
                {tr("fh.areaIntro").replace("{district}", data.district ?? tr("fh.yourArea"))}
              </p>
              <div className="rounded-xl border border-border bg-card p-4 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={data.officialReference.fields.price === "official" ? "default" : "outline"}>
                    {tr("fh.price")}: {data.officialReference.fields.price === "official" ? tr("fh.officialMsp") : tr("fh.indicative")}
                  </Badge>
                  <Badge variant="outline">{tr("fh.yieldInd")}</Badge>
                  <Badge variant="outline">{tr("fh.costInd")}</Badge>
                  <span className="text-xs text-muted-foreground">{data.areaProvenance.label}</span>
                </div>
                <ul className="list-disc pl-5 text-xs text-muted-foreground space-y-1">
                  {data.officialReference.notes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
                {data.officialReference.datasets.length > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    {tr("fh.loadedSources")}:{" "}
                    {data.officialReference.datasets.map((d) => `${d.label} (${d.citation})`).join("; ")}
                  </p>
                ) : null}
              </div>

              <div className="overflow-x-auto rounded-xl border border-border bg-card">
                <table className="w-full text-sm">
                  <thead className="bg-secondary text-secondary-foreground">
                    <tr>
                      <th className="p-3 text-left">{tr("fh.crop")}</th>
                      <th className="p-3 text-right">{tr("fh.typYield")}</th>
                      <th className="p-3 text-right">{tr("fh.typCost")}</th>
                      <th className="p-3 text-right">{tr("fh.typPrice")}</th>
                      <th className="p-3 text-right">{tr("fh.indNet")}</th>
                      <th className="p-3 text-right">{tr("fh.areaShare")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.areaCrops.map((c) => (
                      <tr key={c.crop} className="border-t border-border">
                        <td className="p-3 font-medium">{c.crop}</td>
                        <td className="p-3 text-right tabular-nums">
                          {c.avgYieldPerAcre}
                          <span className="block text-xs text-muted-foreground">
                            {tr("fh.band")} {c.yieldBand[0]}–{c.yieldBand[1]}
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
                <h2 className="text-base font-semibold">{tr("fh.yieldVsArea")}</h2>
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
                          {tr(`fh.verdict.${row.verdict}`)}
                        </Badge>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {tr("fh.mine")} {row.ownYieldPerAcre ?? "—"} {tr("fh.qtl")}/{tr("fh.acShort")} · {tr("fh.area")} {row.areaYieldPerAcre} {tr("fh.qtl")}/{tr("fh.acShort")}{row.yieldGapPct !== null ? ` · ${tr("fh.gap")} ${row.yieldGapPct}%` : ""}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          ) : null}

          {tab === "plan" ? (
            <section className="space-y-5">
              <p className="text-sm text-muted-foreground">{tr("fh.planningDisclaimer")}</p>

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
                        <Badge variant={active ? "default" : "outline"}>{tr("fh.score")} {c.score}</Badge>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {tr("fh.indNetShort")} {inr(c.expectedNetPerAcre)}/{tr("fh.acShort")} · {tr("fh.yield")} {c.expectedYieldPerAcre} {tr("fh.qtl")}/{tr("fh.acShort")}
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
                    {tr("fh.noCandidates")}
                  </p>
                ) : null}
              </div>

              {activeCandidate && planBudget ? (
                <div className="rounded-xl border border-border bg-card p-5">
                  <h2 className="text-base font-semibold">
                    {tr("fh.inputBudget")} — {activeCandidate.crop}
                  </h2>
                  <div className="mt-4 grid gap-4 sm:grid-cols-3">
                    <div>
                      <Label htmlFor="plan-acres">{tr("fh.planAcres")}</Label>
                      <Input
                        id="plan-acres"
                        inputMode="decimal"
                        value={planAcres}
                        placeholder={String(data.totalAcres || 1)}
                        onChange={(e) => setPlanAcres(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="plan-parcel">{tr("fh.parcel")}</Label>
                      <select
                        id="plan-parcel"
                        className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                        value={planParcel}
                        onChange={(e) => setPlanParcel(e.target.value)}
                      >
                        <option value="">{tr("fh.selectParcel")}</option>
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
                        {tr("fh.saveAdvisory")}
                      </Button>
                    </div>
                  </div>

                  <div className="mt-5 overflow-x-auto rounded-lg border border-border">
                    <table className="w-full text-sm">
                      <thead className="bg-secondary text-secondary-foreground">
                        <tr>
                          <th className="p-3 text-left">{tr("fh.inputHead")}</th>
                          <th className="p-3 text-right">{tr("fh.perAcre")}</th>
                          <th className="p-3 text-right">
                            {tr("fh.totalBudget")} ({planBudget.acres} {tr("fh.acShort")})
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {planBudget.lines.map((line) => (
                          <tr key={line.head} className="border-t border-border">
                            <td className="p-3">{costLabel(line.head)}</td>
                            <td className="p-3 text-right tabular-nums">{inr(line.perAcre)}</td>
                            <td className="p-3 text-right tabular-nums">{inr(line.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <Stat label={tr("fh.totalBudget")} value={inr(planBudget.totalCost)} />
                    <Stat label={tr("fh.indGross")} value={inr(planBudget.expectedGross)} />
                    <Stat label={tr("fh.indNetShort")} value={inr(planBudget.expectedNet)} />
                    <Stat
                      label={tr("fh.breakEven")}
                      value={
                        planBudget.breakEvenYieldPerAcre !== null
                          ? `${planBudget.breakEvenYieldPerAcre} ${tr("fh.qtl")}/${tr("fh.acShort")}`
                          : "—"
                      }
                      {...(planBudget.breakEvenPricePerQuintal !== null
                        ? { helper: `${tr("fh.or")} ${inr(planBudget.breakEvenPricePerQuintal)}/${tr("fh.qtl")}` }
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
                            {tr(`fh.severity.${r.severity}`)}
                          </Badge>
                          <span className="text-muted-foreground">{r.message}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}

              <div className="rounded-xl border border-border bg-card p-5">
                <h2 className="text-base font-semibold">{tr("fh.savedPlans")}</h2>
                {(plans.data ?? []).length === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">
                    {tr("fh.noPlans")}
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
                            {p.crop} · {seasonLabel(p.snapshot.season_code)}{" "}
                            {p.snapshot.crop_year}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {p.snapshot.acres} {tr("fh.acShort")} · {tr("fh.budget")} {inr(p.snapshot.budget?.totalCost)}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deletePlanMutation.mutate(p.id)}
                        >
                          {tr("fh.remove")}
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
                <Stat label={tr("fh.coverStatus")} value={coverLabel(data.insurance.coverState)} />
                <Stat
                  label={tr("fh.sumInsured")}
                  value={inr(data.insurance.estimatedSumInsured)}
                  helper={`${inr(data.insurance.sumInsuredPerAcre)} ${tr("fh.perAcre")}`}
                />
                <Stat
                  label={tr("fh.yourShare")}
                  value={inr(data.insurance.estimatedFarmerShare)}
                  helper={`${inr(data.insurance.farmerSharePerAcre)} ${tr("fh.perAcre")}`}
                />
                <Stat
                  label={tr("fh.season")}
                  value={`${seasonLabel(data.insurance.seasonCode)} ${data.insurance.cropYear}`}
                  helper={data.insurance.crop ?? tr("fh.cropNotSet")}
                />
              </div>

              <div className="rounded-xl border border-border bg-secondary p-5 text-sm text-secondary-foreground">
                {tr("fh.insuranceDisclaimer")}
                {data.insurance.contactLabel ? (
                  <span className="mt-2 block font-medium">
                    {tr("fh.contactRoute")}: {data.insurance.contactLabel}
                  </span>
                ) : null}
              </div>

              <div className="rounded-xl border border-border bg-card p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-base font-semibold">{tr("fh.coverRecord")}</h2>
                  <Badge variant={cover.data?.bound ? "default" : "secondary"}>
                    {cover.data?.bound ? tr("fh.boundPolicy") : tr("fh.indicativeOnly")}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {cover.data?.note ??
                    tr("fh.coverNote")}
                </p>
                {(cover.data?.snapshots.length ?? 0) === 0 ? (
                  <p className="mt-3 text-sm text-muted-foreground">
                    {tr("fh.noCover")}
                  </p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {cover.data?.snapshots.map((s) => (
                      <div
                        key={`${s.cropYear}-${s.seasonCode}`}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-4"
                      >
                        <div>
                          <p className="text-sm font-medium">
                            {seasonLabel(s.seasonCode)} {s.cropYear} ·{" "}
                            {s.crop ?? tr("fh.cropNotSet")}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {inr(s.sumInsuredPerAcre ?? 0)} {tr("fh.sumInsured")} / {tr("fh.acShort")} · {tr("fh.yourShare")} {" "}
                            {inr(s.farmerSharePerAcre ?? 0)} / {tr("fh.acShort")}
                            {s.contactLabel ? ` · ${s.contactLabel}` : ""}
                          </p>
                        </div>
                        <Badge variant={s.source === "insurer_policy" ? "default" : "outline"}>
                          {s.source === "insurer_policy" ? tr("fh.policyBound") : tr("fh.indicative")}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-border bg-card p-5">
                <h2 className="text-base font-semibold">{tr("fh.claimStatus")}</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {cover.data?.claimNote ??
                    tr("fh.claimNote")}
                </p>
                {(cover.data?.claims.length ?? 0) === 0 ? (
                  <p className="mt-3 text-sm text-muted-foreground">
                    {tr("fh.noClaims")}
                  </p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {cover.data?.claims.map((c) => (
                      <div
                        key={c.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-4"
                      >
                        <div>
                          <p className="text-sm font-medium">
                            {c.crop ?? tr("fh.allCrops")} · {c.season} · {c.peril.replace(/_/g, " ")}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {c.fpoName} · {tr("fh.reported")} {" "}
                            {new Date(c.reportedAt).toLocaleDateString(`${locale}-IN`)}
                            {c.relevantToFarmer ? ` · ${tr("fh.matchesCrop")}` : ""}
                          </p>
                        </div>
                        <Badge variant="secondary">{c.stageLabel}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>



              <div className="rounded-xl border border-border bg-card p-5">
                <h2 className="text-base font-semibold">{tr("fh.myApps")}</h2>
                {data.insuranceApplications.length === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">
                    {tr("fh.noApps")}
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
                  {tr("fh.allServices")}
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
                    {tr(`fh.service.${kind}`)}
                  </button>
                ))}
              </div>

              {filteredServices.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
                  {tr("fh.noServices")}
                </p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredServices.map((s) => (
                    <div key={s.id} className="rounded-xl border border-border bg-card p-5">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium">{s.name}</p>
                        <Badge variant="outline">{tr(`fh.service.${s.kind}`)}</Badge>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {s.district_name ?? "—"}
                        {s.distanceKm !== null ? ` · ${s.distanceKm} ${tr("fh.kmAway")}` : ""}
                      </p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {s.contact_label ?? tr("fh.contactFpo")}
                      </p>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                {tr("fh.serviceDisclaimer")}
              </p>
            </section>
          ) : null}
        </>
      ) : null}

      {draft ? (
        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-base font-semibold">
            {draft.id ? tr("fh.editSeason") : tr("fh.addSeason")}
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <Label htmlFor="year">{tr("fh.cropYear")}</Label>
              <Input
                id="year"
                inputMode="numeric"
                value={draft.crop_year}
                onChange={(e) => setDraft({ ...draft, crop_year: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="season">{tr("fh.season")}</Label>
              <select
                id="season"
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={draft.season_code}
                onChange={(e) => setDraft({ ...draft, season_code: e.target.value })}
              >
                {SEASON_CODES.map((code) => (
                  <option key={code} value={code}>
                    {seasonLabel(code)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="crop">{tr("fh.crop")}</Label>
              <Input
                id="crop"
                value={draft.crop}
                onChange={(e) => setDraft({ ...draft, crop: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="acres">{tr("fh.areaAcres")}</Label>
              <Input
                id="acres"
                inputMode="decimal"
                value={draft.area_acres}
                onChange={(e) => setDraft({ ...draft, area_acres: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="yield">{tr("fh.yieldQtl")}</Label>
              <Input
                id="yield"
                inputMode="decimal"
                value={draft.yield_quintal}
                onChange={(e) => setDraft({ ...draft, yield_quintal: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="price">{tr("fh.priceReal")}</Label>
              <Input
                id="price"
                inputMode="decimal"
                value={draft.price_per_quintal}
                onChange={(e) => setDraft({ ...draft, price_per_quintal: e.target.value })}
              />
            </div>
            {data?.parcels.length ? (
              <div>
                <Label htmlFor="parcel">{tr("fh.parcelOpt")}</Label>
                <select
                  id="parcel"
                  className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={draft.farm_id}
                  onChange={(e) => setDraft({ ...draft, farm_id: e.target.value })}
                >
                  <option value="">{tr("fh.wholeFarm")}</option>
                  {data.parcels.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            <div>
              <Label htmlFor="notes">{tr("fh.notes")}</Label>
              <Input
                id="notes"
                value={draft.notes}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              />
            </div>
          </div>

          <h3 className="mt-6 text-sm font-semibold">{tr("fh.inputCosts")}</h3>
          <div className="mt-3 grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {COST_HEADS.map((head) => (
              <div key={head}>
                <Label htmlFor={`cost-${head}`}>{costLabel(head)}</Label>
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
            {tr("fh.totalInputCost")}:{" "}
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
              {saveMutation.isPending ? tr("fh.saving") : tr("fh.saveSeason")}
            </Button>
            <Button variant="outline" onClick={() => setDraft(null)}>
              {tr("fh.cancel")}
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
