import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { StateBadge } from "@/components/atap/StatusBadge";
import { FpoTeamSection } from "@/components/atap/fpo/FpoTeamSection";
import { FpoStaffAccounts } from "@/components/atap/fpo/FpoStaffAccounts";
import { getFpoWorkspace, inviteStaff, revokeInvite } from "@/lib/atap/district.functions";
import { useLanguage } from "@/components/atap/LanguageProvider";
import type { AppRole } from "@/lib/atap/policy";

export const Route = createFileRoute("/fpo-portal/admin")({
  head: () => ({ meta: [{ title: "Staff & roles — FPO Portal" }] }),
  component: AdminPage,
});

function AdminPage() {
  const { t } = useLanguage();
  const { fpoTenant, isAdmin } = Route.useRouteContext();
  const qc = useQueryClient();
  const fetchWorkspace = useServerFn(getFpoWorkspace);
  const invite = useServerFn(inviteStaff);
  const revoke = useServerFn(revokeInvite);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AppRole | "">("");
  const [note, setNote] = useState("");
  const [lastRef, setLastRef] = useState("");

  const ws = useQuery({ queryKey: ["atap", "fpo-workspace"], queryFn: () => fetchWorkspace() });
  const tenant = ws.data?.tenants.find((t) => t.id === fpoTenant.id);
  const invites = (ws.data?.invites ?? []).filter((i) => i.tenant_id === fpoTenant.id);
  const roles = tenant?.invitableRoles ?? [];

  const inviteM = useMutation({
    mutationFn: () =>
      invite({
        data: { tenantId: fpoTenant.id, email, role: (role || roles[0] || "viewer") as AppRole, note },
      }),
    onSuccess: async (res) => {
      toast.success(t("fpo.admin.inviteCreated"));
      setLastRef(res.id);
      setEmail("");
      setNote("");
      await qc.invalidateQueries({ queryKey: ["atap", "fpo-workspace"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!isAdmin) {
    return (
      <section className="panel p-5">
        <h1 className="font-display text-lg font-semibold">{t("fpo.admin.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("fpo.admin.onlyAdmin")}</p>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="font-display text-xl font-semibold">{t("fpo.admin.title")}</h1>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="panel space-y-3 p-5">
          <h2 className="font-display text-base font-semibold">{t("fpo.admin.inviteTitle")}</h2>
          <input className="field-base" type="email" placeholder="staff@example.org" value={email} onChange={(e) => setEmail(e.target.value)} />
          <select className="field-base" value={role || roles[0] || ""} onChange={(e) => setRole(e.target.value as AppRole)}>
            {roles.map((r) => (
              <option key={r} value={r}>{r.replaceAll("_", " ")}</option>
            ))}
          </select>
          <input className="field-base" placeholder={t("fpo.admin.notePlaceholder")} value={note} onChange={(e) => setNote(e.target.value)} />
          <Button onClick={() => inviteM.mutate()} disabled={!email.includes("@") || inviteM.isPending}>
            {t("fpo.admin.createInvite")}</Button>
          {lastRef ? (
            <p className="field-hint break-all">
              {t("fpo.admin.shareRef")}{" "}<code>{lastRef}</code>. {t("fpo.admin.shareRefTail")}</p>
          ) : null}
          <p className="field-hint">{t("fpo.admin.neverPlatform")}</p>
        </div>

        <div className="panel space-y-3 p-5">
          <h2 className="font-display text-base font-semibold">{t("fpo.admin.invitations")}</h2>
          {invites.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("fpo.admin.noInvites")}</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr><th>{t("fpo.admin.colEmail")}</th><th>{t("fpo.admin.colRole")}</th><th>{t("fpo.admin.colStatus")}</th><th /></tr>
              </thead>
              <tbody>
                {invites.map((i) => (
                  <tr key={i.id}>
                    <td>{i.invited_email}</td>
                    <td>{i.invited_role.replaceAll("_", " ")}</td>
                    <td><StateBadge state={i.status} /></td>
                    <td className="text-right">
                      {i.status === "pending" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            await revoke({ data: { inviteId: i.id } });
                            toast.success(t("fpo.admin.inviteRevoked"));
                            await qc.invalidateQueries({ queryKey: ["atap", "fpo-workspace"] });
                          }}
                        >
                          {t("fpo.admin.revoke")}</Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <FpoStaffAccounts tenantId={fpoTenant.id} roles={roles} />

      <FpoTeamSection tenantId={fpoTenant.id} />
    </div>
  );
}
