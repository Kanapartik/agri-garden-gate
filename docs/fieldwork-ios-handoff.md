# Agrighar iOS handoff

The requested delivery is the tested Xcode project first. Open
`mobile/fieldwork-ios/AgrigharFieldwork.xcodeproj` after running
`node scripts/package-fieldwork-ios.mjs` from the repository root. The standalone
ZIP includes the generated resources, so it opens without that preparation.

The project builds for iOS/iPadOS 17+ and uses the existing fieldwork backend and
accounts. Fourteen simulator tests passed, including actual bundled login rendering
in WebKit. An unsigned device archive verifies ARM64 compilation. No Apple signing
identity was configured and no distribution upload was attempted.

See `mobile/fieldwork-ios/README.md` for build and signing steps, and
`mobile/fieldwork-ios/TEST-RESULTS.md` for exact verification and remaining acceptance.
The existing Indian farmer iOS project and the released Android APK are separate.
