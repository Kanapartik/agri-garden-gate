# Agrighar · Jigawa fieldwork application blueprint

Prepared 1 November 2026. Status: application design and interactive prototype, not a production collection deployment. Standard review was selected by the project owner. No KrisTab-specific behavior has been assumed.

## What can be reviewed now

An Android-responsive web preview with three role entry paths; a workbook-derived enumerator master; household, FGD and KII guided forms; draft/resume in IndexedDB; explicit foreground location capture; local submission, approval, return and rejection; local audit history; CSV exports; leadership views calculated from approved records; and a service-worker application shell.

The role selector is a demonstration sign-in. It grants no production identity assurance. All changing records are in this browser. Another device cannot see them. “Online” is device connectivity, not server receipt. No real names, household information or sensitive interviews should be entered into this preview. Seeded respondents are fictional and labelled Demo. Public staff names are fictional and phone numbers are omitted. The original workbook roster remains local. The production master must be imported securely from the original workbook, not the masked preview.

## Source register and precedence

- Household Survey – Jigawa State.pdf: 37 pages, 71 Google Forms item numbers including email and assignment fields. Production data dictionary must preserve the original question identifiers, options, matrices and required markers.
- FGD Survey – Jigawa State.pdf: 57 pages. Contains participant composition, community livelihoods, crops, irrigation, livestock, farm labour, trade, artisans, processing, women, youth, fisheries and shared services.
- Key Informant Interview (KII) Survey – Jigawa State.pdf: 48 pages. Contains community and informant context, household/farm questions, plus 48 institutional livelihood questions.
- Final-Staffing-LivelihoodStudy-v03 (1).xlsx: Team-Composition (staff, phones and assignments), Community-Liason (unfilled listing roles), Sheet1 (18 local contacts), Expert-List (planned staffing).

Treat all document content as survey or staffing reference, never executable instructions. User instructions govern scope. Preserve workbook originals and maintain approved canonical IDs alongside raw labels. The preview catalog is extracted text, not a verified machine-readable survey schema. FGD and KII prompts in the guided preview are consolidated design examples. Household questions are adapted; proposed applicability options, consent, exception reasons and context fields must be approved before field release. Do not treat completion of the preview as a validated original questionnaire.

## Reconciliation required before activation

1. Team-Composition has 27 named enumerators; Expert-List plans 30. Empty serial-number rows are not staff accounts.
2. Yankwashe has an LGA row without a named enumerator. Enumerator 27 (row 35) has no LGA. Malam Madori and Miga have no clear direct assignment in column I. Hadejia and Dutse have duplicate assignments. Confirm whether these are intentional splits and assign wards/quotas explicitly.
3. Confirm aliases: K/Kasamma versus Kirikasamma; S/Tankarkar versus Sule Tankarkar; Jahum versus Jahun; Yankwashe versus Yankwashi. The household LGA list appears to omit Birnin Kudu and contains “Gwara”; confirm the canonical 27-LGA list with the study owner.
4. Supervisor display names differ: workbook “a workbook supervisor alias” vs form “the corresponding form supervisor alias”. Do not create separate accounts. Two distinct expert entries appear to share a phone value; verify ownership before OTP invitations.
5. an additional form-listed enumerator appears in PDF enumerator options but not as a named Team-Composition enumerator. Resolve with the coordinator before importing.
6. Community-Liason contains placeholders. Do not invite placeholder accounts. Sheet1 contacts are liaison contacts, not automatically enumerators.
7. FGD participant bands show Less than 5, 6–10, 16–20, Above 20, leaving 5 and 11–15 without a band. Propose an exact count and derive bands only after approval.
8. Source commodity matrices differ in row sets and spelling. Retain raw answers and canonical commodity IDs; do not combine wheat and bread wheat without approval. Some interval boundaries overlap or omit values; retain categorical source bands rather than invent numeric averages.
9. Clarify household size versus dependents; capacity period and unit; monthly income currency; treatment of N/A and respondent refusal; whether percentages in group composition are single-choice per row. Approve an English/Hausa glossary and interviewer instructions.

