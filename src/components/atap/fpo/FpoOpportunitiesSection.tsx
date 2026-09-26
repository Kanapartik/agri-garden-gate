import { useLanguage } from "@/components/atap/LanguageProvider";
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
  const { t } = useLanguage();
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
      toast.success(t("fpo.ui.6ac4a919ba"));
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
        {t("fpo.ui.cd1a0501e8")}</section>
    );
  }
  if (board.isLoading) {
    return <section className="panel p-5 text-sm">{t("fpo.ui.78fc889e3f")}</section>;
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
        <h2 className="font-display text-base font-semibold">{t("fpo.ui.ab1bbd3336")}</h2>
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
            placeholder={t("fpo.ui.f850a8af52")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="field-base"
            value={category}
            onChange={(e) => setCategory(e.target.value as OpportunityCategory | "")}
          >
            <option value="">{t("fpo.ui.060be00f4f")}</option>
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
              {t("fpo.ui.37bdf89e17")}</label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={geoOnly}
                onChange={(e) => setGeoOnly(e.target.checked)}
              />
              {t("fpo.ui.de62fe74bb")}</label>
          </div>
        </div>
        <p className="field-hint">
          {cards.length} {t("fpo.ui.de04fa0e29")}{" "}{data.cards.length} {t("fpo.ui.4c171cb67c")}</p>
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
            <p className="text-sm text-muted-foreground">{t("fpo.ui.126beee3cd")}{" "}{c.eligibility_summary}</p>

            <dl className="grid gap-1 text-sm sm:grid-cols-2">
              <div>
                <dt className="field-hint">{t("fpo.ui.77fc6221d7")}</dt>
                <dd>
                  {c.geography_note ??
                    ([c.district_code, c.state_code].filter(Boolean).join(", ") || "All districts")}
                </dd>
              </div>
              <div>
                <dt className="field-hint">{t("fpo.ui.2b12f36924")}</dt>
                <dd>
                  {c.application_deadline
                    ? `${c.application_deadline}${c.daysLeft !== null ? ` (${c.daysLeft} days)` : ""}`
                    : "Rolling"}
                </dd>
              </div>
              <div>
                <dt className="field-hint">{t("fpo.ui.6abb1b41c4")}</dt>
                <dd>{c.commodities.length ? c.commodities.join(", ") : "Any"}</dd>
              </div>
              <div>
                <dt className="field-hint">{t("fpo.ui.6da13addb0")}</dt>
                <dd>
                  {c.source_name}
                  {c.last_verified_at ? ` · verified ${c.last_verified_at.slice(0, 10)}` : ""}
                </dd>
              </div>
            </dl>

            {c.required_documents.length ? (
              <div className="text-sm">
                <p className="field-hint">{t("fpo.ui.69adaf521c")}</p>
                <ul className="list-disc pl-5 text-muted-foreground">
                  {c.required_documents.map((d) => (
                    <li key={d}>{d}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {!c.open ? (
              <p className="text-sm text-muted-foreground">
                {t("fpo.ui.9016727ce2")}</p>
            ) : null}
            {!c.inGeography ? (
              <p className="text-sm text-muted-foreground">
                {t("fpo.ui.f9c3634488")}</p>
            ) : null}

            {c.note ? <p className="text-sm">{t("fpo.ui.83423c198b")}{" "}{c.note}</p> : null}

            {canManage ? (
              <div className="space-y-2">
                <input
                  className="field-base"
                  placeholder={t("fpo.ui.cf1db178d8")}
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
                {t("fpo.ui.d37776259e")}</p>
            )}
          </article>
        ))}
      </div>

      {cards.length === 0 ? (
        <section className="panel p-5 text-sm text-muted-foreground">
          {t("fpo.ui.96ef50416b")}</section>
      ) : null}
    </div>
  );
}
