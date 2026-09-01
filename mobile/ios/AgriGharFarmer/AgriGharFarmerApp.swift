import Combine
import SwiftUI

@main
struct AgriGharFarmerApp: App {
    @StateObject private var model = AppModel()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(model)
                .environment(\.locale, Locale(identifier: PilotContract.localeIdentifier))
                .preferredColorScheme(.light)
        }
    }
}

@MainActor
final class AppModel: ObservableObject {
    enum Screen {
        case login, otp, consent, profile, home, farm, consentCenter
    }

    enum Gender: String, CaseIterable, Identifiable {
        case female, male, privateChoice

        var id: String { rawValue }
        var title: String {
            switch self {
            case .female: return "మహిళ"
            case .male: return "పురుషుడు"
            case .privateChoice: return "చెప్పకూడదు"
            }
        }
    }

    @Published var screen: Screen
    @Published var phoneInput = ""
    @Published var otpInput = ""
    @Published var errorMessage: String?
    @Published var acceptedTerms = false
    @Published var acceptedPrivacy = false
    @Published var acceptedPurpose = false
    @Published var acceptedWithdrawal = false
    @Published var farmerName = ""
    @Published var gender: Gender = .female
    @Published var villageDraft = ""
    @Published var farmNoteDraft = ""
    @Published var draftSavedMessage: String?
    @Published var isBusy = false
    @Published var isSyncing = false
    @Published var syncMessage: String?
    @Published var totalExtentAcres = PilotContract.totalAcres
    @Published var profileUpdatedAt: String?
    @Published var identityVerificationStatus: String?
    @Published var identityVerificationIsSynthetic = false
    @Published var sandboxStaticOTPActive = false

    private let keychain: KeychainStore
    private let apiClient: MobileAPIClient
    private var pendingPhone: String?
    private var pendingChallengeId: String?

    var usesDemoOTP: Bool {
        #if DEBUG
        return !apiClient.isConfigured
        #else
        return false
        #endif
    }

    init(keychain: KeychainStore = KeychainStore(), apiClient: MobileAPIClient = MobileAPIClient()) {
        self.keychain = keychain
        self.apiClient = apiClient
        let hasConsent = keychain.string(for: "consent.version") == PilotContract.consentVersion
        let hasProfile = !(keychain.string(for: "profile.name") ?? "").isEmpty
        let hasSession = !(keychain.string(for: "auth.accessToken") ?? "").isEmpty
        #if DEBUG
        if ProcessInfo.processInfo.arguments.contains("--preview-sandbox-profile") {
            self.screen = .home
            self.farmerName = "Dr Sowmini Sunkara"
            self.syncMessage = "బ్యాక్‌ఎండ్ ప్రొఫైల్ సమకాలీకరించబడింది"
        } else {
            self.screen = apiClient.isConfigured && !hasSession
                ? .login
                : (hasConsent ? (hasProfile ? .home : .profile) : .login)
            self.farmerName = keychain.string(for: "profile.name") ?? ""
        }
        #else
        self.screen = apiClient.isConfigured && !hasSession
            ? .login
            : (hasConsent ? (hasProfile ? .home : .profile) : .login)
        self.farmerName = keychain.string(for: "profile.name") ?? ""
        #endif
        self.gender = Gender(rawValue: keychain.string(for: "profile.gender") ?? "") ?? .female
        self.villageDraft = keychain.string(for: "farm.village.draft") ?? ""
        self.farmNoteDraft = keychain.string(for: "farm.note.draft") ?? ""
    }

    var consentReady: Bool {
        acceptedTerms && acceptedPrivacy && acceptedPurpose && acceptedWithdrawal
    }

    var maskedPhone: String {
        if let pendingPhone { return PilotContract.maskedPhone(pendingPhone) }
        return keychain.string(for: "farmer.phone.masked") ?? "+91 ••••••----"
    }

