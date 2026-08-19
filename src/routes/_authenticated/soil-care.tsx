import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { PageHeader } from "@/components/atap/AppShell";
import { useLanguage } from "@/components/atap/LanguageProvider";
import { getSoilCare } from "@/lib/atap/practice.functions";

export const Route = createFileRoute("/_authenticated/soil-care")({
  head: () => ({
    meta: [
      { title: "Soil nutrient retention — AgriGhar ATAP" },
      {
        name: "description",
        content:
          "Soil-type specific nutrient retention practices for organic and bio-input farming, with indicative adoption cost.",
      },
      { property: "og:title", content: "Soil nutrient retention — AgriGhar ATAP" },
      {
        property: "og:description",
        content: "Practices that retain soil nutrients, matched to the soil type on record.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SoilCarePage,
});

function SoilCarePage() {
  const { locale, t } = useLanguage();
  const fetchSoilCare = useServerFn(getSoilCare);
  const [farmId, setFarmId] = useState<string | undefined>();

  const soil = useQuery({
    queryKey: ["atap", "soil-care", locale, farmId],
    queryFn: () => fetchSoilCare({ data: { locale, ...(farmId ? { farmId } : {}) } }),
  });

  const data = soil.data;
  const plan = data?.plan;

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-6 py-8">
      <PageHeader
        eyebrow="B2B · Soil care"
        title={t("soil.title")}
        description={t("soil.description")}
      />

      <section className="rounded-xl border border-border bg-card p-5">
        <label className="block max-w-sm">
          <span className="mb-1 block text-sm font-medium">Parcel</span>
          <select
            className="field-base"
            value={data?.farmId ?? ""}
            onChange={(e) => setFarmId(e.target.value)}
          >
            {(data?.parcels ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        {plan && (
          <p className="mt-3 text-sm text-muted-foreground">
            {plan.basis === "lab_tested" ? t("soil.basisLab") : t("soil.basisInferred")} —{" "}
            {plan.basisNote}
          </p>
        )}
        {plan && plan.soilTypes.length > 0 && (
          <p className="mt-2 text-sm">Soil types: {plan.soilTypes.join(", ")}</p>
        )}
        {plan && (
          <p className="mt-2 text-xs uppercase tracking-wide text-muted-foreground">
            Derived scenario · {t("common.cost")} ₹{plan.estimatedCost.amount.toLocaleString("en-IN")}{" "}
            ({plan.estimatedCost.unit})
          </p>
        )}
      </section>

      <ul className="grid gap-4 md:grid-cols-2">
        {(plan?.practices ?? []).map((p) => (
          <li key={p.id} className="rounded-xl border border-border bg-card p-5">
            <h2 className="font-display text-base font-semibold">{p.name}</h2>
            <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{p.body}</p>
            <p className="mt-3 text-xs text-muted-foreground">
              {t("soil.effort")}: {p.effort} · {t("soil.benefit")}: {p.expectedBenefit}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("common.cost")}: ₹{(p.costMinMinor / 100).toLocaleString("en-IN")} – ₹
              {(p.costMaxMinor / 100).toLocaleString("en-IN")}
            </p>
          </li>
        ))}
        {(plan?.practices ?? []).length === 0 && (
          <li className="text-sm text-muted-foreground">{t("soil.empty")}</li>
        )}
      </ul>

      {plan?.recommendSoilTest && (
        <p className="rounded-md border border-border bg-muted/50 p-3 text-sm">
          {t("soil.bookTest")} — a lab result replaces inferred soil information with farm-specific
          rates. {t("common.askKvk")}.
        </p>
      )}
    </div>
  );
}