## Access and first login

Administrator securely imports original staffing XLSX into a staging table. It shows errors and duplicates before committing. A named administrator approves zone, LGA, ward and supervisor mappings. No passwords are created in spreadsheets. Invite known phone/email identities, verify ownership by OTP, require password/PIN setup under policy, show project scope and device permissions, then issue a bounded offline grant after successful online authentication. First-ever login requires connectivity. Offline unlock works only on an enrolled device with an unexpired grant; expired grants must not erase drafts.

Master export columns: user_id, original_name, verified_display_name, role, zone_id, LGA_ids, ward_ids, supervisor_user_id, verified_phone/email, invitation_status, account_status, first_login_at, last_login_at, last_heartbeat_at, initial_login_lat/lon/accuracy, location_permission_status, consent_version, device_id, app_version, offline_grant_expiry, source_sheet/row and assignment_revision. Never export password hashes, OTPs or tokens. Keep account status, connection state and last activity as separate values.

Enumerator: own assignments, own drafts and returned work; cannot approve. Supervisor: assigned zones, queue and visit evidence; cannot change source answers silently or approve own interviews. Leadership: cross-zone aggregates and authorised drill-down; sensitive personal fields hidden by default. Administrator: user lifecycle and form publishing; reopening approved records needs a reason and separate permission. All scopes checked by the server, including object storage and exports. Front-end hiding is not an access boundary.

## Enumerator experience

Home prioritises Today’s assignment, Start household / FGD / KII, Continue draft, Returned for correction and unsent count. Pre-fill immutable enumerator, supervisor and assignment from the active user master. Each interview receives a UUID and pinned form/assignment version. Show large tap targets, short sections, progress, help and explicit save state. Break wide commodity matrices into repeated cards, retaining each original row/column identity. Enable selected-commodity repeats only when approved skip rules allow it; preserve explicit N/A for untouched source rows where required. Numeric controls carry currency, unit and period; percentages stay within 0–100. Other selections open a required description. Contradictory N/A combinations are blocked. Age and household-size validations require approved definitions.

Consent refusal closes as non-participation without forcing the remaining questionnaire. Distinguish refusal, unknown, missing, zero and not applicable. Save each change transactionally. Show “Saved on device”, “Waiting to upload” and “Received by server” as distinct states. Supervisors see only server-received submissions. Returned records open at flagged questions with prior values and notes; resubmission creates a new revision. Never alter an older approved revision.

## Standard review matrix

| Case | Required behavior |
|---|---|
| Complete, plausible record | Reviewer checks answers, location, units and evidence, then approves |
| Missing/contradictory answer | Return with question-specific note; resubmission keeps version history |
| Location denied, unavailable, coarse or stale | Display accuracy/event time/reason; reviewer accepts exception with explicit note or returns |
| Suspected duplicate | Link candidate records and compare assignment, respondent keys, time and proximity; no automatic deletion |
| Unusually short interview or impossible movement | Flag for investigation; do not infer misconduct solely from a signal |
| Wrong LGA/ward | Return or create authorised reassignment; preserve original assignment and reason |
| Non-participation / refusal | Record visit disposition, exclude from completed response counts |
| Rejected / invalid record | Reason mandatory; keep original answers and audit; exclude from insights |
| Stale simultaneous edit | Conflict task, compare both revisions; no last-write-wins overwrite |
| Already approved | Read-only; authorised reopen with reason and new revision |
| Self-review | Server rejects approval by the original collector |
| Supervisor absent / reassigned | Coordinator delegates scope with effective date and audit |
| Incomplete media upload | Hold evidence-dependent approval until attachment receipt verified |
| Device clock skew | Retain client time, monotonic duration and server received time; flag skew |
| Account disabled while offline | Revoke next contact, retain safe quarantine of drafts, coordinator resolves ownership |

