# B2A — My Farm Intelligence workspace

One slice only. Builds a farmer-facing intelligence workspace on top of the existing farm parcel records (`farm_records` already stores geography, plot ref, boundary, centroid, area and primary crop). No marketplace, advertising or talent activation; all external systems arrive behind adapters with synthetic fixtures.

## What the farmer gets

A new **My Farm Intelligence** area, reachable from the farm workspace, with eight sub-views:

1. **Overview** — one parcel selector, then a collated snapshot: location, weather headline, soil basis, top crop candidates, nearest market price, nearest help.
2. **Location** — village / mandal-block / district / state, coordinates, agro-climatic zone, current season, nearest ecosystem resources.
3. **Weather & agromet** — current conditions, forecast window, rain/heat/wind alerts, agriculture-specific advisory text.
4. **Soil** — two clearly separated blocks: *general soil inferred from location* vs *actual Soil Health Card / lab test for this farm*. When no lab result exists, the panel says so explicitly and offers "Book soil test" with nearest lab types (government, mobile, mini, village, registered private, ICAR/KVK).
5. **Crop & variety planning** — explainable shortlist with per-crop factor breakdown (soil fit, rainfall outlook, irrigation, sowing window, historic performance, local price, value-add opportunity), each with source, freshness and confidence.
6. **Nearby ecosystem** — FPO, KVK/extension centre, soil lab, CHC/equipment, with distance; warehouse / cold storage / processor / logistics render only when their existing feature flags are on.
7. **Market intelligence** — nearest mandi prices by commodity: variety/grade when available, date, unit, min/modal/max, arrivals, distance.
8. **Value-add & outcome planner** — raw vs processed comparison (e.g. paddy → cleaned/dried → brown rice → polished rice, with broken rice, bran, husk as by-products) and low/base/high scenarios for yield, price, cost, gross realization, net contribution, break-even price, break-even yield, harvest window, target market, value-add alternative and top risks.

### Price-label rule (enforced in code, not just copy)

Every monetary figure carries exactly one label and cannot be rendered without it:

- **OBSERVED** — an actual mandi/partner price with source and observation date.
- **FORECAST** — a model estimate, always shown with an uncertainty range.
- **DERIVED SCENARIO** — a calculated value-add / planner output, always shown with its assumptions expanded.

Recovery percentages are never hard-coded. They come from a configurable processing-path definition (platform default, overridable per processor/FPO) or an actual quotation, and the assumption set is visible next to the result.

### Human escalation

Every advisory panel ends with escalation actions — "Talk to nearest FPO / KVK / agronomist", "Book soil test", "Request processor quote" — which create support/engagement records for a human. No AI output is presented as an agronomic or commercial guarantee, and nothing here auto-decides a scheme, credit or insurance outcome.

## Technical section

### Migration (additive)

New tables, each with GRANTs then RLS (farmer reads own rows via `farm_records.farmer_user_id`; platform admin/auditor read-all; writes via server functions):

- `location_context_snapshots` — resolved geography chain, coordinates, agro-climatic zone, season, resolved_at.
- `external_data_observations` — generic observation envelope: source key, adapter name, kind (weather/soil/price/facility), payload jsonb, observed_at, fetched_at, freshness, confidence, `is_synthetic`.
- `market_price_observations` — market, commodity, variety, grade, unit, min/modal/max, arrivals, price_date, source, distance_km.
- `nearby_service_facilities` — facility kind (fpo, kvk, soil_lab, chc, warehouse, cold_storage, processor, logistics), name, geography, coords, source.
- `crop_suitability_assessments` — parcel, season, crop, variety, score, factor breakdown jsonb, confidence, sources.
- `processing_path_definitions` + `processing_path_steps` — configurable conversion/recovery assumptions with owner scope (platform default or tenant/processor).
- `value_add_scenarios` and `crop_outcome_scenarios` — DERIVED rows referencing their input observations and assumption set.
- `advisory_evidence` — links any recommendation to the observations/knowledge rows that produced it, with source + freshness + confidence.

New feature flags (off in production, on in development/sandbox): `farm_intelligence.workspace`, `farm_intelligence.weather_adapter`, `farm_intelligence.market_prices`, `farm_intelligence.value_add_planner`, `farm_intelligence.soil_health_card`.

### Adapters (`src/lib/adapters/`)

Interfaces plus synthetic implementations only: `AgrometAdapter` (IMD Mausam/SANKALP shape), `SoilHealthAdapter` (SHC + nearest-lab directory), `DistrictProfileAdapter` (ICAR-CRIDA district agriculture profile: agro-climatic zone, major soils, irrigation, crops, sowing windows), `MarketPriceAdapter` (e-NAM / AGMARKNET-derived min/modal/max), `FpoRegistryAdapter` (SFAC state-wise registered FPOs). Every synthetic response sets `synthetic: true` and a freshness stamp. Real endpoints stay `[VALIDATE provider]`.

### Domain logic (pure, unit-tested) — `src/lib/atap/intelligence.ts`

Season resolution, haversine distance and nearest-N selection, soil-basis classification (inferred vs lab-tested), explainable crop scoring with weighted factors, price-label typing (`PriceLabel = "observed" | "forecast" | "derived_scenario"` with a constructor that refuses unlabelled money), processing-path evaluation (main product + by-products from configurable recovery assumptions), and scenario maths (gross, net, break-even price, break-even yield) for low/base/high.

### Server functions — `src/lib/atap/intelligence.functions.ts`

Authenticated via `requireSupabaseAuth`, default-deny and purpose-scoped: `getFarmIntelligence`, `refreshFarmObservations`, `getMarketIntelligence`, `getNearbyFacilities`, `listProcessingPaths`, `saveProcessorAssumptions`, `computeValueAddScenario`, `computeCropOutcomeScenarios`, `requestSoilTest`, `requestProcessorQuote`, `escalateToHuman`. Each writes an `audit_events` row for data access and escalation. Server-only helpers in `intelligence.server.ts`; adapter calls happen only inside handlers.

### Routes (under `_authenticated`)

`/farm/intelligence` layout with children `location`, `weather`, `soil`, `crops`, `nearby`, `market`, `value-add`, `planner`; nav entry surfaced through the existing role-derived `AppShell` logic and gated by `farm_intelligence.workspace`.

### Tests & fixtures

Extend `src/lib/atap/fixtures.ts` with AP/Telangana parcels (Guntur, Kurnool, Warangal, Nizamabad), synthetic agromet, soil, mandi and facility data. New unit tests cover: label integrity (a derived or forecast value can never render as observed), configurable recovery (no hard-coded milling percentage), break-even maths, nearest-facility ranking, crop explanation completeness (every recommendation has source + freshness + confidence + change factors), lab-vs-inferred soil separation, and RLS isolation (a farmer cannot read another farm's intelligence).

### Reported at the exit gate

Migrations applied, new routes/components, security implications, `[VALIDATE]` items (all five external sources, agro-climatic zone mapping, recovery-rate defaults, forecast model), and acceptance-test results. Work stops there for approval.
