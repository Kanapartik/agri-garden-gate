# Siddipet farmer mobile pilot — decision record v1

Status: **FROZEN FOR IMPLEMENTATION**

Decision date: 2026-08-29

Pilot ID: `pilot-siddipet-raipole-001`

## 1. Pilot cohort

| Item | Frozen decision | Verification state |
| --- | --- | --- |
| State | Telangana, India | Confirmed pilot input |
| District | Siddipet | Confirmed pilot input |
| Mandal | Raipole | Confirmed pilot input |
| FPO | Rayapole Women Farmer Producer Company Limited | Organization found in the SFAC registered-FPO list |
| FPO registration | CIN `U01100TG2022PTC158664`; incorporated 2022-01-11 | Public organization reference only |
| Farmer | Pilot farmer reference `farmer-pilot-001`; female | Full name is a controlled enrollment input and is not stored in Git |
| Phone | `+91******0467` | Full number is a controlled authentication input and is not stored in Git |
| Holding | 20.00 acres, farmer-reported | Provisional until land-record verification |
| Crop allocation | Paddy 10.00 acres; Maize 5.00 acres; Cotton 5.00 acres | Sum check passed: 20.00 acres |

The FPO registry proves that the organization exists. It does **not** prove an
individual farmer's membership. Membership for `farmer-pilot-001` must be
verified against the FPO membership register and attested by an authorized FPO
officer before the app displays a verified-member badge.

The crop allocation is a pilot planning baseline. It must not be interpreted as
three legal parcels or as an official crop-inspection record until survey/plot
references are captured.

## 2. Authoritative-source hierarchy

### Land

1. **Primary digital source:** Telangana Bhu Bharati Record of Rights / PPB
   details and the Bhu Bharati parcel GIS, accessed only through the
   `tg_bhu_bharati` adapter.
2. **Dispute and missing-record authority:** Siddipet Survey & Land Records and
   the jurisdictional Tahsildar/Mandal office.
3. **Farmer/FPO input:** useful for creating a draft, never authoritative by
   itself. A draft remains `self_reported` until matched to village, survey/sub-
   division or PPB reference and reviewed through the adapter workflow.

The application may display a GPS-measured area as an estimate. It must retain
the official area, measured estimate, source, retrieval time, and any mismatch
as separate fields. It must never silently overwrite an official value.

### Identity and contact

1. **Account authentication:** SMS phone OTP proves possession of the enrolled
   phone for the session; it does not prove legal identity, land ownership, or
   FPO membership.
2. **Primary identity evidence, when the farmer chooses it:** UIDAI Aadhaar
   Paperless Offline e-KYC XML or Secure QR through the `uidai_offline_ekyc`
   adapter. Verify the UIDAI signature locally/server-side, retain only the
   minimum approved fields and a reference hash, and never store an Aadhaar
   number, raw OTP, core biometric, or unencrypted offline-eKYC package.
3. **Non-Aadhaar fallback:** human review of an approved identity document and
   FPO-assisted enrollment through `manual_identity_review`. Aadhaar is not a
   condition for creating a basic farmer account.
4. **FPO membership:** the FPO membership register plus an authorized officer's
   attestation through `fpo_membership_register`.

Identity, land, and membership adapters return evidence and status. They do not
activate, reject, or suspend the farmer automatically; an authorized human owns
all high-stakes decisions.

## 3. Authentication decision

- Method: **SMS phone OTP**.
- Runtime phone format: E.164 (`+91…`).
- WhatsApp OTP and email login: not included in mobile v1.
- Assisted enrollment: supported as a capture channel, but the farmer must
  personally verify the phone and make each consent decision. An assistant
  cannot accept or revoke consent for the farmer.
- Provider: Supabase Auth phone login behind the mobile auth adapter.
- Secrets: access/refresh tokens use Android secure storage; OTPs and tokens are
  prohibited from logs, analytics, crash reports, and Git fixtures.
- Abuse controls: provider rate limits, resend cooldown, attempt limit, CAPTCHA
  or equivalent risk control, and generic errors that do not reveal whether an
  account exists.