    var totalExtentText: String {
        PilotContract.acresText(totalExtentAcres)
    }

    var identityBadgeState: VerificationBadgeState {
        guard identityVerificationStatus == "verified" else { return .pending }
        return identityVerificationIsSynthetic ? .sandboxVerified : .verified
    }

    func requestOTP() {
        Task { await performOTPRequest() }
    }

    private func performOTPRequest() async {
        errorMessage = nil
        guard let normalized = PilotContract.normalizeIndianPhone(phoneInput) else {
            errorMessage = "దయచేసి సరైన 10 అంకెల మొబైల్ నంబర్ నమోదు చేయండి."
            return
        }
        pendingPhone = normalized
        otpInput = ""
        sandboxStaticOTPActive = false
        if usesDemoOTP {
            pendingChallengeId = "demo"
            screen = .otp
            return
        }
        isBusy = true
        defer { isBusy = false }
        do {
            let challenge = try await apiClient.requestOTP(phone: normalized)
            pendingChallengeId = challenge.challengeId
            sandboxStaticOTPActive = challenge.sandboxStaticOtp == true
            _ = keychain.set(challenge.delivery.maskedDestination, for: "farmer.phone.masked")
            screen = .otp
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func verifyOTP() {
        Task { await performOTPVerification() }
    }

    private func performOTPVerification() async {
        errorMessage = nil
        guard PilotContract.isValidOTPShape(otpInput) else {
            errorMessage = "6 అంకెల OTP నమోదు చేయండి."
            return
        }
        if usesDemoOTP {
            guard otpInput == "123456" else {
                errorMessage = "డెమో OTP సరిపోలలేదు."
                return
            }
            screen = .consent
            return
        }
        guard let phone = pendingPhone, let challengeId = pendingChallengeId else {
            errorMessage = "OTP అభ్యర్థనను మళ్లీ ప్రారంభించండి."
            screen = .login
            return
        }
        isBusy = true
        defer { isBusy = false }
        do {
            let auth = try await apiClient.verifyOTP(challengeId: challengeId, phone: phone, otp: otpInput)
            _ = keychain.set(auth.accessToken, for: "auth.accessToken")
            _ = keychain.set(auth.refreshToken, for: "auth.refreshToken")
            _ = keychain.set(auth.expiresAt, for: "auth.expiresAt")
            _ = keychain.set(PilotContract.maskedPhone(phone), for: "farmer.phone.masked")
            await refreshAuthenticatedProfile()
            let hasConsent = keychain.string(for: "consent.version") == PilotContract.consentVersion
            screen = hasConsent ? (farmerName.isEmpty ? .profile : .home) : .consent
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func acceptConsent() {
        guard consentReady else { return }
        _ = keychain.set(PilotContract.consentVersion, for: "consent.version")
        _ = keychain.set(PilotContract.policyVersion, for: "consent.policy")
        _ = keychain.set(ISO8601DateFormatter().string(from: Date()), for: "consent.acceptedAt")
        if let pendingPhone {
            _ = keychain.set(PilotContract.maskedPhone(pendingPhone), for: "farmer.phone.masked")
        }
        self.pendingPhone = nil
        pendingChallengeId = nil
        screen = farmerName.isEmpty ? .profile : .home
    }

    func saveProfile() {
        let trimmed = farmerName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            errorMessage = "రైతు పేరు నమోదు చేయండి."
            return
        }
        errorMessage = nil
        _ = keychain.set(trimmed, for: "profile.name")
        _ = keychain.set(gender.rawValue, for: "profile.gender")
        farmerName = trimmed
        screen = .home
    }

    func refreshAuthenticatedProfile() async {
        guard apiClient.isConfigured,
              let accessToken = keychain.string(for: "auth.accessToken"),
              !accessToken.isEmpty else { return }
        isSyncing = true
        defer { isSyncing = false }
        do {
            let profile = try await apiClient.getProfile(accessToken: accessToken)
            farmerName = profile.fullName
            switch profile.gender {
            case "female": gender = .female
            case "male": gender = .male
            default: gender = .privateChoice
            }
            totalExtentAcres = profile.totalExtentAcres ?? PilotContract.totalAcres
            profileUpdatedAt = profile.updatedAt
            identityVerificationStatus = profile.identityVerification?.status
            identityVerificationIsSynthetic = profile.identityVerification?.isSynthetic ?? false
            _ = keychain.set(profile.fullName, for: "profile.name")
            _ = keychain.set(gender.rawValue, for: "profile.gender")
            _ = keychain.set(profile.phoneMasked, for: "farmer.phone.masked")
            syncMessage = "బ్యాక్‌ఎండ్ ప్రొఫైల్ సమకాలీకరించబడింది"
            errorMessage = nil
        } catch let error as MobileAPIClientError {
            if case let .api(code, _) = error, code == "unauthorized" {
                _ = keychain.remove("auth.accessToken")
                _ = keychain.remove("auth.refreshToken")
                _ = keychain.remove("auth.expiresAt")
                syncMessage = nil
                screen = .login
            }
            errorMessage = error.localizedDescription
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func saveFarmDraft() {
        _ = keychain.set(villageDraft.trimmingCharacters(in: .whitespacesAndNewlines), for: "farm.village.draft")
        _ = keychain.set(farmNoteDraft.trimmingCharacters(in: .whitespacesAndNewlines), for: "farm.note.draft")
        draftSavedMessage = "డ్రాఫ్ట్ ఈ పరికరంలో సురక్షితంగా సేవ్ అయింది."
    }

    func withdrawConsent() {
        _ = keychain.removeAll()
        pendingPhone = nil
        phoneInput = ""
        otpInput = ""
        sandboxStaticOTPActive = false
        farmerName = ""
        gender = .female
        totalExtentAcres = PilotContract.totalAcres
        profileUpdatedAt = nil
        identityVerificationStatus = nil
        identityVerificationIsSynthetic = false
        syncMessage = nil
        villageDraft = ""
        farmNoteDraft = ""
        acceptedTerms = false
        acceptedPrivacy = false
        acceptedPurpose = false
        acceptedWithdrawal = false
        errorMessage = nil
        screen = .login
    }
}

private enum AppTheme {
    static let green = Color(red: 0.10, green: 0.42, blue: 0.22)
    static let darkGreen = Color(red: 0.05, green: 0.24, blue: 0.13)
    static let leaf = Color(red: 0.78, green: 0.90, blue: 0.72)
    static let cream = Color(red: 0.97, green: 0.95, blue: 0.88)
    static let gold = Color(red: 0.93, green: 0.65, blue: 0.18)
}

struct RootView: View {
    @EnvironmentObject private var model: AppModel

    var body: some View {
        ZStack {
            AppTheme.cream.ignoresSafeArea()
            switch model.screen {
            case .login: LoginView()
            case .otp: OTPView()
            case .consent: ConsentView()
            case .profile: ProfileView()
            case .home: HomeView()
            case .farm: FarmView()
            case .consentCenter: ConsentCenterView()
            }
        }
        .animation(.easeInOut(duration: 0.2), value: String(describing: model.screen))
        .task { await model.refreshAuthenticatedProfile() }
    }
}

struct BrandHeader: View {
    let eyebrow: String
    let title: String
    let subtitle: String

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 10) {
                ZStack {
                    RoundedRectangle(cornerRadius: 13).fill(AppTheme.green)
                    Image(systemName: "leaf.fill")
                        .font(.title2)
                        .foregroundStyle(.white)
                }
                .frame(width: 48, height: 48)
                VStack(alignment: .leading, spacing: 1) {
                    Text("అగ్రిఘర్").font(.title3.bold()).foregroundStyle(AppTheme.darkGreen)
                    Text("AGRI GHAR FARMER").font(.caption2.bold()).tracking(1.1).foregroundStyle(AppTheme.green)
                }
            }
            Text(eyebrow.uppercased()).font(.caption.bold()).tracking(1).foregroundStyle(AppTheme.green)
            Text(title).font(.largeTitle.bold()).foregroundStyle(AppTheme.darkGreen)
            Text(subtitle).font(.subheadline).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct PrimaryButton: View {
    let title: String
    var enabled = true
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title).font(.headline).frame(maxWidth: .infinity).padding(.vertical, 14)
        }
        .buttonStyle(.plain)
        .foregroundStyle(.white)
        .background(enabled ? AppTheme.green : Color.gray.opacity(0.45))
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .disabled(!enabled)
    }
}

struct ErrorBanner: View {
    let message: String?

    var body: some View {
        if let message {
            Label(message, systemImage: "exclamationmark.circle.fill")
                .font(.footnote)
                .foregroundStyle(Color.red)
                .padding(12)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color.red.opacity(0.08))
                .clipShape(RoundedRectangle(cornerRadius: 12))
        }
    }
}

struct LoginView: View {
    @EnvironmentObject private var model: AppModel

