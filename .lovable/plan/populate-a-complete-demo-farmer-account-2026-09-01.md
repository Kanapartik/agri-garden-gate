# Populate a complete demo farmer account

Right now the farmer dashboard is empty for the account you sign in with (`farmer@agrivah.com`): there is no farmer profile, no farm parcels and zero season records, insurance snapshots, FPO membership or scheme applications. Only shared reference data exists (1,820 area benchmarks, 122 nearby service facilities). This slice seeds a full, realistic synthetic dataset for that account so every block of `/farm-history` and `/profile` renders with data.

## What the demo farmer will look like

A medium–large Guntur (AP) farmer, so the scale-aware layout shows the richer variant:

- **Profile** — full name, date of birth, gender, social category, ownership type, irrigation source, state/district/village, bank details (holder, bank, branch, IFSC, masked last-4), photo-less but 100% of required fields complete so scheme eligibility is unblocked. Provenance marked farmer-entered/confirmed.
- **Farm parcels** — 3 parcels totalling ~18 acres (paddy, chilli, cotton) with village codes and centroids near Guntur so "services near me" computes real distances.
- **5-year history** — 10 season records covering 2021–2025 (kharif + rabi) across paddy, chilli, cotton and maize: area, itemised input costs (seed / fertiliser / protection / labour / machinery / other), yield, price realised, revenue. Numbers trend gently upward so the 5-year trend, best season and per-acre margins are meaningful, with one weak season for contrast.
- **What my area grows** — already seeded district benchmarks will now compare against the farmer's own rows (Guntur × paddy/chilli/cotton/maize, 2021–2025), so the own-vs-area gap block populates.
- **FPO connection** — link the farmer to the existing Guntur FPO tenant as an active member (membership number, joined date, crops, acreage) plus a couple of member-level records so the FPO relationship is visible.
- **Insurance corner** —
  - *Current cover*: an active PMFBY snapshot for the current season/crop with sum insured per acre, indicative premium, farmer share and the FPO channel contact label, sourced from the existing insurer policy rows.
  - *Available cover*: additional snapshot rows in a not-covered / enrolment-open state for the farmer's other crops, plus scheme applications (one submitted, one in review, one available) against insurance/scheme catalogue entries so the "eligible applications" list is non-empty.
- **Documents** — a small set of synthetic document records (bank passbook, land record, ID proof) in a confirmed state so the profile document section is not empty.

Every row is flagged synthetic and clearly labelled as demo data. The four existing `*.test` farmer accounts get a lighter version of the same treatment (profile + 4–6 season rows + membership + one insurance snapshot) so FPO aggregate views and k-anonymity thresholds still behave.

## How it will be done

- One additive migration containing literal `INSERT` statements only — no schema changes, no new tables, no seeding at page load or from a server function. Inserts are idempotent (`ON CONFLICT DO NOTHING` / delete-and-reinsert scoped to the demo user ids) so re-running is safe.
- All values written to existing columns: `farmer_profiles`, `farm_records`, `farm_season_records` (with `input_costs` jsonb and `input_cost_total`, `provenance = 'farmer_entered'`, `is_synthetic = true`), `farmer_insurance_snapshots`, `fpo_members`, `farmer_documents`, `scheme_applications`.
- Bank account number is not stored — only holder/bank/branch/IFSC and the last four digits, matching existing masking rules.
- No RLS, policy or grant changes; the farmer reads their own rows through existing owner-only policies.
- No application code changes expected. If any dashboard block still shows an empty state after seeding, the cause will be traced to that block's query and fixed narrowly.
- Verification: re-run the row counts per demo user, then load `/farm-history` and `/profile` signed in as the demo farmer to confirm header numbers, history trend, area comparison, FPO badge, insurance corner and nearby services all render.

## Open [VALIDATE] items

Costs, yields, prices, premiums and sum-insured figures are synthetic and internally consistent, not official statistics; real CACP/PMFBY and state statistics still plug in behind the existing adapters.
