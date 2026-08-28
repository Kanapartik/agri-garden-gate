# Slice I1 — Insurer Revenue Intelligence (Sales)

First slice of the Agricultural Insurance Command Centre: the "Who should I insure?" engine only. It reuses the existing 348-FPO AP/Telangana registry and opportunity intelligence layer as the acquisition dataset. Policy administration, claims, underwriting scoring, weather/satellite surveillance and finance are explicitly out of scope for this slice.

## What the insurer gets

**1. Market opportunity view (aggregate only)**
District x crop market sizing: potential farmers, cultivated acreage, currently insured, penetration %, uninsured opportunity, indicative premium potential. Sortable, filterable by state/district/crop, with a state and district breakdown. No farmer identity anywhere in this slice.

**2. FPO channel board**
One card/row per FPO drawn from the registry: state, district, mandal, main commodity/commodity group, member count, acreage, penetration, existing policies, premium, potential farmers, potential premium, relationship owner, and an **Insurance Opportunity Score (0–100)**. The score is a transparent weighted composite of farmer base, acreage, crop value band, current penetration gap, premium potential, accessibility and data completeness — every driver is shown next to the score so it reads as an advisory prioritisation hint, never an underwriting or pricing decision.

**3. FPO 360 (insurer lens)**
Detail panel for one FPO: profile, crop mix, insured vs uninsured split, opportunity score with drivers, campaign history and the linked scheme-catalogue context already present in the platform.

**4. Acquisition funnel**
CRM-style pipeline at FPO/district granularity: Lead → Contacted → Interested → Documents initiated → Verified → Quote generated → Premium pending → Enrolled. Each stage shows FPO/farmer counts and premium opportunity. Stage moves are staff actions, written server-side and audited.

**5. Campaigns**
Create a campaign targeting a set of FPOs (e.g. "Nizamabad turmeric — Kharif"), with target farmers, acreage, premium opportunity and owner. Campaign progress rolls up from linked funnel entries.

**6. FPO counterpart view**
FPO tenant admins see their own FPO's insurer-facing picture — penetration, uninsured members, active campaigns aimed at them and which insurer owns the relationship — without seeing any other FPO's data and without insurer-internal notes.

## Non-negotiables applied

- Aggregate only: no farmer identity, Aadhaar, mobile, bank or plot-level personal data is read or displayed. Counts are derived from FPO/registry aggregates and synthetic penetration data.
- Default-deny: every read and write is checked server-side through role + tenant scoping; hiding a nav link is not treated as security.
- Opportunity scores and premium potential are advisory prioritisation only. Quotes, pricing and any sanction stay with the authorised human/partner role.
- Insurer tenancy grants no farmer-data access and no authority over FPOs.
- Every stage change, campaign create/update and score recompute writes an audit event.
- All external inputs (crop-value bands, cultivated-area baselines, penetration baselines) come from synthetic adapters, not live feeds.

## Technical notes

- Migration adds insurer-scoped public tables, each with GRANTs, RLS enabled and `touch_updated_at`:
  - `insurer_market_cells` — state/district/crop aggregate baselines (potential farmers, cultivated acreage, insured farmers, insured acreage, indicative premium per acre, source, last_verified).
  - `insurer_fpo_channel` — one row per insurer x FPO registry row: penetration, policies, premium, potential, owner, opportunity score + stored score drivers, FK to `fpo_registry` and `tenants`.
  - `insurer_funnel_entries` — funnel stage per insurer x FPO, with stage, counts, premium opportunity, owner, notes.
  - `insurer_campaigns` and `insurer_campaign_targets` — campaign header plus targeted FPOs.
  - New enums for funnel stage and campaign state.
- RLS: insurer rows readable/writable only by members of that insurer tenant (`is_tenant_member` / `has_tenant_role`), platform_admin and auditor read-all; FPO tenant admins get a narrow read on rows matching their own FPO registration number, excluding insurer-internal note columns via a dedicated read path. `insurer_market_cells` is non-personal reference data readable by authenticated users.
- New pure module `src/lib/atap/insurerRevenue.ts`: opportunity-score formula with named drivers, penetration and uninsured-opportunity maths, premium-potential derivation, funnel roll-ups, market-cell aggregation, score bands. Unit tested.
- `src/lib/atap/insurerRevenue.functions.ts` + `insurerRevenue.server.ts`: authenticated server functions for market view, channel board, FPO 360, funnel and campaigns; writes audited via the existing audit helper.
- New synthetic adapter `insurerMarketBaseline` in `src/lib/adapters` supplying cultivated-area, crop-value and penetration baselines deterministically for the 52 AP/Telangana districts.
- Routes: `src/routes/_authenticated/insurer.tsx` (tabbed: Market, FPO channel, Funnel, Campaigns) with its own `head()` metadata, and the FPO counterpart section added inside the existing `/fpo` workspace rather than a new route.
- Nav: "Insurance market" appears for insurer tenant admins, platform_admin and auditor; existing nav tests updated.
- Seeding: migration includes literal INSERT statements for synthetic market cells across AP/Telangana districts and channel rows for the 348 registry FPOs, so the first screen is populated.

## Open [VALIDATE] items

- Cultivated-area, farmer-population and current-penetration figures per district/crop are synthetic baselines; real sourcing (state agriculture statistics, insurer's own book) must replace them before any commercial use.
- Premium potential uses an indicative premium-per-acre band, not actuarial pricing.
- Opportunity score weights are a first proposal and need insurer sales sign-off.
- FPO member counts and commodity are still largely "Unknown" in the registry, so score data-completeness drivers will dominate until enrichment happens.

## Slice exit gate

Stop after this slice: tests green, typecheck clean, DB linter clean, and a report of migrations, routes, security posture and acceptance checks. Portfolio/policy, risk surveillance, claims, fraud, finance and reinsurance domains wait for approval.
