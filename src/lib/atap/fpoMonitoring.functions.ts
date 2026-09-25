/**
 * FPO field monitoring server functions. Every call re-checks tenant role and
 * the farmer's active consent; RLS enforces the same rule underneath. AI output
 * is advisory and never changes any status.
 */
import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  AI_DISCLAIMER,
  MONITORING_CATEGORIES,
  MONITORING_PURPOSE,
  MONITORING_SEVERITIES,
  SYSTEM_PROMPT,
  buildPromptPayload,
  canReadMonitoring,
  canWriteMonitoring,
  parseAiSummary,
  type AiSummary,
} from "@/lib/atap/fpoMonitoring";
import type { AppRole } from "@/lib/atap/policy";

const MODEL = "openai/gpt-6-astra";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any>;

async function scope(supabase: Db, userId: string, tenantId: string) {
  const { resolveDistrictActor } = await import("@/lib/atap/district.server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const actor = await resolveDistrictActor(supabase as any, userId);
  const roles = actor.tenantRoles.filter((r) => r.tenant_id === tenantId).map((r) => r.role) as string[];
  if (actor.isPlatformAdmin) roles.push("platform_admin");
  if (actor.isAuditor) roles.push("auditor");
  if (!canReadMonitoring(roles)) throw new Error("You do not have monitoring access in this FPO");
  return { roles: roles as AppRole[], canWrite: canWriteMonitoring(roles) };
}

async function consentedMember(supabase: Db, tenantId: string, memberId: string) {
  const { data: m } = await supabase
    .from("fpo_members")
    .select("id, member_ref, display_name, farmer_user_id")
    .eq("id", memberId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!m) throw new Error("Member not found in this FPO");
  if (!m.farmer_user_id) return { member: m, consented: false };
  const now = new Date().toISOString();
  const { data: c } = await supabase
    .from("fpo_farmer_consents")
    .select("id, expires_at")
    .eq("tenant_id", tenantId)
    .eq("farmer_user_id", m.farmer_user_id)
    .eq("purpose_code", MONITORING_PURPOSE)
    .is("revoked_at", null);
  const consented = (c ?? []).some((r) => !r.expires_at || r.expires_at > now);
  return { member: m, consented };
}

async function logAudit(
  supabase: Db,
  userId: string,
  tenantId: string,
  action: string,
  subjectId: string,
  metadata: Record<string, unknown>,
) {
  await supabase.from("audit_events").insert({
    actor_user_id: userId,
    tenant_id: tenantId,
    action,
    subject_type: "fpo_member",
    subject_id: subjectId,
    decision: "allow",
    metadata,
  });
}

export interface MonitoringNote {
  id: string;
  observed_on: string;
  crop: string | null;
  category: string;
  severity: string;
  body: string;
  created_at: string;
}

export const listMonitoring = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { tenantId: string; memberId?: string }) => i)
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as Db;
    const s = await scope(supabase, context.userId, data.tenantId);
    const { data: members } = await supabase
      .from("fpo_members")
      .select("id, member_ref, display_name")
      .eq("tenant_id", data.tenantId)
      .order("display_name");
    if (!data.memberId) {
      return { canWrite: s.canWrite, members: members ?? [], consented: false, notes: [], summaries: [] };
    }
    const { consented } = await consentedMember(supabase, data.tenantId, data.memberId);
    if (!consented) {
      return { canWrite: s.canWrite, members: members ?? [], consented, notes: [], summaries: [] };
    }
    const [{ data: notes }, { data: summaries }] = await Promise.all([
      supabase
        .from("fpo_monitoring_notes")
        .select("id, observed_on, crop, category, severity, body, created_at")
        .eq("member_id", data.memberId)
        .order("observed_on", { ascending: false })
        .limit(100),
      supabase
        .from("fpo_monitoring_summaries")
        .select("id, summary, questions, model, reviewed_at")
        .eq("member_id", data.memberId)
        .order("reviewed_at", { ascending: false })
        .limit(10),
    ]);
    await logAudit(supabase, context.userId, data.tenantId, "fpo.monitoring.read", data.memberId, {
      notes: (notes ?? []).length,
    });
    return {
      canWrite: s.canWrite,
      members: members ?? [],
      consented,
      notes: (notes ?? []) as MonitoringNote[],
      summaries: (summaries ?? []) as Array<{
        id: string;
        summary: string;
        questions: string[];
        model: string;
        reviewed_at: string;
      }>,
    };
  });

