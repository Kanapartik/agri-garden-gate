# iOS pilot implementation note v1

Status: **implemented pilot companion**

Implemented on: 2026-08-29

The native iOS app is a presentation and secure-local-state companion to the
frozen Siddipet/Raipole mobile contracts. Version `0.2.1` consumes the additive
authenticated farmer-profile fields in `/mobile/v1/me`.

## Decisions

- Native SwiftUI application with no third-party runtime dependencies.
- Minimum deployment target: iOS 17.0.
- Bundle identifier: `com.agrighar.farmer.pilot`.
- Primary locale: Telugu (`te-IN`).
- Configured builds request and verify SMS OTP through `/mobile/v1/auth/otp`.
- If SMS delivery fails, the server may flag an audited static-OTP challenge
  for the role-free synthetic pilot farmer only.
- Debug-only synthetic OTP `123456` remains available only when no HTTPS mobile
  API base URL is configured.
- Consent version: `mobile-consent-2026-08-v1`.
- Baseline policy: `2026-08-baseline-v1`.
- Profile, masked phone, consent receipt, and offline farm draft are stored in
  iOS Keychain using `whenUnlockedThisDeviceOnly` accessibility.
- Full phone numbers exist only in the active sign-in session and are not stored
  locally after consent capture. Access and refresh tokens use the same Keychain
  protection and are never logged.
- Identity, land, and FPO membership are always shown as pending until an
  authoritative adapter returns a server-verifiable result.
- Version `0.2.1` removes the frozen Kalyan verification receipt. The authorized
  sandbox farmer mapping returns Dr Sowmini Sunkara, female, 20 acres and masked
  phone suffix `0467`. Identity, land and FPO states remain pending.
- `[VALIDATE]` Temporary static OTP `123456` is accepted only after SMS delivery
  fails, for the role-free synthetic pilot farmer, through an audited ten-minute
  challenge. The fallback stops automatically once SMS delivery succeeds.

## [VALIDATE] before physical-device distribution

- Confirm that iOS 17.0 covers the pilot device inventory.
- Supply the owning Apple Developer team, distribution certificate, bundle ID
  registration, and provisioning profile for IPA/TestFlight signing.
- Approve and add the production App Store icon and listing metadata.
- Connect and validate the production OTP adapter, rate limits, retry behavior,
  and abuse controls.
- Add server-signed baseline consent, refresh-token rotation and server logout.
- Confirm authoritative Telangana land/identity data sources and the FPO member
  register owner before enabling evidence submission.
