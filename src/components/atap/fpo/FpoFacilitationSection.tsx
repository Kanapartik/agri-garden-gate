import { useLanguage } from "@/components/atap/LanguageProvider";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { StateBadge } from "@/components/atap/StatusBadge";
import {
  createMemberCampaign,
  getFacilitationBoard,
  setFacilitationState,
} from "@/lib/atap/fpoApplications.functions";
import {
  FACILITATION_STATE_LABEL,
  CAMPAIGN_STATUS_LABEL,
  nextFacilitationStates,
  type FacilitationState,
} from "@/lib/atap/fpoApplications";

export function FpoFacilitationSection({ tenantId }: { tenantId: string }) {
  const { t } = useLanguage();
  const qc = useQueryClient();
  const boardFn = useServerFn(getFacilitationBoard);
  const createFn = useServerFn(createMemberCampaign);
  const stateFn = useServerFn(setFacilitationState);

  const board = useQuery({
    queryKey: ["fpo-facilitation-board", tenantId],
    queryFn: () => boardFn({ data: { tenantId } }),
    enabled: Boolean(tenantId),
  });

  const [name, setName] = useState("");
  const [schemeId, setSchemeId] = useState("");

  const invalidate = () => qc.invalidateQueries({ queryKey: ["fpo-facilitation-board", tenantId] });

  const create = useMutation({
    mutationFn: () => createFn({ data: { tenantId, name, schemeId: schemeId || null } }),
    onSuccess: async () => {
      toast.success(t("fpo.ui.a89a841b0c"));
      setName("");
      await invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const move = useMutation({
    mutationFn: (input: { cohortMemberId: string; state: FacilitationState }) =>
      stateFn({ data: { tenantId, ...input } }),
    onSuccess: async () => {
      toast.success(t("fpo.ui.3068bf6e58"));
      await invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!tenantId) {
    return (
      <section className="panel p-5 text-sm text-muted-foreground">
        {t("fpo.ui.209cdaf26d")}</section>
    );
  }
  if (board.isLoading) {
    return <section className="panel p-5 text-sm">{t("fpo.ui.f7471f84c3")}</section>;
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
      <section className="panel space-y-2 p-5">
        <h2 className="font-display text-base font-semibold">{t("fpo.ui.5551485e9f")}</h2>
        <p className="field-hint">{data.disclaimer}</p>
      </section>

      {data.campaigns.map((c) => (
        <section key={c.id} className="panel space-y-3 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-display text-sm font-semibold">{c.name}</h3>
              <p className="field-hint">
                {c.scheme_title ?? "No scheme linked"} · {CAMPAIGN_STATUS_LABEL[c.status]}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              {(
                [
                  "identified",
                  "notified",
                  "authorization_pending",
                  "authorized",
                ] as FacilitationState[]
              ).map((s) => (
                <span key={s} className="rounded-md border border-border px-2 py-1">
                  {FACILITATION_STATE_LABEL[s]}: <strong>{c.counts[s]}</strong>
                </span>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-2">{t("fpo.ui.6853c98a6f")}</th>
                  <th className="py-2">{t("fpo.ui.ca6d0e3aaa")}</th>
                  <th className="py-2">{t("fpo.ui.3ac90dc608")}</th>
                  <th className="py-2">{t("fpo.ui.c3cd636a58")}</th>
                </tr>
              </thead>
              <tbody>
                {c.members.map((m) => (
                  <tr key={m.id} className="border-t border-border">
                    <td className="py-2">{m.display_name}</td>
                    <td className="py-2">
                      <StateBadge state={FACILITATION_STATE_LABEL[m.state]} />
                    </td>
                    <td className="py-2 text-xs">
                      {m.has_assistance_consent
                        ? "Scheme assistance authorized"
                        : "Not authorized — assistance blocked"}
                    </td>
                    <td className="py-2">
                      {data.canManage ? (
                        <select
                          className="input-field"
                          value=""
                          onChange={(e) =>
                            move.mutate({
                              cohortMemberId: m.id,
                              state: e.target.value as FacilitationState,
                            })
                          }
                        >
                          <option value="">{t("fpo.ui.c0a3ef619a")}</option>
                          {nextFacilitationStates(m.state).map((s) => (
                            <option key={s} value={s}>
                              {FACILITATION_STATE_LABEL[s]}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="field-hint">{t("fpo.ui.5559dd041f")}</span>
                      )}
                    </td>
                  </tr>
                ))}
                {c.members.length === 0 ? (
                  <tr>
                    <td className="py-4 text-sm text-muted-foreground" colSpan={4}>
                      {t("fpo.ui.183b6f107a")}</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      {data.campaigns.length === 0 ? (
        <section className="panel p-5 text-sm text-muted-foreground">
          {t("fpo.ui.9090608cd4")}</section>
      ) : null}

      {data.canManage ? (
        <section className="panel space-y-3 p-5">
          <h3 className="font-display text-sm font-semibold">{t("fpo.ui.c9b732d2ec")}</h3>
          <div className="grid gap-2 md:grid-cols-2">
            <input
              className="input-field"
              placeholder={t("fpo.ui.aa5d0e720b")}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <select
              className="input-field"
              value={schemeId}
              onChange={(e) => setSchemeId(e.target.value)}
            >
              <option value="">{t("fpo.ui.e245fe4ff5")}</option>
              {data.schemes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
          </div>
          <Button
            size="sm"
            disabled={!name.trim() || create.isPending}
            onClick={() => create.mutate()}
          >
            {t("fpo.ui.59812bbcc7")}</Button>
        </section>
      ) : null}
    </div>
  );
}
