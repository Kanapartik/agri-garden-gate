import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getMyContext } from "@/lib/atap.functions";
import { Button, buttonVariants } from "@/components/ui/button";
import type { AppRole } from "@/lib/atap/policy";

type NavItem = { to: string; label: string };

/**
 * Navigation is derived from role context, never hardcoded per page. Hiding a
 * link is presentation only — every server function re-checks authority.
 */
export function navItemsForRoles(roles: AppRole[], signedIn: boolean): NavItem[] {
  if (!signedIn) {
    return [
      { to: "/", label: "Overview" },
      { to: "/roles", label: "Roles" },
      { to: "/architecture", label: "Architecture" },
    ];
  }

  const items: NavItem[] = [
    { to: "/dashboard", label: "Access console" },
    { to: "/onboarding", label: "My onboarding" },
    { to: "/farm", label: "My farm" },
    { to: "/consent", label: "Consent" },
  ];

  const isReviewer = roles.some(
    (r) => r === "onboarding_officer" || r === "tenant_admin" || r === "platform_admin",
  );
  if (isReviewer) items.push({ to: "/review", label: "Review queue" });
  if (roles.includes("platform_admin") || roles.includes("auditor")) {
    items.push({ to: "/admin", label: "Admin" });
  }
  if (roles.includes("platform_admin")) items.push({ to: "/configuration", label: "Configuration" });
  items.push({ to: "/architecture", label: "Architecture" });
  return items;
}

function useSessionRoles() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const fetchContext = useServerFn(getMyContext);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) setSignedIn(Boolean(data.session));
    });
    const { data } = supabase.auth.onAuthStateChange((_e, session) => setSignedIn(Boolean(session)));
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const context = useQuery({
    queryKey: ["atap", "my-context"],
    queryFn: () => fetchContext(),
    enabled: signedIn === true,
  });

  return {
    signedIn: signedIn === true,
    roles: (context.data?.roles ?? []).map((r) => r.role),
  };
}

export function AppShell({ children }: { children: ReactNode }) {
  const { signedIn, roles } = useSessionRoles();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const items = navItemsForRoles(roles, signedIn);

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-6 py-3">
          <Link to="/" className="font-display text-base font-bold">
            AgriGhar <span className="text-primary">ATAP</span>
          </Link>
          <nav className="flex flex-wrap items-center gap-1 text-sm" aria-label="Main">
            {items.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                activeProps={{ className: "bg-secondary text-secondary-foreground" }}
                className="rounded-md px-2.5 py-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-secondary-foreground"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {signedIn ? (
              <Button variant="outline" size="sm" onClick={signOut}>
                Sign out
              </Button>
            ) : pathname === "/auth" ? null : (
              /* Plain anchor: protected-route redirects resolve on the client, so a
                 router-aware Link here would hydrate with a different active state. */
              <a href="/auth" className={buttonVariants({ size: "sm" })}>
                Sign in
              </a>
            )}
          </div>
        </div>
      </header>
      <div className="flex-1">{children}</div>
      <footer className="border-t border-border px-6 py-6 text-xs text-muted-foreground">
        <div className="mx-auto max-w-6xl">
          AgriGhar ATAP · B0 baseline · synthetic data only · marketplace, advertising and talent
          domains are deactivated.
        </div>
      </footer>
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-foreground">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="mt-1 text-2xl font-bold sm:text-3xl">{title}</h1>
        {description ? <p className="mt-2 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex gap-2">{actions}</div> : null}
    </div>
  );
}
