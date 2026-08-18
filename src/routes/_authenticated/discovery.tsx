import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/atap/AppShell";
import { StateBadge } from "@/components/atap/StatusBadge";
import { Button } from "@/components/ui/button";
import { getSchemeDiscovery, submitSchemeApplication } from "@/lib/atap/district.functions";
import type { FormValues } from "@/lib/atap/onboarding";

export const Route = createFileRoute("/_authenticated/discovery")({
  head: () => ({
    meta: [
      { title: "Scheme discovery — AgriGhar ATAP" },
      {
        name: "description",
        content:
          "Farmers browse published district schemes and apply, optionally prefilled from their own consented farm profile. Every decision stays with the government reviewer.",
      },
      { property: "og:title", content: "Scheme discovery — AgriGhar ATAP" },
      {
        property: "og:description",
        content: "Find published district schemes and apply with consented prefill.",
      },
    ],
  }),
  component: DiscoveryPage,
});

function DiscoveryPage() {
  const queryClient = useQueryClient();
  const fetchDiscovery = useServerFn(getSchemeDiscovery);
  const submit = useServerFn(submitSchemeApplication);

  const [openScheme, setOpenScheme] = useState<string | null>(null);
  const [values, setValues] = useState<FormValues>({});
  const [usedPrefill, setUsedPrefill] = useState(false);

  const discovery = useQuery({
    queryKey: ["atap", "scheme-discovery"],
    queryFn: () => fetchDiscovery(),
  });

  const data = discovery.data;

  const submitMutation = useMutation({
    mutationFn: (schemeId: string) => submit({ data: { schemeId, values, usedPrefill } }),
    onSuccess: async () => {
      toast.success("Application submitted for human government review");
      setOpenScheme(null);
      setValues({});
      await queryClient.invalidateQueries({ queryKey: ["atap", "scheme-discovery"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (discovery.isLoading) {
    return <main className="mx-auto max-w-5xl px-6 py-12 text-sm text-muted-foreground">Loading…</main>;
  }

  return (
    <main className="mx-auto max-w-5xl space-y-10 px-6 py-12">
      <PageHeader
        title="Scheme discovery"
        description="Published district schemes you can apply to. Applying shares only the fields on the form with the publishing department — nothing else from your farm profile."
      />

      <section className="panel space-y-2 p-5">
        <h2 className="font-display text-sm font-semibold">Prefill from your farm profile</h2>
        {data?.prefillAvailable ? (
          <p className="text-sm text-muted-foreground">
            Your baseline consent is active, so we can prefill land area, plot reference and village
            from your own farm record. You can edit every field before submitting.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Prefill unavailable ({(data?.prefillBlockedReason ?? "unknown").replaceAll("_", " ")}).
            You can still apply and type the values yourself.{" "}
            <Link to="/consent" className="underline">
              Review consent
            </Link>{" "}
            or{" "}
            <Link to="/farm" className="underline">
              add a farm parcel
            </Link>
            .
          </p>
        )}
      </section>

      <section className="space-y-4">
        {(data?.schemes ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No published schemes are open in your district yet.
          </p>
        ) : (
          data?.schemes.map((s) => {
            const existing = data.applications.find((a) => a.scheme_id === s.id);
            const fields = s.version?.form_fields ?? [];
            return (
              <article key={s.id} className="panel space-y-3 p-5">
                <header className="flex flex-wrap items-center gap-3">
                  <h3 className="font-display text-base font-semibold">{s.title}</h3>
                  <span className="text-xs text-muted-foreground">
                    v{s.current_version} · {s.code}
                  </span>
                  {existing ? <StateBadge state={existing.status} /> : null}
                </header>
                <p className="text-sm text-muted-foreground">{s.summary}</p>
                {s.version?.rules.length ? (
                  <ul className="list-disc pl-5 text-xs text-muted-foreground">
                    {s.version.rules.map((r) => (
                      <li key={r.key}>
                        {r.label}
                        {r.severity === "advisory" ? " (helps, not required)" : ""}
                      </li>
                    ))}
                  </ul>
                ) : null}

                {existing ? (
                  <p className="text-sm">
                    You applied on {new Date(existing.created_at).toLocaleDateString()}. A government
                    reviewer decides this application.
                    {existing.decision_note ? ` Note: ${existing.decision_note}` : ""}
                  </p>
                ) : openScheme === s.id ? (
                  <div className="space-y-3">
                    {fields.map((f) => (
                      <div key={f.name} className="space-y-1">
                        <label className="text-sm font-medium" htmlFor={`${s.id}-${f.name}`}>
                          {f.label}
                          {f.required ? " *" : ""}
                        </label>
                        <input
                          id={`${s.id}-${f.name}`}
                          className="field-base"
                          type={f.type === "number" ? "number" : "text"}
                          value={String(values[f.name] ?? "")}
                          onChange={(e) =>
                            setValues({
                              ...values,
                              [f.name]:
                                f.type === "number"
                                  ? e.target.value === ""
                                    ? ""
                                    : Number(e.target.value)
                                  : e.target.value,
                            })
                          }
                        />
                      </div>
                    ))}
                    <div className="flex flex-wrap gap-2">
                      <Button
                        onClick={() => submitMutation.mutate(s.id)}
                        disabled={submitMutation.isPending}
                      >
                        Submit application
                      </Button>
                      <Button variant="outline" onClick={() => setOpenScheme(null)}>
                        Cancel
                      </Button>
                    </div>
                    <p className="field-hint">
                      Submitting records the scheme version your application was checked against.
                      Eligibility hints never decide the outcome.
                    </p>
                  </div>
                ) : (
                  <Button
                    onClick={() => {
                      setOpenScheme(s.id);
                      const prefill = data.prefillAvailable ? data.prefillValues : {};
                      setValues(prefill);
                      setUsedPrefill(data.prefillAvailable);
                    }}
                  >
                    {data.prefillAvailable ? "Apply with prefill" : "Apply"}
                  </Button>
                )}
              </article>
            );
          })
        )}
      </section>
    </main>
  );
}
