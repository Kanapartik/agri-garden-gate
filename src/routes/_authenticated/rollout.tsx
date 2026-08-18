import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { PageHeader } from "@/components/atap/AppShell";
import { StateBadge } from "@/components/atap/StatusBadge";
import { getDistrictRollouts, setRolloutChecklistItem } from "@/lib/atap/district.functions";

export const Route = createFileRoute("/_authenticated/rollout")({
  head: () => ({
    meta: [
      { title: "District rollout — AgriGhar ATAP" },
      {
        name: "description",
        content:
          "District configuration templates and rollout readiness for the anchor district MVP. Scope stays at district level; no state or national aggregation.",
      },
      { property: "og:title", content: "District rollout — AgriGhar ATAP" },
      {
        property: "og:description",
        content: "Anchor district readiness checklist and live activity counters.",
      },
    ],
  }),
  component: RolloutPage,
});

function RolloutPage() {
  const queryClient = useQueryClient();
  const fetchRollouts = useServerFn(getDistrictRollouts);
  const setItem = useServerFn(setRolloutChecklistItem);

  const rollouts = useQuery({
    queryKey: ["atap", "district-rollouts"],
    queryFn: () => fetchRollouts(),
  });

  if (rollouts.isLoading) {
    return <main className="mx-auto max-w-5xl px-6 py-12 text-sm text-muted-foreground">Loading…</main>;
  }

  const rows = rollouts.data?.rollouts ?? [];

  return (
    <main className="mx-auto max-w-5xl space-y-8 px-6 py-12">
      <PageHeader
        title="District rollout"
        description="One configuration template per anchor district. Readiness is a checklist, not an automatic go-live: a platform admin flips status only after every item is met."
      />

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No district rollout is visible to your role.
        </p>
      ) : (
        rows.map((r) => (
          <section key={r.id} className="panel space-y-4 p-5">
            <header className="flex flex-wrap items-center gap-3">
              <h2 className="font-display text-base font-semibold">{r.label}</h2>
              <StateBadge state={r.status} />
              <span className="text-xs text-muted-foreground">
                template {r.template_code}
                {r.geography ? ` · ${r.geography.name} (${r.geography.level})` : ""}
              </span>
            </header>

            <div className="grid gap-3 sm:grid-cols-4">
              {[
                { label: "Readiness", value: `${r.readiness.percent}%` },
                { label: "FPO members", value: r.memberCount },
                { label: "Scheme applications", value: r.applicationCount },
                { label: "Decided", value: r.decidedCount },
              ].map((m) => (
                <div key={m.label} className="rounded-md bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">{m.label}</p>
                  <p className="font-display text-lg font-semibold">{m.value}</p>
                </div>
              ))}
            </div>

            <ul className="space-y-2 text-sm">
              {r.checklist.map((item) => (
                <li key={item.key} className="flex items-start gap-2">
                  <input
                    id={`${r.id}-${item.key}`}
                    type="checkbox"
                    className="mt-1 size-4 accent-primary"
                    checked={item.done}
                    onChange={async (e) => {
                      try {
                        await setItem({
                          data: { rolloutId: r.id, itemKey: item.key, done: e.target.checked },
                        });
                        await queryClient.invalidateQueries({
                          queryKey: ["atap", "district-rollouts"],
                        });
                      } catch (err) {
                        toast.error((err as Error).message);
                      }
                    }}
                  />
                  <label htmlFor={`${r.id}-${item.key}`}>{item.label}</label>
                </li>
              ))}
            </ul>

            <p className="field-hint">
              {r.readiness.canGoLive
                ? "All readiness items complete — eligible for go-live review."
                : `${r.readiness.outstanding.length} item(s) outstanding before go-live.`}{" "}
              Delegated purchasing authority stays disabled pending D-08.
            </p>
          </section>
        ))
      )}
    </main>
  );
}
