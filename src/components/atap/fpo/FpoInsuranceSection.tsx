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
    return <p className="text-sm text-muted-foreground">Loading insurance cover board…</p>;
  }
  const data = board.data;
  if (!data) {
    return <p className="text-sm text-muted-foreground">Insurance cover board is not available.</p>;
  }

  return (
    <section className="space-y-5">
      <p className="text-sm text-muted-foreground">{data.note}</p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className={card}>
          <p className="text-xs text-muted-foreground">Linked policies</p>
          <p className="text-lg font-semibold tabular-nums">{data.policies.length}</p>
          <p className="text-xs text-muted-foreground">{data.provenance.label}</p>
        </div>
        <div className={card}>
          <p className="text-xs text-muted-foreground">Members on roster</p>
          <p className="text-lg font-semibold tabular-nums">{data.members}</p>
        </div>
        <div className={card}>
          <p className="text-xs text-muted-foreground">Authorized for facilitation</p>
          <p className="text-lg font-semibold tabular-nums">{data.consentedMembers}</p>
        </div>
        <div className={card}>
          <p className="text-xs text-muted-foreground">Member cover indicators bound</p>
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
            <h3 className="text-sm font-semibold">Refresh member cover indicators</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Writes the notified policy&apos;s sum insured and farmer share to each authorized
              member&apos;s insurance corner. Members without an active authorization are never
              included, and no enrolment is created.
            </p>
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
            Read-only: only an FPO administrator can refresh cover indicators.
          </p>
        ) : null}
      </div>

      <div className={card}>
        <h3 className="text-sm font-semibold">Policies covering this organization</h3>
        {data.policies.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            No insurer policy is linked to this organization yet. Figures in member insurance corners
            stay indicative until an insurer links a policy.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary text-secondary-foreground">
                <tr>
                  <th className="p-3 text-left">Policy</th>
                  <th className="p-3 text-left">Scheme</th>
                  <th className="p-3 text-left">Crop / season</th>
                  <th className="p-3 text-right">Sum insured / acre</th>
                  <th className="p-3 text-right">Farmer share</th>
                  <th className="p-3 text-left">Binding</th>
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
        <h3 className="text-sm font-semibold">Claim status from the insurer</h3>
        <p className="mt-1 text-xs text-muted-foreground">{data.claimNote}</p>
        {data.claims.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No claims reported for this organization.</p>
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
                    {c.peril.replace(/_/g, " ")} · reported{" "}
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
