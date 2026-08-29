import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { createFileRoute, Link } from "@tanstack/react-router";
import { buttonVariants } from "@/components/ui/button";
import {
  Disclaimer,
  Eyebrow,
  NumberedCard,
  Reveal,
  Section,
  SectionHeading,
} from "@/components/marketing/primitives";
import {
  ADVANTAGES,
  ALLOCATION,
  DPI_DISCLAIMER,
  INTEGRATIONS,
  LAYERS,
  LIVE_CAPABILITIES,
  SYNTHETIC_DISCLAIMER,
} from "@/components/marketing/content";
import heroAsset from "@/assets/agrivah-hero.webp.asset.json";

const SITE = "https://agrivah.com";
const TITLE = "How Agrivah Works — Platform Layers, Adapters & Neutrality";
const DESCRIPTION =
  "The five Agrivah layers, the integration adapters that connect existing institutions, and the neutrality guarantees enforced server-side rather than by hiding routes.";
const OG_IMAGE = `${SITE}${heroAsset.url}`;

const GUARANTEES = [
  {
    title: "Default-deny farmer data",
    body: "Every read of farmer data is purpose-scoped and consent-bound. Paid entitlements change rate limits and support tiers, never the consent boundary.",
  },
  {
    title: "Access-path neutrality",
    body: "Equivalent first-party and third-party consumers at the same tier resolve through one identical policy path, with no privileged internal shortcut.",
  },
  {
    title: "Tenancy is not authority",
    body: "Holding a technical tenant grants no government authority, no support ownership, no FPO membership authority and no blanket farmer-data access.",
  },
  {
    title: "People decide high-stakes outcomes",
    body: "Bank, insurance and government decisions stay with the authorised human or partner role. AI summarises and flags; it never auto-decides.",
  },
  {
    title: "Configuration over forks",
    body: "Roles, onboarding steps, evidence requirements, geography levels, feature activation and policies are configuration records, not code branches.",
  },
  {
    title: "Auditable by construction",
    body: "Sensitive approvals, consent changes, role and tenant grants, credential issue, suspension and data access all write append-only audit events.",
  },
] as const;

export const Route = createFileRoute("/platform")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:image", content: OG_IMAGE },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: OG_IMAGE },
    ],
    links: [{ rel: "canonical", href: `${SITE}/platform` }],
  }),
  component: PlatformPage,
});

function PlatformPage() {
  return (
    <>
      <MarketingHeader />
      <main>
        <section className="bg-surface-deep text-surface-deep-foreground">
          <div className="mx-auto w-full max-w-6xl px-6 py-16 sm:py-20">
            <Eyebrow className="text-accent">The platform</Eyebrow>
            <h1 className="font-display mt-5 max-w-3xl text-3xl leading-tight font-bold sm:text-4xl">
              Governed rails, replaceable adapters, retained authority.
            </h1>
            <p className="mt-5 max-w-2xl text-sm leading-relaxed opacity-85 sm:text-base">
              Agrivah separates what must be trusted and shared from what should stay local and
              competitive. The layers below can each evolve at the pace their risk permits.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="/auth" className={buttonVariants({ size: "lg", variant: "secondary" })}>
                Start a role journey
              </a>
              <Link
                to="/architecture"
                className="border-current/40 hover:bg-surface-deep-foreground/10 inline-flex items-center justify-center rounded-md border px-5 py-2.5 text-sm font-medium"
              >
                Engineering assumptions
              </Link>
            </div>
          </div>
        </section>

        <Section>
          <SectionHeading
            kicker="Five layers"
            title="What each layer owns."
            description="Authoritative records at the base, reusable agricultural capability above it, then governed intelligence, transaction workflows and partner engagement."
          />
          <Reveal className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {LAYERS.map((layer, i) => (
              <NumberedCard key={layer.title} index={i + 1} title={layer.title} body={layer.body} />
            ))}
          </Reveal>
          <Reveal className="mt-8 grid gap-4 sm:grid-cols-3">
            {ALLOCATION.map((a) => (
              <div key={a.label} className="rounded-xl border border-border bg-card p-5">
                <strong className="font-display block text-2xl font-bold text-primary">
                  {a.value}
                </strong>
                <span className="mt-1 block text-xs text-muted-foreground">{a.label}</span>
              </div>
            ))}
          </Reveal>
        </Section>

        <Section tone="muted">
          <SectionHeading
            kicker="Guarantees"
            title="Enforced server-side, not by hiding routes."
            description="Navigation visibility is presentation only. Authority, consent and audit are checked in server functions and database policy on every request."
          />
          <Reveal className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {GUARANTEES.map((g) => (
              <article key={g.title} className="rounded-xl border border-border bg-card p-5">
                <h3 className="font-display text-sm font-semibold">{g.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{g.body}</p>
              </article>
            ))}
          </Reveal>
          <Disclaimer>{SYNTHETIC_DISCLAIMER}</Disclaimer>
        </Section>

        <Section>
          <SectionHeading
            kicker="Integration fabric"
            title="Adapters keep external complexity outside the core."
            description="Each connected system keeps its own record of truth. Agrivah exchanges governed events and consented scopes across the boundary."
          />
          <Reveal className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {INTEGRATIONS.map((item) => (
              <article key={item.title} className="rounded-xl border border-border bg-card p-5">
                <h3 className="font-display text-sm font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
              </article>
            ))}
          </Reveal>
        </Section>

        <Section tone="deep">
          <SectionHeading
            kicker="Working today"
            title="Capabilities already running on these rails."
            tone="onDeep"
            description="Each surface is reachable once you are signed in with the role and tenant context it belongs to."
          />
          <Reveal className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {LIVE_CAPABILITIES.map((cap) => (
              <a
                key={cap.title}
                href={cap.to}
                className="border-surface-deep-foreground/20 hover:bg-surface-deep-foreground/5 rounded-xl border p-5 transition-colors"
              >
                <h3 className="font-display text-sm font-semibold">{cap.title}</h3>
                <p className="mt-2 text-xs leading-relaxed opacity-80">{cap.body}</p>
              </a>
            ))}
          </Reveal>
        </Section>

        <Section tone="muted">
          <SectionHeading
            kicker="Why it compounds"
            title="Advantages that grow with each implementation."
          />
          <Reveal className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ADVANTAGES.map((item) => (
              <article key={item.title} className="rounded-xl border border-border bg-card p-5">
                <h3 className="font-display text-sm font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
              </article>
            ))}
          </Reveal>
          <Disclaimer>{DPI_DISCLAIMER}</Disclaimer>
        </Section>
      </main>
    </>
  );
}
