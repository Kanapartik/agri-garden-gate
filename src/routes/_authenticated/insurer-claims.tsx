import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/atap/AppShell";
import { Button } from "@/components/ui/button";
import {
  createInsurerClaim,
  getInsurerClaimsWorkspace,
  moveInsurerClaimStage,
  setInsurerClaimDocStatus,
  updateInsurerClaimDetails,
} from "@/lib/atap/insurerClaims.functions";
import {
  claimAgeDays,
  claimStates,
  claimsByStage,
  evidenceState,
  filterClaims,
  formatInr,
  isOverdue,
  nextStages,
  PERIL_LABEL,
  requiresDecisionNote,
  STAGE_LABEL,
  summarizeClaims,
  type ClaimPeril,
  type ClaimRow,
  type ClaimStage,
} from "@/lib/atap/insurerClaims";

export const Route = createFileRoute("/_authenticated/insurer-claims")({
  head: () => ({
    meta: [
      { title: "Claims intake & settlement — AgriGhar ATAP" },
      {
        name: "description",
        content:
          "FPO-level crop insurance claims: intake, evidence checklist, survey and assessment stages, human approvals, payout tracking and full stage history.",
      },
      { property: "og:title", content: "Claims intake & settlement — AgriGhar ATAP" },
      {
        property: "og:description",
        content:
          "Insurer claims workspace with configurable evidence requirements, SLA ageing and auditable human decisions. No farmer personal data.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: InsurerClaimsPage,
});

type Tab = "queue" | "pipeline" | "intake";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "queue", label: "Claim queue" },
  { id: "pipeline", label: "Stage pipeline" },
  { id: "intake", label: "New claim" },
];

const PERILS: ClaimPeril[] = [
  "drought",
  "excess_rain",
  "flood",
  "hail",
  "pest_outbreak",
  "heatwave",
  "cyclone",
];

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="panel p-4">
      <p className="field-hint">{label}</p>
      <p className="font-display text-2xl font-semibold">{value}</p>
      {hint ? <p className="field-hint">{hint}</p> : null}
    </div>
  );
}

