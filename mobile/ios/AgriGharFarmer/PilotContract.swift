import CryptoKit
import Foundation

struct CropAllocation: Identifiable, Equatable {
    let code: String
    let nameTelugu: String
    let nameEnglish: String
    let acres: Decimal
    let parcelName: String
    let plotReference: String
    let centroid: String

    var id: String { code }
}

enum PilotContract {
    static let localeIdentifier = "te-IN"
    static let minimumIOSVersion = "17.0"
    static let apiPrefix = "/mobile/v1"
    static let consentVersion = "mobile-consent-2026-08-v1"
    static let policyVersion = "2026-08-baseline-v1"
    static let snapshotVersion = "guntur-kaza-2026-09-01-v1"
    static let snapshotCapturedAt = "01-09-2026"
    static let totalAcres = Decimal(string: "18.20")!
    static let sandboxStaticOTP = "123456"
    static let sandboxFarmerName = "Ramesh Naidu Vemuri"
    static let sandboxFarmerGender = "male"
    static let pilotDistrict = "గుంటూరు (సింథటిక్)"
    static let pilotState = "ఆంధ్రప్రదేశ్ (సింథటిక్)"
    static let pilotCluster = "కాజా క్లస్టర్"
    static let pilotVillageCode = "IN-AP-GNT"
    static let pilotFPO = "Guntur Chilli Growers FPO"
    static let pilotMembershipNumber = "SFPO/2023/0114"
    static let pilotMemberReference = "MBR-DEMO-0001"
    static let irrigation = "Borewell + canal"
    static let ownership = "owner"
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
        CropAllocation(
            code: "PADDY",
            nameTelugu: "వరి",
            nameEnglish: "Paddy",
            acres: Decimal(string: "8.40")!,
            parcelName: "Paddy field east",
            plotReference: "GNT-KAZA-114/2",
            centroid: "16.3072, 80.4482"
        ),
        CropAllocation(
            code: "CHILLI",
            nameTelugu: "మిరప",
            nameEnglish: "Chilli",
            acres: Decimal(string: "5.60")!,
            parcelName: "Chilli block A",
            plotReference: "GNT-KAZA-98/1",
            centroid: "16.2951, 80.4715"
        ),
        CropAllocation(
            code: "COTTON",
            nameTelugu: "పత్తి",
            nameEnglish: "Cotton",
            acres: Decimal(string: "4.20")!,
            parcelName: "Cotton stretch (west)",
            plotReference: "GNT-KAZA-77/4",
            centroid: "16.3216, 80.4103"
        )
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
        String(format: "%.2f", NSDecimalNumber(decimal: value).doubleValue)
    }
}
