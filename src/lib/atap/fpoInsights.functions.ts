/**
 * FPO Management & Operations workspace — Phase 10 server functions
 * (insights board, audited activity timeline, universal workspace search).
 *
 * Read-only. Every query is tenant-scoped and default-deny: the caller must be
 * a member of the organization (or platform admin / auditor). No new authority
 * is created, no farmer identifiers are returned, and the audited timeline is
 * limited to organization admins and auditors.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  buildAttention,
  buildMetrics,
  buildTimeline,
  canViewInsights,
  canViewSearch,
  canViewTimeline,
  INSIGHTS_DISCLAIMER,
  SEARCH_DISCLAIMER,
  searchDocs,
  TIMELINE_DISCLAIMER,
  type AttentionItem,
  type MetricCard,
  type SearchDoc,
  type SearchHit,
  type TimelineEntry,
} from "@/lib/atap/fpoInsights";
import { taskOverdue } from "@/lib/atap/fpoNotifications";
import type { AppRole } from "@/lib/atap/policy";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type AuthedClient = SupabaseClient<Database>;

const MEMBER_CONSENT_PURPOSE = "fpo_member_management";

export interface InsightsBoard {
  tenantId: string;
  roles: AppRole[];
  canSeeTimeline: boolean;
  metrics: MetricCard[];
  attention: AttentionItem[];
  timeline: TimelineEntry[];
  generatedAt: string;
  disclaimers: { insights: string; timeline: string; search: string };
}

async function tenantScope(supabase: AuthedClient, userId: string, tenantId: string) {
  const { resolveDistrictActor } = await import("@/lib/atap/district.server");
  const actor = await resolveDistrictActor(supabase, userId);
  const permitted = actor.isPlatformAdmin || actor.isAuditor || actor.tenantIds.includes(tenantId);
  if (!permitted) throw new Error("You do not have access to this organization");
  const roles = actor.tenantRoles
    .filter((r: { tenant_id: string | null }) => r.tenant_id === tenantId)
    .map((r: { role: AppRole }) => r.role) as AppRole[];
  const effective: AppRole[] = actor.isPlatformAdmin ? [...roles, "platform_admin"] : [...roles];
  if (actor.isAuditor && !effective.includes("auditor")) effective.push("auditor");
  return { roles: effective };
}

function rows<T>(result: { data: T[] | null }): T[] {
  return result.data ?? [];
}

export const getInsightsBoard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { tenantId: string }) => data)
  .handler(async ({ data, context }): Promise<InsightsBoard> => {
    const supabase = context.supabase as AuthedClient;
    const { roles } = await tenantScope(supabase, context.userId, data.tenantId);
    if (!canViewInsights(roles)) {
      throw new Error("Your role does not include the FPO insights workspace");
    }

    const t = data.tenantId;
    const [
      members,
      consents,
      applications,
      tracking,
      campaigns,
      lots,
      ledger,
      grants,
      tasks,
      notices,
    ] = await Promise.all([
      supabase.from("fpo_members").select("id, status, farmer_user_id").eq("tenant_id", t).limit(2000),
      supabase
        .from("fpo_farmer_consents")
        .select("farmer_user_id, purpose_code, revoked_at, expires_at")
        .eq("tenant_id", t)
        .eq("purpose_code", MEMBER_CONSENT_PURPOSE)
        .is("revoked_at", null)
        .limit(2000),
      supabase
        .from("fpo_scheme_applications")
        .select("id, status, benefit_amount")
        .eq("tenant_id", t)
        .limit(1000),
      supabase.from("fpo_opportunity_tracking").select("status").eq("tenant_id", t).limit(1000),
      supabase.from("fpo_procurement_campaigns").select("id, status").eq("tenant_id", t).limit(500),
      supabase
        .from("fpo_produce_lots")
        .select("id, status, aggregated_quantity")
        .eq("tenant_id", t)
        .limit(500),
      supabase
        .from("fpo_ledger_entries")
        .select("direction, amount, amount_settled, payment_state, category, campaign_id")
        .eq("tenant_id", t)
        .limit(3000),
      supabase
        .from("fpo_grant_funds")
        .select("sanctioned_amount, utilized_amount")
        .eq("tenant_id", t)
        .limit(500),
      supabase.from("fpo_tasks").select("status, due_date").eq("tenant_id", t).limit(1000),
      supabase.from("fpo_notifications").select("state, withheld_count").eq("tenant_id", t).limit(500),
    ]);

    const now = new Date().toISOString();
    const activeConsent = new Set(
      rows(consents)
        .filter((c) => !c.expires_at || c.expires_at > now)
        .map((c) => c.farmer_user_id)
        .filter((id): id is string => Boolean(id)),
    );

    const ledgerRows = rows(ledger);
    const procurementValue = ledgerRows
      .filter((l) => l.category === "procurement" && l.campaign_id)
      .reduce((acc, l) => acc + Number(l.amount ?? 0), 0);
    const campaignRows = rows(campaigns);

    const metrics = buildMetrics({
      members: rows(members).map((m) => ({
        status: m.status as string,
        consent_active: m.farmer_user_id ? activeConsent.has(m.farmer_user_id) : false,
      })),
      applications: rows(applications).map((a) => ({
        status: a.status as string,
        benefit_amount: a.benefit_amount == null ? null : Number(a.benefit_amount),
      })),
      opportunities: rows(tracking).map((o) => ({ track_status: o.status as string })),
      procurement: campaignRows.map((c, index) => ({
        status: c.status as string,
        // Procurement money movement lives in the ledger; attribute the total
        // once so the DERIVED card matches the accounts section.
        order_value: index === 0 ? procurementValue : 0,
      })),
      produceLots: rows(lots).map((l) => ({
        status: l.status as string,
        aggregated_quantity: l.aggregated_quantity == null ? null : Number(l.aggregated_quantity),
      })),
      ledger: ledgerRows.map((l) => ({
        direction: l.direction as string,
        amount: Math.max(0, Number(l.amount ?? 0) - Number(l.amount_settled ?? 0)),
        payment_state: l.payment_state as string,
      })),
      grants: rows(grants).map((g) => ({
        sanctioned_amount: Number(g.sanctioned_amount ?? 0),
        utilized_amount: Number(g.utilized_amount ?? 0),
      })),
      tasks: rows(tasks).map((tk, index) => ({
        status: tk.status as string,
        overdue: taskOverdue(
          {
            id: `task-${index}`,
            status: tk.status as never,
            priority: "normal",
            due_date: tk.due_date,
          },
          new Date(now),
        ),
      })),
      notices: rows(notices).map((n) => ({
        state: n.state as string,
        withheld_count: n.withheld_count ?? 0,
      })),
    });

    const canSeeTimeline = canViewTimeline(roles);
    let timeline: TimelineEntry[] = [];
    if (canSeeTimeline) {
      const audit = await supabase
        .from("audit_events")
        .select("id, action, subject_type, subject_id, decision, created_at, metadata")
        .eq("tenant_id", t)
        .order("created_at", { ascending: false })
        .limit(200);
      timeline = buildTimeline(
        rows(audit).map((r) => ({
          id: r.id,
          action: r.action,
          subject_type: r.subject_type,
          subject_id: r.subject_id,
          decision: r.decision,
          created_at: r.created_at,
          metadata: (r.metadata ?? null) as Record<string, unknown> | null,
        })),
        100,
      );
    }

    return {
      tenantId: t,
      roles,
      canSeeTimeline,
      metrics,
      attention: buildAttention(metrics),
      timeline,
      generatedAt: now,
      disclaimers: {
        insights: INSIGHTS_DISCLAIMER,
        timeline: TIMELINE_DISCLAIMER,
        search: SEARCH_DISCLAIMER,
      },
    };
  });

export const searchWorkspace = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { tenantId: string; query: string }) => data)
  .handler(async ({ data, context }): Promise<{ hits: SearchHit[]; disclaimer: string }> => {
    const supabase = context.supabase as AuthedClient;
    const { roles } = await tenantScope(supabase, context.userId, data.tenantId);
    if (!canViewSearch(roles)) {
      throw new Error("Your role does not include the FPO workspace search");
    }
    const query = data.query.trim();
    if (query.length < 2) return { hits: [], disclaimer: SEARCH_DISCLAIMER };

    const t = data.tenantId;
    const [members, applications, opportunities, campaigns, lots, ledger, grants, notices, tasks, staff] =
      await Promise.all([
        supabase
          .from("fpo_members")
          .select("id, member_ref, membership_number, display_name, contact_hint, village_cluster, crops, status")
          .eq("tenant_id", t)
          .limit(500),
        supabase
          .from("fpo_scheme_applications")
          .select("id, title, reference_no, status")
          .eq("tenant_id", t)
          .limit(300),
        supabase
          .from("fpo_opportunities")
          .select("id, title, provider_name, category, commodities")
          .or(`tenant_id.eq.${t},tenant_id.is.null`)
          .limit(300),
        supabase
          .from("fpo_procurement_campaigns")
          .select("id, name, input_category, season, status")
          .eq("tenant_id", t)
          .limit(300),
        supabase
          .from("fpo_produce_lots")
          .select("id, lot_code, commodity, variety, grade, status")
          .eq("tenant_id", t)
          .limit(300),
        supabase
          .from("fpo_ledger_entries")
          .select("id, description, reference, party_name, category, payment_state")
          .eq("tenant_id", t)
          .limit(500),
        supabase.from("fpo_grant_funds").select("id, title, funder_name, uc_state").eq("tenant_id", t).limit(200),
        supabase.from("fpo_notifications").select("id, title, category, state").eq("tenant_id", t).limit(300),
        supabase.from("fpo_tasks").select("id, title, category, status").eq("tenant_id", t).limit(300),
        supabase
          .from("fpo_staff_members")
          .select("id, display_name, designation, staff_role, status")
          .eq("tenant_id", t)
          .limit(200),
      ]);

    const docs: SearchDoc[] = [
      // Membership rows expose only the workspace reference and the masked
      // contact hint already stored on the membership row.
      ...rows(members).map((m) => ({
        id: m.id,
        kind: "member" as const,
        title: m.display_name ?? m.member_ref ?? m.membership_number ?? "Member",
        subtitle: [m.village_cluster, m.contact_hint, m.status].filter(Boolean).join(" · ") || null,
        section: "farmers" as const,
        terms: [
          m.member_ref ?? "",
          m.membership_number ?? "",
          ...((m.crops ?? []) as string[]),
        ].filter(Boolean),
      })),
      ...rows(applications).map((a) => ({
        id: a.id,
        kind: "application" as const,
        title: a.title,
        subtitle: [a.reference_no, a.status].filter(Boolean).join(" · ") || null,
        section: "applications" as const,
        terms: [a.reference_no ?? "", a.status].filter(Boolean),
      })),
      ...rows(opportunities).map((o) => ({
        id: o.id,
        kind: "opportunity" as const,
        title: o.title,
        subtitle: [o.provider_name, o.category].filter(Boolean).join(" · ") || null,
        section: "opportunities" as const,
        terms: [o.category, ...((o.commodities ?? []) as string[])].filter(Boolean),
      })),
      ...rows(campaigns).map((c) => ({
        id: c.id,
        kind: "procurement" as const,
        title: c.name,
        subtitle: [c.input_category, c.season, c.status].filter(Boolean).join(" · ") || null,
        section: "procurement" as const,
        terms: [c.input_category, c.season ?? "", c.status].filter(Boolean),
      })),
      ...rows(lots).map((l) => ({
        id: l.id,
        kind: "produce_lot" as const,
        title: l.lot_code ?? l.commodity,
        subtitle: [l.commodity, l.variety, l.grade, l.status].filter(Boolean).join(" · ") || null,
        section: "produce" as const,
        terms: [l.commodity, l.variety ?? "", l.grade ?? "", l.status].filter(Boolean),
      })),
      ...rows(ledger).map((l) => ({
        id: l.id,
        kind: "ledger" as const,
        title: l.description ?? l.reference ?? "Ledger entry",
        subtitle: [l.party_name, l.category, l.payment_state].filter(Boolean).join(" · ") || null,
        section: "accounts" as const,
        terms: [l.reference ?? "", l.category, l.payment_state].filter(Boolean),
      })),
      ...rows(grants).map((g) => ({
        id: g.id,
        kind: "grant" as const,
        title: g.title,
        subtitle: [g.funder_name, g.uc_state].filter(Boolean).join(" · ") || null,
        section: "accounts" as const,
        terms: [g.funder_name ?? "", g.uc_state].filter(Boolean),
      })),
      ...rows(notices).map((n) => ({
        id: n.id,
        kind: "notice" as const,
        title: n.title,
        subtitle: [n.category, n.state].filter(Boolean).join(" · ") || null,
        section: "notifications" as const,
        terms: [n.category, n.state].filter(Boolean),
      })),
      ...rows(tasks).map((tk) => ({
        id: tk.id,
        kind: "task" as const,
        title: tk.title,
        subtitle: [tk.category, tk.status].filter(Boolean).join(" · ") || null,
        section: "tasks" as const,
        terms: [tk.category, tk.status].filter(Boolean),
      })),
      ...rows(staff).map((s) => ({
        id: s.id,
        kind: "staff" as const,
        title: s.display_name,
        subtitle: [s.designation, s.staff_role, s.status].filter(Boolean).join(" · ") || null,
        section: "team" as const,
        terms: [s.designation ?? "", s.staff_role, s.status].filter(Boolean),
      })),
    ];

    return { hits: searchDocs(docs, query, 30), disclaimer: SEARCH_DISCLAIMER };
  });
