import { createFileRoute, Link } from "@tanstack/react-router";
import { buttonVariants } from "@/components/ui/button";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { Eyebrow, Reveal, Section, SectionHeading } from "@/components/marketing/primitives";
import { INTEGRATIONS, SYNTHETIC_DISCLAIMER } from "@/components/marketing/content";
import { Disclaimer } from "@/components/marketing/primitives";

const SITE = "https://agrivah.com";
const TITLE = "Integration Fabric — Connect Institutions, Not Replace Them";
const DESCRIPTION =
  "Governed adapters and documented APIs let every participant keep its own system of record, its own authority and its own accountability.";

export const Route = createFileRoute("/integrations")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: `${SITE}/integrations` }],
  }),
  component: IntegrationsPage,
});

function IntegrationsPage() {
  return (
    <>
      <MarketingHeader />
      <main>
        <section className="bg-surface-deep text-surface-deep-foreground">
          <div className="mx-auto w-full max-w-6xl px-6 py-16 sm:py-20">
            <Eyebrow className="text-accent">Integration fabric</Eyebrow>
            <h1 className="font-display mt-4 max-w-3xl text-3xl leading-tight font-bold sm:text-4xl">
              Connect existing institutions instead of replacing them.
            </h1>
            <p className="mt-5 max-w-2xl text-sm leading-relaxed opacity-85">
              Agrivah provides governed adapters and documented APIs so each participant keeps its
              own system of record, its own authority and its own accountability.
            </p>
          </div>
        </section>

        <Section>
          <Reveal className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {INTEGRATIONS.map((item) => (
              <article key={item.title} className="rounded-xl border border-border bg-card p-5">
                <h2 className="font-display text-sm font-semibold">{item.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
              </article>
            ))}
          </Reveal>
          <Disclaimer>{SYNTHETIC_DISCLAIMER}</Disclaimer>
        </Section>

        <Section tone="muted">
          <SectionHeading
            kicker="Next"
            title="Walk the platform layers or pick your role journey."
          />
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/platform" className={buttonVariants({})}>
              Platform layers
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