function InsurerClaimsPage() {
  const fetchWorkspace = useServerFn(getInsurerClaimsWorkspace);
  const createClaim = useServerFn(createInsurerClaim);
  const moveStage = useServerFn(moveInsurerClaimStage);
  const setDoc = useServerFn(setInsurerClaimDocStatus);
  const updateDetails = useServerFn(updateInsurerClaimDetails);
  const queryClient = useQueryClient();

  const [tenantId, setTenantId] = useState<string | undefined>(undefined);
  const [tab, setTab] = useState<Tab>("queue");
  const [message, setMessage] = useState<string | null>(null);
  const [stateFilter, setStateFilter] = useState("");
  const [stageFilter, setStageFilter] = useState<ClaimStage | "all">("all");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [approvedAmount, setApprovedAmount] = useState("");
  const [surveyor, setSurveyor] = useState("");

  const [form, setForm] = useState({
    registrationNumber: "",
    peril: "drought" as ClaimPeril,
    affectedMembers: "",
    reportedAcres: "",
    claimedAmountInr: "",
  });

  const workspace = useQuery({
    queryKey: ["insurer-claims", tenantId ?? "default"],
    queryFn: () => fetchWorkspace({ data: { ...(tenantId ? { tenantId } : {}) } }),
  });
  const data = workspace.data;
  const scopeId = data?.scope.tenantId ?? "";
  const canManage = Boolean(data?.scope.canManage);

  function refresh(text: string) {
    setMessage(text);
    void queryClient.invalidateQueries({ queryKey: ["insurer-claims"] });
  }

  const states = useMemo(() => claimStates(data?.claims ?? []), [data?.claims]);
  const filtered = useMemo(
    () =>
      filterClaims(data?.claims ?? [], {
        ...(stateFilter ? { state: stateFilter } : {}),
        stage: stageFilter,
        overdueOnly,
        search,
      }),
    [data?.claims, stateFilter, stageFilter, overdueOnly, search],
  );
  const summary = useMemo(() => summarizeClaims(filtered), [filtered]);
  const buckets = useMemo(() => claimsByStage(data?.claims ?? []), [data?.claims]);
  const selected: ClaimRow | null = useMemo(
    () => (data?.claims ?? []).find((c) => c.id === selectedId) ?? null,
    [data?.claims, selectedId],
  );

  const stageMutation = useMutation({
    mutationFn: (input: { claimId: string; toStage: ClaimStage }) =>
      moveStage({
        data: {
          tenantId: scopeId,
          claimId: input.claimId,
          toStage: input.toStage,
          note: note.trim() ? note.trim() : null,
          approvedAmountInr: approvedAmount ? Number(approvedAmount) : null,
        },
      }),
    onSuccess: (r) => {
      setNote("");
      setApprovedAmount("");
      refresh(`Claim moved to ${STAGE_LABEL[r.stage]}.`);
    },
    onError: (e: Error) => setMessage(e.message),
  });

  const docMutation = useMutation({
    mutationFn: (input: { claimId: string; documentId: string; status: "verified" | "pending" | "rejected" }) =>
      setDoc({ data: { tenantId: scopeId, ...input } }),
    onSuccess: () => refresh("Evidence updated."),
    onError: (e: Error) => setMessage(e.message),
  });

  const surveyorMutation = useMutation({
    mutationFn: (claimId: string) =>
      updateDetails({ data: { tenantId: scopeId, claimId, surveyorName: surveyor.trim() || null } }),
    onSuccess: () => {
      setSurveyor("");
      refresh("Surveyor assigned.");
    },
    onError: (e: Error) => setMessage(e.message),
  });

  const createMutation = useMutation({
    mutationFn: () => {
      const match = (data?.channel ?? []).find(
        (c) => c.registration_number === form.registrationNumber,
      );
      if (!match) throw new Error("Select an FPO from your channel list");
      return createClaim({
        data: {
          tenantId: scopeId,
          registrationNumber: match.registration_number,
          fpoName: match.fpo_name,
          stateName: match.state_name,
          district: match.district,
          peril: form.peril,
          affectedMembers: form.affectedMembers ? Number(form.affectedMembers) : 0,
          reportedAcres: form.reportedAcres ? Number(form.reportedAcres) : null,
          claimedAmountInr: form.claimedAmountInr ? Number(form.claimedAmountInr) : 0,
        },
      });
    },
    onSuccess: (r) => {
      setForm({ registrationNumber: "", peril: "drought", affectedMembers: "", reportedAcres: "", claimedAmountInr: "" });
      setTab("queue");
      refresh(`Claim ${r.reference} created.`);
    },
    onError: (e: Error) => setMessage(e.message),
  });

  if (workspace.isLoading) {
    return (
      <div className="space-y-4">
        <PageHeader title="Claims intake & settlement" subtitle="Loading claims workspace…" />
      </div>
    );
  }

  if (workspace.isError) {
    return (
      <div className="space-y-4">
        <PageHeader title="Claims intake & settlement" subtitle="Insurer claims workspace" />
        <div className="panel p-4 text-sm text-destructive">{(workspace.error as Error).message}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Claims intake & settlement"
        subtitle={`${data?.scope.tenantName ?? ""} — FPO-level claims lifecycle with human decisions`}
      />

      <div className="panel p-4 text-sm text-muted-foreground">
        <p>{data?.humanDecisionNote}</p>
        <p className="mt-2">{data?.aggregateNote}</p>
      </div>

      {(data?.tenantOptions.length ?? 0) > 1 ? (
        <div className="flex items-center gap-2">
          <label className="field-hint" htmlFor="claims-tenant">
            Insurer
          </label>
          <select
            id="claims-tenant"
            className="input-base"
            value={tenantId ?? scopeId}
            onChange={(e) => setTenantId(e.target.value)}
          >
            {data?.tenantOptions.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {message ? <div className="panel p-3 text-sm">{message}</div> : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Claims in view" value={String(summary.total)} hint={`${summary.open} open`} />
        <Kpi label="Overdue vs SLA" value={String(summary.overdue)} hint="Response window passed" />
        <Kpi label="Claimed" value={formatInr(summary.claimedInr)} hint={`Approved ${formatInr(summary.approvedInr)}`} />
        <Kpi
          label="Approval rate"
          value={`${summary.approvalRatePct}%`}
          hint={`Avg age ${summary.averageAgeDays} days`}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Button
            key={t.id}
            variant={tab === t.id ? "default" : "outline"}
            size="sm"
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </Button>
        ))}
      </div>

      {tab === "queue" ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="field-hint" htmlFor="claims-state">
                State
              </label>
              <select
                id="claims-state"
                className="input-base"
                value={stateFilter}
                onChange={(e) => setStateFilter(e.target.value)}
              >
                <option value="">All states</option>
                {states.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-hint" htmlFor="claims-stage">
                Stage
              </label>
              <select
                id="claims-stage"
                className="input-base"
                value={stageFilter}
                onChange={(e) => setStageFilter(e.target.value as ClaimStage | "all")}
              >
                <option value="all">All stages</option>
                {buckets.map((b) => (
                  <option key={b.stage} value={b.stage}>
                    {STAGE_LABEL[b.stage]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-hint" htmlFor="claims-search">
                Search
              </label>
              <input
                id="claims-search"
                className="input-base"
                placeholder="Reference, FPO, district"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={overdueOnly}
                onChange={(e) => setOverdueOnly(e.target.checked)}
              />
              Overdue only
            </label>
          </div>

          <div className="panel overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="p-3">Reference</th>
                  <th className="p-3">FPO</th>
                  <th className="p-3">District</th>
                  <th className="p-3">Peril</th>
                  <th className="p-3">Stage</th>
                  <th className="p-3">Evidence</th>
                  <th className="p-3">Claimed</th>
                  <th className="p-3">Age</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 200).map((c) => {
                  const ev = evidenceState(c.documents ?? []);
                  return (
                    <tr key={c.id} className="border-t border-border/60">
                      <td className="p-3 font-medium">{c.claim_reference}</td>
                      <td className="p-3">{c.fpo_name}</td>
                      <td className="p-3">{c.district ?? "—"}</td>
                      <td className="p-3">{PERIL_LABEL[c.peril]}</td>
                      <td className="p-3">{STAGE_LABEL[c.stage]}</td>
                      <td className="p-3">
                        {ev.verified}/{ev.required}
                      </td>
                      <td className="p-3">{formatInr(c.claimed_amount_inr)}</td>
                      <td className="p-3">
                        {claimAgeDays(c)}d
                        {isOverdue(c) ? <span className="ml-1 text-destructive">overdue</span> : null}
                      </td>
                      <td className="p-3">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedId(c.id === selectedId ? null : c.id)}
                        >
                          {c.id === selectedId ? "Close" : "Open"}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 ? (
                  <tr>
                    <td className="p-4 text-muted-foreground" colSpan={9}>
                      No claims match these filters.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          {selected ? (
            <div className="panel space-y-4 p-4">
              <div>
                <h2 className="font-display text-lg font-semibold">
                  {selected.claim_reference} — {selected.fpo_name}
                </h2>
                <p className="field-hint">
                  {PERIL_LABEL[selected.peril]} · {selected.crop ?? "—"} · {selected.season} ·{" "}
                  {STAGE_LABEL[selected.stage]} · {selected.affected_members} affected members
                  (aggregate)
                </p>
              </div>

              <div>
                <h3 className="text-sm font-semibold">Evidence checklist</h3>
                <ul className="mt-2 space-y-2">
                  {(selected.documents ?? []).map((d) => (
                    <li key={d.id} className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="min-w-48">
                        {d.label}
                        {d.required ? " *" : ""}
                      </span>
                      <span className="text-muted-foreground">{d.status}</span>
                      {canManage ? (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={docMutation.isPending}
                            onClick={() =>
                              docMutation.mutate({
                                claimId: selected.id,
                                documentId: d.id,
                                status: "verified",
                              })
                            }
                          >
                            Verify
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={docMutation.isPending}
                            onClick={() =>
                              docMutation.mutate({
                                claimId: selected.id,
                                documentId: d.id,
                                status: "pending",
                              })
                            }
                          >
                            Reset
                          </Button>
                        </>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>

              {canManage ? (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold">Human decision</h3>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div>
                      <label className="field-hint" htmlFor="claim-note">
                        Decision note (required to approve, reject or withdraw)
                      </label>
                      <input
                        id="claim-note"
                        className="input-base"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="field-hint" htmlFor="claim-amount">
                        Approved amount (₹)
                      </label>
                      <input
                        id="claim-amount"
                        className="input-base"
                        inputMode="numeric"
                        value={approvedAmount}
                        onChange={(e) => setApprovedAmount(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="field-hint" htmlFor="claim-surveyor">
                        Surveyor (insurer staff)
                      </label>
                      <div className="flex gap-2">
                        <input
                          id="claim-surveyor"
                          className="input-base"
                          value={surveyor}
                          onChange={(e) => setSurveyor(e.target.value)}
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={surveyorMutation.isPending}
                          onClick={() => surveyorMutation.mutate(selected.id)}
                        >
                          Assign
                        </Button>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {nextStages(selected.stage).map((s) => (
                      <Button
                        key={s}
                        size="sm"
                        variant={requiresDecisionNote(s) ? "default" : "outline"}
                        disabled={stageMutation.isPending}
                        onClick={() => stageMutation.mutate({ claimId: selected.id, toStage: s })}
                      >
                        Move to {STAGE_LABEL[s]}
                      </Button>
                    ))}
                    {nextStages(selected.stage).length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        This claim has reached a terminal stage.
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  You have oversight access only — claim decisions require an insurer administrator.
                </p>
              )}

              <div>
                <h3 className="text-sm font-semibold">Stage history</h3>
                <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                  {(selected.events ?? []).map((e) => (
                    <li key={e.id}>
                      {new Date(e.created_at).toLocaleDateString("en-IN")} ·{" "}
                      {e.from_stage ? `${STAGE_LABEL[e.from_stage]} → ` : ""}
                      {STAGE_LABEL[e.to_stage]}
                      {e.note ? ` — ${e.note}` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {tab === "pipeline" ? (
        <div className="panel overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="p-3">Stage</th>
                <th className="p-3">Claims</th>
                <th className="p-3">Claimed value</th>
              </tr>
            </thead>
            <tbody>
              {buckets.map((b) => (
                <tr key={b.stage} className="border-t border-border/60">
                  <td className="p-3">{STAGE_LABEL[b.stage]}</td>
                  <td className="p-3">{b.count}</td>
                  <td className="p-3">{formatInr(b.claimedInr)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {tab === "intake" ? (
        <div className="panel space-y-3 p-4">
          {canManage ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="field-hint" htmlFor="intake-fpo">
                    FPO (from your channel)
                  </label>
                  <select
                    id="intake-fpo"
                    className="input-base"
                    value={form.registrationNumber}
                    onChange={(e) => setForm({ ...form, registrationNumber: e.target.value })}
                  >
                    <option value="">Select an FPO</option>
                    {(data?.channel ?? []).slice(0, 400).map((c) => (
                      <option key={c.registration_number} value={c.registration_number}>
                        {c.fpo_name} — {c.district ?? "—"}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="field-hint" htmlFor="intake-peril">
                    Peril
                  </label>
                  <select
                    id="intake-peril"
                    className="input-base"
                    value={form.peril}
                    onChange={(e) => setForm({ ...form, peril: e.target.value as ClaimPeril })}
                  >
                    {PERILS.map((p) => (
                      <option key={p} value={p}>
                        {PERIL_LABEL[p]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="field-hint" htmlFor="intake-members">
                    Affected members (aggregate count)
                  </label>
                  <input
                    id="intake-members"
                    className="input-base"
                    inputMode="numeric"
                    value={form.affectedMembers}
                    onChange={(e) => setForm({ ...form, affectedMembers: e.target.value })}
                  />
                </div>
                <div>
                  <label className="field-hint" htmlFor="intake-acres">
                    Reported acres
                  </label>
                  <input
                    id="intake-acres"
                    className="input-base"
                    inputMode="numeric"
                    value={form.reportedAcres}
                    onChange={(e) => setForm({ ...form, reportedAcres: e.target.value })}
                  />
                </div>
                <div>
                  <label className="field-hint" htmlFor="intake-amount">
                    Claimed amount (₹)
                  </label>
                  <input
                    id="intake-amount"
                    className="input-base"
                    inputMode="numeric"
                    value={form.claimedAmountInr}
                    onChange={(e) => setForm({ ...form, claimedAmountInr: e.target.value })}
                  />
                </div>
              </div>
              <Button disabled={createMutation.isPending} onClick={() => createMutation.mutate()}>
                Create claim
              </Button>
              <p className="field-hint">
                Intake records aggregate FPO-level loss only. Farmer-level details stay with the FPO
                under its own consent scope.
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Claim intake requires an insurer administrator role.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
