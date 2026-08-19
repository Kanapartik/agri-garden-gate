# B2C — Farmer Portal Profile, Document Intelligence & Working Scheme Context

## Answering the question first

- **"Active configuration"** on the main screen and the **Architecture** menu are platform-engineering surfaces: feature flags, role catalog, geography levels, adapter assumptions. They exist for platform admins and auditors. For a farmer they have **no significance** and currently leak internals into the farmer's home screen. This slice hides both behind admin/auditor roles.
- **Schemes appear broken for a farmer for two concrete reasons:**
  1. There are **zero published schemes** in the database, so discovery has nothing to list.
  2. Scheme rules evaluate against a farmer profile context that is **never collected** (age, social category, ownership type, extent, geography, passbook), so every rule returns `value_missing` → "needs information".

## What this slice builds

### 1. Farmer profile (the missing scheme context)
A `farmer_profiles` record owned by the farmer, holding: photo, date of birth (age derived), gender, social category, land ownership type (owner / leased / share-cropped / mixed), total extent in acres, primary geography (state → district → mandal → village from existing `geographies`), and bank passbook details (account holder name, masked account number, IFSC, bank/branch). Identity-style values are stored hashed or masked, never in the clear.

Sensitivity handling (as chosen): **purpose-scoped, farmer-only**. RLS lets only the farmer (and an explicitly assisting field agent who captured it) read the row. Scheme reviewers never read the raw profile — they see only the rule evaluation result and the fields the farmer explicitly submitted on the application.

### 2. Document capture + AI extraction
`farmer_documents` rows for passbook, land record (pattadar passbook / 1-B), ID proof and photo, stored in a private storage bucket with farmer-only access. Uploading runs a server-side extraction step through the existing adapter seam, backed by **real AI vision** (Lovable AI, image → structured JSON). Rules:
- Extraction is a **suggestion**: fields land in a review panel, the farmer confirms or edits each one before anything is written to the profile.
- Every field records provenance (`ai_extracted` vs `farmer_confirmed`) and confidence.
- No decision, eligibility outcome or approval is ever made by AI.
- Extraction failures degrade to manual entry, never block the farmer.

### 3. Farmer home screen
`/` for a signed-in farmer becomes a farmer home: profile completeness meter, "what's missing for schemes" checklist, next actions (complete profile, capture parcel, browse schemes), and quick links to farm, intelligence, training, inputs, marketplace. Access-console panels (Active configuration, audit feed) and the Architecture link move behind `platform_admin` / `auditor`.

### 4. Schemes that actually work
- Extend prefill so a scheme application is prefilled from the confirmed farmer profile **and** the farm record: age, social category, ownership type, extent, district, bank-linked flag.
- Seed synthetic published schemes for AP and Telangana (e.g. Rythu Bharosa-style input support, drip irrigation subsidy, small/marginal farmer credit-linkage, crop insurance enrolment) with real rules over the new profile fields, each on a published version.
- Discovery shows per-scheme "you meet / you don't meet / information needed" from `evaluateSchemeRules`, with the human-decision notice kept intact.

### 5. Multilingual
All new labels go through the existing `i18n` catalog for English, Telugu, Hindi, Tamil, Kannada.

## Technical notes
- One additive migration: `farmer_profiles`, `farmer_documents`, `document_extractions`, `land_ownership_type` + `social_category` enums, GRANTs, RLS (farmer-scoped), touch triggers, private storage bucket, and the synthetic AP/TS scheme seed as literal INSERTs.
- Domain logic in `src/lib/atap/profile.ts` (pure: age derivation, completeness scoring, masking, extraction-to-field mapping, scheme-context builder) with unit tests.
- Server work in `src/lib/atap/profile.server.ts` + `profile.functions.ts` under `requireSupabaseAuth`; AI vision call server-side only, with gateway error handling (402/403 surfaced, 429/5xx bounded retry).
- Audit events for profile writes, document uploads, extraction runs and scheme submissions.
- Prefill continues to require active baseline consent — paid or partner access never widens it.

## Out of scope
Real government registry / bank verification calls, payment disbursement, KYC vendor integration, marketplace or talent changes.

## Slice exit gate
Report migration, new routes/components, security implications, [VALIDATE] items and test results, then stop for approval.
