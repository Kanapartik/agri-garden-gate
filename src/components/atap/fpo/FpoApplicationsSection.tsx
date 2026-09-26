import { useLanguage } from "@/components/atap/LanguageProvider";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { StateBadge } from "@/components/atap/StatusBadge";
import {
  createFpoApplication,
  getApplicationBoard,
  getApplicationHistory,
  setFpoApplicationStatus,
} from "@/lib/atap/fpoApplications.functions";
import {
  APPLICATION_STATUSES,
  APPLICATION_STATUS_LABEL,
  filterApplications,
  isDecisionStatus,
  nextApplicationStatuses,
  submissionReadiness,
  type ApplicationStatus,
} from "@/lib/atap/fpoApplications";

export function FpoApplicationsSection({ tenantId }: { tenantId: string }) {
  const { t } = useLanguage();
  const qc = useQueryClient();
  const boardFn = useServerFn(getApplicationBoard);
  const createFn = useServerFn(createFpoApplication);
  const statusFn = useServerFn(setFpoApplicationStatus);
  const historyFn = useServerFn(getApplicationHistory);

  const board = useQuery({
    queryKey: ["fpo-application-board", tenantId],
    queryFn: () => boardFn({ data: { tenantId } }),
    enabled: Boolean(tenantId),
  });

  const [status, setStatus] = useState<ApplicationStatus | "">("");
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [schemeId, setSchemeId] = useState("");
  const [title, setTitle] = useState("");
  const [pendingDocs, setPendingDocs] = useState("");

  const history = useQuery({
    queryKey: ["fpo-application-history", tenantId, openId],
    queryFn: () => historyFn({ data: { tenantId, applicationId: openId ?? "" } }),
    enabled: Boolean(tenantId && openId),
  });

  const invalidate = async () => {
    await qc.invalidateQueries({ queryKey: ["fpo-application-board", tenantId] });
    await qc.invalidateQueries({ queryKey: ["fpo-application-history", tenantId] });
  };

  const create = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          tenantId,
          schemeId,
          title,
          pendingDocuments: pendingDocs
            .split(",")
            .map((d) => d.trim())
            .filter(Boolean),
        },
      }),
    onSuccess: async () => {
      toast.success(t("fpo.ui.8d6e416842"));
      setTitle("");
      setPendingDocs("");
      await invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const move = useMutation({
    mutationFn: (input: { applicationId: string; status: ApplicationStatus }) =>
      statusFn({ data: { tenantId, ...input } }),
    onSuccess: async () => {
      toast.success(t("fpo.ui.ba10cc4aba"));
      await invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = useMemo(
    () => filterApplications(board.data?.applications ?? [], { search, status }),
    [board.data, search, status],
  );

  if (!tenantId) {
    return (
      <section className="panel p-5 text-sm text-muted-foreground">
        {t("fpo.ui.b41af42908")}</section>
    );
  }
  if (board.isLoading) {
    return <section className="panel p-5 text-sm">{t("fpo.ui.b37eb242dc")}</section>;
  }
  if (board.isError) {
    return (
      <section className="panel p-5 text-sm text-muted-foreground">
        {(board.error as Error).message}
      </section>
    );
  }

  const data = board.data!;

  return (
    <div className="space-y-6">
      <section className="panel space-y-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-semibold">{t("fpo.ui.72f003f3df")}</h2>
            <p className="field-hint">{data.disclaimer}</p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            {(
              [
                "draft",
                "documents_pending",
                "submitted",
                "under_review",
                "approved",
              ] as ApplicationStatus[]
            ).map((s) => (
              <span key={s} className="rounded-md border border-border px-2 py-1">
                {APPLICATION_STATUS_LABEL[s]}: <strong>{data.counts[s]}</strong>
              </span>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <input
            className="input-field max-w-xs"
            placeholder={t("fpo.ui.58a7917fca")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="input-field max-w-xs"
            value={status}
            onChange={(e) => setStatus(e.target.value as ApplicationStatus | "")}
          >
            <option value="">{t("fpo.ui.17e9b24055")}</option>
            {APPLICATION_STATUSES.map((s) => (
              <option key={s} value={s}>
                {APPLICATION_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="py-2">{t("fpo.ui.b291beb879")}</th>
                <th className="py-2">{t("fpo.ui.990897a59f")}</th>
                <th className="py-2">{t("fpo.ui.ca6d0e3aaa")}</th>
                <th className="py-2">{t("fpo.ui.1337ed1e2d")}</th>
                <th className="py-2">{t("fpo.ui.c3cd636a58")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const readiness = submissionReadiness(row, { isSignatory: data.isSignatory });
                return (
                  <tr key={row.id} className="border-t border-border align-top">
                    <td className="py-2">
                      <button
                        className="text-left font-medium underline"
                        onClick={() => setOpenId(row.id)}
                      >
                        {row.title}
                      </button>
                      <div className="field-hint">{row.reference_no ?? "No reference yet"}</div>
                    </td>
                    <td className="py-2">{row.scheme_title}</td>
                    <td className="py-2">
                      <StateBadge state={APPLICATION_STATUS_LABEL[row.status]} />
                    </td>
                    <td className="py-2 text-xs">
                      {row.pending_documents.length > 0 ? row.pending_documents.join(", ") : "None"}
                      {row.requires_signatory ? (
                        <div className="field-hint">{t("fpo.ui.e69e5b74d6")}</div>
                      ) : null}
                    </td>
                    <td className="py-2">
                      {data.canManage ? (
                        <select
                          className="input-field"
                          value=""
                          onChange={(e) =>
                            move.mutate({
                              applicationId: row.id,
                              status: e.target.value as ApplicationStatus,
                            })
                          }
                        >
                          <option value="">{t("fpo.ui.c0a3ef619a")}</option>
                          {nextApplicationStatuses(row.status)
                            .filter((s) => !isDecisionStatus(s) || data.canDecide)
                            .filter((s) => s !== "submitted" || readiness.ready)
                            .map((s) => (
                              <option key={s} value={s}>
                                {APPLICATION_STATUS_LABEL[s]}
                              </option>
                            ))}
                        </select>
                      ) : (
                        <span className="field-hint">{t("fpo.ui.5559dd041f")}</span>
                      )}
                      {!readiness.ready && row.status === "ready_to_submit" ? (
                        <div className="field-hint">{readiness.blockers.join("; ")}</div>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 ? (
                <tr>
                  <td className="py-4 text-sm text-muted-foreground" colSpan={5}>
                    {t("fpo.ui.52dc925ecf")}</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {openId ? (
        <section className="panel space-y-2 p-5">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-sm font-semibold">{t("fpo.ui.8597eab28c")}</h3>
            <Button variant="ghost" size="sm" onClick={() => setOpenId(null)}>
              {t("fpo.ui.bbfa773e5a")}</Button>
          </div>
          <p className="field-hint">
            {t("fpo.ui.953dcf1239")}</p>
          <ul className="space-y-1 text-sm">
            {(history.data ?? []).map((e) => (
              <li key={e.id} className="border-t border-border py-2">
                {e.from_status ? `${APPLICATION_STATUS_LABEL[e.from_status]} → ` : ""}
                <strong>{APPLICATION_STATUS_LABEL[e.to_status]}</strong>
                <span className="field-hint"> {new Date(e.created_at).toLocaleString()}</span>
                {e.note ? <div className="field-hint">{e.note}</div> : null}
              </li>
            ))}
            {(history.data ?? []).length === 0 ? (
              <li className="field-hint">{t("fpo.ui.ebab110701")}</li>
            ) : null}
          </ul>
        </section>
      ) : null}

      {data.canManage ? (
        <section className="panel space-y-3 p-5">
          <h3 className="font-display text-sm font-semibold">{t("fpo.ui.9d878ad11d")}</h3>
          <div className="grid gap-2 md:grid-cols-3">
            <select
              className="input-field"
              value={schemeId}
              onChange={(e) => setSchemeId(e.target.value)}
            >
              <option value="">{t("fpo.ui.728181f1b3")}</option>
              {data.schemes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
            <input
              className="input-field"
              placeholder={t("fpo.ui.ee3ac8b2de")}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <input
              className="input-field"
              placeholder={t("fpo.ui.693ce87d9e")}
              value={pendingDocs}
              onChange={(e) => setPendingDocs(e.target.value)}
            />
          </div>
          <Button
            size="sm"
            disabled={!schemeId || !title.trim() || create.isPending}
            onClick={() => create.mutate()}
          >
            {t("fpo.ui.5f4293a2c3")}</Button>
        </section>
      ) : null}
    </div>
  );
}
