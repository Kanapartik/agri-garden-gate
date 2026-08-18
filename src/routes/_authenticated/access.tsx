import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/atap/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  assignTenantRole,
  createRoleDefinition,
  getAccessConsole,
  revokeTenantRole,
} from "@/lib/atap/access.functions";
import { assignableRoles, SUPER_ADMIN_TENANT_ROLES } from "@/lib/atap/access";
import type { AppRole, TenantType } from "@/lib/atap/policy";

export const Route = createFileRoute("/_authenticated/access")({
  head: () => ({
    meta: [
      { title: "Access & roles — AgriGhar ATAP" },
      {
        name: "description",
        content:
          "Super admin console: define roles, appoint tenant admins for FPOs, banks, insurers and departments, and let tenant admins manage their own users.",
      },
      { property: "og:title", content: "Access & roles — AgriGhar ATAP" },
      {
        property: "og:description",
        content: "Role catalogue, tenant admin appointments and delegated user management.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AccessPage,
});

function AccessPage() {
  const fetchConsole = useServerFn(getAccessConsole);
  const queryClient = useQueryClient();
  const consoleQuery = useQuery({
    queryKey: ["atap", "access-console"],
    queryFn: () => fetchConsole(),
  });

  const assign = useServerFn(assignTenantRole);
  const revoke = useServerFn(revokeTenantRole);
  const createRole = useServerFn(createRoleDefinition);

  const [tenantId, setTenantId] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AppRole>("tenant_admin");
  const [draft, setDraft] = useState({
    code: "",
    label: "",
    description: "",
    binding: "viewer" as AppRole,
    tenantType: "" as "" | TenantType,
  });

  const data = consoleQuery.data;
  const actor = useMemo(
    () => ({
      userId: data?.actor.userId ?? "",
      isPlatformAdmin: data?.actor.isPlatformAdmin ?? false,
      tenantAdminOf: data?.actor.tenantAdminOf ?? [],
    }),
    [data],
  );
  const activeTenantId = tenantId || data?.tenants[0]?.id || "";
  const rolesForTenant = assignableRoles(activeTenantId, actor);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["atap", "access-console"] });

  const assignMutation = useMutation({
    mutationFn: () => assign({ data: { tenantId: activeTenantId, email, role } }),
    onSuccess: () => {
      toast.success(`${role.replaceAll("_", " ")} assigned`);
      setEmail("");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revokeMutation = useMutation({
    mutationFn: (v: { targetUserId: string; tenantId: string; role: AppRole }) =>
      revoke({ data: { tenantId: v.tenantId, targetUserId: v.targetUserId, role: v.role } }),
    onSuccess: () => {
      toast.success("Role revoked");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createRoleMutation = useMutation({
    mutationFn: () =>
      createRole({
        data: {
          code: draft.code,
          label: draft.label,
          description: draft.description,
          appRoleBinding: draft.binding,
          ...(draft.tenantType ? { tenantTypeScope: draft.tenantType } : {}),
        },
      }),
    onSuccess: () => {
      toast.success("Role added to the catalogue");
      setDraft({ code: "", label: "", description: "", binding: "viewer", tenantType: "" });
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (consoleQuery.isLoading) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-12 text-sm text-muted-foreground">Loading…</main>
    );
  }
  if (!data || (!actor.isPlatformAdmin && actor.tenantAdminOf.length === 0)) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-12 text-sm text-field-invalid">
        This console is limited to the platform super admin and tenant administrators.
      </main>
    );
  }

  const tenantName = (id: string | null) =>
    id ? (data.tenants.find((t) => t.id === id)?.name ?? "—") : "Platform-wide";

  return (
    <main className="mx-auto max-w-6xl space-y-10 px-6 py-12">
      <PageHeader
        eyebrow={actor.isPlatformAdmin ? "Super admin" : "Tenant admin"}
        title="Access & roles"
        description="Roles are configuration, not code. The super admin defines the catalogue and appoints tenant administrators; each tenant admin then manages their own users. Tenancy grants no farmer-data access — consent is separate."
      />

      {/* -------------------------------------------------- assignment */}
      <section className="panel space-y-4 p-6">
        <h2 className="font-display text-lg font-semibold">
          {actor.isPlatformAdmin ? "Appoint tenant admins & staff" : "Manage your tenant users"}
        </h2>
        <div className="grid gap-4 sm:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="tenant">Tenant</Label>
            <select
              id="tenant"
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              value={activeTenantId}
              onChange={(e) => setTenantId(e.target.value)}
            >
              {data.tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} · {t.tenant_type}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="role">Role</Label>
            <select
              id="role"
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              value={role}
              onChange={(e) => setRole(e.target.value as AppRole)}
            >
              {rolesForTenant.map((r) => (
                <option key={r} value={r}>
                  {r.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">User email</Label>
            <Input
              id="email"
              type="email"
              placeholder="person@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <Button
              className="w-full"
              disabled={!email || !activeTenantId || assignMutation.isPending}
              onClick={() => assignMutation.mutate()}
            >
              Assign role
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          The user must already have an account. Every assignment and revocation is written to the
          audit trail.
        </p>
      </section>

      {/* -------------------------------------------------- tenants */}
      <section className="panel overflow-x-auto p-1">
        <table className="data-table">
          <thead>
            <tr>
              <th>Tenant</th>
              <th>Type</th>
              <th>Region</th>
              <th>Status</th>
              <th>Tenant admins</th>
            </tr>
          </thead>
          <tbody>
            {data.tenants.map((t) => (
              <tr key={t.id}>
                <td>{t.name}</td>
                <td className="text-muted-foreground">{t.tenant_type}</td>
                <td className="font-mono text-xs">{t.region_code ?? "—"}</td>
                <td>{t.status}</td>
                <td>{t.adminCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* -------------------------------------------------- directory */}
      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">People &amp; role grants</h2>
        <div className="panel overflow-x-auto p-1">
          <table className="data-table">
            <thead>
              <tr>
                <th>Person</th>
                <th>Email</th>
                <th>Roles</th>
              </tr>
            </thead>
            <tbody>
              {data.directory.map((u) => (
                <tr key={u.userId}>
                  <td>{u.fullName ?? "—"}</td>
                  <td className="font-mono text-xs">{u.email}</td>
                  <td>
                    <div className="flex flex-wrap gap-1.5">
                      {u.roles.length === 0 ? (
                        <span className="text-muted-foreground">no roles</span>
                      ) : (
                        u.roles.map((r) => (
                          <span
                            key={`${r.role}-${r.tenantId ?? "platform"}`}
                            className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs"
                          >
                            {r.role.replaceAll("_", " ")} · {tenantName(r.tenantId)}
                            {r.tenantId ? (
                              <button
                                type="button"
                                className="text-field-invalid hover:underline"
                                onClick={() =>
                                  revokeMutation.mutate({
                                    targetUserId: u.userId,
                                    tenantId: r.tenantId as string,
                                    role: r.role,
                                  })
                                }
                                aria-label={`Revoke ${r.role}`}
                              >
                                ×
                              </button>
                            ) : null}
                          </span>
                        ))
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* -------------------------------------------------- catalogue */}
      {actor.isPlatformAdmin ? (
        <section className="space-y-4">
          <h2 className="font-display text-lg font-semibold">Role catalogue</h2>
          <div className="panel grid gap-4 p-6 sm:grid-cols-5">
            <div className="space-y-1.5">
              <Label htmlFor="code">Code</Label>
              <Input
                id="code"
                placeholder="fpo_treasurer"
                value={draft.code}
                onChange={(e) => setDraft({ ...draft, code: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="label">Label</Label>
              <Input
                id="label"
                placeholder="FPO treasurer"
                value={draft.label}
                onChange={(e) => setDraft({ ...draft, label: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="binding">Authority binding</Label>
              <select
                id="binding"
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={draft.binding}
                onChange={(e) => setDraft({ ...draft, binding: e.target.value as AppRole })}
              >
                {SUPER_ADMIN_TENANT_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ttype">Applies to</Label>
              <select
                id="ttype"
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={draft.tenantType}
                onChange={(e) =>
                  setDraft({ ...draft, tenantType: e.target.value as "" | TenantType })
                }
              >
                <option value="">any tenant type</option>
                {(
                  ["fpo", "bank", "insurer", "govt_dept", "agri_business", "platform_ops"] as const
                ).map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <Button
                className="w-full"
                disabled={!draft.code || !draft.label || createRoleMutation.isPending}
                onClick={() => createRoleMutation.mutate()}
              >
                Add role
              </Button>
            </div>
          </div>

          <div className="panel overflow-x-auto p-1">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Label</th>
                  <th>Binding</th>
                  <th>Applies to</th>
                  <th>Source</th>
                  <th>Active</th>
                </tr>
              </thead>
              <tbody>
                {data.roleDefinitions.map((d) => (
                  <tr key={d.code}>
                    <td className="font-mono text-xs">{d.code}</td>
                    <td>{d.label}</td>
                    <td className="text-muted-foreground">
                      {d.app_role_binding?.replaceAll("_", " ") ?? "—"}
                    </td>
                    <td>{d.tenant_type_scope ?? "any"}</td>
                    <td>{d.is_custom ? "custom" : "baseline"}</td>
                    <td>{d.is_active ? "yes" : "no"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </main>
  );
}