    var body: some View {
        ScrollView {
            VStack(spacing: 22) {
                BrandHeader(
                    eyebrow: "సిద్దిపేట పైలట్",
                    title: "రైతు సేవలకు స్వాగతం",
                    subtitle: "మీ మొబైల్ నంబర్‌తో సురక్షితంగా ప్రారంభించండి."
                )
                VStack(alignment: .leading, spacing: 12) {
                    Text("మొబైల్ నంబర్").font(.headline)
                    HStack {
                        Text("+91").foregroundStyle(.secondary)
                        TextField("10 అంకెల నంబర్", text: $model.phoneInput)
                            .keyboardType(.phonePad)
                            .textContentType(.telephoneNumber)
                            .accessibilityIdentifier("phoneField")
                    }
                    .padding(14)
                    .background(.white)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                    ErrorBanner(message: model.errorMessage)
                    if model.isBusy { ProgressView().frame(maxWidth: .infinity) }
                    PrimaryButton(title: "OTP పంపండి", enabled: !model.isBusy, action: model.requestOTP)
                        .accessibilityIdentifier("requestOTPButton")
                }
                .cardStyle()
                Label("మీ అనుమతి లేకుండా రైతు సమాచారం భాగస్వామ్యం చేయబడదు.", systemImage: "lock.shield.fill")
                    .font(.footnote)
                    .foregroundStyle(AppTheme.darkGreen)
                    .cardStyle()
            }
            .padding(22)
        }
    }
}

struct OTPView: View {
    @EnvironmentObject private var model: AppModel

