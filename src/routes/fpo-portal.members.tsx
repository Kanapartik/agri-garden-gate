import { useLanguage } from "@/components/atap/LanguageProvider";
import { createFileRoute } from "@tanstack/react-router";
import { FpoFarmersSection } from "@/components/atap/fpo/FpoFarmersSection";
import { FpoQrAddMember } from "@/components/atap/fpo/FpoQrAddMember";

export const Route = createFileRoute("/fpo-portal/members")({
  head: () => ({ meta: [{ title: "Members — FPO Portal" }] }),
  component: () => {
    const { t } = useLanguage();
    const { fpoTenant } = Route.useRouteContext();
    return (
      <div className="space-y-4">
        <h1 className="font-display text-xl font-semibold">{t("fpo.ui.1cb449c112")}</h1>
        <FpoQrAddMember tenantId={fpoTenant.id} />
        <FpoFarmersSection tenantId={fpoTenant.id} />
      </div>
    );
  },
});
