# Talent role journeys — configure four onboarding paths

## Current state (inspected)

- `role_definitions` already holds `talent_candidate`, `training_partner_admin`, `employer_recruiter`, `employment_exchange_admin` and `talent_operator`, each bound to an existing authority and gated by a `talent.*` feature flag.
- All `talent.*` flags are currently off, so none of these cards appear on the role selector.
- `onboarding_step_definitions` has **zero** rows for any talent role, so each card renders as "journey not activated" even when its flag is on.
- Recruiters and employers share the single `employer_recruiter` card today.

## What changes

Data/configuration only — no new authority, no new tables.

1. **Split recruiter and employer** into two catalogue rows:
   - `recruiter_agency` — "Recruiter / HR Agency" (talent intermediary)
   - `employer_company` — "Employer / Company / Startup" (talent employer)
   Both bind to the existing `employer_recruiter` authority and the `talent.employers` flag; neither gains new powers. The legacy `employer_recruiter` row is retired (marked inactive, kept for existing application references).
2. **Update `talent_candidate`** ("Agri Student / Job Seeker") and `training_partner_admin` ("Training / Certification Partner") labels/descriptions to match the agreed wording, verification stance and completion criteria.
3. **Add configured onboarding steps** for all four journeys, with required fields and evidence:
   - Agri Student / Job Seeker — self-service, no institutional verification: identity basics, education, skills/certifications held, job & training preferences, visibility consent. Complete when profile + training/certification interest + job preference are filled.
   - Training / Certification Partner — partner onboarding, institution verification: institution details, accreditation evidence, authorised signatory, course/certification listing. Complete on an approved course/certification listing.
   - Recruiter / HR Agency — business onboarding, institution verification: business identity, registration evidence, recruiter authorisation, role listing. Complete on verified recruiter + at least one role listing.
   - Employer / Company / Startup — business onboarding, institution verification: company identity, registration evidence, hiring contact, job requisition. Complete on verified employer + job requisition.
4. **Tenancy stays "later"**: none of these journeys provisions a tenant on activation; each records `authority_note` making clear tenancy and verification are separate from the profile.
5. **Turn the cards on**: enable `talent.domain`, `talent.candidate_profiles`, `talent.training_partners` and `talent.employers`. `talent.exchange_integration`, `talent.matching` and `talent.commercial_entitlements` stay off.

## Security

- Verification and approval remain human decisions by the existing talent operator / platform admin roles; a completed journey yields a draft/pending application, never an approved listing.
- Candidate profiles stay hidden until the candidate consents to visibility; employers and recruiters get consented referrals only. No policy or RLS change.
- Role rows bind only to already-existing authorities, so the catalogue cannot mint new power.

## Technical notes

- One additive migration inserting/updating `role_definitions` and `onboarding_step_definitions` rows and flipping four `feature_flags` values; existing rows updated in place by `code`/`key`, `employer_recruiter` set `is_active = false`.
- Tests in `src/lib/atap/onboarding.test.ts` / `talent.test.ts`: the four journeys expose steps, cards appear only when their flag is on, recruiter and employer resolve to the same authority binding, and the retired combined card is hidden.
- `/roles` and the configuration page pick the rows up with no component changes.

## Exit gate

Report the migration, flag changes and test results, then stop for approval.
