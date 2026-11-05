# iOS verification — 5 November 2026

Release candidate 1.0.1 · Xcode 27.0 · iPhone 17 Pro simulator (iOS 26.5).

**15 XCTest checks passed, zero failures.** The final simulator test used Xcode's
local ad-hoc signing (`CODE_SIGN_IDENTITY=-`) so the actual iOS Keychain and native
WebKit bridge were available. No Apple Developer certificate was needed for these
simulator checks. The ARM64 device archive also built successfully without signing.

Passed checks:

1. Encrypted persistence survives database reopen; stored interview text is not plaintext.
2. Opening with the wrong key fails without deleting the saved value.
3. JSON comparison handles key ordering correctly.
4. Successful server receipts clear only the active account's queue.
5. Interrupted uploads retain the durable payload.
6. Expired server sessions retain work for sign-in recovery.
7. Version conflicts retain local and server copies.
8. Location uploads remove only the individually acknowledged event IDs.
9. Edits made during an upload remain queued.
10. Explicitly discarding a local conflict removes its pending upload.
11. Cached UI identity contains no session cookie.
12. Offline screen/language resources exist; Always/background-location permission is absent.
13. The bundled login renders in actual iOS WebKit, the synchronous encrypted bridge
    works, UUID generation exists, and cookie reads through that bridge are blocked.
    The sign-in button fits without scrolling on the test iPhone, and a native
    WebKit screenshot is retained with the XCTest result.
14. A stale upload receipt cannot suppress a later record revision.

The existing shared web/travel suite had 22 passing checks in the Android release.
This iOS addition packages those same screens; it introduces no database migration,
new users, role changes or production survey responses.

Not claimed as completed: physical-iPhone GPS accuracy/battery tests, live household
collection, native-speaker translation approval, full questionnaire sign-off,
background scheduling timing under real phone power conditions, Apple signing,
TestFlight submission or App Store review. iOS chooses background execution timing;
foreground connectivity changes also trigger sync. Offline locations cannot appear
on a supervisor's dashboard until uploaded.

The delivered ZIP includes a self-contained Xcode project and bundled offline
resources. An unsigned archive is a build result, not an iPhone-installable IPA.

15. The location-exception input and Back/Continue navigation fit in the focused
    iPhone survey viewport without scrolling the page (synthetic layout fixture).

The focused question layout was also verified in an isolated browser at 288×568
and with a 288×320 reduced-height viewport. Optional interview controls are in
Options; saving/closing returns to the full navigation.


## 1.1.0 build 3 — 5 November 2026
15 simulator tests passed. Shared UI verified at 288×568 with exact missing-question navigation after save/close. The separately reviewed database migration was approved and applied. Deletion/exclusion controls are enabled after server refresh. Web tests: 22 passed; isolated workflow database and navigation checks passed.
