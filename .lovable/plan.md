# FPO Opportunity Intelligence layer (AP + Telangana)

Load the enhanced workbook's second layer into the database and surface it in the app, linked back to the 348 registry rows already stored in `fpo_registry`.

## What gets added

**1. Scheme catalogue (20 schemes)**
Central, Andhra Pradesh and Telangana schemes with level, applicable state, beneficiary, category, FPO relevance, key benefit, indicative limit/rate, eligibility trigger, implementing department, application window, official source URL and data note. Read-only reference data; only platform admins can edit.

**2. FPO opportunity profile (one row per FPO, 348 rows)**
Commodity and commodity group, member count, annual turnover, priority need, existing infrastructure, e-NAM status, 10K-FPO benefit status, loan requirement, GST/FSSAI/UDYAM status, Data Readiness Score, Opportunity Score, Top Scheme 1/2/3, recommended next action, application/verification status, last verified, owner and notes. Each row is joined to its registry row by CIN/registration number, so the master list links straight into the opportunity layer.

**3. Scheme matrix (348 rows x 13 scheme flags)**
Per-FPO opportunity flags for 10K FPO benefits, e-NAM, AIF, PMFME, MIDH, mechanisation/CHC, PM-RKVY, PM Kisan SAMPADA, NMEO-OP, PMMSY, state micro-irrigation, state income support and state other benefit.

**4. Opportunity dashboard page**
A management view at `/fpo-opportunity`: KPI tiles (FPOs covered, average opportunity score, average data readiness, count of FPOs with unknown commodity/turnover), state and district breakdown, scheme-demand counts from the matrix, and a searchable/filterable FPO table (state, district, commodity group, priority need, score band) with a detail panel showing that FPO's top three scheme recommendations, matrix flags and the linked scheme catalogue entries with source URLs.

Scores and Top-Scheme recommendations are imported as given from the workbook and displayed as advisory prioritisation hints with their source and last-verified date — they are not eligibility decisions. Any approval or sanction still sits with the authorised human/partner role.

## Technical notes

- Migration adds three public tables: `fpo_scheme_catalog`, `fpo_opportunity_profiles`, `fpo_scheme_matrix`, each with GRANTs, RLS enabled, read access for authenticated users, write restricted to `platform_admin` via `has_role`, plus `created_at`/`updated_at` and the existing `touch_updated_at` trigger. `fpo_opportunity_profiles` and `fpo_scheme_matrix` carry a unique `registration_number` and a nullable FK to `fpo_registry(id)`; no existing table is altered.
- Row loading happens after the migration with data statements generated from the workbook (348 + 348 + 20 rows), normalising blank/"Unknown" cells to null and parsing numerics.
- New pure module `src/lib/atap/fpoOpportunityIntel.ts` (score bands, filters, KPI aggregation, matrix-flag labels) with unit tests, and `fpoOpportunityIntel.functions.ts` server functions for dashboard + detail reads, following the existing `fpoOpportunities` pattern.
- New route `src/routes/_authenticated/fpo-opportunity.tsx` with its own `head()` metadata, plus a nav entry in the existing app shell.

## Open [VALIDATE] items

- Workbook `FPO_Opportunity` fields are largely "Unknown" for commodity, members and turnover today; scores are baseline until those are filled in.
- Scheme limits, windows and eligibility triggers are a 28-Aug-2026 working reference and must be re-verified at application time.
