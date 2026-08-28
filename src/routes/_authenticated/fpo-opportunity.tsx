import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/atap/AppShell";
import { getFpoOpportunityIntel } from "@/lib/atap/fpoOpportunityIntel.functions";
import {
  activeFlags,
  countBy,
  filterProfiles,
  recommendedSchemes,
  schemeDemand,
  SCORE_BAND_LABEL,
  scoreBand,
  summarizeProfiles,
  type ScoreBand,
} from "@/lib/atap/fpoOpportunityIntel";

export const Route = createFileRoute("/_authenticated/fpo-opportunity")({
  head: () => ({
    meta: [
      { title: "FPO scheme & opportunity intelligence — AgriGhar ATAP" },
      {
        name: "description",
        content:
          "Prioritise 348 Andhra Pradesh and Telangana FPOs against central and state schemes with opportunity scores, data readiness and per-FPO scheme matching.",
      },
      {
        property: "og:title",
        content: "FPO scheme & opportunity intelligence — AgriGhar ATAP",
      },
      {
        property: "og:description",
        content:
          "Opportunity scores, data readiness and scheme matching across AP and Telangana FPOs, with official sources on every scheme.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FpoOpportunityPage,
});

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="panel p-4">
      <p className="field-hint">{label}</p>
      <p className="font-display text-2xl font-semibold">{value}</p>
      {hint ? <p className="field-hint">{hint}</p> : null}
    </div>
  );
}

function FpoOpportunityPage() {
  const fetchIntel = useServerFn(getFpoOpportunityIntel);
  const intel = useQuery({
    queryKey: ["fpo-opportunity-intel"],
    queryFn: () => fetchIntel(),
  });

  const [search, setSearch] = useState("");
  const [state, setState] = useState("");
  const [district, setDistrict] = useState("");
  const [commodityGroup, setCommodityGroup] = useState("");
  const [priorityNeed, setPriorityNeed] = useState("");
  const [band, setBand] = useState<ScoreBand | "">("");
  const [selected, setSelected] = useState<string | null>(null);

  const data = intel.data;
  const profiles = data?.profiles ?? [];

  const rows = useMemo(
    () => filterProfiles(profiles, { search, state, district, commodityGroup, priorityNeed, band }),
    [profiles, search, state, district, commodityGroup, priorityNeed, band],
  );
  const kpis = useMemo(() => summarizeProfiles(rows), [rows]);
  const byState = useMemo(() => countBy(rows, (r) => r.state_name), [rows]);
  const byDistrict = useMemo(() => countBy(rows, (r) => r.district ?? ""), [rows]);
  const demand = useMemo(() => schemeDemand(data?.matrix ?? []), [data?.matrix]);

  const states = useMemo(
    () => Array.from(new Set(profiles.map((r) => r.state_name))).sort(),
    [profiles],
  );
  const districts = useMemo(
    () =>
      Array.from(
        new Set(
          profiles.filter((r) => !state || r.state_name === state).map((r) => r.district ?? ""),
        ),
      )
        .filter(Boolean)
        .sort(),
    [profiles, state],
  );
  const commodityGroups = useMemo(
    () => Array.from(new Set(profiles.map((r) => r.commodity_group ?? "").filter(Boolean))).sort(),
    [profiles],
  );
  const needs = useMemo(
    () => Array.from(new Set(profiles.map((r) => r.priority_need ?? "").filter(Boolean))).sort(),
    [profiles],
  );

  const detail = useMemo(
    () => profiles.find((r) => r.registration_number === selected) ?? null,
    [profiles, selected],
  );
  const detailMatrix = useMemo(
    () => (data?.matrix ?? []).find((m) => m.registration_number === selected) ?? null,
    [data?.matrix, selected],
  );
  const detailSchemes = useMemo(
    () => (detail ? recommendedSchemes(detail, data?.catalog ?? []) : []),
    [detail, data?.catalog],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="FPO scheme & opportunity intelligence"
        description="Opportunity layer over the Andhra Pradesh and Telangana FPO registry: scheme catalogue, per-FPO scheme matching, opportunity and data-readiness scores."
      />

      {intel.isLoading ? (
        <section className="panel p-5 text-sm">Loading opportunity intelligence…</section>
      ) : intel.isError ? (
        <section className="panel p-5 text-sm text-muted-foreground">
          {(intel.error as Error).message}
        </section>
      ) : (
        <>
          <section className="panel p-5 text-sm text-muted-foreground">{data?.advisory}</section>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi label="FPOs in view" value={String(kpis.total)} hint={`${kpis.states} states · ${kpis.districts} districts`} />
            <Kpi label="Average opportunity score" value={String(kpis.avgOpportunityScore)} hint={`${kpis.highPriority} high priority`} />
            <Kpi label="Average data readiness" value={String(kpis.avgDataReadiness)} hint="Higher is more complete" />
            <Kpi
              label="Enrichment backlog"
              value={String(kpis.missingCommodity)}
              hint={`${kpis.missingTurnover} without turnover`}
            />
          </div>

          <section className="panel space-y-3 p-5">
            <h2 className="font-display text-base font-semibold">Filters</h2>
            <div className="grid gap-3 md:grid-cols-3">
              <input
                className="field-base"
                placeholder="Search FPO, CIN, district or CBBO"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <select
                className="field-base"
                value={state}
                onChange={(e) => {
                  setState(e.target.value);
                  setDistrict("");
                }}
              >
                <option value="">All states</option>
                {states.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <select
                className="field-base"
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
              >
                <option value="">All districts</option>
                {districts.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              <select
                className="field-base"
                value={commodityGroup}
                onChange={(e) => setCommodityGroup(e.target.value)}
              >
                <option value="">All commodity groups</option>
                {commodityGroups.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <select
                className="field-base"
                value={priorityNeed}
                onChange={(e) => setPriorityNeed(e.target.value)}
              >
                <option value="">All priority needs</option>
                {needs.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              <select
                className="field-base"
                value={band}
                onChange={(e) => setBand(e.target.value as ScoreBand | "")}
              >
                <option value="">All score bands</option>
                {(["high", "medium", "low"] as ScoreBand[]).map((b) => (
                  <option key={b} value={b}>
                    {SCORE_BAND_LABEL[b]}
                  </option>
                ))}
              </select>
            </div>
            <p className="field-hint">
              {rows.length} of {profiles.length} FPOs shown.
            </p>
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="panel space-y-2 p-5">
              <h2 className="font-display text-base font-semibold">Scheme demand across FPOs</h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left">
                    <th className="py-1">Scheme</th>
                    <th className="py-1">Existing</th>
                    <th className="py-1">Potential</th>
                  </tr>
                </thead>
                <tbody>
                  {demand.map((d) => (
                    <tr key={d.key} className="border-t border-border">
                      <td className="py-1">{d.label}</td>
                      <td className="py-1">{d.existing}</td>
                      <td className="py-1">{d.potential}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section className="panel space-y-3 p-5">
              <h2 className="font-display text-base font-semibold">Coverage</h2>
              <div className="text-sm">
                <p className="field-hint">By state</p>
                <ul className="text-muted-foreground">
                  {byState.map((s) => (
                    <li key={s.key}>
                      {s.key} — {s.count}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="text-sm">
                <p className="field-hint">Top districts</p>
                <ul className="text-muted-foreground">
                  {byDistrict.slice(0, 12).map((d) => (
                    <li key={d.key}>
                      {d.key} — {d.count}
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          </div>

          <section className="panel space-y-3 p-5">
            <h2 className="font-display text-base font-semibold">FPO opportunity list</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left">
                    <th className="py-1">FPO</th>
                    <th className="py-1">District</th>
                    <th className="py-1">Commodity</th>
                    <th className="py-1">Score</th>
                    <th className="py-1">Readiness</th>
                    <th className="py-1">Top scheme</th>
                    <th className="py-1" />
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 100).map((r) => (
                    <tr key={r.registration_number} className="border-t border-border align-top">
                      <td className="py-1">
                        {r.fpo_name}
                        <span className="field-hint block">{r.registration_number}</span>
                      </td>
                      <td className="py-1">
                        {r.district ?? "—"}
                        <span className="field-hint block">{r.state_name}</span>
                      </td>
                      <td className="py-1">{r.primary_commodity ?? r.commodity_group ?? "Not recorded"}</td>
                      <td className="py-1">
                        {r.opportunity_score ?? 0}
                        <span className="field-hint block">
                          {SCORE_BAND_LABEL[scoreBand(r.opportunity_score)]}
                        </span>
                      </td>
                      <td className="py-1">{r.data_readiness_score ?? 0}</td>
                      <td className="py-1">{r.top_scheme_1 ?? "Pending enrichment"}</td>
                      <td className="py-1">
                        <button
                          type="button"
                          className="rounded-md border border-border px-2 py-1"
                          onClick={() =>
                            setSelected(
                              selected === r.registration_number ? null : r.registration_number,
                            )
                          }
                        >
                          {selected === r.registration_number ? "Hide" : "Detail"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rows.length > 100 ? (
              <p className="field-hint">
                Showing the first 100 rows by score — narrow the filters to see more.
              </p>
            ) : null}
            {rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No FPOs match these filters.</p>
            ) : null}
          </section>

          {detail ? (
            <section className="panel space-y-4 p-5">
              <div>
                <h2 className="font-display text-base font-semibold">{detail.fpo_name}</h2>
                <p className="text-sm text-muted-foreground">
                  {detail.registration_number} · {detail.district ?? "—"}, {detail.state_name}
                  {detail.cbbo ? ` · CBBO: ${detail.cbbo}` : ""}
                </p>
              </div>

              <dl className="grid gap-2 text-sm sm:grid-cols-3">
                <div>
                  <dt className="field-hint">Members</dt>
                  <dd>{detail.member_count ?? "Not recorded"}</dd>
                </div>
                <div>
                  <dt className="field-hint">Turnover (₹ lakh)</dt>
                  <dd>{detail.annual_turnover_lakh ?? "Not recorded"}</dd>
                </div>
                <div>
                  <dt className="field-hint">Financing requirement (₹ lakh)</dt>
                  <dd>{detail.loan_requirement_lakh ?? "Not recorded"}</dd>
                </div>
                <div>
                  <dt className="field-hint">Priority need</dt>
                  <dd>{detail.priority_need ?? "Not recorded"}</dd>
                </div>
                <div>
                  <dt className="field-hint">Infrastructure</dt>
                  <dd>{detail.existing_infrastructure ?? "Not recorded"}</dd>
                </div>
                <div>
                  <dt className="field-hint">e-NAM</dt>
                  <dd>{detail.enam_status ?? "Not recorded"}</dd>
                </div>
                <div>
                  <dt className="field-hint">GST / FSSAI / UDYAM</dt>
                  <dd>
                    {[detail.gst_status, detail.fssai_status, detail.udyam_status]
                      .map((v) => v ?? "—")
                      .join(" / ")}
                  </dd>
                </div>
                <div>
                  <dt className="field-hint">10K FPO benefits</dt>
                  <dd>{detail.benefits_10k_status ?? "Not recorded"}</dd>
                </div>
                <div>
                  <dt className="field-hint">Verification status</dt>
                  <dd>
                    {detail.verification_status ?? "Not assessed"}
                    {detail.last_verified ? ` · ${detail.last_verified}` : ""}
                  </dd>
                </div>
              </dl>

              {detail.recommended_next_action ? (
                <p className="text-sm">Next action: {detail.recommended_next_action}</p>
              ) : null}

              <div className="space-y-3">
                <h3 className="font-display text-sm font-semibold">Top scheme recommendations</h3>
                {detailSchemes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No recommendation yet — enrich commodity, members and priority need first.
                  </p>
                ) : (
                  detailSchemes.map((s, i) => (
                    <article key={i} className="rounded-md border border-border p-3 text-sm">
                      <p className="font-medium">
                        {i + 1}. {s.recommendation}
                      </p>
                      {s.scheme ? (
                        <>
                          <p className="text-muted-foreground">{s.scheme.key_benefit}</p>
                          <p className="text-muted-foreground">
                            Indicative: {s.scheme.indicative_limit ?? "—"}
                          </p>
                          <p className="field-hint">
                            {s.scheme.implementer ?? "Implementing agency to confirm"} ·{" "}
                            {s.scheme.application_window ?? "Window to confirm"}
                          </p>
                          {s.scheme.source_url ? (
                            <a
                              className="text-primary underline"
                              href={s.scheme.source_url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Official source
                            </a>
                          ) : null}
                        </>
                      ) : (
                        <p className="field-hint">
                          Not yet linked to a catalogue entry — verify with the implementing agency.
                        </p>
                      )}
                    </article>
                  ))
                )}
              </div>

              {detailMatrix ? (
                <div className="text-sm">
                  <h3 className="font-display text-sm font-semibold">Scheme matrix</h3>
                  <ul className="list-disc pl-5 text-muted-foreground">
                    {activeFlags(detailMatrix).map((f) => (
                      <li key={f.label}>
                        {f.label}: {f.value}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {detail.source_url ? (
                <a
                  className="text-sm text-primary underline"
                  href={detail.source_url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Registry source document
                </a>
              ) : null}
            </section>
          ) : null}

          <section className="panel space-y-3 p-5">
            <h2 className="font-display text-base font-semibold">
              Scheme catalogue ({data?.catalog.length ?? 0})
            </h2>
            <div className="grid gap-3 md:grid-cols-2">
              {(data?.catalog ?? []).map((c) => (
                <article key={c.scheme_id} className="rounded-md border border-border p-3 text-sm">
                  <p className="font-medium">{c.scheme_name}</p>
                  <p className="field-hint">
                    {c.level ?? "—"} · {c.applicable_state ?? "Both"} · {c.category ?? "—"}
                  </p>
                  <p className="text-muted-foreground">{c.key_benefit}</p>
                  <p className="text-muted-foreground">Indicative: {c.indicative_limit ?? "—"}</p>
                  <p className="text-muted-foreground">Trigger: {c.eligibility_trigger ?? "—"}</p>
                  <p className="field-hint">
                    {c.implementer ?? "—"} · {c.application_window ?? "Window to confirm"}
                  </p>
                  {c.source_url ? (
                    <a
                      className="text-primary underline"
                      href={c.source_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Official source
                    </a>
                  ) : null}
                </article>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
