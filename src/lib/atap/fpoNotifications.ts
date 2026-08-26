/**
 * FPO Management & Operations workspace — Phase 8 pure domain logic.
 *
 * Notifications are consent-aware and channel-gated: an FPO can always reach a
 * member in-app inside the workspace it already administers, but an outbound
 * personal channel (SMS / WhatsApp / voice) is only permitted when the farmer
 * holds an active member-management authorization AND the platform has enabled
 * that channel. Anything else is recorded as *withheld with a stated reason*
 * rather than silently dropped, so the FPO can see exactly who was not reached
 * and why. Tasks are internal work items — they never carry farmer data and
 * never decide a scheme, bank or payment outcome.
 *
 * This module performs no I/O; every authority decision is re-checked
 * server-side in `fpoNotifications.functions.ts`.
 */
import type { AppRole } from "@/lib/atap/policy";

/* ------------------------------------------------------------ vocabulary */

export const NOTICE_CATEGORIES = [
  "scheme",
  "procurement",
  "produce",
  "payment",
  "meeting",
  "compliance",
  "general",
] as const;
export type NoticeCategory = (typeof NOTICE_CATEGORIES)[number];

export const NOTICE_CATEGORY_LABEL: Record<NoticeCategory, string> = {
  scheme: "Scheme",
  procurement: "Procurement",
  produce: "Produce & market",
  payment: "Payment",
  meeting: "Meeting",
  compliance: "Compliance",
  general: "General",
};

export const NOTICE_AUDIENCES = ["all_members", "segment", "single_member", "staff"] as const;
export type NoticeAudience = (typeof NOTICE_AUDIENCES)[number];

export const NOTICE_AUDIENCE_LABEL: Record<NoticeAudience, string> = {
  all_members: "All active members",
  segment: "Saved member segment",
  single_member: "One member",
  staff: "FPO staff only",
};

export const NOTICE_CHANNELS = ["in_app", "sms", "whatsapp", "voice"] as const;
export type NoticeChannel = (typeof NOTICE_CHANNELS)[number];

export const NOTICE_CHANNEL_LABEL: Record<NoticeChannel, string> = {
  in_app: "In-app workspace",
  sms: "SMS",
  whatsapp: "WhatsApp",
  voice: "Voice call / IVR",
};

/**
 * Personal-device channels stay off until the permitted-channel decision is
 * validated and a provider adapter is configured. Configuration, not a fork.
 */
export const ENABLED_CHANNELS: NoticeChannel[] = ["in_app"];

export function channelEnabled(channel: NoticeChannel): boolean {
  return ENABLED_CHANNELS.includes(channel);
}

export const NOTICE_STATES = ["draft", "scheduled", "sending", "sent", "cancelled"] as const;
export type NoticeState = (typeof NOTICE_STATES)[number];

export const NOTICE_STATE_LABEL: Record<NoticeState, string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  sending: "Sending",
  sent: "Sent",
  cancelled: "Cancelled",
};

export const DELIVERY_STATES = ["queued", "delivered", "withheld", "failed"] as const;
export type DeliveryState = (typeof DELIVERY_STATES)[number];

export const DELIVERY_STATE_LABEL: Record<DeliveryState, string> = {
  queued: "Queued",
  delivered: "Delivered",
  withheld: "Withheld",
  failed: "Failed",
};

export const TASK_STATUSES = ["open", "in_progress", "blocked", "done", "cancelled"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  blocked: "Blocked",
  done: "Done",
  cancelled: "Cancelled",
};

export const TASK_PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const TASK_PRIORITY_LABEL: Record<TaskPriority, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
};

export const PRIORITY_WEIGHT: Record<TaskPriority, number> = {
  urgent: 0,
  high: 1,
  normal: 2,
  low: 3,
};

export const NOTIFICATIONS_DISCLAIMER =
  "Members are reached inside the workspace. Outbound SMS, WhatsApp and voice channels remain disabled " +
  "until the permitted-channel decision is validated and a provider adapter is configured; requests on those " +
  "channels are recorded as withheld with a reason and are never sent silently.";

export const TASKS_DISCLAIMER =
  "Tasks coordinate FPO work only. Completing a task never approves a scheme application, releases a payment " +
  "or changes a government, bank or insurer outcome — those stay with the authorized role.";

/* ----------------------------------------------------------------- roles */

/** Composing and scheduling member communication is an admin act. */
export function canSendNotifications(roles: AppRole[]): boolean {
  return roles.includes("platform_admin") || roles.includes("tenant_admin");
}

