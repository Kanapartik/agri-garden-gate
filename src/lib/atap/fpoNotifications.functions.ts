/**
 * FPO Management & Operations workspace — Phase 8 server functions.
 *
 * Reads are tenant-scoped and default-deny. Composing or sending member
 * communication requires FPO admin authority; any FPO staff role may work the
 * task queue. Outbound personal channels are never dispatched: the requested
 * channel is recorded and withheld with an explicit reason unless the channel
 * is enabled AND the farmer holds an active member-management authorization.
 * Every send, task mutation and comment is audited.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  canManageTasks,
  canSendNotifications,
  canTransitionNotice,
  canTransitionTask,
  canViewNotifications,
  canWorkTasks,
  NOTIFICATIONS_DISCLAIMER,
  noticeReadiness,
  planDispatch,
  sortTaskQueue,
  summarizeDeliveries,
  summarizeTasks,
  TASKS_DISCLAIMER,
  type DeliveryState,
  type NoticeAudience,
  type NoticeCategory,
  type NoticeChannel,
  type NoticeState,
  type RecipientLike,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/atap/fpoNotifications";
import { applyFilters, type MemberRow, type SegmentFilters } from "@/lib/atap/fpoMembers";
import type { AppRole } from "@/lib/atap/policy";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type AuthedClient = SupabaseClient<Database>;

const MEMBER_CONSENT_PURPOSE = "fpo_member_management";

export interface NoticeRow {
  id: string;
  title: string;
  body: string;
  category: NoticeCategory;
  audience: NoticeAudience;
  segment_id: string | null;
  segment_name: string | null;
  member_id: string | null;
  language_code: string;
  requested_channels: NoticeChannel[];
  state: NoticeState;
  scheduled_for: string | null;
  sent_at: string | null;
  recipient_count: number;
  withheld_count: number;
  created_at: string;
}

export interface DeliveryRow {
  id: string;
  notification_id: string;
  recipient_label: string;
  channel: NoticeChannel;
  state: DeliveryState;
  withheld_reason: string | null;
  read_at: string | null;
}

export interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  category: NoticeCategory;
  priority: TaskPriority;
  status: TaskStatus;
  due_date: string | null;
  assignee_label: string | null;
  member_id: string | null;
  member_name: string | null;
  completed_at: string | null;
  updated_at: string;
}

export interface TaskCommentRow {
  id: string;
  task_id: string;
  body: string;
  created_at: string;
}

export interface NotificationsBoard {
  tenantId: string;
  roles: AppRole[];
  canSend: boolean;
  canManageTasks: boolean;
  canWorkTasks: boolean;
  notices: NoticeRow[];
  deliveries: DeliveryRow[];
  deliverySummary: ReturnType<typeof summarizeDeliveries>;
  tasks: TaskRow[];
  taskSummary: ReturnType<typeof summarizeTasks>;
  comments: TaskCommentRow[];
  memberOptions: Array<{ id: string; display_name: string }>;
  segmentOptions: Array<{ id: string; name: string }>;
  reachableMembers: number;
  noticeDisclaimer: string;
  taskDisclaimer: string;
}

const NOTICE_COLUMNS =
  "id, title, body, category, audience, segment_id, member_id, language_code, requested_channels, state, scheduled_for, sent_at, recipient_count, withheld_count, created_at";
const TASK_COLUMNS =
  "id, title, description, category, priority, status, due_date, assignee_label, member_id, completed_at, updated_at";

/* -------------------------------------------------------------- internals */

async function tenantScope(supabase: AuthedClient, userId: string, tenantId: string) {
  const { resolveDistrictActor } = await import("@/lib/atap/district.server");
  const actor = await resolveDistrictActor(supabase, userId);
  const permitted = actor.isPlatformAdmin || actor.isAuditor || actor.tenantIds.includes(tenantId);
  if (!permitted) throw new Error("You do not have access to this organization");
  const roles = actor.tenantRoles
    .filter((r: { tenant_id: string | null }) => r.tenant_id === tenantId)
    .map((r: { role: AppRole }) => r.role) as AppRole[];
  const effective: AppRole[] = actor.isPlatformAdmin ? [...roles, "platform_admin"] : roles;
  if (actor.isAuditor && !effective.includes("auditor")) effective.push("auditor");
  return { actor, roles: effective };
}

