import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/atap/AppShell";
import { Button } from "@/components/ui/button";
import {
  createInsurerEnrolmentBatch,
  createInsurerPolicy,
  getInsurerPoliciesWorkspace,
  moveInsurerEnrolmentState,
  moveInsurerPolicyStatus,
  recordInsurerRemittance,
} from "@/lib/atap/insurerPolicies.functions";
import {
  batchesByState,
  ENROLMENT_STATE_LABEL,
  enrolmentIsOpen,
  filterPolicies,
  formatInr,
  nextEnrolmentStates,
  nextPolicyStatuses,
  POLICY_STATUS_LABEL,
  policySeasons,
  policyStates,
  reconcileBatches,
  requiresEnrolmentDecisionNote,
  requiresPolicyDecisionNote,
  splitPremium,
  summarizePortfolio,
  type EnrolmentState,
  type PolicyRow,
  type PolicyStatus,
} from "@/lib/atap/insurerPolicies";

export const Route = createFileRoute("/_authenticated/insurer-policies")({
  head: () => ({
    meta: [
      { title: "Policy & enrolment lifecycle — AgriGhar ATAP" },
      {
        name: "description",
        content:
          "Insurer policy portfolio, FPO enrolment batches with aggregate member counts and acres, premium share arithmetic and remittance reconciliation.",
      },
      { property: "og:title", content: "Policy & enrolment lifecycle — AgriGhar ATAP" },
      {
        property: "og:description",
        content:
          "Season-scoped crop insurance policies, human-gated issuance and enrolment verification, and premium reconciliation for FPO channels.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: InsurerPoliciesPage,
});

type Tab = "portfolio" | "enrolment" | "reconciliation" | "new";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "portfolio", label: "Policies" },
  { id: "enrolment", label: "Enrolment batches" },
  { id: "reconciliation", label: "Premium reconciliation" },
  { id: "new", label: "New policy" },
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

function InsurerPoliciesPage() {
  const fetchWorkspace = useServerFn(getInsurerPoliciesWorkspace);
  const createPolicyFn = useServerFn(createInsurerPolicy);
  const movePolicyFn = useServerFn(moveInsurerPolicyStatus);
  const createBatchFn = useServerFn(createInsurerEnrolmentBatch);
  const moveBatchFn = useServerFn(moveInsurerEnrolmentState);
  const remitFn = useServerFn(recordInsurerRemittance);
  const queryClient = useQueryClient();

  const [tenantId, setTenantId] = useState<string | undefined>(undefined);
  const [tab, setTab] = useState<Tab>("portfolio");
  const [message, setMessage] = useState<string | null>(null);
  const [stateFilter, setStateFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<PolicyStatus | "all">("all");
  const [seasonFilter, setSeasonFilter] = useState("");
  const [search, setSearch] = useState("");
  const [selectedPolicyId, setSelectedPolicyId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [batchForm, setBatchForm] = useState({ memberCount: "", acres: "" });
  const [form, setForm] = useState({
    registrationNumber: "",
    crop: "",
    season: "Kharif 2026",
    coverageStart: "2026-06-15",
    coverageEnd: "2026-11-30",
    enrolmentCutoff: "2026-07-31",
    sumInsuredPerAcreInr: "40000",
    actuarialRatePct: "10",
    insuredAcres: "",
    insuredMembers: "",
  });

  const workspace = useQuery({
    queryKey: ["insurer-policies", tenantId ?? "default"],
    queryFn: () => fetchWorkspace({ data: { ...(tenantId ? { tenantId } : {}) } }),
  });
  const data = workspace.data;
  const scopeId = data?.scope.tenantId ?? "";
  const canManage = Boolean(data?.scope.canManage);

  function refresh(text: string) {
    setMessage(text);
    void queryClient.invalidateQueries({ queryKey: ["insurer-policies"] });
  }

  const policies = data?.policies ?? [];
  const batches = data?.batches ?? [];
  const states = useMemo(() => policyStates(policies), [policies]);
  const seasons = useMemo(() => policySeasons(policies), [policies]);
  const filtered = useMemo(
    () =>
      filterPolicies(policies, {
        ...(stateFilter ? { state: stateFilter } : {}),
        status: statusFilter,
        ...(seasonFilter ? { season: seasonFilter } : {}),
        search,
      }),
    [policies, stateFilter, statusFilter, seasonFilter, search],
  );
  const summary = useMemo(() => summarizePortfolio(filtered, batches), [filtered, batches]);
  const buckets = useMemo(() => batchesByState(batches), [batches]);
  const reconciliation = useMemo(() => reconcileBatches(batches), [batches]);
  const selected: PolicyRow | null = useMemo(
    () => policies.find((p) => p.id === selectedPolicyId) ?? null,
    [policies, selectedPolicyId],
  );
  const selectedBatches = useMemo(
    () => batches.filter((b) => b.policy_id === selectedPolicyId),
    [batches, selectedPolicyId],
  );

  const policyStatusMutation = useMutation({
    mutationFn: (input: { policyId: string; toStatus: PolicyStatus }) =>
      movePolicyFn({
        data: {
          tenantId: scopeId,
          policyId: input.policyId,
          toStatus: input.toStatus,
          note: note.trim() ? note.trim() : null,
        },
      }),
    onSuccess: (r) => {
      setNote("");
      refresh(`Policy moved to ${POLICY_STATUS_LABEL[r.status]}.`);
    },
    onError: (e: Error) => setMessage(e.message),
  });

  const batchStateMutation = useMutation({
    mutationFn: (input: { batchId: string; toState: EnrolmentState }) =>
      moveBatchFn({
        data: {
          tenantId: scopeId,
          batchId: input.batchId,
          toState: input.toState,
          note: note.trim() ? note.trim() : null,
        },
      }),
    onSuccess: (r) => {
      setNote("");
      refresh(`Enrolment batch moved to ${ENROLMENT_STATE_LABEL[r.state]}.`);
    },
    onError: (e: Error) => setMessage(e.message),
  });

  const batchCreateMutation = useMutation({
    mutationFn: (policyId: string) =>
      createBatchFn({
        data: {
          tenantId: scopeId,
          policyId,
          memberCount: Number(batchForm.memberCount || 0),
          acres: Number(batchForm.acres || 0),
        },
      }),
    onSuccess: (r) => {
      setBatchForm({ memberCount: "", acres: "" });
      refresh(`Enrolment batch ${r.reference} submitted.`);
    },
    onError: (e: Error) => setMessage(e.message),
  });

  const remitMutation = useMutation({
    mutationFn: (input: { batchId: string; amountInr: number }) =>
      remitFn({ data: { tenantId: scopeId, ...input } }),
    onSuccess: (r) => refresh(`Remittance ${r.reference} recorded.`),
    onError: (e: Error) => setMessage(e.message),
  });

  const policyCreateMutation = useMutation({
    mutationFn: () => {
      const match = (data?.channel ?? []).find(
        (c) => c.registration_number === form.registrationNumber,
      );
      if (!match) throw new Error("Select an FPO from your channel list");
      return createPolicyFn({
        data: {
          tenantId: scopeId,
          registrationNumber: match.registration_number,
          fpoName: match.fpo_name,
          stateName: match.state_name,
          district: match.district,
          crop: form.crop || null,
          season: form.season,
          coverageStart: form.coverageStart || null,
          coverageEnd: form.coverageEnd || null,
          enrolmentCutoff: form.enrolmentCutoff || null,
          sumInsuredPerAcreInr: Number(form.sumInsuredPerAcreInr || 0),
          actuarialRatePct: Number(form.actuarialRatePct || 0),
          insuredAcres: Number(form.insuredAcres || 0),
          insuredMembers: Number(form.insuredMembers || 0),
        },
      });
    },
    onSuccess: (r) => {
      setTab("portfolio");
      refresh(`Policy ${r.reference} created as draft.`);
    },
    onError: (e: Error) => setMessage(e.message),
  });

  if (workspace.isLoading) {
    return <PageHeader title="Policy & enrolment lifecycle" description="Loading portfolio…" />;
  }
  if (workspace.isError) {
    return (
      <div className="space-y-4">
        <PageHeader title="Policy & enrolment lifecycle" description="Insurer policy workspace" />
        <div className="panel p-4 text-sm text-destructive">
          {(workspace.error as Error).message}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Policy & enrolment lifecycle"
        description={`${data?.scope.tenantName ?? ""} — season-scoped cover, enrolment batches and premium reconciliation`}
      />

      <div className="panel p-4 text-sm text-muted-foreground">
        <p>{data?.humanDecisionNote}</p>
        <p className="mt-2">{data?.aggregateNote}</p>
      </div>

      {(data?.tenantOptions.length ?? 0) > 1 ? (
        <div className="flex items-center gap-2">
          <label className="field-hint" htmlFor="pol-tenant">
            Insurer
          </label>
          <select
            id="pol-tenant"
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
        <Kpi
          label="Policies in view"
          value={String(summary.policies)}
          hint={`${summary.activePolicies} in force`}
        />
        <Kpi
          label="Insured area"
          value={`${summary.insuredAcres.toLocaleString("en-IN")} ac`}
          hint={`${summary.insuredMembers.toLocaleString("en-IN")} member seats (aggregate)`}
        />
        <Kpi
          label="Gross premium"
          value={formatInr(summary.grossPremiumInr)}
          hint={`Avg SI ${formatInr(summary.averageSumInsuredPerAcreInr)}/ac`}
        />
        <Kpi
          label="Farmer share due"
          value={formatInr(summary.farmerPremiumInr)}
          hint={`Subsidy ${formatInr(summary.subsidyPremiumInr)}`}
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

      {tab === "portfolio" ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="field-hint" htmlFor="pol-state">
                State
              </label>
              <select
                id="pol-state"
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
              <label className="field-hint" htmlFor="pol-status">
                Status
              </label>
              <select
                id="pol-status"
                className="input-base"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as PolicyStatus | "all")}
              >
                <option value="all">All statuses</option>
                {(Object.keys(POLICY_STATUS_LABEL) as PolicyStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {POLICY_STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-hint" htmlFor="pol-season">
                Season
              </label>
              <select
                id="pol-season"
                className="input-base"
                value={seasonFilter}
                onChange={(e) => setSeasonFilter(e.target.value)}
              >
                <option value="">All seasons</option>
                {seasons.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-hint" htmlFor="pol-search">
                Search
              </label>
              <input
                id="pol-search"
                className="input-base"
                placeholder="Policy, FPO, district, crop"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="panel overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="p-3">Policy</th>
                  <th className="p-3">FPO</th>
                  <th className="p-3">Crop / season</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Acres</th>
                  <th className="p-3">Gross premium</th>
                  <th className="p-3">Enrolment</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 200).map((p) => (
                  <tr key={p.id} className="border-t border-border/60">
                    <td className="p-3 font-medium">{p.policy_reference}</td>
                    <td className="p-3">{p.fpo_name}</td>
                    <td className="p-3">
                      {p.crop ?? "—"} · {p.season}
                    </td>
                    <td className="p-3">{POLICY_STATUS_LABEL[p.status]}</td>
                    <td className="p-3">{Math.round(p.insured_acres).toLocaleString("en-IN")}</td>
                    <td className="p-3">{formatInr(p.gross_premium_inr)}</td>
                    <td className="p-3">{enrolmentIsOpen(p) ? "Open" : "Closed"}</td>
                    <td className="p-3">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedPolicyId(p.id === selectedPolicyId ? null : p.id)}
                      >
                        {p.id === selectedPolicyId ? "Close" : "Open"}
                      </Button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 ? (
                  <tr>
                    <td className="p-4 text-muted-foreground" colSpan={8}>
                      No policies match these filters.
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
                  {selected.policy_reference} — {selected.fpo_name}
                </h2>
                <p className="field-hint">
                  {selected.scheme_name} · {selected.crop ?? "—"} · {selected.season} ·{" "}
                  {POLICY_STATUS_LABEL[selected.status]}
                </p>
              </div>

              <div className="grid gap-3 text-sm sm:grid-cols-3">
                <p>
                  Sum insured: {formatInr(selected.sum_insured_per_acre_inr)}/ac at{" "}
                  {selected.actuarial_rate_pct}% actuarial rate
                </p>
                <p>
                  Shares — farmer {selected.farmer_share_pct}% · centre {selected.centre_share_pct}%
                  · state {selected.state_share_pct}%
                </p>
                <p>
                  Split:{" "}
                  {(() => {
                    const s = splitPremium(selected.gross_premium_inr, selected);
                    return `${formatInr(s.farmerInr)} farmer / ${formatInr(s.centreInr + s.stateInr)} subsidy`;
                  })()}
                </p>
                <p>
                  Cover: {selected.coverage_start ?? "—"} → {selected.coverage_end ?? "—"}
                </p>
                <p>Enrolment cutoff: {selected.enrolment_cutoff ?? "—"}</p>
                <p>Batches linked: {selectedBatches.length}</p>
              </div>

              {canManage ? (
                <div className="space-y-3">
                  <div>
                    <label className="field-hint" htmlFor="pol-note">
                      Decision note (required to issue or cancel)
                    </label>
                    <input
                      id="pol-note"
                      className="input-base"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {nextPolicyStatuses(selected.status).map((s) => (
                      <Button
                        key={s}
                        size="sm"
                        variant={requiresPolicyDecisionNote(s) ? "default" : "outline"}
                        disabled={policyStatusMutation.isPending}
                        onClick={() =>
                          policyStatusMutation.mutate({ policyId: selected.id, toStatus: s })
                        }
                      >
                        Move to {POLICY_STATUS_LABEL[s]}
                      </Button>
                    ))}
                    {nextPolicyStatuses(selected.status).length === 0 ? (
                      <p className="text-sm text-muted-foreground">Terminal policy status.</p>
                    ) : null}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div>
                      <label className="field-hint" htmlFor="batch-members">
                        Batch member count (aggregate)
                      </label>
                      <input
                        id="batch-members"
                        className="input-base"
                        inputMode="numeric"
                        value={batchForm.memberCount}
                        onChange={(e) =>
                          setBatchForm({ ...batchForm, memberCount: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <label className="field-hint" htmlFor="batch-acres">
                        Batch acres
                      </label>
                      <input
                        id="batch-acres"
                        className="input-base"
                        inputMode="numeric"
                        value={batchForm.acres}
                        onChange={(e) => setBatchForm({ ...batchForm, acres: e.target.value })}
                      />
                    </div>
                    <div className="flex items-end">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={batchCreateMutation.isPending}
                        onClick={() => batchCreateMutation.mutate(selected.id)}
                      >
                        Submit enrolment batch
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Oversight access only — policy decisions require an insurer administrator.
                </p>
              )}
            </div>
          ) : null}
        </div>
      ) : null}

      {tab === "enrolment" ? (
        <div className="space-y-4">
          <div className="panel overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="p-3">State</th>
                  <th className="p-3">Batches</th>
                  <th className="p-3">Members</th>
                  <th className="p-3">Acres</th>
                  <th className="p-3">Premium due</th>
                </tr>
              </thead>
              <tbody>
                {buckets.map((b) => (
                  <tr key={b.state} className="border-t border-border/60">
                    <td className="p-3">{ENROLMENT_STATE_LABEL[b.state]}</td>
                    <td className="p-3">{b.count}</td>
                    <td className="p-3">{b.members.toLocaleString("en-IN")}</td>
                    <td className="p-3">{b.acres.toLocaleString("en-IN")}</td>
                    <td className="p-3">{formatInr(b.premiumDueInr)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {canManage ? (
            <div>
              <label className="field-hint" htmlFor="batch-note">
                Decision note (required to verify, reject or withdraw)
              </label>
              <input
                id="batch-note"
                className="input-base"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          ) : null}

          <div className="panel overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="p-3">Batch</th>
                  <th className="p-3">FPO</th>
                  <th className="p-3">State</th>
                  <th className="p-3">Members</th>
                  <th className="p-3">Acres</th>
                  <th className="p-3">Farmer share</th>
                  <th className="p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {batches.slice(0, 200).map((b) => (
                  <tr key={b.id} className="border-t border-border/60">
                    <td className="p-3 font-medium">{b.batch_reference}</td>
                    <td className="p-3">{b.fpo_name}</td>
                    <td className="p-3">{ENROLMENT_STATE_LABEL[b.state]}</td>
                    <td className="p-3">{b.member_count}</td>
                    <td className="p-3">{Math.round(b.acres).toLocaleString("en-IN")}</td>
                    <td className="p-3">{formatInr(b.farmer_premium_inr)}</td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">
                        {canManage
                          ? nextEnrolmentStates(b.state).map((s) => (
                              <Button
                                key={s}
                                size="sm"
                                variant={requiresEnrolmentDecisionNote(s) ? "default" : "outline"}
                                disabled={batchStateMutation.isPending}
                                onClick={() =>
                                  batchStateMutation.mutate({ batchId: b.id, toState: s })
                                }
                              >
                                {ENROLMENT_STATE_LABEL[s]}
                              </Button>
                            ))
                          : null}
                      </div>
                    </td>
                  </tr>
                ))}
                {batches.length === 0 ? (
                  <tr>
                    <td className="p-4 text-muted-foreground" colSpan={7}>
                      No enrolment batches yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {tab === "reconciliation" ? (
        <div className="panel overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="p-3">Batch</th>
                <th className="p-3">FPO</th>
                <th className="p-3">Expected</th>
                <th className="p-3">Received</th>
                <th className="p-3">Variance</th>
                <th className="p-3">Status</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {reconciliation.map((r) => (
                <tr key={r.batchId} className="border-t border-border/60">
                  <td className="p-3 font-medium">{r.batchReference}</td>
                  <td className="p-3">{r.fpoName}</td>
                  <td className="p-3">{formatInr(r.expectedInr)}</td>
                  <td className="p-3">{formatInr(r.receivedInr)}</td>
                  <td className={r.varianceInr < 0 ? "p-3 text-destructive" : "p-3"}>
                    {formatInr(r.varianceInr)}
                  </td>
                  <td className="p-3">{r.status}</td>
                  <td className="p-3">
                    {canManage && r.status !== "matched" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={remitMutation.isPending}
                        onClick={() =>
                          remitMutation.mutate({
                            batchId: r.batchId,
                            amountInr: Math.max(0, r.expectedInr - r.receivedInr),
                          })
                        }
                      >
                        Record balance receipt
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
              {reconciliation.length === 0 ? (
                <tr>
                  <td className="p-4 text-muted-foreground" colSpan={7}>
                    Nothing to reconcile yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : null}

      {tab === "new" ? (
        <div className="panel space-y-3 p-4">
          {canManage ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="field-hint" htmlFor="new-fpo">
                    FPO (from your channel)
                  </label>
                  <select
                    id="new-fpo"
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
                  <label className="field-hint" htmlFor="new-crop">
                    Crop
                  </label>
                  <input
                    id="new-crop"
                    className="input-base"
                    value={form.crop}
                    onChange={(e) => setForm({ ...form, crop: e.target.value })}
                  />
                </div>
                <div>
                  <label className="field-hint" htmlFor="new-season">
                    Season
                  </label>
                  <input
                    id="new-season"
                    className="input-base"
                    value={form.season}
                    onChange={(e) => setForm({ ...form, season: e.target.value })}
                  />
                </div>
                <div>
                  <label className="field-hint" htmlFor="new-cutoff">
                    Enrolment cutoff
                  </label>
                  <input
                    id="new-cutoff"
                    type="date"
                    className="input-base"
                    value={form.enrolmentCutoff}
                    onChange={(e) => setForm({ ...form, enrolmentCutoff: e.target.value })}
                  />
                </div>
                <div>
                  <label className="field-hint" htmlFor="new-start">
                    Coverage start
                  </label>
                  <input
                    id="new-start"
                    type="date"
                    className="input-base"
                    value={form.coverageStart}
                    onChange={(e) => setForm({ ...form, coverageStart: e.target.value })}
                  />
                </div>
                <div>
                  <label className="field-hint" htmlFor="new-end">
                    Coverage end
                  </label>
                  <input
                    id="new-end"
                    type="date"
                    className="input-base"
                    value={form.coverageEnd}
                    onChange={(e) => setForm({ ...form, coverageEnd: e.target.value })}
                  />
                </div>
                <div>
                  <label className="field-hint" htmlFor="new-si">
                    Sum insured per acre (₹)
                  </label>
                  <input
                    id="new-si"
                    className="input-base"
                    inputMode="numeric"
                    value={form.sumInsuredPerAcreInr}
                    onChange={(e) => setForm({ ...form, sumInsuredPerAcreInr: e.target.value })}
                  />
                </div>
                <div>
                  <label className="field-hint" htmlFor="new-rate">
                    Actuarial rate (%)
                  </label>
                  <input
                    id="new-rate"
                    className="input-base"
                    inputMode="numeric"
                    value={form.actuarialRatePct}
                    onChange={(e) => setForm({ ...form, actuarialRatePct: e.target.value })}
                  />
                </div>
                <div>
                  <label className="field-hint" htmlFor="new-acres">
                    Planned insured acres
                  </label>
                  <input
                    id="new-acres"
                    className="input-base"
                    inputMode="numeric"
                    value={form.insuredAcres}
                    onChange={(e) => setForm({ ...form, insuredAcres: e.target.value })}
                  />
                </div>
                <div>
                  <label className="field-hint" htmlFor="new-members">
                    Planned member seats (aggregate)
                  </label>
                  <input
                    id="new-members"
                    className="input-base"
                    inputMode="numeric"
                    value={form.insuredMembers}
                    onChange={(e) => setForm({ ...form, insuredMembers: e.target.value })}
                  />
                </div>
              </div>
              <Button
                disabled={policyCreateMutation.isPending}
                onClick={() => policyCreateMutation.mutate()}
              >
                Create draft policy
              </Button>
              <p className="field-hint">
                Default premium shares follow the PMFBY pattern (farmer 2%, centre 49%, state 49%)
                and remain configurable per policy. [VALIDATE] against the current scheme notification.
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Creating policies requires an insurer administrator role.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
