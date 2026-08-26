import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { StateBadge } from "@/components/atap/StatusBadge";
import { getInsightsBoard, searchWorkspace } from "@/lib/atap/fpoInsights.functions";
import {
  filterTimeline,
  formatMetric,
  groupHits,
  groupMetrics,
  SEARCH_KIND_LABEL,
} from "@/lib/atap/fpoInsights";
import { FPO_SECTION_DEFS, type FpoSection } from "@/lib/atap/fpo";

const input =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground";
const card = "rounded-lg border border-border bg-card p-4";

export function FpoInsightsSection({
  tenantId,
  onOpenSection,
}: {
  tenantId: string;
  onOpenSection?: (section: FpoSection) => void;
}) {
  const boardFn = useServerFn(getInsightsBoard);
  const searchFn = useServerFn(searchWorkspace);

  const [sectionFilter, setSectionFilter] = useState<FpoSection | "all">("all");
  const [decisionFilter, setDecisionFilter] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");

  const board = useQuery({
    queryKey: ["atap", "fpo-insights", tenantId],
    queryFn: () => boardFn({ data: { tenantId } }),
    enabled: Boolean(tenantId),
  });

  const results = useQuery({
    queryKey: ["atap", "fpo-search", tenantId, submitted],
    queryFn: () => searchFn({ data: { tenantId, query: submitted } }),
    enabled: Boolean(tenantId) && submitted.trim().length >= 2,
  });

  const data = board.data;
  const groups = useMemo(() => groupMetrics(data?.metrics ?? []), [data]);
  const timeline = useMemo(
    () =>
      filterTimeline(data?.timeline ?? [], {
        section: sectionFilter,
        decision: decisionFilter,
      }),
    [data, sectionFilter, decisionFilter],
  );
  const hits = results.data?.hits ?? [];

  if (board.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading insights…</p>;
  }
  if (board.error) {
    return <p className="text-sm text-destructive">{(board.error as Error).message}</p>;
  }
  if (!data) return null;

  return (
    <div className="space-y-6">
      <section className="panel space-y-4 p-5">
        <div className="space-y-1">
          <h2 className="font-display text-base font-semibold">Universal search</h2>
          <p className="field-hint">{data.disclaimers.search}</p>
        </div>
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setSubmitted(query);
          }}
        >
          <input
            className={`${input} max-w-md flex-1`}
            placeholder="Search members, applications, lots, ledger, tasks, team…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search this organization"
          />
          <Button type="submit" disabled={query.trim().length < 2}>
            Search
          </Button>
        </form>
        {submitted.trim().length >= 2 ? (
          results.isLoading ? (
            <p className="text-sm text-muted-foreground">Searching…</p>
          ) : hits.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No records in this organization match “{submitted}”.
            </p>
          ) : (
            <div className="space-y-4">
              {groupHits(hits).map((group) => (
                <div key={group.kind} className="space-y-2">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {SEARCH_KIND_LABEL[group.kind]}
                  </p>
                  <ul className="space-y-2">
                    {group.hits.map((hit) => (
                      <li
                        key={`${hit.kind}-${hit.id}`}
                        className={`${card} flex flex-wrap items-center justify-between gap-3`}
                      >
                        <div>
                          <p className="text-sm font-medium">{hit.title}</p>
                          {hit.subtitle ? (
                            <p className="text-xs text-muted-foreground">{hit.subtitle}</p>
                          ) : null}
                        </div>
                        {onOpenSection ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onOpenSection(hit.section as FpoSection)}
                          >
                            Open {hit.section}
                          </Button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )
        ) : null}
      </section>

      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="font-display text-base font-semibold">Operational insights</h2>
          <p className="field-hint">{data.disclaimers.insights}</p>
        </div>
        {data.attention.length > 0 ? (
          <ul className="space-y-2">
            {data.attention.map((item) => (
              <li
                key={item.key}
                className={`${card} flex flex-wrap items-center justify-between gap-3`}
              >
                <span className="text-sm">
                  <StateBadge state={item.severity === "warning" ? "pending" : "info"} />{" "}
                  {item.label}
                </span>
                {onOpenSection ? (
                  <Button variant="outline" size="sm" onClick={() => onOpenSection(item.section)}>
                    Review
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Nothing needs attention right now.</p>
        )}

        {groups.map((group) => (
          <div key={group.group} className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{group.label}</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {group.cards.map((metric) => (
                <button
                  key={metric.key}
                  type="button"
                  className={`${card} text-left`}
                  onClick={() => onOpenSection?.(metric.section)}
                >
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {metric.label}
                  </p>
                  <p className="mt-1 text-2xl font-bold">{formatMetric(metric)}</p>
                  <p className="mt-1 text-[11px] font-medium tracking-wide text-muted-foreground">
                    {metric.basis}
                  </p>
                  {metric.hint ? (
                    <p className="mt-1 text-xs text-muted-foreground">{metric.hint}</p>
                  ) : null}
                </button>
              ))}
            </div>
          </div>
        ))}
      </section>

      <section className="panel space-y-4 p-5">
        <div className="space-y-1">
          <h2 className="font-display text-base font-semibold">Activity timeline</h2>
          <p className="field-hint">{data.disclaimers.timeline}</p>
        </div>
        {!data.canSeeTimeline ? (
          <p className="text-sm text-muted-foreground">
            The audited activity trail is visible to organization admins and auditors only.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              <select
                className={`${input} max-w-xs`}
                value={sectionFilter}
                onChange={(e) => setSectionFilter(e.target.value as FpoSection | "all")}
                aria-label="Filter by section"
              >
                <option value="all">All sections</option>
                {FPO_SECTION_DEFS.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
              <select
                className={`${input} max-w-xs`}
                value={decisionFilter}
                onChange={(e) => setDecisionFilter(e.target.value)}
                aria-label="Filter by decision"
              >
                <option value="all">All outcomes</option>
                <option value="allow">Allowed</option>
                <option value="deny">Denied</option>
              </select>
            </div>
            {timeline.length === 0 ? (
              <p className="text-sm text-muted-foreground">No audited activity for this filter.</p>
            ) : (
              <ol className="space-y-2">
                {timeline.map((entry) => (
                  <li key={entry.id} className={card}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium">{entry.label}</p>
                      <span className="text-xs text-muted-foreground">
                        {new Date(entry.at).toLocaleString()}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {entry.section} · {entry.decision}
                      {entry.detail ? ` · ${entry.detail}` : ""}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </>
        )}
      </section>
    </div>
  );
}
