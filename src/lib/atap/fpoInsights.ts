/**
 * FPO Management & Operations workspace — Phase 10 pure domain logic
 * (insights, activity timeline, universal workspace search).
 *
 * This module holds no I/O and creates no new authority. Every number, event
 * and search hit is derived from rows the caller was already permitted to read
 * under existing tenant-scoped RLS and purpose-scoped farmer consent. Values
 * are labelled OBSERVED (recorded in the workspace) or DERIVED (computed from
 * observed rows); nothing here forecasts, decides a scheme/bank/insurer
 * outcome, or widens farmer-data access.
 */
import type { AppRole } from "@/lib/atap/policy";
import type { FpoSection } from "@/lib/atap/fpo";

export const INSIGHTS_DISCLAIMER =
  "Insights are DERIVED from records this organization already holds. They are operational aids only — they never decide a government, bank or insurer outcome, and they never reveal farmer data beyond what an active purpose-scoped authorization already allows.";

export const TIMELINE_DISCLAIMER =
  "The activity timeline shows audited workspace actions for this organization. Entries are append-only and cannot be edited or removed from here.";

export const SEARCH_DISCLAIMER =
  "Search covers only records inside this organization that you are already permitted to read. Farmer personal identifiers are never returned — only the masked contact hint stored on the membership row.";

/* ------------------------------------------------------------ authority */

const READ_ROLES: AppRole[] = [
  "platform_admin",
  "auditor",
  "tenant_admin",
  "onboarding_officer",
  "field_agent",
  "support_agent",
  "viewer",
];

const ADMIN_ROLES: AppRole[] = ["platform_admin", "tenant_admin"];

export function canViewInsights(roles: AppRole[]): boolean {
  return roles.some((r) => READ_ROLES.includes(r));
}

/** Only organization admins and auditors may read the full audited trail. */
export function canViewTimeline(roles: AppRole[]): boolean {
  return roles.some((r) => ADMIN_ROLES.includes(r) || r === "auditor");
}

export function canViewSearch(roles: AppRole[]): boolean {
  return canViewInsights(roles);
}

/* -------------------------------------------------------------- metrics */

export type MetricBasis = "OBSERVED" | "DERIVED";

export type MetricGroup =
  "membership" | "schemes" | "procurement" | "produce" | "accounts" | "operations";

export interface MetricCard {
  key: string;
  label: string;
  value: number;
  unit: "count" | "inr" | "quintal" | "percent";
  basis: MetricBasis;
  group: MetricGroup;
  section: FpoSection;
  hint?: string;
}

export interface InsightsInput {
  members: Array<{ status: string; consent_active?: boolean }>;
  applications: Array<{ status: string; benefit_amount?: number | null }>;
  opportunities: Array<{ track_status: string }>;
  procurement: Array<{ status: string; order_value?: number | null }>;
  produceLots: Array<{ status: string; aggregated_quantity?: number | null }>;
  ledger: Array<{ direction: string; amount: number; payment_state: string }>;
  grants: Array<{ sanctioned_amount: number; utilized_amount: number }>;
  tasks: Array<{ status: string; overdue?: boolean }>;
  notices: Array<{ state: string; withheld_count?: number }>;
}

