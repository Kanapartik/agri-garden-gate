import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/components/atap/LanguageProvider";
import {
  createNote,
  listMonitoring,
  saveSummary,
  summarizeMonitoring,
} from "@/lib/atap/fpoMonitoring.functions";
import { AI_DISCLAIMER, MONITORING_CATEGORIES, MONITORING_SEVERITIES } from "@/lib/atap/fpoMonitoring";

type Draft = { summary: string; questions: string[]; model: string; noteIds: string[] };

export function FpoMonitoringSection({ tenantId }: { tenantId: string }) {
  const { t } = useLanguage();
  const qc = useQueryClient();
  const list = useServerFn(listMonitoring);
  const add = useServerFn(createNote);
  const summarize = useServerFn(summarizeMonitoring);
  const save = useServerFn(saveSummary);

  const [memberId, setMemberId] = useState("");
  const [observedOn, setObservedOn] = useState(new Date().toISOString().slice(0, 10));
  const [crop, setCrop] = useState("");
  const [category, setCategory] = useState<string>("pest");
  const [severity, setSeverity] = useState<string>("low");
  const [body, setBody] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);

  const key = ["atap", "fpo-monitoring", tenantId, memberId];
  const q = useQuery({
    queryKey: key,
    queryFn: () => list({ data: { tenantId, ...(memberId ? { memberId } : {}) } }),
    enabled: Boolean(tenantId),
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["atap", "fpo-monitoring", tenantId] });

  const addM = useMutation({
    mutationFn: () =>
      add({ data: { tenantId, memberId, observedOn, crop, category, severity, body } }),
    onSuccess: async () => {
      toast.success(t("fpo.mon.saved"));
      setBody("");
      await refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const sumM = useMutation({
    mutationFn: () => summarize({ data: { tenantId, memberId } }),
    onSuccess: (r) => setDraft({ summary: r.summary, questions: r.questions, model: r.model, noteIds: r.noteIds }),
    onError: (e: Error) => toast.error(e.message),
  });
  const saveM = useMutation({
    mutationFn: () => save({ data: { tenantId, memberId, ...draft! } }),
    onSuccess: async () => {
      toast.success(t("fpo.mon.reviewedSaved"));
      setDraft(null);
      await refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const d = q.data;

  return (
    <div className="space-y-6">
      <section className="panel space-y-3 p-5">
        <h2 className="font-display text-base font-semibold">{t("fpo.mon.title")}</h2>
        <p className="field-hint">
          {t("fpo.mon.hint")}</p>
        <select
          className="field-base max-w-md"
          value={memberId}
          onChange={(e) => {
            setMemberId(e.target.value);
            setDraft(null);
          }}
        >
          <option value="">{t("fpo.mon.pick")}</option>
          {(d?.members ?? []).map((m) => (
            <option key={m.id} value={m.id}>
              {m.display_name} · {m.member_ref}
            </option>
          ))}
        </select>
      </section>

      {memberId && q.isLoading ? <p className="text-sm text-muted-foreground">{t("fpo.mon.loading")}</p> : null}

      {memberId && d && !d.consented ? (
        <section className="panel p-5">
          <h3 className="font-display text-sm font-semibold">{t("fpo.mon.consentReq")}</h3>
          <p className="text-sm text-muted-foreground">
            {t("fpo.mon.consentBody")}</p>
        </section>
      ) : null}

      {memberId && d?.consented ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="panel space-y-3 p-5">
            <h3 className="font-display text-sm font-semibold">{t("fpo.mon.add")}</h3>
            {d.canWrite ? (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <input type="date" className="field-base" value={observedOn} onChange={(e) => setObservedOn(e.target.value)} />
                  <input className="field-base" placeholder={t("fpo.mon.crop")} value={crop} onChange={(e) => setCrop(e.target.value)} />
                  <select className="field-base" value={category} onChange={(e) => setCategory(e.target.value)}>
                    {MONITORING_CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <select className="field-base" value={severity} onChange={(e) => setSeverity(e.target.value)}>
                    {MONITORING_SEVERITIES.map((s) => (
                      <option key={s} value={s}>{s} {t("fpo.mon.severity")}</option>
                    ))}
                  </select>
                </div>
                <textarea
                  className="field-base min-h-24"
                  placeholder={t("fpo.mon.body")}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                />
                <Button onClick={() => addM.mutate()} disabled={body.trim().length < 5 || addM.isPending}>
                  {t("fpo.mon.save")}</Button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">{t("fpo.mon.readOnly")}</p>
            )}

            <div className="space-y-2 border-t border-border pt-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-display text-sm font-semibold">{t("fpo.mon.ai")}</h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => sumM.mutate()}
                  disabled={sumM.isPending || d.notes.length === 0}
                >
                  {sumM.isPending ? t("fpo.mon.summarizing") : t("fpo.mon.summarize")}
                </Button>
              </div>
              {draft ? (
                <div className="space-y-2 rounded-md border border-border bg-secondary/40 p-3 text-sm">
                  <p className="text-xs font-medium text-muted-foreground">{AI_DISCLAIMER}</p>
                  <p>{draft.summary}</p>
                  {draft.questions.length > 0 ? (
                    <>
                      <p className="font-medium">{t("fpo.mon.followUp")}</p>
                      <ol className="list-decimal pl-5">
                        {draft.questions.map((qq, i) => (
                          <li key={i}>{qq}</li>
                        ))}
                      </ol>
                    </>
                  ) : null}
                  <div className="flex gap-2">
                    {d.canWrite ? (
                      <Button size="sm" onClick={() => saveM.mutate()} disabled={saveM.isPending}>
                        {t("fpo.mon.saveReviewed")}</Button>
                    ) : null}
                    <Button size="sm" variant="ghost" onClick={() => setDraft(null)}>
                      {t("fpo.mon.discard")}</Button>
                  </div>
                </div>
              ) : (
                <p className="field-hint">{t("fpo.mon.aiHint")}</p>
              )}
            </div>
          </section>

          <section className="panel space-y-3 p-5">
            <h3 className="font-display text-sm font-semibold">{t("fpo.mon.history")}</h3>
            {d.notes.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("fpo.mon.none")}</p>
            ) : (
              <ul className="space-y-2">
                {d.notes.map((n) => (
                  <li key={n.id} className="rounded-md border border-border p-3 text-sm">
                    <p className="text-xs text-muted-foreground">
                      {n.observed_on} · {n.crop ?? "—"} · {n.category} ·{" "}
                      <span className={n.severity === "high" ? "font-semibold text-destructive" : ""}>
                        {n.severity}
                      </span>
                    </p>
                    <p>{n.body}</p>
                  </li>
                ))}
              </ul>
            )}
            {d.summaries.length > 0 ? (
              <div className="space-y-2 border-t border-border pt-3">
                <h3 className="font-display text-sm font-semibold">{t("fpo.mon.savedSummaries")}</h3>
                {d.summaries.map((s) => (
                  <div key={s.id} className="text-sm">
                    <p className="text-xs text-muted-foreground">{new Date(s.reviewed_at).toLocaleString()}</p>
                    <p>{s.summary}</p>
                  </div>
                ))}
              </div>
            ) : null}
          </section>
        </div>
      ) : null}
    </div>
  );
}
