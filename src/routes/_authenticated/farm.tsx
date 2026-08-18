import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/atap/AppShell";
import { StateBadge, StatusBadge } from "@/components/atap/StatusBadge";
import { ParcelCapture } from "@/components/atap/ParcelCapture";
import { Button } from "@/components/ui/button";
import {
  completeFirstValueAction,
  getFarmerWorkspace,
  runIdentityCheck,
  syncFarmDrafts,
} from "@/lib/atap/farmer.functions";
import {
  CHANNEL_LABEL,
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
        toast.warning(`${conflicts.length} parcel(s) held for review: plot reference already registered.`);
      } else {
        toast.success("Parcel drafts synced without duplicates.");
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
      if (res.status === "verified") toast.success("Identity verified by the mocked jurisdiction adapter.");
      else toast.warning(`Sent to manual review (${res.status}). Nothing was lost.`);
      await queryClient.invalidateQueries({ queryKey: ["atap", "farmer-workspace"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const firstValueMutation = useMutation({
    mutationFn: (actionKey: string) => firstValue({ data: { actionKey, channel } }),
    onSuccess: async () => {
      toast.success("Logged as a first-value action.");
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
    toast.success("Saved on this device. It will survive a reload or connection loss.");
  }

  const data = workspace.data;
  const blockedCheck = useMemo(
    () => (data?.identityChecks ?? []).find((c) => identityBlocksProgress(c.status)),
    [data],
  );

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="B2 · Farmer & assisted onboarding"
        title="Farm & parcel capture"
        description="Capture parcels offline, verify identity through an adapter that can only recommend, and sync drafts idempotently. All data here is synthetic."
      />

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="font-display text-lg font-semibold">Capture mode</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Assisted mode records the acting agent separately from the farmer whose data it is. Consent is
          never delegated — the farmer accepts it themselves in the consent centre.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="atap-field">
            <span className="atap-label">Channel</span>
            <select
              className="atap-input"
              value={channel}
              onChange={(e) => setChannel(e.target.value as OnboardingChannel)}
            >
              {CHANNEL_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {CHANNEL_LABEL[c]}
                </option>
              ))}
            </select>
          </label>
          {isAssistedChannel(channel) && (
            <label className="atap-field">
              <span className="atap-label">Farmer user id (data subject)</span>
              <input
                className="atap-input"
                value={subjectUserId}
                onChange={(e) => setSubjectUserId(e.target.value)}
                placeholder="uuid of the farmer you are assisting"
              />
              <span className="atap-hint">
                {data?.canAssist
                  ? "Your role allows assisted capture. Every write is audited as actor vs subject."
                  : "You do not hold an assisting role, so the server will deny assisted writes."}
              </span>
            </label>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="font-display text-lg font-semibold">Jurisdiction identity check</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Mocked adapter. A reference ending in an unverifiable pattern, or a duplicate already used by
          another subject, routes to human manual review instead of failing the farmer.
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="atap-field min-w-64 flex-1">
            <span className="atap-label">Identity reference (synthetic)</span>
            <input
              className="atap-input"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="e.g. SYN-FARMER-0001"
            />
          </label>
          <Button
            onClick={() => verifyMutation.mutate()}
            disabled={reference.trim().length < 4 || verifyMutation.isPending}
          >
            Run check
          </Button>
        </div>
        {blockedCheck && (
          <p className="mt-3 rounded-md border border-border bg-muted/50 p-3 text-sm">
            A check is on hold ({blockedCheck.status.replaceAll("_", " ")}). A platform admin resolves it in
            the admin queue; your captured data stays saved.
          </p>
        )}
        <ul className="mt-4 space-y-2 text-sm">
          {(data?.identityChecks ?? []).map((check) => (
            <li key={check.id} className="flex flex-wrap items-center gap-2 rounded-md border border-border p-3">
              <StateBadge state={check.status} />
              <span className="text-muted-foreground">{check.jurisdiction_code}</span>
              <span className="text-muted-foreground">via {check.adapter_name}</span>
              {check.reason_category && (
                <span className="text-muted-foreground">· {check.reason_category.replaceAll("_", " ")}</span>
              )}
            </li>
          ))}
          {(data?.identityChecks ?? []).length === 0 && (
            <li className="text-sm text-muted-foreground">No checks run yet.</li>
          )}
        </ul>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg font-semibold">Parcel capture</h2>
          <span className="text-xs text-muted-foreground">
            {online ? "Online" : "Offline — drafts stay on this device"}
          </span>
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            <label className="atap-field">
              <span className="atap-label">Parcel label</span>
              <input
                className="atap-input"
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                placeholder="North field"
              />
            </label>
            <label className="atap-field">
              <span className="atap-label">Plot reference</span>
              <input
                className="atap-input"
                value={form.plotRef}
                onChange={(e) => setForm({ ...form, plotRef: e.target.value })}
                placeholder="TG-KHM-114/2"
              />
              <span className="atap-hint">Used as the duplicate guard for a farmer's parcels.</span>
            </label>
            <label className="atap-field">
              <span className="atap-label">Village code</span>
              <input
                className="atap-input"
                value={form.villageCode}
                onChange={(e) => setForm({ ...form, villageCode: e.target.value })}
                placeholder="TG-KHM-V001"
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="atap-field">
                <span className="atap-label">Primary crop</span>
                <input
                  className="atap-input"
                  value={form.primaryCrop}
                  onChange={(e) => setForm({ ...form, primaryCrop: e.target.value })}
                  placeholder="Cotton"
                />
              </label>
              <label className="atap-field">
                <span className="atap-label">Irrigation (baseline profile)</span>
                <select
                  className="atap-input"
                  value={form.irrigation}
                  onChange={(e) => setForm({ ...form, irrigation: e.target.value })}
                >
                  <option value="">Not stated</option>
                  <option value="rainfed">Rainfed</option>
                  <option value="borewell">Borewell</option>
                  <option value="canal">Canal</option>
                </select>
              </label>
            </div>
            <Button onClick={queueDraft} disabled={!canQueue}>
              Save parcel on this device
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
          <h2 className="font-display text-lg font-semibold">Deferred sync queue ({queue.length})</h2>
          <Button
            onClick={() => syncMutation.mutate(queue)}
            disabled={queue.length === 0 || syncMutation.isPending}
          >
            Sync now
          </Button>
        </div>
        <ul className="mt-3 space-y-2 text-sm">
          {queue.map((draft) => (
            <li key={draft.clientDraftId} className="rounded-md border border-border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{draft.label}</span>
                <span className="text-muted-foreground">{draft.plotRef}</span>
                <StatusBadge status="draft" />
                <span className="text-muted-foreground">{CHANNEL_LABEL[draft.channel]}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Draft key {draft.clientDraftId} — replaying this queue updates the same record instead of
                duplicating it.
              </p>
            </li>
          ))}
          {queue.length === 0 && (
            <li className="text-sm text-muted-foreground">Nothing pending. Captured parcels are synced.</li>
          )}
        </ul>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="font-display text-lg font-semibold">Synced farm records</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="atap-table">
            <thead>
              <tr>
                <th>Parcel</th>
                <th>Plot ref</th>
                <th>Area</th>
                <th>Crop</th>
                <th>Channel</th>
                <th>Sync</th>
              </tr>
            </thead>
            <tbody>
              {(data?.farms ?? []).map((farm) => (
                <tr key={farm.id}>
                  <td>{farm.label}</td>
                  <td>{farm.plot_ref}</td>
                  <td>{farm.area_acres ?? "—"}</td>
                  <td>{farm.primary_crop ?? "—"}</td>
                  <td>{CHANNEL_LABEL[farm.channel]}</td>
                  <td>
                    <StateBadge state={farm.sync_state} />
                  </td>
                </tr>
              ))}
              {(data?.farms ?? []).length === 0 && (
                <tr>
                  <td colSpan={6} className="text-muted-foreground">
                    No farm records yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="font-display text-lg font-semibold">Welcome — first value</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Launcher options are configuration-driven. Deactivated domains stay visibly deactivated.
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
                {action.available ? "Start" : "Not active in this slice"}
              </Button>
            </li>
          ))}
        </ul>
      </section>

      {data?.canSeeMetrics && (
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="font-display text-lg font-semibold">Onboarding funnel</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Assisted share {Math.round((data.metrics.assistedShare ?? 0) * 100)}% ·{" "}
            {data.metrics.assisted} assisted vs {data.metrics.selfService} self-service events.
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="atap-table">
              <thead>
                <tr>
                  <th>Stage</th>
                  <th>Events</th>
                  <th>Distinct farmers</th>
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
                      No funnel events recorded yet.
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
