import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/atap/AppShell";
import { Button } from "@/components/ui/button";
import {
  getInsurerWorkspace,
  moveInsurerFunnelStage,
  recomputeInsurerScores,
  saveInsurerCampaign,
  updateInsurerChannelRow,
} from "@/lib/atap/insurerRevenue.functions";
import {
  conversionPct,
  filterChannel,
  filterMarket,
  formatInr,
  FUNNEL_LABEL,
  FUNNEL_ORDER,
  nextStage,
  SCORE_BAND_LABEL,
  scoreBand,
  summarizeChannel,
  summarizeFunnel,
  summarizeMarket,
  uniqueSorted,
  type ScoreBand,
} from "@/lib/atap/insurerRevenue";

export const Route = createFileRoute("/_authenticated/insurer")({
  head: () => ({
    meta: [
      { title: "Insurer revenue intelligence — AgriGhar ATAP" },
      {
        name: "description",
        content:
          "Crop-insurance sales intelligence for Andhra Pradesh and Telangana: district penetration gaps, an advisory FPO opportunity score, acquisition funnel and campaigns.",
      },
      { property: "og:title", content: "Insurer revenue intelligence — AgriGhar ATAP" },
      {
        property: "og:description",
        content:
          "District market opportunity, FPO channel prioritisation and an auditable acquisition funnel for crop insurance teams.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: InsurerWorkspacePage,
});

type Tab = "market" | "channel" | "funnel" | "campaigns";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "market", label: "Market opportunity" },
  { id: "channel", label: "FPO channel" },
  { id: "funnel", label: "Acquisition funnel" },
  { id: "campaigns", label: "Campaigns" },
];

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="panel p-4">
      <p className="field-hint">{label}</p>
      <p className="font-display text-2xl font-semibold">{value}</p>
      {hint ? <p className="field-hint">{hint}</p> : null}
    </div>
  );
}

