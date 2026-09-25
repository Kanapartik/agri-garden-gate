# Agrivah FPO Intelligence & Governance Platform

This workspace turns the existing FPO operational modules into a connected
farmer-to-market application. The attached FPO product note is treated as
product input; current repository behavior and ATAP security rules remain the
implementation contract.

## Current slice: command centre

The authenticated `/fpo` dashboard now provides:

- a transparent operating-readiness indicator based on organization setup,
  active-member ratio and required-document status;
- an attention queue for incomplete onboarding, missing or due compliance
  records and pending farmer membership approvals;
- role-oriented views for executives, operations, market/finance and
  governance users;
- a farmer-to-market operating chain from member records through settlement;
- ten connected modules aligned to the product note; and
- an explicit boundary between observed/derived records and future prediction.

The readiness percentage is operational guidance only. It is not a credit,
scheme, insurance, governance or commercial decision score.

## Module mapping

| Product module | Existing workspace destination | Current state |
|---|---|---|
| Farmer 360 | Farmer membership | Operational |
| Crop intelligence | Insights | Recorded-data foundation; prediction not active |
| Input management | Procurement | Operational |
| Procurement & quality | Produce & market | Operational |
| Inventory & traceability | Produce & market | Lot foundation |
| Market & logistics | Produce & market | Operational |
| Finance & settlements | Accounts & funds | Operational |
| Insurance | Insurance cover | Operational |
| Governance & compliance | Documents, team, tasks and insights | Operational |
| Revenue intelligence | Insights | Derived foundation; prediction not active |

The application also retains schemes, applications, opportunities,
notifications, member history, team permissions and organization settings.

## Security and authority

- No database migration or new data authority is introduced by this slice.
- The command centre is presentation metadata over records the caller can
  already access.
- Existing server functions and row-level policies continue to enforce tenant
  and role scope for every module.
- FPO membership alone never grants private farmer farm data. Purpose-scoped,
  revocable farmer authorization remains required.
- Role lenses alter only presentation. They do not grant permissions.
- Bank, insurer, scheme and commercial outcomes remain human decisions.

## Evidence basis

Cards labelled **OBSERVED** come from recorded organization rows. Readiness and
other calculated values are labelled **DERIVED**. Yield, price, buyer demand,
spoilage, logistics and cash-flow forecasts stay unavailable until the relevant
farm, weather, market, warehouse and finance feeds are validated.

## Delivery roadmap

1. **Digital core** — farmer/member registry, land/crop foundation,
   procurement, lots, buyer enquiries, settlements, accounting and governance.
2. **Intelligence** — production, market, price, input and cash-flow forecasts
   with confidence ranges and source provenance.
3. **Automation** — weighment, quality, inventory, reconciliation, logistics,
   approvals and continuous control monitoring.
4. **Ecosystem** — consented integrations for banks, insurers, warehouses,
   e-NAM/ONDC/GeM, processors, exporters and government.

## Validation items before the next slice

- `[VALIDATE]` Select the pilot FPO tenant, staff roles and decision owners.
- `[VALIDATE]` Approve organization-specific maker-checker thresholds; do not
  hard-code the example amounts from the product note.
- `[VALIDATE]` Confirm authoritative land/crop, market-price, weather,
  weighbridge, quality, warehouse and accounting sources.
- `[VALIDATE]` Define units, grades, deductions, settlement rules and chart of
  accounts for the pilot commodities.
- `[VALIDATE]` Decide whether the next client is responsive web, Android, iOS,
  or all three; the current FPO operational client is the authenticated web
  workspace.

## Acceptance checks

- Command-centre and existing FPO domain tests pass.
- The production web build succeeds.
- Navigation from every command-centre card stays inside an existing scoped FPO
  section.
- No synthetic forecast is presented as observed or authoritative data.
