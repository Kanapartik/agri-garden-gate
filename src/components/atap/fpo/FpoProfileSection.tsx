import { useLanguage } from "@/components/atap/LanguageProvider";
import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { StateBadge } from "@/components/atap/StatusBadge";
import {
  removeLeader,
  saveBankAccount,
  saveFpoProfile,
  saveLeader,
  setFpoProfileState,
  type FpoOverview,
} from "@/lib/atap/fpo.functions";

type FieldKind = "text" | "number" | "date" | "list";

const FIELDS: Array<{ name: string; label: string; kind: FieldKind; group: string }> = [
  { name: "legal_name", label: "Legal name", kind: "text", group: "Basic details" },
  { name: "display_name", label: "Display name", kind: "text", group: "Basic details" },
  { name: "phone", label: "Phone", kind: "text", group: "Basic details" },
  { name: "email", label: "Email", kind: "text", group: "Basic details" },
  { name: "website", label: "Website", kind: "text", group: "Basic details" },
  { name: "registration_number", label: "Registration number", kind: "text", group: "Registration" },
  { name: "org_type", label: "Organization type", kind: "text", group: "Registration" },
  { name: "incorporation_date", label: "Incorporation date", kind: "date", group: "Registration" },
  { name: "cin", label: "CIN", kind: "text", group: "Registration" },
  { name: "pan", label: "PAN", kind: "text", group: "Registration" },
  { name: "gst", label: "GST", kind: "text", group: "Registration" },
  { name: "promoting_org", label: "Promoting institution", kind: "text", group: "Registration" },
  { name: "registered_address", label: "Registered address", kind: "text", group: "Location" },
  { name: "state_code", label: "State code", kind: "text", group: "Location" },
  { name: "district_code", label: "District code", kind: "text", group: "Location" },
  { name: "mandal", label: "Mandal", kind: "text", group: "Location" },
  { name: "village", label: "Village", kind: "text", group: "Location" },
  { name: "pin_code", label: "PIN code", kind: "text", group: "Location" },
  { name: "operational_districts", label: "Operational districts", kind: "list", group: "Location" },
  { name: "villages_served", label: "Villages served", kind: "list", group: "Location" },
  { name: "registered_farmers", label: "Registered farmers", kind: "number", group: "Scale & commodities" },
  { name: "active_farmers", label: "Active farmers", kind: "number", group: "Scale & commodities" },
  { name: "total_acres", label: "Total acres", kind: "number", group: "Scale & commodities" },
  { name: "primary_crops", label: "Primary crops", kind: "list", group: "Scale & commodities" },
  { name: "secondary_crops", label: "Secondary crops", kind: "list", group: "Scale & commodities" },
  { name: "input_categories", label: "Input categories", kind: "list", group: "Scale & commodities" },
  { name: "produce_categories", label: "Produce categories", kind: "list", group: "Scale & commodities" },
  { name: "storage_facilities", label: "Storage facilities", kind: "list", group: "Infrastructure" },
  { name: "processing_facilities", label: "Processing facilities", kind: "list", group: "Infrastructure" },
  { name: "equipment", label: "Equipment", kind: "list", group: "Infrastructure" },
  { name: "warehouse_relationships", label: "Warehouse partners", kind: "list", group: "Infrastructure" },
  { name: "logistics_relationships", label: "Logistics partners", kind: "list", group: "Infrastructure" },
];

const GROUPS = ["Basic details", "Registration", "Location", "Scale & commodities", "Infrastructure"];

function initialValues(profile: FpoOverview["profile"]): Record<string, string> {
  const { t } = useLanguage();
  const out: Record<string, string> = {};
  for (const f of FIELDS) {
    const raw = (profile as Record<string, unknown> | null)?.[f.name];
    out[f.name] = Array.isArray(raw) ? raw.join(", ") : raw == null ? "" : String(raw);
  }
  return out;
}

