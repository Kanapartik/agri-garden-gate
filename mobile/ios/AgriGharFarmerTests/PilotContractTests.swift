import XCTest
@testable import AgriGharFarmer

final class PilotContractTests: XCTestCase {
    func testNormalizesIndianMobileNumbersWithoutPersistingRawInput() {
        XCTAssertEqual(PilotContract.normalizeIndianPhone("98765 43210"), "+919876543210")
        XCTAssertEqual(PilotContract.normalizeIndianPhone("91-98765-43210"), "+919876543210")
    }

    func testRejectsInvalidMobileNumbers() {
        XCTAssertNil(PilotContract.normalizeIndianPhone("12345"))
        XCTAssertNil(PilotContract.normalizeIndianPhone("5123456789"))
        XCTAssertNil(PilotContract.normalizeIndianPhone("001234567890"))
    }

    func testMasksVerifiedPhone() {
        XCTAssertEqual(PilotContract.maskedPhone("+919876543210"), "+91 ••••••3210")
    }

    func testPilotCropPlanMatchesGunturKazaSnapshot() {
        XCTAssertTrue(PilotContract.cropPlanIsBalanced)
        XCTAssertEqual(PilotContract.allocatedAcres, Decimal(string: "18.20"))
        XCTAssertEqual(
            PilotContract.crops.map(\.acres),
            [Decimal(string: "8.40")!, Decimal(string: "5.60")!, Decimal(string: "4.20")!]
        )
        XCTAssertEqual(
            PilotContract.crops.map(\.plotReference),
            ["GNT-KAZA-114/2", "GNT-KAZA-98/1", "GNT-KAZA-77/4"]
        )
    }

    func testWebParitySnapshotContainsEveryFarmerWorkspace() {
        XCTAssertEqual(PilotContract.farmHistory.count, 10)
        XCTAssertEqual(PilotContract.insuranceSnapshots.count, 2)
        XCTAssertEqual(PilotContract.intelligenceSections.count, 8)
        XCTAssertEqual(PilotContract.trainingModules.count, 5)
        XCTAssertEqual(PilotContract.trainingModules.flatMap(\.lessons).count, 12)
        XCTAssertEqual(PilotContract.soilPractices.count, 8)
        XCTAssertEqual(PilotContract.schemes.count, 4)
        XCTAssertEqual(PilotContract.marketplaceState.map(\.detail), ["Not activated", "0", "0", "0"])
    }

    func testDashboardIncludesSevenDaySyntheticForecast() {
        XCTAssertEqual(PilotContract.weatherForecast.count, 7)
        XCTAssertEqual(PilotContract.currentTemperatureC, 33)
        XCTAssertEqual(PilotContract.weatherForecast[1].rainfallMm, 16.0, accuracy: 0.01)
    }

    func testFarmIntelligenceContainsDataForEveryWebSubmenu() {
        XCTAssertEqual(PilotContract.locationDetails.count, 6)
        XCTAssertEqual(PilotContract.seasonDetails.count, 3)
        XCTAssertEqual(PilotContract.soilSnapshot.count, 5)
        XCTAssertEqual(PilotContract.cropPlanningSnapshot.count, 3)
        XCTAssertEqual(PilotContract.marketQuotes.count, 3)
        XCTAssertEqual(PilotContract.valueAddSteps.count, 3)
        XCTAssertEqual(PilotContract.outcomeScenarios.map(\.id), ["low", "base", "high"])
        XCTAssertEqual(PilotContract.nearbyFacilities.count, 5)
    }

    func testFarmHistoryContainsWebSectionSnapshots() {
        XCTAssertEqual(PilotContract.historyYearSummaries.map(\.id), [2026, 2025, 2024, 2023, 2022])
        XCTAssertEqual(PilotContract.areaCropComparison.count, 3)
        XCTAssertEqual(PilotContract.nextSeasonPlan.count, 5)
        XCTAssertEqual(PilotContract.insuranceSnapshots.count, 2)
    }

    func testSupportedLanguagesHaveIndianLocales() {
        XCTAssertEqual(AppLanguage.allCases.map(\.rawValue), ["te", "hi", "ta", "en"])
        XCTAssertEqual(AppLanguage.tamil.localeIdentifier, "ta-IN")
        XCTAssertEqual(AppLanguage.english.nativeName, "English")
    }