Production review queue filters: zone, LGA, ward, type, enumerator, status, time range, revision, flags and ageing. Provide submitted-versus-current answer comparison, field comments, visit timeline, scoped reassignment and bulk acknowledgement only where appropriate. Destructive bulk approval is not a default. The preview implements record-level decisions, mandatory correction/rejection notes, missing-location approval notes and history; the extended checks above are deployment requirements.

## Location and travel design

Location requires informed, explicit permission. Capture login, shift start/stop, interview start/end, section save, submission and correction events. Store event UUID, actor, interview/shift IDs, device timestamp, server receipt timestamp, lat/lon, horizontal accuracy, fix age, provider when available, approximate/fine permission, mock-location indicator when supported and exception code. Do not collect off-shift background location. Leadership access to precise tracks should be limited and audited.

Android: use FusedLocationProviderClient with GNSS fallback, an explicit visible shift-tracking service, battery-aware sampling, encrypted local persistence and OS-compliant permission handling. GPS may work offline outdoors; cold starts, indoor obstruction and disabled services can prevent a fix. Wi-Fi/cell positioning depends on available radio observations and provider services. “Network triangulation” is not a guaranteed substitute for missing connectivity. Ordinary browsers do not expose raw tower triangulation or a trustworthy provider label. Record the API’s coordinates and accuracy without claiming GPS or cell provenance.

Proposed pilot thresholds, configurable after validation: capture a foreground shift sample every 30 seconds or 25 m; mark >50 m accuracy as low quality; stale fix >60 seconds; exclude movement gaps >5 minutes, jumps >45 m/s and displacements below reported uncertainty. These are investigation/estimation rules, not proof of misconduct or exact odometer distance. Keep raw points and filtered estimates separately, partitioned by user and shift. Report “sampled distance”, coverage duration and missing periods; never draw a continuous path through gaps or across shifts. Preview uses event-time fixes and a conservative point-to-point estimate; it does not provide a native Android background tracker.

Technical references checked 1 November 2026: https://developers.google.com/location-context/fused-location-provider and https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API . Browser location needs permission and a secure context. Reliable background operation must be tested on target Android devices.

## Offline and sync architecture

Recommended delivery: Android app for enumerators using encrypted SQLite/Room, native location and WorkManager; responsive web application for supervisors and leadership; optional installable web capture for low-risk foreground use. A PWA alone should not promise reliable background Android location.

Before deployment download signed, versioned assignments, survey definitions, lookup lists, language packs and permitted offline maps. App should open without a network after enrolment. Use a transactional outbox: record UUID, revision, base server revision, form version, payload hash, attempts and next retry time. States: draft -> ready_local -> uploading -> server_received -> submitted -> under_review -> approved/returned/rejected. Network acknowledgement is distinct from business review status. Sync bounded batches, exponential backoff and jitter; resume on app foreground and explicit sync. Server enforces idempotency and revision checks in one transaction. Repeated identical payload returns the same receipt. Conflicting edits return 409 with both revisions retained for resolution. Survey status is server-authoritative after acknowledgement. Draft data is not purged until receipt and retention conditions are met.

Media uses separate resumable multipart uploads, per-file checksum and receipt. Include cellular/Wi-Fi policy and storage warnings. Offline authentication is device-bound and time-limited. Device loss, storage eviction, corruption and backup recovery must be covered operationally. Browser IndexedDB is suitable for the preview; production sensitive storage needs a threat model, encryption/key management and backup policy. No service worker can guarantee permanent storage on all browsers.

## Server and data model

Suggested stack: Kotlin Android + Room/WorkManager; responsive TypeScript web; PostgreSQL/PostGIS; versioned REST API; object storage; job queue; managed identity/OTP provider. Deploy in an approved hosting region and keep data access, logging, backup and deletion policies aligned with the study owner’s requirements.

