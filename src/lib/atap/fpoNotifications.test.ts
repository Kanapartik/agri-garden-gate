import { describe, expect, it } from "vitest";
import {
  canManageTasks,
  canSendNotifications,
  canTransitionNotice,
  canTransitionTask,
  canViewNotifications,
  canWorkTasks,
  channelEnabled,
  decideChannel,
  isTaskOpen,
  nextNoticeStates,
  nextTaskStatuses,
  noticeReadiness,
  planDispatch,
  sortTaskQueue,
  summarizeDeliveries,
  summarizeTasks,
  taskDueSoon,
  taskOverdue,
  type RecipientLike,
  type TaskLike,
} from "@/lib/atap/fpoNotifications";

const consenting: RecipientLike = {
  memberId: "m1",
  label: "Lakshmi D.",
  hasMemberConsent: true,
  hasContact: true,
};
const noConsent: RecipientLike = { ...consenting, memberId: "m2", hasMemberConsent: false };
const noContact: RecipientLike = { ...consenting, memberId: "m3", hasContact: false };

describe("channel gating", () => {
  it("enables only the in-app channel for now", () => {
    expect(channelEnabled("in_app")).toBe(true);
    expect(channelEnabled("sms")).toBe(false);
    expect(channelEnabled("whatsapp")).toBe(false);
    expect(channelEnabled("voice")).toBe(false);
  });

  it("queues in-app delivery for roster members", () => {
    const d = decideChannel(noConsent, "in_app");
    expect(d.state).toBe("queued");
    expect(d.reason).toBeNull();
  });

  it("withholds disabled outbound channels with a stated reason", () => {
    const d = decideChannel(consenting, "sms");
    expect(d.state).toBe("withheld");
    expect(d.reason).toContain("not enabled");
  });
});

describe("planDispatch", () => {
  it("produces one decision per recipient per channel and counts reasons", () => {
    const plan = planDispatch([consenting, noConsent, noContact], ["in_app", "sms"]);
    expect(plan.decisions).toHaveLength(6);
    expect(plan.queued).toBe(3);
    expect(plan.withheld).toBe(3);
    expect(plan.reasons[0]?.count).toBe(3);
  });

  it("defaults to the in-app channel when none requested", () => {
    const plan = planDispatch([consenting], []);
    expect(plan.decisions).toHaveLength(1);
    expect(plan.decisions[0]?.channel).toBe("in_app");
  });

  it("never widens consent for an outbound channel", () => {
    const decisions = planDispatch([noConsent], ["whatsapp"]).decisions;
    expect(decisions[0]?.state).toBe("withheld");
  });
});

describe("notice lifecycle", () => {
  it("allows draft to scheduled and scheduled to sending", () => {
    expect(canTransitionNotice("draft", "scheduled")).toBe(true);
    expect(canTransitionNotice("scheduled", "sending")).toBe(true);
    expect(canTransitionNotice("sending", "sent")).toBe(true);
  });

  it("treats a sent notice as terminal", () => {
    expect(nextNoticeStates("sent")).toEqual([]);
    expect(canTransitionNotice("sent", "draft")).toBe(false);
    expect(canTransitionNotice("cancelled", "sending")).toBe(false);
  });
});

describe("noticeReadiness", () => {
  const base = {
    title: "Kharif meeting",
    body: "Meeting on Friday at the collection centre.",
    audience: "all_members" as const,
    channels: ["in_app" as const],
    recipientCount: 12,
  };

  it("passes a complete notice", () => {
    expect(noticeReadiness(base).ready).toBe(true);
  });

  it("blocks an empty audience, missing text and unresolved segment", () => {
    expect(noticeReadiness({ ...base, recipientCount: 0 }).blockers).toContain(
      "This audience resolves to no recipients",
    );
    expect(noticeReadiness({ ...base, body: " " }).ready).toBe(false);
    expect(noticeReadiness({ ...base, audience: "segment", segmentId: null }).blockers).toContain(
      "Select a member segment",
    );
    expect(
      noticeReadiness({ ...base, audience: "single_member", memberId: null }).blockers,
    ).toContain("Select a member");
  });

  it("blocks a send where every channel is disabled", () => {
    expect(noticeReadiness({ ...base, channels: ["sms"] }).ready).toBe(false);
  });
});

