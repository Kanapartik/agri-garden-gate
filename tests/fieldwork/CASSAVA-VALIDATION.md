# Cassava survey update — 15 November 2026

The four owner-supplied DOCX questionnaires are mapped in `public/fieldwork/cassava.js`. `cassava-schema.json` is a generated, inspectable dictionary. `scripts/build-cassava-migration.mjs` derives the server definitions from the same questionnaire, preventing separate client/server field lists from drifting.

## Study groups

- **Jigawa - Livelihood Mapping Studies:** HH, FGD, KII and ENT. Existing response keys, questionnaire versions and stored answers are retained.
- **Jigawa - Value Chain Analysis:** CF (farmers), CT (traders/marketers), CP (processors), CC (cooperative/community).

## Mapping decisions

- Original questions and response choices are retained with typographic/spelling cleanup. “Others” becomes “Other” with a conditional specification field.
- Assigned LGA is inherited from the server-checked LGA selected at interview start and displayed in the interview header/review; Ward/Community remains a question.
- Consent, automatic capture date and missing-location reason are operational collection safeguards, additional to the supplied questionnaires.
- Numeric measurements retain their units. Trading volume and processing capacity split into amount, kg/tons and weekly/monthly or daily/weekly period. Cooperative cultivated land uses an explicit acres/hectares choice. Prices are in naira with an explicit per-kg/per-ton choice where the source allows both.
- Activity/commodity/buyer/challenge/support/training lists allow multiple responses; profile choices and yes/no questions allow one. “None” is exclusive.
- Follow-ups are conditional on the relevant activity or yes/no response. Hidden downstream answers are cleared when their parent changes. Empty sections are skipped automatically.
- Comments/remarks and location-exception reason are optional, except that a missing location requires an exception before submission. Other applicable questions are required. Consent must be Yes for submission.
- New wording uses the existing English/Hausa/Fulfulde dictionaries where a match exists and English fallback otherwise. No new translations were invented. The new-study menu discloses this in non-English mode.
- Approved Cassava evidence is separated from the existing JAIP livelihood analytics; record lists and exports include the study identity.

## Verification

```
npm install --prefix /tmp/fieldwork-cassava-tests @electric-sql/pglite
NODE_PATH=/tmp/fieldwork-cassava-tests/node_modules node tests/fieldwork/cassava.cjs
node tests/fieldwork/workflow-ui.cjs
npx vitest run src/lib/fieldwork
```

The Cassava integration test applies the actual baseline, location, governance and Cassava migrations in isolated PostgreSQL. It tests all four forms through the actual save and supervisor-review RPCs, required fields, percentage/unit/period validation, nested skip rules, exclusive choices, LGA assignment, canonical study tags and preservation of a pre-existing HH payload. No production fixture account or response was created.

22 auth/API/travel tests passed. Navigation tests passed, including exact missing-question links and empty-section skipping. 16 iOS simulator tests passed, including offline presence of all eight surveys and both study groups. Android APK and App Bundle builds and signature verification passed. Web production build passed.

The production schema update was applied; all 11 pre-existing response payloads retained the same aggregate fingerprint before and after migration. Only form definitions and the permitted-instrument rules changed. No existing response was edited.
