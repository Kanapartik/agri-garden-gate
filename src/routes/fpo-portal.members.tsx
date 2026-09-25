import { createFileRoute } from "@tanstack/react-router";
import { FpoFarmersSection } from "@/components/atap/fpo/FpoFarmersSection";

export const Route = createFileRoute("/fpo-portal/members")({
  head: () => ({ meta: [{ title: "Members — FPO Portal" }] }),
  component: () => {
    const { fpoTenant } = Route.useRouteContext();
    return (
      <div className="space-y-4">
        <h1 className="font-display text-xl font-semibold">Members</h1>
        <FpoFarmersSection tenantId={fpoTenant.id} />
      </div>
    );
  },
});
