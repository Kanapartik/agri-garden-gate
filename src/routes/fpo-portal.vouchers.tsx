import { createFileRoute } from "@tanstack/react-router";
import { FpoBillingSection } from "@/components/atap/fpo/FpoBillingSection";
import { useLanguage } from "@/components/atap/LanguageProvider";

export const Route = createFileRoute("/fpo-portal/vouchers")({
  head: () => ({ meta: [{ title: "Vouchers — FPO Portal" }] }),
  component: () => {
    const { t } = useLanguage();
    const { fpoTenant } = Route.useRouteContext();
    return (
      <div className="space-y-4">
        <h1 className="font-display text-xl font-semibold">{t("fpo.vouchers.title")}</h1>
        <FpoBillingSection tenantId={fpoTenant.id} orgLabel={fpoTenant.name} />
      </div>
    );
  },
});
