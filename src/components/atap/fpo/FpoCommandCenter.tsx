import { useState } from "react";
import {
  ArrowRight,
  BadgeIndianRupee,
  BarChart3,
  Boxes,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  Handshake,
  Landmark,
  Network,
  PackageCheck,
  Scale,
  ShieldCheck,
  Sprout,
  Truck,
  UsersRound,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StateBadge } from "@/components/atap/StatusBadge";
import { FPO_SECTION_DEFS, type FpoSection } from "@/lib/atap/fpo";
import type { FpoOverview } from "@/lib/atap/fpo.functions";
import {
  FPO_CORE_MODULES,
  FPO_DASHBOARD_LENSES,
  FPO_OPERATING_CHAIN,
  buildFpoAttention,
  defaultFpoDashboardLens,
  deriveFpoReadiness,
  type FpoCoreModule,
  type FpoDashboardLens,
} from "@/lib/atap/fpoCommandCenter";

const moduleIcons: Record<FpoCoreModule["key"], LucideIcon> = {
  farmer_360: UsersRound,
  crop_intelligence: Sprout,
  inputs: PackageCheck,
  procurement_quality: Scale,
  inventory_traceability: Warehouse,
  market_logistics: Truck,
  finance: BadgeIndianRupee,
  insurance: ShieldCheck,
  governance: Landmark,
  revenue_intelligence: BarChart3,
};

function numericMetric(overview: FpoOverview, key: string): number {
  const raw = overview.metrics.find((metric) => metric.key === key)?.value ?? "0";
  return Number(raw.replace(/[^0-9.-]/g, "")) || 0;
}

function sectionLabel(section: FpoSection): string {
  return FPO_SECTION_DEFS.find((item) => item.key === section)?.label ?? section;
}

function ReadinessRing({ score }: { score: number }) {
  return (
    <div
      className="relative grid h-32 w-32 shrink-0 place-items-center rounded-full"
      style={{
        background: `conic-gradient(var(--color-accent) ${score * 3.6}deg, color-mix(in oklab, var(--color-surface-deep-foreground) 18%, transparent) 0deg)`,
      }}
      role="img"
      aria-label={`Operating readiness ${score}%`}
    >
      <div className="grid h-24 w-24 place-items-center rounded-full bg-surface-deep text-center text-surface-deep-foreground">
        <div>
          <p className="text-3xl font-bold tabular-nums">{score}%</p>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-75">
            readiness
          </p>
        </div>
      </div>
    </div>
  );
}

function ReadinessBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="text-surface-deep-foreground/75">{label}</span>
        <strong className="text-surface-deep-foreground">{value}%</strong>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-deep-foreground/15">
        <div className="h-full rounded-full bg-accent" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

