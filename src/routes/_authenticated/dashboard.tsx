import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getMyContext, listAuditEvents } from "@/lib/atap.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const TITLE = "Access console — AgriGhar ATAP";
const DESCRIPTION =
  "Review your organisations, granted roles, active platform configuration and the append-only audit trail.";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Dashboard,
  errorComponent: () => (
    <main className="mx-auto max-w-3xl px-6 py-20">
      <h1 className="text-xl font-semibold">Console unavailable</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Your access context could not be loaded. Try refreshing.
      </p>
    </main>
  ),
});

const TENANT_TYPE_LABEL: Record<string, string> = {
  fpo: "Farmer producer organisation",
  govt_dept: "Government department",
  bank: "Bank",
  insurer: "Insurer",
  agri_business: "Agri business",
  platform_ops: "Platform operations",
};

function Dashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fetchContext = useServerFn(getMyContext);
  const fetchAudit = useServerFn(listAuditEvents);

  const contextQuery = useQuery({ queryKey: ["atap", "my-context"], queryFn: () => fetchContext() });
  const canReadAudit = contextQuery.data?.canReadAudit ?? false;

  const auditQuery = useQuery({
    queryKey: ["atap", "audit"],
    queryFn: () => fetchAudit(),
    enabled: canReadAudit,
  });

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const ctx = contextQuery.data;

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <div>
            <p className="font-display text-lg font-semibold">Access console</p>
            <p className="text-sm text-muted-foreground">
              {ctx?.profile?.full_name ?? "Signed in"}
            </p>
          </div>
          <Button variant="outline" onClick={signOut}>
            Sign out
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-8 px-6 py-10">
        <section>
          <h2 className="text-base font-semibold">My organisations</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Membership is technical tenancy only — it grants no authority by itself.
          </p>
          <div className="mt-4 space-y-3">
            {contextQuery.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
            {ctx?.tenants.length === 0 && (
              <p className="rounded-lg border border-border bg-card p-5 text-sm text-muted-foreground">
                You are not a member of any organisation yet. An authorized administrator must grant
                membership.
              </p>
            )}
            {ctx?.tenants.map((t) => (
              <div
                key={t.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-5"
              >
                <div>
                  <p className="text-sm font-medium">{t.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {TENANT_TYPE_LABEL[t.tenant_type] ?? t.tenant_type}
                    {t.region_code ? ` · ${t.region_code}` : ""}
                  </p>
                </div>
                <Badge variant="secondary">{t.membership_status}</Badge>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-base font-semibold">My roles</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {ctx?.roles.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No roles granted. Every privileged action stays denied server-side.
              </p>
            )}
            {ctx?.roles.map((r, i) => (
              <Badge key={`${r.role}-${i}`}>
                {r.role}
                {r.tenant_id ? " · organisation-scoped" : " · platform"}
              </Badge>
            ))}
          </div>
        </section>

        {/* Platform configuration is an operator surface — it means nothing to a
            farmer, so it is shown only to roles that can act on it. */}
        {canReadAudit ? (
          <section>
            <h2 className="text-base font-semibold">Active configuration</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Roles, geography and feature activation are configuration, not code forks.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {ctx?.config.map((c) => (
                <div key={c.config_key} className="rounded-lg border border-border bg-card p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {c.config_key}
                  </p>
                  <pre className="mt-2 overflow-x-auto text-xs text-foreground">
                    {JSON.stringify(c.config_value, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section>
          <h2 className="text-base font-semibold">Audit trail</h2>
          {!canReadAudit ? (
            <p className="mt-3 rounded-lg border border-border bg-secondary p-5 text-sm text-secondary-foreground">
              Audit records are readable only by auditor and platform administrator roles.
            </p>
          ) : (
            <div className="mt-4 overflow-hidden rounded-lg border border-border bg-card">
              {auditQuery.data?.events.length === 0 && (
                <p className="p-5 text-sm text-muted-foreground">No audit events yet.</p>
              )}
              {auditQuery.data?.events.map((e) => (
                <div
                  key={e.id}
                  className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-4 text-sm last:border-b-0"
                >
                  <span className="font-medium">{e.action}</span>
                  <span className="text-xs text-muted-foreground">
                    {e.purpose_code ? `${e.purpose_code} · ` : ""}
                    {new Date(e.created_at).toLocaleString()}
                  </span>
                  <Badge variant={e.decision === "allow" ? "secondary" : "destructive"}>
                    {e.decision}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