async function logAudit(
  supabase: AuthedClient,
  input: {
    userId: string;
    tenantId: string;
    action: string;
    subjectType: string;
    subjectId: string;
    metadata?: Record<string, unknown>;
  },
) {
  const { audit } = await import("@/lib/atap/admin.server");
  await audit(supabase, {
    actor_user_id: input.userId,
    tenant_id: input.tenantId,
    action: input.action,
    subject_type: input.subjectType,
    subject_id: input.subjectId,
    decision: "allow",
    metadata: input.metadata ?? {},
  });
}

/** Roster rows plus the consent and contact facts a channel decision needs. */
async function loadRecipientPool(supabase: AuthedClient, tenantId: string) {
  const [memberRes, tagRes, consentRes] = await Promise.all([
    supabase
      .from("fpo_members")
      .select(
        "id, member_ref, membership_number, display_name, status, member_type, village_code, village_cluster, crops, acreage, farmer_user_id, contact_hint",
      )
      .eq("tenant_id", tenantId)
      .limit(1000),
    supabase
      .from("fpo_member_tag_assignments")
      .select("member_id, fpo_member_tags(code)")
      .eq("tenant_id", tenantId)
      .limit(2000),
    supabase
      .from("fpo_farmer_consents")
      .select("farmer_user_id, purpose_code, expires_at, revoked_at")
      .eq("tenant_id", tenantId)
      .is("revoked_at", null)
      .limit(2000),
  ]);

  const tagsByMember = new Map<string, string[]>();
  for (const row of (tagRes.data ?? []) as Array<{
    member_id: string;
    fpo_member_tags: { code: string } | null;
  }>) {
    if (!row.fpo_member_tags) continue;
    const list = tagsByMember.get(row.member_id) ?? [];
    list.push(row.fpo_member_tags.code);
    tagsByMember.set(row.member_id, list);
  }

  const now = Date.now();
  const purposesByFarmer = new Map<string, string[]>();
  for (const c of (consentRes.data ?? []) as Array<{
    farmer_user_id: string;
    purpose_code: string;
    expires_at: string | null;
  }>) {
    if (c.expires_at && new Date(c.expires_at).getTime() <= now) continue;
    const list = purposesByFarmer.get(c.farmer_user_id) ?? [];
    list.push(c.purpose_code);
    purposesByFarmer.set(c.farmer_user_id, list);
  }

  const raw = (memberRes.data ?? []) as Array<Record<string, unknown>>;
  return raw.map((m) => {
    const farmerId = (m["farmer_user_id"] as string | null) ?? null;
    const purposes = farmerId ? (purposesByFarmer.get(farmerId) ?? []) : [];
    const row: MemberRow & { contactHint: string | null } = {
      id: m["id"] as string,
      member_ref: m["member_ref"] as string,
      membership_number: (m["membership_number"] as string | null) ?? null,
      display_name: m["display_name"] as string,
      status: m["status"] as MemberRow["status"],
      member_type: (m["member_type"] as string | null) ?? null,
      village_code: (m["village_code"] as string | null) ?? null,
      village_cluster: (m["village_cluster"] as string | null) ?? null,
      crops: (m["crops"] as string[] | null) ?? [],
      acreage: m["acreage"] === null ? null : Number(m["acreage"]),
      farmer_user_id: farmerId,
      tagCodes: tagsByMember.get(m["id"] as string) ?? [],
      consentPurposes: purposes,
      contactHint: (m["contact_hint"] as string | null) ?? null,
    };
    return row;
  });
}

function toRecipient(m: MemberRow & { contactHint: string | null }): RecipientLike {
  return {
    memberId: m.id,
    label: m.display_name,
    hasMemberConsent: (m.consentPurposes ?? []).includes(MEMBER_CONSENT_PURPOSE),
    hasContact: Boolean(m.contactHint),
  };
}