function sum(values: number[]): number {
  return values.reduce((acc, v) => acc + v, 0);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function buildMetrics(input: InsightsInput): MetricCard[] {
  const activeMembers = input.members.filter((m) => m.status === "active");
  const authorized = activeMembers.filter((m) => m.consent_active === true);
  const outstanding = input.ledger.filter(
    (l) => l.payment_state === "pending" || l.payment_state === "partial",
  );

  const receivable = sum(outstanding.filter((l) => l.direction === "inflow").map((l) => l.amount));
  const payable = sum(outstanding.filter((l) => l.direction === "outflow").map((l) => l.amount));
  const sanctioned = sum(input.grants.map((g) => g.sanctioned_amount));
  const utilized = sum(input.grants.map((g) => g.utilized_amount));

  const cards: MetricCard[] = [
    {
      key: "active_members",
      label: "Active members",
      value: activeMembers.length,
      unit: "count",
      basis: "OBSERVED",
      group: "membership",
      section: "farmers",
    },
    {
      key: "authorized_members",
      label: "Members with an active authorization",
      value: authorized.length,
      unit: "count",
      basis: "OBSERVED",
      group: "membership",
      section: "farmers",
      hint: "Farmer-facing work is limited to these members.",
    },
    {
      key: "authorization_coverage",
      label: "Authorization coverage",
      value:
        activeMembers.length === 0 ? 0 : round2((authorized.length / activeMembers.length) * 100),
      unit: "percent",
      basis: "DERIVED",
      group: "membership",
      section: "farmers",
    },
    {
      key: "applications_in_flight",
      label: "Applications in progress",
      value: input.applications.filter(
        (a) => !["approved", "rejected", "closed", "benefit_received"].includes(a.status),
      ).length,
      unit: "count",
      basis: "OBSERVED",
      group: "schemes",
      section: "applications",
    },
    {
      key: "benefit_received",
      label: "Benefit received (recorded)",
      value: round2(
        sum(
          input.applications
            .filter((a) => a.status === "benefit_received")
            .map((a) => a.benefit_amount ?? 0),
        ),
      ),
      unit: "inr",
      basis: "OBSERVED",
      group: "schemes",
      section: "applications",
      hint: "Outcome recorded by the authorized reviewer, not decided here.",
    },
    {
      key: "opportunities_shortlisted",
      label: "Opportunities shortlisted",
      value: input.opportunities.filter((o) => o.track_status === "shortlisted").length,
      unit: "count",
      basis: "OBSERVED",
      group: "schemes",
      section: "opportunities",
    },
    {
      key: "procurement_open",
      label: "Open procurement cycles",
      value: input.procurement.filter((p) => !["closed", "cancelled"].includes(p.status)).length,
      unit: "count",
      basis: "OBSERVED",
      group: "procurement",
      section: "procurement",
    },
    {
      key: "procurement_value",
      label: "Ordered procurement value",
      value: round2(sum(input.procurement.map((p) => p.order_value ?? 0))),
      unit: "inr",
      basis: "DERIVED",
      group: "procurement",
      section: "procurement",
    },
    {
      key: "produce_aggregated",
      label: "Produce aggregated",
      value: round2(sum(input.produceLots.map((l) => l.aggregated_quantity ?? 0))),
      unit: "quintal",
      basis: "OBSERVED",
      group: "produce",
      section: "produce",
    },
    {
      key: "produce_open_lots",
      label: "Lots awaiting settlement",
      value: input.produceLots.filter((l) => !["settled", "closed", "cancelled"].includes(l.status))
        .length,
      unit: "count",
      basis: "OBSERVED",
      group: "produce",
      section: "produce",
    },
    {
      key: "receivable",
      label: "Receivable from members",
      value: round2(receivable),
      unit: "inr",
      basis: "DERIVED",
      group: "accounts",
      section: "accounts",
    },
    {
      key: "payable",
      label: "Payable to members and suppliers",
      value: round2(payable),
      unit: "inr",
      basis: "DERIVED",
      group: "accounts",
      section: "accounts",
    },
    {
      key: "grant_unutilized",
      label: "Grant funds yet to be utilized",
      value: round2(Math.max(0, sanctioned - utilized)),
      unit: "inr",
      basis: "DERIVED",
      group: "accounts",
      section: "accounts",
    },
    {
      key: "tasks_overdue",
      label: "Overdue tasks",
      value: input.tasks.filter((t) => t.overdue === true && t.status !== "done").length,
      unit: "count",
      basis: "DERIVED",
      group: "operations",
      section: "tasks",
    },
    {
      key: "notices_withheld",
      label: "Notice deliveries withheld",
      value: sum(input.notices.map((n) => n.withheld_count ?? 0)),
      unit: "count",
      basis: "OBSERVED",
      group: "operations",
      section: "notifications",
      hint: "Withheld because the channel is disabled or no authorization is on record.",
    },
  ];

  return cards;
}

export const METRIC_GROUP_LABEL: Record<MetricGroup, string> = {
  membership: "Membership",
  schemes: "Schemes & opportunities",
  procurement: "Procurement",
  produce: "Produce & market",
  accounts: "Accounts",
  operations: "Operations",
};

export function groupMetrics(cards: MetricCard[]): Array<{
  group: MetricGroup;
  label: string;
  cards: MetricCard[];
}> {
  const order: MetricGroup[] = [
    "membership",
    "schemes",
    "procurement",
    "produce",
    "accounts",
    "operations",
  ];
  return order
    .map((group) => ({
      group,
      label: METRIC_GROUP_LABEL[group],
      cards: cards.filter((c) => c.group === group),
    }))
    .filter((g) => g.cards.length > 0);
}

export function formatMetric(card: MetricCard): string {
  if (card.unit === "inr") return `₹${card.value.toLocaleString("en-IN")}`;
  if (card.unit === "percent") return `${card.value}%`;
  if (card.unit === "quintal") return `${card.value.toLocaleString("en-IN")} qtl`;
  return card.value.toLocaleString("en-IN");
}

/* ------------------------------------------------------- attention list */

export interface AttentionItem {
  key: string;
  label: string;
  section: FpoSection;
  severity: "info" | "warning";
}

export function buildAttention(cards: MetricCard[]): AttentionItem[] {
  const value = (key: string) => cards.find((c) => c.key === key)?.value ?? 0;
  const items: AttentionItem[] = [];

  if (value("tasks_overdue") > 0) {
    items.push({
      key: "tasks_overdue",
      label: `${value("tasks_overdue")} task(s) are past their due date`,
      section: "tasks",
      severity: "warning",
    });
  }
  if (value("authorization_coverage") < 100 && value("active_members") > 0) {
    items.push({
      key: "authorization_gap",
      label:
        "Some active members have no authorization on record — farmer-facing work is blocked for them",
      section: "farmers",
      severity: "info",
    });
  }
  if (value("receivable") > 0) {
    items.push({
      key: "receivable",
      label: `${formatMetric({ ...cards.find((c) => c.key === "receivable")! })} still to be collected`,
      section: "accounts",
      severity: "info",
    });
  }
  if (value("grant_unutilized") > 0) {
    items.push({
      key: "grant_unutilized",
      label: "Sanctioned grant funds remain unutilized — utilization certificates may be due",
      section: "accounts",
      severity: "warning",
    });
  }
  if (value("notices_withheld") > 0) {
    items.push({
      key: "notices_withheld",
      label: `${value("notices_withheld")} notice delivery(ies) were withheld`,
      section: "notifications",
      severity: "info",
    });
  }
  return items;
}

/* ------------------------------------------------------------- timeline */

export interface AuditRowLike {
  id: string;
  action: string;
  subject_type: string | null;
  subject_id: string | null;
  decision: string;
  created_at: string;
  metadata?: Record<string, unknown> | null;
}

export interface TimelineEntry {
  id: string;
  action: string;
  label: string;
  section: FpoSection;
  decision: string;
  at: string;
  detail: string | null;
}

const SECTION_BY_PREFIX: Array<[string, FpoSection]> = [
  ["fpo.member", "farmers"],
  ["fpo.consent", "farmers"],
  ["fpo.segment", "farmers"],
  ["fpo.tag", "farmers"],
  ["fpo.opportunity", "opportunities"],
  ["fpo.scheme", "schemes"],
  ["fpo.application", "applications"],
  ["fpo.campaign", "applications"],
  ["fpo.facilitation", "applications"],
  ["fpo.procurement", "procurement"],
  ["fpo.rfq", "procurement"],
  ["fpo.quote", "procurement"],
  ["fpo.produce", "produce"],
  ["fpo.enquiry", "produce"],
  ["fpo.ledger", "accounts"],
  ["fpo.grant", "accounts"],
  ["fpo.reconcil", "accounts"],
  ["fpo.notice", "notifications"],
  ["fpo.notification", "notifications"],
  ["fpo.task", "tasks"],
  ["fpo.staff", "team"],
  ["fpo.permission", "team"],
  ["fpo.access_review", "team"],
  ["fpo.document", "documents"],
  ["fpo.profile", "settings"],
];

export function sectionForAction(action: string): FpoSection {
  const hit = SECTION_BY_PREFIX.find(([prefix]) => action.startsWith(prefix));
  return hit ? hit[1] : "overview";
}

export function humanizeAction(action: string): string {
  const trimmed = action
    .replace(/^fpo\./, "")
    .replaceAll(".", " ")
    .replaceAll("_", " ");
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

/** Metadata keys that may carry direct farmer identifiers are never surfaced. */
const BLOCKED_METADATA_KEYS = [
  "farmer_user_id",
  "user_id",
  "phone",
  "email",
  "aadhaar",
  "account_number",
  "pan",
  "name",
  "full_name",
];

export function safeDetail(metadata: Record<string, unknown> | null | undefined): string | null {
  if (!metadata) return null;
  const parts: string[] = [];
  for (const [key, value] of Object.entries(metadata)) {
    if (BLOCKED_METADATA_KEYS.some((blocked) => key.toLowerCase().includes(blocked))) continue;
    if (value === null || value === undefined) continue;
    if (typeof value === "object") continue;
    parts.push(`${key.replaceAll("_", " ")}: ${String(value)}`);
    if (parts.length === 4) break;
  }
  return parts.length === 0 ? null : parts.join(" · ");
}

export function buildTimeline(rows: AuditRowLike[], limit = 50): TimelineEntry[] {
  return [...rows]
    .sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0))
    .slice(0, limit)
    .map((row) => ({
      id: row.id,
      action: row.action,
      label: humanizeAction(row.action),
      section: sectionForAction(row.action),
      decision: row.decision,
      at: row.created_at,
      detail: safeDetail(row.metadata),
    }));
}

