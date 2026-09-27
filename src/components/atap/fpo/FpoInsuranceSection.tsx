import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/components/atap/LanguageProvider";
import { fill } from "@/lib/i18n.fpoWs";
import { getFpoCoverBoard, syncFpoMemberCover } from "@/lib/atap/insuranceBridge.functions";
import { COVER_BINDING_LABEL, policyCoverState } from "@/lib/atap/insuranceBridge";

const card = "rounded-lg border border-border bg-card p-4";
const inr = (v: number | null | undefined) =>
  v === null || v === undefined ? "—" : `₹${Math.round(v).toLocaleString("en-IN")}`;

export function FpoInsuranceSection({ tenantId }: { tenantId: string }) {
  const { t } = useLanguage();
  const boardFn = useServerFn(getFpoCoverBoard);
  const syncFn = useServerFn(syncFpoMemberCover);
  const queryClient = useQueryClient();

  const board = useQuery({
    queryKey: ["atap", "fpo-cover-board", tenantId],
    queryFn: () => boardFn({ data: { tenantId } }),
    enabled: Boolean(tenantId),
  });

  const sync = useMutation({
    mutationFn: () => syncFn({ data: { tenantId } }),
    onSuccess: (res) => {
      toast.success(
        fill(t("fpo.ins.synced"), { a: res.bound, b: res.consentedMembers }),
        {
          description:
            res.skippedNoPolicy || res.skippedNoAcreage
              ? `Skipped: ${res.skippedNoPolicy} without a matching policy, ${res.skippedNoAcreage} without acreage on the roster.`
              : undefined,
        },
      );
      void queryClient.invalidateQueries({ queryKey: ["atap", "fpo-cover-board", tenantId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (board.isLoading) {
    return <p className="text-sm text-muted-foreground">{t("fpo.ins.loading")}</p>;
  }
  const data = board.data;
  if (!data) {
    return <p className="text-sm text-muted-foreground">{t("fpo.ins.na")}</p>;
  }

  return (
    <section className="space-y-5">
      <p className="text-sm text-muted-foreground">{data.note}</p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className={card}>
          <p className="text-xs text-muted-foreground">{t("fpo.ins.linked")}</p>
          <p className="text-lg font-semibold tabular-nums">{data.policies.length}</p>
          <p className="text-xs text-muted-foreground">{data.provenance.label}</p>
        </div>
        <div className={card}>
          <p className="text-xs text-muted-foreground">{t("fpo.ins.roster")}</p>
          <p className="text-lg font-semibold tabular-nums">{data.members}</p>
        </div>
        <div className={card}>
          <p className="text-xs text-muted-foreground">{t("fpo.ins.auth")}</p>
          <p className="text-lg font-semibold tabular-nums">{data.consentedMembers}</p>
        </div>
        <div className={card}>
          <p className="text-xs text-muted-foreground">{t("fpo.ins.bound")}</p>
          <p className="text-lg font-semibold tabular-nums">{data.boundSnapshots}</p>
          <p className="text-xs text-muted-foreground">
            {data.lastSyncedAt
              ? `${t("fpo.ins.last")} ${new Date(data.lastSyncedAt).toLocaleDateString("en-IN")}`
              : t("fpo.ins.notYet")}
          </p>
        </div>
      </div>

      <div className={card}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">{t("fpo.ins.refreshTitle")}</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("fpo.ins.writes")}</p>
          </div>
          <Button
            onClick={() => sync.mutate()}
            disabled={!data.canManage || sync.isPending || data.consentedMembers === 0}
          >
            {sync.isPending ? t("fpo.ins.refreshing") : t("fpo.ins.refresh")}
          </Button>
        </div>
        {!data.canManage ? (
          <p className="mt-2 text-xs text-muted-foreground">
            {t("fpo.ins.readOnly")}</p>
        ) : null}
      </div>

      <div className={card}>
        <h3 className="text-sm font-semibold">{t("fpo.ins.policies")}</h3>
        {data.policies.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            {t("fpo.ins.noPolicy")}</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary text-secondary-foreground">
                <tr>
                  <th className="p-3 text-left">{t("fpo.ins.cPolicy")}</th>
                  <th className="p-3 text-left">{t("fpo.ins.cScheme")}</th>
                  <th className="p-3 text-left">{t("fpo.ins.cCrop")}</th>
                  <th className="p-3 text-right">{t("fpo.ins.cSum")}</th>
                  <th className="p-3 text-right">{t("fpo.ins.cShare")}</th>
                  <th className="p-3 text-left">{t("fpo.ins.cBind")}</th>
                </tr>
              </thead>
              <tbody>
                {data.policies.map((p) => (
                  <tr key={p.id} className="border-t border-border">
                    <td className="p-3 font-medium">{p.policy_reference}</td>
                    <td className="p-3">{p.scheme_name}</td>
                    <td className="p-3">
                      {p.crop ?? t("fpo.ins.allCrops")} · {p.season}
                    </td>
                    <td className="p-3 text-right tabular-nums">
                      {inr(p.sum_insured_per_acre_inr)}
                    </td>
                    <td className="p-3 text-right tabular-nums">{p.farmer_share_pct}%</td>
                    <td className="p-3">
                      <Badge variant={policyCoverState(p.status) === "bound" ? "default" : "secondary"}>
                        {COVER_BINDING_LABEL[policyCoverState(p.status)]}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className={card}>
        <h3 className="text-sm font-semibold">{t("fpo.ins.claims")}</h3>
        <p className="mt-1 text-xs text-muted-foreground">{data.claimNote}</p>
        {data.claims.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">{t("fpo.ins.noClaims")}</p>
        ) : (
          <div className="mt-3 space-y-2">
            {data.claims.map((c) => (
              <div
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-4"
              >
                <div>
                  <p className="text-sm font-medium">
                    {c.reference} · {c.crop ?? t("fpo.ins.allCrops")} · {c.season}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {c.peril.replace(/_/g, " ")} · {t("fpo.ins.reported")}{" "}
                    {new Date(c.reportedAt).toLocaleDateString("en-IN")}
                  </p>
                </div>
                <Badge variant="secondary">{c.stageLabel}</Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