async function resolveAudience(
  supabase: AuthedClient,
  tenantId: string,
  audience: NoticeAudience,
  segmentId: string | null,
  memberId: string | null,
): Promise<RecipientLike[]> {
  if (audience === "staff") return [];
  const pool = (await loadRecipientPool(supabase, tenantId)).filter((m) => m.status === "active");
  if (audience === "single_member") {
    return pool.filter((m) => m.id === memberId).map(toRecipient);
  }
  if (audience === "segment") {
    if (!segmentId) return [];
    const { data } = await supabase
      .from("fpo_member_segments")
      .select("id, filters")
      .eq("tenant_id", tenantId)
      .eq("id", segmentId)
      .maybeSingle();
    if (!data) throw new Error("Member segment not found");
    const filters = ((data as { filters: unknown }).filters ?? {}) as SegmentFilters;
    return applyFilters(pool, filters)
      .map((m) => pool.find((p) => p.id === m.id))
      .filter((m): m is (typeof pool)[number] => Boolean(m))
      .map(toRecipient);
  }
  return pool.map(toRecipient);
}

/* ------------------------------------------------------------- board read */

export const getNotificationsBoard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string }) => input)
  .handler(async ({ data, context }): Promise<NotificationsBoard> => {
    const { supabase, userId } = context;
    const { roles } = await tenantScope(supabase, userId, data.tenantId);
    if (!canViewNotifications(roles)) {
      throw new Error("You are not permitted to view this organization's communication records");
    }

    const [noticeRes, deliveryRes, taskRes, commentRes, memberRes, segmentRes] = await Promise.all([
      supabase
        .from("fpo_notifications")
        .select(`${NOTICE_COLUMNS}, fpo_member_segments(name)`)
        .eq("tenant_id", data.tenantId)
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("fpo_notification_deliveries")
        .select("id, notification_id, recipient_label, channel, state, withheld_reason, read_at")
        .eq("tenant_id", data.tenantId)
        .order("created_at", { ascending: false })
        .limit(1000),
      supabase
        .from("fpo_tasks")
        .select(`${TASK_COLUMNS}, fpo_members(display_name)`)
        .eq("tenant_id", data.tenantId)
        .order("created_at", { ascending: false })
        .limit(300),
      supabase
        .from("fpo_task_comments")
        .select("id, task_id, body, created_at")
        .eq("tenant_id", data.tenantId)
        .order("created_at", { ascending: true })
        .limit(500),
      supabase
        .from("fpo_members")
        .select("id, display_name")
        .eq("tenant_id", data.tenantId)
        .eq("status", "active")
        .order("display_name")
        .limit(500),
      supabase
        .from("fpo_member_segments")
        .select("id, name")
        .eq("tenant_id", data.tenantId)
        .order("name")
        .limit(100),
    ]);

    const notices: NoticeRow[] = (
      (noticeRes.data ?? []) as Array<
        Record<string, unknown> & { fpo_member_segments: { name: string } | null }
      >
    ).map((r) => ({
      id: r["id"] as string,
      title: r["title"] as string,
      body: r["body"] as string,
      category: r["category"] as NoticeCategory,
      audience: r["audience"] as NoticeAudience,
      segment_id: (r["segment_id"] as string | null) ?? null,
      segment_name: r.fpo_member_segments?.name ?? null,
      member_id: (r["member_id"] as string | null) ?? null,
      language_code: r["language_code"] as string,
      requested_channels: (r["requested_channels"] as NoticeChannel[] | null) ?? ["in_app"],
      state: r["state"] as NoticeState,
      scheduled_for: (r["scheduled_for"] as string | null) ?? null,
      sent_at: (r["sent_at"] as string | null) ?? null,
      recipient_count: Number(r["recipient_count"] ?? 0),
      withheld_count: Number(r["withheld_count"] ?? 0),
      created_at: r["created_at"] as string,
    }));

    const deliveries = ((deliveryRes.data ?? []) as Array<Record<string, unknown>>).map((r) => ({
      id: r["id"] as string,
      notification_id: r["notification_id"] as string,
      recipient_label: r["recipient_label"] as string,
      channel: r["channel"] as NoticeChannel,
      state: r["state"] as DeliveryState,
      withheld_reason: (r["withheld_reason"] as string | null) ?? null,
      read_at: (r["read_at"] as string | null) ?? null,
    }));

    const tasks: TaskRow[] = sortTaskQueue(
      (
        (taskRes.data ?? []) as Array<
          Record<string, unknown> & { fpo_members: { display_name: string } | null }
        >
      ).map((r) => ({
        id: r["id"] as string,
        title: r["title"] as string,
        description: (r["description"] as string | null) ?? null,
        category: r["category"] as NoticeCategory,
        priority: r["priority"] as TaskPriority,
        status: r["status"] as TaskStatus,
        due_date: (r["due_date"] as string | null) ?? null,
        assignee_label: (r["assignee_label"] as string | null) ?? null,
        member_id: (r["member_id"] as string | null) ?? null,
        member_name: r.fpo_members?.display_name ?? null,
        completed_at: (r["completed_at"] as string | null) ?? null,
        updated_at: r["updated_at"] as string,
      })),
    );

    const memberOptions = ((memberRes.data ?? []) as Array<{ id: string; display_name: string }>)
      .map((m) => ({ id: m.id, display_name: m.display_name }));

    return {
      tenantId: data.tenantId,
      roles,
      canSend: canSendNotifications(roles),
      canManageTasks: canManageTasks(roles),
      canWorkTasks: canWorkTasks(roles),
      notices,
      deliveries,
      deliverySummary: summarizeDeliveries(deliveries),
      tasks,
      taskSummary: summarizeTasks(tasks),
      comments: (commentRes.data ?? []) as TaskCommentRow[],
      memberOptions,
      segmentOptions: (segmentRes.data ?? []) as Array<{ id: string; name: string }>,
      reachableMembers: memberOptions.length,
      noticeDisclaimer: NOTIFICATIONS_DISCLAIMER,
      taskDisclaimer: TASKS_DISCLAIMER,
    };
  });

