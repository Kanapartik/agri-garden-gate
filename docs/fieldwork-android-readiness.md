# Fieldwork release acceptance — 5 November 2026

## KrisTab review applied

Reviewed the local KrisTab FI source: `travelValidation.ts`, `travelDistance.ts`,
`useOfflineGPSSync.ts`, `offlineVisitReports.ts` and `useApprovals.ts`.
Applied its durable retry queue, explicit reported-route anchors, accuracy/jitter
and speed filtering, per-user/per-session distance separation, and review-history
patterns. Agrighar retains the requested standard approve/return/reject workflow;
KrisTab's pharmaceutical tour planning, product-detailing, compensation and customer
approval categories are outside this study's scope.

## Use cases and evidence

| Scenario | Implemented behavior | Verification |
|---|---|---|
| First sign-in | Phone ID; required initial-password change; locked failed attempts | Existing identity/API tests; prior live verification |
| Role or author spoofing | Server-owned role, author and supervisor relationship | Existing server authorization; narrowed RPC grants checked |
| Anonymous location access | Private table; scoped dispatcher only | Live database privileges/RLS checked |
| Fresh install without internet | Bundled login screen; enrolment needs internet | Packaged assets inspected; installed APK |
| Enrolled collector offline | Own saved state and assignments, bounded seven-day grant | Local UI flow; encrypted Android persistence tests |
| Process death / restart | Committed encrypted state and outbox survive reopen | Android device tests |
| Connectivity returns | Foreground callback and network-constrained background job | Android outbox/receipt processing tests |
| Interrupted upload | Pending data retained, retry with same record/event identity | Android isolated transport test |
| Server session expires | No silent impersonation; retain work and request sign-in | Android isolated transport and API tests |
| Older server version | Keep local and server copies; explicit conflict resolution | Android conflict test |
| Account switch | Separate encrypted queues; reset dashboard cache | Android queue isolation; local UI roles |
| Invalid submission | Server validation retains local draft | Existing server form validation; UI required-field checks |
| Review while offline | Decision requires acknowledged server response | Existing API behavior retained |
| Return for correction | Source note/history retained; correction creates revision | Existing server review behavior retained |
| Location permission denied | Collection continues with location exception; no invented fixes | Code path reviewed; real-device pilot still required |
| App leaves foreground | Native location subscriptions removed | Lifecycle code reviewed; real-device pilot still required |
| GPS inaccurate / mock / jumps | Evidence flagged/excluded from measured sample total | Travel tests |
| GPS gaps | No joining samples over five minutes | Travel tests |
| Two users interleaved | Independent user/session/day traces | Travel test |
| Offline location uploaded late | Sort by capture time, retain received time; deduplicate IDs | Travel tests and Android location receipt test |
| Report without login fix | Missing origin shown; no fabricated leg | Travel test |
| Historic/stale position | Date/user filter, last-known badge, accuracy/time | Isolated supervisor UI verification |
| Guided form | One question/matrix row; single-choice auto-advance; Enter/Continue | Isolated browser verification |
| Language change | English/Hausa/Fulfulde; canonical answers unchanged | Existing language packs; Hausa labels verified previously |
| Export/backup | Android document picker or browser download | Code path implemented; export device acceptance pending |
| Disk/decryption failure | Error retained; no automatic deletion of private data | Encrypted read/write failure handling reviewed |
| App upgrade | Stable package ID and private signing key | Signed APK signature verification |

## Production rollout gates

This is a signed release candidate, not a claim that field acceptance has completed.
Before broad deployment, run the APK on the actual low-memory Android phones used
by the team: airplane-mode collection, reboot, low storage, battery saver, permission
denial/revocation, interrupted multi-record sync and upload after session expiry.
Validate real GPS behavior and travel against known test journeys. Android may delay
background jobs under power restrictions; force-stop prevents scheduled work until
reopening. Supervisors cannot see unsynced locations in real time.

The existing HH/FGD/KII screens are source-adapted instruments; confirm every prompt,
matrix, skip rule and required field against the supplied PDFs. Hausa/Fulfulde packs
remain draft translations requiring native-speaker review. Kanuri stays excluded.
Approve study consent, retention/access policy and operating procedures for lost
phones, unsynced backups, reassignment and account recovery. Decide retention for
location events before enforcing deletion; no automatic deletion was introduced.

## Reference contracts

- Android offline-first guidance: https://developer.android.com/topic/architecture/data-layer/offline-first
- Bundled web content: https://developer.android.com/develop/ui/views/layout/webapps/load-local-content
- Android location permissions: https://developer.android.com/develop/sensors-and-location/location/permissions
