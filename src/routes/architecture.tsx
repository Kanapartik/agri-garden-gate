import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/atap/AppShell";

const TITLE = "Architecture assumptions — AgriGhar ATAP B0";
const DESCRIPTION =
  "Documented B0 baseline assumptions for AgriGhar ATAP: configuration models, authorization boundaries, adapter seams and unresolved provider decisions.";

export const Route = createFileRoute("/architecture")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Architecture,
});

const assumptions: Array<{ heading: string; points: string[] }> = [
  {
    heading: "Configuration models",
    points: [
      "feature_flags: key, enabled, environments[]. An unknown key is default-off; a role card renders only when its controlling flag is enabled and scoped to the running environment.",
      "geographies: self-referencing tree with a level string, so states/districts/mandals/villages are data, not enum branches.",
      "role_definitions: code, label, journey_kind, is_public_selectable, feature_flag_key, authority_note. Adding a role is an insert.",
      "onboarding_step_definitions: per role_code, ordered, with fields[] and evidence_required[] JSON so forms and validation are configuration.",
    ],
  },
  {
    heading: "Authorization boundaries",
    points: [
      "Roles live only in user_roles, never on profiles, and are read through security-definer helpers (has_role, has_tenant_role, is_tenant_member) to avoid recursive RLS.",
      "Navigation hides links by role context for usability only; every server function re-checks authority and RLS re-checks row scope.",
      "Farmer data access stays default-deny and purpose-scoped through has_consent; consumer tier changes throughput, never consent scope.",
      "Technical tenancy grants no government authority, no support ownership, no FPO membership authority and no blanket farmer-data access.",
    ],
  },
  {
    heading: "Onboarding state machine",
    points: [
      "Draft → Pending → Activated / Rejected, with Withdrawn as an applicant-side exit. Transitions are validated server-side, not by the client.",
      "Activation requires a human reviewer role. There is no AI or automatic decisioning anywhere on this path.",
      "Activation in B0 is allowed only for synthetic applications outside production, behind the onboarding.synthetic_activation flag.",
    ],
  },
  {
    heading: "Adapter seams (all mocked)",
    points: [
      "Identity/KYC, GIS and payments are interfaces with synthetic implementations. No external call leaves the platform in this slice.",
      "Government, bank, insurer and employment systems have no implementation yet and are intentionally absent rather than stubbed in UI.",
    ],
  },
  {
    heading: "Farmer & assisted onboarding (B2)",
    points: [
      "A farmer is never forced into an organisation tenant: farm_records and baseline_consents key off the farmer's own user id.",
      "Assisted mode records actor and subject separately (assisted_by_user_id / captured_by_user_id) and only field agents, onboarding officers, tenant admins or platform admins may write for another subject.",
      "Consent is never delegated. baseline_consents and consent_grants are writable only where subject_user_id = auth.uid(), enforced by RLS as well as by server checks.",
      "Offline parcel drafts live in device storage keyed by client_draft_id, which is also the server-side idempotency key, so a reconnect replay updates the same farm record instead of duplicating it. A different draft claiming a registered plot reference is held as a conflict for a human.",
      "The jurisdiction identity adapter can only recommend: anything short of 'verified', and any duplicate reference, routes to a manual-review queue that only a platform admin resolves. Captured data is never discarded.",
      "Baseline platform consent and optional partner consent are separate surfaces; partner cards are identical for first-party and third-party consumers at the same tier.",
      "Funnel events (onboarding_funnel_events) are analytics only; audit_events remains the security record for consent, role and access decisions.",
    ],
  },
];

const validateItems = [
  "Jurisdiction identity verification provider and its duplicate-detection semantics — unresolved; the mock adapter routes everything unverified to human review.",
  "Authoritative parcel geometry source and area of record (the capture pad's area is a local estimate only) — unresolved.",
  "Offline conflict-resolution owner: whether a plot-reference clash is resolved by the farmer, the assisting agent or an onboarding officer — unresolved.",
  "Baseline consent policy version cadence and re-consent triggers (platform_config: consent.baseline_policy_version) — unresolved.",
  "Partner consent default duration (currently 180 days) and per-purpose overrides — unresolved.",
  "Identity/KYC provider for production onboarding (Aadhaar-based eKYC vs. partner-mediated verification) — unresolved.",
  "GIS/land-record source per state and the authoritative parcel identifier — unresolved.",
  "Payment/settlement rails and who holds the merchant relationship per tenant type — unresolved.",
  "Whether FPO membership authority is asserted by FPO admins, verified against a registry, or both — unresolved.",
  "Consent expiry defaults and re-consent cadence per purpose code — unresolved.",
  "Production environment naming and how environments[] maps to deployed targets — unresolved.",
  "Evidence file storage, retention window and residency requirements — unresolved (no storage bucket created yet).",
  "MFA provider for the platform-admin privilege workflow (TOTP, WebAuthn or partner IdP) — unresolved; B1 records the confirmation flag only.",
  "Contact verification provider per channel (email / SMS / WhatsApp OTP) — unresolved; only the synthetic provider is wired.",
  "Whether organisation registry numbers are validated against an external registry (MCA / cooperative registrar) — unresolved.",
  "Document storage provider and checksum/anti-tamper strategy for DocumentRecord — unresolved.",
];

function Architecture() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <PageHeader
        eyebrow="B0 documentation"
        title="Architecture assumptions"
        description="What the baseline commits to, and what is still open. This page is the written contract for later slices."
      />

      <div className="mt-8 space-y-6">
        {assumptions.map((section) => (
          <section key={section.heading} className="panel p-6">
            <h2 className="text-base font-semibold">{section.heading}</h2>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {section.points.map((point) => (
                <li key={point} className="flex gap-2">
                  <span aria-hidden className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}

        <section className="panel border-accent/50 p-6">
          <h2 className="text-base font-semibold">Open [VALIDATE] decisions</h2>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            {validateItems.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="shrink-0 font-semibold text-accent-foreground">[VALIDATE]</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="panel p-6">
          <h2 className="text-base font-semibold">Deactivated domains</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Marketplace transactions, advertising and talent/services journeys are flag-defined but
            disabled in every environment. They are out of scope until a slice explicitly requires
            them.
          </p>
        </section>
      </div>
    </main>
  );
}
