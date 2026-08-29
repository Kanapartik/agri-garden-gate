import { createFileRoute, Link } from "@tanstack/react-router";
import { buttonVariants } from "@/components/ui/button";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import {
  Eyebrow,
  NumberedCard,
  Reveal,
  Section,
  SectionHeading,
} from "@/components/marketing/primitives";
import { PAIN_POINTS, STAKEHOLDERS } from "@/components/marketing/content";

const SITE = "https://agrivah.com";
const TITLE = "The Pain Points Agrivah Solves in Agriculture Delivery";
const DESCRIPTION =
  "Fragmented identity, unconsented data, duplicated scheme workflows and brittle integrations slow agricultural programs. Here is the problem set Agrivah is built for.";

export const Route = createFileRoute("/pain-points")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: `${SITE}/pain-points` }],
  }),
  component: PainPointsPage,
});

function PainPointsPage() {
  return (
    <>
      <MarketingHeader />
      <main>
        <section className="bg-surface-deep text-surface-deep-foreground">
          <div className="mx-auto w-full max-w-6xl px-6 py-16 sm:py-20">
            <Eyebrow className="text-accent">The pain points</Eyebrow>
            <h1 className="font-display mt-4 max-w-3xl text-3xl leading-tight font-bold sm:text-4xl">
              Agriculture has many solutions, but too little shared infrastructure.
            </h1>
            <p className="mt-5 max-w-2xl text-sm leading-relaxed opacity-85">
              Farmers and institutions repeatedly solve the same identity, data, workflow and
              integration problems. The result is fragmented service delivery, slow programs and
              limited trust.
            </p>
          </div>
        </section>

        <Section>
          <Reveal className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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

        <Section tone="muted">
          <SectionHeading
            kicker="Who carries the cost"
            title="Every participant pays for the missing rails."
            description="The same gaps show up differently for each actor — and authority always stays where it belongs."
          />
          <Reveal className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {STAKEHOLDERS.map((s) => (
              <article
                key={s.audience}
                className="flex flex-col rounded-xl border border-border bg-card p-5"
              >
                <Eyebrow>{s.audience}</Eyebrow>
                <h2 className="font-display mt-3 text-base font-semibold">{s.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
                <p className="mt-4 border-t border-border pt-3 text-xs font-medium text-primary">
                  {s.authority}
                </p>
              </article>
            ))}
          </Reveal>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link to="/platform" className={buttonVariants({})}>
              See the solution
            </Link>
            <Link to="/roles" className={buttonVariants({ variant: "outline" })}>
              Choose your role
            </Link>
          </div>
        </Section>
      </main>
    </>
  );
}
