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
        <h2 className="font-display text-base font-semibold">Compliance status</h2>
        <p className="field-hint">
          Required for a complete organization record: certificate of incorporation, PAN, bank proof
          and board resolution.
        </p>
        {overview.missingDocuments.length === 0 ? (
          <p className="text-sm">All required documents are on file.</p>
        ) : (
          <ul className="list-disc pl-5 text-sm text-muted-foreground">
            {overview.missingDocuments.map((d) => (
              <li key={d}>{FPO_DOC_LABEL[d as FpoDocType] ?? d}</li>
            ))}
          </ul>
        )}
        {due.length > 0 ? (
          <p className="text-sm">
            {due.length} document(s) need attention — expired, rejected or expiring within 60 days.
          </p>
        ) : null}
      </section>

      <section className="panel space-y-3 p-5">
        <h2 className="font-display text-base font-semibold">Documents</h2>
        {overview.documents.length === 0 ? (
          <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Title</th>
                <th>Issued</th>
                <th>Expires</th>
                <th>Status</th>
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
                                toast.success("Document status updated and audited");
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
              placeholder="Document title / reference"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <label className="space-y-1 text-sm">
              <span className="font-medium">Issued on</span>
              <input
                className="field-base"
                type="date"
                value={issuedOn}
                onChange={(e) => setIssuedOn(e.target.value)}
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium">Expires on</span>
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
                  toast.success("Document recorded and audited");
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
              Add document
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Only an admin of this FPO can add or review organization documents.
          </p>
        )}
      </section>
    </div>
  );
}
