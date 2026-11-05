# Agrighar Fieldwork Android

Release candidate 1.0.1-rc1, package `com.agrivah.fieldwork`, Android 8.0+.
This is separate from the existing Indian farmer pilot application.

The APK bundles the four survey instruments, English/Hausa/Fulfulde packs and
leadership/supervisor screens. It does not download executable screens from the
website. API traffic goes only to `https://agrivah.com/fieldwork-api/`.

## Offline operation

First enrolment and initial password replacement require internet. After enrolment,
non-leadership identities may resume saved work for seven days offline. Leadership
requires online verification. The server session lasts twelve hours; uploading
after expiry requires sign-in, with drafts retained. Disabled accounts are denied
at the server, while offline access ends with the cached grant.

Draft state, session cookies, offline identity, pending survey uploads, location
outbox and receipts are encrypted with AES-GCM using an Android Keystore key.
SQLite commits are durable. Passwords are not persisted. OS/cloud backup and device
transfer are disabled because keys are bound to the device. Uninstalling, clearing
storage or losing the device can lose unsynced work; export a backup if needed.

A network-constrained Android JobScheduler task uploads pending work even after the
activity closes, and survives reboot. Foreground connectivity callbacks and a
30-second sync cycle also trigger uploads. Android controls exact background job
timing, especially under battery restrictions or force-stop. Conflicts retain both
copies; validation errors retain the local draft. Review decisions require an
online server response. The worker processes bounded batches and uses exponential
retry backoff. Account queues remain separate.

## Location

The enrolment screen discloses supervisor access to location and travel evidence.
Android requests fine/coarse location permission. Capture runs only while the
activity is resumed; GPS and the available network provider are sampled. There is
no background-location permission and no off-app location collection. A denied
permission or unavailable GPS does not invent a location; collectors must record
an interview exception. Mock-provider evidence is flagged.

Login, foreground samples, answer events and reports have unique event IDs,
client capture times, server receipt times, session IDs and accuracy. Each user's
trace is separated by session and Nigeria calendar date. GPS totals filter poor
accuracy, stationary jitter, implausible jumps and gaps over five minutes. Reported
legs separately show straight-line login-to-report, report-to-report and displacement
from login. They are not measured road distance or reimbursement amounts. The
supervisor sees stale/last-known labels and can select user and date. Coordinates
are plotted locally without disclosing tracks to a third-party map provider.

## Build and signing

From repository root:

```sh
node scripts/package-fieldwork-android.mjs
JAVA_HOME=/path/to/jdk17 ANDROID_HOME=/path/to/sdk mobile/fieldwork-android/gradlew -p mobile/fieldwork-android lintDebug connectedDebugAndroidTest assembleRelease
python3 scripts/sign-fieldwork-android.py /path/to/app-release-unsigned.apk /path/to/agrighar-fieldwork.apk
```

Build outside cloud-synced folders if generated class files are duplicated by sync.
The signing helper keeps the release key and password under ignored
`.fieldwork-private/android-signing/`, with restrictive permissions. Back up this
folder securely: the same key is required for future in-place APK updates. Never
commit or publish it. The signed APK contains no staff passwords or private roster.

## Release acceptance

See `docs/fieldwork-android-readiness.md`. This release candidate still requires a
real Jigawa Android field pilot and questionnaire/translation sign-off before a
full production rollout. No Play Store publication has been performed.
