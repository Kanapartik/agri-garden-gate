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

struct SnapshotItem: Identifiable, Equatable {
    let id: String
    let title: String
    let detail: String
    let meta: String
}

struct FarmHistoryItem: Identifiable, Equatable {
    let id: String
    let season: String
    let crop: String
    let acres: String
    let cost: String
    let yield: String
    let price: String
    let revenue: String
    let note: String
}

struct TrainingModule: Identifiable, Equatable {
    let id: String
    let stage: String
    let title: String
    let summary: String
    let lessons: [String]
}

struct WeatherDay: Identifiable, Equatable {
    let id: Int
    let minimumC: Int
    let maximumC: Int
    let rainfallMm: Double
    let conditions: String
    let symbol: String
}

enum AppLanguage: String, CaseIterable, Identifiable {
    case telugu = "te"
    case hindi = "hi"
    case tamil = "ta"
    case english = "en"

    var id: String { rawValue }
    var localeIdentifier: String { "\(rawValue)-IN" }

    var nativeName: String {
        switch self {
        case .telugu: return "తెలుగు"
        case .hindi: return "हिन्दी"
        case .tamil: return "தமிழ்"
        case .english: return "English"
        }
    }
}

enum PilotContract {
    static let localeIdentifier = "te-IN"
    static let minimumIOSVersion = "17.0"
    static let apiPrefix = "/mobile/v1"
    static let consentVersion = "mobile-consent-2026-08-v1"
    static let policyVersion = "2026-08-baseline-v1"
    static let snapshotVersion = "guntur-kaza-dashboard-weather-2026-09-02-v1"
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

    static let profileDetails: [SnapshotItem] = [
        SnapshotItem(id: "dob", title: "పుట్టిన తేదీ", detail: "12-04-1979", meta: "Farmer confirmed"),
        SnapshotItem(id: "category", title: "సామాజిక వర్గం", detail: "OBC", meta: "Farmer entered"),
        SnapshotItem(id: "ownership", title: "యాజమాన్యం", detail: "Owner", meta: "Farmer confirmed"),
        SnapshotItem(id: "irrigation", title: "నీటిపారుదల", detail: irrigation, meta: "Farmer entered"),
        SnapshotItem(id: "bank", title: "బ్యాంక్", detail: "Andhra Grameena Vikas Bank (synthetic) • Kaza", meta: "A/c •••• 4821 • IFSC ANDB0001234")
    ]

    static let profileDocuments: [SnapshotItem] = [
        SnapshotItem(id: "bank-passbook", title: "Bank passbook", detail: "Confirmed", meta: "Synthetic • image/jpeg"),
        SnapshotItem(id: "land-record", title: "Land record", detail: "Confirmed", meta: "Synthetic • image/jpeg"),
        SnapshotItem(id: "id-proof", title: "Identity proof", detail: "Confirmed", meta: "Synthetic • image/jpeg")
    ]

    static let onboardingApplications: [SnapshotItem] = [
        SnapshotItem(id: "farmer", title: "Farmer", detail: "Draft", meta: "Identity step"),
        SnapshotItem(id: "fpo", title: "FPO", detail: "Draft", meta: "Organisation step"),
        SnapshotItem(id: "field-agent", title: "Field agent", detail: "Draft", meta: "Identity step"),
        SnapshotItem(id: "bank-officer", title: "Bank officer", detail: "Draft", meta: "Institution step"),
        SnapshotItem(id: "insurer-officer", title: "Insurer officer", detail: "Draft", meta: "Institution step"),
        SnapshotItem(id: "knowledge-reviewer", title: "Knowledge reviewer", detail: "Draft", meta: "Institution step")
    ]

