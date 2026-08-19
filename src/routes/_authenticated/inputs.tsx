import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { PageHeader } from "@/components/atap/AppShell";
import { useLanguage } from "@/components/atap/LanguageProvider";
import { getInputAdvisor } from "@/lib/atap/practice.functions";
import type { InputCategory } from "@/lib/atap/practice";

export const Route = createFileRoute("/_authenticated/inputs")({
  head: () => ({
    meta: [
      { title: "Inputs, nutrients & crop protection — AgriGhar ATAP" },
      {
        name: "description",
        content:
          "Generic nutrient plans, organic and bio-input alternatives, infestation guidance and sellers carrying the same generic input.",
      },
      { property: "og:title", content: "Inputs, nutrients & crop protection — AgriGhar ATAP" },
      {
        property: "og:description",
        content: "Advisory nutrient and protection guidance with indicative cost bands.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: InputsPage,
});

function inr(minor: number) {
  return `₹${(minor / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function InputsPage() {
  const { locale, t } = useLanguage();
  const fetchAdvisor = useServerFn(getInputAdvisor);
  const [crop, setCrop] = useState<string | undefined>();
  const [growthStage, setStage] = useState<string | undefined>();
  const [mode, setMode] = useState<InputCategory>("conventional");
  const [areaHectares, setArea] = useState(1);
  const [infestationId, setInfestationId] = useState<string | undefined>();

  const advisor = useQuery({
    queryKey: ["atap", "input-advisor", locale, crop, growthStage, mode, areaHectares, infestationId],
    queryFn: () =>
      fetchAdvisor({
        data: {
          locale,
          mode,
          areaHectares,
          ...(crop ? { crop } : {}),
          ...(growthStage ? { growthStage } : {}),
          ...(infestationId ? { infestationId } : {}),
        },
      }),
  });

  const data = advisor.data;

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-6 py-8">
      <PageHeader
        eyebrow="B2B · Input & protection advisor"
        title={t("inputs.title")}
        description={t("inputs.description")}
      />

      <section className="rounded-xl border border-border bg-card p-5">
        <div className="grid gap-4 sm:grid-cols-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium">{t("common.crop")}</span>
            <select
              className="field-base"
              value={data?.crop ?? ""}
              onChange={(e) => {
                setCrop(e.target.value);
                setStage(undefined);
                setInfestationId(undefined);
              }}
            >
              {(data?.crops ?? []).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">{t("common.stage")}</span>
            <select
              className="field-base"
              value={data?.growthStage ?? ""}
              onChange={(e) => setStage(e.target.value)}
            >
              {(data?.stages ?? []).map((s) => (
                <option key={s} value={s}>
                  {s.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">{t("common.area")}</span>
            <input
              type="number"
              min={0.1}
              step={0.1}
              className="field-base"
              value={areaHectares}
              onChange={(e) => setArea(Math.max(0.1, Number(e.target.value) || 0.1))}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Mode</span>
            <select
              className="field-base"
              value={mode}
              onChange={(e) => setMode(e.target.value as InputCategory)}
            >
              <option value="conventional">{t("inputs.mode.conventional")}</option>
              <option value="organic">{t("inputs.mode.organic")}</option>
            </select>
          </label>
        </div>
        <p className="mt-3 rounded-md border border-border bg-muted/50 p-3 text-sm">
          {t("inputs.advisoryNote")}
        </p>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="font-display text-lg font-semibold">{t("inputs.nutrientPlan")}</h2>
        {data && (
          <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
            Derived scenario · {t("common.cost")} {inr(data.plan.costMinMinor)} –{" "}
            {inr(data.plan.costMaxMinor)}
          </p>
        )}
        <ul className="mt-4 space-y-3">
          {(data?.plan.lines ?? []).map((line) => (
            <li key={line.product.code} className="rounded-lg border border-border p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-medium">
                  {line.product.genericName}{" "}
                  <span className="text-xs text-muted-foreground">
                    ({t("inputs.nutrient")}: {line.nutrient})
                  </span>
                </span>
                <span className="text-sm">
                  {line.quantity} {line.unit} · {inr(line.costMinMinor)} – {inr(line.costMaxMinor)}
                </span>
              </div>
              {line.product.brandNames.length > 0 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("inputs.brands")}: {line.product.brandNames.join(", ")}
                </p>
              )}
              {line.product.preparationNotes && (
                <p className="mt-1 text-sm text-muted-foreground">{line.product.preparationNotes}</p>
              )}
              <p className="mt-2 text-xs text-muted-foreground">
                {t("inputs.sellers")}:{" "}
                {line.sellers.length === 0
                  ? t("inputs.noSellers")
                  : line.sellers.map((s) => s.title).join(" · ")}
              </p>
            </li>
          ))}
        </ul>
        {data && (
          <p className="mt-4 text-sm text-muted-foreground">
            {t("inputs.compare")}: {inr(data.comparison.conventionalMinor)} vs{" "}
            {inr(data.comparison.organicMinor)} — {data.comparison.cheaperMode} is cheaper (
            {Math.abs(data.comparison.differencePct)}%). Derived scenario, not a market price.
          </p>
        )}
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="font-display text-lg font-semibold">{t("inputs.infestation")}</h2>
        <div className="mt-3 grid gap-4 lg:grid-cols-[minmax(0,20rem)_1fr]">
          <ul className="space-y-2">
            {(data?.infestations ?? []).map((i) => (
              <li key={i.id}>
                <button
                  type="button"
                  onClick={() => setInfestationId(i.id)}
                  className={`w-full rounded-md border p-3 text-left text-sm ${
                    (data?.selectedInfestationId ?? "") === i.id
                      ? "border-primary bg-secondary"
                      : "border-border"
                  }`}
                >
                  <span className="font-medium">{i.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {i.kind} · {i.severity} · {t("inputs.symptoms")}: {i.symptoms.join(", ")}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <ul className="space-y-3">
            {(data?.treatmentOptions ?? []).map((o) => (
              <li key={`${o.productCode}-${o.unit}`} className="rounded-lg border border-border p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium">{o.product.genericName}</span>
                  <span className="text-sm">
                    {o.quantity} {o.unit} · {inr(o.costMinMinor)} – {inr(o.costMaxMinor)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {o.isOrganic ? t("inputs.mode.organic") : t("inputs.mode.conventional")} ·{" "}
                  {t("inputs.safetyInterval")}: {o.safetyIntervalDays}
                  {o.reentryNote ? ` · ${t("inputs.reentry")}: ${o.reentryNote}` : ""}
                </p>
                <p className="mt-2 rounded-md border border-border bg-muted/50 p-2 text-xs">
                  {o.humanConfirmation}
                </p>
              </li>
            ))}
            {(data?.treatmentOptions ?? []).length === 0 && (
              <li className="text-sm text-muted-foreground">{t("practices.empty")}</li>
            )}
          </ul>
        </div>
      </section>
    </div>
  );
}
