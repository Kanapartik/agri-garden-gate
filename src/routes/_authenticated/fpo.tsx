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
import { FpoProduceSection } from "@/components/atap/fpo/FpoProduceSection";
import { FpoAccountsSection } from "@/components/atap/fpo/FpoAccountsSection";
import { FpoBillingSection } from "@/components/atap/fpo/FpoBillingSection";
import { FpoDocumentsSection } from "@/components/atap/fpo/FpoDocumentsSection";
import { FpoNotificationsSection } from "@/components/atap/fpo/FpoNotificationsSection";
import { FpoTasksSection } from "@/components/atap/fpo/FpoTasksSection";
import { FpoTeamSection } from "@/components/atap/fpo/FpoTeamSection";
import { FpoInsightsSection } from "@/components/atap/fpo/FpoInsightsSection";
import { FpoMemberHistorySection } from "@/components/atap/fpo/FpoMemberHistorySection";
import { FpoMonitoringSection } from "@/components/atap/fpo/FpoMonitoringSection";
import { FpoBenchmarkSection } from "@/components/atap/fpo/FpoBenchmarkSection";
import { FpoInsuranceSection } from "@/components/atap/fpo/FpoInsuranceSection";
import { FpoCommandCenter } from "@/components/atap/fpo/FpoCommandCenter";
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
      toast.success(t("fpo.ui.394128a56e"));
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
      toast.success(t("fpo.ui.715d6b2cae"));
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
          <h2 className="font-display text-sm font-semibold">{t("fpo.ui.533799b9d2")}</h2>
          <input
            className="field-base"
            placeholder={t("fpo.ui.4d8e75b397")}
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
          <Button
            onClick={() => acceptMutation.mutate()}
            disabled={!token || acceptMutation.isPending}
          >
            {t("fpo.ui.0b918ca2e5")}</Button>
          <p className="field-hint">
            {t("fpo.ui.e7ede55ae8")}</p>
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
            {t("fpo.ui.519255ae1f")}</label>
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
          {t("fpo.ui.9fbc20960c")}{" "}
          <strong>{data.delegatedPurchasingEnabled ? "enabled" : "disabled"}</strong> {t("fpo.ui.50f3b753ef")}</p>
      </section>

      <nav
        className="flex flex-wrap gap-1 border-b border-border pb-2 text-sm"
        aria-label={t("fpo.ui.e5b52382f1")}
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
        overview.isLoading || !ov ? (
          <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
        ) : (
          <FpoCommandCenter overview={ov} onOpenSection={setSection} />
        )
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
          <FpoTeamSection tenantId={activeTenant?.id ?? ""} />

          <section className="grid gap-6 lg:grid-cols-2">
            <div className="panel space-y-3 p-5">
              <h2 className="font-display text-base font-semibold">{t("fpo.ui.a7bbc7a7fd")}</h2>
              {canManage ? (
                <>
                  <input
                    className="field-base"
                    placeholder={t("fpo.ui.bf4ac958f7")}
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
                    placeholder={t("fpo.ui.4e39567064")}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                  <Button
                    onClick={() => inviteMutation.mutate()}
                    disabled={inviteMutation.isPending}
                  >
                    {t("fpo.ui.7635958a91")}</Button>
                  {token ? (
                    <p className="field-hint break-all">
                      {t("fpo.ui.4f2dabb77a")}{" "}<code>{token}</code>
                    </p>
                  ) : null}
                  <p className="field-hint">
                    {t("fpo.ui.b037e3541c")}</p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t("fpo.ui.7b15e43a69")}</p>
              )}
            </div>

            <div className="panel space-y-3 p-5">
              <h2 className="font-display text-base font-semibold">{t("fpo.ui.8970d0600c")}</h2>
              {tenantInvites.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("fpo.ui.485c403a62")}</p>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{t("fpo.ui.84add5b295")}</th>
                      <th>{t("fpo.ui.c3f104d136")}</th>
                      <th>{t("fpo.ui.bae7d5be70")}</th>
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
                                toast.success(t("fpo.ui.848cc6eba8"));
                                await refresh();
                              }}
                            >
                              {t("fpo.ui.0be720759f")}</Button>
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
                  placeholder={t("fpo.ui.9030463a3b")}
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                />
                <Button
                  variant="outline"
                  onClick={() => acceptMutation.mutate()}
                  disabled={!token || acceptMutation.isPending}
                >
                  {t("fpo.ui.0b918ca2e5")}</Button>
              </div>
            </div>
          </section>

          <section className="panel space-y-3 p-5">
            <h2 className="font-display text-base font-semibold">{t("fpo.ui.5f6b1151ff")}</h2>
            <p className="field-hint">
              {t("fpo.ui.4dd288d1e6")}</p>
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
              {t("fpo.ui.3a140554da")}</Button>
            {probeResult ? <p className="text-sm">{probeResult}</p> : null}
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-base font-semibold">{t("fpo.ui.36e714bcf8")}</h2>
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

      {section === "produce" ? <FpoProduceSection tenantId={activeTenant?.id ?? ""} /> : null}
      {section === "accounts" ? <FpoAccountsSection tenantId={activeTenant?.id ?? ""} /> : null}
      {section === "billing" ? (
        <FpoBillingSection
          tenantId={activeTenant?.id ?? ""}
          orgLabel={activeTenant?.name ?? "Farmer Producer Organization"}
        />
      ) : null}
      {section === "notifications" ? (
        <FpoNotificationsSection tenantId={activeTenant?.id ?? ""} />
      ) : null}
      {section === "tasks" ? <FpoTasksSection tenantId={activeTenant?.id ?? ""} /> : null}
      {section === "member_history" ? (
        <FpoMemberHistorySection tenantId={activeTenant?.id ?? ""} />
      ) : null}
      {section === "monitoring" ? <FpoMonitoringSection tenantId={activeTenant?.id ?? ""} /> : null}
      {section === "benchmark" ? <FpoBenchmarkSection tenantId={activeTenant?.id ?? ""} /> : null}
      {section === "insurance" ? <FpoInsuranceSection tenantId={activeTenant?.id ?? ""} /> : null}

      {section === "insights" ? (
        <FpoInsightsSection tenantId={activeTenant?.id ?? ""} onOpenSection={setSection} />
      ) : null}

      {section === "farmers" ? (
        <div className="space-y-6">
          <FpoFarmersSection tenantId={activeTenant?.id ?? ""} />

          <section className="panel space-y-3 p-5">
            <h2 className="font-display text-base font-semibold">{t("fpo.ui.d64178fc8b")}</h2>
            <p className="field-hint">
              {t("fpo.ui.eddb2788b3")}{" "}<code>{t("fpo.ui.a8173ac269")}</code>
              {t("fpo.ui.9408c4d462")}</p>
            {canManage ? (
              <>
                <input
                  className="field-base"
                  placeholder={t("fpo.ui.678e4d273a")}
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
                  {t("fpo.ui.40cefe66d8")}</Button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t("fpo.ui.599ee4e0e7")}</p>
            )}
            {tenantBatches.length > 0 ? (
              <div className="space-y-3 border-t border-border pt-3">
                {tenantBatches.map((b) => (
                  <div key={b.id} className="text-sm">
                    <p className="font-medium">
                      {b.source_label} — {b.accepted_count} {t("fpo.ui.eacad92797")}{" "}{b.rejected_count} {t("fpo.ui.c09ffc689c")}{" "}
                      {b.row_count}
                    </p>
                    {b.errors.length > 0 ? (
                      <ul className="mt-1 list-disc pl-5 text-xs text-muted-foreground">
                        {b.errors.map((err, idx) => (
                          <li key={`${b.id}-${idx}`}>
                            {t("fpo.ui.9bf7a8e890")}{" "}{err.line}: {err.reason.replaceAll("_", " ")}
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