    var body: some View {
        ScrollView {
            VStack(spacing: 22) {
                BrandHeader(
                    eyebrow: "మొబైల్ ధృవీకరణ",
                    title: "OTP నమోదు చేయండి",
                    subtitle: model.sandboxStaticOTPActive
                        ? "SMS సేవ అందుబాటులో లేదు. సింథటిక్ పైలట్ కోసం తాత్కాలిక కోడ్‌ను నమోదు చేయండి."
                        : "\(model.maskedPhone) కు పంపిన 6 అంకెల కోడ్‌ను నమోదు చేయండి."
                )
                VStack(alignment: .leading, spacing: 14) {
                    if model.usesDemoOTP || model.sandboxStaticOTPActive {
                        Label("సాండ్‌బాక్స్ OTP: 123456", systemImage: "hammer.fill")
                            .font(.subheadline.bold())
                            .foregroundStyle(AppTheme.darkGreen)
                            .padding(12)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(AppTheme.leaf.opacity(0.65))
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                    }
                    TextField("000000", text: $model.otpInput)
                        .keyboardType(.numberPad)
                        .textContentType(.oneTimeCode)
                        .font(.title2.monospacedDigit())
                        .multilineTextAlignment(.center)
                        .padding(14)
                        .background(.white)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                        .accessibilityIdentifier("otpField")
                    ErrorBanner(message: model.errorMessage)
                    if model.isBusy { ProgressView().frame(maxWidth: .infinity) }
                    PrimaryButton(title: "ధృవీకరించి కొనసాగండి", enabled: !model.isBusy, action: model.verifyOTP)
                    Button("నంబర్ మార్చండి") {
                        model.errorMessage = nil
                        model.sandboxStaticOTPActive = false
                        model.screen = .login
                    }
                    .frame(maxWidth: .infinity)
                    .foregroundStyle(AppTheme.green)
                }
                .cardStyle()
            }
            .padding(22)
        }
    }
}

struct ConsentView: View {
    @EnvironmentObject private var model: AppModel

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                BrandHeader(
                    eyebrow: "మీ అనుమతి",
                    title: "నియంత్రణ మీ చేతుల్లోనే",
                    subtitle: "ప్రతి అంశాన్ని చదివి అంగీకరించండి. సేవల చెల్లింపు మీ డేటా అనుమతిని పెంచదు."
                )
                VStack(spacing: 10) {
                    ConsentCheck(isOn: $model.acceptedTerms, text: "నేను సేవా నిబంధనలు చదివాను.")
                    ConsentCheck(isOn: $model.acceptedPrivacy, text: "గోప్యతా విధానం నాకు అర్థమైంది.")
                    ConsentCheck(isOn: $model.acceptedPurpose, text: "నా సమాచారం పేర్కొన్న రైతు సేవల కోసమే ఉపయోగించవచ్చు.")
                    ConsentCheck(isOn: $model.acceptedWithdrawal, text: "నేను ఎప్పుడైనా అనుమతిని వెనక్కి తీసుకోవచ్చని తెలుసు.")
                }
                .cardStyle()
                VStack(alignment: .leading, spacing: 8) {
                    Label("డిఫాల్ట్‌గా డేటా యాక్సెస్ లేదు", systemImage: "hand.raised.fill")
                    Text("గుర్తింపు, భూమి, FPO సభ్యత్వం అధికారిక మూలాలతో ధృవీకరించబడే వరకు ‘పెండింగ్’గానే ఉంటాయి.")
                        .font(.footnote).foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .cardStyle()
                PrimaryButton(title: "అంగీకరించి కొనసాగండి", enabled: model.consentReady, action: model.acceptConsent)
            }
            .padding(22)
        }
    }
}

