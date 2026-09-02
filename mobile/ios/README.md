# Agrivah Farmer — iOS pilot

Native SwiftUI companion to the Android Agrivah farmer pilot. The app
uses the frozen contracts in [`../../docs/mobile/`](../../docs/mobile/) and keeps
authoritative identity, land, and FPO verification pending until their adapters
are connected.

## Pilot baseline

- Primary UI: Telugu (`te-IN`)
- Minimum iOS: 17.0
- Current synthetic snapshot: Ramesh Naidu Vemuri, Guntur/Kaza, Andhra Pradesh
- Crop plan: paddy 8.40 acres, chilli 5.60 acres, cotton 4.20 acres
- Parcels: `GNT-KAZA-114/2`, `GNT-KAZA-98/1`, `GNT-KAZA-77/4`
- Local sensitive state: iOS Keychain (`whenUnlockedThisDeviceOnly`)
- Mobile API: defaults to `https://agrivah.com/mobile/v1`; an optional
  `MobileAPIBaseURL` bundle value may override it but must be HTTPS.
- Authenticated profile refresh: `GET /me`, with bearer tokens stored in the
  iOS Keychain (`whenUnlockedThisDeviceOnly`)

Version `0.3.0` retains the supplied Agrivah lockup and app icon and includes the
same farmer workspaces available in the web application: profile, onboarding,
farm, farm history, farm intelligence, training, inputs and protection, soil
care, consent, schemes, and marketplace. The current snapshot includes 10 crop
history records, two insurance snapshots, five training modules (12 lessons),
eight intelligence categories, eight soil practices, four schemes and the web
account's empty marketplace state. The app requests
SMS OTP through `/auth/otp/request`, verifies it through `/auth/otp/verify`, then
refreshes `/me` on launch and on demand. Until SMS delivery is configured, a
failed OTP request for the explicitly authorized synthetic pilot phone opens a
device-local sandbox path using code `123456`. The phone is matched with a
one-way digest; the fallback creates no backend session, grants no server access,
and is visibly labelled as offline in the app.
The local sandbox view shows Ramesh Naidu Vemuri, male, 18.20 acres and the three
Guntur/Kaza parcels. This is intentionally labelled as a snapshot: the web record
uses an email auth subject while the phone ending `0467` remains a different
synthetic backend account. No production identities are silently linked by this
mobile release. Identity and land verification remain pending; FPO membership is
shown as active synthetic data rather than authoritative verification.

The checked-in source contains no complete farmer phone number, identity number,
access token, refresh token or land-document number. The temporary static OTP is
the only credential intentionally present and grants access only to the local
synthetic profile. Authenticated values remain runtime data.

## Build and test

Open `AgriGharFarmer.xcodeproj` in Xcode, select the `AgriGharFarmer` scheme and
an iOS 17 or later simulator, then Run. From Terminal:

```sh
xcodebuild \
  -project AgriGharFarmer.xcodeproj \
  -scheme AgriGharFarmer \
  -sdk iphonesimulator \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' \
  -derivedDataPath build/DerivedData \
  CODE_SIGNING_ALLOWED=NO test
```

`dist/` is intentionally ignored. A simulator `.app` or `.zip` produced there
cannot be installed on a physical iPhone. A device IPA/TestFlight build requires
the owner's Apple Developer team, signing certificate, and provisioning profile.

## Remaining production gates

- Validate the Supabase SMS provider, India DLT header/template and delivery to
  the enrolled device before a field rollout.
- Record baseline consent through the server-signed consent endpoint; v0.3.0
  continues to retain the existing local pilot consent receipt.
- Remove the device-local static OTP fallback after SMS delivery is accepted.
- Add refresh-token rotation and server logout before long-lived distribution.
