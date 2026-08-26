import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { StateBadge } from "@/components/atap/StatusBadge";
import {
  clearRolePermission,
  getTeamBoard,
  recordAccessReview,
  setRolePermission,
  setStaffStatus,
  upsertStaffMember,
} from "@/lib/atap/fpoTeam.functions";
import {
  nextStaffStatuses,
  PERMISSION_LEVEL_LABEL,
  PERMISSION_LEVELS,
  REVIEW_DECISION_LABEL,
  REVIEW_DECISIONS,
  STAFF_STATUS_LABEL,
  type PermissionLevel,
  type ReviewDecision,
  type StaffStatus,
} from "@/lib/atap/fpoTeam";
import { FPO_SECTION_DEFS } from "@/lib/atap/fpo";
import type { AppRole } from "@/lib/atap/policy";

const input =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground";
const card = "rounded-lg border border-border bg-card p-4";

const roleLabel = (role: string) => role.replaceAll("_", " ");

type Tab = "directory" | "permissions" | "reviews" | "my_access";

export function FpoTeamSection({ tenantId }: { tenantId: string }) {
  const qc = useQueryClient();
  const boardFn = useServerFn(getTeamBoard);
  const upsertFn = useServerFn(upsertStaffMember);
  const statusFn = useServerFn(setStaffStatus);
  const permissionFn = useServerFn(setRolePermission);
  const clearFn = useServerFn(clearRolePermission);
  const reviewFn = useServerFn(recordAccessReview);

  const [tab, setTab] = useState<Tab>("directory");
  const [name, setName] = useState("");
  const [designation, setDesignation] = useState("");
  const [contact, setContact] = useState("");
  const [staffRole, setStaffRole] = useState<AppRole>("field_agent");
  const [districts, setDistricts] = useState("");
  const [mandals, setMandals] = useState("");
  const [notes, setNotes] = useState("");
  const [openStaff, setOpenStaff] = useState<string | null>(null);
  const [decision, setDecision] = useState<ReviewDecision>("retained");
  const [reviewRole, setReviewRole] = useState<AppRole>("field_agent");
  const [reviewNotes, setReviewNotes] = useState("");

  const board = useQuery({
    queryKey: ["atap", "fpo-team", tenantId],
    queryFn: () => boardFn({ data: { tenantId } }),
    enabled: Boolean(tenantId),
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["atap", "fpo-team", tenantId] });

  const useAction = <T,>(fn: (args: { data: T }) => Promise<unknown>, message: string) =>
    useMutation({
      mutationFn: (payload: T) => fn({ data: payload }),
      onSuccess: async () => {
        toast.success(message);
        await refresh();
      },
      onError: (e: Error) => toast.error(e.message),
    });

  const upsert = useAction(upsertFn, "Staff record saved and audited");
  const status = useAction(statusFn, "Access updated and audited");
  const permission = useAction(permissionFn, "Permission configured and audited");
  const clear = useAction(clearFn, "Reset to the platform default");
  const review = useAction(reviewFn, "Access review recorded");

  if (board.isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  const data = board.data;
  if (!data) return <p className="text-sm text-muted-foreground">No team records yet.</p>;

  const csv = (value: string) =>
    value
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);

  return (
    <div className="space-y-6">
      <p className="rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
        {data.disclaimer}
      </p>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Active staff", value: data.summary.active },
          { label: "Invited", value: data.summary.invited },
          { label: "Suspended", value: data.summary.suspended },
          { label: "Access review due", value: data.summary.reviewDue },
        ].map((m) => (
          <div key={m.label} className={card}>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{m.label}</p>
            <p className="mt-1 text-2xl font-bold">{m.value}</p>
          </div>
        ))}
      </section>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["directory", "Staff directory"],
            ["permissions", "Permissions"],
            ["reviews", "Access reviews"],
            ["my_access", "My access"],
          ] as Array<[Tab, string]>
        ).map(([key, label]) => (
          <Button
            key={key}
            size="sm"
            variant={tab === key ? "default" : "outline"}
            onClick={() => setTab(key)}
          >
            {label}
          </Button>
        ))}
      </div>

      {tab === "directory" ? (
        <div className="space-y-6">
          {data.canManage ? (
            <section className={`${card} space-y-3`}>
              <h3 className="font-display text-base font-semibold">Add or update a staff seat</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  className={input}
                  placeholder="Full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <input
                  className={input}
                  placeholder="Designation (e.g. CEO, field agent)"
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                />
                <input
                  className={input}
                  placeholder="Contact hint (masked)"
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                />
                <select
                  className={input}
                  value={staffRole}
                  onChange={(e) => setStaffRole(e.target.value as AppRole)}
                >
                  {data.staffRoles.map((r) => (
                    <option key={r} value={r}>
                      {roleLabel(r)}
                    </option>
                  ))}
                </select>
                <input
                  className={input}
                  placeholder="District scope (comma separated)"
                  value={districts}
                  onChange={(e) => setDistricts(e.target.value)}
                />
                <input
                  className={input}
                  placeholder="Mandal scope (comma separated)"
                  value={mandals}
                  onChange={(e) => setMandals(e.target.value)}
                />
              </div>
              <textarea
                className={`${input} min-h-16`}
                placeholder="Notes (optional)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
              <Button
                disabled={!name.trim() || upsert.isPending}
                onClick={() =>
                  upsert.mutate(
                    {
                      tenantId,
                      displayName: name,
                      designation,
                      contactHint: contact,
                      staffRole,
                      districtScope: csv(districts),
                      mandalScope: csv(mandals),
                      notes,
                    },
                    {
                      onSuccess: () => {
                        setName("");
                        setDesignation("");
                        setContact("");
                        setDistricts("");
                        setMandals("");
                        setNotes("");
                      },
                    },
                  )
                }
              >
                Save staff seat
              </Button>
              <p className="text-xs text-muted-foreground">
                A staff seat records delegation inside this organization. Sign-in access is granted
                separately through the invitation flow below.
              </p>
            </section>
          ) : (
            <p className="text-sm text-muted-foreground">
              Only an organization admin can change staff access. You have read-only access to the
              directory.
            </p>
          )}

          <section className="space-y-3">
            {data.staff.length === 0 ? (
              <p className="text-sm text-muted-foreground">No staff recorded yet.</p>
            ) : (
              data.staff.map((s) => (
                <div key={s.id} className={`${card} space-y-2`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold">{s.display_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {roleLabel(s.staff_role)}
                        {s.designation ? ` · ${s.designation}` : ""}
                        {s.contact_hint ? ` · ${s.contact_hint}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {s.review_due ? (
                        <span className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground">
                          Review due
                        </span>
                      ) : null}
                      <StateBadge state={s.status} />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Scope:{" "}
                    {(s.district_scope ?? []).length === 0
                      ? "no district scope recorded"
                      : s.district_scope.join(", ")}
                    {(s.mandal_scope ?? []).length > 0 ? ` · ${s.mandal_scope.join(", ")}` : ""}
                  </p>
                  {s.suspended_reason ? (
                    <p className="text-xs text-muted-foreground">
                      Suspension reason: {s.suspended_reason}
                    </p>
                  ) : null}
                  {data.canManage ? (
                    <div className="flex flex-wrap gap-2">
                      {nextStaffStatuses(s.status).map((next) => (
                        <Button
                          key={next}
                          size="sm"
                          variant="outline"
                          disabled={status.isPending}
                          onClick={() =>
                            status.mutate({
                              tenantId,
                              staffId: s.id,
                              status: next as StaffStatus,
                              reason: next === "suspended" ? "Reviewed by organization admin" : "",
                            })
                          }
                        >
                          {STAFF_STATUS_LABEL[next]}
                        </Button>
                      ))}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setOpenStaff(openStaff === s.id ? null : s.id)}
                      >
                        Record access review
                      </Button>
                    </div>
                  ) : null}

                  {openStaff === s.id && data.canManage ? (
                    <div className="space-y-2 border-t border-border pt-2">
                      <select
                        className={input}
                        value={decision}
                        onChange={(e) => setDecision(e.target.value as ReviewDecision)}
                      >
                        {REVIEW_DECISIONS.map((d) => (
                          <option key={d} value={d}>
                            {REVIEW_DECISION_LABEL[d]}
                          </option>
                        ))}
                      </select>
                      {decision === "role_changed" ? (
                        <select
                          className={input}
                          value={reviewRole}
                          onChange={(e) => setReviewRole(e.target.value as AppRole)}
                        >
                          {data.staffRoles.map((r) => (
                            <option key={r} value={r}>
                              {roleLabel(r)}
                            </option>
                          ))}
                        </select>
                      ) : null}
                      <textarea
                        className={`${input} min-h-16`}
                        placeholder="Review notes"
                        value={reviewNotes}
                        onChange={(e) => setReviewNotes(e.target.value)}
                      />
                      <Button
                        size="sm"
                        disabled={review.isPending}
                        onClick={() =>
                          review.mutate(
                            {
                              tenantId,
                              staffId: s.id,
                              decision,
                              newRole: reviewRole,
                              notes: reviewNotes,
                            },
                            {
                              onSuccess: () => {
                                setReviewNotes("");
                                setOpenStaff(null);
                              },
                            },
                          )
                        }
                      >
                        Save review
                      </Button>
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </section>
        </div>
      ) : null}

      {tab === "permissions" ? (
        <section className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Configuration can only narrow a role. A level above what a role may ever hold is
            refused, and existing over-generous rows are shown clamped to the effective level that
            the server enforces.
          </p>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Section</th>
                  {data.staffRoles.map((r) => (
                    <th key={r}>{roleLabel(r)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {FPO_SECTION_DEFS.map((def) => (
                  <tr key={def.key}>
                    <td>{def.label}</td>
                    {data.staffRoles.map((r) => {
                      const cell = data.matrix.find(
                        (c) => c.role === r && c.section === def.key,
                      );
                      if (!cell) return <td key={r} />;
                      return (
                        <td key={r}>
                          <select
                            className={input}
                            disabled={!data.canManage || permission.isPending}
                            value={cell.effective}
                            onChange={(e) =>
                              permission.mutate({
                                tenantId,
                                staffRole: r,
                                section: def.key,
                                level: e.target.value as PermissionLevel,
                              })
                            }
                          >
                            {PERMISSION_LEVELS.filter(
                              (lvl) =>
                                lvl === "none" ||
                                PERMISSION_LEVELS.indexOf(lvl) <=
                                  PERMISSION_LEVELS.indexOf(cell.ceiling),
                            ).map((lvl) => (
                              <option key={lvl} value={lvl}>
                                {PERMISSION_LEVEL_LABEL[lvl]}
                              </option>
                            ))}
                          </select>
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            {cell.overridden ? "Organization override" : "Platform default"}
                            {cell.clamped ? " · clamped" : ""}
                          </p>
                          {cell.overridden && data.canManage ? (
                            <button
                              type="button"
                              className="text-[11px] underline"
                              onClick={() =>
                                clear.mutate({ tenantId, staffRole: r, section: def.key })
                              }
                            >
                              Reset to default
                            </button>
                          ) : null}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {tab === "reviews" ? (
        <section className="space-y-3">
          {data.reviews.length === 0 ? (
            <p className="text-sm text-muted-foreground">No access reviews recorded yet.</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Staff</th>
                  <th>Decision</th>
                  <th>Role</th>
                  <th>Reviewed</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {data.reviews.map((r) => (
                  <tr key={r.id}>
                    <td>
                      {data.staff.find((s) => s.id === r.staff_member_id)?.display_name ??
                        "Removed staff"}
                    </td>
                    <td>{REVIEW_DECISION_LABEL[r.decision]}</td>
                    <td>
                      {r.previous_role ? roleLabel(r.previous_role) : "—"}
                      {r.new_role && r.new_role !== r.previous_role
                        ? ` → ${roleLabel(r.new_role)}`
                        : ""}
                    </td>
                    <td>{new Date(r.reviewed_at).toLocaleDateString()}</td>
                    <td>{r.notes ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      ) : null}

      {tab === "my_access" ? (
        <section className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Your effective access in this organization, as the server enforces it. Roles held:{" "}
            {data.roles.map(roleLabel).join(", ") || "none"}.
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {data.mySections.map((s) => (
              <div key={s.section} className={card}>
                <p className="text-sm font-medium">
                  {FPO_SECTION_DEFS.find((d) => d.key === s.section)?.label ?? s.section}
                </p>
                <p className="text-xs text-muted-foreground">
                  {PERMISSION_LEVEL_LABEL[s.level]}
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
