import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/atap/AppShell";
import { StatusBadge } from "@/components/atap/StatusBadge";
import { Button } from "@/components/ui/button";
import { decideApplication, getOnboardingWorkspace } from "@/lib/atap/onboarding.functions";

export const Route = createFileRoute("/_authenticated/review")({
  head: () => ({
    meta: [
      { title: "Review queue — AgriGhar ATAP" },
      {
        name: "description",
        content:
          "Human reviewers activate or reject pending ATAP onboarding applications. No automatic or AI decisioning.",
      },
      { property: "og:title", content: "Review queue — AgriGhar ATAP" },
      {
        property: "og:description",
        content: "Human-in-the-loop activation for pending onboarding applications.",
      },
    ],
  }),
  component: ReviewPage,
});

function ReviewPage() {
  const queryClient = useQueryClient();
  const fetchWorkspace = useServerFn(getOnboardingWorkspace);
  const decide = useServerFn(decideApplication);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const workspace = useQuery({
    queryKey: ["atap", "onboarding-workspace"],
    queryFn: () => fetchWorkspace(),
  });

  const decision = useMutation({
    mutationFn: (input: { applicationId: string; decision: "activated" | "rejected"; note: string }) =>
      decide({ data: input }),
    onSuccess: async () => {
      toast.success("Decision recorded and audited");
      await queryClient.invalidateQueries({ queryKey: ["atap", "onboarding-workspace"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (workspace.isLoading) {
    return <main className="mx-auto max-w-6xl px-6 py-12 text-sm text-muted-foreground">Loading…</main>;
  }

  const data = workspace.data;
  if (!data?.canReview) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-12">
        <PageHeader
          title="Review queue"
          description="Your account holds no reviewer role. Server-side checks — not this page — decide who may act on an application."
        />
      </main>
    );
  }

  const pending = data.reviewQueue.filter((a) => a.status === "pending");
  const decided = data.reviewQueue.filter((a) => a.status !== "pending");

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-6 py-12">
      <PageHeader
        eyebrow={`Environment: ${data.env}`}
        title="Review queue"
        description="Every activation and rejection is a human decision, written to the append-only audit trail. Activation is restricted to synthetic applications outside production in this baseline."
      />

      {pending.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing pending review.</p>
      ) : (
        <div className="space-y-4">
          {pending.map((app) => (
            <article key={app.id} className="panel p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold">
                    {data.roles.find((r) => r.code === app.role_code)?.label ?? app.role_code}
                  </h2>
                  <p className="field-hint">
                    Submitted {app.submitted_at ? new Date(app.submitted_at).toLocaleString() : "—"}
                    {app.is_synthetic ? " · synthetic" : ""}
                  </p>
                </div>
                <StatusBadge status={app.status} />
              </div>

              <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                {Object.entries(app.form_data ?? {}).map(([key, value]) => (
                  <div key={key} className="rounded-md bg-secondary/50 px-3 py-2">
                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">{key}</dt>
                    <dd className="font-medium">
                      {Array.isArray(value) ? value.join(", ") : String(value ?? "—")}
                    </dd>
                  </div>
                ))}
              </dl>

              <label htmlFor={`note-${app.id}`} className="mt-4 block text-sm font-medium">
                Decision note
              </label>
              <textarea
                id={`note-${app.id}`}
                className="field-base mt-1.5"
                rows={2}
                maxLength={500}
                value={notes[app.id] ?? ""}
                onChange={(e) => setNotes((n) => ({ ...n, [app.id]: e.target.value }))}
              />

              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  disabled={decision.isPending}
                  onClick={() =>
                    decision.mutate({
                      applicationId: app.id,
                      decision: "activated",
                      note: notes[app.id] ?? "",
                    })
                  }
                >
                  Activate
                </Button>
                <Button
                  variant="outline"
                  disabled={decision.isPending}
                  onClick={() =>
                    decision.mutate({
                      applicationId: app.id,
                      decision: "rejected",
                      note: notes[app.id] ?? "",
                    })
                  }
                >
                  Reject
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}

      {decided.length > 0 ? (
        <section className="panel overflow-x-auto p-1">
          <table className="data-table">
            <thead>
              <tr>
                <th>Role</th>
                <th>Status</th>
                <th>Decided</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {decided.map((app) => (
                <tr key={app.id}>
                  <td className="font-medium">{app.role_code}</td>
                  <td>
                    <StatusBadge status={app.status} />
                  </td>
                  <td className="text-muted-foreground">
                    {app.decided_at ? new Date(app.decided_at).toLocaleString() : "—"}
                  </td>
                  <td className="text-muted-foreground">{app.decision_note ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}
    </main>
  );
}
