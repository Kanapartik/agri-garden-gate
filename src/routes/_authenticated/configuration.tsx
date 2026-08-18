import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader } from "@/components/atap/AppShell";
import { FlagBadge } from "@/components/atap/StatusBadge";
import { getOnboardingWorkspace } from "@/lib/atap/onboarding.functions";
import { isFlagActive } from "@/lib/atap/onboarding";

export const Route = createFileRoute("/_authenticated/configuration")({
  head: () => ({
    meta: [
      { title: "Configuration — AgriGhar ATAP" },
      {
        name: "description",
        content:
          "Inspect ATAP configuration: feature flags, geography levels, role definitions and onboarding step definitions.",
      },
      { property: "og:title", content: "Configuration — AgriGhar ATAP" },
      {
        property: "og:description",
        content: "Feature flags, geography, roles and onboarding steps as configuration records.",
      },
    ],
  }),
  component: ConfigurationPage,
});

function ConfigurationPage() {
  const fetchWorkspace = useServerFn(getOnboardingWorkspace);
  const workspace = useQuery({
    queryKey: ["atap", "onboarding-workspace"],
    queryFn: () => fetchWorkspace(),
  });

  if (workspace.isLoading) {
    return <main className="mx-auto max-w-6xl px-6 py-12 text-sm text-muted-foreground">Loading…</main>;
  }
  const data = workspace.data;
  if (!data) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-12 text-sm text-field-invalid">
        Configuration is not available for this account.
      </main>
    );
  }

  const levels = [...new Set(data.geographies.map((g) => g.level))];

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-6 py-12">
      <PageHeader
        eyebrow={`Environment: ${data.env}`}
        title="Configuration"
        description="Read-only view of the records that drive journeys. Writes are restricted to platform administrators and are not exposed in this baseline slice."
      />

      <section className="panel overflow-x-auto p-1">
        <table className="data-table">
          <thead>
            <tr>
              <th>Feature flag</th>
              <th>Label</th>
              <th>Environments</th>
              <th>Stored</th>
              <th>Active here</th>
            </tr>
          </thead>
          <tbody>
            {data.flags.map((flag) => (
              <tr key={flag.key}>
                <td className="font-mono text-xs">{flag.key}</td>
                <td>{flag.label}</td>
                <td className="text-muted-foreground">{flag.environments.join(", ")}</td>
                <td>
                  <FlagBadge enabled={flag.enabled} />
                </td>
                <td>
                  <FlagBadge enabled={isFlagActive(data.flags, flag.key, data.env)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="panel overflow-x-auto p-1">
        <table className="data-table">
          <thead>
            <tr>
              <th>Role</th>
              <th>Journey</th>
              <th>Controlling flag</th>
              <th>Public</th>
              <th>Authority note</th>
            </tr>
          </thead>
          <tbody>
            {data.roles.map((role) => (
              <tr key={role.code}>
                <td className="font-medium">{role.label}</td>
                <td className="text-muted-foreground">{role.journey_kind}</td>
                <td className="font-mono text-xs">{role.feature_flag_key ?? "—"}</td>
                <td>{role.is_public_selectable ? "Yes" : "No"}</td>
                <td className="max-w-md text-muted-foreground">{role.authority_note ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="panel overflow-x-auto p-1">
        <table className="data-table">
          <thead>
            <tr>
              <th>Step key</th>
              <th>Role</th>
              <th>Order</th>
              <th>Required</th>
              <th>Fields</th>
              <th>Evidence</th>
            </tr>
          </thead>
          <tbody>
            {data.steps.map((step) => (
              <tr key={`${step.role_code}:${step.step_key}`}>
                <td className="font-mono text-xs">{step.step_key}</td>
                <td>{step.role_code}</td>
                <td>{step.sort_order}</td>
                <td>{step.is_required ? "Yes" : "No"}</td>
                <td className="text-muted-foreground">
                  {step.fields.map((f) => f.name).join(", ") || "—"}
                </td>
                <td className="text-muted-foreground">
                  {step.evidence_required.map((e) => e.code).join(", ") || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="panel p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Geography levels
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {levels.length} level{levels.length === 1 ? "" : "s"} configured: {levels.join(" → ")} ·{" "}
          {data.geographies.length} nodes.
        </p>
      </section>
    </main>
  );
}