export function filterTimeline(
  entries: TimelineEntry[],
  filter: { section?: FpoSection | "all"; decision?: string | "all" },
): TimelineEntry[] {
  return entries.filter((e) => {
    if (filter.section && filter.section !== "all" && e.section !== filter.section) return false;
    if (filter.decision && filter.decision !== "all" && e.decision !== filter.decision)
      return false;
    return true;
  });
}

/* --------------------------------------------------------------- search */

export type SearchKind =
  | "member"
  | "application"
  | "opportunity"
  | "procurement"
  | "produce_lot"
  | "ledger"
  | "grant"
  | "notice"
  | "task"
  | "staff";

export interface SearchDoc {
  id: string;
  kind: SearchKind;
  title: string;
  subtitle: string | null;
  section: FpoSection;
  terms: string[];
}

export interface SearchHit extends SearchDoc {
  score: number;
}

export const SEARCH_KIND_LABEL: Record<SearchKind, string> = {
  member: "Member",
  application: "Scheme application",
  opportunity: "Opportunity",
  procurement: "Procurement cycle",
  produce_lot: "Produce lot",
  ledger: "Ledger entry",
  grant: "Grant fund",
  notice: "Notice",
  task: "Task",
  staff: "Team seat",
};

function normalize(value: string): string {
  return value.toLowerCase().trim();
}