export function canViewNotifications(roles: AppRole[]): boolean {
  return (
    canSendNotifications(roles) ||
    roles.includes("auditor") ||
    roles.includes("viewer") ||
    roles.includes("onboarding_officer") ||
    roles.includes("field_agent")
  );
}

/** Any FPO staff role may work a task queue and add progress notes. */
export function canWorkTasks(roles: AppRole[]): boolean {
  return canViewNotifications(roles) && !onlyAuditor(roles);
}

/** Creating, assigning, reprioritising or cancelling a task is an admin act. */
export function canManageTasks(roles: AppRole[]): boolean {
  return canSendNotifications(roles);
}

function onlyAuditor(roles: AppRole[]): boolean {
  return roles.length > 0 && roles.every((r) => r === "auditor");
}

/* -------------------------------------------------------------- channels */

export interface RecipientLike {
  memberId: string;
  label: string;
  /** Active `fpo_member_management` authorization on record for this farmer. */
  hasMemberConsent: boolean;
  /** A reachable phone hint exists on the roster row. */
  hasContact: boolean;
}

export interface ChannelDecision {
  memberId: string;
  label: string;
  channel: NoticeChannel;
  state: Extract<DeliveryState, "queued" | "withheld">;
  reason: string | null;
}

/**
 * Resolves one recipient against one requested channel. The decision is
 * explicit and explainable — no fallback channel is invented, and consent is
 * never widened because the FPO administers the roster.
 */
export function decideChannel(recipient: RecipientLike, channel: NoticeChannel): ChannelDecision {
  const base = { memberId: recipient.memberId, label: recipient.label, channel };
  if (!channelEnabled(channel)) {
    return {
      ...base,
      state: "withheld",
      reason: `${NOTICE_CHANNEL_LABEL[channel]} dispatch is not enabled on this platform`,
    };
  }
  if (channel === "in_app") return { ...base, state: "queued", reason: null };
  if (!recipient.hasMemberConsent) {
    return {
      ...base,
      state: "withheld",
      reason: "No active member-management authorization on record for this farmer",
    };
  }
  if (!recipient.hasContact) {
    return { ...base, state: "withheld", reason: "No contact number on the roster row" };
  }
  return { ...base, state: "queued", reason: null };
}

export interface DispatchPlan {
  decisions: ChannelDecision[];
  queued: number;
  withheld: number;
  reasons: Array<{ reason: string; count: number }>;
}

/** Plans a full send: one decision per recipient per requested channel. */
export function planDispatch(recipients: RecipientLike[], channels: NoticeChannel[]): DispatchPlan {
  const requested = channels.length > 0 ? channels : (["in_app"] as NoticeChannel[]);
  const decisions: ChannelDecision[] = [];
  for (const r of recipients) {
    for (const c of requested) decisions.push(decideChannel(r, c));
  }
  const reasonCounts = new Map<string, number>();
  for (const d of decisions) {
    if (d.state === "withheld" && d.reason) {
      reasonCounts.set(d.reason, (reasonCounts.get(d.reason) ?? 0) + 1);
    }
  }
  return {
    decisions,
    queued: decisions.filter((d) => d.state === "queued").length,
    withheld: decisions.filter((d) => d.state === "withheld").length,
    reasons: [...reasonCounts.entries()]
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count),
  };
}

/* ------------------------------------------------------- notice lifecycle */

const NOTICE_TRANSITIONS: Record<NoticeState, NoticeState[]> = {
  draft: ["scheduled", "sending", "cancelled"],
  scheduled: ["sending", "draft", "cancelled"],
  sending: ["sent", "cancelled"],
  sent: [],
  cancelled: [],
};

export function canTransitionNotice(from: NoticeState, to: NoticeState): boolean {
  return (NOTICE_TRANSITIONS[from] ?? []).includes(to);
}

export function nextNoticeStates(from: NoticeState): NoticeState[] {
  return NOTICE_TRANSITIONS[from] ?? [];
}

export interface NoticeReadiness {
  ready: boolean;
  blockers: string[];
}

