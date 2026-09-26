import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getFpoOverview } from "@/lib/atap/fpo.functions";
import { FpoCommandCenter } from "@/components/atap/fpo/FpoCommandCenter";
import type { FpoSection } from "@/lib/atap/fpo";

export const Route = createFileRoute("/fpo-portal/")({
  head: () => ({ meta: [{ title: "Dashboard — FPO Portal" }] }),
  component: Dashboard,
});

const PORTAL_TARGET: Partial<Record<FpoSection, string>> = {
  farmers: "/fpo-portal/members",
  billing: "/fpo-portal/vouchers",
  accounts: "/fpo-portal/vouchers",
  benchmark: "/fpo-portal/comparison",
};

function Dashboard() {
  const { fpoTenant } = Route.useRouteContext();
  const fetchOverview = useServerFn(getFpoOverview);
  const navigate = useNavigate();
  const q = useQuery({
    queryKey: ["atap", "fpo-overview", fpoTenant.id],
    queryFn: () => fetchOverview({ data: { tenantId: fpoTenant.id } }),
  });
  if (q.isLoading) return <p className="text-sm text-muted-foreground">Loading dashboard…</p>;
  if (q.error || !q.data) return <p className="text-sm text-destructive">Could not load the dashboard.</p>;
  return (
    <FpoCommandCenter
      overview={q.data}
      onOpenSection={(s) => {
        const to = PORTAL_TARGET[s];
        if (to) navigate({ to });
        else navigate({ to: "/fpo", search: { section: s } as never });
      }}
    />
  );
}