export function scoreDoc(doc: SearchDoc, query: string): number {
  const q = normalize(query);
  if (q.length === 0) return 0;
  const title = normalize(doc.title);
  if (title === q) return 100;
  if (title.startsWith(q)) return 80;
  if (title.includes(q)) return 60;
  const term = doc.terms.map(normalize).find((t) => t.includes(q));
  if (term) return 40;
  const subtitle = doc.subtitle ? normalize(doc.subtitle) : "";
  if (subtitle.includes(q)) return 20;
  return 0;
}

export function searchDocs(docs: SearchDoc[], query: string, limit = 20): SearchHit[] {
  if (normalize(query).length < 2) return [];
  return docs
    .map((doc) => ({ ...doc, score: scoreDoc(doc, query) }))
    .filter((hit) => hit.score > 0)
    .sort((a, b) => (b.score - a.score !== 0 ? b.score - a.score : a.title.localeCompare(b.title)))
    .slice(0, limit);
}

export function groupHits(
  hits: SearchHit[],
): Array<{ kind: SearchKind; label: string; hits: SearchHit[] }> {
  const kinds = Array.from(new Set(hits.map((h) => h.kind)));
  return kinds.map((kind) => ({
    kind,
    label: SEARCH_KIND_LABEL[kind],
    hits: hits.filter((h) => h.kind === kind),
  }));
}
