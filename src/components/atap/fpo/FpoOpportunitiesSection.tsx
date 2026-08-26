import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { StateBadge } from "@/components/atap/StatusBadge";
import { getOpportunityBoard, setOpportunityTracking } from "@/lib/atap/fpoOpportunities.functions";
import {
  canTransitionTracking,
  filterCards,
  OPPORTUNITY_CATEGORY_LABEL,
  TRACK_STATUS_LABEL,
  TRACK_STATUSES,
  type OpportunityCategory,
  type TrackStatus,
} from "@/lib/atap/fpoOpportunities";

export function FpoOpportunitiesSection({ tenantId }: { tenantId: string }) {
  const qc = useQueryClient();
  const boardFn = useServerFn(getOpportunityBoard);
  const trackFn = useServerFn(setOpportunityTracking);

  const board = useQuery({
    queryKey: ["fpo-opportunities", tenantId],
    queryFn: () => boardFn({ data: { tenantId } }),
    enabled: Boolean(tenantId),
  });

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<OpportunityCategory | "">("");
  const [status, setStatus] = useState<TrackStatus | "">("");
  const [openOnly, setOpenOnly] = useState(true);
  const [geoOnly, setGeoOnly] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const track = useMutation({
    mutationFn: (input: {
      opportunityId: string;
      status: TrackStatus;
      note?: string | null;
      assignToMe?: boolean;
    }) => trackFn({ data: { tenantId, ...input } }),
    onSuccess: async () => {
      toast.success("Opportunity updated");
      await qc.invalidateQueries({ queryKey: ["fpo-opportunities", tenantId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cards = useMemo(
    () =>
      filterCards(board.data?.cards ?? [], {
        search,
        categories: category ? [category] : undefined,
        statuses: status ? [status] : undefined,
        openOnly,
        onlyMyGeography: geoOnly,
      }),
    [board.data, search, category, status, openOnly, geoOnly],
  );

  if (!tenantId) {
    return (
      <section className="panel p-5 text-sm text-muted-foreground">
        Select an FPO organization to see its opportunities.
      </section>
    );
  }
  if (board.isLoading) {
    return <section className="panel p-5 text-sm">Loading opportunities…</section>;
  }
  if (board.isError) {
    return (
      <section className="panel p-5 text-sm text-muted-foreground">
        {(board.error as Error).message}
      </section>
    );
  }

  const data = board.data!;
  const canManage = data.canManage;

  return (
    <div className="space-y-6">
      <section className="panel space-y-3 p-5">
        <h2 className="font-display text-base font-semibold">Opportunity Center</h2>
        <p className="field-hint">{data.advisory}</p>
        <div className="flex flex-wrap gap-2 text-sm">
          {TRACK_STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(status === s ? "" : s)}
              className={`rounded-md border px-3 py-1 ${status === s ? "border-primary" : "border-border"}`}
            >
              {TRACK_STATUS_LABEL[s]} · {data.counts[s]}
            </button>
          ))}
        </div>
      </section>

      <section className="panel space-y-3 p-5">
        <div className="grid gap-3 md:grid-cols-3">
          <input
            className="field-base"
            placeholder="Search title, provider or benefit"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="field-base"
            value={category}
            onChange={(e) => setCategory(e.target.value as OpportunityCategory | "")}
          >
            <option value="">All categories</option>
            {data.categories.map((c) => (
              <option key={c} value={c}>
                {OPPORTUNITY_CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={openOnly}
                onChange={(e) => setOpenOnly(e.target.checked)}
              />
              Open only
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={geoOnly}
                onChange={(e) => setGeoOnly(e.target.checked)}
              />
              My geography
            </label>
          </div>
        </div>
        <p className="field-hint">
          {cards.length} of {data.cards.length} opportunities shown. Ordering is a transparent
          relevance hint based on member crops, geography and deadline — nothing is hidden.
        </p>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {cards.map((c) => (
          <article key={c.id} className="panel space-y-3 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-display text-base font-semibold">{c.title}</h3>
                <p className="text-sm text-muted-foreground">
                  {OPPORTUNITY_CATEGORY_LABEL[c.category]} · {c.provider_name}
                </p>
              </div>
              <StateBadge state={c.status} />
            </div>

            <p className="text-sm">{c.benefit_summary}</p>
            <p className="text-sm text-muted-foreground">Eligibility: {c.eligibility_summary}</p>

            <dl className="grid gap-1 text-sm sm:grid-cols-2">
              <div>
                <dt className="field-hint">Geography</dt>
                <dd>
                  {c.geography_note ??
                    ([c.district_code, c.state_code].filter(Boolean).join(", ") || "All districts")}
                </dd>
              </div>
              <div>
                <dt className="field-hint">Deadline</dt>
                <dd>
                  {c.application_deadline
                    ? `${c.application_deadline}${c.daysLeft !== null ? ` (${c.daysLeft} days)` : ""}`
                    : "Rolling"}
                </dd>
              </div>
              <div>
                <dt className="field-hint">Commodities</dt>
                <dd>{c.commodities.length ? c.commodities.join(", ") : "Any"}</dd>
              </div>
              <div>
                <dt className="field-hint">Source</dt>
                <dd>
                  {c.source_name}
                  {c.last_verified_at ? ` · verified ${c.last_verified_at.slice(0, 10)}` : ""}
                </dd>
              </div>
            </dl>

            {c.required_documents.length ? (
              <div className="text-sm">
                <p className="field-hint">Documents required</p>
                <ul className="list-disc pl-5 text-muted-foreground">
                  {c.required_documents.map((d) => (
                    <li key={d}>{d}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {!c.open ? (
              <p className="text-sm text-muted-foreground">
                Closed for applications — kept visible for the record.
              </p>
            ) : null}
            {!c.inGeography ? (
              <p className="text-sm text-muted-foreground">
                Outside this FPO&apos;s recorded geography — verify with the provider before
                applying.
              </p>
            ) : null}

            {c.note ? <p className="text-sm">Note: {c.note}</p> : null}

            {canManage ? (
              <div className="space-y-2">
                <input
                  className="field-base"
                  placeholder="Internal note (optional)"
                  value={notes[c.id] ?? ""}
                  onChange={(e) => setNotes((n) => ({ ...n, [c.id]: e.target.value }))}
                />
                <div className="flex flex-wrap gap-2">
                  {TRACK_STATUSES.filter((s) => canTransitionTracking(c.status, s)).map((s) => (
                    <Button
                      key={s}
                      size="sm"
                      variant="outline"
                      disabled={track.isPending}
                      onClick={() =>
                        track.mutate({
                          opportunityId: c.id,
                          status: s,
                          note: notes[c.id] ?? c.note,
                          assignToMe: s === "reviewing" || s === "shortlisted",
                        })
                      }
                    >
                      {TRACK_STATUS_LABEL[s]}
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              <p className="field-hint">
                Only an FPO admin or scheme reviewer can change tracking status.
              </p>
            )}
          </article>
        ))}
      </div>

      {cards.length === 0 ? (
        <section className="panel p-5 text-sm text-muted-foreground">
          No opportunities match these filters.
        </section>
      ) : null}
    </div>
  );
}
