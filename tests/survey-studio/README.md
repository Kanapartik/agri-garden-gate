# Survey Studio verification

Survey Studio is the web administration and dynamic collection workspace at `/survey-studio/index.html`. It shares the existing fieldwork phone login and HttpOnly session, with separate survey and client tables. Existing fieldwork instruments, responses and FPO permissions retain their current workflows.

## Workflows

- Creators save draft questionnaires with sections, 14 question types, required answers, limits and conditional display. Save before leaving; unsaved designs prompt on exit.
- Request review validates the complete questionnaire and locks editing. Another authorised reviewer approves or returns it with a note. Publishers release approved versions. Published versions cannot be edited or deleted.
- Studio administrators create clients with an initial client admin. Publishers assign published versions. Client admin/leadership create repeatable campaigns and share their sign-in links with active client members. Pause either a campaign or its assignment to stop new collection.
- Clients can copy an assigned published version into a new draft; changes follow the same review/publication process. Existing responses stay pinned to the original version.
- Client admin/leadership alone read responses. Studio creator, reviewer, publisher and administrator permissions confer no result access. A creator can also be an explicitly assigned client admin/leadership member.
- Client admins manage membership using existing 10-digit phone login IDs. Collectors get questionnaires and submission receipts, without access to other responses. Studio does not create new login credentials.
- Results paginate in groups of 25 with survey-version and exclusion filters. Leadership can exclude/restore a response with an audit note; the submitted response remains immutable.
- Word download exports a complete, standards-based `.docx`: all sections, questions, options, grid rows, requirements, limits and branching conditions, including questions hidden by particular answers.

## Offline collection

Open a campaign online once on each device to cache its immutable published schema. Collection drafts and pending responses use per-account IndexedDB keys; client result lists and details are never cached. The application shell is cached by a scoped service worker. Cached access lasts seven days; all uploads are reauthorised by the server. Reconnect with the application open to retry queued responses; an expired session requires sign-in again without clearing the queue. Responses are removed from the queue only on an idempotent server receipt. Validation failures expose a correction action that opens the failed question. Paused campaigns or revoked memberships retain the queued response for administrator resolution. Sign out clears local drafts/queue after confirmation. Survey design, review, publication and client/result administration require internet access. Device capture time and Nigeria capture date remain separate from server submission time.

## Initial access

The migration grants Studio administration to the existing five active named leadership accounts. These accounts are explicit members of the State of Jigawa client, with Muhammad Halliru as its initial admin when present. No survey designs, collected responses, test accounts or passwords are seeded.

## Checks

Install test-only dependencies outside the app: `npm install --prefix /tmp/agrighar-studio-tests @electric-sql/pglite jsdom fake-indexeddb`.

From the repository:

```
NODE_PATH=/tmp/agrighar-studio-tests/node_modules node tests/survey-studio/database.cjs
NODE_PATH=/tmp/agrighar-studio-tests/node_modules node tests/survey-studio/ui.cjs
node tests/survey-studio/word-and-engine.mjs
```

The database suite applies the actual four legacy fieldwork migrations before the Studio migration. All fixtures stay in local memory. It covers independent review, version conflicts, published immutability, published-only assignment, two-client isolation, collector and platform-admin result denial, explicit creator leadership membership, conditional/grid validation, idempotent collection, exclusion retention, direct-table denial and access revocation. The DOM suite covers design, review UI, required and conditional inputs, draft recovery and offline queue/receipt syncing. Word checks generate `/tmp/agrighar-studio-survey.docx` for ZIP/XML inspection. Existing fieldwork HTTP tests include the Studio dispatcher, session/CSRF checks and actionable validation responses.
