import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/atap/AppShell";
import { StateBadge } from "@/components/atap/StatusBadge";
import { TrainingChecklistPanel } from "@/components/atap/TrainingChecklist";
import { useLanguage } from "@/components/atap/LanguageProvider";
import { FpoProfileSection } from "@/components/atap/fpo/FpoProfileSection";
import { FpoFarmersSection } from "@/components/atap/fpo/FpoFarmersSection";
import { FpoOpportunitiesSection } from "@/components/atap/fpo/FpoOpportunitiesSection";
import { FpoSchemesSection } from "@/components/atap/fpo/FpoSchemesSection";
import { FpoApplicationsSection } from "@/components/atap/fpo/FpoApplicationsSection";
import { FpoFacilitationSection } from "@/components/atap/fpo/FpoFacilitationSection";
import { FpoProcurementSection } from "@/components/atap/fpo/FpoProcurementSection";
import { FpoDocumentsSection } from "@/components/atap/fpo/FpoDocumentsSection";
import { Button } from "@/components/ui/button";
import {
  acceptInvite,
  getFpoWorkspace,
  importMembers,
  inviteStaff,
  revokeInvite,
  rosterVisibilityProbe,
} from "@/lib/atap/district.functions";
import { getFpoOverview } from "@/lib/atap/fpo.functions";
import { FPO_SECTION_DEFS, isFpoSection, sectionAvailable, type FpoSection } from "@/lib/atap/fpo";
import type { AppRole } from "@/lib/atap/policy";