export const createNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (i: {
      tenantId: string;
      memberId: string;
      observedOn: string;
      crop: string;
      category: string;
      severity: string;
      body: string;
    }) => {
      if (!(MONITORING_CATEGORIES as readonly string[]).includes(i.category)) throw new Error("Invalid category");
      if (!(MONITORING_SEVERITIES as readonly string[]).includes(i.severity)) throw new Error("Invalid severity");
      const body = i.body.trim();
      if (body.length < 5 || body.length > 2000) throw new Error("Observation must be 5–2000 characters");
      return { ...i, body, crop: i.crop.trim().slice(0, 60) };
    },
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as Db;
    const s = await scope(supabase, context.userId, data.tenantId);
    if (!s.canWrite) throw new Error("Your role can read but not add monitoring notes");
    const { consented } = await consentedMember(supabase, data.tenantId, data.memberId);
    if (!consented) throw new Error("The farmer has not consented to FPO farm monitoring");
    const { data: row, error } = await supabase
      .from("fpo_monitoring_notes")
      .insert({
        tenant_id: data.tenantId,
        member_id: data.memberId,
        author_id: context.userId,
        observed_on: data.observedOn,
        crop: data.crop || null,
        category: data.category,
        severity: data.severity,
        body: data.body,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await logAudit(supabase, context.userId, data.tenantId, "fpo.monitoring.note.create", data.memberId, {
      note_id: row.id,
      category: data.category,
      severity: data.severity,
    });
    return { id: row.id as string };
  });

async function callGateway(prompt: string): Promise<string> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("AI is not configured for this app");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: MODEL,
      stream: true,
      store: false,
      reasoning: { effort: "low", summary: "auto" },
      include: ["reasoning.encrypted_content"],
      input: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!res.ok || !res.body) {
    let msg = "";
    try {
      const j = (await res.json()) as { message?: string; error?: { message?: string } };
      msg = j.message ?? j.error?.message ?? "";
    } catch {
      /* ignore */
    }
    if (res.status === 429) throw new Error("AI is busy right now — please try again in a minute.");
    if (res.status === 402) throw new Error(msg || "AI credits are exhausted for this workspace.");
    throw new Error(msg || `AI request failed (${res.status})`);
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const ev = JSON.parse(payload) as { type?: string; delta?: string; error?: { message?: string } };
        if (ev.type === "response.output_text.delta" && ev.delta) text += ev.delta;
        if (ev.type === "error" || ev.type === "response.failed")
          throw new Error(ev.error?.message ?? "AI response failed");
      } catch (e) {
        if (e instanceof Error && e.message.startsWith("AI")) throw e;
      }
    }
  }
  if (!text.trim()) throw new Error("The AI returned no summary for these notes.");
  return text;
}

export const summarizeMonitoring = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { tenantId: string; memberId: string }) => i)
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as Db;
    await scope(supabase, context.userId, data.tenantId);
    const { member, consented } = await consentedMember(supabase, data.tenantId, data.memberId);
    if (!consented) throw new Error("The farmer has not consented to FPO farm monitoring");
    const since = new Date(Date.now() - 90 * 86400_000).toISOString().slice(0, 10);
    const { data: notes } = await supabase
      .from("fpo_monitoring_notes")
      .select("id, observed_on, crop, category, severity, body")
      .eq("member_id", data.memberId)
      .gte("observed_on", since)
      .order("observed_on", { ascending: true });
    const list = notes ?? [];
    if (list.length === 0) throw new Error("No notes in the last 90 days to summarize");
    const raw = await callGateway(buildPromptPayload(member.member_ref, list));
    const result: AiSummary = parseAiSummary(raw);
    await logAudit(supabase, context.userId, data.tenantId, "fpo.monitoring.ai_summary", data.memberId, {
      note_count: list.length,
      model: MODEL,
    });
    return { ...result, model: MODEL, noteIds: list.map((n) => n.id as string), disclaimer: AI_DISCLAIMER };
  });

export const saveSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (i: { tenantId: string; memberId: string; summary: string; questions: string[]; model: string; noteIds: string[] }) => ({
      ...i,
      summary: i.summary.slice(0, 2000),
      questions: i.questions.slice(0, 5).map((q) => q.slice(0, 300)),
    }),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as Db;
    const s = await scope(supabase, context.userId, data.tenantId);
    if (!s.canWrite) throw new Error("Your role cannot save summaries");
    const { consented } = await consentedMember(supabase, data.tenantId, data.memberId);
    if (!consented) throw new Error("The farmer has not consented to FPO farm monitoring");
    const { data: row, error } = await supabase
      .from("fpo_monitoring_summaries")
      .insert({
        tenant_id: data.tenantId,
        member_id: data.memberId,
        summary: data.summary,
        questions: data.questions,
        model: data.model,
        note_ids: data.noteIds,
        reviewed_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await logAudit(supabase, context.userId, data.tenantId, "fpo.monitoring.summary.save", data.memberId, {
      summary_id: row.id,
    });
    return { id: row.id as string };
  });
