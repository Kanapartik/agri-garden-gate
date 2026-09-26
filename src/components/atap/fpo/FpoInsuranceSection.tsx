import { useLanguage } from "@/components/atap/LanguageProvider";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
        `Cover indicators refreshed for ${res.bound} of ${res.consentedMembers} authorized members`,
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
    return <p className="text-sm text-muted-foreground">{t("fpo.ui.ea6b81797e")}</p>;
  }
  const data = board.data;
  if (!data) {
    return <p className="text-sm text-muted-foreground">{t("fpo.ui.fe17d94059")}</p>;
  }

  return (
    <section className="space-y-5">
      <p className="text-sm text-muted-foreground">{data.note}</p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className={card}>
          <p className="text-xs text-muted-foreground">{t("fpo.ui.e62e3834fb")}</p>
          <p className="text-lg font-semibold tabular-nums">{data.policies.length}</p>
          <p className="text-xs text-muted-foreground">{data.provenance.label}</p>
        </div>
        <div className={card}>
          <p className="text-xs text-muted-foreground">{t("fpo.ui.a9cf4b9d5c")}</p>
          <p className="text-lg font-semibold tabular-nums">{data.members}</p>
        </div>
        <div className={card}>
          <p className="text-xs text-muted-foreground">{t("fpo.ui.7cb554f62c")}</p>
          <p className="text-lg font-semibold tabular-nums">{data.consentedMembers}</p>
        </div>
        <div className={card}>
          <p className="text-xs text-muted-foreground">{t("fpo.ui.dbce43d0fe")}</p>
          <p className="text-lg font-semibold tabular-nums">{data.boundSnapshots}</p>
          <p className="text-xs text-muted-foreground">
            {data.lastSyncedAt
              ? `last refreshed ${new Date(data.lastSyncedAt).toLocaleDateString("en-IN")}`
              : "not refreshed yet"}
          </p>
        </div>
      </div>

      <div className={card}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">{t("fpo.ui.5900850f42")}</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("fpo.ui.c03d0fce2e")}</p>
          </div>
          <Button
            onClick={() => sync.mutate()}
            disabled={!data.canManage || sync.isPending || data.consentedMembers === 0}
          >
            {sync.isPending ? "Refreshing…" : "Refresh from policies"}
          </Button>
        </div>
        {!data.canManage ? (
          <p className="mt-2 text-xs text-muted-foreground">
            {t("fpo.ui.574d1d388f")}</p>
        ) : null}
      </div>

      <div className={card}>
        <h3 className="text-sm font-semibold">{t("fpo.ui.2b18be4393")}</h3>
        {data.policies.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            {t("fpo.ui.05a97ada8e")}</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary text-secondary-foreground">
                <tr>
                  <th className="p-3 text-left">{t("fpo.ui.bb9cf14180")}</th>
                  <th className="p-3 text-left">{t("fpo.ui.990897a59f")}</th>
                  <th className="p-3 text-left">{t("fpo.ui.5ef9333255")}</th>
                  <th className="p-3 text-right">{t("fpo.ui.42b015cff1")}</th>
                  <th className="p-3 text-right">{t("fpo.ui.70c5fa1b3f")}</th>
                  <th className="p-3 text-left">{t("fpo.ui.7f0043e684")}</th>
                </tr>
              </thead>
              <tbody>
                {data.policies.map((p) => (
                  <tr key={p.id} className="border-t border-border">
                    <td className="p-3 font-medium">{p.policy_reference}</td>
                    <td className="p-3">{p.scheme_name}</td>
                    <td className="p-3">
                      {p.crop ?? "all crops"} · {p.season}
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
        <h3 className="text-sm font-semibold">{t("fpo.ui.cd2d40f504")}</h3>
        <p className="mt-1 text-xs text-muted-foreground">{data.claimNote}</p>
        {data.claims.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">{t("fpo.ui.2d423434e7")}</p>
        ) : (
          <div className="mt-3 space-y-2">
            {data.claims.map((c) => (
              <div
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-4"
              >
                <div>
                  <p className="text-sm font-medium">
                    {c.reference} · {c.crop ?? "all crops"} · {c.season}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {c.peril.replace(/_/g, " ")} {t("fpo.ui.f73b2c6c90")}{" "}
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
