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
      toast.success("Campaign created");
      setName("");
      await invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const move = useMutation({
    mutationFn: (input: { cohortMemberId: string; state: FacilitationState }) =>
      stateFn({ data: { tenantId, ...input } }),
    onSuccess: async () => {
      toast.success("Member facilitation updated");
      await invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!tenantId) {
    return (
      <section className="panel p-5 text-sm text-muted-foreground">
        Select an FPO organization to see member facilitation.
      </section>
    );
  }
  if (board.isLoading) {
    return <section className="panel p-5 text-sm">Loading facilitation campaigns…</section>;
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
        <h2 className="font-display text-base font-semibold">Member scheme facilitation</h2>
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
                  <th className="py-2">Member</th>
                  <th className="py-2">Stage</th>
                  <th className="py-2">Farmer authorization</th>
                  <th className="py-2">Actions</th>
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
                          <option value="">Move to…</option>
                          {nextFacilitationStates(m.state).map((s) => (
                            <option key={s} value={s}>
                              {FACILITATION_STATE_LABEL[s]}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="field-hint">View only</span>
                      )}
                    </td>
                  </tr>
                ))}
                {c.members.length === 0 ? (
                  <tr>
                    <td className="py-4 text-sm text-muted-foreground" colSpan={4}>
                      No members in this cohort yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      {data.campaigns.length === 0 ? (
        <section className="panel p-5 text-sm text-muted-foreground">
          No facilitation campaigns yet.
        </section>
      ) : null}

      {data.canManage ? (
        <section className="panel space-y-3 p-5">
          <h3 className="font-display text-sm font-semibold">Create a campaign</h3>
          <div className="grid gap-2 md:grid-cols-2">
            <input
              className="input-field"
              placeholder="Campaign name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <select
              className="input-field"
              value={schemeId}
              onChange={(e) => setSchemeId(e.target.value)}
            >
              <option value="">No scheme linked</option>
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
            Create campaign
          </Button>
        </section>
      ) : null}
    </div>
  );
}