function InsurerWorkspacePage() {
  const fetchWorkspace = useServerFn(getInsurerWorkspace);
  const moveStage = useServerFn(moveInsurerFunnelStage);
  const updateChannel = useServerFn(updateInsurerChannelRow);
  const recompute = useServerFn(recomputeInsurerScores);
  const saveCampaign = useServerFn(saveInsurerCampaign);
  const queryClient = useQueryClient();

  const [tenantId, setTenantId] = useState<string | undefined>(undefined);
  const [tab, setTab] = useState<Tab>("market");
  const [message, setMessage] = useState<string | null>(null);

  const workspace = useQuery({
    queryKey: ["insurer-workspace", tenantId ?? "default"],
    queryFn: () => fetchWorkspace({ data: { ...(tenantId ? { tenantId } : {}) } }),
  });
  const data = workspace.data;
  const scopeId = data?.scope.tenantId ?? "";
  const canManage = Boolean(data?.scope.canManage);

  function refresh(text: string) {
    setMessage(text);
    void queryClient.invalidateQueries({ queryKey: ["insurer-workspace"] });
  }

  const stageMutation = useMutation({
    mutationFn: (input: { entryId: string; to: Parameters<typeof moveStage>[0]["data"]["to"] }) =>
      moveStage({ data: { tenantId: scopeId, entryId: input.entryId, to: input.to } }),
    onSuccess: (r) => refresh(`Moved to ${FUNNEL_LABEL[r.stage]}.`),
    onError: (e: Error) => setMessage(e.message),
  });
  const ownerMutation = useMutation({
    mutationFn: (input: { channelId: string; ownerName: string }) =>
      updateChannel({ data: { tenantId: scopeId, channelId: input.channelId, ownerName: input.ownerName } }),
    onSuccess: () => refresh("Channel owner saved."),
    onError: (e: Error) => setMessage(e.message),
  });
  const recomputeMutation = useMutation({
    mutationFn: () => recompute({ data: { tenantId: scopeId } }),
    onSuccess: (r) => refresh(`Recomputed advisory scores for ${r.updated} FPOs.`),
    onError: (e: Error) => setMessage(e.message),
  });
  const campaignMutation = useMutation({
    mutationFn: (input: { name: string; season: string; registrationNumbers: string[] }) =>
      saveCampaign({
        data: {
          tenantId: scopeId,
          name: input.name,
          season: input.season || null,
          registrationNumbers: input.registrationNumbers,
        },
      }),
    onSuccess: () => refresh("Campaign saved as draft."),
    onError: (e: Error) => setMessage(e.message),
  });

  /* market */
  const [mState, setMState] = useState("");
  const [mDistrict, setMDistrict] = useState("");
  const [mCrop, setMCrop] = useState("");
  const market = useMemo(
    () => filterMarket(data?.market ?? [], { state: mState, district: mDistrict, crop: mCrop }),
    [data?.market, mState, mDistrict, mCrop],
  );
  const marketTotals = useMemo(() => summarizeMarket(market), [market]);
  const marketDistricts = useMemo(() => {
    const map = new Map<string, { farmers: number; uninsured: number; premium: number }>();
    for (const r of market) {
      const key = `${r.district}, ${r.state_name}`;
      const acc = map.get(key) ?? { farmers: 0, uninsured: 0, premium: 0 };
      map.set(key, {
        farmers: acc.farmers + r.potential_farmers,
        uninsured: acc.uninsured + r.uninsured_farmers,
        premium: acc.premium + r.premium_potential_inr,
      });
    }
    return Array.from(map, ([key, v]) => ({ key, ...v })).sort((a, b) => b.premium - a.premium);
  }, [market]);

  /* channel */
  const [cSearch, setCSearch] = useState("");
  const [cState, setCState] = useState("");
  const [cDistrict, setCDistrict] = useState("");
  const [cBand, setCBand] = useState<ScoreBand | "">("");
  const [selected, setSelected] = useState<string | null>(null);
  const [ownerDraft, setOwnerDraft] = useState("");
  const channel = useMemo(
    () =>
      filterChannel(data?.channel ?? [], {
        search: cSearch,
        state: cState,
        district: cDistrict,
        band: cBand,
      }),
    [data?.channel, cSearch, cState, cDistrict, cBand],
  );
  const channelTotals = useMemo(() => summarizeChannel(channel), [channel]);
  const detail = useMemo(
    () => (data?.channel ?? []).find((r) => r.id === selected) ?? null,
    [data?.channel, selected],
  );

  /* funnel + campaigns */
  const funnel = data?.funnel ?? [];
  const funnelSummary = useMemo(() => summarizeFunnel(funnel), [funnel]);
  const [campaignName, setCampaignName] = useState("");
  const [campaignSeason, setCampaignSeason] = useState("Kharif 2026");
  const [campaignPicks, setCampaignPicks] = useState<string[]>([]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Insurer workspace"
        title="Revenue intelligence"
        description="Where the uninsured crop area is, which FPO channels to work first, and how the acquisition pipeline is converting. Aggregate figures only."
        actions={
          canManage ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => recomputeMutation.mutate()}
              disabled={recomputeMutation.isPending}
            >
              Recompute scores
            </Button>
          ) : undefined
        }
      />

      {workspace.isLoading ? (
        <section className="panel p-5 text-sm">Loading insurer workspace…</section>
      ) : workspace.isError ? (
        <section className="panel p-5 text-sm text-muted-foreground">
          {(workspace.error as Error).message}
        </section>
      ) : (
        <>
          <section className="panel space-y-2 p-5 text-sm text-muted-foreground">
            <p>{data?.advisory}</p>
            <p>{data?.aggregateNote}</p>
            {data?.scope.oversightOnly ? (
              <p className="text-foreground">
                Oversight view: you are not a member of this insurer tenant, so writes are refused.
              </p>
            ) : null}
          </section>

          <div className="flex flex-wrap items-center gap-3">
            {(data?.tenantOptions.length ?? 0) > 1 ? (
              <select
                className="field-base max-w-xs"
                value={scopeId}
                onChange={(e) => {
                  setTenantId(e.target.value);
                  setSelected(null);
                }}
              >
                {(data?.tenantOptions ?? []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-sm font-medium">{data?.scope.tenantName}</p>
            )}
            <nav className="flex flex-wrap gap-1 text-sm" aria-label="Insurer sections">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`rounded-md px-2.5 py-1.5 ${
                    tab === t.id
                      ? "bg-secondary text-secondary-foreground"
                      : "text-muted-foreground hover:bg-secondary"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </nav>
          </div>

          {message ? <section className="panel p-4 text-sm">{message}</section> : null}

          {tab === "market" ? (
            <section className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Kpi
                  label="Insurable farmers"
                  value={marketTotals.potentialFarmers.toLocaleString("en-IN")}
                  hint={`${marketTotals.districts} districts · ${marketTotals.cells} crop cells`}
                />
                <Kpi
                  label="Current penetration"
                  value={`${marketTotals.penetration}%`}
                  hint={`${marketTotals.insuredFarmers.toLocaleString("en-IN")} insured`}
                />
                <Kpi
                  label="Uninsured farmers"
                  value={marketTotals.uninsuredFarmers.toLocaleString("en-IN")}
                  hint={`${Math.round(marketTotals.opportunityAcres).toLocaleString("en-IN")} acres open`}
                />
                <Kpi
                  label="Indicative premium potential"
                  value={formatInr(marketTotals.premiumPotentialInr)}
                  hint="Synthetic baseline · not a quote"
                />
              </div>

              <div className="panel grid gap-3 p-5 md:grid-cols-3">
                <select
                  className="field-base"
                  value={mState}
                  onChange={(e) => {
                    setMState(e.target.value);
                    setMDistrict("");
                  }}
                >
                  <option value="">All states</option>
                  {uniqueSorted((data?.market ?? []).map((r) => r.state_name)).map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <select
                  className="field-base"
                  value={mDistrict}
                  onChange={(e) => setMDistrict(e.target.value)}
                >
                  <option value="">All districts</option>
                  {uniqueSorted(
                    (data?.market ?? [])
                      .filter((r) => !mState || r.state_name === mState)
                      .map((r) => r.district),
                  ).map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
                <select className="field-base" value={mCrop} onChange={(e) => setMCrop(e.target.value)}>
                  <option value="">All crops</option>
                  {uniqueSorted((data?.market ?? []).map((r) => r.crop)).map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div className="panel overflow-x-auto p-0">
                <table className="w-full text-sm">
                  <thead className="bg-secondary/60 text-left">
                    <tr>
                      <th className="p-3">District</th>
                      <th className="p-3">Insurable farmers</th>
                      <th className="p-3">Uninsured</th>
                      <th className="p-3">Premium potential</th>
                    </tr>
                  </thead>
                  <tbody>
                    {marketDistricts.slice(0, 40).map((d) => (
                      <tr key={d.key} className="border-t border-border">
                        <td className="p-3">{d.key}</td>
                        <td className="p-3">{d.farmers.toLocaleString("en-IN")}</td>
                        <td className="p-3">{d.uninsured.toLocaleString("en-IN")}</td>
                        <td className="p-3">{formatInr(d.premium)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {tab === "channel" ? (
            <section className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Kpi label="FPOs in view" value={String(channelTotals.fpos)} hint={`${channelTotals.priorityFpos} priority`} />
                <Kpi
                  label="Member penetration"
                  value={`${channelTotals.penetration}%`}
                  hint={`${channelTotals.insuredMembers.toLocaleString("en-IN")} of ${channelTotals.members.toLocaleString("en-IN")}`}
                />
                <Kpi label="Premium in force" value={formatInr(channelTotals.premiumInr)} />
                <Kpi
                  label="Premium potential"
                  value={formatInr(channelTotals.potentialPremiumInr)}
                  hint={`${channelTotals.unowned} FPOs unowned`}
                />
              </div>

              <div className="panel grid gap-3 p-5 md:grid-cols-4">
                <input
                  className="field-base"
                  placeholder="Search FPO, CIN, owner"
                  value={cSearch}
                  onChange={(e) => setCSearch(e.target.value)}
                />
                <select
                  className="field-base"
                  value={cState}
                  onChange={(e) => {
                    setCState(e.target.value);
                    setCDistrict("");
                  }}
                >
                  <option value="">All states</option>
                  {uniqueSorted((data?.channel ?? []).map((r) => r.state_name)).map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <select
                  className="field-base"
                  value={cDistrict}
                  onChange={(e) => setCDistrict(e.target.value)}
                >
                  <option value="">All districts</option>
                  {uniqueSorted(
                    (data?.channel ?? [])
                      .filter((r) => !cState || r.state_name === cState)
                      .map((r) => r.district),
                  ).map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
                <select
                  className="field-base"
                  value={cBand}
                  onChange={(e) => setCBand(e.target.value as ScoreBand | "")}
                >
                  <option value="">All score bands</option>
                  {(Object.keys(SCORE_BAND_LABEL) as ScoreBand[]).map((b) => (
                    <option key={b} value={b}>
                      {SCORE_BAND_LABEL[b]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
                <div className="panel overflow-x-auto p-0">
                  <table className="w-full text-sm">
                    <thead className="bg-secondary/60 text-left">
                      <tr>
                        <th className="p-3">FPO</th>
                        <th className="p-3">District</th>
                        <th className="p-3">Members</th>
                        <th className="p-3">Score</th>
                        <th className="p-3">Potential</th>
                      </tr>
                    </thead>
                    <tbody>
                      {channel.slice(0, 100).map((r) => (
                        <tr
                          key={r.id}
                          className={`cursor-pointer border-t border-border hover:bg-secondary/40 ${
                            selected === r.id ? "bg-secondary/50" : ""
                          }`}
                          onClick={() => {
                            setSelected(r.id);
                            setOwnerDraft(r.owner_name ?? "");
                          }}
                        >
                          <td className="p-3">{r.fpo_name}</td>
                          <td className="p-3">{r.district ?? "—"}</td>
                          <td className="p-3">{(r.member_count ?? 0).toLocaleString("en-IN")}</td>
                          <td className="p-3">
                            {r.opportunity_score} · {SCORE_BAND_LABEL[scoreBand(r.opportunity_score)]}
                          </td>
                          <td className="p-3">{formatInr(r.potential_premium_inr)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="panel space-y-3 p-5 text-sm">
                  {detail ? (
                    <>
                      <div>
                        <h2 className="font-display text-base font-semibold">{detail.fpo_name}</h2>
                        <p className="field-hint">
                          {detail.registration_number} · {detail.district ?? "—"}, {detail.state_name}
                        </p>
                      </div>
                      <dl className="grid grid-cols-2 gap-2">
                        <div>
                          <dt className="field-hint">Members</dt>
                          <dd>{(detail.member_count ?? 0).toLocaleString("en-IN")}</dd>
                        </div>
                        <div>
                          <dt className="field-hint">Insured members</dt>
                          <dd>{detail.insured_members.toLocaleString("en-IN")}</dd>
                        </div>
                        <div>
                          <dt className="field-hint">Policies</dt>
                          <dd>{detail.policies_count}</dd>
                        </div>
                        <div>
                          <dt className="field-hint">Premium potential</dt>
                          <dd>{formatInr(detail.potential_premium_inr)}</dd>
                        </div>
                      </dl>
                      <div className="space-y-1">
                        <p className="field-hint">Score drivers (advisory)</p>
                        {detail.score_drivers.map((d) => (
                          <p key={d.key}>
                            {d.label}: {d.points}/{d.max} — {d.detail}
                          </p>
                        ))}
                      </div>
                      {canManage ? (
                        <div className="space-y-2">
                          <label className="field-hint" htmlFor="owner">
                            Channel owner
                          </label>
                          <input
                            id="owner"
                            className="field-base"
                            value={ownerDraft}
                            onChange={(e) => setOwnerDraft(e.target.value)}
                          />
                          <Button
                            size="sm"
                            onClick={() =>
                              ownerMutation.mutate({ channelId: detail.id, ownerName: ownerDraft })
                            }
                            disabled={ownerMutation.isPending}
                          >
                            Save owner
                          </Button>
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <p className="text-muted-foreground">
                      Select an FPO to see its advisory score drivers.
                    </p>
                  )}
                </div>
              </div>
            </section>
          ) : null}

          {tab === "funnel" ? (
            <section className="space-y-4">
              <div className="panel overflow-x-auto p-0">
                <table className="w-full text-sm">
                  <thead className="bg-secondary/60 text-left">
                    <tr>
                      <th className="p-3">Stage</th>
                      <th className="p-3">FPOs</th>
                      <th className="p-3">Farmers</th>
                      <th className="p-3">Premium opportunity</th>
                      <th className="p-3">Reached</th>
                    </tr>
                  </thead>
                  <tbody>
                    {funnelSummary.map((s) => (
                      <tr key={s.stage} className="border-t border-border">
                        <td className="p-3">{s.label}</td>
                        <td className="p-3">{s.fpos}</td>
                        <td className="p-3">{s.farmers.toLocaleString("en-IN")}</td>
                        <td className="p-3">{formatInr(s.premiumOpportunityInr)}</td>
                        <td className="p-3">
                          {FUNNEL_ORDER.includes(s.stage) ? `${conversionPct(funnel, s.stage)}%` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="panel overflow-x-auto p-0">
                <table className="w-full text-sm">
                  <thead className="bg-secondary/60 text-left">
                    <tr>
                      <th className="p-3">FPO</th>
                      <th className="p-3">Stage</th>
                      <th className="p-3">Farmers</th>
                      <th className="p-3">Owner</th>
                      {canManage ? <th className="p-3">Move</th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {funnel.slice(0, 100).map((r) => {
                      const next = nextStage(r.stage);
                      return (
                        <tr key={r.id} className="border-t border-border">
                          <td className="p-3">{r.fpo_name}</td>
                          <td className="p-3">{FUNNEL_LABEL[r.stage]}</td>
                          <td className="p-3">{r.farmer_count.toLocaleString("en-IN")}</td>
                          <td className="p-3">{r.owner_name ?? "—"}</td>
                          {canManage ? (
                            <td className="p-3">
                              {next ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => stageMutation.mutate({ entryId: r.id, to: next })}
                                  disabled={stageMutation.isPending}
                                >
                                  → {FUNNEL_LABEL[next]}
                                </Button>
                              ) : (
                                "—"
                              )}
                            </td>
                          ) : null}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="field-hint">
                Enrolment, pricing and acceptance stay with the authorised underwriter; this pipeline
                only records the sales conversation and is fully audited.
              </p>
            </section>
          ) : null}

          {tab === "campaigns" ? (
            <section className="space-y-4">
              {canManage ? (
                <div className="panel space-y-3 p-5">
                  <h2 className="font-display text-base font-semibold">New campaign</h2>
                  <div className="grid gap-3 md:grid-cols-3">
                    <input
                      className="field-base"
                      placeholder="Campaign name"
                      value={campaignName}
                      onChange={(e) => setCampaignName(e.target.value)}
                    />
                    <input
                      className="field-base"
                      placeholder="Season"
                      value={campaignSeason}
                      onChange={(e) => setCampaignSeason(e.target.value)}
                    />
                    <select
                      className="field-base"
                      multiple
                      value={campaignPicks}
                      onChange={(e) =>
                        setCampaignPicks(
                          Array.from(e.target.selectedOptions, (o) => o.value).slice(0, 50),
                        )
                      }
                    >
                      {(data?.channel ?? []).slice(0, 200).map((r) => (
                        <option key={r.id} value={r.registration_number}>
                          {r.fpo_name} ({r.opportunity_score})
                        </option>
                      ))}
                    </select>
                  </div>
                  <Button
                    size="sm"
                    onClick={() =>
                      campaignMutation.mutate({
                        name: campaignName,
                        season: campaignSeason,
                        registrationNumbers: campaignPicks,
                      })
                    }
                    disabled={campaignMutation.isPending || !campaignName.trim()}
                  >
                    Save draft campaign
                  </Button>
                </div>
              ) : null}

              <div className="panel overflow-x-auto p-0">
                <table className="w-full text-sm">
                  <thead className="bg-secondary/60 text-left">
                    <tr>
                      <th className="p-3">Campaign</th>
                      <th className="p-3">Season</th>
                      <th className="p-3">State</th>
                      <th className="p-3">Target FPOs</th>
                      <th className="p-3">Target farmers</th>
                      <th className="p-3">Premium opportunity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.campaigns ?? []).map((c) => (
                      <tr key={c.id} className="border-t border-border">
                        <td className="p-3">{c.name}</td>
                        <td className="p-3">{c.season ?? "—"}</td>
                        <td className="p-3">{c.state}</td>
                        <td className="p-3">{c.targets.length}</td>
                        <td className="p-3">{c.target_farmers.toLocaleString("en-IN")}</td>
                        <td className="p-3">{formatInr(c.premium_opportunity_inr)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
