/**
 * Synthetic fixtures mirroring the seeded development rows. Never real data.
 */
import type { ConsumerTier, TenantType } from "./policy";

export const SYNTHETIC_TENANTS: Array<{ id: string; name: string; tenant_type: TenantType }> = [
  { id: "11111111-1111-1111-1111-111111111111", name: "AgriGhar Platform Ops", tenant_type: "platform_ops" },
  { id: "22222222-2222-2222-2222-222222222222", name: "Sunrise FPO (synthetic)", tenant_type: "fpo" },
  { id: "33333333-3333-3333-3333-333333333333", name: "State Agri Dept (synthetic)", tenant_type: "govt_dept" },
  { id: "44444444-4444-4444-4444-444444444444", name: "Green Valley Bank (synthetic)", tenant_type: "bank" },
  { id: "55555555-5555-5555-5555-555555555555", name: "SafeHarvest Insurance (synthetic)", tenant_type: "insurer" },
];

export const SYNTHETIC_CONSUMERS: Array<{
  id: string;
  name: string;
  tier: ConsumerTier;
  is_first_party: boolean;
}> = [
  {
    id: "aaaaaaaa-0000-0000-0000-000000000001",
    name: "AgriGhar First-Party App",
    tier: "standard",
    is_first_party: true,
  },
  {
    id: "aaaaaaaa-0000-0000-0000-000000000002",
    name: "Third-Party Agritech Partner (synthetic)",
    tier: "standard",
    is_first_party: false,
  },
  {
    id: "aaaaaaaa-0000-0000-0000-000000000003",
    name: "Sandbox Test Consumer",
    tier: "sandbox",
    is_first_party: false,
  },
];

export const SYNTHETIC_PURPOSES = [
  "onboarding_verification",
  "credit_assessment",
  "crop_insurance",
  "advisory",
  "scheme_eligibility",
] as const;
