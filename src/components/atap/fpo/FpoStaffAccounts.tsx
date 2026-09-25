import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { listStaffAccounts, setStaffRole } from "@/lib/atap/fpoPortalAdmin.functions";
import type { AppRole } from "@/lib/atap/policy";

export function FpoStaffAccounts({ tenantId, roles }: { tenantId: string; roles: string[] }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listStaffAccounts);
  const setFn = useServerFn(setStaffRole);
  const key = ["atap", "fpo-staff-accounts", tenantId];
  const q = useQuery({ queryKey: key, queryFn: () => listFn({ data: { tenantId } }) });
  const m = useMutation({
    mutationFn: (v: { targetUserId: string; role: AppRole | "none" }) => setFn({ data: { tenantId, ...v } }),
    onSuccess: async () => {
      toast.success("Role updated");
      await qc.invalidateQueries({ queryKey: key });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section className="panel space-y-3 p-5">
      <h2 className="font-display text-base font-semibold">Staff logins and roles</h2>
      <p className="field-hint">People who can sign in to this FPO Portal. Changing a role takes effect on their next page load.</p>
      {q.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr><th>Name</th><th>Email</th><th>Role</th></tr>
          </thead>
          <tbody>
            {(q.data ?? []).map((s) => (
              <tr key={s.userId}>
                <td>{s.name ?? "—"}{s.isSelf ? " (you)" : ""}</td>
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
                      <option value="none">Remove access</option>
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
