# FPO Management & Operations Workspace — Phased Upgrade

Today the FPO page (`/fpo`) is a single screen with staff invites, a pasted-CSV member import, a roster table and a visibility probe. Membership rows are roster-only text records (`member_ref`, `display_name`, `village_code`) that are not linked to AgriGhar farmer identities. Schemes exist but only for farmer discovery and government review — there is no FPO-as-applicant path, no procurement, produce, accounts, tasks or notifications for an FPO.

The upgrade turns `/fpo` into a sectioned workspace built on the existing identity, tenancy, role, consent, farm, scheme and marketplace foundations. No duplicate farmer, farm, scheme or marketplace entities are introduced — FPO features attach to those via relationships.

## Phases

Each phase is one slice: migration (additive only) → domain logic + tests → server functions → UI → demo data → exit gate for approval before the next phase.

### Phase 1 — Workspace shell, dashboard, FPO profile & onboarding
- New `/fpo` layout with left in-page navigation: Overview, Farmers, Schemes, Procurement, Produce & Market, Accounts, Opportunities, Documents, Notifications, Tasks, Insights, Team, Settings. Sections not yet built render as "coming in a later phase" with the entities already listed.
- Header: FPO name, verification status, FPO ID, district, state, primary commodities, active farmers, last profile update; primary actions (Add farmer, Invite farmers, Apply for scheme, Create procurement request, Create produce lot, Notifications).
- Dashboard metric cards, each drilling into its section.
- Guided FPO onboarding stepper reusing the existing `OnboardingStepper`: Basic details → Registration → Location → Leadership → Bank → Documents → Commodities → Verification → Activation. Bank fields masked, restricted to finance/CEO/signatory roles, every read/write audited.
- FPO document library with Uploaded → Under review → Verified → Rejected → Expired plus expiry reminders, reusing the existing document/storage pattern.

### Phase 2 — Farmer membership, tagging & Farmer 360
- Upgrade membership to relationship-based: link an existing AgriGhar farmer identity to the FPO instead of creating a farmer record. Add farmer paths: search existing, add new, bulk upload, invite by mobile, field-agent assisted.
- Membership lifecycle Invited → Farmer approval pending → Active → Suspended → Exited, with membership number, member type, crops, acreage, village cluster, assigned field officer.
- Searchable member registry with consent and verification columns.
- Tags, bulk tagging and smart segments as an FPO-only classification layer that never mutates farmer master data.
- Farmer 360 drawer inside the FPO workspace showing only consent-permitted tabs; bank/insurance/partner data never exposed without explicit purpose-scoped consent.

### Phase 3 — Opportunities & FPO scheme intelligence
- Opportunity Center cards (schemes, input procurement, collective sales, credit, insurance, training, infrastructure, processing, storage, equipment, export, certification, market linkage) with provider, benefit, eligibility, documents, geography, deadline, recommendation and status.
- FPO scheme eligibility buckets (Eligible/Likely, Needs verification, Not eligible, Applied, Approved, Rejected, Benefit received, Closed) with central/state/district/category filters.
- Scheme detail with a plain-language "why this FPO may be eligible" explanation derived from profile, geography, member base, crops and infrastructure; missing-information list; source and last-updated; official verification disclaimer. Eligibility is advisory only — never an automated decision.

### Phase 4 — FPO scheme application tracking & farmer facilitation
- FPO application workflow Draft → Documents pending → Ready to submit → Submitted → Under review → Additional info requested → Approved → Rejected → Benefit pending → Benefit received → Closed, with a tracker table and assignment to team members. Submission gated to authorized signatory where required.
- Member Scheme Opportunities: cohorts of potentially eligible members with actions Notify farmers, Help farmers apply, Create assisted campaign, Assign field agent. The FPO can never submit a farmer application without recorded farmer authorization/consent.
- Every status change writes an audit event and an optional notification.

### Phase 5 — Procurement
- Demand collection → aggregation → RFQ → supplier quotes → comparison → supplier selection → member authorization → order → distribution → payment → closed, across seed, fertilizer, crop protection, equipment, irrigation, packaging and farm services.
- Quote comparison on price, certification, availability, delivery date, transport, rating and landed cost, reusing the existing marketplace RFQ/quote entities.

