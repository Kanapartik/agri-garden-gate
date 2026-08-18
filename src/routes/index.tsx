import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck, Layers, FileClock, Network } from "lucide-react";

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
    <main className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <span className="font-display text-lg font-semibold tracking-tight">
            AgriGhar <span className="text-primary">ATAP</span>
          </span>
          <Link
            to="/auth"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Sign in
          </Link>
        </div>
      </header>

      <section className="bg-surface-deep text-surface-deep-foreground">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
            Slice 1 · Identity, tenancy, roles &amp; audit
          </p>
          <h1 className="mt-5 max-w-3xl text-4xl leading-tight font-semibold sm:text-5xl">
            A neutral aggregation spine for agriculture data
          </h1>
          <p className="mt-5 max-w-2xl text-base opacity-80">
            {DESCRIPTION} Technical tenancy grants no government authority, no support ownership and
            no blanket farmer-data access.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/auth"
              className="rounded-md bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90"
            >
              Enter the console
            </Link>
            <a
              href="#pillars"
              className="rounded-md border border-current/30 px-5 py-2.5 text-sm font-medium transition-colors hover:bg-white/10"
            >
              How access works
            </a>
          </div>
        </div>
      </section>

      <section id="pillars" className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="text-2xl font-semibold">Platform non-negotiables, enforced server-side</h2>
        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          {pillars.map((p) => (
            <article key={p.title} className="rounded-lg border border-border bg-card p-6">
              <p.icon className="h-5 w-5 text-primary" aria-hidden />
              <h3 className="mt-4 text-base font-semibold">{p.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{p.body}</p>
            </article>
          ))}
        </div>
        <p className="mt-10 max-w-3xl rounded-lg border border-border bg-secondary p-5 text-sm text-secondary-foreground">
          Development and sandbox environments run on synthetic organisations, consumers and
          purposes. External KYC, GIS, payment, government, bank and insurer systems sit behind
          adapters and are inactive in this slice.
        </p>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-6xl px-6 py-8 text-sm text-muted-foreground">
          AgriGhar ATAP · marketplace, advertising and talent domains are deactivated.
        </div>
      </footer>
    </main>
  );
}
