# Fieldwork languages

English (en) is the canonical survey source. Hausa (ha) and Fulfulde/Fula (ff) are draft translations authored for this prototype. Kanuri is excluded at the project owner's request. No claim of native-speaker verification is made. Botanical names, acronyms, units, proper names and source references may retain English.

All 342 guided-form section titles, field prompts and answer-choice strings have entries in both packs. Main navigation, role entry, dashboard labels, review controls, validation and offline messages are also covered. Technical blueprint material, the original PDF question catalog and unmatched design notes retain English. Original free-text answers are never machine-translated. The status bar identifies the packs as drafts; optional English question text can be shown alongside prompts.

`translations.tsv` is the editable reviewer table (English, Hausa, Fulfulde). JSON files are reviewable locale packs. `translations.js` bundles them for synchronous offline operation. When editing, regenerate JSON and the bundled file together; retain canonical English keys and bump the translation version. Never translate stored response values, IDs, question keys, numeric bands, validation conditions or user-entered text.

The presentation layer preserves explicit option values and button data attributes. Local preferences use a dedicated localStorage key; all survey answers remain in IndexedDB. Each new or resumed draft records interviewLanguage and languageVersion; exports include them. Language changes do not rerender active inputs or review notes. The service worker caches the bundled locale assets; no translation API, analytics call or external translation request runs in the application.

Before field use: a Hausa speaker and a Nigerian Fulfulde speaker must review each prompt, response option, consent statement, financial/agronomic term, percentage band and validation message against the source questionnaires. Back-translate independently, test comprehension with enumerators and respondents, approve a regional glossary, then version and sign off the packs. Current packs remain marked draft until this process is completed.

Enterprise/dashboard extension: version 2026-11-02.2 adds the 92 enterprise prompt translations, section titles, supplemental measurement prompts and 12 leadership view names. Some new answer choices and technical analytical notes remain in English pending native review; the enterprise screen states this. Do not infer complete localization or validated field wording from message counts.
