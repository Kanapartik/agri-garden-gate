import { createFileRoute, Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { Eyebrow, Reveal, Section, SectionHeading } from "@/components/marketing/primitives";
import { ADVANTAGES, LIVE_CAPABILITIES } from "@/components/marketing/content";
import trustAsset from "@/assets/agrivah-trust.webp.asset.json";

const SITE = "https://agrivah.com";
const TITLE = "Why Agrivah — Advantages That Compound With Every Rollout";
const DESCRIPTION =
  "Consent, auditability and neutrality are adoption mechanisms, not compliance add-ons. See the advantages and the capabilities already running today.";
const OG_IMAGE = `${SITE}${trustAsset.url}`;

export const Route = createFileRoute("/advantages")({
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
    links: [{ rel: "canonical", href: `${SITE}/advantages` }],
  }),
  component: AdvantagesPage,
});

function AdvantagesPage() {
  return (
    <>
      <MarketingHeader />
      <main>
        <section className="bg-surface-deep text-surface-deep-foreground">
          <div className="mx-auto w-full max-w-6xl px-6 py-16 sm:py-20">
            <Eyebrow className="text-accent">Why Agrivah</Eyebrow>
            <h1 className="font-display mt-4 max-w-3xl text-3xl leading-tight font-bold sm:text-4xl">
              Advantages that compound with every implementation.
            </h1>
          </div>
        </section>

        <Section>
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
            <Reveal className="grid gap-4 sm:grid-cols-2">
              {ADVANTAGES.map((item) => (
                <article key={item.title} className="rounded-xl border border-border bg-card p-5">
                  <h2 className="font-display text-sm font-semibold">{item.title}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
                </article>
              ))}
            </Reveal>
          </div>
        </Section>

        <Section tone="muted">
          <SectionHeading
            kicker="Working today"
            title="Not a concept deck. These surfaces already run."
            description="Every capability below is live and reachable once you are signed in with the right role. Access is purpose-scoped and server-enforced."
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
          <div className="mt-10 flex flex-wrap gap-3">
            <Link to="/roles" className={buttonVariants({})}>
              Choose your role
            </Link>
            <Link to="/execution" className={buttonVariants({ variant: "outline" })}>
              How we execute
            </Link>
          </div>
        </Section>
      </main>
    </>
  );
}
