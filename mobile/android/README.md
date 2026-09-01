# AgriGhar Farmer — Android pilot

Native Android application for the Siddipet/Raipole farmer pilot.

## Included in this APK

- Telugu-first farmer journey.
- Android 12+ (`minSdk 31`).
- Phone-number validation and an explicitly labelled demo OTP flow.
- Farmer-owned baseline consent with contract/policy versions.
- Keystore-backed AES/GCM encryption for locally stored profile and draft state.
- 20-acre crop plan: Paddy 10 acres, Maize 5 acres, Cotton 5 acres.
- Offline draft save, consent withdrawal, local-data deletion, and clear
  self-reported/pending verification states.
- No real farmer name, full phone number, Aadhaar number, OTP token, API secret,
  or production credential in source control or the APK.

## Pilot login

The generated debug APK is intentionally marked **Pilot Demo**. Enter any valid
Indian mobile number and use OTP `123456`. The complete number is held only in
memory for the OTP screen; only its masked form is stored.

This demo OTP is compiled only into the debug build. The release build disables
demo mode and must not be distributed until `/mobile/v1/auth/otp/request` and
`/mobile/v1/auth/otp/verify` are connected to the production backend.

## Build

The checked-in Gradle wrapper pins Gradle 8.14.3. With JDK 17 and Android SDK 36:

```sh
export JAVA_HOME=/path/to/jdk-17
export ANDROID_SDK_ROOT=/path/to/android-sdk
./gradlew testDebugUnitTest lintDebug assembleDebug
```

Build output:

```text
app/build/outputs/apk/debug/app-debug.apk
```

Install on an Android 12+ device with USB debugging enabled:

```sh
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

## Production configuration

The API hostname is supplied as a Gradle property, never hard-coded as a secret:

```sh
./gradlew assembleRelease -PMOBILE_API_BASE_URL=https://api.example.com/mobile/v1
```

A production release additionally requires:

- Supabase SMS provider and India DLT configuration.
- Server implementation of the frozen OpenAPI and consent contracts.
- Telugu disclosure review and production consent hashes.
- Authorized evidence storage and retention rules.
- Release signing configuration stored outside Git.