    static let farmHistory: [FarmHistoryItem] = [
        FarmHistoryItem(id: "2026-kharif-paddy", season: "2026 Kharif", crop: "Paddy", acres: "8.40 ac", cost: "₹55,300", yield: "198 q", price: "₹2,320/q", revenue: "₹4,59,360", note: "Direct-seeded on two acres to save labour."),
        FarmHistoryItem(id: "2026-kharif-cotton", season: "2026 Kharif", crop: "Cotton", acres: "4.20 ac", cost: "₹52,600", yield: "42 q", price: "₹7,480/q", revenue: "₹3,14,160", note: "Drone spraying trialled through the FPO."),
        FarmHistoryItem(id: "2025-kharif-cotton", season: "2025 Kharif", crop: "Cotton", acres: "4.20 ac", cost: "₹50,000", yield: "39 q", price: "₹7,250/q", revenue: "₹2,82,750", note: "Pink bollworm scouting from flowering."),
        FarmHistoryItem(id: "2025-kharif-chilli", season: "2025 Kharif", crop: "Chilli", acres: "5.60 ac", cost: "₹99,400", yield: "112 q", price: "₹13,100/q", revenue: "₹14,67,200", note: "Held stock for three weeks; price improved."),
        FarmHistoryItem(id: "2024-kharif-paddy", season: "2024 Kharif", crop: "Paddy", acres: "8.40 ac", cost: "₹52,100", yield: "189 q", price: "₹2,180/q", revenue: "₹4,12,020", note: "Best paddy season so far."),
        FarmHistoryItem(id: "2024-rabi-maize", season: "2024 Rabi", crop: "Maize", acres: "4.20 ac", cost: "₹26,400", yield: "104 q", price: "₹2,060/q", revenue: "₹2,14,240", note: "Grown on the cotton block after harvest."),
        FarmHistoryItem(id: "2023-kharif-paddy", season: "2023 Kharif", crop: "Paddy", acres: "8.40 ac", cost: "₹49,800", yield: "168 q", price: "₹2,100/q", revenue: "₹3,52,800", note: "Late-season inundation cut the yield."),
        FarmHistoryItem(id: "2023-kharif-chilli", season: "2023 Kharif", crop: "Chilli", acres: "5.60 ac", cost: "₹94,000", yield: "96 q", price: "₹11,800/q", revenue: "₹11,32,800", note: "Thrips pressure managed with two extra sprays."),
        FarmHistoryItem(id: "2022-kharif-paddy", season: "2022 Kharif", crop: "Paddy", acres: "8.40 ac", cost: "₹47,400", yield: "176 q", price: "₹2,040/q", revenue: "₹3,59,040", note: "Good canal supply through the season."),
        FarmHistoryItem(id: "2022-rabi-maize", season: "2022 Rabi", crop: "Maize", acres: "5.60 ac", cost: "₹34,400", yield: "132 q", price: "₹1,980/q", revenue: "₹2,61,360", note: "Sold to local trader.")
    ]

    static let insuranceSnapshots: [SnapshotItem] = [
        SnapshotItem(id: "insurance-2026", title: "2026 Kharif • Paddy", detail: "Covered • PMFBY", meta: "Premium ₹3,600/ac • insured ₹45,000/ac • farmer share ₹900/ac"),
        SnapshotItem(id: "insurance-2025", title: "2025 Kharif • Paddy", detail: "Partially covered • PMFBY", meta: "Premium ₹3,400/ac • insured ₹42,500/ac • farmer share ₹850/ac")
    ]

    static let intelligenceSections: [SnapshotItem] = [
        SnapshotItem(id: "location", title: "Location & season", detail: "Guntur (synthetic) • IN-AP-GNT • 16.3072, 80.4482", meta: "Kharif: sow Jun–Jul, harvest Oct–Nov • mixed red and black soils • borewell/rainfed"),
        SnapshotItem(id: "weather", title: "Weather", detail: "No current authoritative observation in this snapshot", meta: "Refresh requires a configured weather adapter."),
        SnapshotItem(id: "soil", title: "Soil", detail: "Mixed red and black soils (location-derived)", meta: "No farmer soil-test result is linked; validate before applying inputs."),
        SnapshotItem(id: "crop-planning", title: "Crop planning", detail: "Paddy 8.40 ac • Chilli 5.60 ac • Cotton 4.20 ac", meta: "18.20 acres allocated; suitability remains a derived scenario."),
        SnapshotItem(id: "market", title: "Market", detail: "Guntur Mandi • observed 17-08-2026", meta: "Paddy ₹2,150/q • Chilli ₹16,200/q • Cotton ₹7,350/q (synthetic modal prices)"),
        SnapshotItem(id: "value-add", title: "Value-add", detail: "Paddy → cleaned/dried paddy → brown rice → polished rice", meta: "Recovery 96% → 78% → 92%; assumptions require validation."),
        SnapshotItem(id: "outcome", title: "Outcome planner", detail: "Costs, yield and price scenarios are derived", meta: "No recommendation replaces an authorised human decision."),
        SnapshotItem(id: "nearby", title: "Nearby & help", detail: "Soil lab • logistics • drone service • machinery hiring", meta: "Four synthetic Guntur service records; contacts are service-desk labels only.")
    ]

