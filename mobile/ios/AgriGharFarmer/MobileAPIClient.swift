import Foundation

struct OTPChallengeResponse: Decodable, Equatable {
    let challengeId: String
    let delivery: Delivery
    let expiresAt: String
    let resendAfterSeconds: Int

    struct Delivery: Decodable, Equatable {
        let channel: String
        let maskedDestination: String
    }
}

struct MobileAuthSession: Decodable, Equatable {
    let accessToken: String
    let refreshToken: String
    let expiresAt: String
    let userId: String
    let isNewAccount: Bool
}

struct MobileFarmerProfile: Decodable, Equatable {
    let id: String
    let fullName: String
    let gender: String
    let preferredLocale: String
    let geography: Geography
    let phoneMasked: String
    let onboardingStatus: String
    let updatedAt: String
    let totalExtentAcres: Decimal?
    let identityVerification: IdentityVerification?

    struct Geography: Decodable, Equatable {
        let countryCode: String
        let stateCode: String
        let district: String
        let mandal: String
        let villageCode: String?
    }

    struct IdentityVerification: Decodable, Equatable {
        let id: String
        let status: String
        let adapter: String
        let reasonCategory: String?
        let isSynthetic: Bool
        let requestedAt: String
        let decidedAt: String?
    }
}

private struct MobileAPIErrorPayload: Decodable {
    let code: String
    let correlationId: String?
}

enum MobileAPIClientError: LocalizedError, Equatable {
    case notConfigured
    case invalidResponse
    case api(code: String, status: Int)

    var errorDescription: String? {
        switch self {
        case .notConfigured:
            return "మొబైల్ API కాన్ఫిగర్ కాలేదు."
        case .invalidResponse:
            return "సర్వర్ స్పందనను చదవలేకపోయాము. మళ్లీ ప్రయత్నించండి."
        case let .api(code, _):
            switch code {
            case "otp_invalid_or_expired": return "OTP సరిపోలలేదు లేదా గడువు ముగిసింది."
            case "otp_rate_limited": return "చాలా ప్రయత్నాలు జరిగాయి. కొద్దిసేపటి తర్వాత మళ్లీ ప్రయత్నించండి."
            case "otp_delivery_unavailable": return "ప్రస్తుతం SMS OTP పంపలేకపోయాము. తర్వాత మళ్లీ ప్రయత్నించండి."
            case "unauthorized": return "సెషన్ గడువు ముగిసింది. మళ్లీ సైన్ ఇన్ చేయండి."
            default: return "సర్వర్‌తో కనెక్ట్ కాలేకపోయాము. మళ్లీ ప్రయత్నించండి."
            }
        }
    }
}

struct MobileAPIClient {
    let baseURL: URL?
    var session: URLSession = .shared

    init(baseURL: URL? = PilotContract.mobileAPIBaseURL, session: URLSession = .shared) {
        self.baseURL = baseURL
        self.session = session
    }

    var isConfigured: Bool { baseURL != nil }

    func requestOTP(phone: String) async throws -> OTPChallengeResponse {
        try await send(
            path: "auth/otp/request",
            method: "POST",
            body: ["phone": phone, "channel": "sms", "locale": PilotContract.localeIdentifier],
            bearerToken: nil
        )
    }

    func verifyOTP(challengeId: String, phone: String, otp: String) async throws -> MobileAuthSession {
        try await send(
            path: "auth/otp/verify",
            method: "POST",
            body: ["challengeId": challengeId, "phone": phone, "otp": otp],
            bearerToken: nil
        )
    }

    func getProfile(accessToken: String) async throws -> MobileFarmerProfile {
        try await send(path: "me", method: "GET", body: nil, bearerToken: accessToken)
    }

    private func endpoint(_ path: String) throws -> URL {
        guard var url = baseURL else { throw MobileAPIClientError.notConfigured }
        for component in path.split(separator: "/") {
            url.appendPathComponent(String(component))
        }
        return url
    }

    private func send<Response: Decodable>(
        path: String,
        method: String,
        body: [String: String]?,
        bearerToken: String?
    ) async throws -> Response {
        var request = URLRequest(url: try endpoint(path))
        request.httpMethod = method
        request.timeoutInterval = 20
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("no-store", forHTTPHeaderField: "Cache-Control")
        if let body {
            request.httpBody = try JSONEncoder().encode(body)
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }
        if let bearerToken {
            request.setValue("Bearer \(bearerToken)", forHTTPHeaderField: "Authorization")
        }

        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw MobileAPIClientError.invalidResponse
        }
        guard (200...299).contains(http.statusCode) else {
            let payload = try? JSONDecoder().decode(MobileAPIErrorPayload.self, from: data)
            throw MobileAPIClientError.api(code: payload?.code ?? "unknown", status: http.statusCode)
        }
        do {
            return try JSONDecoder().decode(Response.self, from: data)
        } catch {
            throw MobileAPIClientError.invalidResponse
        }
    }
}
