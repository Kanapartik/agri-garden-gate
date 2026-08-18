# AgriGhar ATAP — Slice 1: Identity, Tenancy, Roles & Audit Foundation

## Current state (inspected)
- TanStack Start v1 template at defaults: only `src/routes/__root.tsx` and a placeholder `src/routes/index.tsx`.
- No backend enabled: no Lovable Cloud, no migrations, no schema, no RLS, no server functions, no auth, no tests.
- `src/components/ui` (shadcn) and design tokens in `src/styles.css` are untouched defaults.

Conclusion: there is no existing behavior to preserve beyond the template, so Slice 1 must be the security spine. No onboarding, marketplace, advertising or talent domains are activated here.

## Slice 1 scope (one slice only)
Build the neutral access spine everything else will hang off:

1. **Auth**: email/password + Google sign-in via Lovable Cloud, `/auth` page, `_authenticated` gate, session-aware header, clean sign-out.
2. **Tenancy**: `tenants` (type: `fpo | govt_dept | bank | insurer | agri_business | platform_ops`) and `tenant_members`. Tenant type is descriptive metadata only — it grants no authority by itself (non-negotiable 3).
3. **Roles**: `app_role` enum + separate `user_roles` table scoped by tenant, plus `has_role()` / `has_tenant_role()` security-definer functions. Never stored on profiles.
4. **Consumer tiers**: `api_consumers` with `tier` and `is_first_party` recorded for observability only — the policy check path ignores `is_first_party`, so first- and third-party consumers at the same tier resolve identically (non-negotiable 1).
5. **Config over forks**: `platform_config` (key/value JSONB, tenant-nullable) seeded with role catalog, geography levels and feature flags — all later slices read from here.
6. **Audit**: append-only `audit_events` (actor, tenant, action, subject, purpose, decision, metadata). Insert-only for `authenticated`, read restricted to auditor/admin roles. Every role grant, tenant grant and consent decision in this slice writes an event.
7. **Purpose-scoped access primitive**: `data_purposes` + `consent_grants` tables and a `has_consent(subject, purpose, consumer)` function. Default-deny: no farmer-data tables exist yet, but the primitive and its tests land now so no later slice can bypass it (non-negotiables 2 and 8).
8. **UI**: public landing page at `/` explaining the platform, `/auth`, and `/dashboard` (gated) showing my tenants, my roles, and a read-only audit feed for privileged roles. No admin-by-URL: every action goes through an authorized server function.

## Technical notes
- Enable Lovable Cloud; all tables in one additive migration with explicit `GRANT`s, RLS enabled, and `TO authenticated` policies using the security-definer role functions (no recursive policy reads).
- Server-side enforcement only: `createServerFn` + `requireSupabaseAuth` in `src/lib/*.functions.ts`; role checks inside handlers, never in the component. Route gating is UX.
- Adapter seams stubbed as interfaces with synthetic implementations (`src/lib/adapters/`): `identity-kyc`, `gis`, `payments`, `govt-registry`. No real external calls in this slice.
- Synthetic fixtures only: seeded tenants, roles, consumers and purposes come as literal `INSERT`s in the migration.
- Tests (vitest): consent default-deny, tenant-type-grants-no-authority, first-party vs third-party same-tier parity, role escalation blocked server-side, audit rows written on grant.

## Out of scope for this slice
Farmer onboarding steps and evidence, entitlements/billing, marketplace, advertising, talent, external KYC/GIS/bank/insurer integrations, AI decisioning.

## Slice exit gate
Report migrations, new routes/components, security implications, [VALIDATE] items and acceptance-test results, then stop for approval before Slice 2 (farmer onboarding step engine).