    static let trainingModules: [TrainingModule] = [
        TrainingModule(id: "sowing-basics", stage: "LAND PREPARATION & SOWING", title: "Land preparation and sowing", summary: "Field preparation, seed selection, seed treatment, spacing and sowing windows for AP/Telangana conditions.", lessons: ["Prepare the field", "Choose and treat the seed", "Sow at the right time and spacing"]),
        TrainingModule(id: "crop-protection", stage: "CROP PROTECTION", title: "Crop protection methods", summary: "Scouting, thresholds, integrated pest management and safe spraying practice.", lessons: ["Scout the field weekly", "Use integrated pest management first", "Spray safely"]),
        TrainingModule(id: "crop-cutting", stage: "HARVEST & CROP CUTTING", title: "Harvest and crop cutting", summary: "Maturity signs, cutting method, moisture at harvest and threshing losses.", lessons: ["Judge maturity correctly", "Cut and thresh with low loss"]),
        TrainingModule(id: "preservation", stage: "POST-HARVEST", title: "Drying, storage and preservation", summary: "Drying to safe moisture, grading, bagging, aeration and pest-free storage.", lessons: ["Dry to safe moisture", "Store pest-free"]),
        TrainingModule(id: "value-creation", stage: "VALUE CREATION", title: "Value creation from produce", summary: "Cleaning, grading, primary processing and by-product value.", lessons: ["Clean and grade", "Primary processing and by-products"])
    ]

    static let inputGuidance: [SnapshotItem] = [
        SnapshotItem(id: "paddy-nutrients", title: "Paddy • nutrient plan", detail: "Basal: urea 65, DAP 125, MOP 50 kg/ha; zinc sulphate 25 kg/ha only after deficiency/lab confirmation", meta: "Tillering + panicle initiation: urea 65 kg/ha each • organic: Azospirillum 5 kg/ha / vermicompost 2,500 kg/ha"),
        SnapshotItem(id: "chilli-nutrients", title: "Chilli • nutrient plan", detail: "Basal: urea 90, SSP 375, MOP 100 kg/ha", meta: "Flowering: boron 5 kg/ha • organic: vermicompost 5,000 kg/ha / Jeevamrutham 500 l/ha"),
        SnapshotItem(id: "cotton-nutrients", title: "Cotton • nutrient plan", detail: "Basal: urea 90 and DAP 130 kg/ha", meta: "Square formation: MOP 85 kg/ha • organic: neem cake 500 kg/ha"),
        SnapshotItem(id: "paddy-protection", title: "Paddy • high-priority protection", detail: "Rice blast, brown plant hopper and yellow stem borer", meta: "Use thresholds and approved labels; safety intervals apply."),
        SnapshotItem(id: "chilli-protection", title: "Chilli • high-priority protection", detail: "Thrips and anthracnose/die-back; yellow mite is moderate", meta: "Scout weekly; IPM first. Example options include neem oil, Trichoderma or label-approved chemistry."),
        SnapshotItem(id: "cotton-protection", title: "Cotton • high-priority protection", detail: "Pink bollworm", meta: "Rosette flowers, exit holes and damaged lint; use scouting thresholds before treatment.")
    ]

