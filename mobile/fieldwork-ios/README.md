# Agrighar Fieldwork for iPhone and iPad

Version 1.0.0 release candidate · iOS/iPadOS 17+ · bundle ID
`com.agrivah.fieldwork`. This is separate from the existing Indian farmer pilot.

## Open the delivered project

Unzip `Agrighar-Fieldwork-iOS-Xcode-1.0.0-rc1.zip`, open
`AgrigharFieldwork.xcodeproj`, select **AgrigharFieldwork**, select an iPhone
simulator and choose Run. The delivered ZIP already contains every offline screen,
questionnaire, language pack and icon. There are no CocoaPods, package downloads or
third-party SDK dependencies. Simulator runs use Xcode’s local ad-hoc signing so
the Keychain works; an Apple Developer certificate is not needed for this step.

From a fresh full-repository checkout, generate the bundled resources first:

```sh
node scripts/package-fieldwork-ios.mjs
xcodebuild -project mobile/fieldwork-ios/AgrigharFieldwork.xcodeproj \
  -scheme AgrigharFieldwork -sdk iphonesimulator \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' \
  -derivedDataPath /tmp/agrighar-ios-build CODE_SIGNING_ALLOWED=YES CODE_SIGN_IDENTITY=- test
```

For the standalone ZIP, run the same command from its root with
`-project AgrigharFieldwork.xcodeproj` instead.

## Included behavior

- Same phone-ID accounts and server-authorized assignments as Android and web.
- Mandatory first-login password change, scoped supervisor review and five named
  leadership accounts. No passwords or staff roster are bundled in the app.
- Four offline survey instruments and English, Hausa and Fulfulde packs.
- One question or matrix row per screen, single-choice auto-advance, explicit
  Continue/Back and saved question position.
- AES-GCM encrypted SQLite storage; the encryption key is protected by iOS Keychain
  using AfterFirstUnlockThisDeviceOnly. File protection is enabled and the vault is
  excluded from backups. No password is persisted and the session cookie is never
  exposed to JavaScript.
- Durable outbox, server receipts, bounded retries, account isolation, retained
  conflicts and sign-in recovery after session expiry.
- Foreground network monitoring triggers sync. A network-constrained BGProcessing
  task requests background opportunities; iOS controls when it runs. Force-quitting
  or power/network restrictions can delay uploads until reopening the app.
- When-in-use location permission. Login, answer and report fixes and foreground
  samples are queued offline. Capture stops as the app becomes inactive. No Always
  permission or background-location mode is requested.
- Shared supervisor location/date filters, recent/last-known labels, accuracy,
  login-to-report and report-to-report straight-line estimates, and filtered GPS
  sample totals. The trace plot does not send coordinates to a map vendor.
- Native share sheet for deliberate exports; temporary exported files are removed
  when the share workflow finishes.

## Offline rules

First enrolment needs internet. Collector/supervisor identities may resume saved
work for seven days from the last successful online bootstrap. Leadership requires
online verification. Uploads after the twelve-hour server session expires require
sign-in; saved drafts remain. The Keychain key is device-bound. Uninstalling the
app, clearing its data or losing the phone can lose unsynced work.

The bundled web layer runs only from application resources. Navigation away from
the bundled main document is blocked. Its synchronous storage bridge accepts only
trusted top-level local frames. Native HTTPS requests allow only the existing
Agrivah fieldwork API endpoints and reject redirects. Website data is ephemeral;
private application data stays in the encrypted vault.

## Signing and distribution

This delivery is the tested Xcode project, as requested. No Apple signing identity
was present during the build. An unsigned archive or simulator app cannot be
installed on a physical iPhone.

For an iPhone build, select your Apple Developer team in Signing & Capabilities,
confirm the bundle ID is available to that team, connect/register test devices or
choose TestFlight, and archive again with signing enabled. The existing unsigned
archive verifies ARM64 compilation only; it is not an installable IPA. No Apple ID,
certificate, provisioning profile or signing secret is included in the ZIP.

## Validation and rollout

See `TEST-RESULTS.md` for the actual checks and remaining field acceptance. The
questionnaires retain their source-adapted status, and Hausa/Fulfulde translations
remain drafts pending owner/native-speaker review. Kanuri is excluded. Pilot real
phones for GPS/permissions, low memory/storage, airplane mode, app switching,
restarts and delayed sync before broad rollout. Complete App Store privacy answers
against the approved study questionnaire and retention policy before distribution.

References:
- https://developer.apple.com/documentation/uikit/using-background-tasks-to-update-your-app
- https://developer.apple.com/documentation/corelocation/requesting-authorization-to-use-location-services
- https://developer.apple.com/help/account/provisioning-profiles/create-an-ad-hoc-provisioning-profile
