import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/atap/AppShell";
import { StatusBadge } from "@/components/atap/StatusBadge";
import { OnboardingStepper } from "@/components/atap/OnboardingStepper";
import { Button } from "@/components/ui/button";
import {
  getOnboardingWorkspace,
  saveStepDraft,
  startApplication,
  submitApplication,
} from "@/lib/atap/onboarding.functions";
import { stepsForRole, visibleRoleCards, type FormValues } from "@/lib/atap/onboarding";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [
      { title: "My onboarding — AgriGhar ATAP" },
      {
        name: "description",
        content:
          "Work through a synthetic ATAP onboarding journey: autosaved drafts, configured steps and a human-reviewed submission.",
      },
      { property: "og:title", content: "My onboarding — AgriGhar ATAP" },
      {
        property: "og:description",
        content: "Autosaved, configuration-driven onboarding drafts with human review.",
      },
    ],
  }),
  component: OnboardingPage,
});

function OnboardingPage() {
  const queryClient = useQueryClient();
  const fetchWorkspace = useServerFn(getOnboardingWorkspace);
  const start = useServerFn(startApplication);
  const save = useServerFn(saveStepDraft);
  const submit = useServerFn(submitApplication);
  const [activeId, setActiveId] = useState<string | null>(null);

  const workspace = useQuery({
    queryKey: ["atap", "onboarding-workspace"],
    queryFn: () => fetchWorkspace(),
  });

  const startMutation = useMutation({
    mutationFn: (roleCode: string) => start({ data: { roleCode } }),
    onSuccess: async (res) => {
      setActiveId(res.id);
      toast.success("Synthetic draft created");
      await queryClient.invalidateQueries({ queryKey: ["atap", "onboarding-workspace"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const submitMutation = useMutation({
    mutationFn: (applicationId: string) => submit({ data: { applicationId } }),
    onSuccess: async (res) => {
      if (res.ok) toast.success("Submitted — status is now Pending human review");
      else toast.error(`Incomplete steps: ${res.missing.join(", ")}`);
      await queryClient.invalidateQueries({ queryKey: ["atap", "onboarding-workspace"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (workspace.isLoading) {
    return <main className="mx-auto max-w-6xl px-6 py-12 text-sm text-muted-foreground">Loading…</main>;
  }
  if (workspace.isError || !workspace.data) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-12 text-sm text-field-invalid">
        Could not load your onboarding workspace.
      </main>
    );
  }

  const data = workspace.data;
  const selectable = visibleRoleCards(data.roles, data.flags, data.env);
  const active = data.mine.find((a) => a.id === activeId) ?? data.mine[0] ?? null;
  const activeSteps = active ? stepsForRole(data.steps, active.role_code) : [];

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-6 py-12">
      <PageHeader
        eyebrow={`Environment: ${data.env}`}
        title="My onboarding"
        description="Drafts autosave as you type. Submitting moves the application to Pending; only a human reviewer can activate or reject it."
      />

      <section className="panel p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Start a synthetic draft
        </h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {selectable.map((role) => (
            <Button
              key={role.code}
              variant="outline"
              size="sm"
              disabled={startMutation.isPending}
              onClick={() => startMutation.mutate(role.code)}
            >
              {role.label}
            </Button>
          ))}
        </div>
      </section>

      {data.mine.length > 0 ? (
        <section className="panel overflow-x-auto p-1">
          <table className="data-table">
            <thead>
              <tr>
                <th>Role</th>
                <th>Status</th>
                <th>Step</th>
                <th>Updated</th>
                <th>Synthetic</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.mine.map((app) => (
                <tr key={app.id}>
                  <td className="font-medium">
                    {data.roles.find((r) => r.code === app.role_code)?.label ?? app.role_code}
                  </td>
                  <td>
                    <StatusBadge status={app.status} />
                  </td>
                  <td className="text-muted-foreground">{app.current_step_key ?? "—"}</td>
                  <td className="text-muted-foreground">
                    {new Date(app.updated_at).toLocaleString()}
                  </td>
                  <td className="text-muted-foreground">{app.is_synthetic ? "Yes" : "No"}</td>
                  <td>
                    <Button variant="ghost" size="sm" onClick={() => setActiveId(app.id)}>
                      {active?.id === app.id ? "Open" : "Edit"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      {active ? (
        <OnboardingStepper
          key={active.id}
          steps={activeSteps}
          status={active.status}
          initialValues={(active.form_data ?? {}) as FormValues}
          initialStepKey={active.current_step_key}
          geographies={data.geographies}
          submitting={submitMutation.isPending}
          onSaveStep={async (stepKey, values) => {
            await save({ data: { applicationId: active.id, stepKey, values } });
          }}
          onSubmit={async () => {
            await submitMutation.mutateAsync(active.id);
          }}
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          No applications yet. Start a synthetic draft above.
        </p>
      )}
    </main>
  );
}
