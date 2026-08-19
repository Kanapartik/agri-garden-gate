import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/atap/AppShell";
import { StateBadge } from "@/components/atap/StatusBadge";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/components/atap/LanguageProvider";
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
  const { t } = useLanguage();
  const fetchDiscovery = useServerFn(getSchemeDiscovery);
  const submit = useServerFn(submitSchemeApplication);

  const [openScheme, setOpenScheme] = useState<string | null>(null);
  /** Applications are never one-click: the farmer reads a translated summary first. */
  const [step, setStep] = useState<"form" | "review">("form");
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
      toast.success(t("discovery.submitted"));
      setOpenScheme(null);
      setStep("form");
      setValues({});
      await queryClient.invalidateQueries({ queryKey: ["atap", "scheme-discovery"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (discovery.isLoading) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-12 text-sm text-muted-foreground">
        {t("common.loading")}
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl space-y-10 px-6 py-12">
      <PageHeader title={t("discovery.title")} description={t("discovery.description")} />

      <section className="panel space-y-2 p-5">
        <h2 className="font-display text-sm font-semibold">{t("discovery.prefillTitle")}</h2>
        {data?.prefillAvailable ? (
          <p className="text-sm text-muted-foreground">{t("discovery.prefillAvailable")}</p>
        ) : (
          <p className="text-sm text-muted-foreground">
            {t("discovery.prefillBlocked")} (
            {(data?.prefillBlockedReason ?? "unknown").replaceAll("_", " ")}).{" "}
            {t("discovery.prefillBlockedHelp")}{" "}
            <Link to="/consent" className="underline">
              {t("discovery.reviewConsent")}
            </Link>{" "}
            ·{" "}
            <Link to="/farm" className="underline">
              {t("discovery.addParcel")}
            </Link>
          </p>
        )}
      </section>

      <section className="space-y-4">
        {(data?.schemes ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("discovery.empty")}</p>
        ) : (
          data?.schemes.map((s) => {
            const existing = data.applications.find((a) => a.scheme_id === s.id);
            const fields = s.version?.form_fields ?? [];
            const isOpen = openScheme === s.id;
            const missingRequired = fields.filter(
              (f) => f.required && String(values[f.name] ?? "").trim() === "",
            );
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
                        {r.severity === "advisory" ? ` ${t("discovery.advisorySuffix")}` : ""}
                      </li>
                    ))}
                  </ul>
                ) : null}

                {existing ? (
                  <p className="text-sm">
                    {t("discovery.appliedOn")}{" "}
                    {new Date(existing.created_at).toLocaleDateString()}. {t("discovery.humanReview")}
                    {existing.decision_note
                      ? ` ${t("discovery.note")}: ${existing.decision_note}`
                      : ""}
                  </p>
                ) : isOpen && step === "form" ? (
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
                        onClick={() => setStep("review")}
                        disabled={missingRequired.length > 0}
                      >
                        {t("discovery.continueReview")}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setOpenScheme(null);
                          setStep("form");
                        }}
                      >
                        {t("discovery.cancel")}
                      </Button>
                    </div>
                    <p className="field-hint">{t("discovery.submitHint")}</p>
                  </div>
                ) : isOpen ? (
                  <div className="space-y-3">
                    <h4 className="font-display text-sm font-semibold">
                      {t("discovery.reviewTitle")}
                    </h4>
                    <p className="text-sm text-muted-foreground">{t("discovery.reviewHelp")}</p>
                    <dl className="divide-y divide-border rounded-md border border-border">
                      {fields.map((f) => (
                        <div
                          key={f.name}
                          className="flex flex-wrap items-baseline justify-between gap-2 px-3 py-2"
                        >
                          <dt className="text-sm text-muted-foreground">{f.label}</dt>
                          <dd className="text-sm font-medium">
                            {String(values[f.name] ?? "").trim() === ""
                              ? t("discovery.notProvided")
                              : String(values[f.name])}
                          </dd>
                        </div>
                      ))}
                    </dl>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        onClick={() => submitMutation.mutate(s.id)}
                        disabled={submitMutation.isPending}
                      >
                        {t("discovery.confirmSubmit")}
                      </Button>
                      <Button variant="outline" onClick={() => setStep("form")}>
                        {t("discovery.backToEdit")}
                      </Button>
                    </div>
                    <p className="field-hint">{t("discovery.submitHint")}</p>
                  </div>
                ) : (
                  <Button
                    onClick={() => {
                      setOpenScheme(s.id);
                      setStep("form");
                      const prefill = data.prefillAvailable ? data.prefillValues : {};
                      setValues(prefill);
                      setUsedPrefill(data.prefillAvailable);
                    }}
                  >
                    {data.prefillAvailable ? t("discovery.applyPrefill") : t("discovery.apply")}
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
