import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { listStaffAccounts, setStaffRole } from "@/lib/atap/fpoPortalAdmin.functions";
import { useLanguage } from "@/components/atap/LanguageProvider";
import type { AppRole } from "@/lib/atap/policy";

export function FpoStaffAccounts({ tenantId, roles }: { tenantId: string; roles: string[] }) {
  const { t } = useLanguage();
  const qc = useQueryClient();
  const listFn = useServerFn(listStaffAccounts);
  const setFn = useServerFn(setStaffRole);
  const key = ["atap", "fpo-staff-accounts", tenantId];
  const q = useQuery({ queryKey: key, queryFn: () => listFn({ data: { tenantId } }) });
  const m = useMutation({
    mutationFn: (v: { targetUserId: string; role: AppRole | "none" }) => setFn({ data: { tenantId, ...v } }),
    onSuccess: async () => {
      toast.success(t("fpo.staff.roleUpdated"));
      await qc.invalidateQueries({ queryKey: key });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section className="panel space-y-3 p-5">
      <h2 className="font-display text-base font-semibold">{t("fpo.staff.title")}</h2>
      <p className="field-hint">{t("fpo.staff.hint")}</p>
      {q.isLoading ? (
        <p className="text-sm text-muted-foreground">{t("fpo.staff.loading")}</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr><th>{t("fpo.staff.colName")}</th><th>{t("fpo.staff.colEmail")}</th><th>{t("fpo.staff.colRole")}</th></tr>
          </thead>
          <tbody>
            {(q.data ?? []).map((s) => (
              <tr key={s.userId}>
                <td>{s.name ?? "—"}{s.isSelf ? ` ${t("fpo.staff.you")}` : ""}</td>
                <td>{s.email ?? "—"}</td>
                <td>
                  {s.isSelf ? (
                    s.roles.map((r) => r.replaceAll("_", " ")).join(", ")
                  ) : (
                    <select
                      className="field-base"
                      value={s.roles.find((r) => roles.includes(r)) ?? "none"}
                      disabled={m.isPending}
                      onChange={(e) => m.mutate({ targetUserId: s.userId, role: e.target.value as AppRole | "none" })}
                    >
                      {roles.map((r) => (
                        <option key={r} value={r}>{r.replaceAll("_", " ")}</option>
                      ))}
                      <option value="none">{t("fpo.staff.removeAccess")}</option>
                    </select>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
