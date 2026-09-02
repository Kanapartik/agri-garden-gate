# Agrivah Farmer — iOS pilot

Native SwiftUI companion to the Android Siddipet/Raipole farmer pilot. The app
uses the frozen contracts in [`../../docs/mobile/`](../../docs/mobile/) and keeps
authoritative identity, land, and FPO verification pending until their adapters
are connected.

## Pilot baseline

- Primary UI: Telugu (`te-IN`)
- Minimum iOS: 17.0
- Pilot: Siddipet district, Raipole mandal
- Crop plan: paddy 10 acres, maize 5 acres, cotton 5 acres
- Local sensitive state: iOS Keychain (`whenUnlockedThisDeviceOnly`)
- Mobile API: defaults to `https://agrivah.com/mobile/v1`; an optional
  `MobileAPIBaseURL` bundle value may override it but must be HTTPS.
- Authenticated profile refresh: `GET /me`, with bearer tokens stored in the
  iOS Keychain (`whenUnlockedThisDeviceOnly`)

Version `0.2.2` adds the supplied Agrivah lockup and app icon. The app requests
SMS OTP through `/auth/otp/request`, verifies it through `/auth/otp/verify`, then
refreshes `/me` on launch and on demand. Until SMS delivery is configured, a
failed OTP request for the explicitly authorized synthetic pilot phone opens a
device-local sandbox path using code `123456`. The phone is matched with a
one-way digest; the fallback creates no backend session, grants no server access,
and is visibly labelled as offline in the app.
The authorized sandbox account currently returns Dr Sowmini Sunkara, female,
20 acres, phone masked to suffix `0467`. Identity, land and FPO verification
remain pending; the account mapping grants none of those decisions.

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
- Record baseline consent through the server-signed consent endpoint; v0.2.2
  continues to retain the existing local pilot consent receipt.
- Remove the device-local static OTP fallback after SMS delivery is accepted.
- Add refresh-token rotation and server logout before long-lived distribution.
