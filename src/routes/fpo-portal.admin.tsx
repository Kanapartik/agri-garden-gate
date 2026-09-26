import { useLanguage } from "@/components/atap/LanguageProvider";
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
      toast.success(t("fpo.ui.0002eafb56"));
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
        <h1 className="font-display text-lg font-semibold">{t("fpo.ui.db0e5887ab")}</h1>
        <p className="text-sm text-muted-foreground">{t("fpo.ui.7e428ef688")}</p>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="font-display text-xl font-semibold">{t("fpo.ui.db0e5887ab")}</h1>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="panel space-y-3 p-5">
          <h2 className="font-display text-base font-semibold">{t("fpo.ui.a7bbc7a7fd")}</h2>
          <input className="field-base" type="email" placeholder={t("fpo.ui.bf4ac958f7")} value={email} onChange={(e) => setEmail(e.target.value)} />
          <select className="field-base" value={role || roles[0] || ""} onChange={(e) => setRole(e.target.value as AppRole)}>
            {roles.map((r) => (
              <option key={r} value={r}>{r.replaceAll("_", " ")}</option>
            ))}
          </select>
          <input className="field-base" placeholder={t("fpo.ui.4e39567064")} value={note} onChange={(e) => setNote(e.target.value)} />
          <Button onClick={() => inviteM.mutate()} disabled={!email.includes("@") || inviteM.isPending}>
            {t("fpo.ui.7635958a91")}</Button>
          {lastRef ? (
            <p className="field-hint break-all">
              {t("fpo.ui.c91ec033b1")}{" "}<code>{lastRef}</code>{t("fpo.ui.9bb4701deb")}</p>
          ) : null}
          <p className="field-hint">{t("fpo.ui.17d4bcc1ca")}</p>
        </div>

        <div className="panel space-y-3 p-5">
          <h2 className="font-display text-base font-semibold">{t("fpo.ui.9b69a35ab5")}</h2>
          {invites.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("fpo.ui.485c403a62")}</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr><th>{t("fpo.ui.84add5b295")}</th><th>{t("fpo.ui.c3f104d136")}</th><th>{t("fpo.ui.bae7d5be70")}</th><th /></tr>
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
                            toast.success(t("fpo.ui.cf04dc7cfa"));
                            await qc.invalidateQueries({ queryKey: ["atap", "fpo-workspace"] });
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
        </div>
      </section>

      <FpoStaffAccounts tenantId={fpoTenant.id} roles={roles} />

      <FpoTeamSection tenantId={fpoTenant.id} />
    </div>
  );
}