/** Previews exactly who would be reached and who would be withheld, and why. */
export const previewNoticeAudience = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      tenantId: string;
      audience: NoticeAudience;
      segmentId?: string | null;
      memberId?: string | null;
      channels: NoticeChannel[];
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { roles } = await tenantScope(supabase, userId, data.tenantId);
    if (!canSendNotifications(roles)) {
      throw new Error("Only an FPO admin can compose member communication");
    }
    const recipients = await resolveAudience(
      supabase,
      data.tenantId,
      data.audience,
      data.segmentId ?? null,
      data.memberId ?? null,
    );
    const plan = planDispatch(recipients, data.channels);
    return {
      recipients: recipients.length,
      queued: plan.queued,
      withheld: plan.withheld,
      reasons: plan.reasons,
    };
  });

/* -------------------------------------------------------------- notices */

export const createNotice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      tenantId: string;
      title: string;
      body: string;
      category: NoticeCategory;
      audience: NoticeAudience;
      segmentId?: string | null;
      memberId?: string | null;
      languageCode?: string;
      channels: NoticeChannel[];
      scheduledFor?: string | null;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { roles } = await tenantScope(supabase, userId, data.tenantId);
    if (!canSendNotifications(roles)) {
      throw new Error("Only an FPO admin can compose member communication");
    }

    const recipients = await resolveAudience(
      supabase,
      data.tenantId,
      data.audience,
      data.segmentId ?? null,
      data.memberId ?? null,
    );
    const readiness = noticeReadiness({
      title: data.title,
      body: data.body,
      audience: data.audience,
      segmentId: data.segmentId ?? null,
      memberId: data.memberId ?? null,
      channels: data.channels,
      recipientCount: data.audience === "staff" ? 1 : recipients.length,
    });
    if (!readiness.ready) throw new Error(readiness.blockers.join("; "));

    const { data: row, error } = await supabase
      .from("fpo_notifications")
      .insert({
        tenant_id: data.tenantId,
        title: data.title.trim(),
        body: data.body.trim(),
        category: data.category,
        audience: data.audience,
        segment_id: data.segmentId ?? null,
        member_id: data.memberId ?? null,
        language_code: data.languageCode ?? "en",
        requested_channels: data.channels,
        state: data.scheduledFor ? "scheduled" : "draft",
        scheduled_for: data.scheduledFor ?? null,
        created_by_user_id: userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await logAudit(supabase, {
      userId,
      tenantId: data.tenantId,
      action: "fpo.notice.created",
      subjectType: "fpo_notification",
      subjectId: (row as { id: string }).id,
      metadata: {
        audience: data.audience,
        channels: data.channels,
        recipients: recipients.length,
        scheduled: Boolean(data.scheduledFor),
      },
    });
    return { id: (row as { id: string }).id };
  });