struct ConsentCheck: View {
    @Binding var isOn: Bool
    let text: String

    var body: some View {
        Button {
            isOn.toggle()
        } label: {
            HStack(alignment: .top, spacing: 12) {
                Image(systemName: isOn ? "checkmark.square.fill" : "square")
                    .font(.title3).foregroundStyle(AppTheme.green)
                Text(text).font(.subheadline).foregroundStyle(.primary)
                Spacer(minLength: 0)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

struct ProfileView: View {
    @EnvironmentObject private var model: AppModel

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                BrandHeader(
                    eyebrow: "రైతు ప్రొఫైల్",
                    title: "మీ వివరాలు",
                    subtitle: "ఈ పైలట్‌లో నమోదు చేసిన వివరాలు అధికారిక ధృవీకరణకు ప్రత్యామ్నాయం కావు."
                )
                VStack(alignment: .leading, spacing: 14) {
                    Text("రైతు పేరు").font(.headline)
                    TextField("పూర్తి పేరు", text: $model.farmerName)
                        .textContentType(.name)
                        .padding(14).background(.white)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                    Text("లింగం").font(.headline)
                    Picker("లింగం", selection: $model.gender) {
                        ForEach(AppModel.Gender.allCases) { choice in
                            Text(choice.title).tag(choice)
                        }
                    }
                    .pickerStyle(.segmented)
                    ErrorBanner(message: model.errorMessage)
                    PrimaryButton(title: "ప్రొఫైల్ సేవ్ చేయండి", action: model.saveProfile)
                }
                .cardStyle()
                Text("పూర్తి ఫోన్ నంబర్, ఆధార్ లేదా భూమి పత్రాల సంఖ్యలు యాప్ సోర్స్‌లో నిల్వ చేయబడవు.")
                    .font(.footnote).foregroundStyle(.secondary)
            }
            .padding(22)
        }
    }
}

struct HomeView: View {
    @EnvironmentObject private var model: AppModel

