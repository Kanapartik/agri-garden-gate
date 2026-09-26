# Round 4: FPO portal and workspace translations

## Scope
Translate the complete FPO staff experience into Telugu, Hindi, Tamil and Kannada:
- FPO sign-in and invitation flow
- Separate FPO portal shell, dashboard, members, vouchers, comparison and staff administration
- Full FPO workspace, including profile, compliance, membership, team, opportunities, schemes, applications, procurement, produce, accounts, billing, notifications, tasks, monitoring, insights, insurance and comparison

## Changes
- Add a dedicated five-language FPO dictionary and connect it to the existing language preference.
- Replace visible English interface text, actions, table headings, form labels, hints, empty/error states, notices and status labels with translation keys.
- Localize presentation metadata and data-derived labels while leaving organization names, farmer-entered content, references and source records unchanged.
- Add a language selector to the separate FPO portal and sign-in screen so its language can be changed without entering the farmer workspace.
- Preserve permissions, consent checks, calculations, workflow stages, audit behavior and stored data.

## Validation
- Check all five dictionaries have identical keys and no FPO screen displays raw translation keys.
- Run focused translation tests and the project test suite; confirm the preview build is clean.
- Inspect the separate portal and full workspace in each non-English language at desktop and mobile widths.

## Native-speaker review
The implementation will include a structured wording checklist for Telugu, Hindi, Tamil and Kannada. Actual native-speaker approval requires a human speaker for each language; agent-written translations will remain marked as awaiting that review and any reviewer corrections can be applied without changing screen logic.
