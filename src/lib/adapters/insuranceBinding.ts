/**
 * Slice C3 adapter — where bound cover and claim status come from.
 *
 * The real source is the insurer domain inside the platform (`insurer_policies`,
 * `insurer_claims`). An external insurer core system plugs in behind the same
 * `PolicyBindingSource` contract; callers never branch on the provider.
 *
 * As with B11 resolution, the fallback is declared, never silent: provenance is
 * returned and shown in the UI, and `official_only` forbids the fallback for a
 * jurisdiction without a code fork.
 */
import {
  policyCoverState,
  type BindablePolicy,
  type ClaimStatusRow,
} from "@/lib/atap/insuranceBridge";
import { resolveAdapterMode, type AdapterMode, type BaselineProvenance } from "./resolution";

export interface PolicyBindingSource {
  name: string;
  policies: BindablePolicy[];
  claims: ClaimStatusRow[];
}

export function insurerDomainBindingSource(input: {
  policies: readonly BindablePolicy[];
  claims: readonly ClaimStatusRow[];
}): PolicyBindingSource {
  return {
    name: "insurer-domain",
    policies: [...input.policies],
    claims: [...input.claims],
  };
}

/**
 * Development/sandbox source. Produces one deterministic notified-style policy
 * so a demo tenant with no insurer counterpart still shows the flow, clearly
 * labelled synthetic.
 */
export function syntheticBindingSource(input: {
  district: string | null;
  crop: string | null;
  season: string;
}): PolicyBindingSource {
  return {
    name: "synthetic-binding",
    policies: [
      {
        id: `synthetic:${input.district ?? "state"}:${input.crop ?? "all"}`,
        policy_reference: "SYNTHETIC-COVER",
        scheme_code: "PMFBY",
        scheme_name: "Pradhan Mantri Fasal Bima Yojana (indicative)",
        state_name: null,
        district: input.district,
        crop: input.crop,
        season: input.season,
        status: "draft",
        coverage_start: null,
        coverage_end: null,
        sum_insured_per_acre_inr: 32000,
        actuarial_rate_pct: 9,
        farmer_share_pct: 2,
      },
    ],
    claims: [],
  };
}

export interface BindingResolution {
  source: PolicyBindingSource;
  provenance: BaselineProvenance;
}

export function resolvePolicyBindingSource(input: {
  policies: readonly BindablePolicy[];
  claims: readonly ClaimStatusRow[];
  fallback: { district: string | null; crop: string | null; season: string };
  mode?: AdapterMode | string | null;
}): BindingResolution {
  const mode = typeof input.mode === "string" ? resolveAdapterMode(input.mode) : (input.mode ?? "official_first");
  const real = input.policies.filter((p) => policyCoverState(p.status) !== "none");

  const provenance = (adapter: string, synthetic: boolean, label: string): BaselineProvenance => ({
    adapter,
    mode,
    officialRows: real.length,
    synthetic,
    label,
    sources: synthetic ? ["synthetic_baseline"] : ["insurer_policy"],
  });

  if (mode !== "synthetic_only" && real.length > 0) {
    const source = insurerDomainBindingSource({ policies: real, claims: input.claims });
    return { source, provenance(source.name, false, "Notified insurer policy") };
  }

  if (mode === "official_only") {
    return {
      source: { name: "insurer-domain", policies: [], claims: [...input.claims] },
      provenance: provenance("insurer-domain", false, "No notified policy linked yet"),
    };
  }

  const source = syntheticBindingSource(input.fallback);
  return { source, provenance: provenance(source.name, true, "Indicative baseline (no policy linked)") };
}
