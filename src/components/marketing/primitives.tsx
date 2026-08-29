/**
 * Public marketing primitives (Slice W1).
 *
 * Presentation only — these components never read farmer data, never call a
 * server function and never assert authority. They compose the public Agrivah
 * story from the project's own design tokens so the website cannot drift from
 * the product's visual language.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Reveals content on scroll, honouring reduced-motion preferences. */
export function Reveal({
  children,
  className,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "article" | "header" | "aside";
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.14 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      ref={ref as never}
      className={cn(
        "transition-all duration-700 ease-out motion-reduce:transition-none",
        visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

export function Container({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-6xl px-6", className)}>{children}</div>;
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        "text-[0.7rem] font-semibold tracking-[0.22em] text-primary uppercase",
        className,
      )}
    >
      {children}
    </p>
  );
}

/** Two-column section header: kicker on the left, headline + lede on the right. */
export function SectionHeading({
  kicker,
  title,
  description,
  tone = "default",
}: {
  kicker: string;
  title: string;
  description?: string;
  tone?: "default" | "onDeep";
}) {
  return (
    <Reveal as="header" className="grid gap-6 md:grid-cols-[13rem_1fr] md:gap-10">
      <Eyebrow className={tone === "onDeep" ? "text-accent" : undefined}>{kicker}</Eyebrow>
      <div>
        <h2 className="font-display max-w-3xl text-2xl leading-tight font-bold sm:text-3xl">
          {title}
        </h2>
        {description ? (
          <p
            className={cn(
              "mt-4 max-w-2xl text-sm leading-relaxed sm:text-base",
              tone === "onDeep" ? "opacity-80" : "text-muted-foreground",
            )}
          >
            {description}
          </p>
        ) : null}
      </div>
    </Reveal>
  );
}

export function Section({
  id,
  children,
  className,
  tone = "default",
}: {
  id?: string;
  children: ReactNode;
  className?: string;
  tone?: "default" | "muted" | "deep";
}) {
  return (
    <section
      id={id}
      className={cn(
        "py-16 sm:py-20",
        tone === "muted" && "bg-secondary/40 border-y border-border",
        tone === "deep" && "bg-surface-deep text-surface-deep-foreground",
        className,
      )}
    >
      <Container>{children}</Container>
    </section>
  );
}

/** Numbered editorial card used for pain points and platform layers. */
export function NumberedCard({
  index,
  title,
  body,
  emphasis = false,
}: {
  index: number;
  title: string;
  body: string;
  emphasis?: boolean;
}) {
  return (
    <article
      className={cn(
        "flex flex-col gap-2 rounded-xl border border-border bg-card p-5",
        emphasis && "bg-surface-deep text-surface-deep-foreground border-transparent sm:p-6",
      )}
    >
      <span
        className={cn(
          "font-display text-xs font-bold tracking-[0.2em]",
          emphasis ? "text-accent" : "text-primary",
        )}
      >
        {String(index).padStart(2, "0")}
      </span>
      <h3 className="font-display text-base font-semibold">{title}</h3>
      <p className={cn("text-sm leading-relaxed", emphasis ? "opacity-85" : "text-muted-foreground")}>
        {body}
      </p>
    </article>
  );
}

/** Small stat / proof tile. */
export function StatTile({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <strong className="font-display block text-2xl leading-none font-bold text-primary">
        {value}
      </strong>
      <span className="mt-2 block text-xs leading-relaxed text-muted-foreground">{label}</span>
    </div>
  );
}

export function Disclaimer({ children }: { children: ReactNode }) {
  return (
    <p className="mt-10 max-w-3xl rounded-lg border border-border bg-secondary p-5 text-xs leading-relaxed text-secondary-foreground">
      {children}
    </p>
  );
}
