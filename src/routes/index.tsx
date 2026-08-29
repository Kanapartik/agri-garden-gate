import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Check } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Container,
  Disclaimer,
  Eyebrow,
  NumberedCard,
  Reveal,
  Section,
  SectionHeading,
  StatTile,
} from "@/components/marketing/primitives";
import {
  ADVANTAGES,
  AGENDA,
  ALLOCATION,
  DPI_DISCLAIMER,
  INTEGRATIONS,
  LAYERS,
  LIVE_CAPABILITIES,
  PAIN_POINTS,
  PROOFS,
  ROADMAP,
  STAKEHOLDERS,
} from "@/components/marketing/content";
import heroAsset from "@/assets/agrivah-hero.webp.asset.json";
import trustAsset from "@/assets/agrivah-trust.webp.asset.json";
import fieldAsset from "@/assets/agrivah-field-collaboration.webp.asset.json";

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
    <main>
      {/* ------------------------------------------------------------ hero */}
      <section className="bg-surface-deep text-surface-deep-foreground relative overflow-hidden">
        <img
          src={heroAsset.url}
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover opacity-20"
        />
        <div className="from-surface-deep via-surface-deep/85 to-surface-deep/60 absolute inset-0 bg-gradient-to-r" />
        <Container className="relative grid gap-12 py-20 sm:py-28 lg:grid-cols-[1.4fr_1fr] lg:items-end">
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
              <a href="/auth" className={buttonVariants({ size: "lg", variant: "secondary" })}>
                Start a role journey
                <ArrowRight className="ml-1 h-4 w-4" aria-hidden />
              </a>
              <Button
                size="lg"
                variant="outline"
                className="border-current/40 bg-transparent text-current hover:bg-surface-deep-foreground/10"
                asChild
              >
                <Link to="/platform">See how the platform works</Link>
              </Button>
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

      {/* ---------------------------------------------------------- thesis */}
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

      {/* ----------------------------------------------------- pain points */}
      <Section id="pain">
        <SectionHeading
          kicker="The pain points"
          title="Agriculture has many solutions, but too little shared infrastructure."
          description="Farmers and institutions repeatedly solve the same identity, data, workflow and integration problems. The result is fragmented service delivery, slow programs and limited trust."
        />
        <Reveal className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PAIN_POINTS.map((item, i) => (
            <NumberedCard
              key={item.title}
              index={i + 1}
              title={item.title}
              body={item.body}
              emphasis={i === 0}
            />
          ))}
        </Reveal>
      </Section>

      {/* ------------------------------------------ live product proof */}
      <Section id="product" tone="muted">
        <SectionHeading
          kicker="Working today"
          title="Not a concept deck. These surfaces already run."
          description="Every capability below is live in the platform and reachable once you are signed in with the right role. Access is purpose-scoped and server-enforced."
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
              <a
                href={cap.to}
                className="mt-auto pt-3 text-xs font-semibold text-primary hover:underline"
              >
                Open {cap.title.toLowerCase()} →
              </a>
            </article>
          ))}
        </Reveal>
      </Section>

      {/* ----------------------------------------------------- stakeholders */}
      <Section id="users">
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

      {/* ---------------------------------------------------- platform stack */}
      <Section id="solution" tone="deep">
        <SectionHeading
          kicker="The Agrivah solution"
          title="Trust at the core. Intelligence where it helps. Choice at the edge."
          description="Five layers separate authoritative records, reusable agricultural capabilities, governed intelligence, transaction workflows and partner engagement. Each evolves at the pace its risk permits."
          tone="onDeep"
        />
        <Reveal className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {LAYERS.map((layer, i) => (
            <article
              key={layer.title}
              className="border-surface-deep-foreground/20 flex flex-col gap-2 rounded-xl border p-5"
            >
              <span className="font-display text-accent text-xs font-bold tracking-[0.2em]">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="font-display text-sm font-semibold">{layer.title}</h3>
              <p className="text-xs leading-relaxed opacity-80">{layer.body}</p>
            </article>
          ))}
        </Reveal>
        <Reveal className="mt-8 grid gap-4 sm:grid-cols-3">
          {ALLOCATION.map((a) => (
            <div key={a.label} className="border-surface-deep-foreground/20 rounded-xl border p-5">
              <strong className="font-display text-accent block text-2xl font-bold">
                {a.value}
              </strong>
              <span className="mt-1 block text-xs opacity-80">{a.label}</span>
            </div>
          ))}
        </Reveal>
        <p className="mt-6 text-xs opacity-70">Indicative platform investment allocation.</p>
      </Section>

      {/* ----------------------------------------------------- integrations */}
      <Section id="integrations">
        <SectionHeading
          kicker="Integration fabric"
          title="Connect existing institutions instead of replacing them."
          description="Agrivah provides governed adapters and documented APIs so each participant keeps its own system of record, its own authority and its own accountability."
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

      {/* ------------------------------------------------------- advantages */}
      <Section id="advantages" tone="muted">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <Reveal as="figure" className="m-0">
            <img
              src={trustAsset.url}
              width={1200}
              height={900}
              loading="lazy"
              decoding="async"
              alt="Farmer using a phone beside a farm record book in a field"
              className="rounded-xl border border-border object-cover"
            />
            <figcaption className="mt-3 text-xs leading-relaxed text-muted-foreground">
              Consent, auditability and data rights are not compliance add-ons. They are adoption
              mechanisms.
            </figcaption>
          </Reveal>
          <div>
            <SectionHeading
              kicker="Why Agrivah"
              title="Advantages that compound with every implementation."
            />
            <Reveal className="mt-8 grid gap-4 sm:grid-cols-2">
              {ADVANTAGES.map((item) => (
                <article key={item.title} className="rounded-xl border border-border bg-card p-5">
                  <h3 className="font-display text-sm font-semibold">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
                </article>
              ))}
            </Reveal>
          </div>
        </div>
      </Section>

      {/* -------------------------------------------------------- execution */}
      <Section id="execution">
        <SectionHeading
          kicker="Execution model"
          title="Five proofs before broader scale."
          description="A successful MVP is not a long list of modules. It is a small number of complete value loops with trusted data, real partners, accountable decisions and a repeatable deployment model."
        />
        <div className="mt-10 grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:items-start">
          <Reveal className="divide-y divide-border rounded-xl border border-border bg-card">
            {PROOFS.map((proof) => (
              <article key={proof.title} className="p-5">
                <h3 className="font-display text-sm font-semibold">{proof.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{proof.body}</p>
              </article>
            ))}
          </Reveal>
          <Reveal
            as="aside"
            className="bg-surface-deep text-surface-deep-foreground rounded-xl p-6"
          >
            <Eyebrow className="text-accent">North Star</Eyebrow>
            <p className="font-display mt-3 text-base leading-snug font-semibold">
              Active farm records with a completed value-loop action in the trailing 30 days.
            </p>
            <p className="mt-3 text-sm leading-relaxed opacity-80">
              This measures utility delivered, not registrations accumulated.
            </p>
          </Reveal>
        </div>
      </Section>

      {/* --------------------------------------------------------- roadmap */}
      <Section id="roadmap" tone="muted">
        <SectionHeading
          kicker="Evidence-led roadmap"
          title="Scale is a decision, not a date."
          description="Each phase begins only when the previous one produces credible evidence. Indicative durations support planning, but gates determine investment."
        />
        <Reveal className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ROADMAP.map((phase) => (
            <article
              key={phase.title}
              className={
                phase.active
                  ? "bg-surface-deep text-surface-deep-foreground rounded-xl p-5"
                  : "rounded-xl border border-border bg-card p-5"
              }
            >
              <span
                className={
                  phase.active
                    ? "text-accent text-xs font-semibold"
                    : "text-xs font-semibold text-primary"
                }
              >
                {phase.stage}
              </span>
              <h3 className="font-display mt-2 text-sm font-semibold">{phase.title}</h3>
              <p
                className={
                  phase.active
                    ? "mt-2 text-sm leading-relaxed opacity-85"
                    : "mt-2 text-sm leading-relaxed text-muted-foreground"
                }
              >
                {phase.body}
              </p>
              <span
                className={
                  phase.active
                    ? "mt-3 block text-xs opacity-70"
                    : "mt-3 block text-xs text-muted-foreground"
                }
              >
                {phase.timing}
              </span>
            </article>
          ))}
        </Reveal>
        <Disclaimer>{DPI_DISCLAIMER}</Disclaimer>
      </Section>

      {/* ----------------------------------------------------- 90-day pilot */}
      <Section id="engage">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <Reveal>
            <img
              src={fieldAsset.url}
              width={1200}
              height={900}
              loading="lazy"
              decoding="async"
              alt="Farmers and a field coordinator reviewing information on a tablet"
              className="rounded-xl border border-border object-cover"
            />
          </Reveal>
          <Reveal>
            <Eyebrow>Partner with discipline</Eyebrow>
            <h2 className="font-display mt-4 text-2xl leading-tight font-bold sm:text-3xl">
              Turn an anchor problem into a decisive pilot.
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              The first 90 days align leadership, field reality, legal boundaries, platform choices
              and partner commitments before a larger build begins.
            </p>
            <div className="mt-6 divide-y divide-border rounded-xl border border-border bg-card">
              {AGENDA.map((step) => (
                <div key={step.period} className="p-4">
                  <strong className="font-display text-sm font-semibold text-primary">
                    {step.period}
                  </strong>
                  <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">
                    {step.body}
                  </span>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </Section>

      {/* --------------------------------------------------------- closing */}
      <Section tone="deep">
        <Reveal className="mx-auto max-w-2xl text-center">
          <Eyebrow className="text-accent">Next step</Eyebrow>
          <h2 className="font-display mt-4 text-2xl leading-tight font-bold sm:text-3xl">
            Approve discovery. Earn the right to scale.
          </h2>
          <p className="mt-4 text-sm leading-relaxed opacity-85">
            Pick the role journey that matches you, or walk the platform's guarantees and delivery
            team first.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <a href="/auth" className={buttonVariants({ size: "lg", variant: "secondary" })}>
              Start a role journey
            </a>
            <Button
              size="lg"
              variant="outline"
              className="border-current/40 bg-transparent text-current hover:bg-surface-deep-foreground/10"
              asChild
            >
              <Link to="/team">Meet the execution team</Link>
            </Button>
          </div>
          <div className="mt-10 grid gap-4 text-left sm:grid-cols-3">
            <StatTile value="52" label="AP & Telangana districts modelled" />
            <StatTile value="348" label="Official FPO records loaded" />
            <StatTile value="5 yrs" label="Cropping history per farm record" />
          </div>
        </Reveal>
      </Section>
    </main>
  );
}