## 4. Mobile platform decision

- First user-facing language: Telugu (`te-IN`).
- English (`en-IN`) is an operational fallback for untranslated error keys and
  support diagnostics; it is not a second launch-language commitment.
- Minimum OS: Android 12 and above.
- Minimum SDK/API level: `31`.
- The client must support offline farm drafts and idempotent replay after the
  connection returns.

## 5. Consent contract v1

Contract version: `mobile-consent-2026-08-v1`

Baseline policy version: `2026-08-baseline-v1`

### Required baseline purposes

- `account_service`
- `profile_and_farm_record_management`
- `security_and_audit`

These are presented together as the baseline service agreement. Refusal means
the platform cannot create an authenticated farmer account, but it does not
grant any partner or FPO access.

### Optional, separately decided purposes

- `identity_verification`
- `land_record_verification`
- `fpo_membership_verification`
- `fpo_service_assistance`
- `agronomic_advisory`
- `scheme_application_prefill`

Each optional decision names one consumer and one purpose. No purpose is
preselected or bundled with the baseline. First-party and third-party consumers
use the same contract and authorization path at the same service tier. Payment
or tenancy never expands consent.

Optional grants expire after 180 days in this pilot unless a shorter period is
shown and accepted. Baseline consent has no automatic expiry, but a changed
policy version requires re-consent. Revocation stops new purpose-scoped access
immediately; legally required security/audit records remain subject to the
approved retention schedule.

Every decision creates a server-signed receipt containing the contract/policy
version, disclosure hash, locale, channel, purpose, consumer, decision time,
expiry (if any), and audit correlation ID. The client cannot provide or override
the subject user ID; the server derives it from the authenticated session.

## 6. Contract-frozen mobile journey

1. Read bootstrap configuration and block unsupported Android versions.
2. Request and verify SMS OTP.
3. Show Telugu baseline consent and record the farmer's own decision.
4. Capture/update the farmer profile.
5. Create offline-safe farm drafts and sync them idempotently.
6. Request optional identity, land, and FPO membership verification only after
   the corresponding purpose-specific consent.
7. Show source, status, mismatch, and human-review state; never represent a
   pending/self-reported value as verified.

The HTTP surface is frozen in [`openapi-v1.yaml`](./openapi-v1.yaml). The client
decision envelope is frozen in
[`consent-contract-v1.schema.json`](./consent-contract-v1.schema.json).

## 7. Authoritative public references

- [Telangana Bhu Bharati — Record of Rights / PPB details](https://bhubharati.telangana.gov.in/RegDocumentDetails)
- [Telangana Bhu Bharati — parcel GIS](https://bhubharati.telangana.gov.in/gis/)
- [Siddipet Survey & Land Records](https://siddipet.telangana.gov.in/survey-land-records/)
- [UIDAI Aadhaar Paperless Offline e-KYC](https://www.uidai.gov.in/en/ecosystem/authentication-devices-documents/about-aadhaar-paperless-offline-e-kyc.html)
- [SFAC state-wise registered FPO list (2023-10-09)](https://sfacindia.com/UploadFile/Statistics/State%20wise%20list%20of%20registered%20FPOs%20details%20under%20Central%20Sector%20Scheme%20for%20Formation%20and%20Promotion%20of%2010%2C000%20FPOs%20by%20SFAC%20as%20on%2009-10-2023.pdf)
- [Supabase phone login](https://supabase.com/docs/guides/auth/phone-login)

## 8. Field and production gates

The contract is frozen, but these operational inputs remain **[VALIDATE]**
before enrolling the real pilot farmer:

- Village name/code and each survey/sub-division or PPB reference.
- Farmer membership entry in the FPO register and authorized attestor.
- Which non-Aadhaar document types the human-review process will accept.
- Supabase SMS provider, India DLT registration/header/template, rate limits,
  and delivery testing to the enrolled device.
- Telugu legal/content review of the baseline and optional consent disclosures.
- Production API hostname, evidence-store retention schedule, and incident/
  revocation support contact.

No real pilot data is to be inserted through a migration or synthetic fixture.
