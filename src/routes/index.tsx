import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Check } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import {
  Container,
  Eyebrow,
  Reveal,
  Section,
  SectionHeading,
} from "@/components/marketing/primitives";
import { LIVE_CAPABILITIES, STAKEHOLDERS } from "@/components/marketing/content";
import heroAsset from "@/assets/agrivah-hero.webp.asset.json";

const SITE = "https://agrivah.com";
const TITLE = "Agrivah — Connected Agriculture, Farmers in Control";
const DESCRIPTION =
  "Agrivah is neutral shared infrastructure for agriculture: trusted identity, consented farm data, configurable scheme workflows and governed partner APIs.";
const OG_IMAGE = `${SITE}${heroAsset.url}`;

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Agrivah",
  url: SITE,
  description: DESCRIPTION,
  slogan: "Neutrality is not a limitation. It is the foundation of trust.",
  areaServed: "IN",
};

/** Each card is a real route, so the story is multipage and individually shareable. */
const CHAPTERS = [
  {
    to: "/pain-points" as const,
    kicker: "01",
    title: "The pain points",
    body: "Fragmented identity, unconsented data, duplicated workflows and brittle integrations across every actor.",
  },
  {
    to: "/platform" as const,
    kicker: "02",
    title: "The solution",
    body: "Five layers: authoritative records, agricultural capabilities, governed intelligence, transactions and engagement.",
  },
  {
    to: "/integrations" as const,
    kicker: "03",
    title: "Integration fabric",
    body: "Governed adapters and documented APIs so institutions keep their own system of record and authority.",
  },
  {
    to: "/advantages" as const,
    kicker: "04",
    title: "Advantages",
    body: "Consent, auditability and neutrality as adoption mechanisms — plus the surfaces already running today.",
  },
  {
    to: "/execution" as const,
    kicker: "05",
    title: "Execution",
    body: "Five value-loop proofs, an evidence-gated roadmap and a disciplined 90-day pilot agenda.",
  },
  {
    to: "/team" as const,
    kicker: "06",
    title: "The team",
    body: "Agriculture research, FPO and value-chain experience, enterprise platform delivery and program operations.",
  },
];

export const Route = createFileRoute("/")({
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
    links: [{ rel: "canonical", href: `${SITE}/` }],
    scripts: [{ type: "application/ld+json", children: JSON.stringify(JSON_LD) }],
  }),
  component: Landing,
});