    var body: some View {
        ScrollView {
            VStack(spacing: 18) {
                HStack {
                    VStack(alignment: .leading, spacing: 3) {
                        Text("నమస్కారం").font(.subheadline).foregroundStyle(.secondary)
                        Text(model.farmerName).font(.title2.bold()).foregroundStyle(AppTheme.darkGreen)
                    }
                    Spacer()
                    Button {
                        Task { await model.refreshAuthenticatedProfile() }
                    } label: {
                        Image(systemName: "arrow.clockwise.circle.fill")
                            .font(.title2).foregroundStyle(AppTheme.green)
                    }
                    .disabled(model.isSyncing)
                    .accessibilityLabel("బ్యాక్‌ఎండ్ ప్రొఫైల్ రిఫ్రెష్")
                    Button {
                        model.screen = .consentCenter
                    } label: {
                        Image(systemName: "person.crop.circle.fill")
                            .font(.largeTitle).foregroundStyle(AppTheme.green)
                    }
                    .accessibilityLabel("అనుమతి కేంద్రం")
                }

                VStack(alignment: .leading, spacing: 10) {
                    Text("సిద్దిపేట రైతు పైలట్").font(.headline)
                    Text("రాయపోల్ మండలం • \(model.totalExtentText) ఎకరాలు").font(.title3.bold())
                    Text("Rayapole Women Farmer Producer Company Limited")
                        .font(.footnote).foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(18)
                .background(
                    LinearGradient(colors: [AppTheme.green, AppTheme.darkGreen], startPoint: .topLeading, endPoint: .bottomTrailing)
                )
                .foregroundStyle(.white)
                .clipShape(RoundedRectangle(cornerRadius: 20))

                VStack(alignment: .leading, spacing: 14) {
                    HStack {
                        Text("పంటల ప్రణాళిక").font(.title3.bold())
                        Spacer()
                        Text("మొత్తం 20 ఎకరాలు").font(.caption.bold()).foregroundStyle(AppTheme.green)
                    }
                    ForEach(PilotContract.crops) { crop in
                        CropRow(crop: crop)
                    }
                }
                .cardStyle()

                VStack(alignment: .leading, spacing: 12) {
                    Text("ధృవీకరణ స్థితి").font(.title3.bold())
                    VerificationRow(
                        icon: "person.text.rectangle",
                        title: "గుర్తింపు",
                        state: model.identityBadgeState
                    )
                    VerificationRow(icon: "map", title: "భూమి రికార్డు", state: .pending)
                    VerificationRow(icon: "person.3", title: "FPO సభ్యత్వం", state: .pending)
                    if model.isSyncing {
                        Label("బ్యాక్‌ఎండ్ వివరాలు రిఫ్రెష్ అవుతున్నాయి", systemImage: "arrow.triangle.2.circlepath")
                            .font(.caption).foregroundStyle(.secondary)
                    } else if let message = model.syncMessage {
                        Label(message, systemImage: "checkmark.icloud.fill")
                            .font(.caption.bold()).foregroundStyle(AppTheme.green)
                        Text("ఈ రైతుకు గుర్తింపు, భూమి మరియు FPO ధృవీకరణలు ఇంకా పెండింగ్‌లో ఉన్నాయి.")
                            .font(.caption).foregroundStyle(.secondary)
                    } else {
                        Text("సైన్ ఇన్ చేసిన రైతు ప్రొఫైల్‌ను బ్యాక్‌ఎండ్ నుంచి రిఫ్రెష్ చేయండి. అధికారిక ఆధారాలు లేకుండా యాప్ ధృవీకరణ పూర్తయిందని చూపదు.")
                            .font(.caption).foregroundStyle(.secondary)
                    }
                }
                .cardStyle()

                PrimaryButton(title: "పొలం వివరాలు తెరవండి") {
                    model.screen = .farm
                }
            }
            .padding(22)
        }
        .refreshable { await model.refreshAuthenticatedProfile() }
    }
}

struct CropRow: View {
    let crop: CropAllocation

