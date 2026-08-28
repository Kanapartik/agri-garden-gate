import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/atap/AppShell";
import { Button } from "@/components/ui/button";
import {
  generateInsurerAlerts,
  getInsurerRiskWorkspace,
  removeInsurerWatchEntry,
  saveInsurerAlertRule,
  saveInsurerWatchEntry,
  setInsurerAlertStatus,
} from "@/lib/atap/insurerRisk.functions";
import {
  cellOnWatchlist,
  EVENT_LABEL,
  exposureForDistrict,
  filterRiskCells,
  SEVERITY_LABEL,
  summarizeRisk,
  uniqueStates,
  type RiskEvent,
  type RiskSeverity,
} from "@/lib/atap/insurerRisk";

export const Route = createFileRoute("/_authenticated/insurer-risk")({
  head: () => ({
    meta: [
      { title: "Crop monitoring & risk surveillance — AgriGhar ATAP" },
      {
        name: "description",
        content:
          "District×crop risk signals, insurer watchlists, configurable alert rules and advisory alerts for crop-insurance portfolios in Andhra Pradesh and Telangana.",
      },
      { property: "og:title", content: "Crop monitoring & risk surveillance — AgriGhar ATAP" },
      {
        property: "og:description",
        content:
          "Aggregate risk surveillance for insurers: watchlists, alert rules and advisory alerts. Claims decisions stay with authorised humans.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: InsurerRiskPage,
});

type Tab = "board" | "watchlist" | "rules" | "alerts";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "board", label: "Risk board" },
  { id: "watchlist", label: "Watchlist" },
  { id: "rules", label: "Alert rules" },
  { id: "alerts", label: "Alerts" },
];

const SEVERITY_BADGE: Record<RiskSeverity, string> = {
  watch: "bg-muted text-muted-foreground",
  advisory: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  severe: "bg-destructive/15 text-destructive",
};

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="panel p-4">
      <p className="field-hint">{label}</p>
      <p className="font-display text-2xl font-semibold">{value}</p>
      {hint ? <p className="field-hint">{hint}</p> : null}
    </div>
  );
}

