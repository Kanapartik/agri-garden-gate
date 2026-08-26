import { describe, expect, it } from "vitest";
import {
  buildAttention,
  buildMetrics,
  buildTimeline,
  canViewInsights,
  canViewTimeline,
  filterTimeline,
  formatMetric,
  groupHits,
  groupMetrics,
  humanizeAction,
  safeDetail,
  searchDocs,
  sectionForAction,
  type InsightsInput,
  type SearchDoc,
} from "@/lib/atap/fpoInsights";

const input: InsightsInput = {
  members: [
    { status: "active", consent_active: true },
    { status: "active", consent_active: false },
    { status: "exited", consent_active: false },
  ],
  applications: [
    { status: "submitted" },
    { status: "benefit_received", benefit_amount: 250000 },
    { status: "rejected" },
  ],
  opportunities: [{ track_status: "shortlisted" }, { track_status: "new" }],
  procurement: [
    { status: "ordered", order_value: 180000 },
    { status: "closed", order_value: 20000 },
  ],
  produceLots: [
    { status: "listed", aggregated_quantity: 320.5 },
    { status: "settled", aggregated_quantity: 100 },
  ],
  ledger: [
    { direction: "inflow", amount: 40000, payment_state: "pending" },
    { direction: "inflow", amount: 10000, payment_state: "paid" },
    { direction: "outflow", amount: 15000, payment_state: "partial" },
  ],
  grants: [{ sanctioned_amount: 500000, utilized_amount: 300000 }],
  tasks: [
    { status: "open", overdue: true },
    { status: "done", overdue: true },
  ],
  notices: [{ state: "sent", withheld_count: 2 }],
};

const metric = (key: string) => buildMetrics(input).find((c) => c.key === key)!;

describe("fpo insights — authority", () => {
  it("allows any FPO staff role to read insights", () => {
    expect(canViewInsights(["field_agent"])).toBe(true);
    expect(canViewInsights(["viewer"])).toBe(true);
    expect(canViewInsights(["talent_candidate"])).toBe(false);
  });

  it("restricts the audited timeline to organization admins and auditors", () => {
    expect(canViewTimeline(["tenant_admin"])).toBe(true);
    expect(canViewTimeline(["auditor"])).toBe(true);
    expect(canViewTimeline(["field_agent"])).toBe(false);
  });
});

describe("fpo insights — metrics", () => {
  it("counts active members and authorized members separately", () => {
    expect(metric("active_members").value).toBe(2);
    expect(metric("authorized_members").value).toBe(1);
  });

  it("derives authorization coverage and marks it DERIVED", () => {
    expect(metric("authorization_coverage").value).toBe(50);
    expect(metric("authorization_coverage").basis).toBe("DERIVED");
    expect(metric("active_members").basis).toBe("OBSERVED");
  });

  it("labels recorded government outcomes as observed, not decided here", () => {
    const card = metric("benefit_received");
    expect(card.value).toBe(250000);
    expect(card.basis).toBe("OBSERVED");
    expect(card.hint).toMatch(/authorized reviewer/i);
  });

  it("excludes settled work from in-flight counts", () => {
    expect(metric("applications_in_flight").value).toBe(1);
    expect(metric("procurement_open").value).toBe(1);
    expect(metric("produce_open_lots").value).toBe(1);
  });

  it("computes receivables, payables and unutilized grants from outstanding rows only", () => {
    expect(metric("receivable").value).toBe(40000);
    expect(metric("payable").value).toBe(15000);
    expect(metric("grant_unutilized").value).toBe(200000);
  });

  it("does not count completed tasks as overdue", () => {
    expect(metric("tasks_overdue").value).toBe(1);
  });

  it("surfaces withheld notice deliveries", () => {
    expect(metric("notices_withheld").value).toBe(2);
  });

  it("handles an empty organization without dividing by zero", () => {
    const empty = buildMetrics({
      members: [],
      applications: [],
      opportunities: [],
      procurement: [],
      produceLots: [],
      ledger: [],
      grants: [],
      tasks: [],
      notices: [],
    });
    expect(empty.find((c) => c.key === "authorization_coverage")!.value).toBe(0);
    expect(empty.every((c) => c.value === 0)).toBe(true);
  });

  it("groups metrics in a stable order and formats units", () => {
    const groups = groupMetrics(buildMetrics(input));
    expect(groups.map((g) => g.group)).toEqual([
      "membership",
      "schemes",
      "procurement",
      "produce",
      "accounts",
      "operations",
    ]);
    expect(formatMetric(metric("receivable"))).toContain("₹");
    expect(formatMetric(metric("authorization_coverage"))).toBe("50%");
    expect(formatMetric(metric("produce_aggregated"))).toContain("qtl");
  });
});

