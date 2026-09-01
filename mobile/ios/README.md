# AgriGhar Farmer — iOS pilot

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

Version `0.2.0` replaces the frozen Kalyan receipt with the signed-in farmer's
backend profile. The app requests SMS OTP through `/auth/otp/request`, verifies
it through `/auth/otp/verify`, then refreshes `/me` on launch and on demand.
The authorized sandbox account currently returns Dr Sowmini Sunkara, female,
20 acres, phone masked to suffix `0467`. Identity, land and FPO verification
remain pending; the account mapping grants none of those decisions.

The checked-in source contains no complete farmer phone number, OTP, identity
number, access token, refresh token or land-document number. Authenticated
values remain runtime data. The previous demo OTP is available only when a
Debug build has no HTTPS `MobileAPIBaseURL`; configured builds use SMS OTP.

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
- Record baseline consent through the server-signed consent endpoint; v0.2.0
  continues to retain the existing local pilot consent receipt.
- Add refresh-token rotation and server logout before long-lived distribution.