    func testFarmerContentFollowsSelectedLanguage() {
        XCTAssertEqual(PilotContentLocalization.text("Paddy field east", language: .telugu), "తూర్పు వరి పొలం")
        XCTAssertEqual(PilotContentLocalization.text("Paddy", language: .hindi), "धान")
        XCTAssertEqual(PilotContentLocalization.text("Paddy", language: .tamil), "நெல்")
        XCTAssertEqual(PilotContentLocalization.text("Paddy", language: .english), "Paddy")
        XCTAssertEqual(
            PilotContentLocalization.text("Land preparation and sowing", language: .telugu),
            "భూమి తయారీ మరియు విత్తడం"
        )
        XCTAssertEqual(
            PilotContentLocalization.text("2026 Kharif", language: .telugu),
            "2026 ఖరీఫ్"
        )
        XCTAssertEqual(
            PilotContentLocalization.text("8.40 ac", language: .telugu),
            "8.40 ఎకరాలు"
        )
    }

    func testEveryTrainingModuleHasTeluguContent() {
        for module in PilotContract.trainingModules {
            XCTAssertNotEqual(PilotContentLocalization.text(module.stage, language: .telugu), module.stage)
            XCTAssertNotEqual(PilotContentLocalization.text(module.title, language: .telugu), module.title)
            XCTAssertNotEqual(PilotContentLocalization.text(module.summary, language: .telugu), module.summary)
            for lesson in module.lessons {
                XCTAssertNotEqual(PilotContentLocalization.text(lesson, language: .telugu), lesson)
            }
        }
    }

    func testOTPShapeRequiresExactlySixDigits() {
        XCTAssertTrue(PilotContract.isValidOTPShape("123456"))
        XCTAssertFalse(PilotContract.isValidOTPShape("12345"))
        XCTAssertFalse(PilotContract.isValidOTPShape("12345x"))
    }

    func testSandboxStaticOTPIsExact() {
        XCTAssertTrue(PilotContract.isSandboxStaticOTP("123456"))
        XCTAssertFalse(PilotContract.isSandboxStaticOTP("123455"))
        XCTAssertFalse(PilotContract.isSandboxStaticOTP(" 123456"))
    }

    func testUnrelatedPhoneCannotUseLocalSandboxFallback() {
        XCTAssertFalse(PilotContract.isAuthorizedSandboxPilotPhone("+919876543210"))
    }

    func testAuthorizedSyntheticPilotPhoneCanUseLocalSandboxFallback() {
        let authorizedPhone = ["+91", "984", "801", "0467"].joined()
        XCTAssertTrue(PilotContract.isAuthorizedSandboxPilotPhone(authorizedPhone))
    }

    func testDecodesAuthenticatedFarmerProfileWithPendingVerification() throws {
        let fixture = """
        {
          "id": "72e5aa52-98ec-4ecc-86c9-576d2c622f2a",
          "fullName": "Synthetic Farmer",
          "gender": "female",
          "preferredLocale": "te-IN",
          "geography": {
            "countryCode": "IN",
            "stateCode": "IN-TG",
            "district": "Siddipet",
            "mandal": "Raipole",
            "villageCode": null
          },
          "phoneMasked": "+91******0467",
          "onboardingStatus": "consent_pending",
          "updatedAt": "2026-09-01T00:00:00Z",
          "totalExtentAcres": 20,
          "identityVerification": null
        }
        """
        let profile = try JSONDecoder().decode(MobileFarmerProfile.self, from: Data(fixture.utf8))
        XCTAssertEqual(profile.fullName, "Synthetic Farmer")
        XCTAssertEqual(profile.totalExtentAcres, Decimal(20))
        XCTAssertEqual(profile.phoneMasked, "+91******0467")
        XCTAssertNil(profile.identityVerification)
    }

    func testMobileAPIRequiresHTTPSConfiguration() {
        let client = MobileAPIClient(baseURL: URL(string: "https://example.invalid/mobile/v1"))
        XCTAssertTrue(client.isConfigured)
        XCTAssertEqual(client.baseURL?.scheme, "https")
    }

    func testDefaultMobileAPIBaseURLIsCanonicalHTTPS() {
        XCTAssertEqual(PilotContract.defaultMobileAPIBaseURL.absoluteString, "https://agrivah.com/mobile/v1")
        XCTAssertEqual(PilotContract.mobileAPIBaseURL?.scheme, "https")
    }

    func testDecodesSandboxStaticOTPChallenge() throws {
        let fixture = """
        {
          "challengeId": "49749000-9a8e-43ac-a8d3-8691c4122df8",
          "delivery": { "channel": "sms", "maskedDestination": "+91******0467" },
          "expiresAt": "2026-09-01T00:10:00Z",
          "resendAfterSeconds": 60,
          "sandboxStaticOtp": true
        }
        """
        let challenge = try JSONDecoder().decode(OTPChallengeResponse.self, from: Data(fixture.utf8))
        XCTAssertEqual(challenge.sandboxStaticOtp, true)
    }
}