describe("summarizeDeliveries", () => {
  it("counts states, reads and reach rate", () => {
    const s = summarizeDeliveries([
      { state: "delivered", read_at: "2026-08-26T10:00:00Z" },
      { state: "delivered", read_at: null },
      { state: "withheld" },
      { state: "failed" },
    ]);
    expect(s.total).toBe(4);
    expect(s.delivered).toBe(2);
    expect(s.withheld).toBe(1);
    expect(s.failed).toBe(1);
    expect(s.read).toBe(1);
    expect(s.reachRate).toBe(50);
  });

  it("reports a zero reach rate for no deliveries", () => {
    expect(summarizeDeliveries([]).reachRate).toBe(0);
  });
});

describe("roles", () => {
  it("restricts sending to tenant and platform admins", () => {
    expect(canSendNotifications(["tenant_admin"])).toBe(true);
    expect(canSendNotifications(["platform_admin"])).toBe(true);
    expect(canSendNotifications(["field_agent"])).toBe(false);
  });

  it("lets staff read notices and work tasks but not create them", () => {
    expect(canViewNotifications(["field_agent"])).toBe(true);
    expect(canWorkTasks(["field_agent"])).toBe(true);
    expect(canManageTasks(["field_agent"])).toBe(false);
  });

  it("keeps an auditor read-only", () => {
    expect(canViewNotifications(["auditor"])).toBe(true);
    expect(canWorkTasks(["auditor"])).toBe(false);
  });
});

describe("task lifecycle", () => {
  it("permits working transitions and reopening", () => {
    expect(canTransitionTask("open", "in_progress")).toBe(true);
    expect(canTransitionTask("in_progress", "done")).toBe(true);
    expect(canTransitionTask("done", "open")).toBe(true);
    expect(canTransitionTask("done", "in_progress")).toBe(false);
    expect(nextTaskStatuses("blocked")).toContain("in_progress");
  });

  it("classifies open statuses", () => {
    expect(isTaskOpen("blocked")).toBe(true);
    expect(isTaskOpen("done")).toBe(false);
  });
});

describe("task queue", () => {
  const today = new Date("2026-08-26T00:00:00Z");
  const tasks: TaskLike[] = [
    { id: "t1", status: "open", priority: "low", due_date: "2026-08-20" },
    { id: "t2", status: "open", priority: "urgent", due_date: "2026-08-30" },
    { id: "t3", status: "in_progress", priority: "normal", due_date: null },
    { id: "t4", status: "done", priority: "high", due_date: "2026-08-01" },
  ];

  it("detects overdue and due-soon only for open tasks", () => {
    expect(taskOverdue(tasks[0]!, today)).toBe(true);
    expect(taskOverdue(tasks[3]!, today)).toBe(false);
    expect(taskDueSoon(tasks[1]!, 7, today)).toBe(true);
    expect(taskDueSoon(tasks[2]!, 7, today)).toBe(false);
  });

  it("orders overdue first then by priority", () => {
    const order = sortTaskQueue(tasks, today).map((t) => t.id);
    expect(order[0]).toBe("t1");
    expect(order[1]).toBe("t2");
  });

  it("summarizes the queue", () => {
    const s = summarizeTasks(tasks, today);
    expect(s.total).toBe(4);
    expect(s.open).toBe(3);
    expect(s.overdue).toBe(1);
    expect(s.dueSoon).toBe(1);
    expect(s.done).toBe(1);
    expect(s.urgent).toBe(1);
    expect(s.byStatus.find((b) => b.status === "open")?.count).toBe(2);
  });
});
