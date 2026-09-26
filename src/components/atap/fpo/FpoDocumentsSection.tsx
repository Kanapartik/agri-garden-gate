import { useLanguage } from "@/components/atap/LanguageProvider";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { StateBadge } from "@/components/atap/StatusBadge";
import { addFpoDocument, setFpoDocumentStatus, type FpoOverview } from "@/lib/atap/fpo.functions";
import {
  complianceActions,
  FPO_DOC_LABEL,
  FPO_DOC_TYPES,
  type FpoDocStatus,
  type FpoDocType,
} from "@/lib/atap/fpo";

const NEXT_STATUS: Record<FpoDocStatus, FpoDocStatus[]> = {
  uploaded: ["under_review", "rejected", "expired"],
  under_review: ["verified", "rejected", "expired"],
  verified: ["under_review", "expired"],
  rejected: ["uploaded", "expired"],
  expired: ["uploaded"],
};

export function FpoDocumentsSection({
  overview,
  onChanged,
}: {
  overview: FpoOverview;
  onChanged: () => Promise<void>;
}) {
  const { t } = useLanguage();
  const tenantId = overview.activeTenantId ?? "";
  const add = useServerFn(addFpoDocument);
  const setStatus = useServerFn(setFpoDocumentStatus);

  const [docType, setDocType] = useState<FpoDocType>(FPO_DOC_TYPES[0]);
  const [title, setTitle] = useState("");
  const [issuedOn, setIssuedOn] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  const due = complianceActions(overview.documents);

  return (
    <div className="space-y-6">
      <section className="panel space-y-3 p-5">
        <h2 className="font-display text-base font-semibold">{t("fpo.ui.addf282c33")}</h2>
        <p className="field-hint">
          {t("fpo.ui.6b5b48eb2f")}</p>
        {overview.missingDocuments.length === 0 ? (
          <p className="text-sm">{t("fpo.ui.18bb9c05b9")}</p>
        ) : (
          <ul className="list-disc pl-5 text-sm text-muted-foreground">
            {overview.missingDocuments.map((d) => (
              <li key={d}>{FPO_DOC_LABEL[d as FpoDocType] ?? d}</li>
            ))}
          </ul>
        )}
        {due.length > 0 ? (
          <p className="text-sm">
            {due.length} {t("fpo.ui.4fd5806072")}</p>
        ) : null}
      </section>

      <section className="panel space-y-3 p-5">
        <h2 className="font-display text-base font-semibold">{t("fpo.ui.687c82861c")}</h2>
        {overview.documents.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("fpo.ui.ec7eb3c93e")}</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>{t("fpo.ui.3deb745651")}</th>
                <th>{t("fpo.ui.768e0c1c69")}</th>
                <th>{t("fpo.ui.deb5d5e2f0")}</th>
                <th>{t("fpo.ui.a99be3da0c")}</th>
                <th>{t("fpo.ui.bae7d5be70")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {overview.documents.map((d) => (
                <tr key={d.id}>
                  <td>{FPO_DOC_LABEL[d.doc_type as FpoDocType] ?? d.doc_type}</td>
                  <td>{d.title}</td>
                  <td className="text-xs">{d.issued_on ?? "—"}</td>
                  <td className="text-xs">{d.expires_at ?? "—"}</td>
                  <td>
                    <StateBadge state={d.status} />
                  </td>
                  <td className="text-right">
                    {overview.canManage ? (
                      <div className="flex flex-wrap justify-end gap-1">
                        {NEXT_STATUS[d.status].map((next) => (
                          <Button
                            key={next}
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                              try {
                                await setStatus({ data: { tenantId, id: d.id, status: next } });
                                toast.success(t("fpo.ui.b182195383"));
                                await onChanged();
                              } catch (e) {
                                toast.error((e as Error).message);
                              }
                            }}
                          >
                            {next.replaceAll("_", " ")}
                          </Button>
                        ))}
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {overview.canManage ? (
          <div className="grid gap-3 border-t border-border pt-3 sm:grid-cols-2">
            <select
              className="field-base"
              value={docType}
              onChange={(e) => setDocType(e.target.value as FpoDocType)}
            >
              {FPO_DOC_TYPES.map((t) => (
                <option key={t} value={t}>
                  {FPO_DOC_LABEL[t]}
                </option>
              ))}
            </select>
            <input
              className="field-base"
              placeholder={t("fpo.ui.6d5daee81c")}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <label className="space-y-1 text-sm">
              <span className="font-medium">{t("fpo.ui.478832afa8")}</span>
              <input
                className="field-base"
                type="date"
                value={issuedOn}
                onChange={(e) => setIssuedOn(e.target.value)}
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium">{t("fpo.ui.549cabe71f")}</span>
              <input
                className="field-base"
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
            </label>
            <Button
              onClick={async () => {
                try {
                  await add({ data: { tenantId, docType, title, issuedOn, expiresAt } });
                  toast.success(t("fpo.ui.1e5bdbeff3"));
                  setTitle("");
                  setIssuedOn("");
                  setExpiresAt("");
                  await onChanged();
                } catch (e) {
                  toast.error((e as Error).message);
                }
              }}
              disabled={!title}
            >
              {t("fpo.ui.3ead49321e")}</Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {t("fpo.ui.142fd9600d")}</p>
        )}
      </section>
    </div>
  );
}
