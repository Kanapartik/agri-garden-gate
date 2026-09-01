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

    func testPilotCropPlanBalancesToTwentyAcres() {
        XCTAssertTrue(PilotContract.cropPlanIsBalanced)
        XCTAssertEqual(PilotContract.allocatedAcres, Decimal(20))
        XCTAssertEqual(PilotContract.crops.map(\.acres), [Decimal(10), Decimal(5), Decimal(5)])
    }

    func testOTPShapeRequiresExactlySixDigits() {
        XCTAssertTrue(PilotContract.isValidOTPShape("123456"))
        XCTAssertFalse(PilotContract.isValidOTPShape("12345"))
        XCTAssertFalse(PilotContract.isValidOTPShape("12345x"))
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
}
