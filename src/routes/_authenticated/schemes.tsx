import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/atap/AppShell";
import { StateBadge } from "@/components/atap/StatusBadge";
import { TrainingChecklistPanel } from "@/components/atap/TrainingChecklist";
import { Button } from "@/components/ui/button";
import {
  createScheme,
  decideSchemeApplication,
  getGovtWorkspace,
  publishSchemeVersion,
} from "@/lib/atap/district.functions";
import { DEFAULT_SCHEME_FORM_FIELDS, DEFAULT_SCHEME_RULES } from "@/lib/atap/district";

export const Route = createFileRoute("/_authenticated/schemes")({
  head: () => ({
    meta: [
      { title: "Scheme catalog & review — AgriGhar ATAP" },
      {
        name: "description",
        content:
          "Government departments publish versioned scheme rules and review farmer applications. Rule evaluation is advisory; the decision stays with the authorized reviewer.",
      },
      { property: "og:title", content: "Scheme catalog & review — AgriGhar ATAP" },
      {
        property: "og:description",
        content: "Versioned, audited scheme rules with a human government review queue.",
      },
    ],
  }),
  component: SchemesPage,
});

function SchemesPage() {
  const queryClient = useQueryClient();
  const fetchWorkspace = useServerFn(getGovtWorkspace);
  const create = useServerFn(createScheme);
  const publish = useServerFn(publishSchemeVersion);
  const decide = useServerFn(decideSchemeApplication);

  const [tenantId, setTenantId] = useState("");
  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [rulesText, setRulesText] = useState(JSON.stringify(DEFAULT_SCHEME_RULES, null, 2));
  const [changelog, setChangelog] = useState("");
  const [schemeId, setSchemeId] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});

  const workspace = useQuery({
    queryKey: ["atap", "govt-workspace"],
    queryFn: () => fetchWorkspace(),
  });

  const data = workspace.data;
  const activeTenant = useMemo(
    () => data?.tenants.find((t) => t.id === tenantId) ?? data?.tenants[0] ?? null,
    [data, tenantId],
  );
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["atap", "govt-workspace"] });

  const createMutation = useMutation({
    mutationFn: () =>
      create({ data: { tenantId: activeTenant?.id ?? "", code, title, summary } }),
    onSuccess: async () => {
      toast.success("Scheme created as a draft and audited");
      setCode("");
      setTitle("");
      setSummary("");
      await refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const publishMutation = useMutation({
    mutationFn: () => {
      const rules = JSON.parse(rulesText);
      return publish({
        data: {
          schemeId,
          rules,
          formFields: DEFAULT_SCHEME_FORM_FIELDS,
          changelog,
          publish: true,
        },
      });
    },
    onSuccess: async (res) => {
      toast.success(`Version ${res.version} published, versioned and audited`);
      setChangelog("");
      await refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (workspace.isLoading) {
    return <main className="mx-auto max-w-6xl px-6 py-12 text-sm text-muted-foreground">Loading…</main>;
  }

  if (!data || data.tenants.length === 0) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <PageHeader
          title="Scheme catalog"
          description="You do not hold a scheme publisher, reviewer or viewer role in a government department tenant. Technical tenancy alone never confers government authority."
        />
      </main>
    );
  }

  const schemes = data.schemes.filter((s) => s.tenant_id === activeTenant?.id);

  return (
    <main className="mx-auto max-w-6xl space-y-10 px-6 py-12">
      <PageHeader
        title="Scheme catalog & review"
        description="Rule sets are configuration, versioned on every change. Rule output is a recommendation only — approvals and rejections remain a named human decision with a recorded note."
      />

      <section className="panel space-y-3 p-5">
        <label className="text-sm font-medium" htmlFor="dept">
          Department
        </label>
        <select
          id="dept"
          className="field-base max-w-sm"
          value={activeTenant?.id ?? ""}
          onChange={(e) => setTenantId(e.target.value)}
        >
          {data.tenants.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <div className="flex flex-wrap gap-2">
          {(activeTenant?.roles ?? []).map((r) => (
            <StateBadge key={r} state={r} />
          ))}
        </div>
      </section>

      {data.canPublish ? (
        <section className="grid gap-6 lg:grid-cols-2">
          <div className="panel space-y-3 p-5">
            <h2 className="font-display text-base font-semibold">New scheme (draft)</h2>
            <input
              className="field-base"
              placeholder="Code (e.g. seed-subsidy-2026)"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <input
              className="field-base"
              placeholder="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <textarea
              className="field-base min-h-20"
              placeholder="Plain-language summary shown to farmers"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
            />
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
              Create draft scheme
            </Button>
          </div>

          <div className="panel space-y-3 p-5">
            <h2 className="font-display text-base font-semibold">Publish a rule version</h2>
            <select
              className="field-base"
              value={schemeId}
              onChange={(e) => setSchemeId(e.target.value)}
            >
              <option value="">Select scheme…</option>
              {schemes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title} (v{s.current_version})
                </option>
              ))}
            </select>
            <textarea
              className="field-base min-h-40 font-mono text-xs"
              value={rulesText}
              onChange={(e) => setRulesText(e.target.value)}
            />
            <input
              className="field-base"
              placeholder="Changelog (required, min 8 chars)"
              value={changelog}
              onChange={(e) => setChangelog(e.target.value)}
            />
            <Button
              onClick={() => publishMutation.mutate()}
              disabled={!schemeId || publishMutation.isPending}
            >
              Publish next version
            </Button>
            <p className="field-hint">
              Published versions are immutable. Applications stay bound to the version they were
              submitted against.
            </p>
          </div>
        </section>
      ) : null}

      <section className="panel space-y-3 p-5">
        <h2 className="font-display text-base font-semibold">Scheme versions</h2>
        {schemes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No schemes yet.</p>
        ) : (
          schemes.map((s) => (
            <div key={s.id} className="border-t border-border pt-3 first:border-0 first:pt-0">
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="font-display text-sm font-semibold">{s.title}</h3>
                <StateBadge state={s.status} />
                <span className="text-xs text-muted-foreground">
                  current v{s.current_version} · {s.code}
                </span>
              </div>
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                {data.versions
                  .filter((v) => v.scheme_id === s.id)
                  .map((v) => (
                    <li key={v.id}>
                      v{v.version} — {v.changelog} ({v.rules.length} rule
                      {v.rules.length === 1 ? "" : "s"}
                      {v.published_at ? ", published" : ", draft"})
                    </li>
                  ))}
              </ul>
            </div>
          ))
        )}
      </section>

      <section className="panel space-y-4 p-5">
        <h2 className="font-display text-base font-semibold">Review queue</h2>
        {!data.canReview ? (
          <p className="text-sm text-muted-foreground">
            Your role can view the catalog but not decide applications.
          </p>
        ) : data.queue.length === 0 ? (
          <p className="text-sm text-muted-foreground">No applications awaiting review.</p>
        ) : (
          data.queue.map((a) => {
            const evaluation = "recommendation" in a.rule_evaluation ? a.rule_evaluation : null;
            return (
              <article key={a.id} className="space-y-3 border-t border-border pt-4 first:border-0 first:pt-0">
                <header className="flex flex-wrap items-center gap-3">
                  <StateBadge state={a.status} />
                  <span className="text-sm font-medium">
                    {schemes.find((s) => s.id === a.scheme_id)?.title ?? a.scheme_id}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    submitted against v{a.scheme_version} ·{" "}
                    {a.prefill_consent_ok ? "prefilled with consent" : "manually entered"}
                  </span>
                </header>

                {evaluation ? (
                  <div className="rounded-md bg-muted/50 p-3 text-xs">
                    <p className="font-medium">
                      Advisory recommendation: {evaluation.recommendation.replaceAll("_", " ")} — a
                      human decision is still required.
                    </p>
                    <ul className="mt-1 space-y-0.5">
                      {evaluation.checks.map((c) => (
                        <li key={c.key}>
                          {c.passed ? "pass" : "fail"} · {c.label}
                          {c.severity === "advisory" ? " (advisory)" : ""}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <dl className="grid gap-1 text-xs sm:grid-cols-2">
                  {Object.entries(a.form_data).map(([k, v]) => (
                    <div key={k} className="flex gap-2">
                      <dt className="text-muted-foreground">{k.replaceAll("_", " ")}</dt>
                      <dd className="font-medium">{String(v)}</dd>
                    </div>
                  ))}
                </dl>

                <div className="flex flex-wrap items-center gap-2">
                  <input
                    className="field-base max-w-md"
                    placeholder="Decision note (required to approve or reject)"
                    value={notes[a.id] ?? ""}
                    onChange={(e) => setNotes({ ...notes, [a.id]: e.target.value })}
                  />
                  {a.status === "submitted" ? (
                    <Button
                      variant="outline"
                      onClick={async () => {
                        await decide({ data: { applicationId: a.id, next: "in_review", note: "" } });
                        toast.success("Taken into review and audited");
                        await refresh();
                      }}
                    >
                      Take into review
                    </Button>
                  ) : null}
                  {a.status === "in_review" ? (
                    <>
                      <Button
                        onClick={async () => {
                          try {
                            await decide({
                              data: {
                                applicationId: a.id,
                                next: "approved",
                                note: notes[a.id] ?? "",
                              },
                            });
                            toast.success("Approved — decision recorded and audited");
                            await refresh();
                          } catch (e) {
                            toast.error((e as Error).message);
                          }
                        }}
                      >
                        Approve
                      </Button>
                      <Button
                        variant="outline"
                        onClick={async () => {
                          try {
                            await decide({
                              data: {
                                applicationId: a.id,
                                next: "rejected",
                                note: notes[a.id] ?? "",
                              },
                            });
                            toast.success("Rejected — decision recorded and audited");
                            await refresh();
                          } catch (e) {
                            toast.error((e as Error).message);
                          }
                        }}
                      >
                        Reject
                      </Button>
                    </>
                  ) : null}
                </div>
                {a.decision_note ? (
                  <p className="text-xs text-muted-foreground">
                    Recorded decision: {a.decision_note}
                  </p>
                ) : null}
              </article>
            );
          })
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-base font-semibold">Role training</h2>
        <TrainingChecklistPanel progress={data.training} invalidateKey="govt-workspace" />
      </section>
    </main>
  );
}
