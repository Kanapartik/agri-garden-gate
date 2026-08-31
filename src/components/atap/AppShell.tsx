import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getMyContext } from "@/lib/atap.functions";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher, useLanguage } from "@/components/atap/LanguageProvider";
import type { AppRole } from "@/lib/atap/policy";
import agrivahMark from "@/assets/agrivah-mark.png.asset.json";

type NavItem = { to: string; label: string; labelKey: string };

/**
 * Navigation is derived from role AND tenant-type context, never hardcoded per
 * page. Hiding a link is presentation only — every server function re-checks
 * authority. Tenant types come from the caller's active memberships
 * (`getMyContext`), so an insurer employee never sees farmer/FPO workspaces.
 */
export function navItemsForRoles(
  roles: AppRole[],
  signedIn: boolean,
  tenantTypes: string[] = [],
): NavItem[] {
  // Public visitors get no top menu at all — the marketing pages carry their own
  // in-page navigation and sign-in calls to action. The menu appears only after
  // sign-in, driven by the caller's roles and tenant types.
  if (!signedIn) return [];

  // Engineering surfaces (platform configuration, architecture assumptions) are
  // meaningless to a farmer, so they stay with the roles that operate them.
  const isEngineering = roles.includes("platform_admin") || roles.includes("auditor");
  const isStaff = roles.some((r) => r !== "viewer" && r !== "talent_candidate");
  const isOversight = isEngineering; // platform_admin / auditor keep cross-tenant visibility
  const isFpoMember = tenantTypes.includes("fpo");
  const isInsurerMember = tenantTypes.includes("insurer");
  // A signed-in user with no tenant membership is a plain individual (farmer
  // journey) — farmer surfaces apply. Tenant members see their tenant's
  // workspaces instead.
  const isPlainIndividual = tenantTypes.length === 0;

  const items: NavItem[] = [
    { to: "/profile", label: "My profile", labelKey: "nav.profile" },
    { to: "/onboarding", label: "My onboarding", labelKey: "nav.onboarding" },
  ];

  if (isPlainIndividual || isFpoMember || isOversight) {
    items.push(
      { to: "/farm", label: "My farm", labelKey: "nav.farm" },
      { to: "/farm-history", label: "My farm history", labelKey: "nav.farmHistory" },
      { to: "/intelligence", label: "Farm intelligence", labelKey: "nav.intelligence" },
      { to: "/practices", label: "Training", labelKey: "nav.practices" },
      { to: "/inputs", label: "Inputs & protection", labelKey: "nav.inputs" },
      { to: "/soil-care", label: "Soil care", labelKey: "nav.soilCare" },
    );
  }

  items.push(
    { to: "/consent", label: "Consent", labelKey: "nav.consent" },
    { to: "/discovery", label: "Schemes", labelKey: "nav.schemes" },
  );

  if (isPlainIndividual || isFpoMember || isOversight) {
    items.push({ to: "/market", label: "Marketplace", labelKey: "nav.market" });
  }

  if (isStaff) items.push({ to: "/dashboard", label: "Access console", labelKey: "nav.dashboard" });

  if (
    (roles.some((r) => r === "tenant_admin" || r === "onboarding_officer" || r === "field_agent") &&
      isFpoMember) ||
    isOversight
  ) {
    items.push({ to: "/fpo", label: "FPO workspace", labelKey: "nav.fpo" });
    items.push({
      to: "/fpo-opportunity",
      label: "Opportunity intelligence",
      labelKey: "nav.fpoOpportunity",
    });
  }

  // Insurer workspaces are scoped to insurer-tenant members (plus platform
  // oversight). The server still resolves the caller's insurer tenant, so a
  // non-insurer caller sees an empty scope even if they craft the URL.
  if (isInsurerMember || isOversight) {
    items.push({ to: "/insurer", label: "Insurer revenue", labelKey: "nav.insurerRevenue" });
    items.push({ to: "/insurer-risk", label: "Risk surveillance", labelKey: "nav.insurerRisk" });
    items.push({ to: "/insurer-claims", label: "Claims management", labelKey: "nav.insurerClaims" });
    items.push({ to: "/insurer-policies", label: "Policies & enrolment", labelKey: "nav.insurerPolicies" });
  }


  if (
    roles.some(
      (r) => r === "scheme_publisher" || r === "scheme_reviewer" || r === "platform_admin",
    )
  ) {
    items.push({ to: "/schemes", label: "Government", labelKey: "nav.government" });
  }
  if (roles.includes("platform_admin") || roles.includes("auditor")) {
    items.push({ to: "/rollout", label: "District", labelKey: "nav.district" });
  }

  const isReviewer = roles.some(
    (r) => r === "onboarding_officer" || r === "tenant_admin" || r === "platform_admin",
  );
  if (isReviewer) items.push({ to: "/review", label: "Review queue", labelKey: "nav.review" });
  if (roles.includes("platform_admin") || roles.includes("tenant_admin")) {
    items.push({ to: "/access", label: "Access & roles", labelKey: "nav.access" });
  }
  if (roles.includes("platform_admin") || roles.includes("auditor")) {
    items.push({ to: "/admin", label: "Admin", labelKey: "nav.admin" });
  }

  if (roles.includes("platform_admin")) items.push({ to: "/configuration", label: "Configuration", labelKey: "nav.configuration" });
  if (isEngineering) items.push({ to: "/architecture", label: "Architecture", labelKey: "nav.architecture" });
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
    tenantTypes: (context.data?.tenants ?? []).map((t) => t.tenant_type),
  };
}

export function AppShell({ children }: { children: ReactNode }) {
  const { signedIn, roles, tenantTypes } = useSessionRoles();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const items = navItemsForRoles(roles, signedIn, tenantTypes);
  const { t } = useLanguage();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="flex min-h-screen flex-col">
      {signedIn ? (
        <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-6 py-3">
            <Link to="/" className="flex items-center gap-2 font-display text-base font-bold">
              <img
                src={agrivahMark.url}
                alt="Agrivah logo"
                width={490}
                height={480}
                className="h-8 w-auto"
              />
              <span className="tracking-[0.12em] text-primary">AGRIVAH</span>
              <span className="text-xs font-semibold tracking-wide text-muted-foreground">ATAP</span>
            </Link>
            <nav className="flex flex-wrap items-center gap-1 text-sm" aria-label="Main">
              {items.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  activeProps={{ className: "bg-secondary text-secondary-foreground" }}
                  className="rounded-md px-2.5 py-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-secondary-foreground"
                >
                  {t(item.labelKey)}
                </Link>
              ))}
            </nav>
            <div className="ml-auto flex items-center gap-2">
              <LanguageSwitcher />
              <Button variant="outline" size="sm" onClick={signOut}>
                {t("shell.signOut")}
              </Button>
            </div>
          </div>
        </header>
      ) : null}
      <div className="flex-1">{children}</div>
      <footer className="border-t border-border px-6 py-6 text-xs text-muted-foreground">
        <div className="mx-auto max-w-6xl">
          {t("shell.footer")}
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