### Phase 6 — Produce aggregation & market linkage
- Aggregate expected member produce by commodity and harvest window; surface mandi price observations (OBSERVED / FORECAST / DERIVED SCENARIO labels preserved), buyer enquiries, processor demand, logistics and storage options.
- Create produce lot, RFQ, buyer invitation, processor enquiry, market listing through the existing marketplace module.

### Phase 7 — Accounts, ledgers & grant funds
- Accounts & Transactions with Overview, Receivables, Payables, Farmer ledger, Procurement, Produce sales, Scheme/grant funds, Expenses, Bank reconciliation, Reports. Deliberately not a general ledger or ERP.
- Per-member ledger (date, transaction, debit, credit, reference, status).
- Grant fund tracker: sanctioned, received, utilized, balance, next installment, utilization certificate, reporting deadline with reminders.
- Finance visible only to FPO finance admin, CEO, authorized signatory and specifically granted roles.

### Phase 8 — Notifications & tasks
- Central Notifications & Tasks covering schemes, farmers, procurement, produce, accounts and compliance events, with per-user channel preferences (in-app, SMS, WhatsApp, email, push — non-in-app channels behind adapters, synthetic in development).
- Tasks (title, category, priority, assignee, due date, related farmer/scheme/transaction, status Open → In progress → Waiting → Completed → Cancelled) with My tasks and Team tasks views.

### Phase 9 — Team & permissions
- FPO role set: Super admin, CEO/Manager, Member manager, Field officer, Scheme manager, Procurement manager, Market/Sales manager, Finance admin, Accounts viewer, Compliance officer, Data viewer — as configurable role definitions, granular and server-enforced.
- Separation checks: field officer can add farmers but cannot see bank details; finance admin cannot change farmer consent; scheme manager prepares but cannot submit signatory-gated applications.

### Phase 10 — Insights, activity timeline & universal search
- Insights: member, scheme, procurement, market linkage, finance and engagement analytics, all drillable to source records.
- FPO activity timeline with filters (All, Members, Schemes, Procurement, Market, Accounts, Compliance) built from audit events.
- Permission-aware universal search across farmers, membership IDs, farms, schemes, applications, buyers, suppliers, transactions, invoices, documents, RFQs and produce lots.

## Cross-cutting rules held in every phase
- Authorization enforced in server functions and RLS; hiding UI is never the control.
- Farmer data stays default-deny and purpose-scoped; FPO membership grants roster authority only.
- Regulated bank/insurer/government decisions stay with the authorized human role.
- Configuration over forks: roles, statuses, opportunity catalogues, document types and eligibility rules are data.
- Every sensitive action audited; every workflow has explicit statuses; every metric drills through.
- Multilingual-ready strings via the existing i18n dictionaries; mobile-responsive; existing design tokens only.
- Realistic AP/Telangana synthetic demo data seeded per phase (e.g. Mahabubnagar Farmers Producer Company — 418 registered, 372 active, 2,846 acres, paddy/maize/cotton) so no screen ships empty.

## Technical notes
- Additive migrations only, one per phase, each with GRANTs, RLS enabled and tenant/role-scoped policies plus `updated_at` triggers. New tables map to the requested entities (FPO profile, membership, tags/segments, opportunity catalogue, scheme eligibility and application, procurement campaign/demand/quote/distribution, produce lot, buyer enquiry, account and farmer-ledger entries, grant fund, document, notification, task) and reference existing `tenants`, `organizations`, `farmer_profiles`, `farm_records`, `schemes`, `marketplace_*` and `audit_events` rather than copying them.
- Domain logic in pure `src/lib/atap/fpo*.ts` modules with unit tests; server functions in `*.functions.ts` under `requireSupabaseAuth`; server-only helpers in `*.server.ts`.
- Route stays `/fpo` under `_authenticated`, with in-page section state so existing links and head metadata keep working.

## Open [VALIDATE] items
- Whether FPO-side farmer scheme assistance requires a new explicit delegated-consent purpose code or can reuse an existing purpose.
- Which non-in-app notification channels are permitted in the current environment (all synthetic adapters until confirmed).
- Whether authorized-signatory submission gating must be legally enforced per scheme or is FPO-configurable.

## Suggested start
Approve this phasing, then Phase 1 is implemented and reported at its exit gate before Phase 2 begins.
