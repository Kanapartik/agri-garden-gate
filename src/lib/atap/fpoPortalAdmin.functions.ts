/**
 * FPO Portal admin: list signed-in staff accounts of one FPO and change their
 * tenant-scoped role. Only that FPO's tenant_admin may call. Platform admin /
 * auditor roles can never be granted here; admins cannot change their own role.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { AppRole } from "@/lib/atap/policy";

export interface StaffAccount {
  userId: string;
  name: string | null;
  email: string | null;
  roles: AppRole[];
  isSelf: boolean;
}

async function requireAdmin(supabase: Parameters<typeof import("@/lib/atap/district.server").resolveDistrictActor>[0], userId: string, tenantId: string) {
  const { resolveDistrictActor, tenantTypeOf } = await import("@/lib/atap/district.server");
  const actor = await resolveDistrictActor(supabase, userId);
  const isAdmin = actor.tenantRoles.some((r) => r.tenant_id === tenantId && r.role === "tenant_admin");
  if (!isAdmin) throw new Error("Only this FPO's administrator can manage staff");
  const tenant = await tenantTypeOf(supabase, tenantId);
  if (!tenant || tenant.tenant_type !== "fpo") throw new Error("Not an FPO");
  return tenant;
}

export const listStaffAccounts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string }) => input)
  .handler(async ({ data, context }): Promise<StaffAccount[]> => {
    await requireAdmin(context.supabase, context.userId, data.tenantId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role")
      .eq("tenant_id", data.tenantId);
    const byUser = new Map<string, AppRole[]>();
    for (const r of rows ?? []) byUser.set(r.user_id, [...(byUser.get(r.user_id) ?? []), r.role as AppRole]);
    const ids = [...byUser.keys()];
    const { data: profiles } = ids.length
      ? await supabaseAdmin.from("profiles").select("id, full_name").in("id", ids)
      : { data: [] };
    const names = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
    const out: StaffAccount[] = [];
    for (const id of ids) {
      const { data: u } = await supabaseAdmin.auth.admin.getUserById(id);
      out.push({
        userId: id,
        name: names.get(id) ?? null,
        email: u.user?.email ?? null,
        roles: byUser.get(id) ?? [],
        isSelf: id === context.userId,
      });
    }
    return out.sort((a, b) => (a.email ?? "").localeCompare(b.email ?? ""));
  });

export const setStaffRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string; targetUserId: string; role: AppRole | "none" }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireAdmin(supabase, userId, data.tenantId);
    if (data.targetUserId === userId) throw new Error("You cannot change your own role");
    const { invitableRoles } = await import("@/lib/atap/district");
    const allowed = [...invitableRoles("fpo")] as string[];
    if (data.role !== "none" && !allowed.includes(data.role)) throw new Error("That role cannot be given from an FPO");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: before } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("tenant_id", data.tenantId)
      .eq("user_id", data.targetUserId);
    if (!before || before.length === 0) throw new Error("This person is not staff of this FPO");

    await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("tenant_id", data.tenantId)
      .eq("user_id", data.targetUserId)
      .in("role", allowed as never);
    if (data.role !== "none") {
      await supabaseAdmin.from("user_roles").insert({
        user_id: data.targetUserId,
        tenant_id: data.tenantId,
        role: data.role,
        granted_by: userId,
      } as never);
    } else {
      await supabaseAdmin
        .from("tenant_members")
        .update({ status: "suspended" } as never)
        .eq("tenant_id", data.tenantId)
        .eq("user_id", data.targetUserId);
    }

    const { audit } = await import("@/lib/atap/admin.server");
    await audit(supabase, {
      actor_user_id: userId,
      tenant_id: data.tenantId,
      action: data.role === "none" ? "role.revoke.fpo_portal" : "role.change.fpo_portal",
      subject_type: "user",
      subject_id: data.targetUserId,
      decision: "allow",
      metadata: { from: before.map((b) => b.role), to: data.role },
    });
    return { ok: true };
  });
