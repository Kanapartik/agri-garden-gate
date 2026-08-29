import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { createFileRoute, Link } from "@tanstack/react-router";
import { buttonVariants } from "@/components/ui/button";
import {
  Eyebrow,
  Reveal,
  Section,
  SectionHeading,
  StatTile,
} from "@/components/marketing/primitives";
import { AGENDA, TEAM, TEAM_PROOF } from "@/components/marketing/content";
import fieldAsset from "@/assets/agrivah-field-collaboration.webp.asset.json";

const SITE = "https://agrivah.com";
const TITLE = "The Agrivah Team — Field Reality, Platforms & Program Delivery";
const DESCRIPTION =
  "Agriculture research, FPO and value-chain experience, enterprise technology delivery, agribusiness consulting, incubation and operations — the people delivering Agrivah.";
const OG_IMAGE = `${SITE}${fieldAsset.url}`;

export const Route = createFileRoute("/team")({
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
    links: [{ rel: "canonical", href: `${SITE}/team` }],
  }),
  component: TeamPage,
});

function TeamPage() {
  return (
    <>
      <MarketingHeader />
      <main>
        <section className="bg-surface-deep text-surface-deep-foreground">
          <div className="mx-auto w-full max-w-6xl px-6 py-16 sm:py-20">
            <Eyebrow className="text-accent">Ability to deliver</Eyebrow>
            <h1 className="font-display mt-5 max-w-3xl text-3xl leading-tight font-bold sm:text-4xl">
              A team built across field reality, platforms and program execution.
            </h1>
            <p className="mt-5 max-w-2xl text-sm leading-relaxed opacity-85 sm:text-base">
              Agrivah brings together agriculture research, FPO and value-chain experience,
              enterprise technology delivery, agribusiness consulting, incubation, entrepreneurship
              development and operational implementation.
            </p>
          </div>
        </section>

        <Section>
          <Reveal className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {TEAM_PROOF.map((p) => (
              <StatTile key={p.label} value={p.value} label={p.label} />
            ))}
          </Reveal>
        </Section>

        <Section tone="muted">
          <SectionHeading
            kicker="The people"
            title="Credentials you can check, not adjectives."
            description="Each member owns a specific part of delivery — strategy, product, agronomy, value chains, incubation or operations."
          />
          <Reveal className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {TEAM.map((member) => (
              <article
                key={member.name}
                className="flex flex-col rounded-xl border border-border bg-card p-5"
              >
                <Eyebrow>{member.role}</Eyebrow>
                <h2 className="font-display mt-3 text-base font-semibold">{member.name}</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{member.body}</p>
                <ul className="mt-4 space-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
                  {member.credentials.map((c) => (
                    <li key={c} className="flex gap-2">
                      <span aria-hidden className="text-primary">
                        •
                      </span>
                      {c}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </Reveal>
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
              <Eyebrow>How we start</Eyebrow>
              <h2 className="font-display mt-4 text-2xl leading-tight font-bold sm:text-3xl">
                Ninety days from anchor problem to committed pilot.
              </h2>
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
              <div className="mt-8 flex flex-wrap gap-3">
                <a href="/auth" className={buttonVariants({ size: "lg" })}>
                  Start a role journey
                </a>
                <Link to="/platform" className={buttonVariants({ size: "lg", variant: "outline" })}>
                  How the platform works
                </Link>
              </div>
            </Reveal>
          </div>
        </Section>
      </main>
    </>
  );
}