    var body: some View {
        VStack(spacing: 7) {
            HStack {
                Text("\(crop.nameTelugu) / \(crop.nameEnglish)").font(.subheadline.bold())
                Spacer()
                Text("\(PilotContract.acresText(crop.acres)) ఎకరాలు").font(.subheadline)
            }
            ProgressView(value: NSDecimalNumber(decimal: crop.acres).doubleValue, total: 20)
                .tint(crop.code == "PADDY" ? AppTheme.green : (crop.code == "MAIZE" ? AppTheme.gold : Color.indigo))
        }
    }
}

enum VerificationBadgeState {
    case pending
    case verified
    case sandboxVerified

    var title: String {
        switch self {
        case .pending: return "పెండింగ్"
        case .verified: return "ధృవీకరించబడింది"
        case .sandboxVerified: return "ధృవీకరించబడింది • శాండ్‌బాక్స్"
        }
    }

    var foreground: Color {
        switch self {
        case .pending: return .orange
        case .verified, .sandboxVerified: return AppTheme.green
        }
    }

    var background: Color { foreground.opacity(0.12) }
}

struct VerificationRow: View {
    let icon: String
    let title: String
    let state: VerificationBadgeState

    var body: some View {
        HStack {
            Image(systemName: icon).frame(width: 24).foregroundStyle(AppTheme.green)
            Text(title)
            Spacer()
            Text(state.title).font(.caption.bold()).foregroundStyle(state.foreground)
                .padding(.horizontal, 9).padding(.vertical, 5)
                .background(state.background).clipShape(Capsule())
        }
    }
}

struct FarmView: View {
    @EnvironmentObject private var model: AppModel

    var body: some View {
        ScrollView {
            VStack(spacing: 18) {
                PageBar(title: "పొలం వివరాలు") { model.screen = .home }
                VStack(alignment: .leading, spacing: 12) {
                    Label("20 ఎకరాల పైలట్ ప్రణాళిక", systemImage: "map.fill").font(.title3.bold())
                    Text("వరి 10 • మొక్కజొన్న 5 • పత్తి 5").foregroundStyle(.secondary)
                    Divider()
                    Text("గ్రామం / క్లస్టర్ (డ్రాఫ్ట్)").font(.headline)
                    TextField("గ్రామం పేరు", text: $model.villageDraft)
                        .padding(14).background(.white).clipShape(RoundedRectangle(cornerRadius: 12))
                    Text("ఫీల్డ్ నోట్ (డ్రాఫ్ట్)").font(.headline)
                    TextField("పంట లేదా పొలం గురించి గమనిక", text: $model.farmNoteDraft, axis: .vertical)
                        .lineLimit(3...6)
                        .padding(14).background(.white).clipShape(RoundedRectangle(cornerRadius: 12))
                    if let message = model.draftSavedMessage {
                        Label(message, systemImage: "checkmark.circle.fill")
                            .font(.footnote).foregroundStyle(AppTheme.green)
                    }
                    PrimaryButton(title: "ఆఫ్‌లైన్ డ్రాఫ్ట్ సేవ్ చేయండి", action: model.saveFarmDraft)
                }
                .cardStyle()
                VStack(alignment: .leading, spacing: 8) {
                    Label("భూమి హక్కు ధృవీకరణ పెండింగ్", systemImage: "clock.badge.exclamationmark")
                        .font(.headline).foregroundStyle(Color.orange)
                    Text("డ్రాఫ్ట్‌ను సేవ్ చేయడం అధికారిక భూమి రికార్డు లేదా యాజమాన్య నిర్ణయం కాదు.")
                        .font(.footnote).foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .cardStyle()
            }
            .padding(22)
        }
    }
}

struct ConsentCenterView: View {
    @EnvironmentObject private var model: AppModel
    @State private var confirmWithdrawal = false

