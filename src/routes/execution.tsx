import { createFileRoute, Link } from "@tanstack/react-router";
import { buttonVariants } from "@/components/ui/button";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import {
  Disclaimer,
  Eyebrow,
  Reveal,
  Section,
  SectionHeading,
} from "@/components/marketing/primitives";
import { AGENDA, DPI_DISCLAIMER, PROOFS, ROADMAP } from "@/components/marketing/content";
import fieldAsset from "@/assets/agrivah-field-collaboration.webp.asset.json";

const SITE = "https://agrivah.com";
const TITLE = "Execution Model & Evidence-Led Roadmap — Agrivah";
const DESCRIPTION =
  "Five complete value loops before broader scale, an evidence-gated roadmap and a disciplined 90-day pilot agenda. Scale is a decision, not a date.";
const OG_IMAGE = `${SITE}${fieldAsset.url}`;

export const Route = createFileRoute("/execution")({
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
    links: [{ rel: "canonical", href: `${SITE}/execution` }],
  }),
  component: ExecutionPage,
});

function ExecutionPage() {
  return (
    <>
      <MarketingHeader />
      <main>
        <section className="bg-surface-deep text-surface-deep-foreground">
          <div className="mx-auto w-full max-w-6xl px-6 py-16 sm:py-20">
            <Eyebrow className="text-accent">Execution model</Eyebrow>
            <h1 className="font-display mt-4 max-w-3xl text-3xl leading-tight font-bold sm:text-4xl">
              Five proofs before broader scale.
            </h1>
            <p className="mt-5 max-w-2xl text-sm leading-relaxed opacity-85">
              A successful MVP is not a long list of modules. It is a small number of complete value
              loops with trusted data, real partners, accountable decisions and a repeatable
              deployment model.
            </p>
          </div>
        </section>

        <Section>
          <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:items-start">
            <Reveal className="divide-y divide-border rounded-xl border border-border bg-card">
              {PROOFS.map((proof) => (
                <article key={proof.title} className="p-5">
                  <h2 className="font-display text-sm font-semibold">{proof.title}</h2>
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

        <Section tone="muted">
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

        <Section>
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
                The first 90 days align leadership, field reality, legal boundaries, platform
                choices and partner commitments before a larger build begins.
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
              <div className="mt-6 flex flex-wrap gap-3">
                <Link to="/roles" className={buttonVariants({})}>
                  Choose your role
                </Link>
                <Link to="/team" className={buttonVariants({ variant: "outline" })}>
                  Meet the team
                </Link>
              </div>
            </Reveal>
          </div>
        </Section>
      </main>
    </>
  );
}
