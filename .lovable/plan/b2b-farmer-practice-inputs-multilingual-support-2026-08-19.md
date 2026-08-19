# B2B — Farmer Practice, Inputs & Multilingual Support

One slice, additive only. Nothing in B0–B9 or B2A changes behaviour; new tables, new server functions, new farmer routes, plus a language layer applied across the app shell and the new screens.

## What the farmer gets

1. **Practice training library** (`/practices`)
   Configurable modules grouped by stage: land prep & sowing, crop protection, harvest/crop cutting, post-harvest preservation, value creation. Each module has ordered lessons (text steps, do/don't notes, season and crop tags, optional KVK/state source attribution) and per-farmer completion tracking, reusing the existing checklist/progress feel. Content is data, not code, so state/KVK staff can extend it later; seeded with synthetic AP/TS content.

2. **Input & protection advisor** (`/inputs`)
   Pick crop + growth stage + area and get:
   - **Nutrient plan**: nutrient (N/P/K/micro), generic name (e.g. urea, DAP, MOP, zinc sulphate), recommended quantity for the farmer's parcel area, cost band, and a neutral list of brand names carrying that generic.
   - **Infestation → pesticide guide**: infestation type (pest / disease / weed) with symptoms, then permitted generic active ingredients, dose, safety interval, and re-entry note. Chemical guidance is advisory and always ends in "confirm with your KVK/agronomist" plus the existing `talk_to_kvk` escalation — no auto-prescription.
   - **Sellers**: matched published marketplace listings (existing `marketplace_listings`) shown in the platform's neutral ranking, never paid-priority, alongside the generic recommendation. Read-only link into `/market`; no new ordering path.

3. **Organic / bio-input module** (inside `/inputs`)
   A toggle switches the plan to bio-fertilizers and organic protection (vermicompost, FYM, jeevamrutham, azospirillum, PSB, neem/karanj-based sprays) with quantity, preparation notes and cost per unit so the farmer can compare organic vs conventional cost for the same nutrient target. Comparisons are labelled DERIVED SCENARIO, matching the B2A price-label rule.

4. **Soil nutrient retention plan** (`/soil-care`)
   Given the parcel's soil type (from the existing soil intelligence — inferred vs lab-tested stays visible), show retention practices: organic matter build-up, green manure/cover crops, mulching, crop rotation, gypsum/lime correction where relevant, irrigation practice. Each practice states the soil types it applies to, effort, expected benefit and cost band, and the plan flags when it is based on inferred soil and recommends a soil test (existing `request_soil_test` escalation).

5. **Multilingual support** — English, Telugu, Hindi, Tamil, Kannada
   A lightweight in-app translation layer plus a language picker in the header; choice persists per device and, when signed in, on the profile. UI labels are translated for the app shell and the four new screens first. Content rows (module titles, lesson steps, practice names) carry a translations field so the same record can serve every language, with graceful fallback to English when a translation is missing. Existing screens keep working untranslated and can be migrated incrementally.

## Guardrails kept

- Advisory only: no AI or derived output decides scheme, credit, insurance or chemical-application outcomes; every high-stakes step routes to the existing human escalations.
- All content and dose tables are configuration rows, not constants.
- Farmer-scoped progress and plans stay default-deny; nobody sees another farmer's plan without an existing consent/roster path.
- Marketplace stays as-is; the input advisor only reads published listings.
- Seeded content is synthetic and marked as such.

## Technical notes

**Migration (additive)**
- `practice_modules`, `practice_lessons`, `practice_progress` (farmer-scoped).
- `input_products` (generic name, nutrient/active ingredient, category conventional|organic, unit, cost band, brand names array, organic flag), `nutrient_recommendations` (crop, stage, soil type, nutrient, dose per hectare), `infestation_types` (crop, kind, symptoms, severity), `infestation_treatments` (infestation → input_product, dose, safety interval).
- `soil_retention_practices` (soil types array, practice, effort, benefit, cost band).
- `farmer_input_plans` (saved plan per farm record, derived-scenario costing snapshot).
- `content_translations` (entity, entity_id, locale, field, value) so any of the above can be localised without schema churn; plus `profiles.preferred_locale`.
- Every new public table gets GRANTs, RLS enabled, and policies: read-open reference tables to `authenticated`; farmer-scoped tables via the existing `can_read_farm` / self-scoped patterns; writes to reference content limited to platform/state/knowledge roles. Seeded with synthetic AP/TS rows (chilli, paddy, turmeric, groundnut, maize, cotton) and Telugu/Hindi translations for seeded titles.

**Code**
- `src/lib/atap/practice.ts` — pure logic: stage ordering, progress/readiness, dose scaling by area, organic-vs-conventional cost comparison (labelled derived scenario), infestation matching, soil-retention filtering by soil type. Unit-tested.
- `src/lib/atap/practice.server.ts` + `practice.functions.ts` — loaders for the library, input advisor (including neutral marketplace-listing match), soil-care plan, progress writes, plan save, and escalation reuse. Access audited like `farm_intelligence.read`.
- `src/lib/i18n.ts` + `src/components/atap/LanguageProvider.tsx` — locale dictionary, `useT()` hook, `LanguagePicker`, translation-fallback helper for content rows. No new i18n dependency unless needed.
- Routes: `src/routes/_authenticated/practices.tsx`, `inputs.tsx`, `soil-care.tsx` (each with its own `head()` metadata), nav entries added to `AppShell`.
- Tests: new `practice.test.ts` and `i18n.test.ts` covering dose scaling, organic cost comparison, infestation matching, soil filtering, locale fallback; existing suite must stay green.

**Open [VALIDATE] items**
- Real nutrient dose tables and permitted-pesticide lists must be validated against ICAR/state package-of-practices before any non-synthetic use; seeded values are synthetic placeholders.
- Telugu/Hindi/Tamil/Kannada seed translations are machine-quality placeholders pending review by state extension staff.
