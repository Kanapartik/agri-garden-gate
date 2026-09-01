# Farmer mobile contract pack

Status: **frozen for pilot implementation**

Frozen on: 2026-08-29

Scope: Siddipet / Raipole farmer pilot

This directory is the implementation boundary for the first AgriGhar farmer
mobile applications. It is contract-first: no production integration is
implied by these documents.

## Frozen artifacts

- [`pilot-decision-v1.md`](./pilot-decision-v1.md) records the pilot geography,
  FPO, land and identity authority hierarchy, authentication decision, crop
  allocation, language, Android baseline, and remaining field validations.
- [`openapi-v1.yaml`](./openapi-v1.yaml) freezes the first mobile HTTP API at
  `/mobile/v1`.
- [`consent-contract-v1.schema.json`](./consent-contract-v1.schema.json) is the
  machine-readable client consent-decision envelope used by the API.
- [`ios-pilot-implementation-v1.md`](./ios-pilot-implementation-v1.md) records
  how the iOS companion consumes the frozen platform-neutral contracts.

## Privacy boundary

Real farmer names, complete phone numbers, Aadhaar numbers, land-document
numbers, OTPs, tokens, and uploaded evidence must never be committed to Git.
They belong in the authenticated runtime and approved evidence store. Examples
in this directory are synthetic; the pilot phone is represented only by its
masked suffix.

## Compatibility boundary

- Primary UI locale: `te-IN` (Telugu)
- Operational fallback locale: `en-IN`
- Minimum Android version: Android 12 (`minSdkVersion` / API level `31`)
- API prefix: `/mobile/v1`
- Consent contract: `mobile-consent-2026-08-v1`
- Baseline policy: `2026-08-baseline-v1`

Any breaking API or consent change requires a new version. Additive optional
fields may be introduced within v1 only when older clients can safely ignore
them.

## Android implementation

The first installable native pilot is in [`../../mobile/android/`](../../mobile/android/).
Its debug APK uses an explicitly labelled demo OTP until the production mobile
API and SMS provider are connected.

## iOS implementation

The native SwiftUI companion is in [`../../mobile/ios/`](../../mobile/ios/).
Its debug simulator build uses the same explicitly labelled demo OTP and keeps
all authoritative verification states pending.