    var body: some View {
        ScrollView {
            VStack(spacing: 18) {
                PageBar(title: "అనుమతి కేంద్రం") { model.screen = .home }
                VStack(alignment: .leading, spacing: 13) {
                    Text("ప్రస్తుత అనుమతి").font(.title3.bold())
                    DetailRow(label: "ఫోన్", value: model.maskedPhone)
                    DetailRow(label: "కాంట్రాక్ట్", value: PilotContract.consentVersion)
                    DetailRow(label: "విధానం", value: PilotContract.policyVersion)
                    Label("ప్రయోజన-పరిమిత, డిఫాల్ట్-డినై", systemImage: "lock.fill")
                        .font(.footnote.bold()).foregroundStyle(AppTheme.green)
                }
                .cardStyle()
                VStack(alignment: .leading, spacing: 10) {
                    Text("అనుమతి వెనక్కి తీసుకోవడం").font(.headline)
                    Text("ఇది ఈ పరికరంలోని ప్రొఫైల్, అనుమతి మరియు ఆఫ్‌లైన్ డ్రాఫ్ట్‌ను తొలగించి సైన్-ఇన్ పేజీకి తీసుకెళ్తుంది.")
                        .font(.footnote).foregroundStyle(.secondary)
                    Button(role: .destructive) {
                        confirmWithdrawal = true
                    } label: {
                        Text("అనుమతి వెనక్కి తీసుకోండి").font(.headline).frame(maxWidth: .infinity).padding(.vertical, 12)
                    }
                    .buttonStyle(.bordered)
                }
                .cardStyle()
            }
            .padding(22)
        }
        .alert("అనుమతి వెనక్కి తీసుకోవాలా?", isPresented: $confirmWithdrawal) {
            Button("రద్దు", role: .cancel) { }
            Button("తీసుకోండి", role: .destructive, action: model.withdrawConsent)
        } message: {
            Text("ఈ పరికరంలోని పైలట్ డేటా తొలగించబడుతుంది.")
        }
    }
}

struct PageBar: View {
    let title: String
    let back: () -> Void

    var body: some View {
        HStack {
            Button(action: back) {
                Image(systemName: "chevron.left").font(.headline)
                    .frame(width: 42, height: 42).background(.white).clipShape(Circle())
            }
            .foregroundStyle(AppTheme.green)
            Text(title).font(.title2.bold()).foregroundStyle(AppTheme.darkGreen)
            Spacer()
        }
    }
}

struct DetailRow: View {
    let label: String
    let value: String

    var body: some View {
        HStack(alignment: .top) {
            Text(label).foregroundStyle(.secondary)
            Spacer()
            Text(value).font(.footnote.monospaced()).multilineTextAlignment(.trailing)
        }
    }
}

private struct CardModifier: ViewModifier {
    func body(content: Content) -> some View {
        content
            .padding(16)
            .background(Color.white.opacity(0.88))
            .clipShape(RoundedRectangle(cornerRadius: 18))
            .overlay(RoundedRectangle(cornerRadius: 18).stroke(Color.black.opacity(0.05)))
    }
}

private extension View {
    func cardStyle() -> some View { modifier(CardModifier()) }
}