describe("fpo insights — attention list", () => {
  it("raises overdue tasks and grant utilization as warnings", () => {
    const items = buildAttention(buildMetrics(input));
    const overdue = items.find((i) => i.key === "tasks_overdue");
    expect(overdue?.severity).toBe("warning");
    expect(items.find((i) => i.key === "grant_unutilized")?.severity).toBe("warning");
    expect(items.find((i) => i.key === "authorization_gap")?.section).toBe("farmers");
  });

  it("stays empty for a clean organization", () => {
    const clean = buildMetrics({
      members: [{ status: "active", consent_active: true }],
      applications: [],
      opportunities: [],
      procurement: [],
      produceLots: [],
      ledger: [],
      grants: [],
      tasks: [],
      notices: [],
    });
    expect(buildAttention(clean)).toEqual([]);
  });
});

describe("fpo insights — activity timeline", () => {
  const rows = [
    {
      id: "a",
      action: "fpo.ledger.transaction_recorded",
      subject_type: "fpo_ledger_entries",
      subject_id: "l1",
      decision: "allow",
      created_at: "2026-05-01T10:00:00Z",
      metadata: { amount: 4000, farmer_user_id: "u-1", phone: "9999999999" },
    },
    {
      id: "b",
      action: "fpo.task.status_changed",
      subject_type: "fpo_tasks",
      subject_id: "t1",
      decision: "allow",
      created_at: "2026-05-03T10:00:00Z",
      metadata: null,
    },
    {
      id: "c",
      action: "fpo.staff.suspended",
      subject_type: "fpo_staff_members",
      subject_id: "s1",
      decision: "deny",
      created_at: "2026-05-02T10:00:00Z",
      metadata: { reason: "left organization" },
    },
  ];

  it("orders newest first and humanizes actions", () => {
    const timeline = buildTimeline(rows);
    expect(timeline.map((e) => e.id)).toEqual(["b", "c", "a"]);
    expect(timeline[0]!.label).toBe("Task status changed");
    expect(humanizeAction("fpo.grant.utilization_recorded")).toBe("Grant utilization recorded");
  });

  it("routes each entry to its workspace section", () => {
    expect(sectionForAction("fpo.ledger.transaction_recorded")).toBe("accounts");
    expect(sectionForAction("fpo.member.added")).toBe("farmers");
    expect(sectionForAction("fpo.permission.set")).toBe("team");
    expect(sectionForAction("something.else")).toBe("overview");
  });

  it("never leaks farmer identifiers or contact details from metadata", () => {
    const detail = safeDetail(rows[0]!.metadata);
    expect(detail).toContain("amount: 4000");
    expect(detail).not.toContain("u-1");
    expect(detail).not.toContain("9999999999");
    expect(safeDetail(null)).toBeNull();
  });

  it("filters by section and decision", () => {
    const timeline = buildTimeline(rows);
    expect(filterTimeline(timeline, { section: "accounts" }).map((e) => e.id)).toEqual(["a"]);
    expect(filterTimeline(timeline, { decision: "deny" }).map((e) => e.id)).toEqual(["c"]);
    expect(filterTimeline(timeline, { section: "all", decision: "all" })).toHaveLength(3);
  });

  it("caps the returned window", () => {
    const many = Array.from({ length: 80 }, (_, i) => ({
      ...rows[1]!,
      id: `x${i}`,
      created_at: `2026-05-${String((i % 28) + 1).padStart(2, "0")}T10:00:00Z`,
    }));
    expect(buildTimeline(many, 25)).toHaveLength(25);
  });
});

describe("fpo insights — universal search", () => {
  const docs: SearchDoc[] = [
    {
      id: "m1",
      kind: "member",
      title: "Member GNT-0114",
      subtitle: "Guntur · ****3421",
      section: "farmers",
      terms: ["chilli", "GNT-0114"],
    },
    {
      id: "p1",
      kind: "produce_lot",
      title: "Chilli lot — May aggregation",
      subtitle: "320 qtl",
      section: "produce",
      terms: ["chilli", "guntur"],
    },
    {
      id: "t1",
      kind: "task",
      title: "Collect utilization certificate",
      subtitle: "due 2026-06-01",
      section: "tasks",
      terms: ["grant"],
    },
  ];

  it("requires at least two characters", () => {
    expect(searchDocs(docs, "c")).toEqual([]);
    expect(searchDocs(docs, "  ")).toEqual([]);
  });

  it("ranks title matches above term and subtitle matches", () => {
    const hits = searchDocs(docs, "chilli");
    expect(hits[0]!.id).toBe("p1");
    expect(hits.map((h) => h.id)).toContain("m1");
    expect(hits[0]!.score).toBeGreaterThan(hits[1]!.score);
  });

  it("matches case-insensitively and carries the target section", () => {
    const hits = searchDocs(docs, "UTILIZATION");
    expect(hits).toHaveLength(1);
    expect(hits[0]!.section).toBe("tasks");
  });

  it("returns nothing for records that do not match", () => {
    expect(searchDocs(docs, "zzzz")).toEqual([]);
  });

  it("respects the result limit and groups hits by kind", () => {
    const wide = Array.from({ length: 30 }, (_, i) => ({ ...docs[0]!, id: `m${i}` }));
    expect(searchDocs(wide, "member", 5)).toHaveLength(5);
    const groups = groupHits(searchDocs(docs, "chilli"));
    expect(groups.map((g) => g.kind).sort()).toEqual(["member", "produce_lot"]);
  });
});
