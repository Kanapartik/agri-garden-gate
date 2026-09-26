import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useLanguage } from "@/components/atap/LanguageProvider";
import { PageHeader } from "@/components/atap/AppShell";
import { Button } from "@/components/ui/button";
import {
  computeCropOutcomeScenarios,
  computeValueAddScenario,
  escalateToHuman,
  getFarmIntelligence,
  refreshFarmObservations,
  type FarmIntelligence,
  type PriceView,
  type ValueAddView,
} from "@/lib/atap/intelligence.functions";
import {
  ESCALATION_FACILITY_KINDS,
  ESCALATION_LABEL,
  PRICE_LABEL_HELP,
  PRICE_LABEL_TEXT,
  confidenceLabel,
  freshnessLabel,
  type EscalationKind,
  type OutcomeScenario,
  type PriceLabel,
} from "@/lib/atap/intelligence";

export const Route = createFileRoute("/_authenticated/intelligence")({
  head: () => ({
    meta: [
      { title: "My Farm Intelligence — AgriGhar ATAP" },
      {
        name: "description",
        content:
          "Location, weather, soil, crop suitability, mandi prices, value-add economics and outcome scenarios collated for your farm — with every number labelled and sourced.",
      },
      { property: "og:title", content: "My Farm Intelligence — AgriGhar ATAP" },
      {
        property: "og:description",
        content:
          "One farm workspace instead of many portals: observed prices, forecasts and derived scenarios stay clearly separated.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: IntelligencePage,
});

const SECTIONS = [
  { key: "location", label: "Location & season" },
  { key: "weather", label: "Weather" },
  { key: "soil", label: "Soil" },
  { key: "crops", label: "Crop planning" },
  { key: "market", label: "Market" },
  { key: "valueadd", label: "Value-add" },
  { key: "planner", label: "Outcome planner" },
  { key: "nearby", label: "Nearby & help" },
] as const;

type SectionKey = (typeof SECTIONS)[number]["key"];

function rupees(n: number): string {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

/** No monetary value renders without its label — the core B2A design rule. */
function PriceTag({ label }: { label: PriceLabel }) {
  const tone =
    label === "observed"
      ? "bg-primary/10 text-primary"
      : label === "forecast"
        ? "bg-accent text-accent-foreground"
        : "bg-secondary text-secondary-foreground";
  return (
    <span
      title={PRICE_LABEL_HELP[label]}
      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${tone}`}
    >
      {PRICE_LABEL_TEXT[label]}
    </span>
  );
}

function Card({ title, children, note }: { title: string; children: React.ReactNode; note?: string }) {
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      {note ? <p className="mt-1 text-xs text-muted-foreground">{note}</p> : null}
      <div className="mt-3 text-sm">{children}</div>
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-sm text-muted-foreground">{text}</p>;
}

function IntelligencePage() {
  const { t } = useLanguage();
  const fetchIntel = useServerFn(getFarmIntelligence);
  const queryClient = useQueryClient();
  const [farmId, setFarmId] = useState<string | null>(null);
  const [section, setSection] = useState<SectionKey>("location");

  const intel = useQuery({
    queryKey: ["atap", "farm-intelligence", farmId],
    queryFn: () => fetchIntel({ data: { farmId } }),
  });

  const data = intel.data as FarmIntelligence | undefined;

  const refresh = useMutation({
    mutationFn: useServerFn(refreshFarmObservations),
    onSuccess: (res: { stored: number; soilBasis: string }) => {
      toast.success(`Stored ${res.stored} fresh observations (soil basis: ${res.soilBasis}).`);
      void queryClient.invalidateQueries({ queryKey: ["atap", "farm-intelligence"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (intel.isPending) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-10">
        <Empty text="Collating your farm information…" />
      </main>
    );
  }

  if (intel.isError || !data) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-10">
        <Empty text="We could not load your farm intelligence right now. Please try again." />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-6 py-10">
      <PageHeader
        eyebrow={t("intel.eyebrow")}
        title={t("intel.title")}
        description={t("intel.description")}
        actions={
          data.farmId ? (
            <Button
              size="sm"
              variant="outline"
              disabled={refresh.isPending}
              onClick={() => refresh.mutate({ data: { farmId: data.farmId! } })}
            >
              {refresh.isPending ? "Refreshing…" : "Refresh data"}
            </Button>
          ) : undefined
        }
      />

      {data.parcels.length === 0 ? (
        <Card title={t("intel.noParcel")}>
          <Empty text="Capture a farm parcel first — location is what unlocks this workspace. Go to My farm to add one." />
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">{t("intel.parcel")}</span>
            {data.parcels.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setFarmId(p.id)}
                className={`rounded-md border px-2.5 py-1.5 text-xs ${
                  (data.farmId ?? "") === p.id
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground"
                }`}
              >
                {p.label} · {p.plotRef}
              </button>
            ))}
          </div>

          <nav className="flex flex-wrap gap-1 border-b border-border pb-2" aria-label="Farm intelligence sections">
            {SECTIONS.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setSection(s.key)}
                className={`rounded-md px-2.5 py-1.5 text-sm ${
                  section === s.key
                    ? "bg-secondary text-secondary-foreground"
                    : "text-muted-foreground hover:bg-secondary"
                }`}
              >
                {t(`intel.tab.${s.key}`)}
              </button>
            ))}
          </nav>

          {section === "location" ? <LocationSection data={data} /> : null}
          {section === "weather" ? <WeatherSection data={data} /> : null}
          {section === "soil" ? <SoilSection data={data} /> : null}
          {section === "crops" ? <CropSection data={data} /> : null}
          {section === "market" ? <MarketSection prices={data.prices} /> : null}
          {section === "valueadd" ? <ValueAddSection data={data} /> : null}
          {section === "planner" ? <PlannerSection data={data} /> : null}
          {section === "nearby" ? <NearbySection data={data} /> : null}

          <p className="text-xs text-muted-foreground">
            All external readings in this environment are synthetic and served through adapters (agromet, soil health
            card, district profile, mandi price, FPO registry). Nothing here is an authoritative government record and
            no scheme, credit or insurance outcome is decided from it.
          </p>
        </>
      )}
    </main>
  );
}

function LocationSection({ data }: { data: FarmIntelligence }) {
  const { t } = useLanguage();
  const loc = data.location;
  if (!loc) return <Empty text="No location resolved for this parcel yet." />;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card title={t("intel.resolved")} note={`Source ${loc.sourceKey}`}>
        <dl className="grid grid-cols-2 gap-y-2 text-sm">
          <dt className="text-muted-foreground">{t("intel.village")}</dt>
          <dd>{loc.villageName ?? loc.villageCode ?? "Not recorded"}</dd>
          <dt className="text-muted-foreground">{t("intel.block")}</dt>
          <dd>{loc.blockName ?? "Not recorded"}</dd>
          <dt className="text-muted-foreground">{t("intel.district")}</dt>
          <dd>{loc.districtName ?? "Not resolved"}</dd>
          <dt className="text-muted-foreground">{t("intel.state")}</dt>
          <dd>{loc.stateName ?? "Not resolved"}</dd>
          <dt className="text-muted-foreground">{t("intel.centroid")}</dt>
          <dd>
            {loc.lat.toFixed(4)}, {loc.lng.toFixed(4)}
          </dd>
          <dt className="text-muted-foreground">{t("intel.zone")}</dt>
          <dd>{loc.agroClimaticZone}</dd>
        </dl>
      </Card>
      <Card title={t("intel.seasonBasis")}>
        <p>
          <strong>{loc.seasonLabel}</strong> — sowing {loc.sowingWindow}, harvest {loc.harvestWindow}.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Major soils here: {loc.majorSoils.join(", ") || "not recorded"}. Common irrigation:{" "}
          {loc.irrigationSources.join(", ") || "not recorded"}.
        </p>
      </Card>
    </div>
  );
}

function WeatherSection({ data }: { data: FarmIntelligence }) {
  const { t } = useLanguage();
  const w = data.weather;
  if (!w) return <Empty text="No agromet reading available." />;
  return (
    <div className="space-y-4">
      <Card
        title={t("intel.current")}
        note={`${w.envelope.sourceKey} · ${freshnessLabel(w.envelope.freshnessSeconds)} · ${confidenceLabel(
          w.envelope.confidence,
        )}`}
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label={t("intel.temp")} value={`${w.current.temperatureC} °C`} />
          <Stat label={t("intel.humidity")} value={`${w.current.humidityPct} %`} />
          <Stat label={t("intel.rain")} value={`${w.current.rainfallMm24h} mm`} />
          <Stat label={t("intel.wind")} value={`${w.current.windKph} kph`} />
        </div>
      </Card>
      <Card title={t("intel.outlook")} note={t("intel.outlookNote")}>
        <ul className="space-y-1">
          {w.forecast.map((f) => (
            <li key={f.date} className="flex flex-wrap gap-x-4 text-sm">
              <span className="font-medium">{f.date}</span>
              <span>{f.conditions}</span>
              <span className="text-muted-foreground">
                {f.minC}–{f.maxC} °C · {f.rainfallMm} mm
              </span>
            </li>
          ))}
        </ul>
      </Card>
      {w.advisories.length > 0 ? (
        <Card title={t("intel.agromet")} note={t("intel.agrometNote")}>
          <ul className="list-disc space-y-1 pl-5">
            {w.advisories.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-secondary/50 p-2">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  );
}

function SoilSection({ data }: { data: FarmIntelligence }) {
  const { t } = useLanguage();
  const soil = data.soil;
  if (!soil) return <Empty text="No soil information available." />;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card
        title={soil.basis === "lab_tested" ? "Laboratory result for this farm" : "General soil information (location)"}
        note={soil.basisNote}
      >
        {soil.lab ? (
          <dl className="grid grid-cols-2 gap-y-2">
            <dt className="text-muted-foreground">{t("intel.lab")}</dt>
            <dd>{soil.lab.labName}</dd>
            <dt className="text-muted-foreground">{t("intel.testedOn")}</dt>
            <dd>{soil.lab.testedOn}</dd>
            <dt className="text-muted-foreground">pH</dt>
            <dd>{soil.lab.ph}</dd>
            <dt className="text-muted-foreground">{t("intel.oc")}</dt>
            <dd>{soil.lab.organicCarbonPct} %</dd>
            <dt className="text-muted-foreground">N / P / K</dt>
            <dd>
              {soil.lab.nitrogen} / {soil.lab.phosphorus} / {soil.lab.potassium}
            </dd>
          </dl>
        ) : (
          <Empty text="No Soil Health Card or laboratory test on record for this parcel." />
        )}
      </Card>
      <Card title={t("intel.soilCtx")} note={`Source ${soil.general.sourceKey}`}>
        <dl className="grid grid-cols-2 gap-y-2">
          <dt className="text-muted-foreground">{t("intel.majorSoils")}</dt>
          <dd>{soil.general.majorSoils.join(", ")}</dd>
          <dt className="text-muted-foreground">{t("intel.texture")}</dt>
          <dd>{soil.general.texture}</dd>
          <dt className="text-muted-foreground">{t("intel.ph")}</dt>
          <dd>{soil.general.phRange}</dd>
          <dt className="text-muted-foreground">{t("intel.oc")}</dt>
          <dd>{soil.general.organicCarbonRange}</dd>
        </dl>
      </Card>
    </div>
  );
}

function CropSection({ data }: { data: FarmIntelligence }) {
  const { t } = useLanguage();
  if (data.crops.length === 0) return <Empty text="No crop candidates for this location yet." />;
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Decision support only, ranked with a visible factor breakdown. Nothing here approves a scheme, a loan or an
        insurance claim.
      </p>
      {data.crops.map((c) => (
        <Card
          key={`${c.crop}-${c.variety ?? "any"}`}
          title={`${c.crop}${c.variety ? ` · ${c.variety}` : ""} — score ${c.score}/100`}
          note={`${confidenceLabel(c.confidence)} · soil basis: ${
            c.soilBasis === "lab_tested" ? "laboratory tested" : "inferred from location"
          } · ${freshnessLabel(c.freshnessSeconds)}`}
        >
          <p>{c.explanation}</p>
          <div className="mt-3 space-y-1">
            {c.factors.map((f) => (
              <div key={f.key} className="flex items-center gap-2 text-xs">
                <span className="w-52 shrink-0 text-muted-foreground">{f.label}</span>
                <span className="h-1.5 w-40 overflow-hidden rounded bg-secondary">
                  <span className="block h-full bg-primary" style={{ width: `${Math.round(f.score * 100)}%` }} />
                </span>
                <span className="text-muted-foreground">weight {Math.round(f.weight * 100)}%</span>
              </div>
            ))}
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                What would change this
              </p>
              <ul className="mt-1 list-disc pl-5 text-xs">
                {c.changeFactors.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("intel.sources")}</p>
              <ul className="mt-1 list-disc pl-5 text-xs text-muted-foreground">
                {c.sources.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

function MarketSection({ prices }: { prices: PriceView[] }) {
  const { t } = useLanguage();
  if (prices.length === 0) return <Empty text="No mandi price observations for this area yet." />;
  return (
    <Card
      title={t("intel.mandi")}
      note="OBSERVED prices are what markets actually reported, with the date and source. Forecasts and derived scenarios are never shown as observed prices."
    >
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="py-1 pr-3">{t("intel.market")}</th>
              <th className="py-1 pr-3">{t("intel.commodity")}</th>
              <th className="py-1 pr-3">{t("intel.modal")}</th>
              <th className="py-1 pr-3">{t("intel.range")}</th>
              <th className="py-1 pr-3">{t("intel.arrivals")}</th>
              <th className="py-1 pr-3">{t("intel.date")}</th>
              <th className="py-1 pr-3">{t("intel.label")}</th>
              <th className="py-1 pr-3">{t("intel.distance")}</th>
            </tr>
          </thead>
          <tbody>
            {prices.map((p) => (
              <tr key={p.id} className="border-t border-border/60">
                <td className="py-1.5 pr-3">
                  {p.marketName}
                  <span className="block text-xs text-muted-foreground">
                    {p.districtName ?? ""} {p.stateName ? `· ${p.stateName}` : ""}
                  </span>
                </td>
                <td className="py-1.5 pr-3">
                  {p.commodity}
                  {p.variety ? <span className="block text-xs text-muted-foreground">{p.variety}</span> : null}
                </td>
                <td className="py-1.5 pr-3">{p.modalPrice === null ? "—" : `${rupees(p.modalPrice)}/${p.unit}`}</td>
                <td className="py-1.5 pr-3 text-xs text-muted-foreground">
                  {p.minPrice === null || p.maxPrice === null ? "—" : `${rupees(p.minPrice)} – ${rupees(p.maxPrice)}`}
                </td>
                <td className="py-1.5 pr-3 text-xs">
                  {p.arrivalsQuantity === null ? "—" : `${p.arrivalsQuantity} ${p.arrivalsUnit ?? ""}`}
                </td>
                <td className="py-1.5 pr-3 text-xs">{p.priceDate}</td>
                <td className="py-1.5 pr-3">
                  <PriceTag label={p.label} />
                </td>
                <td className="py-1.5 pr-3 text-xs">{p.distanceKm === null ? "—" : `${Math.round(p.distanceKm)} km`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function ValueAddSection({ data }: { data: FarmIntelligence }) {
  const { t } = useLanguage();
  const compute = useServerFn(computeValueAddScenario);
  const [pathId, setPathId] = useState(data.processingPaths[0]?.id ?? "");
  const [quintal, setQuintal] = useState(100);
  const [packaging, setPackaging] = useState(40);
  const [transport, setTransport] = useState(30);
  const [result, setResult] = useState<ValueAddView | null>(null);

  const run = useMutation({
    mutationFn: () =>
      compute({
        data: {
          farmId: data.farmId!,
          pathId,
          inputQuintal: quintal,
          packagingPerQuintal: packaging,
          transportPerQuintal: transport,
        },
      }),
    onSuccess: (res) => setResult(res),
    onError: (e: Error) => toast.error(e.message),
  });

  const path = useMemo(() => data.processingPaths.find((p) => p.id === pathId), [data.processingPaths, pathId]);

  if (data.processingPaths.length === 0) {
    return <Empty text="No processing path is configured for your commodities yet." />;
  }

  return (
    <div className="space-y-4">
      <Card
        title={t("intel.vaEcon")}
        note="Every output here is a DERIVED SCENARIO. Recovery percentages and costs come from the configured processing path — a processor or FPO quotation replaces them, they are never hard-coded."
      >
        <div className="grid gap-3 sm:grid-cols-4">
          <label className="text-xs">
            Processing path
            <select
              value={pathId}
              onChange={(e) => setPathId(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
            >
              {data.processingPaths.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <NumberField label={t("intel.qty")} value={quintal} onChange={setQuintal} />
          <NumberField label={t("intel.packaging")} value={packaging} onChange={setPackaging} />
          <NumberField label={t("intel.transport")} value={transport} onChange={setTransport} />
        </div>
        {path ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Assumption source: <strong>{path.assumptionSource}</strong> ·{" "}
            {path.steps
              .map((s) => `${s.fromProduct} → ${s.toProduct} at ${s.recoveryPct}% recovery, ₹${s.costPerQuintal}/qtl`)
              .join(" · ")}
          </p>
        ) : null}
        <Button size="sm" className="mt-3" disabled={run.isPending} onClick={() => run.mutate()}>
          {run.isPending ? "Calculating…" : "Calculate scenario"}
        </Button>
      </Card>

      {result ? (
        <Card title={`${result.pathLabel} — derived scenario`} note={`Assumption source: ${result.assumptionSource}`}>
          <div className="grid gap-3 sm:grid-cols-3">
            <LabeledStat
              label={t("intel.sellRaw")}
              value={rupees(result.rawRealization.amount)}
              priceLabel={result.rawRealization.label}
            />
            <LabeledStat
              label={t("intel.afterProc")}
              value={rupees(result.estimatedRealization.amount)}
              priceLabel={result.estimatedRealization.label}
            />
            <LabeledStat
              label={t("intel.procPrice")}
              value={
                result.processedObservedPrice
                  ? `${rupees(result.processedObservedPrice.amount)}/${result.processedObservedPrice.unit}`
                  : "No observed price"
              }
              priceLabel={result.processedObservedPrice?.label ?? "derived_scenario"}
            />
          </div>
          <ul className="mt-3 space-y-1 text-xs">
            {result.steps.map((s) => (
              <li key={s.stepOrder}>
                Step {s.stepOrder}: {s.inputQuintal} qtl {s.fromProduct} → {s.outputQuintal} qtl {s.toProduct} at{" "}
                {s.recoveryPct}% recovery; processing {rupees(s.processingCost)}; by-products{" "}
                {rupees(s.byproductValue)}
                {s.byproducts.length > 0
                  ? ` (${s.byproducts.map((b) => `${b.name} ${b.quantityQuintal} qtl`).join(", ")})`
                  : ""}
              </li>
            ))}
          </ul>
          <details className="mt-3 text-xs">
            <summary className="cursor-pointer text-muted-foreground">{t("intel.assumptions")}</summary>
            <ul className="mt-1 space-y-0.5">
              {Object.entries(result.assumptions).map(([k, v]) => (
                <li key={k}>
                  {k}: {String(v)}
                </li>
              ))}
            </ul>
          </details>
        </Card>
      ) : null}
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="text-xs">
      {label}
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
      />
    </label>
  );
}

function LabeledStat({
  label,
  value,
  priceLabel,
}: {
  label: string;
  value: string;
  priceLabel: PriceLabel;
}) {
  return (
    <div className="rounded-md bg-secondary/50 p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-base font-semibold">{value}</p>
      <div className="mt-1">
        <PriceTag label={priceLabel} />
      </div>
    </div>
  );
}

function PlannerSection({ data }: { data: FarmIntelligence }) {
  const { t } = useLanguage();
  const compute = useServerFn(computeCropOutcomeScenarios);
  const [crop, setCrop] = useState(data.crops[0]?.crop ?? data.parcels[0]?.primaryCrop ?? "Paddy");
  const [scenarios, setScenarios] = useState<OutcomeScenario[] | null>(null);
  const [priceMeta, setPriceMeta] = useState<{ label: PriceLabel; source: string } | null>(null);

  const run = useMutation({
    mutationFn: () => compute({ data: { farmId: data.farmId!, crop } }),
    onSuccess: (res) => {
      setScenarios(res.scenarios);
      setPriceMeta({ label: res.priceLabel, source: res.priceSource });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cropOptions = Array.from(
    new Set([...data.crops.map((c) => c.crop), ...(data.parcels.map((p) => p.primaryCrop).filter(Boolean) as string[])]),
  );

  return (
    <div className="space-y-4">
      <Card
        title={t("intel.planner")}
        note="Low / base / high scenarios with break-even price and yield. These are DERIVED SCENARIOS for planning, not a guarantee or an offer."
      >
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs">
            Crop
            <select
              value={crop}
              onChange={(e) => setCrop(e.target.value)}
              className="mt-1 w-56 rounded-md border border-input bg-background px-2 py-1.5 text-sm"
            >
              {cropOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <Button size="sm" disabled={run.isPending} onClick={() => run.mutate()}>
            {run.isPending ? "Planning…" : "Build scenarios"}
          </Button>
        </div>
        {priceMeta ? (
          <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            Selling price basis <PriceTag label={priceMeta.label} /> from {priceMeta.source}
          </p>
        ) : null}
      </Card>

      {scenarios ? (
        <div className="grid gap-4 md:grid-cols-3">
          {scenarios.map((s) => (
            <Card key={s.scenario} title={`${s.scenario.toUpperCase()} case`}>
              <dl className="grid grid-cols-2 gap-y-1 text-xs">
                <dt className="text-muted-foreground">{t("intel.expYield")}</dt>
                <dd>{s.expectedYieldQuintal} qtl</dd>
                <dt className="text-muted-foreground">{t("intel.sellPrice")}</dt>
                <dd className="flex items-center gap-1">
                  {rupees(s.sellingPrice)} <PriceTag label={s.sellingPriceLabel} />
                </dd>
                <dt className="text-muted-foreground">{t("intel.totalCost")}</dt>
                <dd>{rupees(s.totalCost)}</dd>
                <dt className="text-muted-foreground">{t("intel.gross")}</dt>
                <dd>{rupees(s.grossRealization)}</dd>
                <dt className="text-muted-foreground">{t("intel.netContrib")}</dt>
                <dd className="font-semibold">{rupees(s.netContribution)}</dd>
                <dt className="text-muted-foreground">{t("intel.bePrice")}</dt>
                <dd>{rupees(s.breakEvenPrice)}/qtl</dd>
                <dt className="text-muted-foreground">{t("intel.beYield")}</dt>
                <dd>{s.breakEvenYield} qtl</dd>
                <dt className="text-muted-foreground">{t("intel.harvest")}</dt>
                <dd>{s.harvestWindow}</dd>
                <dt className="text-muted-foreground">{t("intel.target")}</dt>
                <dd>{s.targetMarket}</dd>
              </dl>
              <p className="mt-2 text-xs text-muted-foreground">Value-add alternative: {s.valueAddAlternative}</p>
              <ul className="mt-2 list-disc pl-4 text-xs text-muted-foreground">
                {s.risks.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function NearbySection({ data }: { data: FarmIntelligence }) {
  const { t } = useLanguage();
  const escalate = useServerFn(escalateToHuman);
  const queryClient = useQueryClient();
  const [kind, setKind] = useState<EscalationKind>("talk_to_fpo");
  const [message, setMessage] = useState("");

  const facilityKinds = ESCALATION_FACILITY_KINDS[kind];
  const candidates = Object.entries(data.facilities)
    .filter(([group]) => facilityKinds.includes(group))
    .flatMap(([, list]) => list);
  const [facilityId, setFacilityId] = useState<string>("");

  const send = useMutation({
    mutationFn: () =>
      escalate({
        data: {
          farmId: data.farmId!,
          kind,
          facilityId: facilityId || null,
          message: message || null,
        },
      }),
    onSuccess: () => {
      toast.success(t("intel.sent"));
      setMessage("");
      void queryClient.invalidateQueries({ queryKey: ["atap", "farm-intelligence"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        {Object.entries(data.facilities).map(([group, list]) => (
          <Card key={group} title={group.replace(/_/g, " ")}>
            {list.length === 0 ? (
              <Empty text="None recorded nearby." />
            ) : (
              <ul className="space-y-1 text-sm">
                {list.map((f) => (
                  <li key={f.id}>
                    {f.name}
                    <span className="block text-xs text-muted-foreground">
                      {f.district_name}, {f.state_name} · {Math.round(f.distanceKm)} km
                      {f.contact_label ? ` · ${f.contact_label}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ))}
      </div>

      <Card
        title={t("intel.talk")}
        note="Any advisory that could affect credit, insurance, a scheme or a contract is routed to an authorised person — the platform never decides it."
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-xs">
            What do you need?
            <select
              value={kind}
              onChange={(e) => {
                setKind(e.target.value as EscalationKind);
                setFacilityId("");
              }}
              className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
            >
              {(Object.keys(ESCALATION_LABEL) as EscalationKind[]).map((k) => (
                <option key={k} value={k}>
                  {ESCALATION_LABEL[k]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs">
            Facility (optional)
            <select
              value={facilityId}
              onChange={(e) => setFacilityId(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
            >
              <option value="">{t("intel.route")}</option>
              {candidates.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name} ({Math.round(f.distanceKm)} km)
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs">
            Message (optional)
            <input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
              placeholder={t("intel.helpPh")}
            />
          </label>
        </div>
        <Button size="sm" className="mt-3" disabled={send.isPending} onClick={() => send.mutate()}>
          {send.isPending ? "Sending…" : "Send request"}
        </Button>
      </Card>

      <Card title={t("intel.requests")}>
        {data.escalations.length === 0 ? (
          <Empty text="No help requests raised from this workspace yet." />
        ) : (
          <ul className="space-y-1 text-sm">
            {data.escalations.map((e) => (
              <li key={e.id}>
                {ESCALATION_LABEL[e.kind]} · {e.status}
                <span className="block text-xs text-muted-foreground">
                  {new Date(e.createdAt).toLocaleString()} {e.facilityName ? `· ${e.facilityName}` : ""}
                  {e.message ? ` · ${e.message}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