function InsurerRiskPage() {
  const fetchWorkspace = useServerFn(getInsurerRiskWorkspace);
  const saveWatch = useServerFn(saveInsurerWatchEntry);
  const removeWatch = useServerFn(removeInsurerWatchEntry);
  const saveRule = useServerFn(saveInsurerAlertRule);
  const setStatus = useServerFn(setInsurerAlertStatus);
  const generate = useServerFn(generateInsurerAlerts);
  const queryClient = useQueryClient();

  const [tenantId, setTenantId] = useState<string | undefined>(undefined);
  const [tab, setTab] = useState<Tab>("board");
  const [message, setMessage] = useState<string | null>(null);
  const [stateFilter, setStateFilter] = useState("");
  const [severityFilter, setSeverityFilter] = useState<RiskSeverity | "all">("all");
  const [eventFilter, setEventFilter] = useState<RiskEvent | "all">("all");

  const workspace = useQuery({
    queryKey: ["insurer-risk", tenantId ?? "default"],
    queryFn: () => fetchWorkspace({ data: { ...(tenantId ? { tenantId } : {}) } }),
  });
  const data = workspace.data;
  const scopeId = data?.scope.tenantId ?? "";
  const canManage = Boolean(data?.scope.canManage);

  function refresh(text: string) {
    setMessage(text);
    void queryClient.invalidateQueries({ queryKey: ["insurer-risk"] });
  }

  const states = useMemo(() => uniqueStates(data?.cells ?? []), [data?.cells]);
  const filtered = useMemo(
    () =>
      filterRiskCells(data?.cells ?? [], {
        ...(stateFilter ? { state: stateFilter } : {}),
        severity: severityFilter,
        event: eventFilter,
      }),
    [data?.cells, stateFilter, severityFilter, eventFilter],
  );
  const summary = useMemo(() => summarizeRisk(filtered), [filtered]);
  const openAlerts = useMemo(
    () => (data?.alerts ?? []).filter((a) => a.status === "open"),
    [data?.alerts],
  );

  const watchMutation = useMutation({
    mutationFn: (input: { stateName: string; district: string; crop: string; season: string }) =>
      saveWatch({ data: { tenantId: scopeId, ...input } }),
    onSuccess: () => refresh("Watchlist entry saved."),
    onError: (e: Error) => setMessage(e.message),
  });
  const removeWatchMutation = useMutation({
    mutationFn: (watchId: string) => removeWatch({ data: { tenantId: scopeId, watchId } }),
    onSuccess: () => refresh("Watchlist entry removed."),
    onError: (e: Error) => setMessage(e.message),
  });
  const ruleMutation = useMutation({
    mutationFn: (input: { name: string; minSeverity: RiskSeverity; eventType: RiskEvent | null }) =>
      saveRule({ data: { tenantId: scopeId, ...input } }),
    onSuccess: () => refresh("Alert rule saved."),
    onError: (e: Error) => setMessage(e.message),
  });
  const statusMutation = useMutation({
    mutationFn: (input: { alertId: string; status: "acknowledged" | "dismissed" }) =>
      setStatus({ data: { tenantId: scopeId, ...input } }),
    onSuccess: (r) => refresh(`Alert ${r.status}.`),
    onError: (e: Error) => setMessage(e.message),
  });
  const generateMutation = useMutation({
    mutationFn: () => generate({ data: { tenantId: scopeId } }),
    onSuccess: (r) => refresh(`Evaluated risk cells — ${r.created} new advisory alert(s).`),
    onError: (e: Error) => setMessage(e.message),
  });

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4">
      <PageHeader
        title="Crop monitoring & risk surveillance"
        description={data?.advisory ?? "Aggregate district×crop risk signals for insurance portfolios."}
      />

      {data ? (
        <p className="rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
          {data.aggregateNote}
        </p>
      ) : null}

      {data && data.tenantOptions.length > 1 ? (
        <label className="flex items-center gap-2 text-sm">
          <span className="field-hint">Workspace</span>
          <select
            className="rounded-md border border-input bg-background px-2 py-1"
            value={data.scope.tenantId}
            onChange={(e) => setTenantId(e.target.value)}
          >
            {data.tenantOptions.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-md px-3 py-1.5 text-sm ${
              tab === t.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            {t.label}
            {t.id === "alerts" && openAlerts.length > 0 ? ` (${openAlerts.length})` : ""}
          </button>
        ))}
      </div>

      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      {workspace.isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
      {workspace.isError ? (
        <p className="text-sm text-destructive">{(workspace.error as Error).message}</p>
      ) : null}

      {data && tab === "board" ? (
        <section className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Kpi label="Active signals" value={String(summary.total)} />
            <Kpi label="Severe" value={String(summary.severe)} />
            <Kpi label="Affected acreage (aggregate)" value={summary.acres.toLocaleString("en-IN")} />
            <Kpi label="FPOs in signal areas" value={String(summary.fpos)} />
          </div>
          <div className="flex flex-wrap gap-3 text-sm">
            <select
              className="rounded-md border border-input bg-background px-2 py-1"
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value)}
            >
              <option value="">All states</option>
              {states.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <select
              className="rounded-md border border-input bg-background px-2 py-1"
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value as RiskSeverity | "all")}
            >
              <option value="all">All severities</option>
              <option value="watch">Watch</option>
              <option value="advisory">Advisory</option>
              <option value="severe">Severe</option>
            </select>
            <select
              className="rounded-md border border-input bg-background px-2 py-1"
              value={eventFilter}
              onChange={(e) => setEventFilter(e.target.value as RiskEvent | "all")}
            >
              <option value="all">All events</option>
              {(Object.keys(EVENT_LABEL) as RiskEvent[]).map((ev) => (
                <option key={ev} value={ev}>
                  {EVENT_LABEL[ev]}
                </option>
              ))}
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="p-2">Signal</th>
                  <th className="p-2">Severity</th>
                  <th className="p-2">Rainfall dev.</th>
                  <th className="p-2">Affected acres</th>
                  <th className="p-2">Your exposure</th>
                  <th className="p-2">Observed</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  const exp = exposureForDistrict(data.exposure, c.district);
                  const watched = cellOnWatchlist(c, data.watchlist);
                  return (
                    <tr key={c.id} className="border-b border-border/60">
                      <td className="p-2">
                        <p className="font-medium">
                          {EVENT_LABEL[c.event_type]} — {c.district}
                          {watched ? (
                            <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary">
                              watched
                            </span>
                          ) : null}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {c.crop} · {c.season} · {c.state_name}
                        </p>
                      </td>
                      <td className="p-2">
                        <span className={`rounded px-1.5 py-0.5 text-xs ${SEVERITY_BADGE[c.severity]}`}>
                          {SEVERITY_LABEL[c.severity]}
                        </span>
                      </td>
                      <td className="p-2">
                        {c.rainfall_deviation_pct != null
                          ? `${Math.round(c.rainfall_deviation_pct)}%`
                          : "—"}
                      </td>
                      <td className="p-2">
                        {c.affected_acres != null ? Math.round(c.affected_acres).toLocaleString("en-IN") : "—"}
                      </td>
                      <td className="p-2 text-xs">
                        {exp.fpos > 0
                          ? `${exp.fpos} FPOs · ${exp.insuredMembers.toLocaleString("en-IN")} insured members · ${exp.policies} policies`
                          : "No channel exposure"}
                      </td>
                      <td className="p-2 text-xs text-muted-foreground">
                        {new Date(c.observed_at).toLocaleDateString("en-IN")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {data && tab === "watchlist" ? (
        <section className="space-y-4">
          {canManage ? (
            <form
              className="panel flex flex-wrap items-end gap-3 p-4 text-sm"
              onSubmit={(e) => {
                e.preventDefault();
                const form = new FormData(e.currentTarget);
                watchMutation.mutate({
                  stateName: String(form.get("stateName") ?? ""),
                  district: String(form.get("district") ?? ""),
                  crop: String(form.get("crop") ?? ""),
                  season: String(form.get("season") ?? ""),
                });
                e.currentTarget.reset();
              }}
            >
              <label className="space-y-1">
                <span className="field-hint">State</span>
                <select name="stateName" className="rounded-md border border-input bg-background px-2 py-1" required>
                  {states.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className="field-hint">District</span>
                <input name="district" className="rounded-md border border-input bg-background px-2 py-1" required />
              </label>
              <label className="space-y-1">
                <span className="field-hint">Crop</span>
                <input name="crop" className="rounded-md border border-input bg-background px-2 py-1" required />
              </label>
              <label className="space-y-1">
                <span className="field-hint">Season</span>
                <select name="season" className="rounded-md border border-input bg-background px-2 py-1">
                  <option>Kharif</option>
                  <option>Rabi</option>
                </select>
              </label>
              <Button type="submit" size="sm" disabled={watchMutation.isPending}>
                Track district×crop
              </Button>
            </form>
          ) : (
            <p className="text-sm text-muted-foreground">
              Only an insurer administrator can edit the watchlist.
            </p>
          )}
          <ul className="space-y-2">
            {data.watchlist.map((w) => (
              <li key={w.id} className="panel flex items-center justify-between p-3 text-sm">
                <span>
                  <span className="font-medium">{w.district}</span> — {w.crop} · {w.season} · {w.state_name}
                </span>
                {canManage ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeWatchMutation.mutate(w.id)}
                    disabled={removeWatchMutation.isPending}
                  >
                    Remove
                  </Button>
                ) : null}
              </li>
            ))}
            {data.watchlist.length === 0 ? (
              <li className="text-sm text-muted-foreground">No watchlist entries yet.</li>
            ) : null}
          </ul>
        </section>
      ) : null}

      {data && tab === "rules" ? (
        <section className="space-y-4">
          {canManage ? (
            <form
              className="panel flex flex-wrap items-end gap-3 p-4 text-sm"
              onSubmit={(e) => {
                e.preventDefault();
                const form = new FormData(e.currentTarget);
                const ev = String(form.get("eventType") ?? "");
                ruleMutation.mutate({
                  name: String(form.get("name") ?? ""),
                  minSeverity: String(form.get("minSeverity") ?? "advisory") as RiskSeverity,
                  eventType: ev === "" ? null : (ev as RiskEvent),
                });
                e.currentTarget.reset();
              }}
            >
              <label className="space-y-1">
                <span className="field-hint">Rule name</span>
                <input name="name" className="rounded-md border border-input bg-background px-2 py-1" required />
              </label>
              <label className="space-y-1">
                <span className="field-hint">Event</span>
                <select name="eventType" className="rounded-md border border-input bg-background px-2 py-1">
                  <option value="">Any event</option>
                  {(Object.keys(EVENT_LABEL) as RiskEvent[]).map((ev) => (
                    <option key={ev} value={ev}>
                      {EVENT_LABEL[ev]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className="field-hint">Minimum severity</span>
                <select name="minSeverity" className="rounded-md border border-input bg-background px-2 py-1">
                  <option value="watch">Watch</option>
                  <option value="advisory">Advisory</option>
                  <option value="severe">Severe</option>
                </select>
              </label>
              <Button type="submit" size="sm" disabled={ruleMutation.isPending}>
                Add rule
              </Button>
            </form>
          ) : null}
          <ul className="space-y-2">
            {data.rules.map((r) => (
              <li key={r.id} className="panel flex items-center justify-between p-3 text-sm">
                <span>
                  <span className="font-medium">{r.name}</span> —{" "}
                  {r.event_type ? EVENT_LABEL[r.event_type] : "any event"} · min{" "}
                  {SEVERITY_LABEL[r.min_severity]}
                  {r.rainfall_deviation_threshold_pct != null
                    ? ` · rainfall deviation ≥ ${r.rainfall_deviation_threshold_pct}%`
                    : ""}
                </span>
                <span className="text-xs text-muted-foreground">{r.active ? "Active" : "Paused"}</span>
              </li>
            ))}
            {data.rules.length === 0 ? (
              <li className="text-sm text-muted-foreground">No alert rules configured.</li>
            ) : null}
          </ul>
        </section>
      ) : null}

      {data && tab === "alerts" ? (
        <section className="space-y-4">
          {canManage ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
            >
              Evaluate rules against current signals
            </Button>
          ) : null}
          <ul className="space-y-2">
            {data.alerts.map((a) => (
              <li key={a.id} className="panel space-y-1 p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">{a.title}</p>
                  <span className={`rounded px-1.5 py-0.5 text-xs ${SEVERITY_BADGE[a.severity]}`}>
                    {SEVERITY_LABEL[a.severity]}
                  </span>
                </div>
                {a.detail ? <p className="text-xs text-muted-foreground">{a.detail}</p> : null}
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-xs capitalize text-muted-foreground">{a.status}</span>
                  {canManage && a.status === "open" ? (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => statusMutation.mutate({ alertId: a.id, status: "acknowledged" })}
                      >
                        Acknowledge
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => statusMutation.mutate({ alertId: a.id, status: "dismissed" })}
                      >
                        Dismiss
                      </Button>
                    </>
                  ) : null}
                </div>
              </li>
            ))}
            {data.alerts.length === 0 ? (
              <li className="text-sm text-muted-foreground">
                No alerts yet. Configure alert rules, then evaluate them against current signals.
              </li>
            ) : null}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
