import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/atap/AppShell";
import { useLanguage } from "@/components/atap/LanguageProvider";
import { Button } from "@/components/ui/button";
import {
  acceptBaselineConsent,
  getFarmerWorkspace,
  readFarmDataAsConsumer,
  revokeBaselineConsent,
  setPartnerConsent,
} from "@/lib/atap/farmer.functions";
import { getMyFpoConsents, revokeMemberConsent } from "@/lib/atap/fpoMembers.functions";
import { FPO_PURPOSE_LABEL, type FpoPurpose } from "@/lib/atap/fpoMembers";

export const Route = createFileRoute("/_authenticated/consent")({
  head: () => ({
    meta: [
      { title: "Consent centre — AgriGhar ATAP" },
      {
        name: "description",
        content:
          "Plain-language baseline platform consent, separate optional partner consent cards, revoke controls and a default-deny partner read check.",
      },
      { property: "og:title", content: "Consent centre — AgriGhar ATAP" },
      {
        property: "og:description",
        content: "Purpose-scoped consent with revoke, audited on every change.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ConsentPage,
});

function ConsentPage() {
  const { t, locale } = useLanguage();
  const queryClient = useQueryClient();
  const fetchWorkspace = useServerFn(getFarmerWorkspace);
  const accept = useServerFn(acceptBaselineConsent);
  const revoke = useServerFn(revokeBaselineConsent);
  const setPartner = useServerFn(setPartnerConsent);
  const partnerRead = useServerFn(readFarmDataAsConsumer);

  const [probe, setProbe] = useState<{ consumerId: string; purposeCode: string } | null>(null);
  const [probeResult, setProbeResult] = useState<string | null>(null);

  const workspace = useQuery({
    queryKey: ["atap", "farmer-workspace"],
    queryFn: () => fetchWorkspace(),
  });
  const data = workspace.data;

  const fetchFpoConsents = useServerFn(getMyFpoConsents);
  const revokeFpoConsent = useServerFn(revokeMemberConsent);
  const fpoConsents = useQuery({
    queryKey: ["atap", "my-fpo-consents"],
    queryFn: () => fetchFpoConsents(),
  });
  const fpoRevokeMutation = useMutation({
    mutationFn: (consentId: string) => revokeFpoConsent({ data: { consentId } }),
    onSuccess: async () => {
      toast.success(t("consent.toastFpo"));
      await queryClient.invalidateQueries({ queryKey: ["atap", "my-fpo-consents"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["atap", "farmer-workspace"] });

  const acceptMutation = useMutation({
    mutationFn: () => accept({ data: { channel: "self_service", locale } }),
    onSuccess: async () => {
      toast.success(t("consent.toastBaseline"));
      await invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revokeMutation = useMutation({
    mutationFn: () => revoke(),
    onSuccess: async () => {
      toast.success(t("consent.toastRevoked"));
      await invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const partnerMutation = useMutation({
    mutationFn: (input: {
      consumerId: string;
      purposeCode: string;
      decision: "grant" | "revoke";
    }) => setPartner({ data: input }),
    onSuccess: async (_res, input) => {
      toast.success(
        input.decision === "grant" ? t("consent.toastGranted") : t("consent.toastPartnerRevoked"),
      );
      await invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const probeMutation = useMutation({
    mutationFn: (input: { consumerId: string; purposeCode: string }) =>
      partnerRead({ data: { ...input, subjectUserId: data?.userId ?? "" } }),
    onSuccess: (res) => {
      setProbeResult(
        res.decision === "allow"
          ? `${t("consent.allowed")} (${res.reason}) — ${res.fields?.length ?? 0} ${t("consent.rowsShared")}`
          : `${t("consent.denied")} (${res.reason}) — ${t("consent.noData")}`,
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={t("consent.eyebrow")}
        title={t("consent.title")}
        description={t("consent.description")}
      />

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="font-display text-lg font-semibold">{t("consent.baseline")}</h2>
        <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
          <li>• {t("consent.b1")}</li>
          <li>• {t("consent.b2")}</li>
          <li>• {t("consent.b3")}</li>
          <li>• {t("consent.b4")}</li>
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">
          {t("consent.policyVersion")} {data?.baselinePolicyVersion ?? "…"} · {t("consent.status")}{" "}
          {data?.baselineAccepted ? t("consent.accepted") : t("consent.notAccepted")}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={() => acceptMutation.mutate()} disabled={acceptMutation.isPending}>
            {data?.baselineAccepted ? t("consent.reaffirm") : t("consent.accept")}
          </Button>
          <Button
            variant="outline"
            onClick={() => revokeMutation.mutate()}
            disabled={!data?.baselineAccepted || revokeMutation.isPending}
          >
            {t("consent.withdrawBaseline")}
          </Button>
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="font-display text-lg font-semibold">{t("consent.partnerTitle")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("consent.partnerHelp")}
          </p>
        </div>
        <ul className="grid gap-3 md:grid-cols-2">
          {(data?.partnerCards ?? []).map((card) => (
            <li
              key={`${card.consumerId}:${card.purposeCode}`}
              className="rounded-lg border border-border bg-card p-4"
            >
              <p className="font-medium">{card.consumerName}</p>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {card.purposeLabel}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">{card.description}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                {card.granted
                  ? `${t("consent.shared")}${card.expiresAt ? ` ${t("consent.until")} ${new Date(card.expiresAt).toLocaleDateString()}` : ""}`
                  : t("consent.notShared")}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant={card.granted ? "outline" : "default"}
                  disabled={partnerMutation.isPending}
                  onClick={() =>
                    partnerMutation.mutate({
                      consumerId: card.consumerId,
                      purposeCode: card.purposeCode,
                      decision: card.granted ? "revoke" : "grant",
                    })
                  }
                >
                  {card.granted ? t("common.withdraw") : t("consent.allow")}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={probeMutation.isPending}
                  onClick={() => {
                    setProbe({ consumerId: card.consumerId, purposeCode: card.purposeCode });
                    setProbeResult(null);
                    probeMutation.mutate({
                      consumerId: card.consumerId,
                      purposeCode: card.purposeCode,
                    });
                  }}
                >
                  {t("consent.testRead")}
                </Button>
              </div>
              {probe?.consumerId === card.consumerId &&
                probe.purposeCode === card.purposeCode &&
                probeResult && <p className="mt-2 text-xs text-muted-foreground">{probeResult}</p>}
            </li>
          ))}
          {(data?.partnerCards ?? []).length === 0 && (
            <li className="text-sm text-muted-foreground">
              {t("consent.noPartners")}
            </li>
          )}
        </ul>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="font-display text-lg font-semibold">{t("consent.fpoTitle")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("consent.fpoHelp")}
          </p>
        </div>
        <ul className="grid gap-3 md:grid-cols-2">
          {(fpoConsents.data ?? []).map((c) => (
            <li key={c.id} className="rounded-lg border border-border bg-card p-4">
              <p className="font-medium">{c.tenantName}</p>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {FPO_PURPOSE_LABEL[c.purpose_code as FpoPurpose] ?? c.purpose_code}
              </p>
              {c.evidence ? (
                <p className="mt-2 text-sm text-muted-foreground">{c.evidence}</p>
              ) : null}
              <p className="mt-2 text-xs text-muted-foreground">
                {t("consent.recorded")} {new Date(c.granted_at).toLocaleDateString()}
                {c.expires_at ? ` · ${t("consent.until")} ${new Date(c.expires_at).toLocaleDateString()}` : ""}
              </p>
              <Button
                size="sm"
                variant="outline"
                className="mt-3"
                disabled={fpoRevokeMutation.isPending}
                onClick={() => fpoRevokeMutation.mutate(c.id)}
              >
                {t("common.withdraw")}
              </Button>
            </li>
          ))}
          {(fpoConsents.data ?? []).length === 0 && (
            <li className="text-sm text-muted-foreground">
              {t("consent.noFpo")}
            </li>
          )}
        </ul>
      </section>
    </div>
  );
}