export const Route = createFileRoute("/_authenticated/fpo")({
  head: () => ({
    meta: [
      { title: "FPO workspace — AgriGhar ATAP" },
      {
        name: "description",
        content:
          "FPO management and operations workspace: organization profile, compliance documents, farmer membership and scoped staff delegation. Roster authority never grants farmer data access.",
      },
      { property: "og:title", content: "FPO workspace — AgriGhar ATAP" },
      {
        property: "og:description",
        content:
          "Organization profile, compliance, membership and staff delegation for farmer producer organizations.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FpoPage,
});

function FpoPage() {
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  const fetchWorkspace = useServerFn(getFpoWorkspace);
  const fetchOverview = useServerFn(getFpoOverview);
  const invite = useServerFn(inviteStaff);
  const revoke = useServerFn(revokeInvite);
  const accept = useServerFn(acceptInvite);
  const importRows = useServerFn(importMembers);
  const probe = useServerFn(rosterVisibilityProbe);

  const [section, setSection] = useState<FpoSection>("overview");
  const [tenantId, setTenantId] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AppRole | "">("");
  const [note, setNote] = useState("");
  const [token, setToken] = useState("");
  const [rows, setRows] = useState("");
  const [sourceLabel, setSourceLabel] = useState("");
  const [probeResult, setProbeResult] = useState<string | null>(null);

  const workspace = useQuery({
    queryKey: ["atap", "fpo-workspace"],
    queryFn: () => fetchWorkspace(),
  });

  const data = workspace.data;
  const activeTenant = useMemo(
    () => data?.tenants.find((tn) => tn.id === tenantId) ?? data?.tenants[0] ?? null,
    [data, tenantId],
  );

  const overview = useQuery({
    queryKey: ["atap", "fpo-overview", activeTenant?.id ?? ""],
    queryFn: () => fetchOverview({ data: { tenantId: activeTenant?.id ?? "" } }),
    enabled: Boolean(activeTenant?.id),
  });

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["atap", "fpo-workspace"] });
    await queryClient.invalidateQueries({ queryKey: ["atap", "fpo-overview"] });
  };

  const inviteMutation = useMutation({
    mutationFn: () =>
      invite({
        data: {
          tenantId: activeTenant?.id ?? "",
          email,
          role: (role || activeTenant?.invitableRoles[0] || "viewer") as AppRole,
          note,
        },
      }),
    onSuccess: async (res) => {
      toast.success("Invitation created — share the reference with the invitee");
      setToken(res.id);
      setEmail("");
      setNote("");
      await refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const acceptMutation = useMutation({
    mutationFn: () => accept({ data: { inviteId: token } }),
    onSuccess: async () => {
      toast.success("Invitation accepted — scoped role granted and audited");
      setToken("");
      await refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const importMutation = useMutation({
    mutationFn: () =>
      importRows({
        data: {
          tenantId: activeTenant?.id ?? "",
          rows,
          sourceLabel: sourceLabel || "manual paste",
        },
      }),
    onSuccess: async (res) => {
      toast.success(`${res.accepted} member(s) added, ${res.rejected} row(s) rejected`);
      setRows("");
      await refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (workspace.isLoading) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-12 text-sm text-muted-foreground">
        {t("common.loading")}
      </main>
    );
  }

  if (!data || data.tenants.length === 0) {
    return (
      <main className="mx-auto max-w-3xl space-y-6 px-6 py-12">
        <PageHeader
          title={t("fpo.title")}
          description="You are not currently a member of an approved FPO tenant. Accept an invitation below, or ask a platform admin to provision your organization."
        />
        <section className="panel space-y-3 p-5">
          <h2 className="font-display text-sm font-semibold">Accept a staff invitation</h2>
          <input
            className="field-base"
            placeholder="Invitation reference"
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
          <Button
            onClick={() => acceptMutation.mutate()}
            disabled={!token || acceptMutation.isPending}
          >
            Accept invitation
          </Button>
          <p className="field-hint">
            Accepting grants only the scoped role named on the invitation, inside that one tenant.
          </p>
        </section>
      </main>
    );
  }

  const tenantInvites = data.invites.filter((i) => i.tenant_id === activeTenant?.id);
  const tenantBatches = data.batches.filter((b) => b.tenant_id === activeTenant?.id);
  const canManage = (activeTenant?.roles ?? []).includes("tenant_admin");
  const ov = overview.data;

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-6 py-12">
      <PageHeader title={t("fpo.title")} description={t("fpo.description")} />

      <section className="panel space-y-4 p-5">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm font-medium" htmlFor="tenant">
            Organization
          </label>
          <select
            id="tenant"
            className="field-base max-w-sm"
            value={activeTenant?.id ?? ""}
            onChange={(e) => setTenantId(e.target.value)}
          >
            {data.tenants.map((tn) => (
              <option key={tn.id} value={tn.id}>
                {tn.name} · {tn.tenant_type}
              </option>
            ))}
          </select>
          <div className="flex flex-wrap gap-2">
            {(activeTenant?.roles ?? []).map((r) => (
              <StateBadge key={r} state={r} />
            ))}
            {ov?.profile ? <StateBadge state={ov.profile.state} /> : null}
          </div>
        </div>
        <p className="field-hint">
          Delegated purchasing authority is{" "}
          <strong>{data.delegatedPurchasingEnabled ? "enabled" : "disabled"}</strong> — it stays off
          until decision D-08 is validated, regardless of flag state.
        </p>
      </section>

      <nav
        className="flex flex-wrap gap-1 border-b border-border pb-2 text-sm"
        aria-label="FPO sections"
      >
        {FPO_SECTION_DEFS.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setSection(isFpoSection(s.key) ? s.key : "overview")}
            className={
              section === s.key
                ? "rounded-md bg-secondary px-3 py-1.5 font-medium text-secondary-foreground"
                : "rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-secondary-foreground"
            }
          >
            {t(s.labelKey)}
          </button>
        ))}
      </nav>

      {section === "overview" ? (
        <div className="space-y-6">
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(ov?.metrics ?? []).map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => setSection(m.section)}
                className="panel p-4 text-left"
              >
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{m.label}</p>
                <p className="mt-1 text-2xl font-bold">{m.value}</p>
                {m.pending ? (
                  <p className="mt-1 text-xs text-muted-foreground">Activates in a later phase</p>
                ) : null}
              </button>
            ))}
          </section>

          <section className="panel space-y-3 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-base font-semibold">{t("fpo.onboarding.title")}</h2>
              <p className="text-sm text-muted-foreground">
                {ov?.completeness ?? 0}% {t("fpo.onboarding.complete")}
              </p>
            </div>
            <ol className="grid gap-2 sm:grid-cols-3">
              {(ov?.steps ?? []).map((s) => (
                <li
                  key={s.step}
                  className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm"
                >
                  <span>{s.label}</span>
                  <StateBadge state={s.status} />
                </li>
              ))}
            </ol>
            <Button variant="outline" size="sm" onClick={() => setSection("settings")}>
              Continue organization profile
            </Button>
          </section>

          {(ov?.missingDocuments.length ?? 0) > 0 ? (
            <section className="panel space-y-2 p-5">
              <h2 className="font-display text-base font-semibold">{t("fpo.documents.missing")}</h2>
              <p className="text-sm text-muted-foreground">
                {ov?.missingDocuments.map((d) => d.replaceAll("_", " ")).join(", ")}
              </p>
              <Button variant="outline" size="sm" onClick={() => setSection("documents")}>
                Open documents
              </Button>
            </section>
          ) : null}
        </div>
      ) : null}

      {section === "settings" ? (
        overview.isLoading || !ov ? (
          <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
        ) : (
          <FpoProfileSection overview={ov} onChanged={refresh} />
        )
      ) : null}

      {section === "documents" ? (
        overview.isLoading || !ov ? (
          <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
        ) : (
          <FpoDocumentsSection overview={ov} onChanged={refresh} />
        )
      ) : null}

      {section === "team" ? (
        <div className="space-y-6">
          <section className="grid gap-6 lg:grid-cols-2">
            <div className="panel space-y-3 p-5">
              <h2 className="font-display text-base font-semibold">Invite staff</h2>
              {canManage ? (
                <>
                  <input
                    className="field-base"
                    placeholder="staff@example.org"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                  <select
                    className="field-base"
                    value={role || activeTenant?.invitableRoles[0] || ""}
                    onChange={(e) => setRole(e.target.value as AppRole)}
                  >
                    {(activeTenant?.invitableRoles ?? []).map((r) => (
                      <option key={r} value={r}>
                        {r.replaceAll("_", " ")}
                      </option>
                    ))}
                  </select>
                  <input
                    className="field-base"
                    placeholder="Note (optional)"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                  <Button
                    onClick={() => inviteMutation.mutate()}
                    disabled={inviteMutation.isPending}
                  >
                    Create invitation
                  </Button>
                  {token ? (
                    <p className="field-hint break-all">
                      Invitation reference: <code>{token}</code>
                    </p>
                  ) : null}
                  <p className="field-hint">
                    Platform admin and auditor roles are never delegable from a tenant — they
                    require the privileged access workflow.
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Only a tenant admin of this organization can invite staff.
                </p>
              )}
            </div>

            <div className="panel space-y-3 p-5">
              <h2 className="font-display text-base font-semibold">Pending invitations</h2>
              {tenantInvites.length === 0 ? (
                <p className="text-sm text-muted-foreground">No invitations yet.</p>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {tenantInvites.map((i) => (
                      <tr key={i.id}>
                        <td>{i.invited_email}</td>
                        <td>{i.invited_role.replaceAll("_", " ")}</td>
                        <td>
                          <StateBadge state={i.status} />
                        </td>
                        <td className="text-right">
                          {canManage && i.status === "pending" ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={async () => {
                                await revoke({ data: { inviteId: i.id } });
                                toast.success("Invitation revoked and audited");
                                await refresh();
                              }}
                            >
                              Revoke
                            </Button>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <div className="space-y-2 border-t border-border pt-3">
                <input
                  className="field-base"
                  placeholder="Accept an invitation reference"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                />
                <Button
                  variant="outline"
                  onClick={() => acceptMutation.mutate()}
                  disabled={!token || acceptMutation.isPending}
                >
                  Accept invitation
                </Button>
              </div>
            </div>
          </section>

          <section className="panel space-y-3 p-5">
            <h2 className="font-display text-base font-semibold">Scoped visibility probe</h2>
            <p className="field-hint">
              Confirms that FPO staff authority stops at the roster: it returns the purposes this
              role grants over farmer data (expected: none).
            </p>
            <Button
              variant="outline"
              onClick={async () => {
                const res = await probe({ data: { tenantId: activeTenant?.id ?? "" } });
                setProbeResult(
                  `roster readable: ${res.canReadRoster} · farmer-data purposes granted: ${
                    res.grantedFarmerPurposes.length === 0
                      ? "none"
                      : res.grantedFarmerPurposes.join(", ")
                  } · other farmers' farm rows visible: ${res.otherFarmRowsVisible}`,
                );
              }}
            >
              Run probe
            </Button>
            {probeResult ? <p className="text-sm">{probeResult}</p> : null}
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-base font-semibold">Role training</h2>
            <TrainingChecklistPanel progress={data.training} invalidateKey="fpo-workspace" />
          </section>
        </div>
      ) : null}

      {section === "opportunities" ? (
        <FpoOpportunitiesSection tenantId={activeTenant?.id ?? ""} />
      ) : null}

      {section === "schemes" ? <FpoSchemesSection tenantId={activeTenant?.id ?? ""} /> : null}

      {section === "applications" ? (
        <div className="space-y-6">
          <FpoApplicationsSection tenantId={activeTenant?.id ?? ""} />
          <FpoFacilitationSection tenantId={activeTenant?.id ?? ""} />
        </div>
      ) : null}

      {section === "procurement" ? (
        <FpoProcurementSection tenantId={activeTenant?.id ?? ""} />
      ) : null}

      {section === "farmers" ? (
        <div className="space-y-6">
          <FpoFarmersSection tenantId={activeTenant?.id ?? ""} />

          <section className="panel space-y-3 p-5">
            <h2 className="font-display text-base font-semibold">Bulk member onboarding</h2>
            <p className="field-hint">
              One member per line: <code>member_ref, display name, village_code, contact hint</code>
              . Rows that fail are reported individually; re-importing the same file adds no
              duplicates.
            </p>
            {canManage ? (
              <>
                <input
                  className="field-base"
                  placeholder="Source label (e.g. Warangal register sheet 3)"
                  value={sourceLabel}
                  onChange={(e) => setSourceLabel(e.target.value)}
                />
                <textarea
                  className="field-base min-h-32 font-mono text-xs"
                  placeholder={"M-001, Lakshmi D., IN-TS-WGL-B1-V1\nM-002, Ravi K."}
                  value={rows}
                  onChange={(e) => setRows(e.target.value)}
                />
                <Button
                  onClick={() => importMutation.mutate()}
                  disabled={!rows || importMutation.isPending}
                >
                  Import members
                </Button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Only a tenant admin can import members. Staff and field agents have read-only roster
                access.
              </p>
            )}
            {tenantBatches.length > 0 ? (
              <div className="space-y-3 border-t border-border pt-3">
                {tenantBatches.map((b) => (
                  <div key={b.id} className="text-sm">
                    <p className="font-medium">
                      {b.source_label} — {b.accepted_count} accepted, {b.rejected_count} rejected of{" "}
                      {b.row_count}
                    </p>
                    {b.errors.length > 0 ? (
                      <ul className="mt-1 list-disc pl-5 text-xs text-muted-foreground">
                        {b.errors.map((err, idx) => (
                          <li key={`${b.id}-${idx}`}>
                            Row {err.line}: {err.reason.replaceAll("_", " ")}
                            {err.raw ? ` — ${err.raw}` : ""}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
          </section>
        </div>
      ) : null}

      {!sectionAvailable(section) ? (
        <section className="panel space-y-2 p-5">
          <h2 className="font-display text-base font-semibold">
            {t(FPO_SECTION_DEFS.find((s) => s.key === section)?.labelKey ?? "fpo.section.overview")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("fpo.comingSoon")}</p>
        </section>
      ) : null}
    </main>
  );
}
