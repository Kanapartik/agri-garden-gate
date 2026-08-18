import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck, Layers, FileClock, Network } from "lucide-react";
import { PageHeader } from "@/components/atap/AppShell";
import { Button } from "@/components/ui/button";

const TITLE = "AgriGhar ATAP — Neutral Agriculture Aggregation Platform";
const DESCRIPTION =
  "Onboarding-first, neutral agriculture aggregation: purpose-scoped farmer data consent, configurable roles and tenants, and a fully auditable access trail.";

export const Route = createFileRoute("/")({
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
  component: Landing,
});

const pillars = [
  {
    icon: ShieldCheck,
    title: "Default-deny farmer data",
    body: "Every read is purpose-scoped and consent-bound. Paid tiers change rate limits, never consent.",
  },
  {
    icon: Network,
    title: "Access-path neutrality",
    body: "First-party and third-party consumers at the same tier resolve through one identical policy path.",
  },
  {
    icon: Layers,
    title: "Configuration over forks",
    body: "Roles, geography levels and feature activation are configuration records, not code branches.",
  },
  {
    icon: FileClock,
    title: "Auditable by construction",
    body: "Consent decisions, role grants and access evaluations write append-only audit events.",
  },
];

function Landing() {
  return (
    <main>
      <section className="bg-surface-deep text-surface-deep-foreground">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
            B0 · Baseline, design system &amp; PRD scaffold
          </p>
          <h1 className="mt-5 max-w-3xl text-4xl leading-tight font-bold sm:text-5xl">
            A neutral aggregation spine for agriculture data
          </h1>
          <p className="mt-5 max-w-2xl text-base opacity-80">
            {DESCRIPTION} Technical tenancy grants no government authority, no support ownership and
            no blanket farmer-data access.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" variant="secondary" asChild>
              <Link to="/roles">Choose a role journey</Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-current/40 bg-transparent text-current hover:bg-surface-deep-foreground/10"
              asChild
            >
              <Link to="/architecture">Architecture assumptions</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <PageHeader
          eyebrow="Non-negotiables"
          title="Platform guarantees, enforced server-side"
          description="Route hiding is presentation only. Authority, consent and audit are checked in server functions and database policy."
        />
        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          {pillars.map((p) => (
            <article key={p.title} className="panel p-6">
              <p.icon className="h-5 w-5 text-primary" aria-hidden />
              <h3 className="mt-4 text-base font-semibold">{p.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{p.body}</p>
            </article>
          ))}
        </div>
        <p className="mt-10 max-w-3xl rounded-lg border border-border bg-secondary p-5 text-sm text-secondary-foreground">
          Development and sandbox environments run on synthetic organisations, consumers and
          purposes. External KYC, GIS, payment, government, bank and insurer systems sit behind
          adapters and are inactive in this slice. Production registration and identity
          verification are not activated.
        </p>
      </section>
    </main>
  );
}
