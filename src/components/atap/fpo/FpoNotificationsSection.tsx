import { useLanguage } from "@/components/atap/LanguageProvider";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { StateBadge } from "@/components/atap/StatusBadge";
import {
  createNotice,
  getNotificationsBoard,
  previewNoticeAudience,
  sendNotice,
  setNoticeState,
} from "@/lib/atap/fpoNotifications.functions";
import {
  channelEnabled,
  DELIVERY_STATE_LABEL,
  NOTICE_AUDIENCE_LABEL,
  NOTICE_AUDIENCES,
  NOTICE_CATEGORIES,
  NOTICE_CATEGORY_LABEL,
  NOTICE_CHANNEL_LABEL,
  NOTICE_CHANNELS,
  NOTICE_STATE_LABEL,
  nextNoticeStates,
  type NoticeAudience,
  type NoticeCategory,
  type NoticeChannel,
} from "@/lib/atap/fpoNotifications";

const input =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground";
const card = "rounded-lg border border-border bg-card p-4";

export function FpoNotificationsSection({ tenantId }: { tenantId: string }) {
  const { t } = useLanguage();
  const qc = useQueryClient();
  const boardFn = useServerFn(getNotificationsBoard);
  const createFn = useServerFn(createNotice);
  const sendFn = useServerFn(sendNotice);
  const stateFn = useServerFn(setNoticeState);
  const previewFn = useServerFn(previewNoticeAudience);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<NoticeCategory>("general");
  const [audience, setAudience] = useState<NoticeAudience>("all_members");
  const [segmentId, setSegmentId] = useState("");
  const [memberId, setMemberId] = useState("");
  const [channels, setChannels] = useState<NoticeChannel[]>(["in_app"]);
  const [scheduledFor, setScheduledFor] = useState("");
  const [openNotice, setOpenNotice] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

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

  const create = useAction(createFn, "Notification drafted");
  const changeState = useAction(stateFn, "Notification updated");
  const send = useMutation({
    mutationFn: (payload: { tenantId: string; noticeId: string }) => sendFn({ data: payload }),
    onSuccess: async (res) => {
      toast.success(`Delivered to ${res.queued} recipient(s), ${res.withheld} withheld`);
      await refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const data = board.data;

  if (board.isLoading) return <p className="text-sm text-muted-foreground">{t("fpo.ui.33ce417454")}</p>;
  if (!data) return <p className="text-sm text-muted-foreground">{t("fpo.ui.d83002e658")}</p>;

  const toggleChannel = (c: NoticeChannel) =>
    setChannels((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));

  return (
    <div className="space-y-6">
      <p className="rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
        {data.noticeDisclaimer}
      </p>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Notifications", value: data.notices.length },
          { label: "Delivered", value: data.deliverySummary.delivered },
          { label: "Withheld", value: data.deliverySummary.withheld },
          { label: "Reachable members", value: data.reachableMembers },
        ].map((m) => (
          <div key={m.label} className={card}>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{m.label}</p>
            <p className="mt-1 text-2xl font-bold">{m.value}</p>
          </div>
        ))}
      </section>

      {data.canSend ? (
        <section className={`${card} space-y-3`}>
          <h3 className="font-display text-base font-semibold">{t("fpo.ui.e2bafc078c")}</h3>
          <input
            className={input}
            placeholder={t("fpo.ui.768e0c1c69")}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <textarea
            className={`${input} min-h-24`}
            placeholder={t("fpo.ui.0e8c8a009d")}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <div className="grid gap-3 sm:grid-cols-3">
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
              value={audience}
              onChange={(e) => setAudience(e.target.value as NoticeAudience)}
            >
              {NOTICE_AUDIENCES.map((a) => (
                <option key={a} value={a}>
                  {NOTICE_AUDIENCE_LABEL[a]}
                </option>
              ))}
            </select>
            <input
              className={input}
              type="datetime-local"
              value={scheduledFor}
              onChange={(e) => setScheduledFor(e.target.value)}
            />
          </div>

          {audience === "segment" ? (
            <select
              className={input}
              value={segmentId}
              onChange={(e) => setSegmentId(e.target.value)}
            >
              <option value="">{t("fpo.ui.8889a3b7e8")}</option>
              {data.segmentOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          ) : null}

          {audience === "single_member" ? (
            <select
              className={input}
              value={memberId}
              onChange={(e) => setMemberId(e.target.value)}
            >
              <option value="">{t("fpo.ui.6d593674c4")}</option>
              {data.memberOptions.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.display_name}
                </option>
              ))}
            </select>
          ) : null}

          <div className="flex flex-wrap gap-3 text-sm">
            {NOTICE_CHANNELS.map((c) => (
              <label key={c} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={channels.includes(c)}
                  onChange={() => toggleChannel(c)}
                />
                <span className={channelEnabled(c) ? "" : "text-muted-foreground"}>
                  {NOTICE_CHANNEL_LABEL[c]}
                  {channelEnabled(c) ? "" : " (disabled)"}
                </span>
              </label>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() =>
                create.mutate({
                  tenantId,
                  title,
                  body,
                  category,
                  audience,
                  segmentId: segmentId || null,
                  memberId: memberId || null,
                  channels,
                  scheduledFor: scheduledFor ? new Date(scheduledFor).toISOString() : null,
                })
              }
              disabled={create.isPending}
            >
              {t("fpo.ui.fdb22e43fa")}</Button>
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  const res = await previewFn({
                    data: {
                      tenantId,
                      audience,
                      segmentId: segmentId || null,
                      memberId: memberId || null,
                      channels,
                    },
                  });
                  setPreview(
                    `${res.recipients} recipient(s) · ${res.queued} reachable · ${res.withheld} withheld${
                      res.reasons.length
                        ? ` — ${res.reasons.map((r) => `${r.reason} (${r.count})`).join("; ")}`
                        : ""
                    }`,
                  );
                } catch (e) {
                  toast.error((e as Error).message);
                }
              }}
            >
              {t("fpo.ui.7e1b1e9554")}</Button>
          </div>
          {preview ? <p className="text-sm">{preview}</p> : null}
        </section>
      ) : (
        <p className="text-sm text-muted-foreground">
          {t("fpo.ui.d9c0ae1de1")}</p>
      )}

      <section className="space-y-3">
        <h3 className="font-display text-base font-semibold">{t("fpo.ui.a83322af74")}</h3>
        {data.notices.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("fpo.ui.6fa60471c5")}</p>
        ) : (
          data.notices.map((n) => {
            const rows = data.deliveries.filter((d) => d.notification_id === n.id);
            return (
              <div key={n.id} className={`${card} space-y-2`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{n.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {NOTICE_CATEGORY_LABEL[n.category]} ·{" "}
                      {n.audience === "segment" && n.segment_name
                        ? `Segment: ${n.segment_name}`
                        : NOTICE_AUDIENCE_LABEL[n.audience]}{" "}
                      · {n.requested_channels.map((c) => NOTICE_CHANNEL_LABEL[c]).join(", ")}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StateBadge state={n.state} />
                    <span className="text-xs text-muted-foreground">
                      {NOTICE_STATE_LABEL[n.state]} · {n.recipient_count} {t("fpo.ui.46c828bb20")}{" "}
                      {n.withheld_count} {t("fpo.ui.7b2121e505")}</span>
                  </div>
                </div>
                <p className="text-sm">{n.body}</p>
                {data.canSend ? (
                  <div className="flex flex-wrap gap-2">
                    {n.state === "draft" || n.state === "scheduled" ? (
                      <Button
                        size="sm"
                        onClick={() => send.mutate({ tenantId, noticeId: n.id })}
                        disabled={send.isPending}
                      >
                        {t("fpo.ui.dae3301014")}</Button>
                    ) : null}
                    {nextNoticeStates(n.state)
                      .filter((s) => s === "cancelled" || s === "draft" || s === "scheduled")
                      .map((s) => (
                        <Button
                          key={s}
                          size="sm"
                          variant="outline"
                          onClick={() => changeState.mutate({ tenantId, noticeId: n.id, state: s })}
                        >
                          {NOTICE_STATE_LABEL[s]}
                        </Button>
                      ))}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setOpenNotice(openNotice === n.id ? null : n.id)}
                    >
                      {openNotice === n.id ? "Hide delivery log" : `Delivery log (${rows.length})`}
                    </Button>
                  </div>
                ) : null}
                {openNotice === n.id && rows.length > 0 ? (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>{t("fpo.ui.9034326017")}</th>
                        <th>{t("fpo.ui.879f0b1bef")}</th>
                        <th>{t("fpo.ui.5faa59d4bc")}</th>
                        <th>{t("fpo.ui.f219cc0614")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((d) => (
                        <tr key={d.id}>
                          <td>{d.recipient_label}</td>
                          <td>{NOTICE_CHANNEL_LABEL[d.channel]}</td>
                          <td>{DELIVERY_STATE_LABEL[d.state]}</td>
                          <td className="text-muted-foreground">{d.withheld_reason ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : null}
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}