/** A notice cannot be sent half-addressed; the audience must resolve. */
export function noticeReadiness(input: {
  title: string;
  body: string;
  audience: NoticeAudience;
  segmentId?: string | null;
  memberId?: string | null;
  channels: NoticeChannel[];
  recipientCount: number;
}): NoticeReadiness {
  const blockers: string[] = [];
  if (!input.title.trim()) blockers.push("Title is required");
  if (!input.body.trim()) blockers.push("Message body is required");
  if (input.audience === "segment" && !input.segmentId) blockers.push("Select a member segment");
  if (input.audience === "single_member" && !input.memberId) blockers.push("Select a member");
  if (input.recipientCount === 0) blockers.push("This audience resolves to no recipients");
  if (input.channels.length === 0) blockers.push("Select at least one channel");
  if (input.channels.every((c) => !channelEnabled(c))) {
    blockers.push("Every selected channel is disabled — include the in-app channel");
  }
  return { ready: blockers.length === 0, blockers };
}

export interface DeliverySummary {
  total: number;
  delivered: number;
  withheld: number;
  failed: number;
  queued: number;
  read: number;
  reachRate: number;
}

export function summarizeDeliveries(
  rows: Array<{ state: DeliveryState; read_at?: string | null }>,
): DeliverySummary {
  const count = (s: DeliveryState) => rows.filter((r) => r.state === s).length;
  const delivered = count("delivered");
  return {
    total: rows.length,
    delivered,
    withheld: count("withheld"),
    failed: count("failed"),
    queued: count("queued"),
    read: rows.filter((r) => Boolean(r.read_at)).length,
    reachRate: rows.length === 0 ? 0 : Math.round((delivered / rows.length) * 100),
  };
}

/* --------------------------------------------------------- task lifecycle */

const TASK_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  open: ["in_progress", "blocked", "done", "cancelled"],
  in_progress: ["blocked", "done", "open", "cancelled"],
  blocked: ["in_progress", "open", "cancelled"],
  done: ["open"],
  cancelled: ["open"],
};

export function canTransitionTask(from: TaskStatus, to: TaskStatus): boolean {
  return (TASK_TRANSITIONS[from] ?? []).includes(to);
}

export function nextTaskStatuses(from: TaskStatus): TaskStatus[] {
  return TASK_TRANSITIONS[from] ?? [];
}

export function isTaskOpen(status: TaskStatus): boolean {
  return status === "open" || status === "in_progress" || status === "blocked";
}

export interface TaskLike {
  id: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date?: string | null;
}

export function taskOverdue(task: TaskLike, today = new Date()): boolean {
  if (!isTaskOpen(task.status) || !task.due_date) return false;
  return task.due_date < today.toISOString().slice(0, 10);
}

export function taskDueSoon(task: TaskLike, withinDays = 7, today = new Date()): boolean {
  if (!isTaskOpen(task.status) || !task.due_date) return false;
  const limit = new Date(today.getTime() + withinDays * 86400000).toISOString().slice(0, 10);
  const iso = today.toISOString().slice(0, 10);
  return task.due_date >= iso && task.due_date <= limit;
}

/** Deterministic queue order: overdue first, then priority, then due date. */
export function sortTaskQueue<T extends TaskLike>(tasks: T[], today = new Date()): T[] {
  return [...tasks].sort((a, b) => {
    const oa = taskOverdue(a, today) ? 0 : 1;
    const ob = taskOverdue(b, today) ? 0 : 1;
    if (oa !== ob) return oa - ob;
    const pa = PRIORITY_WEIGHT[a.priority];
    const pb = PRIORITY_WEIGHT[b.priority];
    if (pa !== pb) return pa - pb;
    const da = a.due_date ?? "9999-12-31";
    const db = b.due_date ?? "9999-12-31";
    return da < db ? -1 : da > db ? 1 : 0;
  });
}

export interface TaskSummary {
  total: number;
  open: number;
  overdue: number;
  dueSoon: number;
  done: number;
  urgent: number;
  byStatus: Array<{ status: TaskStatus; count: number }>;
}

export function summarizeTasks(tasks: TaskLike[], today = new Date()): TaskSummary {
  return {
    total: tasks.length,
    open: tasks.filter((t) => isTaskOpen(t.status)).length,
    overdue: tasks.filter((t) => taskOverdue(t, today)).length,
    dueSoon: tasks.filter((t) => taskDueSoon(t, 7, today)).length,
    done: tasks.filter((t) => t.status === "done").length,
    urgent: tasks.filter((t) => isTaskOpen(t.status) && t.priority === "urgent").length,
    byStatus: TASK_STATUSES.map((status) => ({
      status,
      count: tasks.filter((t) => t.status === status).length,
    })),
  };
}