export function FpoCommandCenter({
  overview,
  onOpenSection,
}: {
  overview: FpoOverview;
  onOpenSection: (section: FpoSection) => void;
}) {
  const [lens, setLens] = useState<FpoDashboardLens>(() => defaultFpoDashboardLens(overview.roles));
  const complianceActions = numericMetric(overview, "compliance");
  const readiness = deriveFpoReadiness({
    onboardingCompleteness: overview.completeness,
    totalMembers: overview.memberCounts.total,
    activeMembers: overview.memberCounts.active,
    missingDocuments: overview.missingDocuments.length,
    complianceActions,
  });
  const attention = buildFpoAttention({
    completeness: overview.completeness,
    missingDocuments: overview.missingDocuments,
    metrics: overview.metrics,
  });
  const activeLens =
    FPO_DASHBOARD_LENSES.find((item) => item.key === lens) ?? FPO_DASHBOARD_LENSES[0]!;
  const organization = overview.profile?.display_name ?? overview.tenants[0]?.name ?? "FPO";
  const topMetrics = overview.metrics.filter((metric) => !metric.pending).slice(0, 6);

  return (
    <div className="space-y-7">
      <section className="overflow-hidden rounded-2xl bg-surface-deep text-surface-deep-foreground shadow-raised">
        <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <div className="mb-5 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-surface-deep-foreground/20 bg-surface-deep-foreground/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]">
                FPO intelligence & governance
              </span>
              {overview.profile ? <StateBadge state={overview.profile.state} /> : null}
            </div>
            <p className="text-sm font-semibold text-accent">{organization}</p>
            <h2 className="mt-2 max-w-2xl text-3xl font-bold leading-tight sm:text-4xl">
              Run the farmer-to-market business from one operating view.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-surface-deep-foreground/70">
              Connect membership, crop plans, inputs, aggregation, quality, buyers, settlements and
              governance without re-entering the same record in separate systems.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Button
                className="bg-accent text-accent-foreground hover:bg-accent/90"
                onClick={() => onOpenSection(attention[0]?.section ?? "insights")}
              >
                Review priority work <ArrowRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="border-surface-deep-foreground/25 bg-transparent text-surface-deep-foreground hover:bg-surface-deep-foreground/10 hover:text-surface-deep-foreground"
                onClick={() => onOpenSection("insights")}
              >
                Open operational insights
              </Button>
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-[auto_minmax(12rem,1fr)] lg:grid-cols-1 xl:grid-cols-[auto_13rem] xl:items-center">
            <ReadinessRing score={readiness.score} />
            <div className="space-y-3">
              <ReadinessBar label="Organization setup" value={readiness.onboarding} />
              <ReadinessBar label="Active members" value={readiness.memberActivation} />
              <ReadinessBar label="Required documents" value={readiness.compliance} />
              <p className="pt-1 text-[10px] leading-4 text-surface-deep-foreground/55">
                DERIVED operating readiness only. It is not a credit, scheme, insurance or
                governance decision score.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="fpo-snapshot-title">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Observed organization snapshot
            </p>
            <h2 id="fpo-snapshot-title" className="mt-1 text-xl font-semibold">
              What is recorded now
            </h2>
          </div>
          <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground">
            OBSERVED + transparent derivations
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {topMetrics.map((metric) => (
            <button
              key={metric.key}
              type="button"
              onClick={() => onOpenSection(metric.section)}
              className="panel group p-4 text-left transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-raised"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {metric.label}
                  </p>
                  <p className="mt-2 text-2xl font-bold tabular-nums">{metric.value}</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
              </div>
            </button>
          ))}
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="panel p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-status-pending p-2 text-status-pending-foreground">
              <ClipboardCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Attention queue
              </p>
              <h2 className="text-lg font-semibold">Act before work becomes a bottleneck</h2>
            </div>
          </div>
          <ol className="mt-5 space-y-2">
            {attention.map((item, index) => (
              <li key={item.key}>
                <button
                  type="button"
                  onClick={() => onOpenSection(item.section)}
                  className="flex w-full items-center gap-3 rounded-xl border border-border p-3 text-left transition hover:border-primary/35 hover:bg-secondary/60"
                >
                  <span
                    className={
                      item.tone === "urgent"
                        ? "grid h-8 w-8 shrink-0 place-items-center rounded-full bg-status-rejected text-xs font-bold text-status-rejected-foreground"
                        : item.tone === "ready"
                          ? "grid h-8 w-8 shrink-0 place-items-center rounded-full bg-status-activated text-status-activated-foreground"
                          : "grid h-8 w-8 shrink-0 place-items-center rounded-full bg-status-pending text-xs font-bold text-status-pending-foreground"
                    }
                  >
                    {item.tone === "ready" ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
                  </span>
                  <span className="min-w-0 flex-1 text-sm font-medium">{item.label}</span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              </li>
            ))}
          </ol>
        </div>

        <div className="panel p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-status-activated p-2 text-status-activated-foreground">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Role view
              </p>
              <h2 className="text-lg font-semibold">Focus the dashboard on your work</h2>
            </div>
          </div>
          <div
            className="mt-4 flex flex-wrap gap-2"
            role="tablist"
            aria-label="Dashboard role view"
          >
            {FPO_DASHBOARD_LENSES.map((item) => (
              <button
                key={item.key}
                type="button"
                role="tab"
                aria-selected={item.key === lens}
                onClick={() => setLens(item.key)}
                className={
                  item.key === lens
                    ? "rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                    : "rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-secondary"
                }
              >
                {item.label}
              </button>
            ))}
          </div>
          <p className="mt-4 text-sm leading-6 text-muted-foreground">{activeLens.description}</p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {activeLens.sections.map((section) => (
              <button
                key={section}
                type="button"
                onClick={() => onOpenSection(section)}
                className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-left text-sm font-medium transition hover:border-primary/35 hover:bg-secondary"
              >
                <span>{sectionLabel(section)}</span>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            ))}
          </div>
          <p className="mt-4 text-[11px] leading-4 text-muted-foreground">
            A role view changes presentation only. Server-side permissions continue to decide what
            each person may read or change.
          </p>
        </div>
      </section>

      <section aria-labelledby="operating-chain-title">
        <div className="mb-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Enter once, reuse everywhere
          </p>
          <h2 id="operating-chain-title" className="mt-1 text-xl font-semibold">
            Farmer-to-market operating chain
          </h2>
        </div>
        <div className="overflow-x-auto pb-2">
          <ol className="flex min-w-max items-stretch gap-2">
            {FPO_OPERATING_CHAIN.map((stage, index) => (
              <li key={stage.key} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onOpenSection(stage.section)}
                  className="h-full w-44 rounded-xl border border-border bg-card p-4 text-left shadow-card transition hover:border-primary/40 hover:shadow-raised"
                >
                  <span className="text-xs font-bold text-primary">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <p className="mt-2 text-sm font-semibold">{stage.label}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{stage.detail}</p>
                </button>
                {index < FPO_OPERATING_CHAIN.length - 1 ? (
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground/55" />
                ) : null}
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section aria-labelledby="core-modules-title">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Digital core
            </p>
            <h2 id="core-modules-title" className="mt-1 text-xl font-semibold">
              Ten connected operating modules
            </h2>
          </div>
          <p className="max-w-md text-xs leading-5 text-muted-foreground">
            “Foundation” means the transaction trail exists, but prediction or external ecosystem
            integration is not yet production-ready.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {FPO_CORE_MODULES.map((module) => {
            const Icon = moduleIcons[module.key];
            return (
              <button
                key={module.key}
                type="button"
                onClick={() => onOpenSection(module.section)}
                className="panel group flex gap-4 p-5 text-left transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-raised"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-secondary text-secondary-foreground transition group-hover:bg-primary group-hover:text-primary-foreground">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center justify-between gap-2">
                    <strong className="text-sm">{module.title}</strong>
                    <span
                      className={
                        module.status === "operational"
                          ? "rounded-full bg-status-activated px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-status-activated-foreground"
                          : "rounded-full bg-status-pending px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-status-pending-foreground"
                      }
                    >
                      {module.status}
                    </span>
                  </span>
                  <span className="mt-2 block text-xs leading-5 text-muted-foreground">
                    {module.description}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="grid gap-4 rounded-2xl border border-border bg-secondary/45 p-5 sm:grid-cols-[auto_1fr_auto] sm:items-center sm:p-6">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-card text-primary shadow-card">
          <Network className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-base font-semibold">Prediction is staged behind evidence</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Yield, price, demand, spoilage, logistics and cash-flow forecasts will activate only
            after validated farm, weather, market, warehouse and finance feeds are connected.
            Recommendations will remain decision-support for authorized people.
          </p>
        </div>
        <Button variant="outline" onClick={() => onOpenSection("insights")}>
          <Boxes className="h-4 w-4" /> Review data foundation
        </Button>
      </section>

      <section className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-5 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Purpose-scoped farmer access
        </span>
        <span className="inline-flex items-center gap-1.5">
          <FileCheck2 className="h-3.5 w-3.5 text-primary" /> Audited sensitive actions
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Handshake className="h-3.5 w-3.5 text-primary" /> Human commercial decisions
        </span>
      </section>
    </div>
  );
}