export function FpoProfileSection({
  overview,
  onChanged,
}: {
  overview: FpoOverview;
  onChanged: () => Promise<void>;
}) {
  const tenantId = overview.activeTenantId ?? "";
  const save = useServerFn(saveFpoProfile);
  const upsertLeader = useServerFn(saveLeader);
  const dropLeader = useServerFn(removeLeader);
  const addBank = useServerFn(saveBankAccount);
  const setState = useServerFn(setFpoProfileState);

  const [values, setValues] = useState(() => initialValues(overview.profile));
  useEffect(() => setValues(initialValues(overview.profile)), [overview.profile]);

  const [leader, setLeader] = useState({ roleTitle: "", personName: "", phone: "", email: "", signatory: false });
  const [bank, setBank] = useState({ bankName: "", branch: "", accountType: "", accountNumber: "", ifsc: "" });

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload: Record<string, string | number | string[] | null> = {};
      for (const f of FIELDS) {
        const raw = values[f.name] ?? "";
        if (f.kind === "list") {
          payload[f.name] = raw
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
        } else if (f.kind === "number") {
          payload[f.name] = raw === "" ? 0 : Number(raw);
        } else {
          payload[f.name] = raw === "" ? null : raw;
        }
      }
      return save({ data: { tenantId, values: payload } });
    },
    onSuccess: async () => {
      toast.success(t("fpo.ui.5b0dabaeeb"));
      await onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!overview.canManage) {
    return (
      <section className="panel space-y-2 p-5">
        <h2 className="font-display text-base font-semibold">{t("fpo.ui.8f0e799ec4")}</h2>
        <p className="text-sm text-muted-foreground">
          {t("fpo.ui.2ca9dbd4ba")}</p>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className="panel space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-base font-semibold">{t("fpo.ui.8f0e799ec4")}</h2>
          <div className="flex items-center gap-2">
            <StateBadge state={overview.profile?.state ?? "draft"} />
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  await setState({ data: { tenantId, state: "submitted" } });
                  toast.success(t("fpo.ui.aea7963bfb"));
                  await onChanged();
                } catch (e) {
                  toast.error((e as Error).message);
                }
              }}
              disabled={!overview.profile}
            >
              {t("fpo.ui.973214ef08")}</Button>
          </div>
        </div>

        {GROUPS.map((group) => (
          <div key={group} className="space-y-3 border-t border-border pt-4 first:border-0 first:pt-0">
            <h3 className="text-sm font-semibold">{group}</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {FIELDS.filter((f) => f.group === group).map((f) => (
                <label key={f.name} className="space-y-1 text-sm">
                  <span className="font-medium">{f.label}</span>
                  <input
                    className="field-base"
                    type={f.kind === "date" ? "date" : f.kind === "number" ? "number" : "text"}
                    value={values[f.name] ?? ""}
                    placeholder={f.kind === "list" ? "Comma separated" : undefined}
                    onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                  />
                </label>
              ))}
            </div>
          </div>
        ))}

        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          {t("fpo.ui.f597c0e820")}</Button>
      </section>

      <section className="panel space-y-3 p-5">
        <h2 className="font-display text-base font-semibold">{t("fpo.ui.6ff8a80439")}</h2>
        {overview.leadership.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("fpo.ui.bde83d6493")}</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>{t("fpo.ui.c3f104d136")}</th>
                <th>{t("fpo.ui.709a23220f")}</th>
                <th>{t("fpo.ui.b37456c453")}</th>
                <th>{t("fpo.ui.70d5aa9c45")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {overview.leadership.map((l) => (
                <tr key={l.id}>
                  <td>{l.role_title}</td>
                  <td>{l.person_name}</td>
                  <td className="text-xs">{l.phone ?? l.email ?? "—"}</td>
                  <td>{l.is_signatory ? "Yes" : "No"}</td>
                  <td className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        try {
                          await dropLeader({ data: { tenantId, id: l.id } });
                          toast.success(t("fpo.ui.f0ec31b645"));
                          await onChanged();
                        } catch (e) {
                          toast.error((e as Error).message);
                        }
                      }}
                    >
                      {t("fpo.ui.e963907dac")}</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="grid gap-3 border-t border-border pt-3 sm:grid-cols-2">
          <input
            className="field-base"
            placeholder={t("fpo.ui.2dd4bc28fb")}
            value={leader.roleTitle}
            onChange={(e) => setLeader((l) => ({ ...l, roleTitle: e.target.value }))}
          />
          <input
            className="field-base"
            placeholder={t("fpo.ui.d735946210")}
            value={leader.personName}
            onChange={(e) => setLeader((l) => ({ ...l, personName: e.target.value }))}
          />
          <input
            className="field-base"
            placeholder={t("fpo.ui.77064d5265")}
            value={leader.phone}
            onChange={(e) => setLeader((l) => ({ ...l, phone: e.target.value }))}
          />
          <input
            className="field-base"
            placeholder={t("fpo.ui.84add5b295")}
            value={leader.email}
            onChange={(e) => setLeader((l) => ({ ...l, email: e.target.value }))}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={leader.signatory}
              onChange={(e) => setLeader((l) => ({ ...l, signatory: e.target.checked }))}
            />
            {t("fpo.ui.e2dcd91a9e")}</label>
          <Button
            onClick={async () => {
              try {
                await upsertLeader({
                  data: {
                    tenantId,
                    roleTitle: leader.roleTitle,
                    personName: leader.personName,
                    phone: leader.phone,
                    email: leader.email,
                    isSignatory: leader.signatory,
                  },
                });
                toast.success(t("fpo.ui.1807092b3c"));
                setLeader({ roleTitle: "", personName: "", phone: "", email: "", signatory: false });
                await onChanged();
              } catch (e) {
                toast.error((e as Error).message);
              }
            }}
            disabled={!leader.roleTitle || !leader.personName}
          >
            {t("fpo.ui.cee76facb8")}</Button>
        </div>
      </section>

      {overview.canViewFinance ? (
        <section className="panel space-y-3 p-5">
          <h2 className="font-display text-base font-semibold">{t("fpo.ui.8a64573da8")}</h2>
          <p className="field-hint">
            {t("fpo.ui.a3595c4fe0")}</p>
          {overview.bank.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("fpo.ui.b7634769db")}</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t("fpo.ui.9e89988cc3")}</th>
                  <th>{t("fpo.ui.1627510b24")}</th>
                  <th>{t("fpo.ui.3deb745651")}</th>
                  <th>{t("fpo.ui.85dfa32c97")}</th>
                  <th>{t("fpo.ui.e704f8ce2b")}</th>
                </tr>
              </thead>
              <tbody>
                {overview.bank.map((b) => (
                  <tr key={b.id}>
                    <td>{b.bank_name}</td>
                    <td>{b.branch ?? "—"}</td>
                    <td>{b.account_type ?? "—"}</td>
                    <td className="font-mono text-xs">{b.account_masked}</td>
                    <td className="font-mono text-xs">{b.ifsc ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="grid gap-3 border-t border-border pt-3 sm:grid-cols-2">
            <input
              className="field-base"
              placeholder={t("fpo.ui.6d83c93a90")}
              value={bank.bankName}
              onChange={(e) => setBank((b) => ({ ...b, bankName: e.target.value }))}
            />
            <input
              className="field-base"
              placeholder={t("fpo.ui.1627510b24")}
              value={bank.branch}
              onChange={(e) => setBank((b) => ({ ...b, branch: e.target.value }))}
            />
            <input
              className="field-base"
              placeholder={t("fpo.ui.12f29e796a")}
              value={bank.accountType}
              onChange={(e) => setBank((b) => ({ ...b, accountType: e.target.value }))}
            />
            <input
              className="field-base"
              placeholder={t("fpo.ui.25d74dd58e")}
              value={bank.accountNumber}
              onChange={(e) => setBank((b) => ({ ...b, accountNumber: e.target.value }))}
            />
            <input
              className="field-base"
              placeholder={t("fpo.ui.e704f8ce2b")}
              value={bank.ifsc}
              onChange={(e) => setBank((b) => ({ ...b, ifsc: e.target.value }))}
            />
            <Button
              onClick={async () => {
                try {
                  await addBank({
                    data: {
                      tenantId,
                      bankName: bank.bankName,
                      branch: bank.branch,
                      accountType: bank.accountType,
                      accountNumber: bank.accountNumber,
                      ifsc: bank.ifsc,
                      signatories: overview.leadership
                        .filter((l) => l.is_signatory)
                        .map((l) => l.person_name),
                    },
                  });
                  toast.success(t("fpo.ui.d3c6140788"));
                  setBank({ bankName: "", branch: "", accountType: "", accountNumber: "", ifsc: "" });
                  await onChanged();
                } catch (e) {
                  toast.error((e as Error).message);
                }
              }}
              disabled={!bank.bankName}
            >
              {t("fpo.ui.7cf6c06ea9")}</Button>
          </div>
        </section>
      ) : (
        <section className="panel p-5 text-sm text-muted-foreground">
          {t("fpo.ui.d286145af7")}</section>
      )}
    </div>
  );
}
