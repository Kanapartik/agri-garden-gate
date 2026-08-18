import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/atap/AppShell";
import { Button } from "@/components/ui/button";
import {
  advanceOnboardingWorkflow,
  createOrganization,
  createTenantRelationship,
  decideOrganization,
  decidePrivilegedAccess,
  decideVerificationCase,
  getAdminConsole,
  grantScopedRole,
  openVerificationCase,
  provisionTenant,
  requestPrivilegedAccess,
  setTenantEntitlement,
  suspendTenantMembership,
} from "@/lib/atap/admin.functions";
import type { AppRole } from "@/lib/atap/policy";
import type { OrgStatus, TenantRelationshipType, WorkflowState } from "@/lib/atap/identity";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin control plane — AgriGhar ATAP" },
      {
        name: "description",
        content:
          "Platform admin queues for organisation approval, tenant provisioning, scoped role grants, verification cases and privileged access — every action audited.",
      },
      { property: "og:title", content: "Admin control plane — AgriGhar ATAP" },
      {
        property: "og:description",
        content: "Audited admin queues for organisations, tenants, roles and verification cases.",
      },
    ],
  }),
  component: AdminPage,
});

const QK = ["atap", "admin-console"];

function Panel({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="panel space-y-4 p-5">
      <div>
        <h2 className="font-display text-lg font-semibold">{title}</h2>
        {note ? <p className="text-xs text-muted-foreground">{note}</p> : null}
      </div>
      {children}
    </section>
  );
}

