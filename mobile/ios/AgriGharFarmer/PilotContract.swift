import CryptoKit
import Foundation

struct CropAllocation: Identifiable, Equatable {
    let code: String
    let nameTelugu: String
    let nameEnglish: String
    let acres: Decimal

    var id: String { code }
}

enum PilotContract {
    static let localeIdentifier = "te-IN"
    static let minimumIOSVersion = "17.0"
    static let apiPrefix = "/mobile/v1"
    static let consentVersion = "mobile-consent-2026-08-v1"
    static let policyVersion = "2026-08-baseline-v1"
    static let totalAcres = Decimal(20)
    static let sandboxStaticOTP = "123456"
    static let sandboxFarmerName = "Dr Sowmini Sunkara"
    static let sandboxFarmerGender = "female"
    static let defaultMobileAPIBaseURL = URL(string: "https://agrivah.com/mobile/v1")!

    // SHA-256 of the normalized, explicitly authorized synthetic pilot phone.
    // The complete mobile number is deliberately not embedded in the app source.
    private static let sandboxPilotPhoneDigest =
        "a380a5881ac18bebeea01068a2f84c9598011102b5be49fc5ce820bf1f13c677"

    static var mobileAPIBaseURL: URL? {
        guard let raw = Bundle.main.object(forInfoDictionaryKey: "MobileAPIBaseURL") as? String else {
            return defaultMobileAPIBaseURL
        }
        guard let url = URL(string: raw),
              url.scheme == "https" else {
            return nil
        }
        return url
    }

    static let crops: [CropAllocation] = [
        CropAllocation(code: "PADDY", nameTelugu: "వరి", nameEnglish: "Paddy", acres: 10),
        CropAllocation(code: "MAIZE", nameTelugu: "మొక్కజొన్న", nameEnglish: "Maize", acres: 5),
        CropAllocation(code: "COTTON", nameTelugu: "పత్తి", nameEnglish: "Cotton", acres: 5)
    ]

    static var allocatedAcres: Decimal {
        crops.reduce(Decimal.zero) { $0 + $1.acres }
    }

    static var cropPlanIsBalanced: Bool {
        allocatedAcres == totalAcres
    }

    static func normalizeIndianPhone(_ raw: String) -> String? {
        let digits = raw.filter(\.isNumber)
        let national: String

        if digits.count == 10 {
            national = digits
        } else if digits.count == 12, digits.hasPrefix("91") {
            national = String(digits.dropFirst(2))
        } else {
            return nil
        }

        guard let first = national.first, "6789".contains(first) else {
            return nil
        }
        return "+91" + national
    }

    static func maskedPhone(_ normalized: String) -> String {
        let suffix = normalized.suffix(4)
        return "+91 ••••••\(suffix)"
    }

    static func isValidOTPShape(_ value: String) -> Bool {
        value.count == 6 && value.allSatisfy(\.isNumber)
    }

    static func isSandboxStaticOTP(_ value: String) -> Bool {
        value == sandboxStaticOTP
    }

    static func isAuthorizedSandboxPilotPhone(_ normalized: String) -> Bool {
        let digest = SHA256.hash(data: Data(normalized.utf8))
            .map { String(format: "%02x", $0) }
            .joined()
        return digest == sandboxPilotPhoneDigest
    }

    static func acresText(_ value: Decimal) -> String {
        NSDecimalNumber(decimal: value).stringValue
    }
}