function Landing() {
  return (
    <>
      <MarketingHeader />
      <main>
        {/* ---------------------------------------------------------- hero */}
        <section className="bg-surface-deep text-surface-deep-foreground relative overflow-hidden">
          <img
            src={heroAsset.url}
            alt=""
            aria-hidden
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(8,13,9,0.87)_0%,rgba(8,13,9,0.62)_42%,rgba(8,13,9,0.05)_78%),linear-gradient(0deg,rgba(8,13,9,0.78)_0%,transparent_42%)]" />
          <Container className="relative grid gap-12 py-24 sm:py-32 lg:grid-cols-[1.4fr_1fr] lg:items-end">
            <div>
              <Eyebrow className="text-accent">Shared digital rails for agriculture</Eyebrow>
              <h1 className="font-display mt-5 max-w-3xl text-4xl leading-[1.05] font-bold sm:text-5xl">
                Connect the ecosystem. Keep farmers in control.
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-relaxed opacity-85">
                Agrivah brings trusted identity, consented farm data, interoperable workflows and
                partner systems into one neutral foundation, so agricultural programs move from
                intent to measurable field outcomes.
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                <Link to="/roles" className={buttonVariants({ size: "lg", variant: "secondary" })}>
                  Choose your role
                  <ArrowRight className="ml-1 h-4 w-4" aria-hidden />
                </Link>
                <Link
                  to="/platform"
                  className={`${buttonVariants({ size: "lg", variant: "outline" })} border-current/40 bg-transparent text-current hover:bg-surface-deep-foreground/10`}
                >
                  See how the platform works
                </Link>
              </div>
            </div>
            <aside className="border-surface-deep-foreground/25 rounded-xl border p-6 backdrop-blur-sm">
              <strong className="font-display block text-lg leading-snug">
                Prove locally.
                <br />
                Scale by evidence.
              </strong>
              <span className="mt-3 block text-sm leading-relaxed opacity-80">
                The district and FPO are the first proof unit, with expansion earned through
                repeatability — never announced ahead of it.
              </span>
            </aside>
          </Container>
        </section>

        {/* -------------------------------------------------------- thesis */}
        <div className="border-b border-border bg-secondary/50">
          <Container className="grid gap-6 py-10 md:grid-cols-[1fr_1.3fr] md:items-center">
            <blockquote className="font-display text-lg leading-snug font-semibold text-primary">
              “Neutrality is not a limitation. It is the foundation of trust.”
            </blockquote>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Agrivah is designed to sit alongside governments, FPOs, financial institutions,
              insurers, agritechs and buyers. Shared infrastructure reduces duplication while local
              policy, regulated decisions and farmer choice remain where they belong.
            </p>
          </Container>
        </div>

        {/* ------------------------------------------------------ chapters */}
        <Section id="story">
          <SectionHeading
            kicker="The Agrivah story"
            title="Each part of the story has its own page."
            description="Read only the chapter that matters to you — the problem set, the platform, the integration fabric, the advantages, the execution discipline or the team."
          />
          <Reveal className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CHAPTERS.map((c) => (
              <Link
                key={c.to}
                to={c.to}
                className="group flex flex-col rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary"
              >
                <span className="font-display text-xs font-bold tracking-[0.2em] text-primary">
                  {c.kicker}
                </span>
                <h2 className="font-display mt-3 text-base font-semibold">{c.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{c.body}</p>
                <span className="mt-auto pt-4 text-xs font-semibold text-primary group-hover:underline">
                  Read more →
                </span>
              </Link>
            ))}
          </Reveal>
        </Section>

        {/* -------------------------------------------------- stakeholders */}
        <Section id="users" tone="muted">
          <SectionHeading
            kicker="Value across the ecosystem"
            title="One foundation. Different outcomes for every participant."
            description="The platform is useful only when it makes real agricultural journeys simpler — without moving authority away from the institutions that hold it."
          />
          <Reveal className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {STAKEHOLDERS.map((s) => (
              <article
                key={s.audience}
                className="flex flex-col rounded-xl border border-border bg-card p-5"
              >
                <Eyebrow>{s.audience}</Eyebrow>
                <h3 className="font-display mt-3 text-base font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
                <p className="mt-4 border-t border-border pt-3 text-xs font-medium text-primary">
                  {s.authority}
                </p>
              </article>
            ))}
          </Reveal>
        </Section>

        {/* ------------------------------------------------- live capabilities */}
        <Section id="product">
          <SectionHeading
            kicker="Working today"
            title="Not a concept deck. These surfaces already run."
            description="Every capability below is live and reachable once you sign in with the right role. Access is purpose-scoped and server-enforced."
          />
          <Reveal className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {LIVE_CAPABILITIES.map((cap) => (
              <article
                key={cap.title}
                className="flex flex-col gap-2 rounded-xl border border-border bg-card p-5"
              >
                <Check className="h-4 w-4 text-primary" aria-hidden />
                <h3 className="font-display text-base font-semibold">{cap.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{cap.body}</p>
              </article>
            ))}
          </Reveal>
        </Section>

        {/* ------------------------------------------------------- closing */}
        <Section tone="deep">
          <Reveal className="mx-auto max-w-2xl text-center">
            <Eyebrow className="text-accent">Next step</Eyebrow>
            <h2 className="font-display mt-4 text-2xl leading-tight font-bold sm:text-3xl">
              Pick your role. Sign in. Start the journey.
            </h2>
            <p className="mt-4 text-sm leading-relaxed opacity-85">
              Choose the role that matches you — farmer, FPO, bank, insurer, government or
              agri-business — and continue through sign-in into your own workspace.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link to="/roles" className={buttonVariants({ size: "lg", variant: "secondary" })}>
                Choose your role
                <ArrowRight className="ml-1 h-4 w-4" aria-hidden />
              </Link>
              <a
                href="/auth"
                className={`${buttonVariants({ size: "lg", variant: "outline" })} border-current/40 bg-transparent text-current hover:bg-surface-deep-foreground/10`}
              >
                Sign in
              </a>
            </div>
          </Reveal>
        </Section>
      </main>
    </>
  );
}
