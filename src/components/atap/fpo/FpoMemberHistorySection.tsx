import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/components/atap/LanguageProvider";
import { fill } from "@/lib/i18n.fpoWs";
import { getMemberHistoryInsights } from "@/lib/atap/fpoHistoryInsights.functions";

const card = "rounded-lg border border-border bg-card p-4";
const inr = (v: number | null | undefined) =>
  v === null || v === undefined ? "—" : `₹${Math.round(v).toLocaleString("en-IN")}`;

const TREND_TONE: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  improving: "default",
  flat: "secondary",
  declining: "destructive",
  insufficient_data: "outline",
};

export function FpoMemberHistorySection({ tenantId }: { tenantId: string }) {
  const { t: tr } = useLanguage();
  const boardFn = useServerFn(getMemberHistoryInsights);
  const [growth, setGrowth] = useState("0");

  const board = useQuery({
    queryKey: ["atap", "fpo-member-history", tenantId, growth],
    queryFn: () => boardFn({ data: { tenantId, growthPct: Number(growth) || 0 } }),
    enabled: Boolean(tenantId),
  });

  if (board.isLoading) {
    return <p className="text-sm text-muted-foreground">{tr("fpo.mh.loading")}</p>;
  }
  const data = board.data;
  if (!data) {
    return <p className="text-sm text-muted-foreground">{tr("fpo.mh.na")}</p>;
  }
  if (!data.canView) {
    return (
      <p className="text-sm text-muted-foreground">
        {tr("fpo.mh.noRole")}</p>
    );
  }

  return (
    <section className="space-y-5">
      <p className="text-sm text-muted-foreground">{data.disclaimer}</p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className={card}>
          <p className="text-xs text-muted-foreground">{tr("fpo.mh.roster")}</p>
          <p className="text-lg font-semibold tabular-nums">{data.coverage.members}</p>
        </div>
        <div className={card}>
          <p className="text-xs text-muted-foreground">{tr("fpo.mh.consent")}</p>
          <p className="text-lg font-semibold tabular-nums">{data.coverage.consentedMembers}</p>
        </div>
        <div className={card}>
          <p className="text-xs text-muted-foreground">{tr("fpo.mh.contrib")}</p>
          <p className="text-lg font-semibold tabular-nums">
            {data.coverage.contributingMembers}
          </p>
        </div>
        <div className={card}>
          <p className="text-xs text-muted-foreground">{tr("fpo.mh.suppressed")}</p>
          <p className="text-lg font-semibold tabular-nums">
            {data.coverage.suppressedCohorts}
          </p>
          <p className="text-xs text-muted-foreground">
            {fill(tr("fpo.mh.minimum"), { n: data.minCohort })}</p>
        </div>
      </div>

      {data.coverage.consentedMembers === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
          {tr("fpo.mh.noConsent")}</p>
      ) : null}

      {data.trends.length > 0 ? (
        <div className={card}>
          <h3 className="text-sm font-semibold">{tr("fpo.mh.trends")}</h3>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary text-secondary-foreground">
                <tr>
                  <th className="p-3 text-left">{tr("fpo.mh.cCrop")}</th>
                  <th className="p-3 text-right">{tr("fpo.mh.cAcres")}</th>
                  <th className="p-3 text-right">{tr("fpo.mh.cYield")}</th>
                  <th className="p-3 text-right">{tr("fpo.mh.cNet")}</th>
                  <th className="p-3 text-left">{tr("fpo.mh.cTrend")}</th>
                </tr>
              </thead>
              <tbody>
                {data.trends.map((t) => (
                  <tr key={t.crop} className="border-t border-border">
                    <td className="p-3 font-medium">{t.crop}</td>
                    <td className="p-3 text-right tabular-nums">{t.acres}</td>
                    <td className="p-3 text-right tabular-nums">{t.avgYieldPerAcre ?? "—"}</td>
                    <td className="p-3 text-right tabular-nums">{inr(t.avgNetPerAcre)}</td>
                    <td className="p-3">
                      <Badge variant={TREND_TONE[t.trend] ?? "outline"}>
                        {t.trend.replace(/_/g, " ")}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <div className={card}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h3 className="text-sm font-semibold">{tr("fpo.mh.demand")}</h3>
          <div>
            <Label htmlFor="growth">{tr("fpo.mh.change")}</Label>
            <select
              id="growth"
              className="mt-1 h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={growth}
              onChange={(e) => setGrowth(e.target.value)}
            >
              {["-20", "-10", "0", "10", "20", "30"].map((g) => (
                <option key={g} value={g}>
                  {g}%
                </option>
              ))}
            </select>
          </div>
        </div>
        {data.demand.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            {tr("fpo.mh.notEnough")}</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary text-secondary-foreground">
                <tr>
                  <th className="p-3 text-left">{tr("fpo.mh.cCrop")}</th>
                  <th className="p-3 text-right">{tr("fpo.mh.cProj")}</th>
                  <th className="p-3 text-right">{tr("fpo.mh.cBudget")}</th>
                  <th className="p-3 text-left">{tr("fpo.mh.cBasis")}</th>
                </tr>
              </thead>
              <tbody>
                {data.demand.map((d) => (
                  <tr key={d.crop} className="border-t border-border align-top">
                    <td className="p-3 font-medium">{d.crop}</td>
                    <td className="p-3 text-right tabular-nums">{d.projectedAcres}</td>
                    <td className="p-3 text-right tabular-nums">{inr(d.indicativeBudget)}</td>
                    <td className="p-3 text-xs text-muted-foreground">
                      {d.basis === "member_history"
                        ? `${d.contributingMembers} members · ${inr(d.indicativeCostPerAcre)} per acre`
                        : tr("fpo.mh.small")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {data.signals.length > 0 ? (
        <div className={card}>
          <h3 className="text-sm font-semibold">{tr("fpo.mh.signals")}</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {data.signals.map((s) => (
              <li key={`${s.crop}-${s.signal}`} className="flex items-start gap-2">
                <Badge variant="outline">{s.crop}</Badge>
                <span className="text-muted-foreground">{s.note}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
