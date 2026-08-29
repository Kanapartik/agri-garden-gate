import { Link } from "@tanstack/react-router";
import { buttonVariants } from "@/components/ui/button";

/**
 * Public marketing header. Mirrors the Agrivah site menu, but every entry is a
 * real route (multipage) rather than an in-page anchor. Signed-in navigation is
 * unchanged and still lives in AppShell.
 */
const LINKS = [
  { to: "/pain-points", label: "Pain points" },
  { to: "/platform", label: "Solution" },
  { to: "/integrations", label: "Integrations" },
  { to: "/advantages", label: "Advantages" },
  { to: "/execution", label: "Execution" },
  { to: "/team", label: "Team" },
  { to: "/roles", label: "Roles" },
] as const;

export function MarketingHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-4 px-6 py-3">
        <Link to="/" className="flex items-center gap-2" aria-label="Agrivah home">
          <svg viewBox="0 0 40 40" fill="none" aria-hidden className="h-7 w-7 text-primary">
            <path
              d="M8 26c8-1 12-7 13-17 7 5 10 11 8 18-2 6-8 8-13 5-4-2-6-5-6-8"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
            />
            <path
              d="M10 31c4-8 10-13 18-16"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
            />
          </svg>
          <span className="font-display leading-tight font-bold">
            Agrivah
            <small className="block text-[10px] font-medium tracking-wide text-muted-foreground">
              Agriculture Technology Aggregator
            </small>
          </span>
        </Link>

        <nav
          aria-label="Primary"
          className="scrollbar-none -mx-2 hidden flex-1 items-center gap-1 overflow-x-auto px-2 text-sm md:flex"
        >
          {LINKS.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              activeProps={{ className: "bg-secondary text-secondary-foreground" }}
              className="rounded-md px-2.5 py-1.5 whitespace-nowrap text-muted-foreground transition-colors hover:bg-secondary hover:text-secondary-foreground"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <a
          href="/auth"
          className={`ml-auto md:ml-0 ${buttonVariants({ size: "sm" })}`}
        >
          Sign in
        </a>
      </div>

      <nav
        aria-label="Primary mobile"
        className="flex items-center gap-1 overflow-x-auto border-t border-border px-4 py-2 text-xs md:hidden"
      >
        {LINKS.map((l) => (
          <Link
            key={l.to}
            to={l.to}
            activeProps={{ className: "bg-secondary text-secondary-foreground" }}
            className="rounded-md px-2.5 py-1.5 whitespace-nowrap text-muted-foreground"
          >
            {l.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
