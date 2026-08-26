import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { StateBadge } from "@/components/atap/StatusBadge";
import {
  addTaskComment,
  assignTask,
  createTask,
  getNotificationsBoard,
  setTaskStatus,
} from "@/lib/atap/fpoNotifications.functions";
import {
  NOTICE_CATEGORIES,
  NOTICE_CATEGORY_LABEL,
  nextTaskStatuses,
  TASK_PRIORITIES,
  TASK_PRIORITY_LABEL,
  TASK_STATUS_LABEL,
  taskDueSoon,
  taskOverdue,
  type NoticeCategory,
  type TaskPriority,
} from "@/lib/atap/fpoNotifications";

const input =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground";
const card = "rounded-lg border border-border bg-card p-4";

export function FpoTasksSection({ tenantId }: { tenantId: string }) {
  const qc = useQueryClient();
  const boardFn = useServerFn(getNotificationsBoard);
  const createFn = useServerFn(createTask);
  const statusFn = useServerFn(setTaskStatus);
  const assignFn = useServerFn(assignTask);
  const commentFn = useServerFn(addTaskComment);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<NoticeCategory>("general");
  const [priority, setPriority] = useState<TaskPriority>("normal");
  const [dueDate, setDueDate] = useState("");
  const [assignee, setAssignee] = useState("");
  const [memberId, setMemberId] = useState("");
  const [openTask, setOpenTask] = useState<string | null>(null);
  const [comment, setComment] = useState("");

  const board = useQuery({
    queryKey: ["atap", "fpo-notifications", tenantId],
    queryFn: () => boardFn({ data: { tenantId } }),
    enabled: Boolean(tenantId),
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["atap", "fpo-notifications", tenantId] });

  const useAction = <T,>(fn: (args: { data: T }) => Promise<unknown>, message: string) =>
    useMutation({
      mutationFn: (payload: T) => fn({ data: payload }),
      onSuccess: async () => {
        toast.success(message);
        await refresh();
      },
      onError: (e: Error) => toast.error(e.message),
    });

  const create = useAction(createFn, "Task created");
  const status = useAction(statusFn, "Task updated");
  const assign = useAction(assignFn, "Task assigned");
  const addComment = useAction(commentFn, "Progress note added");

  if (board.isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  const data = board.data;
  if (!data) return <p className="text-sm text-muted-foreground">No tasks yet.</p>;

  return (
    <div className="space-y-6">
      <p className="rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
        {data.taskDisclaimer}
      </p>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Open", value: data.taskSummary.open },
          { label: "Overdue", value: data.taskSummary.overdue },
          { label: "Due in 7 days", value: data.taskSummary.dueSoon },
          { label: "Urgent", value: data.taskSummary.urgent },
        ].map((m) => (
          <div key={m.label} className={card}>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{m.label}</p>
            <p className="mt-1 text-2xl font-bold">{m.value}</p>
          </div>
        ))}
      </section>

      {data.canManageTasks ? (
        <section className={`${card} space-y-3`}>
          <h3 className="font-display text-base font-semibold">Create a task</h3>
          <input
            className={input}
            placeholder="Task title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <textarea
            className={`${input} min-h-20`}
            placeholder="What needs doing?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <div className="grid gap-3 sm:grid-cols-4">
            <select
              className={input}
              value={category}
              onChange={(e) => setCategory(e.target.value as NoticeCategory)}
            >
              {NOTICE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {NOTICE_CATEGORY_LABEL[c]}
                </option>
              ))}
            </select>
            <select
              className={input}
              value={priority}
              onChange={(e) => setPriority(e.target.value as TaskPriority)}
            >
              {TASK_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {TASK_PRIORITY_LABEL[p]}
                </option>
              ))}
            </select>
            <input
              className={input}
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
            <input
              className={input}
              placeholder="Assign to (name / role)"
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
            />
          </div>
          <select className={input} value={memberId} onChange={(e) => setMemberId(e.target.value)}>
            <option value="">No linked member</option>
            {data.memberOptions.map((m) => (
              <option key={m.id} value={m.id}>
                {m.display_name}
              </option>
            ))}
          </select>
          <Button
            onClick={() =>
              create.mutate({
                tenantId,
                title,
                description,
                category,
                priority,
                dueDate: dueDate || null,
                assigneeLabel: assignee,
                memberId: memberId || null,
              })
            }
            disabled={create.isPending}
          >
            Create task
          </Button>
        </section>
      ) : null}

      <section className="space-y-3">
        <h3 className="font-display text-base font-semibold">Task queue</h3>
        {data.tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tasks recorded.</p>
        ) : (
          data.tasks.map((t) => {
            const comments = data.comments.filter((c) => c.task_id === t.id);
            return (
              <div key={t.id} className={`${card} space-y-2`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{t.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {NOTICE_CATEGORY_LABEL[t.category]} · {TASK_PRIORITY_LABEL[t.priority]}
                      {t.assignee_label ? ` · ${t.assignee_label}` : ""}
                      {t.member_name ? ` · ${t.member_name}` : ""}
                      {t.due_date ? ` · due ${t.due_date}` : ""}
                      {taskOverdue(t) ? " · OVERDUE" : taskDueSoon(t) ? " · due soon" : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StateBadge state={t.status} />
                    <span className="text-xs text-muted-foreground">
                      {TASK_STATUS_LABEL[t.status]}
                    </span>
                  </div>
                </div>
                {t.description ? <p className="text-sm">{t.description}</p> : null}

                {data.canWorkTasks ? (
                  <div className="flex flex-wrap gap-2">
                    {nextTaskStatuses(t.status)
                      .filter((s) => s !== "cancelled" || data.canManageTasks)
                      .map((s) => (
                        <Button
                          key={s}
                          size="sm"
                          variant="outline"
                          onClick={() => status.mutate({ tenantId, taskId: t.id, status: s })}
                        >
                          {TASK_STATUS_LABEL[s]}
                        </Button>
                      ))}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setOpenTask(openTask === t.id ? null : t.id)}
                    >
                      {openTask === t.id ? "Hide notes" : `Notes (${comments.length})`}
                    </Button>
                  </div>
                ) : null}

                {openTask === t.id ? (
                  <div className="space-y-2 border-t border-border pt-2">
                    {comments.map((c) => (
                      <p key={c.id} className="text-sm">
                        <span className="text-xs text-muted-foreground">
                          {c.created_at.slice(0, 10)} —{" "}
                        </span>
                        {c.body}
                      </p>
                    ))}
                    {data.canWorkTasks ? (
                      <>
                        <textarea
                          className={`${input} min-h-16`}
                          placeholder="Progress note"
                          value={comment}
                          onChange={(e) => setComment(e.target.value)}
                        />
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            onClick={() => {
                              addComment.mutate({ tenantId, taskId: t.id, body: comment });
                              setComment("");
                            }}
                            disabled={!comment.trim()}
                          >
                            Add note
                          </Button>
                          {data.canManageTasks ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                assign.mutate({
                                  tenantId,
                                  taskId: t.id,
                                  assigneeLabel: assignee || t.assignee_label || "Unassigned",
                                })
                              }
                            >
                              Reassign to “{assignee || t.assignee_label || "Unassigned"}”
                            </Button>
                          ) : null}
                        </div>
                      </>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}
