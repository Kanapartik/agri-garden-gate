import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/atap/AppShell";
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
      toast.success("Authorization withdrawn and audited.");
      await queryClient.invalidateQueries({ queryKey: ["atap", "my-fpo-consents"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["atap", "farmer-workspace"] });

  const acceptMutation = useMutation({
    mutationFn: () => accept({ data: { channel: "self_service", locale: "en" } }),
    onSuccess: async () => {
      toast.success("Baseline platform consent recorded.");
      await invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revokeMutation = useMutation({
    mutationFn: () => revoke(),
    onSuccess: async () => {
      toast.success("Baseline consent revoked and audited.");
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
        input.decision === "grant" ? "Partner consent granted." : "Partner consent revoked.",
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
          ? `Allowed (${res.reason}) — ${res.fields?.length ?? 0} parcel row(s) shared.`
          : `Denied (${res.reason}) — no farm data returned.`,
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="B2 · Consent"
        title="Consent centre"
        description="Baseline platform consent is what the platform needs to hold your account. Everything a partner wants is a separate, optional choice you can withdraw at any time."
      />

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="font-display text-lg font-semibold">Baseline platform consent</h2>
        <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
          <li>• We keep your account, your contact details and your onboarding record.</li>
          <li>• We keep the farm details you enter so you do not have to type them again.</li>
          <li>
            • We do not share your farm data with any bank, insurer or buyer under this consent.
          </li>
          <li>• You can withdraw this consent; withdrawal is recorded in the audit trail.</li>
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">
          Policy version {data?.baselinePolicyVersion ?? "…"} · status{" "}
          {data?.baselineAccepted ? "accepted" : "not accepted"}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={() => acceptMutation.mutate()} disabled={acceptMutation.isPending}>
            {data?.baselineAccepted ? "Re-affirm" : "I accept the baseline"}
          </Button>
          <Button
            variant="outline"
            onClick={() => revokeMutation.mutate()}
            disabled={!data?.baselineAccepted || revokeMutation.isPending}
          >
            Withdraw baseline consent
          </Button>
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="font-display text-lg font-semibold">Optional partner sharing</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Each card is one partner for one purpose. Nothing here is bundled into the baseline, and
            paying for a higher tier never widens what a partner may read.
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
                  ? `Shared${card.expiresAt ? ` until ${new Date(card.expiresAt).toLocaleDateString()}` : ""}`
                  : "Not shared"}
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
                  {card.granted ? "Withdraw" : "Allow"}
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
                  Test partner read
                </Button>
              </div>
              {probe?.consumerId === card.consumerId &&
                probe.purposeCode === card.purposeCode &&
                probeResult && <p className="mt-2 text-xs text-muted-foreground">{probeResult}</p>}
            </li>
          ))}
          {(data?.partnerCards ?? []).length === 0 && (
            <li className="text-sm text-muted-foreground">
              No partner requests configured for your account.
            </li>
          )}
        </ul>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="font-display text-lg font-semibold">Your FPO authorizations</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            What each producer organization you belong to may see about you, and why. Membership on
            its own gives an FPO no access to your farm, scheme or market details — only these
            authorizations do, and you can withdraw any of them here.
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
                Recorded {new Date(c.granted_at).toLocaleDateString()}
                {c.expires_at ? ` · until ${new Date(c.expires_at).toLocaleDateString()}` : ""}
              </p>
              <Button
                size="sm"
                variant="outline"
                className="mt-3"
                disabled={fpoRevokeMutation.isPending}
                onClick={() => fpoRevokeMutation.mutate(c.id)}
              >
                Withdraw
              </Button>
            </li>
          ))}
          {(fpoConsents.data ?? []).length === 0 && (
            <li className="text-sm text-muted-foreground">
              No producer organization currently has authorization to view your details.
            </li>
          )}
        </ul>
      </section>
    </div>
  );
}
