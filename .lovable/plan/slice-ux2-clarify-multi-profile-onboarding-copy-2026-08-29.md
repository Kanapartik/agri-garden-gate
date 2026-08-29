# Slice UX2 — Clarify multi-profile onboarding copy

## Problem
On the "My onboarding" page, a signed-in farmer sees a section titled "Start a synthetic draft" listing every role (FPO, Bank officer, Insurer officer, etc.). This reads as if something is wrong — "why can a farmer start other profiles?" Multi-profile drafting is intended (one identity, many independently human-reviewed role journeys), but the wording doesn't communicate that.

## Change (copy-only, no logic or schema changes)

File: `src/routes/_authenticated/onboarding.tsx`

- Rename the section heading from "Start a synthetic draft" to **"Add a role profile"**.
- Add a one-line explainer under the heading: a single account can hold multiple role profiles (e.g. farmer + FPO office bearer + knowledge contributor); each journey is drafted separately and activated only after human review, and starting a draft grants no access by itself.
- Keep the role buttons, stepper, and all behavior unchanged.

## What does NOT change
- No restriction on which roles a user can draft (per your decision: keep as-is).
- No changes to authorization, RLS, consent, or the review queue.
- No schema or migration.

## Verification
- Existing tests unaffected (copy-only change).
- Visual check of the onboarding page as a signed-in user.

## Acceptance
- Section reads "Add a role profile" with the explainer line; everything else on the page behaves identically.
