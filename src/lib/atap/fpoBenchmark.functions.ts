/**
 * FPO performance comparison. Caller must hold a role in the tenant (or be
 * platform admin / auditor). Other FPOs' names are hidden from FPO staff.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { BENCHMARK_MEASURES, type MeasureKey } from "@/lib/atap/fpoBenchmark";

export interface BenchmarkRow extends Record<MeasureKey, number> {
  label: string;
  district: string;
  state: string;
  period: string;
  members: number;
  isOwn: boolean;
}

export const getFpoBenchmark = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { resolveDistrictActor } = await import("@/lib/atap/district.server");
    const actor = await resolveDistrictActor(supabase, userId);
    const oversight = actor.isPlatformAdmin || actor.isAuditor;
    if (!oversight && !actor.tenantIds.includes(data.tenantId)) {
      throw new Error("You do not have access to this organization");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const cols = `tenant_id, fpo_name, district, state, period, members, ${BENCHMARK_MEASURES.map((m) => m.key).join(", ")}`;
    const { data: rows, error } = await supabaseAdmin
      .from("fpo_performance_scores")
      .select(cols)
      .order("fpo_name");
    if (error) throw new Error(error.message);

    const peerLabels = new Map<string, string>();
    const out: BenchmarkRow[] = ((rows ?? []) as unknown as Array<Record<string, unknown>>).map((r) => {
      const isOwn = r["tenant_id"] === data.tenantId;
      const name = r["fpo_name"] as string;
      let label = name;
      if (!isOwn && !oversight) {
        if (!peerLabels.has(name)) peerLabels.set(name, `Peer FPO ${String.fromCharCode(65 + peerLabels.size)}`);
        label = peerLabels.get(name)!;
      }
      const row = {
        label,
        district: r["district"] as string,
        state: r["state"] as string,
        period: r["period"] as string,
        members: Number(r["members"]),
        isOwn,
      } as BenchmarkRow;
      for (const m of BENCHMARK_MEASURES) row[m.key] = Number(r[m.key]);
      return row;
    });

    await supabase.from("audit_events").insert({
      actor_user_id: userId,
      tenant_id: data.tenantId,
      action: "fpo.benchmark.read",
      subject_type: "fpo_performance_scores",
      decision: "allow",
      metadata: { rows: out.length, names_revealed: oversight },
    });

    const periods = [...new Set(out.map((r) => r.period))].sort();
    return { rows: out, periods, namesRevealed: oversight };
  });
