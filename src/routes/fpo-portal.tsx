import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { BarChart3, LayoutDashboard, LogOut, Receipt, ShieldCheck, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getMyContext } from "@/lib/atap.functions";
import { Button } from "@/components/ui/button";
import agrivahMark from "@/assets/agrivah-mark.png.asset.json";
import { LanguageSwitcher, useLanguage } from "@/components/atap/LanguageProvider";

const STAFF_ROLES = ["tenant_admin", "onboarding_officer", "field_agent", "viewer"];

export const Route = createFileRoute("/fpo-portal")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/fpo-login" });
    const ctx = await getMyContext();
    const fpoTenants = ctx.tenants.filter((t) => t.tenant_type === "fpo");
    const tenant = fpoTenants.find((t) =>
      ctx.roles.some((r) => r.tenant_id === t.id && STAFF_ROLES.includes(r.role)),
    );
    if (!tenant) throw redirect({ to: "/fpo-login", search: { denied: 1 } });
    const isAdmin = ctx.roles.some((r) => r.tenant_id === tenant.id && r.role === "tenant_admin");
    return { isAdmin, fpoTenant: { id: tenant.id, name: tenant.name }, staffName: ctx.profile?.full_name ?? data.user.email ?? "" };
  },
  head: () => ({
    meta: [
      { title: "FPO Portal — Agrivah" },
      { name: "description", content: "Manage FPO members, vouchers and performance comparison." },
      { property: "og:title", content: "FPO Portal — Agrivah" },
      { property: "og:description", content: "Dedicated workspace for FPO administrators." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PortalShell,
});

const NAV = [
  { to: "/fpo-portal", label: "fpo.portal.dashboard", icon: LayoutDashboard, exact: true },
  { to: "/fpo-portal/members", label: "fpo.portal.members", icon: Users, exact: false },
  { to: "/fpo-portal/vouchers", label: "fpo.portal.vouchers", icon: Receipt, exact: false },
  { to: "/fpo-portal/comparison", label: "fpo.portal.comparison", icon: BarChart3, exact: false },
  { to: "/fpo-portal/admin", label: "fpo.portal.staffRoles", icon: ShieldCheck, exact: false },
] as const;

function PortalShell() {
  const { fpoTenant, staffName, isAdmin } = Route.useRouteContext();
  const nav = NAV.filter((n) => isAdmin || n.to !== "/fpo-portal/admin");
  const navigate = useNavigate();
  const qc = useQueryClient();

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/fpo-login", replace: true });
  }

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-sidebar p-4 md:flex">
        <div className="mb-6 flex items-center gap-2">
          <img src={agrivahMark.url} alt="Agrivah logo" className="h-9 w-auto" />
          <div className="leading-tight">
             <p className="font-display text-sm font-bold text-primary">FPO Portal</p>
            <p className="text-[10px] uppercase text-muted-foreground">Agrivah</p>
          </div>
        </div>
        <nav className="space-y-1">
          {nav.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              activeOptions={{ exact: n.exact }}
              activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground" }}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-sidebar-accent/60"
            >
               <n.icon className="h-4 w-4" /> {t(n.label)}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-border bg-card px-4 py-3">
          <div className="min-w-0">
            <p className="truncate font-display text-base font-semibold">{fpoTenant.name}</p>
             <p className="truncate text-xs text-muted-foreground">Signed in as {staffName}</p>
          </div>
           <div className="flex items-center gap-2"><LanguageSwitcher /><Button variant="ghost" size="sm" onClick={signOut}>
             <LogOut className="h-4 w-4" /> {t("shell.signOut")}
          </Button>
           </div>
        </header>
        <nav className="flex gap-1 overflow-x-auto border-b border-border px-3 py-2 md:hidden">
          {nav.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              activeOptions={{ exact: n.exact }}
              activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground" }}
              className="shrink-0 rounded-lg px-3 py-1.5 text-xs text-muted-foreground"
            >
               {t(n.label)}
            </Link>
          ))}
        </nav>
        <main className="mx-auto w-full max-w-6xl flex-1 p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