function AdminPage() {
  const queryClient = useQueryClient();
  const fetchConsole = useServerFn(getAdminConsole);
  const console_ = useQuery({ queryKey: QK, queryFn: () => fetchConsole() });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: QK });
  const onErr = (e: Error) => toast.error(e.message);

  const createOrg = useServerFn(createOrganization);
  const decideOrg = useServerFn(decideOrganization);
  const provision = useServerFn(provisionTenant);
  const relate = useServerFn(createTenantRelationship);
  const grant = useServerFn(grantScopedRole);
  const suspend = useServerFn(suspendTenantMembership);
  const openCase = useServerFn(openVerificationCase);
  const decideCase = useServerFn(decideVerificationCase);
  const advance = useServerFn(advanceOnboardingWorkflow);
  const requestPriv = useServerFn(requestPrivilegedAccess);
  const decidePriv = useServerFn(decidePrivilegedAccess);
  const setPlan = useServerFn(setTenantEntitlement);

  const run = <T,>(fn: (input: { data: T }) => Promise<unknown>, message: string) =>
    useMutation({
      mutationFn: (data: T) => fn({ data }),
      onSuccess: async () => {
        toast.success(message);
        await invalidate();
      },
      onError: onErr,
    });

  const mCreateOrg = run<{ legalName: string; displayName: string; subtypeCode: string; evidence: string[] }>(
    createOrg as never,
    "Organisation draft created and audited",
  );
  const mDecideOrg = run<{ organizationId: string; next: OrgStatus; note?: string }>(
    decideOrg as never,
    "Organisation decision recorded",
  );
  const mProvision = run<{ organizationId: string; slug: string }>(
    provision as never,
    "Tenant provisioned (tenancy grants no authority)",
  );
  const mRelate = run<{
    fromTenantId: string;
    toTenantId: string;
    relationshipType: TenantRelationshipType;
  }>(relate as never, "Tenant relationship recorded");
  const mGrant = run<{ tenantId: string; targetUserId: string; role: AppRole }>(
    grant as never,
    "Scoped role granted and audited",
  );
  const mSuspend = run<{ tenantId: string; targetUserId: string }>(
    suspend as never,
    "Membership suspended and roles revoked",
  );
  const mOpenCase = run<{ caseType: string; subjectType: string; subjectId: string; tenantId?: string | null }>(
    openCase as never,
    "Verification case opened",
  );
  const mDecideCase = run<{ caseId: string; decision: "approved" | "rejected" | "escalated" }>(
    decideCase as never,
    "Case decided by a human reviewer",
  );
  const mAdvance = run<{ workflowId: string; next: WorkflowState }>(
    advance as never,
    "Workflow advanced",
  );
  const mRequestPriv = run<{ requestedRole: AppRole; justification: string }>(
    requestPriv as never,
    "Privileged access requested",
  );
  const mDecidePriv = run<{ requestId: string; approve: boolean; mfaVerified: boolean }>(
    decidePriv as never,
    "Privileged access decision recorded",
  );
  const mSetPlan = run<{ tenantId: string; planCode: string }>(
    setPlan as never,
    "Commercial plan updated — roles and consent unchanged",
  );

  const [orgForm, setOrgForm] = useState({ legalName: "", displayName: "", subtypeCode: "" });
  const [slugs, setSlugs] = useState<Record<string, string>>({});
  const [grantForm, setGrantForm] = useState({ tenantId: "", targetUserId: "", role: "viewer" as AppRole });
  const [relForm, setRelForm] = useState({
    fromTenantId: "",
    toTenantId: "",
    relationshipType: "data_partner" as TenantRelationshipType,
  });
  const [justification, setJustification] = useState("");

  if (console_.isLoading) {
    return <main className="mx-auto max-w-6xl px-6 py-12 text-sm text-muted-foreground">Loading…</main>;
  }
  const d = console_.data;
  if (!d) return <main className="mx-auto max-w-6xl px-6 py-12">Console unavailable.</main>;

  const isAdmin = d.actor.isPlatformAdmin;

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-6 py-10">
      <PageHeader
        eyebrow="B1 · control plane"
        title="Admin control plane"
        description="Organisation approval, tenant provisioning, scoped role grants, verification cases and privileged access. Every action is authorised server-side and written to the audit timeline — synthetic data only."
      />

      {!isAdmin ? (
        <p className="field-hint rounded-md border border-border p-4">
          Your account holds no platform admin role. Read-only queues below reflect what your roles
          permit; admin actions are rejected by the server even if you call them directly.
        </p>
      ) : null}

      <Panel
        title="Organisation registry"
        note="Draft → Pending → Approved. Subtypes and their evidence requirements are configuration."
      >
        <div className="grid gap-2 sm:grid-cols-4">
          <input
            className="field-base"
            placeholder="Legal name"
            value={orgForm.legalName}
            onChange={(e) => setOrgForm({ ...orgForm, legalName: e.target.value })}
          />
          <input
            className="field-base"
            placeholder="Display name"
            value={orgForm.displayName}
            onChange={(e) => setOrgForm({ ...orgForm, displayName: e.target.value })}
          />
          <select
            className="field-base"
            value={orgForm.subtypeCode}
            onChange={(e) => setOrgForm({ ...orgForm, subtypeCode: e.target.value })}
          >
            <option value="">Select subtype…</option>
            {d.subtypes.map((s) => (
              <option key={s.code} value={s.code}>
                {s.label}
              </option>
            ))}
          </select>
          <Button
            disabled={!orgForm.legalName || !orgForm.displayName || !orgForm.subtypeCode}
            onClick={() => {
              const subtype = d.subtypes.find((s) => s.code === orgForm.subtypeCode);
              mCreateOrg.mutate({ ...orgForm, evidence: subtype?.evidence_required ?? [] });
            }}
          >
            Create test org
          </Button>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th>Organisation</th>
              <th>Subtype</th>
              <th>Status</th>
              <th>Tenant</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {d.organizations.map((o) => (
              <tr key={o.id}>
                <td>
                  {o.display_name}
                  <div className="text-xs text-muted-foreground">{o.legal_name}</div>
                </td>
                <td>{o.subtype_code}</td>
                <td>{o.status}</td>
                <td>{o.tenant_id ? o.tenant_id.slice(0, 8) : "—"}</td>
                <td className="space-x-2 whitespace-nowrap">
                  {o.status === "draft" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => mDecideOrg.mutate({ organizationId: o.id, next: "pending" })}
                    >
                      Submit
                    </Button>
                  ) : null}
                  {o.status === "pending" && isAdmin ? (
                    <>
                      <Button
                        size="sm"
                        onClick={() =>
                          mDecideOrg.mutate({ organizationId: o.id, next: "approved", note: "synthetic approval" })
                        }
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => mDecideOrg.mutate({ organizationId: o.id, next: "rejected" })}
                      >
                        Reject
                      </Button>
                    </>
                  ) : null}
                  {o.status === "approved" && !o.tenant_id && isAdmin ? (
                    <span className="inline-flex items-center gap-1">
                      <input
                        className="field-base w-32"
                        placeholder="tenant-slug"
                        value={slugs[o.id] ?? ""}
                        onChange={(e) => setSlugs({ ...slugs, [o.id]: e.target.value })}
                      />
                      <Button
                        size="sm"
                        onClick={() => mProvision.mutate({ organizationId: o.id, slug: slugs[o.id] ?? "" })}
                      >
                        Provision tenant
                      </Button>
                    </span>
                  ) : null}
                  {isAdmin ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        mOpenCase.mutate({
                          caseType: "organization_evidence",
                          subjectType: "organization",
                          subjectId: o.id,
                          tenantId: o.tenant_id,
                        })
                      }
                    >
                      Open case
                    </Button>
                  ) : null}
                </td>
              </tr>
            ))}
            {d.organizations.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-muted-foreground">
                  No organisations visible to your roles.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Panel>

      <Panel
        title="Tenant relationships"
        note="Relationships describe integration only. They never confer authority, support ownership or farmer-data access."
      >
        <div className="grid gap-2 sm:grid-cols-4">
          <select
            className="field-base"
            value={relForm.fromTenantId}
            onChange={(e) => setRelForm({ ...relForm, fromTenantId: e.target.value })}
          >
            <option value="">From tenant…</option>
            {d.tenants.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <select
            className="field-base"
            value={relForm.toTenantId}
            onChange={(e) => setRelForm({ ...relForm, toTenantId: e.target.value })}
          >
            <option value="">To tenant…</option>
            {d.tenants.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <select
            className="field-base"
            value={relForm.relationshipType}
            onChange={(e) =>
              setRelForm({ ...relForm, relationshipType: e.target.value as TenantRelationshipType })
            }
          >
            {["parent", "affiliation", "service_provider", "data_partner"].map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <Button
            disabled={!relForm.fromTenantId || !relForm.toTenantId}
            onClick={() => mRelate.mutate(relForm)}
          >
            Link tenants
          </Button>
        </div>
        <ul className="space-y-1 text-sm">
          {d.relationships.map((r) => (
            <li key={r.id} className="text-muted-foreground">
              {r.from_tenant_id.slice(0, 8)} → {r.to_tenant_id.slice(0, 8)} · {r.relationship_type} ·{" "}
              {r.status}
            </li>
          ))}
          {d.relationships.length === 0 ? <li className="field-hint">No relationships yet.</li> : null}
        </ul>
      </Panel>

      <Panel title="Scoped role grants & suspension" note="Platform-wide roles are never grantable here.">
        <div className="grid gap-2 sm:grid-cols-4">
          <select
            className="field-base"
            value={grantForm.tenantId}
            onChange={(e) => setGrantForm({ ...grantForm, tenantId: e.target.value })}
          >
            <option value="">Tenant…</option>
            {d.tenants.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <input
            className="field-base"
            placeholder="Target user id (uuid)"
            value={grantForm.targetUserId}
            onChange={(e) => setGrantForm({ ...grantForm, targetUserId: e.target.value })}
          />
          <select
            className="field-base"
            value={grantForm.role}
            onChange={(e) => setGrantForm({ ...grantForm, role: e.target.value as AppRole })}
          >
            {["tenant_admin", "onboarding_officer", "field_agent", "consumer_api_manager", "viewer"].map(
              (r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ),
            )}
          </select>
          <div className="flex gap-2">
            <Button
              disabled={!grantForm.tenantId || !grantForm.targetUserId}
              onClick={() => mGrant.mutate(grantForm)}
            >
              Grant
            </Button>
            <Button
              variant="outline"
              disabled={!grantForm.tenantId || !grantForm.targetUserId}
              onClick={() =>
                mSuspend.mutate({ tenantId: grantForm.tenantId, targetUserId: grantForm.targetUserId })
              }
            >
              Suspend
            </Button>
          </div>
        </div>
      </Panel>

      <Panel title="Verification queue" note="Decisions are made by an authorised human; no auto-decisioning.">
        <table className="data-table">
          <thead>
            <tr>
              <th>Case</th>
              <th>Subject</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {d.cases.map((c) => (
              <tr key={c.id}>
                <td>{c.case_type}</td>
                <td className="text-xs text-muted-foreground">
                  {c.subject_type}:{c.subject_id.slice(0, 8)}
                </td>
                <td>{c.status}</td>
                <td className="space-x-2">
                  {c.status === "open" || c.status === "in_review" ? (
                    <>
                      <Button size="sm" onClick={() => mDecideCase.mutate({ caseId: c.id, decision: "approved" })}>
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => mDecideCase.mutate({ caseId: c.id, decision: "rejected" })}
                      >
                        Reject
                      </Button>
                    </>
                  ) : null}
                </td>
              </tr>
            ))}
            {d.cases.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-muted-foreground">
                  No cases.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Panel>

      <Panel title="Onboarding workflows" note="Reusable workflow shell shared by every role journey.">
        <ul className="space-y-2 text-sm">
          {d.workflows.map((w) => (
            <li key={w.id} className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{w.workflow_key}</span>
              <span className="text-xs text-muted-foreground">
                {w.subject_type}:{w.subject_id.slice(0, 8)} · {w.current_state}
              </span>
              {(
                [
                  ["contact_verified", "created"],
                  ["evidence_submitted", "contact_verified"],
                  ["in_review", "evidence_submitted"],
                  ["activated", "in_review"],
                ] as const
              )
                .filter(([, from]) => from === w.current_state)
                .map(([next]) => (
                  <Button
                    key={next}
                    size="sm"
                    variant="outline"
                    onClick={() => mAdvance.mutate({ workflowId: w.id, next: next as WorkflowState })}
                  >
                    → {next}
                  </Button>
                ))}
            </li>
          ))}
          {d.workflows.length === 0 ? <li className="field-hint">No workflows yet.</li> : null}
        </ul>
      </Panel>

      <Panel
        title="Privileged access (MFA workflow)"
        note="Platform-wide roles require an approved, MFA-verified, time-boxed elevation. MFA provider is [VALIDATE] — the confirmation flag is synthetic in B1."
      >
        <div className="flex flex-wrap gap-2">
          <input
            className="field-base flex-1"
            placeholder="Justification for platform_admin elevation"
            value={justification}
            onChange={(e) => setJustification(e.target.value)}
          />
          <Button
            disabled={!justification.trim()}
            onClick={() => mRequestPriv.mutate({ requestedRole: "platform_admin", justification })}
          >
            Request elevation
          </Button>
        </div>
        <ul className="space-y-2 text-sm">
          {d.privilegeRequests.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{p.requested_role}</span>
              <span className="text-xs text-muted-foreground">
                {p.requester_user_id.slice(0, 8)} · {p.status} · mfa {String(p.mfa_verified)}
              </span>
              {p.status === "pending" && isAdmin ? (
                <>
                  <Button
                    size="sm"
                    onClick={() => mDecidePriv.mutate({ requestId: p.id, approve: true, mfaVerified: true })}
                  >
                    Approve (MFA ok)
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => mDecidePriv.mutate({ requestId: p.id, approve: false, mfaVerified: false })}
                  >
                    Deny
                  </Button>
                </>
              ) : null}
            </li>
          ))}
          {d.privilegeRequests.length === 0 ? <li className="field-hint">No requests.</li> : null}
        </ul>
      </Panel>

      <Panel
        title="Commercial entitlements"
        note="Plans are commercial only: setting one writes no roles and no consent grants."
      >
        <div className="flex flex-wrap gap-2">
          <select
            className="field-base"
            value={grantForm.tenantId}
            onChange={(e) => setGrantForm({ ...grantForm, tenantId: e.target.value })}
          >
            <option value="">Tenant…</option>
            {d.tenants.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <Button
            disabled={!grantForm.tenantId}
            onClick={() => mSetPlan.mutate({ tenantId: grantForm.tenantId, planCode: "standard" })}
          >
            Set standard plan
          </Button>
        </div>
        <ul className="text-sm text-muted-foreground">
          {d.entitlements.map((e) => (
            <li key={e.id}>
              {e.tenant_id.slice(0, 8)} · {e.plan_code} · {e.status}
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="Audit timeline" note="Append-only. Denied attempts are recorded alongside approvals.">
        <ol className="space-y-1 text-xs">
          {d.audit.map((a) => (
            <li key={a.id} className="flex flex-wrap gap-2">
              <span className="text-muted-foreground">{new Date(a.created_at).toLocaleString()}</span>
              <span className="font-medium">{a.action}</span>
              <span className={a.decision === "allow" ? "text-primary" : "text-destructive"}>
                {a.decision}
              </span>
              <span className="text-muted-foreground">
                {a.subject_type}:{a.subject_id?.slice(0, 8) ?? "—"}
              </span>
            </li>
          ))}
          {d.audit.length === 0 ? <li className="field-hint">No audit events visible.</li> : null}
        </ol>
      </Panel>
    </main>
  );
}