/**
 * Materialises the delivery log. In-app rows are queued and marked delivered;
 * every disabled or unconsented channel is written as withheld with a reason.
 */
export const sendNotice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string; noticeId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { roles } = await tenantScope(supabase, userId, data.tenantId);
    if (!canSendNotifications(roles)) {
      throw new Error("Only an FPO admin can send member communication");
    }

    const { data: notice } = await supabase
      .from("fpo_notifications")
      .select(NOTICE_COLUMNS)
      .eq("tenant_id", data.tenantId)
      .eq("id", data.noticeId)
      .maybeSingle();
    if (!notice) throw new Error("Notification not found");
    const n = notice as unknown as Record<string, unknown>;
    const state = n["state"] as NoticeState;
    if (!canTransitionNotice(state, "sending")) {
      throw new Error(`A ${state} notification cannot be sent`);
    }

    const audience = n["audience"] as NoticeAudience;
    const channels = (n["requested_channels"] as NoticeChannel[] | null) ?? ["in_app"];
    const recipients = await resolveAudience(
      supabase,
      data.tenantId,
      audience,
      (n["segment_id"] as string | null) ?? null,
      (n["member_id"] as string | null) ?? null,
    );
    const plan = planDispatch(recipients, channels);
    if (plan.decisions.length === 0) throw new Error("This audience resolves to no recipients");

    await supabase
      .from("fpo_notification_deliveries")
      .delete()
      .eq("tenant_id", data.tenantId)
      .eq("notification_id", data.noticeId);

    const rows = plan.decisions.map((d) => ({
      notification_id: data.noticeId,
      tenant_id: data.tenantId,
      member_id: d.memberId,
      recipient_label: d.label,
      channel: d.channel,
      state: d.state === "queued" && d.channel === "in_app" ? "delivered" : d.state,
      withheld_reason: d.reason,
    }));
    const { error: deliveryError } = await supabase
      .from("fpo_notification_deliveries")
      .insert(rows);
    if (deliveryError) throw new Error(deliveryError.message);

    const { error } = await supabase
      .from("fpo_notifications")
      .update({
        state: "sent",
        sent_at: new Date().toISOString(),
        recipient_count: plan.queued,
        withheld_count: plan.withheld,
      })
      .eq("tenant_id", data.tenantId)
      .eq("id", data.noticeId);
    if (error) throw new Error(error.message);

    await logAudit(supabase, {
      userId,
      tenantId: data.tenantId,
      action: "fpo.notice.sent",
      subjectType: "fpo_notification",
      subjectId: data.noticeId,
      metadata: { queued: plan.queued, withheld: plan.withheld, reasons: plan.reasons },
    });
    return { queued: plan.queued, withheld: plan.withheld, reasons: plan.reasons };
  });

export const setNoticeState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string; noticeId: string; state: NoticeState }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { roles } = await tenantScope(supabase, userId, data.tenantId);
    if (!canSendNotifications(roles)) {
      throw new Error("Only an FPO admin can change a notification");
    }
    const { data: notice } = await supabase
      .from("fpo_notifications")
      .select("id, state")
      .eq("tenant_id", data.tenantId)
      .eq("id", data.noticeId)
      .maybeSingle();
    if (!notice) throw new Error("Notification not found");
    const from = (notice as { state: NoticeState }).state;
    if (!canTransitionNotice(from, data.state)) {
      throw new Error(`Cannot move a ${from} notification to ${data.state}`);
    }
    const { error } = await supabase
      .from("fpo_notifications")
      .update({ state: data.state })
      .eq("tenant_id", data.tenantId)
      .eq("id", data.noticeId);
    if (error) throw new Error(error.message);
    await logAudit(supabase, {
      userId,
      tenantId: data.tenantId,
      action: "fpo.notice.state_changed",
      subjectType: "fpo_notification",
      subjectId: data.noticeId,
      metadata: { from, to: data.state },
    });
    return { ok: true };
  });

/* ---------------------------------------------------------------- tasks */

