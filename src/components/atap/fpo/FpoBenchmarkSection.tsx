import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { getFpoBenchmark } from "@/lib/atap/fpoBenchmark.functions";
import {
  BAND_LABEL,
  BENCHMARK_DISCLAIMER,
  BENCHMARK_MEASURES,
  band,
  focusAreas,
  overallScore,
  peerAverage,
  rankRows,
} from "@/lib/atap/fpoBenchmark";

function Bar({ value, marker }: { value: number; marker?: number }) {
  return (
    <div className="relative h-2 w-full rounded-full bg-secondary">
      <div className="h-2 rounded-full bg-primary" style={{ width: `${Math.min(100, value)}%` }} />
      {marker != null ? (
        <div className="absolute -top-1 h-4 w-0.5 bg-foreground/70" style={{ left: `${Math.min(100, marker)}%` }} title={`Peer average ${marker}`} />
      ) : null}
    </div>
  );
}

const bandClass = {
  leading: "bg-primary/15 text-primary",
  on_track: "bg-secondary text-foreground",
  needs_support: "bg-destructive/10 text-destructive",
} as const;

export function FpoBenchmarkSection({ tenantId }: { tenantId: string }) {
  const fetchIt = useServerFn(getFpoBenchmark);
  const q = useQuery({
    queryKey: ["atap", "fpo-benchmark", tenantId],
    queryFn: () => fetchIt({ data: { tenantId } }),
    enabled: Boolean(tenantId),
  });
  const [period, setPeriod] = useState<string>("");
  const periods = q.data?.periods ?? [];
  const active = period || periods[periods.length - 1] || "";

  const view = useMemo(() => {
    const rows = (q.data?.rows ?? []).filter((r) => r.period === active);
    const ranked = rankRows(rows);
    const own = ranked.find((r) => r.isOwn) ?? null;
    const peers = rows.filter((r) => !r.isOwn);
    const trend = (q.data?.rows ?? []).filter((r) => r.isOwn).sort((a, b) => a.period.localeCompare(b.period));
    return { ranked, own, peers, trend };
  }, [q.data, active]);

  if (q.isLoading) return <p className="text-sm text-muted-foreground">Loading comparison…</p>;
  if (q.error) return <p className="text-sm text-destructive">{(q.error as Error).message}</p>;

  const { ranked, own, peers, trend } = view;

  return (
    <div className="space-y-6">
      <section className="panel space-y-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-semibold">FPO performance comparison</h2>
            <p className="field-hint">How well each FPO adopts best practice across six measures.</p>
          </div>
          <select className="field-base w-40" value={active} onChange={(e) => setPeriod(e.target.value)}>
            {periods.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
        <p className="text-xs text-muted-foreground">
          {BENCHMARK_DISCLAIMER}
          {q.data?.namesRevealed ? "" : " Other FPOs are shown without their names."}
        </p>
      </section>

      {own ? (
        <div className="grid gap-4 md:grid-cols-4">
          <div className="panel p-4">
            <p className="text-xs text-muted-foreground">Overall score</p>
            <p className="font-display text-3xl font-semibold">{own.overall}</p>
            <span className={`mt-1 inline-block rounded px-2 py-0.5 text-xs ${bandClass[band(own.overall)]}`}>{BAND_LABEL[band(own.overall)]}</span>
          </div>
          <div className="panel p-4">
            <p className="text-xs text-muted-foreground">Rank</p>
            <p className="font-display text-3xl font-semibold">{own.rank}<span className="text-base text-muted-foreground"> / {ranked.length}</span></p>
          </div>
          <div className="panel p-4">
            <p className="text-xs text-muted-foreground">Change since {trend[0]?.period}</p>
            <p className="font-display text-3xl font-semibold">
              {trend.length > 1 ? `${(overallScore(trend[trend.length - 1]!) - overallScore(trend[0]!)) >= 0 ? "+" : ""}${(overallScore(trend[trend.length - 1]!) - overallScore(trend[0]!)).toFixed(1)}` : "—"}
            </p>
          </div>
          <div className="panel p-4">
            <p className="text-xs text-muted-foreground">Focus next on</p>
            <ul className="mt-1 space-y-0.5 text-sm">
              {focusAreas(own, peers).map((f) => (
                <li key={f.key}>{f.label} <span className="text-muted-foreground">({f.gap >= 0 ? "+" : ""}{f.gap.toFixed(1)} vs peers)</span></li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      {own ? (
        <section className="panel space-y-4 p-5">
          <h3 className="font-display text-sm font-semibold">Your FPO vs peer average</h3>
          {BENCHMARK_MEASURES.map((m) => (
            <div key={m.key} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span title={m.hint}>{m.label}</span>
                <span className="text-muted-foreground">{own[m.key]} · peers {peerAverage(peers, m.key)}</span>
              </div>
              <Bar value={own[m.key]} marker={peerAverage(peers, m.key)} />
              <p className="field-hint">{m.hint}</p>
            </div>
          ))}
        </section>
      ) : null}

      <section className="panel overflow-x-auto p-5">
        <h3 className="mb-3 font-display text-sm font-semibold">League table · {active}</h3>
        <table className="w-full min-w-[720px] text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr>
              <th className="py-2">#</th>
              <th>FPO</th>
              <th>District</th>
              {BENCHMARK_MEASURES.map((m) => (
                <th key={m.key} className="text-right">{m.label.split(" ")[0]}</th>
              ))}
              <th className="text-right">Overall</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((r) => (
              <tr key={r.label} className={`border-t border-border ${r.isOwn ? "bg-primary/5 font-medium" : ""}`}>
                <td className="py-2">{r.rank}</td>
                <td>{r.label}{r.isOwn ? " (you)" : ""}</td>
                <td className="text-muted-foreground">{r.district}</td>
                {BENCHMARK_MEASURES.map((m) => (
                  <td key={m.key} className="text-right">{r[m.key]}</td>
                ))}
                <td className="text-right">
                  <span className={`rounded px-2 py-0.5 ${bandClass[band(r.overall)]}`}>{r.overall}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {trend.length > 0 ? (
        <section className="panel space-y-2 p-5">
          <h3 className="font-display text-sm font-semibold">Your trend by quarter</h3>
          {trend.map((t) => (
            <div key={t.period} className="flex items-center gap-3 text-sm">
              <span className="w-20 text-muted-foreground">{t.period}</span>
              <div className="flex-1"><Bar value={overallScore(t)} /></div>
              <span className="w-10 text-right">{overallScore(t)}</span>
            </div>
          ))}
        </section>
      ) : null}
    </div>
  );
}
