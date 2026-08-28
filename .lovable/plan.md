# Slice UX1 — Role & tenant-type aware navigation

## Problem

An insurer tenant admin currently sees the full farmer menu set (My farm, Farm intelligence, Training, Inputs & protection, Soil care, Marketplace) plus FPO-only menus (FPO workspace, Opportunity intelligence). Those surfaces are meaningless to an insurer employee and violate the principle that each actor sees only the workspaces relevant to their tenancy. Root cause: `navItemsForRoles` in `src/components/atap/AppShell.tsx` adds the base farmer items for every signed-in user and keys FPO/insurer sections off the generic `tenant_admin` role only.

## Answer to the question

No — the insurer dashboard should not show onboarding/farm menus. Navigation should be derived from the user's **tenant types** (already returned by `getMyContext`: `fpo`, `govt_dept`, `bank`, `insurer`, `agri_business`, `platform_ops`), not just roles.

## Target navigation matrix

| Menu section | Shown to |
|---|---|
| My profile, My onboarding, Consent, Schemes (discovery) | All signed-in users (individual, non-tenant items) |
| My farm, Farm intelligence, Training, Inputs & protection, Soil care, Marketplace | Farmer individuals / members of an `fpo` tenant |
| FPO workspace, Opportunity intelligence | Members of an `fpo` tenant (staff roles), platform_admin/auditor |
| Insurer revenue, Risk surveillance, Claims management, Policies & enrolment | Members of an `insurer` tenant, platform_admin/auditor |
| Access console, Review queue, Access & roles | Staff/reviewer roles (unchanged logic) |
| Government, District, Admin, Configuration | Existing role gates (unchanged) |

Note: this is a UI scoping change only. Server-side RLS and `canManage` checks already enforce access; hidden menus were never load-bearing security.

## Changes

1. **`src/components/atap/AppShell.tsx`**
   - Extend `navItemsForRoles(roles, signedIn)` to also accept tenant types: `navItemsForRoles(context, signedIn)` where context carries `roles` and `tenantTypes`.
   - `useSessionRoles` already fetches `getMyContext`; pass `tenants.map(t => t.tenant_type)` through.
   - Gate farmer items on `tenantTypes.includes("fpo")` (or no tenant memberships, i.e. a plain individual).
   - Gate FPO workspace + opportunity menus on `tenantTypes.includes("fpo")` plus existing staff role check.
   - Gate the four insurer menus on `tenantTypes.includes("insurer")` or platform_admin/auditor (replacing the bare `tenant_admin` check).
2. **`src/lib/i18n.ts`** — no new keys expected; reuse existing `nav.*` labels.
3. **Tests** — update `src/components/atap/navigation.test.ts` with matrix cases: pure insurer user sees only insurer + profile items; pure FPO user never sees insurer items; platform_admin/auditor keep oversight menus; multi-tenant user sees the union.

## Out of scope

- No route-level changes (routes remain server-protected as today).
- No new roles or migrations.
- Bank/government tenant workspaces remain as-is; their menus are already role-gated.

## Acceptance

- Insurer demo user (`insurer.admin@agrivah.com`) sees: Overview, My profile, My onboarding, Consent, Schemes, Access console, Insurer revenue, Risk surveillance, Claims management, Policies & enrolment, Review queue, Access & roles — and **no** My farm / Training / Marketplace / FPO workspace.
- FPO demo user (`fpo.admin@agrivah.com`) sees farmer + FPO menus and **no** insurer menus.
- Full test suite and typecheck stay green.
