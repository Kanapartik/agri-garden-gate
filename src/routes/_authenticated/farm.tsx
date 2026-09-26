import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/atap/AppShell";
import { StateBadge, StatusBadge } from "@/components/atap/StatusBadge";
import { ParcelCapture } from "@/components/atap/ParcelCapture";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/components/atap/LanguageProvider";
import {
  completeFirstValueAction,
  getFarmerWorkspace,
  runIdentityCheck,
  syncFarmDrafts,
} from "@/lib/atap/farmer.functions";
import {
  identityBlocksProgress,
  isAssistedChannel,
  validateBoundary,
  type BoundaryPoint,
  type LocalFarmDraft,
  type OnboardingChannel,
} from "@/lib/atap/farmer";
import { newDraftId, readDrafts, removeDrafts, upsertDraft } from "@/lib/atap/offlineDrafts";

export const Route = createFileRoute("/_authenticated/farm")({
  head: () => ({
    meta: [
      { title: "Farm & parcel capture — AgriGhar ATAP" },
      {
        name: "description",
        content:
          "Capture synthetic farm parcels offline, verify identity through a mocked jurisdiction adapter and sync drafts without creating duplicates.",
      },
      { property: "og:title", content: "Farm & parcel capture — AgriGhar ATAP" },
      {
        property: "og:description",
        content: "Offline-safe parcel capture with assisted mode and audited identity checks.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FarmPage,
});

const TELANGANA_CENTER: BoundaryPoint = { lat: 17.385, lng: 78.4867 };

const CHANNEL_OPTIONS: OnboardingChannel[] = [
  "self_service",
  "fpo_assisted",
  "govt_camp_assisted",
  "field_agent_assisted",
];

interface DraftForm {
  clientDraftId: string;
  label: string;
  plotRef: string;
  villageCode: string;
  primaryCrop: string;
  irrigation: string;
  boundary: BoundaryPoint[];
}

function emptyForm(): DraftForm {
  return {
    clientDraftId: newDraftId(),
    label: "",
    plotRef: "",
    villageCode: "",
    primaryCrop: "",
    irrigation: "",
    boundary: [],
  };
}

function FarmPage() {
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  const chLabel = (c: string) => t(`farm.ch.${c}`);
  const fetchWorkspace = useServerFn(getFarmerWorkspace);
  const sync = useServerFn(syncFarmDrafts);
  const verify = useServerFn(runIdentityCheck);
  const firstValue = useServerFn(completeFirstValueAction);

  const [channel, setChannel] = useState<OnboardingChannel>("self_service");
  const [subjectUserId, setSubjectUserId] = useState("");
  const [reference, setReference] = useState("");
  const [form, setForm] = useState<DraftForm>(emptyForm);
  const [queue, setQueue] = useState<LocalFarmDraft[]>([]);
  const [online, setOnline] = useState(true);

  const workspace = useQuery({
    queryKey: ["atap", "farmer-workspace"],
    queryFn: () => fetchWorkspace(),
  });

  const queueOwner = subjectUserId || workspace.data?.userId || "self";

  useEffect(() => {
    setQueue(readDrafts(queueOwner));
  }, [queueOwner]);

  useEffect(() => {
    setOnline(typeof navigator === "undefined" ? true : navigator.onLine);
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  const syncMutation = useMutation({
    mutationFn: (drafts: LocalFarmDraft[]) =>
      sync({
        data: {
          drafts,
          ...(subjectUserId ? { subjectUserId } : {}),
        },
      }),
    onSuccess: async (res) => {
      const settled = res.results
        .filter((r) => r.outcome === "created" || r.outcome === "updated" || r.outcome === "already_current")
        .map((r) => r.clientDraftId);
      const conflicts = res.results.filter((r) => r.outcome === "plot_ref_already_registered");
      setQueue(removeDrafts(queueOwner, settled));
      if (conflicts.length > 0) {
        toast.warning(`${conflicts.length} ${t("farm.held")}`);
      } else {
        toast.success(t("farm.syncedToast"));
      }
      await queryClient.invalidateQueries({ queryKey: ["atap", "farmer-workspace"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const verifyMutation = useMutation({
    mutationFn: () =>
      verify({
        data: {
          reference,
          channel,
          ...(subjectUserId ? { subjectUserId } : {}),
        },
      }),
    onSuccess: async (res) => {
      if (res.status === "verified") toast.success(t("farm.verified"));
      else toast.warning(`${t("farm.manualReview")} (${res.status}). ${t("farm.nothingLost")}`);
      await queryClient.invalidateQueries({ queryKey: ["atap", "farmer-workspace"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const firstValueMutation = useMutation({
    mutationFn: (actionKey: string) => firstValue({ data: { actionKey, channel } }),
    onSuccess: async () => {
      toast.success(t("farm.logged"));
      await queryClient.invalidateQueries({ queryKey: ["atap", "farmer-workspace"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const boundaryCheck = validateBoundary(form.boundary);
  const canQueue = Boolean(form.label && form.plotRef) && boundaryCheck.ok;

  function queueDraft() {
    const draft: LocalFarmDraft = {
      clientDraftId: form.clientDraftId,
      label: form.label.trim(),
      plotRef: form.plotRef.trim(),
      villageCode: form.villageCode.trim() || null,
      primaryCrop: form.primaryCrop.trim() || null,
      areaAcres: null,
      boundary: form.boundary,
      baselineProfile: form.irrigation ? { irrigation: form.irrigation } : {},
      clientUpdatedAt: new Date().toISOString(),
      channel,
    };
    setQueue(upsertDraft(queueOwner, draft));
    setForm(emptyForm());
    toast.success(t("farm.savedDevice"));
  }

  const data = workspace.data;
  const blockedCheck = useMemo(
    () => (data?.identityChecks ?? []).find((c) => identityBlocksProgress(c.status)),
    [data],
  );

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={t("farm.eyebrow")}
        title={t("farm.title")}
        description={t("farm.description")}
      />

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="font-display text-lg font-semibold">{t("farm.captureMode")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("farm.captureHelp")}
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-medium">{t("farm.channel")}</span>
            <select
              className="field-base"
              value={channel}
              onChange={(e) => setChannel(e.target.value as OnboardingChannel)}
            >
              {CHANNEL_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {chLabel(c)}
                </option>
              ))}
            </select>
          </label>
          {isAssistedChannel(channel) && (
            <label className="block">
              <span className="mb-1 block text-sm font-medium">{t("farm.subject")}</span>
              <input
                className="field-base"
                value={subjectUserId}
                onChange={(e) => setSubjectUserId(e.target.value)}
                placeholder={t("farm.subjectPh")}
              />
              <span className="field-hint block">
                {data?.canAssist
                  ? t("farm.canAssist")
                  : t("farm.cannotAssist")}
              </span>
            </label>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="font-display text-lg font-semibold">{t("farm.idTitle")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("farm.idHelp")}
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="block min-w-64 flex-1">
            <span className="mb-1 block text-sm font-medium">{t("farm.idRef")}</span>
            <input
              className="field-base"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="e.g. SYN-FARMER-0001"
            />
          </label>
          <Button
            onClick={() => verifyMutation.mutate()}
            disabled={reference.trim().length < 4 || verifyMutation.isPending}
          >
            {t("farm.runCheck")}
          </Button>
        </div>
        {blockedCheck && (
          <p className="mt-3 rounded-md border border-border bg-muted/50 p-3 text-sm">
            {t("farm.onHold")} ({blockedCheck.status.replaceAll("_", " ")}). {t("farm.onHoldHelp")}
          </p>
        )}
        <ul className="mt-4 space-y-2 text-sm">
          {(data?.identityChecks ?? []).map((check) => (
            <li key={check.id} className="flex flex-wrap items-center gap-2 rounded-md border border-border p-3">
              <StateBadge state={check.status} />
              <span className="text-muted-foreground">{check.jurisdiction_code}</span>
              <span className="text-muted-foreground">{t("farm.via")} {check.adapter_name}</span>
              {check.reason_category && (
                <span className="text-muted-foreground">· {check.reason_category.replaceAll("_", " ")}</span>
              )}
            </li>
          ))}
          {(data?.identityChecks ?? []).length === 0 && (
            <li className="text-sm text-muted-foreground">{t("farm.noChecks")}</li>
          )}
        </ul>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg font-semibold">{t("farm.parcelTitle")}</h2>
          <span className="text-xs text-muted-foreground">
            {online ? t("farm.online") : t("farm.offline")}
          </span>
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-sm font-medium">{t("farm.label")}</span>
              <input
                className="field-base"
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                placeholder={t("farm.labelPh")}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium">{t("farm.plotRef")}</span>
              <input
                className="field-base"
                value={form.plotRef}
                onChange={(e) => setForm({ ...form, plotRef: e.target.value })}
                placeholder="TG-KHM-114/2"
              />
              <span className="field-hint block">{t("farm.plotHint")}</span>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium">{t("farm.village")}</span>
              <input
                className="field-base"
                value={form.villageCode}
                onChange={(e) => setForm({ ...form, villageCode: e.target.value })}
                placeholder="TG-KHM-V001"
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-sm font-medium">{t("farm.crop")}</span>
                <input
                  className="field-base"
                  value={form.primaryCrop}
                  onChange={(e) => setForm({ ...form, primaryCrop: e.target.value })}
                  placeholder={t("farm.cropPh")}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium">{t("farm.irrigation")}</span>
                <select
                  className="field-base"
                  value={form.irrigation}
                  onChange={(e) => setForm({ ...form, irrigation: e.target.value })}
                >
                  <option value="">{t("farm.notStated")}</option>
                  <option value="rainfed">{t("farm.rainfed")}</option>
                  <option value="borewell">{t("farm.borewell")}</option>
                  <option value="canal">{t("farm.canal")}</option>
                </select>
              </label>
            </div>
            <Button onClick={queueDraft} disabled={!canQueue}>
              {t("farm.saveDevice")}
            </Button>
          </div>
          <ParcelCapture
            center={TELANGANA_CENTER}
            value={form.boundary}
            onChange={(boundary) => setForm({ ...form, boundary })}
          />
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-lg font-semibold">{t("farm.queue")} ({queue.length})</h2>
          <Button
            onClick={() => syncMutation.mutate(queue)}
            disabled={queue.length === 0 || syncMutation.isPending}
          >
            {t("farm.syncNow")}
          </Button>
        </div>
        <ul className="mt-3 space-y-2 text-sm">
          {queue.map((draft) => (
            <li key={draft.clientDraftId} className="rounded-md border border-border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{draft.label}</span>
                <span className="text-muted-foreground">{draft.plotRef}</span>
                <StatusBadge status="draft" />
                <span className="text-muted-foreground">{chLabel(draft.channel)}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("farm.draftKey")} {draft.clientDraftId} — {t("farm.draftHelp")}
              </p>
            </li>
          ))}
          {queue.length === 0 && (
            <li className="text-sm text-muted-foreground">{t("farm.nothingPending")}</li>
          )}
        </ul>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="font-display text-lg font-semibold">{t("farm.synced")}</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t("farm.col.parcel")}</th>
                <th>{t("farm.col.plot")}</th>
                <th>{t("farm.col.area")}</th>
                <th>{t("farm.col.crop")}</th>
                <th>{t("farm.col.channel")}</th>
                <th>{t("farm.col.sync")}</th>
              </tr>
            </thead>
            <tbody>
              {(data?.farms ?? []).map((farm) => (
                <tr key={farm.id}>
                  <td>{farm.label}</td>
                  <td>{farm.plot_ref}</td>
                  <td>{farm.area_acres ?? "—"}</td>
                  <td>{farm.primary_crop ?? "—"}</td>
                  <td>{chLabel(farm.channel)}</td>
                  <td>
                    <StateBadge state={farm.sync_state} />
                  </td>
                </tr>
              ))}
              {(data?.farms ?? []).length === 0 && (
                <tr>
                  <td colSpan={6} className="text-muted-foreground">
                    {t("farm.noFarms")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="font-display text-lg font-semibold">{t("farm.firstValue")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("farm.firstValueHelp")}
        </p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {(data?.firstValue ?? []).map((action) => (
            <li key={action.key} className="rounded-lg border border-border p-4">
              <p className="font-medium">{action.label}</p>
              <p className="mt-1 text-sm text-muted-foreground">{action.description}</p>
              <Button
                className="mt-3"
                size="sm"
                variant={action.available ? "default" : "outline"}
                disabled={!action.available || firstValueMutation.isPending}
                onClick={() => firstValueMutation.mutate(action.key)}
              >
                {action.available ? t("farm.start") : t("farm.notActive")}
              </Button>
            </li>
          ))}
        </ul>
      </section>

      {data?.canSeeMetrics && (
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="font-display text-lg font-semibold">{t("farm.funnel")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("farm.assistedShare")} {Math.round((data.metrics.assistedShare ?? 0) * 100)}% ·{" "}
            {data.metrics.assisted} {t("farm.assistedVs")} {data.metrics.selfService} {t("farm.selfEvents")}
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t("farm.col.stage")}</th>
                  <th>{t("farm.col.events")}</th>
                  <th>{t("farm.col.farmers")}</th>
                </tr>
              </thead>
              <tbody>
                {data.metrics.byStage.map((stage) => (
                  <tr key={stage.event_code}>
                    <td>{stage.event_code}</td>
                    <td>{stage.count}</td>
                    <td>{stage.subjects}</td>
                  </tr>
                ))}
                {data.metrics.byStage.length === 0 && (
                  <tr>
                    <td colSpan={3} className="text-muted-foreground">
                      {t("farm.noFunnel")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
