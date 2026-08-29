# Slice B10 — Farmer History & Farm Command Centre

A single, scale-aware home screen for the farmer that answers: what did I grow, what did it cost, what did I earn, what does my area normally do, where do I stand on insurance, and which field services (including drone) are near me.

## What the farmer sees

One page, `/farm-history` linked from the farmer navigation as **My farm history**, with five blocks. The page adapts to farm scale (small under 5 acres, medium 5–25, large above 25):

1. **Header strip** — total extent, number of parcels, scale badge, and 3–4 headline numbers (5-year average net income per acre, best season, average yield vs area average, insurance cover status). Large-scale farms additionally get a parcel-wise breakdown table; small farms get a simplified single-farm view.
2. **My cropping history (last 5 years)** — season-by-season rows: year/season, crop, area, input cost, yield, price realised, revenue, net margin, plus a compact 5-year trend. Farmer can add, edit and delete season records; every figure is farmer-entered (provenance recorded), never AI-decided.
3. **What my area grows** — district × crop benchmarks for the last 5 years (common crops, typical yield band, typical cost and price band) shown next to the farmer's own numbers so the gap is obvious. Aggregate district data only — never another farmer's records.
4. **Insurance corner** — cover status for the current season, indicative premium per acre and sum insured for the farmer's crop/district, eligible insurance and scheme applications the farmer can start, and the authorised contact route (their FPO channel desk / insurer help desk contact label). Read-only and advisory: no eligibility or claim outcome is decided here; every decision stays with the authorised insurer/partner role.
5. **Services near me** — nearby facilities by kind with distance, including a new **drone / spraying service** and **farm machinery (custom hiring)** category, each with a contact label and "request a visit" note. Listing is discovery only; no booking or payment in this slice.

Empty states are honest: if a farmer has no history yet, the page invites the first season entry and still shows area benchmarks, insurance indicators and nearby services.

## Data and backend work

New tables (additive, RLS on, GRANTs in the same migration):

- `farm_season_records` — farmer-owned season history: `farm_id`, `farmer_user_id`, `season_code`, `crop_year`, crop, area, input cost breakdown (jsonb: seed / fertiliser / protection / labour / machinery / other), yield quintal, price realised, revenue, notes, provenance, `is_synthetic`. Policies: farmer full CRUD on own rows; no anon access; FPO/insurer see nothing farmer-identifiable here.
- `area_crop_benchmarks` — district × crop × year aggregates (typical yield band, cost band, price band, adoption share, source, `is_synthetic`). Authenticated read for all; platform admin write. Seeded from the synthetic area-baseline adapter for AP and Telangana districts and the main crops.
- `farmer_insurance_snapshots` — farmer's own advisory cover view (season, crop, district, indicative premium per acre, sum insured per acre, cover state, contact label, source). Farmer reads own rows; written by server logic from adapters and existing insurer aggregates.

Extend the `facility_kind` enum with `drone_service` and `farm_machinery`, and seed synthetic facilities of both kinds across AP/Telangana districts so the "services near me" block is populated.

Adapters (synthetic in dev/sandbox, real sources behind the same interface with `[VALIDATE data source]` notes): area crop benchmark provider, farmer insurance indicator provider (reuses the existing insurer market baseline adapter), and drone/machinery service directory.

## Technical notes

- Pure logic in `src/lib/atap/farmHistory.ts`: season margin (revenue − total input cost), per-acre normalisation, 5-year aggregates and trend direction, farm-scale classification, own-vs-area gap, and a completeness signal for the history block. Fully unit-tested.
- Server-only reads/writes in `src/lib/atap/farmHistory.server.ts`, exposed through `src/lib/atap/farmHistory.functions.ts` using `createServerFn` + `requireSupabaseAuth`; season writes are audited via the existing audit path. Function files stay thin wrappers.
- New adapter files under `src/lib/adapters/` following the existing synthetic-adapter shape; distance uses a haversine helper on the existing facility latitude/longitude.
- New route `src/routes/_authenticated/farm-history.tsx` with its own `head()` metadata and `errorComponent`, plus reusable presentation components under `src/components/atap/farm/`.
- Navigation: add the entry to the farmer group in `AppShell.tsx` so it appears for farmer/individual contexts and oversight roles only — insurer and FPO-only users do not see it.
- Tests: new `farmHistory.test.ts` and adapter tests; existing 574 tests must stay green with a clean typecheck.

## Explicitly out of scope for this slice

No automated insurance decisions, claim filing, service booking or payments; no cross-farmer data exposure; no marketplace, advertising or talent activation.

## Slice exit gate

Report migrations applied, new routes/components, RLS and security implications, open `[VALIDATE]` items (real yield/cost benchmark source, real drone-service directory, real insurer premium tables), and acceptance-test results — then stop for approval.