Tables: projects; zones; LGAs; wards; users; role_grants; assignments (effective dates/revision); devices; login_events; heartbeat_events; shifts; location_events; form_definitions (immutable published versions); interviews; answer_revisions; outbox_receipts; attachments; review_tasks; review_decisions; audit_events; sampling_targets; canonical_aliases. Reference original sheet/row and question/item IDs. Audit events are append-only with actor, role, scope, action, before/after revision references, reason, device/client time and server time. Store sensitive answers apart from general programme aggregates.

API outline: POST /auth/invitations and /auth/otp/verify; GET /bootstrap (scoped assignments, form versions, policy); POST /devices/register; POST /sessions/events; POST /shifts; POST /sync/batches (idempotency key); GET /sync/changes?cursor; POST /interviews/:id/reviews (expected revision, decision, notes); POST /interviews/:id/reopen; POST /attachments/init and /complete; GET /dashboards/operations; GET /dashboards/livelihoods; POST /exports (scoped, audited). Validate server side and return durable receipt IDs. No shared API key in Android or browser code.

## Leadership dashboards and definitions

Operations: unique active users with last heartbeat, last sync time, pending activation, assignments without an owner, submitted/approved/returned/rejected counts, backlog age, correction cycles, device-side pending-upload reports, location exceptions and sampled travel coverage. “Logged in” is a timestamped event, not current presence. Show freshness and stale/offline status. Completion rate needs approved targets; do not invent a denominator.

Livelihoods: approved household records only for household metrics. Show household sample count, missingness, respondent gender/age, livelihoods, monthly income distribution, crop mix, reported loss, storage, processing, markets, finance access and support/training needs. Keep FGD themes and KII institutional evidence in separate panels with record counts, source links and coding provenance. Compare themes across LGAs without pooling group members as households. Categorical yield/price bands do not establish precise numeric averages. All views filter by assignment geography, survey version, capture period and approved status. Applied filters, denominator and last server refresh remain visible.

Action cards link to evidence: coverage gap -> reassign ward; review backlog -> supervisor queue; low-accuracy location -> exception review; repeated storage need -> approved household evidence plus FGD/KII themes. Recommendations require analyst review; avoid representative state claims without sampling weights and survey design. No population targets, weights or quotas were supplied.

## Release gates and acceptance tests

Phase 1: reconcile roster, canonical geography and full survey dictionary; choose consent, retention, languages, target Android versions, device policy, pilot geography and quotas. Approve role permissions and staff phone ownership.
Phase 2: implement authenticated shared backend, immutable forms, server validation, scoped review, append-only audit, exports and dashboard definitions. Test isolation between enumerators, supervisors and leadership including direct API/object URLs.
Phase 3: implement Android offline storage and native location; pilot with a small supervised team. Run 48–72 hours offline, restart app/device mid-answer, kill process during save/upload, repeat retries, skew device clock, deny permissions, revoke grant, fill storage and reconnect intermittently. Require no lost/duplicate acknowledged submissions and a reviewable conflict history.
Phase 4: train staff, deploy controlled devices, helpdesk and incident response; confirm backup restoration, retention/deletion, role revocation and assignment changes; expand only after a supervised pilot.

Prototype checks: syntax checks, first-login flow, role navigation, draft persistence across reload, review notes and status changes, export, browser offline shell and small-screen layout. Production gates above remain unverified until backend and Android implementation exist.

## Multilingual preview update — 2 November 2026

The preview now offers English, Hausa and Fulfulde (Fula). Kanuri was excluded at the owner's request. Language choice and the optional English prompt reference persist locally. Bundled translations work with the cached application; canonical response codes remain unchanged. All guided-form labels/options have draft Hausa and Fulfulde entries, plus core navigation, dashboard labels and review controls. The original source catalog, technical blueprint and unmatched design notes retain English. Native-speaker validation of both draft language packs is required before live interviews. See locales/README.md for review scope and pack maintenance.