export const createTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      tenantId: string;
      title: string;
      description?: string;
      category: NoticeCategory;
      priority: TaskPriority;
      dueDate?: string | null;
      assigneeLabel?: string;
      memberId?: string | null;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { roles } = await tenantScope(supabase, userId, data.tenantId);
    if (!canManageTasks(roles)) throw new Error("Only an FPO admin can create tasks");
    if (!data.title.trim()) throw new Error("Task title is required");

    const { data: row, error } = await supabase
      .from("fpo_tasks")
      .insert({
        tenant_id: data.tenantId,
        title: data.title.trim(),
        description: data.description?.trim() || null,
        category: data.category,
        priority: data.priority,
        due_date: data.dueDate || null,
        assignee_label: data.assigneeLabel?.trim() || null,
        member_id: data.memberId || null,
        created_by_user_id: userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await logAudit(supabase, {
      userId,
      tenantId: data.tenantId,
      action: "fpo.task.created",
      subjectType: "fpo_task",
      subjectId: (row as { id: string }).id,
      metadata: { priority: data.priority, category: data.category },
    });
    return { id: (row as { id: string }).id };
  });

export const setTaskStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string; taskId: string; status: TaskStatus }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { roles } = await tenantScope(supabase, userId, data.tenantId);
    if (!canWorkTasks(roles)) throw new Error("You are not permitted to work this task queue");
    if (data.status === "cancelled" && !canManageTasks(roles)) {
      throw new Error("Only an FPO admin can cancel a task");
    }

    const { data: task } = await supabase
      .from("fpo_tasks")
      .select("id, status")
      .eq("tenant_id", data.tenantId)
      .eq("id", data.taskId)
      .maybeSingle();
    if (!task) throw new Error("Task not found");
    const from = (task as { status: TaskStatus }).status;
    if (!canTransitionTask(from, data.status)) {
      throw new Error(`Cannot move a ${from} task to ${data.status}`);
    }

    const { error } = await supabase
      .from("fpo_tasks")
      .update({
        status: data.status,
        completed_at: data.status === "done" ? new Date().toISOString() : null,
      })
      .eq("tenant_id", data.tenantId)
      .eq("id", data.taskId);
    if (error) throw new Error(error.message);

    await logAudit(supabase, {
      userId,
      tenantId: data.tenantId,
      action: "fpo.task.status_changed",
      subjectType: "fpo_task",
      subjectId: data.taskId,
      metadata: { from, to: data.status },
    });
    return { ok: true };
  });

export const assignTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      tenantId: string;
      taskId: string;
      assigneeLabel: string;
      priority?: TaskPriority;
      dueDate?: string | null;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { roles } = await tenantScope(supabase, userId, data.tenantId);
    if (!canManageTasks(roles)) throw new Error("Only an FPO admin can assign tasks");

    const patch: { assignee_label: string; priority?: TaskPriority; due_date?: string | null } = {
      assignee_label: data.assigneeLabel.trim(),
    };
    if (data.priority) patch.priority = data.priority;
    if (data.dueDate !== undefined) patch.due_date = data.dueDate || null;

    const { error } = await supabase
      .from("fpo_tasks")
      .update(patch)
      .eq("tenant_id", data.tenantId)
      .eq("id", data.taskId);
    if (error) throw new Error(error.message);

    await logAudit(supabase, {
      userId,
      tenantId: data.tenantId,
      action: "fpo.task.assigned",
      subjectType: "fpo_task",
      subjectId: data.taskId,
      metadata: { assignee: patch.assignee_label, priority: data.priority ?? null },
    });
    return { ok: true };
  });

export const addTaskComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tenantId: string; taskId: string; body: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { roles } = await tenantScope(supabase, userId, data.tenantId);
    if (!canWorkTasks(roles)) throw new Error("You are not permitted to comment on this task");
    if (!data.body.trim()) throw new Error("Comment cannot be empty");

    const { error } = await supabase.from("fpo_task_comments").insert({
      task_id: data.taskId,
      tenant_id: data.tenantId,
      body: data.body.trim(),
      author_user_id: userId,
    });
    if (error) throw new Error(error.message);

    await logAudit(supabase, {
      userId,
      tenantId: data.tenantId,
      action: "fpo.task.commented",
      subjectType: "fpo_task",
      subjectId: data.taskId,
    });
    return { ok: true };
  });
