import { createFileRoute } from "@tanstack/react-router";
import { FpoBenchmarkSection } from "@/components/atap/fpo/FpoBenchmarkSection";

export const Route = createFileRoute("/fpo-portal/comparison")({
  head: () => ({ meta: [{ title: "Comparison — FPO Portal" }] }),
  component: () => {
    const { fpoTenant } = Route.useRouteContext();
    return <FpoBenchmarkSection tenantId={fpoTenant.id} />;
  },
});