    static let soilPractices: [SnapshotItem] = [
        SnapshotItem(id: "organic-matter", title: "Build organic matter every season", detail: "2 t/ac vermicompost or 5 t/ac FYM", meta: "Moderate effort • benefit in 2–3 seasons"),
        SnapshotItem(id: "green-manure", title: "Green manure and cover crops", detail: "Sow sunhemp/daincha; incorporate at about 45 days", meta: "Moderate • adds about 20–25 kg N/ac"),
        SnapshotItem(id: "mulch", title: "Mulch the surface", detail: "Retain clean crop residue where suitable", meta: "Low effort • reduces evaporation and weeds"),
        SnapshotItem(id: "rotate", title: "Rotate with a legume", detail: "Include a locally suitable pulse in the rotation", meta: "Low effort • can reduce nitrogen need and pest pressure"),
        SnapshotItem(id: "gypsum", title: "Correct sodic soil with gypsum", detail: "Apply only at a soil-lab recommended rate", meta: "High effort • laboratory confirmation required"),
        SnapshotItem(id: "lime", title: "Correct acidic soil with lime", detail: "Use the laboratory rate 3–4 weeks before sowing", meta: "High effort • laboratory confirmation required"),
        SnapshotItem(id: "irrigate", title: "Irrigate to hold nutrients", detail: "Lighter/frequent on sandy soils; avoid overwatering heavy soils", meta: "Low effort"),
        SnapshotItem(id: "bunds", title: "Bunds and contour cultivation on slopes", detail: "Slow runoff and retain topsoil", meta: "High effort")
    ]

    static let schemes: [SnapshotItem] = [
        SnapshotItem(id: "insurance", title: "Crop insurance enrolment support (synthetic)", detail: "Submitted • eligible", meta: "Telangana premium assistance • version 1"),
        SnapshotItem(id: "input-support", title: "Input support for small and marginal farmers (synthetic)", detail: "In review • needs review", meta: "AP support up to 5 acres • version 1"),
        SnapshotItem(id: "drip", title: "Micro irrigation (drip) subsidy (synthetic)", detail: "Draft", meta: "AP owner-cultivator capital subsidy • version 1"),
        SnapshotItem(id: "tenant-credit", title: "Credit linkage for tenant and leased-land farmers (synthetic)", detail: "Not applied", meta: "Telangana tenant/share-cropper linkage • version 1")
    ]

    static let marketplaceState: [SnapshotItem] = [
        SnapshotItem(id: "profile", title: "Marketplace profile", detail: "Not activated", meta: "No farmer seller/buyer profile exists."),
        SnapshotItem(id: "listings", title: "Listings", detail: "0", meta: "No published or draft farmer listings."),
        SnapshotItem(id: "rfqs", title: "RFQs and quotes", detail: "0", meta: "No requests or quotes."),
        SnapshotItem(id: "orders", title: "Orders and disputes", detail: "0", meta: "No orders or disputes.")
    ]

    static let currentTemperatureC = 33
    static let currentHumidityPct = 77
    static let currentWindKph = 10
    static let currentRainfallMm = 9.0
    static let currentWeatherConditions = "Cloudy with showers"
    static let weatherForecast: [WeatherDay] = [
        WeatherDay(id: 1, minimumC: 27, maximumC: 37, rainfallMm: 12.8, conditions: "Rain likely", symbol: "cloud.rain.fill"),
        WeatherDay(id: 2, minimumC: 28, maximumC: 38, rainfallMm: 16.0, conditions: "Rain likely", symbol: "cloud.heavyrain.fill"),
        WeatherDay(id: 3, minimumC: 27, maximumC: 39, rainfallMm: 0.0, conditions: "Mainly dry", symbol: "sun.max.fill"),
        WeatherDay(id: 4, minimumC: 28, maximumC: 37, rainfallMm: 3.2, conditions: "Isolated showers", symbol: "cloud.sun.rain.fill"),
        WeatherDay(id: 5, minimumC: 27, maximumC: 38, rainfallMm: 6.4, conditions: "Isolated showers", symbol: "cloud.sun.rain.fill"),
        WeatherDay(id: 6, minimumC: 28, maximumC: 39, rainfallMm: 9.6, conditions: "Rain likely", symbol: "cloud.rain.fill"),
        WeatherDay(id: 7, minimumC: 27, maximumC: 37, rainfallMm: 12.8, conditions: "Rain likely", symbol: "cloud.rain.fill")
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
