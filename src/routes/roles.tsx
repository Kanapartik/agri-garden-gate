import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/atap/AppShell";
import { FlagBadge } from "@/components/atap/StatusBadge";
import { Button } from "@/components/ui/button";
import { getOnboardingScaffold } from "@/lib/atap/onboarding.functions";
import { stepsForRole, visibleRoleCards } from "@/lib/atap/onboarding";

const TITLE = "Role selector — AgriGhar ATAP onboarding";
const DESCRIPTION =
  "Pick a configured ATAP onboarding journey: farmer, FPO, bank, insurer, government or agri-business. Role cards are driven by feature flags, not code.";

export const Route = createFileRoute("/roles")({
  loader: () => getOnboardingScaffold(),
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RoleSelector,
});

function RoleSelector() {
  const scaffold = Route.useLoaderData();
  const visible = visibleRoleCards(scaffold.roles, scaffold.flags, scaffold.env);
  const hidden = scaffold.roles.filter((r) => !visible.some((v) => v.code === r.code));

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <PageHeader
        eyebrow={`Environment: ${scaffold.env}`}
        title="Choose a role journey"
        description="Each card is a role_definition row gated by a feature_flags row. Turning a flag off hides the card with no code change. Real production registration and identity verification are not activated in this baseline."
      />

      <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {visible.map((role) => {
          const steps = stepsForRole(scaffold.steps, role.code);
          return (
            <article key={role.code} className="panel flex flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-base font-semibold">{role.label}</h2>
                <FlagBadge enabled />
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{role.description}</p>
              {role.authority_note ? (
                <p className="mt-3 rounded-md bg-secondary p-2.5 text-xs text-secondary-foreground">
                  {role.authority_note}
                </p>
              ) : null}
              <p className="field-hint mt-3">
                {steps.length > 0
                  ? `${steps.length} configured step${steps.length === 1 ? "" : "s"}: ${steps
                      .map((s) => s.label)
                      .join(" → ")}`
                  : "Journey configuration is being finalised — check back shortly."}
              </p>
              <div className="mt-4 pt-2">
                <Button className="w-full" variant={steps.length ? "default" : "outline"} asChild>
                  <Link to="/onboarding" search={{ role: role.code }}>
                    Start onboarding
                  </Link>
                </Button>
              </div>
            </article>
          );
        })}
      </div>

      {hidden.length > 0 ? (
        <section className="mt-10">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Configured but flag-disabled
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {hidden.map((r) => (
              <li
                key={r.code}
                className="flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs"
              >
                {r.label}
                <FlagBadge enabled={false} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
