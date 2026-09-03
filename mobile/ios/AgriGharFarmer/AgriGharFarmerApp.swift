import Combine
import SwiftUI

@main
struct AgriGharFarmerApp: App {
    @StateObject private var model = AppModel()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(model)
                .environment(\.locale, Locale(identifier: model.language.localeIdentifier))
                .preferredColorScheme(.light)
        }
    }
}

@MainActor
final class AppModel: ObservableObject {
    enum Screen: Equatable {
        case login, otp, consent, profile, home, onboarding, farm, farmHistory
        case intelligence, training, inputs, soilCare, consentCenter, schemes, marketplace, more
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
    @Published var language: AppLanguage = .telugu
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
    @Published var localSandboxOTPActive = false
    @Published var completedLifecycleActionIDs: Set<String> = []
    @Published var completedTrainingLessonIDs: Set<String> = []

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
        self.language = AppLanguage(rawValue: keychain.string(for: "profile.language") ?? "") ?? .telugu
        self.completedLifecycleActionIDs = Self.storedSet(keychain.string(for: "lifecycle.completed"))
            ?? PilotContract.recordedLifecycleActionIDs
        self.completedTrainingLessonIDs = Self.storedSet(keychain.string(for: "training.completed")) ?? []
        let hasConsent = keychain.string(for: "consent.version") == PilotContract.consentVersion
        let hasSession = !(keychain.string(for: "auth.accessToken") ?? "").isEmpty
        let storedMaskedPhone = keychain.string(for: "farmer.phone.masked") ?? ""
        let shouldMigrateLocalSnapshot = !hasSession
            && storedMaskedPhone.hasSuffix("0467")
            && keychain.string(for: "profile.snapshotVersion") != PilotContract.snapshotVersion
        if shouldMigrateLocalSnapshot {
            _ = keychain.set(PilotContract.sandboxFarmerName, for: "profile.name")
            _ = keychain.set(PilotContract.sandboxFarmerGender, for: "profile.gender")
            _ = keychain.set(PilotContract.snapshotVersion, for: "profile.snapshotVersion")
        }
        let hasLocalSnapshot = !hasSession
            && keychain.string(for: "profile.snapshotVersion") == PilotContract.snapshotVersion
        let hasProfile = !(keychain.string(for: "profile.name") ?? "").isEmpty
        #if DEBUG
        if let languageArgument = ProcessInfo.processInfo.arguments.first(where: { $0.hasPrefix("--preview-language=") }),
           let previewLanguage = AppLanguage(rawValue: String(languageArgument.dropFirst("--preview-language=".count))) {
            self.language = previewLanguage
        }
        if ProcessInfo.processInfo.arguments.contains("--preview-lifecycle") {
            self.screen = .home
            self.farmerName = PilotContract.sandboxFarmerName
            self.gender = .male
            self.localSandboxOTPActive = true
            self.completedLifecycleActionIDs = PilotContract.recordedLifecycleActionIDs
            self.completedTrainingLessonIDs = []
        } else if ProcessInfo.processInfo.arguments.contains("--preview-intelligence") {
            self.screen = .intelligence
            self.farmerName = PilotContract.sandboxFarmerName
            self.gender = .male
            self.localSandboxOTPActive = true
        } else if ProcessInfo.processInfo.arguments.contains("--preview-training") {
            self.screen = .training
            self.farmerName = PilotContract.sandboxFarmerName
            self.gender = .male
            self.localSandboxOTPActive = true
        } else if ProcessInfo.processInfo.arguments.contains("--preview-history") {
            self.screen = .farmHistory
            self.farmerName = PilotContract.sandboxFarmerName
            self.gender = .male
            self.localSandboxOTPActive = true
        } else if ProcessInfo.processInfo.arguments.contains("--preview-profile") {
            self.screen = .profile
            self.farmerName = PilotContract.sandboxFarmerName
            self.gender = .male
            self.localSandboxOTPActive = true
        } else if ProcessInfo.processInfo.arguments.contains("--preview-local-sandbox-otp") {
            self.screen = .otp
            self.farmerName = ""
            self.localSandboxOTPActive = true
        } else if ProcessInfo.processInfo.arguments.contains("--preview-sandbox-profile") {
            self.screen = .home
            self.farmerName = PilotContract.sandboxFarmerName
            self.gender = .male
            self.localSandboxOTPActive = true
            self.syncMessage = "వెబ్ రైతు డేటా సింథటిక్ స్నాప్‌షాట్ స్థానికంగా లోడ్ అయింది"
        } else {
            self.screen = apiClient.isConfigured && !hasSession && !hasLocalSnapshot
                ? .login
                : (hasConsent ? (hasProfile ? .home : .profile) : .login)
            self.farmerName = keychain.string(for: "profile.name") ?? ""
        }
        #else
        self.screen = apiClient.isConfigured && !hasSession && !hasLocalSnapshot
            ? .login
            : (hasConsent ? (hasProfile ? .home : .profile) : .login)
        self.farmerName = keychain.string(for: "profile.name") ?? ""
        #endif
        self.gender = Gender(rawValue: keychain.string(for: "profile.gender") ?? "") ?? .female
        if hasLocalSnapshot {
            self.totalExtentAcres = PilotContract.totalAcres
            self.localSandboxOTPActive = true
            self.syncMessage = "వెబ్ రైతు డేటా సింథటిక్ స్నాప్‌షాట్ స్థానికంగా లోడ్ అయింది"
        }
        #if DEBUG
        if ProcessInfo.processInfo.arguments.contains("--preview-sandbox-profile")
            || ProcessInfo.processInfo.arguments.contains("--preview-lifecycle")
            || ProcessInfo.processInfo.arguments.contains("--preview-profile")
            || ProcessInfo.processInfo.arguments.contains("--preview-intelligence")
            || ProcessInfo.processInfo.arguments.contains("--preview-training")
            || ProcessInfo.processInfo.arguments.contains("--preview-history") {
            self.gender = .male
        }
        #endif
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

    func text(_ telugu: String, _ hindi: String, _ tamil: String, _ english: String) -> String {
        switch language {
        case .telugu: return telugu
        case .hindi: return hindi
        case .tamil: return tamil
        case .english: return english
        }
    }

    func contentText(_ source: String) -> String {
        PilotContentLocalization.text(source, language: language)
    }

    var completedTrainingLessonCount: Int {
        completedTrainingLessonIDs.intersection(Set(PilotContract.trainingModules.flatMap { module in
            module.lessons.indices.map { "\(module.id)-\($0)" }
        })).count
    }

    var currentLifecycleCompletedCount: Int {
        PilotContract.currentLifecycleActions.filter(isLifecycleActionComplete).count
    }

    var currentLifecycleProgress: Double {
        guard !PilotContract.currentLifecycleActions.isEmpty else { return 0 }
        return Double(currentLifecycleCompletedCount) / Double(PilotContract.currentLifecycleActions.count)
    }

    var currentLifecyclePercent: Int {
        Int((currentLifecycleProgress * 100).rounded())
    }

    var overdueLifecycleCount: Int {
        PilotContract.currentLifecycleActions.filter {
            $0.urgency == .overdue && !isLifecycleActionComplete($0)
        }.count
    }

    var todayLifecycleCount: Int {
        PilotContract.currentLifecycleActions.filter {
            $0.urgency == .today && !isLifecycleActionComplete($0)
        }.count
    }

    func isLifecycleActionComplete(_ action: LifecycleAction) -> Bool {
        if let moduleID = action.trainingModuleID {
            let required = PilotContract.trainingLessonIDs(moduleID: moduleID)
            return !required.isEmpty && required.isSubset(of: completedTrainingLessonIDs)
        }
        return completedLifecycleActionIDs.contains(action.id)
    }

    func lifecycleProgress(stageID: String) -> Double? {
        let actions = PilotContract.lifecycleActions.filter { $0.stageID == stageID }
        guard !actions.isEmpty else { return nil }
        if actions.allSatisfy({ $0.urgency == .later }) { return nil }
        let current = actions.filter { $0.urgency != .later }
        let completed = current.filter(isLifecycleActionComplete).count
        return Double(completed) / Double(current.count)
    }

    func cropLifecycleProgress(cropCode: String) -> Double {
        let actions = PilotContract.currentLifecycleActions.filter {
            $0.cropCodes.isEmpty || $0.cropCodes.contains(cropCode)
        }
        guard !actions.isEmpty else { return 0 }
        let completed = actions.filter(isLifecycleActionComplete).count
        return Double(completed) / Double(actions.count)
    }

    func toggleLifecycleAction(_ action: LifecycleAction) {
        guard action.trainingModuleID == nil else {
            openLifecycleDestination(action.destination)
            return
        }
        if completedLifecycleActionIDs.contains(action.id) {
            completedLifecycleActionIDs.remove(action.id)
        } else {
            completedLifecycleActionIDs.insert(action.id)
        }
        persistSet(completedLifecycleActionIDs, key: "lifecycle.completed")
    }

    func toggleTrainingLesson(moduleID: String, index: Int) {
        let lessonID = "\(moduleID)-\(index)"
        if completedTrainingLessonIDs.contains(lessonID) {
            completedTrainingLessonIDs.remove(lessonID)
        } else {
            completedTrainingLessonIDs.insert(lessonID)
        }
        persistSet(completedTrainingLessonIDs, key: "training.completed")
    }

    func openLifecycleDestination(_ destination: LifecycleDestination) {
        switch destination {
        case .farm: screen = .farm
        case .intelligence: screen = .intelligence
        case .training: screen = .training
        case .inputs: screen = .inputs
        case .soilCare: screen = .soilCare
        case .schemes: screen = .schemes
        case .farmHistory: screen = .farmHistory
        }
    }

    func genderTitle(_ value: Gender) -> String {
        switch value {
        case .female: return text("మహిళ", "महिला", "பெண்", "Female")
        case .male: return text("పురుషుడు", "पुरुष", "ஆண்", "Male")
        case .privateChoice: return text("చెప్పకూడదు", "बताना नहीं चाहता/चाहती", "கூற விரும்பவில்லை", "Prefer not to say")
        }
    }

    func persistLanguage() {
        _ = keychain.set(language.rawValue, for: "profile.language")
    }

    private static func storedSet(_ raw: String?) -> Set<String>? {
        guard let raw else { return nil }
        guard !raw.isEmpty else { return [] }
        return Set(raw.split(separator: "|").map(String.init))
    }

    private func persistSet(_ values: Set<String>, key: String) {
        _ = keychain.set(values.sorted().joined(separator: "|"), for: key)
    }

    var showsBottomNavigation: Bool {
        switch screen {
        case .login, .otp, .consent:
            return false
        default:
            return true
        }
    }

    func requestOTP() {
        Task { await performOTPRequest() }
    }

    private func performOTPRequest() async {
        errorMessage = nil
        guard let normalized = PilotContract.normalizeIndianPhone(phoneInput) else {
            errorMessage = text("దయచేసి సరైన 10 అంకెల మొబైల్ నంబర్ నమోదు చేయండి.", "कृपया सही 10 अंकों का मोबाइल नंबर दर्ज करें।", "சரியான 10 இலக்க கைபேசி எண்ணை உள்ளிடவும்.", "Enter a valid 10-digit mobile number.")
            return
        }
        pendingPhone = normalized
        otpInput = ""
        sandboxStaticOTPActive = false
        localSandboxOTPActive = false
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
            if PilotContract.isAuthorizedSandboxPilotPhone(normalized) {
                pendingChallengeId = nil
                localSandboxOTPActive = true
                _ = keychain.set(PilotContract.maskedPhone(normalized), for: "farmer.phone.masked")
                screen = .otp
            } else {
                errorMessage = error.localizedDescription
            }
        }
    }

    func verifyOTP() {
        Task { await performOTPVerification() }
    }

    private func performOTPVerification() async {
        errorMessage = nil
        guard PilotContract.isValidOTPShape(otpInput) else {
            errorMessage = text("6 అంకెల OTP నమోదు చేయండి.", "6 अंकों का OTP दर्ज करें।", "6 இலக்க OTP-ஐ உள்ளிடவும்.", "Enter the 6-digit OTP.")
            return
        }
        if usesDemoOTP {
            guard PilotContract.isSandboxStaticOTP(otpInput) else {
                errorMessage = text("డెమో OTP సరిపోలలేదు.", "डेमो OTP मेल नहीं खाता।", "முன்னோட்ட OTP பொருந்தவில்லை.", "The demo OTP does not match.")
                return
            }
            screen = .consent
            return
        }
        if localSandboxOTPActive {
            guard PilotContract.isSandboxStaticOTP(otpInput) else {
                errorMessage = text("సాండ్‌బాక్స్ OTP సరిపోలలేదు.", "सैंडबॉक्स OTP मेल नहीं खाता।", "சாண்ட்பாக்ஸ் OTP பொருந்தவில்லை.", "The sandbox OTP does not match.")
                return
            }
            activateLocalSandboxProfile()
            let hasConsent = keychain.string(for: "consent.version") == PilotContract.consentVersion
            screen = hasConsent ? .home : .consent
            return
        }
        guard let phone = pendingPhone, let challengeId = pendingChallengeId else {
            errorMessage = text("OTP అభ్యర్థనను మళ్లీ ప్రారంభించండి.", "OTP अनुरोध फिर से शुरू करें।", "OTP கோரிக்கையை மீண்டும் தொடங்கவும்.", "Start the OTP request again.")
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

    private func activateLocalSandboxProfile() {
        _ = keychain.remove("auth.accessToken")
        _ = keychain.remove("auth.refreshToken")
        _ = keychain.remove("auth.expiresAt")
        farmerName = PilotContract.sandboxFarmerName
        gender = Gender(rawValue: PilotContract.sandboxFarmerGender) ?? .female
        totalExtentAcres = PilotContract.totalAcres
        profileUpdatedAt = nil
        identityVerificationStatus = nil
        identityVerificationIsSynthetic = false
        if keychain.string(for: "lifecycle.completed") == nil {
            completedLifecycleActionIDs = PilotContract.recordedLifecycleActionIDs
            persistSet(completedLifecycleActionIDs, key: "lifecycle.completed")
        }
        _ = keychain.set(farmerName, for: "profile.name")
        _ = keychain.set(gender.rawValue, for: "profile.gender")
        _ = keychain.set(PilotContract.snapshotVersion, for: "profile.snapshotVersion")
        if let pendingPhone {
            _ = keychain.set(PilotContract.maskedPhone(pendingPhone), for: "farmer.phone.masked")
        }
        syncMessage = text("వెబ్ రైతు డేటా సింథటిక్ స్నాప్‌షాట్ స్థానికంగా లోడ్ అయింది", "वेब किसान डेटा का सिंथेटिक स्नैपशॉट स्थानीय रूप से लोड हुआ", "வலை விவசாயித் தரவின் செயற்கை நிலைப்படம் உள்ளூரில் ஏற்றப்பட்டது", "Synthetic web farmer snapshot loaded locally")
        pendingChallengeId = nil
        errorMessage = nil
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
            errorMessage = text("రైతు పేరు నమోదు చేయండి.", "किसान का नाम दर्ज करें।", "விவசாயியின் பெயரை உள்ளிடவும்.", "Enter the farmer name.")
            return
        }
        errorMessage = nil
        _ = keychain.set(trimmed, for: "profile.name")
        _ = keychain.set(gender.rawValue, for: "profile.gender")
        persistLanguage()
        farmerName = trimmed
        screen = .home
    }

    func refreshAuthenticatedProfile() async {
        if localSandboxOTPActive {
            syncMessage = text("వెబ్ రైతు డేటా సింథటిక్ స్నాప్‌షాట్ స్థానికంగా లోడ్ అయింది", "वेब किसान डेटा का सिंथेटिक स्नैपशॉट स्थानीय रूप से लोड हुआ", "வலை விவசாயித் தரவின் செயற்கை நிலைப்படம் உள்ளூரில் ஏற்றப்பட்டது", "Synthetic web farmer snapshot loaded locally")
            errorMessage = nil
            return
        }
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
            syncMessage = text("బ్యాక్‌ఎండ్ ప్రొఫైల్ సమకాలీకరించబడింది", "बैकएंड प्रोफ़ाइल समन्वयित हुई", "பின்தள சுயவிவரம் ஒத்திசைக்கப்பட்டது", "Backend profile synchronized")
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
        draftSavedMessage = text("డ్రాఫ్ట్ ఈ పరికరంలో సురక్షితంగా సేవ్ అయింది.", "ड्राफ्ट इस डिवाइस पर सुरक्षित रूप से सहेजा गया।", "வரைவு இந்தச் சாதனத்தில் பாதுகாப்பாகச் சேமிக்கப்பட்டது.", "Draft saved securely on this device.")
    }

    func withdrawConsent() {
        let preservedLanguage = language
        _ = keychain.removeAll()
        _ = keychain.set(preservedLanguage.rawValue, for: "profile.language")
        pendingPhone = nil
        phoneInput = ""
        otpInput = ""
        sandboxStaticOTPActive = false
        localSandboxOTPActive = false
        farmerName = ""
        gender = .female
        totalExtentAcres = PilotContract.totalAcres
        profileUpdatedAt = nil
        identityVerificationStatus = nil
        identityVerificationIsSynthetic = false
        completedLifecycleActionIDs = []
        completedTrainingLessonIDs = []
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
    static let cream = Color(red: 0.984, green: 0.973, blue: 0.914)
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
            case .onboarding: OnboardingView()
            case .farm: FarmView()
            case .farmHistory: FarmHistoryView()
            case .intelligence: IntelligenceView()
            case .training: TrainingView()
            case .inputs: InputsView()
            case .soilCare: SoilCareView()
            case .consentCenter: ConsentCenterView()
            case .schemes: SchemesView()
            case .marketplace: MarketplaceView()
            case .more: MoreView()
            }
        }
        .safeAreaInset(edge: .bottom, spacing: 0) {
            if model.showsBottomNavigation {
                AppBottomNavigation()
            }
        }
        .animation(.easeInOut(duration: 0.2), value: String(describing: model.screen))
        .task { await model.refreshAuthenticatedProfile() }
    }
}

struct AppBottomNavigation: View {
    @EnvironmentObject private var model: AppModel

    var body: some View {
        HStack(spacing: 2) {
            BottomNavigationButton(icon: "square.grid.2x2.fill", title: model.text("హోమ్", "होम", "முகப்பு", "Home"), selected: model.screen == .home) {
                model.screen = .home
            }
            BottomNavigationButton(icon: "map.fill", title: model.text("పొలం", "खेत", "பண்ணை", "Farm"), selected: model.screen == .farm || model.screen == .farmHistory) {
                model.screen = .farm
            }
            BottomNavigationButton(icon: "chart.line.uptrend.xyaxis", title: model.text("సమాచారం", "जानकारी", "தகவல்", "Insights"), selected: model.screen == .intelligence) {
                model.screen = .intelligence
            }
            BottomNavigationButton(icon: "book.closed.fill", title: model.text("శిక్షణ", "प्रशिक्षण", "பயிற்சி", "Training"), selected: model.screen == .training) {
                model.screen = .training
            }
            BottomNavigationButton(icon: "ellipsis.circle.fill", title: model.text("మరిన్ని", "अधिक", "மேலும்", "More"), selected: moreIsSelected) {
                model.screen = .more
            }
        }
        .padding(.horizontal, 8)
        .padding(.top, 8)
        .padding(.bottom, 4)
        .background(.ultraThinMaterial)
        .overlay(alignment: .top) { Divider() }
    }

    private var moreIsSelected: Bool {
        switch model.screen {
        case .profile, .onboarding, .inputs, .soilCare, .consentCenter, .schemes, .marketplace, .more:
            return true
        default:
            return false
        }
    }
}

struct BottomNavigationButton: View {
    let icon: String
    let title: String
    let selected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 4) {
                Image(systemName: icon).font(.system(size: 19, weight: .semibold))
                Text(title).font(.system(size: 9, weight: .semibold)).lineLimit(1)
            }
            .frame(maxWidth: .infinity)
            .foregroundStyle(selected ? AppTheme.green : Color.secondary)
            .padding(.vertical, 5)
            .background(selected ? AppTheme.leaf.opacity(0.45) : Color.clear)
            .clipShape(RoundedRectangle(cornerRadius: 12))
        }
        .buttonStyle(.plain)
    }
}

struct BrandHeader: View {
    let eyebrow: String
    let title: String
    let subtitle: String

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Image("AgrivahBrandLockup")
                .resizable()
                .scaledToFit()
                .frame(maxWidth: .infinity)
                .frame(height: 138)
                .accessibilityLabel("AGRIVAH — Connect, Collaborate, Transform")
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
                    eyebrow: model.text("గుంటూరు సింథటిక్ పైలట్", "गुंटूर सिंथेटिक पायलट", "குண்டூர் செயற்கை முன்னோட்டம்", "Guntur synthetic pilot"),
                    title: model.text("రైతు సేవలకు స్వాగతం", "किसान सेवाओं में आपका स्वागत है", "விவசாயி சேவைகளுக்கு வரவேற்கிறோம்", "Welcome to farmer services"),
                    subtitle: model.text("మీ మొబైల్ నంబర్‌తో సురక్షితంగా ప్రారంభించండి.", "अपने मोबाइल नंबर से सुरक्षित रूप से शुरू करें।", "உங்கள் கைபேசி எண்ணுடன் பாதுகாப்பாகத் தொடங்குங்கள்.", "Start securely with your mobile number.")
                )
                VStack(alignment: .leading, spacing: 12) {
                    Text(model.text("మొబైల్ నంబర్", "मोबाइल नंबर", "கைபேசி எண்", "Mobile number")).font(.headline)
                    HStack {
                        Text("+91").foregroundStyle(.secondary)
                        TextField(model.text("10 అంకెల నంబర్", "10 अंकों का नंबर", "10 இலக்க எண்", "10-digit number"), text: $model.phoneInput)
                            .keyboardType(.phonePad)
                            .textContentType(.telephoneNumber)
                            .accessibilityIdentifier("phoneField")
                    }
                    .padding(14)
                    .background(.white)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                    ErrorBanner(message: model.errorMessage)
                    if model.isBusy { ProgressView().frame(maxWidth: .infinity) }
                    PrimaryButton(title: model.text("OTP పంపండి", "OTP भेजें", "OTP அனுப்பவும்", "Send OTP"), enabled: !model.isBusy, action: model.requestOTP)
                        .accessibilityIdentifier("requestOTPButton")
                }
                .cardStyle()
                Label(model.text("మీ అనుమతి లేకుండా రైతు సమాచారం భాగస్వామ్యం చేయబడదు.", "आपकी अनुमति के बिना किसान की जानकारी साझा नहीं की जाएगी।", "உங்கள் அனுமதி இல்லாமல் விவசாயி தகவல் பகிரப்படாது.", "Farmer information is not shared without your consent."), systemImage: "lock.shield.fill")
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
                    eyebrow: model.text("మొబైల్ ధృవీకరణ", "मोबाइल सत्यापन", "கைபேசி சரிபார்ப்பு", "Mobile verification"),
                    title: model.text("OTP నమోదు చేయండి", "OTP दर्ज करें", "OTP-ஐ உள்ளிடவும்", "Enter OTP"),
                    subtitle: model.sandboxStaticOTPActive
                        ? model.text("SMS సేవ అందుబాటులో లేదు. సింథటిక్ పైలట్ కోసం తాత్కాలిక కోడ్‌ను నమోదు చేయండి.", "SMS सेवा उपलब्ध नहीं है। सिंथेटिक पायलट के लिए अस्थायी कोड दर्ज करें।", "SMS சேவை கிடைக்கவில்லை. செயற்கை முன்னோட்டத்திற்கான தற்காலிக குறியீட்டை உள்ளிடவும்.", "SMS is unavailable. Enter the temporary synthetic-pilot code.")
                        : model.localSandboxOTPActive
                        ? model.text("సేవ అందుబాటులో లేదు. అధీకృత సింథటిక్ పైలట్ కోసం పరికరం-స్థాయి కోడ్‌ను నమోదు చేయండి.", "सेवा उपलब्ध नहीं है। अधिकृत सिंथेटिक पायलट के लिए डिवाइस कोड दर्ज करें।", "சேவை கிடைக்கவில்லை. அங்கீகரிக்கப்பட்ட செயற்கை முன்னோட்டத்திற்கான சாதனக் குறியீட்டை உள்ளிடவும்.", "The service is unavailable. Enter the authorized device-level pilot code.")
                        : model.text("\(model.maskedPhone) కు పంపిన 6 అంకెల కోడ్‌ను నమోదు చేయండి.", "\(model.maskedPhone) पर भेजा गया 6 अंकों का कोड दर्ज करें।", "\(model.maskedPhone)-க்கு அனுப்பப்பட்ட 6 இலக்கக் குறியீட்டை உள்ளிடவும்.", "Enter the 6-digit code sent to \(model.maskedPhone).")
                )
                VStack(alignment: .leading, spacing: 14) {
                    if model.usesDemoOTP || model.sandboxStaticOTPActive || model.localSandboxOTPActive {
                        Label(model.text("సాండ్‌బాక్స్ OTP: \(PilotContract.sandboxStaticOTP)", "सैंडबॉक्स OTP: \(PilotContract.sandboxStaticOTP)", "சாண்ட்பாக்ஸ் OTP: \(PilotContract.sandboxStaticOTP)", "Sandbox OTP: \(PilotContract.sandboxStaticOTP)"), systemImage: "hammer.fill")
                            .font(.subheadline.bold())
                            .foregroundStyle(AppTheme.darkGreen)
                            .padding(12)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(AppTheme.leaf.opacity(0.65))
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                        if model.localSandboxOTPActive {
                            Text(model.text("ఇది ఈ పరికరంలో మాత్రమే పనిచేస్తుంది. బ్యాక్‌ఎండ్ సెషన్ లేదా SMS ధృవీకరణను సృష్టించదు.", "यह केवल इस डिवाइस पर काम करता है; बैकएंड सत्र या SMS सत्यापन नहीं बनाता।", "இது இந்தச் சாதனத்தில் மட்டுமே செயல்படும்; பின்தள அமர்வு அல்லது SMS சரிபார்ப்பை உருவாக்காது.", "This works only on this device and does not create a backend session or SMS verification."))
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
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
                    PrimaryButton(title: model.text("ధృవీకరించి కొనసాగండి", "सत्यापित कर आगे बढ़ें", "சரிபார்த்து தொடரவும்", "Verify and continue"), enabled: !model.isBusy, action: model.verifyOTP)
                    Button(model.text("నంబర్ మార్చండి", "नंबर बदलें", "எண்ணை மாற்றவும்", "Change number")) {
                        model.errorMessage = nil
                        model.sandboxStaticOTPActive = false
                        model.localSandboxOTPActive = false
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
                    eyebrow: model.text("మీ అనుమతి", "आपकी सहमति", "உங்கள் ஒப்புதல்", "Your consent"),
                    title: model.text("నియంత్రణ మీ చేతుల్లోనే", "नियंत्रण आपके हाथ में है", "கட்டுப்பாடு உங்கள் கையில்", "You remain in control"),
                    subtitle: model.text("ప్రతి అంశాన్ని చదివి అంగీకరించండి. సేవల చెల్లింపు మీ డేటా అనుమతిని పెంచదు.", "हर बिंदु पढ़कर स्वीकार करें। भुगतान आपकी डेटा सहमति नहीं बढ़ाता।", "ஒவ்வொரு அம்சத்தையும் படித்து ஏற்கவும். கட்டணம் உங்கள் தரவு ஒப்புதலை விரிவுபடுத்தாது.", "Read and accept each item. Payment does not expand your data consent.")
                )
                VStack(spacing: 10) {
                    ConsentCheck(isOn: $model.acceptedTerms, text: model.text("నేను సేవా నిబంధనలు చదివాను.", "मैंने सेवा की शर्तें पढ़ी हैं।", "சேவை விதிமுறைகளைப் படித்தேன்.", "I have read the service terms."))
                    ConsentCheck(isOn: $model.acceptedPrivacy, text: model.text("గోప్యతా విధానం నాకు అర్థమైంది.", "मैं गोपनीयता नीति समझता/समझती हूँ।", "தனியுரிமைக் கொள்கையைப் புரிந்துகொண்டேன்.", "I understand the privacy policy."))
                    ConsentCheck(isOn: $model.acceptedPurpose, text: model.text("నా సమాచారం పేర్కొన్న రైతు సేవల కోసమే ఉపయోగించవచ్చు.", "मेरी जानकारी केवल बताई गई किसान सेवाओं के लिए उपयोग हो सकती है।", "என் தகவல் குறிப்பிடப்பட்ட விவசாயி சேவைகளுக்கு மட்டுமே பயன்படுத்தப்படலாம்.", "My information may be used only for the stated farmer services."))
                    ConsentCheck(isOn: $model.acceptedWithdrawal, text: model.text("నేను ఎప్పుడైనా అనుమతిని వెనక్కి తీసుకోవచ్చని తెలుసు.", "मैं जानता/जानती हूँ कि सहमति कभी भी वापस ले सकता/सकती हूँ।", "ஒப்புதலை எப்போது வேண்டுமானாலும் திரும்பப் பெறலாம் என்பதை அறிந்தேன்.", "I understand I can withdraw consent at any time."))
                }
                .cardStyle()
                VStack(alignment: .leading, spacing: 8) {
                    Label(model.text("డిఫాల్ట్‌గా డేటా యాక్సెస్ లేదు", "डिफ़ॉल्ट रूप से डेटा पहुँच नहीं", "இயல்பாக தரவு அணுகல் இல்லை", "No data access by default"), systemImage: "hand.raised.fill")
                    Text(model.text("గుర్తింపు, భూమి, FPO సభ్యత్వం అధికారిక మూలాలతో ధృవీకరించబడే వరకు ‘పెండింగ్’గానే ఉంటాయి.", "पहचान, भूमि और FPO सदस्यता अधिकृत स्रोतों से सत्यापित होने तक लंबित रहेंगी।", "அடையாளம், நிலம் மற்றும் FPO உறுப்பினர் நிலை அதிகாரப்பூர்வ ஆதாரங்களால் சரிபார்க்கப்படும் வரை நிலுவையில் இருக்கும்.", "Identity, land and FPO membership remain pending until verified by authoritative sources."))
                        .font(.footnote).foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .cardStyle()
                PrimaryButton(title: model.text("అంగీకరించి కొనసాగండి", "स्वीकार कर आगे बढ़ें", "ஏற்று தொடரவும்", "Accept and continue"), enabled: model.consentReady, action: model.acceptConsent)
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
                    eyebrow: model.text("రైతు ప్రొఫైల్", "किसान प्रोफ़ाइल", "விவசாயி சுயவிவரம்", "Farmer profile"),
                    title: model.text("మీ వివరాలు", "आपका विवरण", "உங்கள் விவரங்கள்", "Your details"),
                    subtitle: model.text("ఈ పైలట్‌లో నమోదు చేసిన వివరాలు అధికారిక ధృవీకరణకు ప్రత్యామ్నాయం కావు.", "इस पायलट में दर्ज विवरण आधिकारिक सत्यापन का विकल्प नहीं हैं।", "இந்த முன்னோட்டத்தில் உள்ள விவரங்கள் அதிகாரப்பூர்வ சரிபார்ப்புக்கு மாற்றாகாது.", "Details recorded in this pilot do not replace official verification.")
                )
                VStack(alignment: .leading, spacing: 14) {
                    Text(model.text("రైతు పేరు", "किसान का नाम", "விவசாயியின் பெயர்", "Farmer name")).font(.headline)
                    TextField(model.text("పూర్తి పేరు", "पूरा नाम", "முழுப் பெயர்", "Full name"), text: $model.farmerName)
                        .textContentType(.name)
                        .padding(14).background(.white)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                    Text(model.text("లింగం", "लिंग", "பாலினம்", "Gender")).font(.headline)
                    Picker(model.text("లింగం", "लिंग", "பாலினம்", "Gender"), selection: $model.gender) {
                        ForEach(AppModel.Gender.allCases) { choice in
                            Text(model.genderTitle(choice)).tag(choice)
                        }
                    }
                    .pickerStyle(.menu)
                    Text(model.text("యాప్ భాష", "ऐप की भाषा", "செயலி மொழி", "App language")).font(.headline)
                    Picker(model.text("యాప్ భాష", "ऐप की भाषा", "செயலி மொழி", "App language"), selection: $model.language) {
                        ForEach(AppLanguage.allCases) { language in
                            Text(language.nativeName).tag(language)
                        }
                    }
                    .pickerStyle(.menu)
                    .onChange(of: model.language) { _, _ in model.persistLanguage() }
                    ErrorBanner(message: model.errorMessage)
                    PrimaryButton(title: model.text("ప్రొఫైల్ సేవ్ చేయండి", "प्रोफ़ाइल सहेजें", "சுயவிவரத்தைச் சேமிக்கவும்", "Save profile"), action: model.saveProfile)
                }
                .cardStyle()
                VStack(alignment: .leading, spacing: 12) {
                    Text(model.text("వెబ్ ప్రొఫైల్ వివరాలు", "वेब प्रोफ़ाइल विवरण", "வலை சுயவிவர விவரங்கள்", "Web profile details")).font(.title3.bold())
                    ForEach(PilotContract.profileDetails) { item in
                        SnapshotRow(item: item)
                        if item.id != PilotContract.profileDetails.last?.id { Divider() }
                    }
                }
                .cardStyle()
                VStack(alignment: .leading, spacing: 12) {
                    Text(model.text("పత్రాలు", "दस्तावेज़", "ஆவணங்கள்", "Documents")).font(.title3.bold())
                    ForEach(PilotContract.profileDocuments) { item in
                        SnapshotRow(item: item)
                        if item.id != PilotContract.profileDocuments.last?.id { Divider() }
                    }
                }
                .cardStyle()
                Text(model.text("పూర్తి ఫోన్ నంబర్, ఆధార్ లేదా భూమి పత్రాల సంఖ్యలు యాప్ సోర్స్‌లో నిల్వ చేయబడవు.", "पूरा फोन नंबर, आधार या भूमि-दस्तावेज़ नंबर ऐप स्रोत में संग्रहीत नहीं हैं।", "முழு கைபேசி எண், ஆதார் அல்லது நில ஆவண எண்கள் செயலி மூலத்தில் சேமிக்கப்படாது.", "Full phone, Aadhaar and land-document numbers are not stored in the app source."))
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
            VStack(spacing: 16) {
                HStack {
                    VStack(alignment: .leading, spacing: 3) {
                        Text("AGRIVAH FARMER").font(.caption.bold()).tracking(1.2).foregroundStyle(AppTheme.green)
                        Text("\(model.text("నమస్కారం", "नमस्ते", "வணக்கம்", "Hello")), \(model.farmerName)").font(.title2.bold()).foregroundStyle(AppTheme.darkGreen)
                        Text(model.text("కాజా క్లస్టర్ • గుంటూరు", "काज़ा क्लस्टर • गुंटूर", "காஜா குழுமம் • குண்டூர்", "Kaza cluster • Guntur")).font(.caption).foregroundStyle(.secondary)
                    }
                    Spacer()
                    Button {
                        Task { await model.refreshAuthenticatedProfile() }
                    } label: {
                        Image(systemName: "arrow.clockwise")
                            .font(.headline).foregroundStyle(AppTheme.green)
                            .frame(width: 40, height: 40).background(.white).clipShape(Circle())
                    }
                    .disabled(model.isSyncing)
                    .accessibilityLabel(model.text("బ్యాక్‌ఎండ్ ప్రొఫైల్ రిఫ్రెష్", "बैकएंड प्रोफ़ाइल रीफ़्रेश", "பின்தள சுயவிவரத்தைப் புதுப்பி", "Refresh backend profile"))
                }

                LifecycleDashboardCard()

                HStack(spacing: 12) {
                    DashboardMetric(icon: "map.fill", value: "\(model.totalExtentText)", label: model.text("ఎకరాలు", "एकड़", "ஏக்கர்", "acres")) {
                        model.screen = .farm
                    }
                    DashboardMetric(icon: "leaf.fill", value: "3", label: model.text("పంటలు", "फसलें", "பயிர்கள்", "crops")) {
                        model.screen = .farm
                    }
                    DashboardMetric(icon: "book.closed.fill", value: "\(model.completedTrainingLessonCount)/\(PilotContract.totalTrainingLessonCount)", label: model.text("పాఠాలు", "पाठ", "பாடங்கள்", "lessons")) {
                        model.screen = .training
                    }
                }

                WeatherDashboardCard()

                Button {
                    model.screen = .intelligence
                } label: {
                    HStack(alignment: .top, spacing: 12) {
                        Image(systemName: "exclamationmark.triangle.fill")
                            .font(.title3).foregroundStyle(Color.orange)
                        VStack(alignment: .leading, spacing: 5) {
                            Text(model.text("వర్షం హెచ్చరిక", "वर्षा चेतावनी", "மழை எச்சரிக்கை", "Rain alert")).font(.headline).foregroundStyle(AppTheme.darkGreen)
                            Text(model.text("తదుపరి 48 గంటల్లో 12.8–16.0 mm వర్షం సూచన. నీటి పారుదల చూడండి; పై ఎరువును వాయిదా వేయండి.", "अगले 48 घंटों में 12.8–16.0 mm बारिश का अनुमान। जल निकासी जाँचें और ऊपरी खाद टालें।", "அடுத்த 48 மணிநேரத்தில் 12.8–16.0 mm மழை முன்னறிவிப்பு. வடிகாலைக் கவனித்து மேலுரமிடுதலைத் தள்ளிவையுங்கள்.", "12.8–16.0 mm rain is forecast in the next 48 hours. Check drainage and postpone top-dressing."))
                                .font(.footnote).foregroundStyle(.secondary)
                        }
                        Spacer()
                        Image(systemName: "chevron.right").foregroundStyle(.secondary)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .cardStyle(background: Color.orange.opacity(0.08))
                }
                .buttonStyle(.plain)

                VStack(alignment: .leading, spacing: 12) {
                    HStack {
                        Text(model.text("పంటల ప్రణాళిక", "फसल योजना", "பயிர் திட்டம்", "Crop plan")).font(.title3.bold())
                        Spacer()
                        Button(model.text("వివరాలు", "विवरण", "விவரங்கள்", "Details")) { model.screen = .farm }
                            .font(.caption.bold()).foregroundStyle(AppTheme.green)
                    }
                    ForEach(PilotContract.crops) { crop in
                        CropRow(crop: crop)
                    }
                }
                .cardStyle()

                HStack(spacing: 12) {
                    DashboardAction(icon: "clock.arrow.circlepath", title: model.text("చరిత్ర", "इतिहास", "வரலாறு", "History")) { model.screen = .farmHistory }
                    DashboardAction(icon: "cross.case.fill", title: model.text("పంట రక్షణ", "फसल सुरक्षा", "பயிர் பாதுகாப்பு", "Protection")) { model.screen = .inputs }
                    DashboardAction(icon: "doc.text.fill", title: model.text("పథకాలు", "योजनाएँ", "திட்டங்கள்", "Schemes")) { model.screen = .schemes }
                }

                Text(model.text("సింథటిక్ వ్యవసాయ-వాతావరణ అంచనా • ప్రొడక్షన్ వాతావరణ సేవ ఇంకా కనెక్ట్ కాలేదు", "सिंथेटिक कृषि-मौसम पूर्वानुमान • उत्पादन मौसम सेवा अभी जुड़ी नहीं है", "செயற்கை வேளாண்-வானிலை முன்னறிவிப்பு • உற்பத்தி வானிலை சேவை இன்னும் இணைக்கப்படவில்லை", "Synthetic agromet forecast • production weather service is not connected"))
                    .font(.caption2).foregroundStyle(.secondary)
            }
            .padding(.horizontal, 18)
            .padding(.top, 18)
            .padding(.bottom, 10)
        }
        .refreshable { await model.refreshAuthenticatedProfile() }
    }
}

struct DashboardMetric: View {
    let icon: String
    let value: String
    let label: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 6) {
                Image(systemName: icon).foregroundStyle(AppTheme.green)
                Text(value).font(.title3.bold()).foregroundStyle(AppTheme.darkGreen)
                Text(label).font(.caption).foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(13)
            .background(.white)
            .clipShape(RoundedRectangle(cornerRadius: 16))
            .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color.black.opacity(0.06)))
        }
        .buttonStyle(.plain)
    }
}

struct DashboardAction: View {
    let icon: String
    let title: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 8) {
                Image(systemName: icon).font(.title3).foregroundStyle(AppTheme.green)
                Text(title).font(.caption.bold()).foregroundStyle(AppTheme.darkGreen).lineLimit(1)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(.white)
            .clipShape(RoundedRectangle(cornerRadius: 16))
            .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color.black.opacity(0.06)))
        }
        .buttonStyle(.plain)
    }
}

struct LifecycleDashboardCard: View {
    @EnvironmentObject private var model: AppModel
    @State private var showsAllActions = false

    private var visibleActions: [LifecycleAction] {
        let sorted = PilotContract.lifecycleActions.sorted { first, second in
            let firstComplete = model.isLifecycleActionComplete(first)
            let secondComplete = model.isLifecycleActionComplete(second)
            if firstComplete != secondComplete { return !firstComplete }
            return first.urgency.rawValue < second.urgency.rawValue
        }
        if showsAllActions { return sorted }
        return Array(sorted.filter { $0.urgency != .later && !model.isLifecycleActionComplete($0) }.prefix(4))
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(alignment: .center, spacing: 16) {
                LifecycleProgressRing(progress: model.currentLifecycleProgress)
                VStack(alignment: .leading, spacing: 6) {
                    Text(model.text("ప్రస్తుత పంట సిద్ధత", "वर्तमान फसल तैयारी", "தற்போதைய பயிர் தயார்நிலை", "Current crop readiness"))
                        .font(.title3.bold()).foregroundStyle(AppTheme.darkGreen)
                    Text("\(model.currentLifecycleCompletedCount)/\(PilotContract.currentLifecycleActions.count) \(model.text("సమయానుకూల చర్యలు పూర్తయ్యాయి", "समयबद्ध कार्य पूरे", "நேரச் செயல்கள் முடிந்தன", "timely actions complete"))")
                        .font(.subheadline).foregroundStyle(.secondary)
                    Text(readinessMessage)
                        .font(.caption.bold()).foregroundStyle(model.currentLifecyclePercent == 100 ? AppTheme.green : Color.orange)
                }
            }

            HStack(spacing: 8) {
                LifecycleCountBadge(
                    value: model.overdueLifecycleCount,
                    label: model.text("ఆలస్యం", "विलंबित", "தாமதம்", "overdue"),
                    color: .red
                )
                LifecycleCountBadge(
                    value: model.todayLifecycleCount,
                    label: model.text("ఈరోజు", "आज", "இன்று", "today"),
                    color: .orange
                )
                LifecycleCountBadge(
                    value: PilotContract.lifecycleActions.filter { $0.urgency == .later }.count,
                    label: model.text("తర్వాతి దశ", "अगला चरण", "அடுத்த கட்டம்", "later stage"),
                    color: .gray
                )
            }

            Divider()

            VStack(alignment: .leading, spacing: 10) {
                Text(model.text("దశల వారీ పురోగతి", "चरणवार प्रगति", "கட்ட வாரியான முன்னேற்றம்", "Progress by stage"))
                    .font(.headline)
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 10) {
                        ForEach(PilotContract.lifecycleStages) { stage in
                            LifecycleStageTile(stage: stage, progress: model.lifecycleProgress(stageID: stage.id))
                        }
                    }
                }
            }

            VStack(alignment: .leading, spacing: 10) {
                Text(model.text("పంటల సిద్ధత", "फसल तैयारी", "பயிர் தயார்நிலை", "Readiness by crop"))
                    .font(.headline)
                HStack(spacing: 9) {
                    ForEach(PilotContract.crops) { crop in
                        CropReadinessTile(crop: crop, progress: model.cropLifecycleProgress(cropCode: crop.code))
                    }
                }
            }

            Divider()

            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(model.text("తదుపరి చేయాల్సినవి", "अगले कार्य", "அடுத்து செய்ய வேண்டியவை", "Do next"))
                        .font(.headline)
                    Text(model.text("పూర్తయినట్లు నిర్ధారించినప్పుడే స్కోరు పెరుగుతుంది", "पूर्ण होने की पुष्टि पर ही स्कोर बढ़ता है", "முடிந்ததை உறுதிப்படுத்தினால் மட்டுமே மதிப்பெண் உயரும்", "The score rises only after completion is confirmed"))
                        .font(.caption).foregroundStyle(.secondary)
                }
                Spacer()
                Button(showsAllActions ? model.text("తక్కువ చూపండి", "कम दिखाएँ", "குறைவாகக் காட்டு", "Show less") : model.text("అన్నీ చూడండి", "सभी देखें", "அனைத்தையும் காண்க", "View all")) {
                    withAnimation { showsAllActions.toggle() }
                }
                .font(.caption.bold()).foregroundStyle(AppTheme.green)
            }

            ForEach(visibleActions) { action in
                LifecycleActionRow(
                    action: action,
                    isComplete: model.isLifecycleActionComplete(action),
                    onToggle: { model.toggleLifecycleAction(action) },
                    onOpen: { model.openLifecycleDestination(action.destination) }
                )
                if action.id != visibleActions.last?.id { Divider() }
            }

            Text(model.text("ఈ పైలట్ షెడ్యూల్ సింథటిక్. వాస్తవ తేదీలు, వాతావరణం మరియు అధీకృత వ్యవసాయ సలహాను నిర్ధారించండి.", "यह पायलट समय-सारिणी सिंथेटिक है। वास्तविक तारीख, मौसम और अधिकृत कृषि सलाह की पुष्टि करें।", "இந்த முன்னோட்ட அட்டவணை செயற்கையானது. உண்மைத் தேதிகள், வானிலை மற்றும் அங்கீகரிக்கப்பட்ட வேளாண் ஆலோசனையை உறுதிப்படுத்தவும்.", "This pilot schedule is synthetic. Confirm actual dates, weather and authorised agronomic advice."))
                .font(.caption2).foregroundStyle(.secondary)
        }
        .cardStyle(background: AppTheme.leaf.opacity(0.22))
    }

    private var readinessMessage: String {
        if model.currentLifecyclePercent == 100 {
            return model.text("అద్భుతం — ప్రస్తుత దశ 100% సిద్ధంగా ఉంది.", "बहुत अच्छा—वर्तमान चरण 100% तैयार है।", "சிறப்பு—தற்போதைய கட்டம் 100% தயாராக உள்ளது.", "Excellent—current-stage readiness is 100%.")
        }
        return model.text("ప్రతి సమయానుకూల చర్యను పూర్తి చేసి 100% చేరుకోండి.", "हर समयबद्ध कार्य पूरा करके 100% तक पहुँचें।", "ஒவ்வொரு நேரச் செயலையும் முடித்து 100% அடையுங்கள்.", "Complete every timely action to reach 100%.")
    }
}

struct LifecycleProgressRing: View {
    @EnvironmentObject private var model: AppModel
    let progress: Double

    var body: some View {
        ZStack {
            Circle().stroke(AppTheme.green.opacity(0.14), lineWidth: 10)
            Circle()
                .trim(from: 0, to: min(max(progress, 0), 1))
                .stroke(AppTheme.green, style: StrokeStyle(lineWidth: 10, lineCap: .round))
                .rotationEffect(.degrees(-90))
            Text("\(Int((progress * 100).rounded()))%")
                .font(.title3.bold()).foregroundStyle(AppTheme.darkGreen)
        }
        .frame(width: 82, height: 82)
        .accessibilityValue("\(Int((progress * 100).rounded())) \(model.text("శాతం", "प्रतिशत", "சதவீதம்", "percent"))")
    }
}

struct LifecycleCountBadge: View {
    let value: Int
    let label: String
    let color: Color

    var body: some View {
        Text("\(value) \(label)")
            .font(.caption.bold())
            .foregroundStyle(value == 0 ? Color.secondary : color)
            .padding(.horizontal, 10).padding(.vertical, 6)
            .background((value == 0 ? Color.gray : color).opacity(0.11))
            .clipShape(Capsule())
    }
}

struct LifecycleStageTile: View {
    @EnvironmentObject private var model: AppModel
    let stage: LifecycleStage
    let progress: Double?

    var body: some View {
        VStack(alignment: .leading, spacing: 7) {
            Image(systemName: stage.icon).foregroundStyle(AppTheme.green)
            Text(model.contentText(stage.title)).font(.caption.bold()).foregroundStyle(AppTheme.darkGreen).lineLimit(2)
            if let progress {
                ProgressView(value: progress).tint(AppTheme.green)
                Text("\(Int((progress * 100).rounded()))%")
                    .font(.caption2.bold()).foregroundStyle(.secondary)
            } else {
                Text(model.text("ఇంకా ప్రారంభం కాలేదు", "अभी शुरू नहीं", "இன்னும் தொடங்கவில்லை", "Not due yet"))
                    .font(.caption2.bold()).foregroundStyle(.secondary)
            }
        }
        .frame(width: 128, height: 94, alignment: .topLeading)
        .padding(11)
        .background(.white.opacity(0.9))
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Color.black.opacity(0.05)))
        .accessibilityHint(model.contentText(stage.summary))
    }
}

struct CropReadinessTile: View {
    @EnvironmentObject private var model: AppModel
    let crop: CropAllocation
    let progress: Double

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(model.contentText(crop.nameEnglish)).font(.caption.bold()).lineLimit(1)
            Text("\(Int((progress * 100).rounded()))%")
                .font(.headline).foregroundStyle(AppTheme.darkGreen)
            ProgressView(value: progress).tint(AppTheme.green)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(10)
        .background(.white.opacity(0.9))
        .clipShape(RoundedRectangle(cornerRadius: 13))
    }
}

struct LifecycleActionRow: View {
    @EnvironmentObject private var model: AppModel
    let action: LifecycleAction
    let isComplete: Bool
    let onToggle: () -> Void
    let onOpen: () -> Void

    var body: some View {
        HStack(alignment: .top, spacing: 11) {
            Button(action: onToggle) {
                Image(systemName: completionIcon)
                    .font(.title3).foregroundStyle(isComplete ? AppTheme.green : urgencyColor)
                    .frame(width: 32, height: 32)
            }
            .buttonStyle(.plain)
            .accessibilityLabel(isComplete ? model.text("పూర్తయింది", "पूर्ण", "முடிந்தது", "Completed") : model.text("పూర్తయినట్లు గుర్తించండి", "पूर्ण चिन्हित करें", "முடிந்ததாகக் குறிக்கவும்", "Mark complete"))

            VStack(alignment: .leading, spacing: 5) {
                HStack(alignment: .top) {
                    Text(model.contentText(action.title)).font(.subheadline.bold()).foregroundStyle(AppTheme.darkGreen)
                    Spacer(minLength: 8)
                    Text(statusLabel).font(.caption2.bold()).foregroundStyle(isComplete ? AppTheme.green : urgencyColor)
                        .padding(.horizontal, 7).padding(.vertical, 4)
                        .background((isComplete ? AppTheme.green : urgencyColor).opacity(0.1)).clipShape(Capsule())
                }
                if !action.cropCodes.isEmpty {
                    Text(action.cropCodes.compactMap { code in
                        PilotContract.crops.first(where: { $0.code == code }).map { model.contentText($0.nameEnglish) }
                    }.joined(separator: " • "))
                    .font(.caption2.bold()).foregroundStyle(AppTheme.green)
                }
                Text(model.contentText(action.detail)).font(.caption).foregroundStyle(.secondary)
                Button(action: onOpen) {
                    Label(model.text("మార్గదర్శకం తెరవండి", "मार्गदर्शन खोलें", "வழிகாட்டலைத் திறக்கவும்", "Open guidance"), systemImage: "arrow.right.circle.fill")
                        .font(.caption.bold()).foregroundStyle(AppTheme.green)
                }
                .buttonStyle(.plain)
            }
        }
        .opacity(isComplete ? 0.72 : 1)
    }

    private var completionIcon: String {
        if isComplete { return "checkmark.circle.fill" }
        return action.trainingModuleID == nil ? "circle" : "book.circle.fill"
    }

    private var statusLabel: String {
        if isComplete { return model.text("పూర్తి", "पूर्ण", "முடிந்தது", "Complete") }
        switch action.urgency {
        case .overdue: return model.text("ఆలస్యం", "विलंबित", "தாமதம்", "Overdue")
        case .today: return model.text("ఈరోజు", "आज", "இன்று", "Today")
        case .upcoming: return model.text("ఈ వారం", "इस सप्ताह", "இந்த வாரம்", "This week")
        case .later: return model.text("తర్వాతి దశ", "अगला चरण", "அடுத்த கட்டம்", "Later stage")
        }
    }

    private var urgencyColor: Color {
        switch action.urgency {
        case .overdue: return .red
        case .today: return .orange
        case .upcoming: return .blue
        case .later: return .gray
        }
    }
}

struct WeatherDashboardCard: View {
    @EnvironmentObject private var model: AppModel
    private let calendar = Calendar.current

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(model.text("7 రోజుల వాతావరణం", "7 दिनों का मौसम", "7 நாள் வானிலை", "7-day weather")).font(.title3.bold())
                    Text(model.text("కాజా • సింథటిక్ అంచనా", "काज़ा • सिंथेटिक पूर्वानुमान", "காஜா • செயற்கை முன்னறிவிப்பு", "Kaza • synthetic forecast")).font(.caption).foregroundStyle(.secondary)
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 2) {
                    Text("\(PilotContract.currentTemperatureC)°").font(.system(size: 36, weight: .bold))
                    Text(model.text("మేఘావృతం, జల్లులు", "बादल और बौछारें", "மேகமூட்டம், சாரல்", PilotContract.currentWeatherConditions)).font(.caption).foregroundStyle(.secondary)
                }
            }
            HStack(spacing: 16) {
                Label("\(PilotContract.currentHumidityPct)%", systemImage: "humidity.fill")
                Label("\(PilotContract.currentWindKph) km/h", systemImage: "wind")
                Label("\(PilotContract.currentRainfallMm, specifier: "%.1f") mm", systemImage: "drop.fill")
            }
            .font(.caption.bold()).foregroundStyle(AppTheme.green)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 10) {
                    ForEach(PilotContract.weatherForecast) { day in
                        WeatherDayCard(day: day, date: calendar.date(byAdding: .day, value: day.id, to: Date()) ?? Date())
                    }
                }
            }
        }
        .cardStyle()
    }
}

struct WeatherDayCard: View {
    @EnvironmentObject private var model: AppModel
    let day: WeatherDay
    let date: Date

    private var dayFormatter: DateFormatter {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: model.language.localeIdentifier)
        formatter.dateFormat = "EEE"
        return formatter
    }

    private var dateFormatter: DateFormatter {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: model.language.localeIdentifier)
        formatter.dateFormat = "dd MMM"
        return formatter
    }

    var body: some View {
        VStack(spacing: 6) {
            Text(dayFormatter.string(from: date)).font(.caption.bold())
            Text(dateFormatter.string(from: date)).font(.caption2).foregroundStyle(.secondary)
            Image(systemName: day.symbol).font(.title2).foregroundStyle(day.rainfallMm > 8 ? Color.blue : AppTheme.gold)
            Text("\(day.maximumC)° / \(day.minimumC)°").font(.caption.bold())
            Text("\(day.rainfallMm, specifier: "%.1f") mm").font(.caption2).foregroundStyle(Color.blue)
        }
        .frame(width: 88)
        .padding(.vertical, 10)
        .background(AppTheme.cream)
        .clipShape(RoundedRectangle(cornerRadius: 14))
    }
}

struct FarmerMenuButton: View {
    let icon: String
    let title: String
    let subtitle: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 13) {
                Image(systemName: icon)
                    .frame(width: 36, height: 36)
                    .foregroundStyle(AppTheme.green)
                    .background(AppTheme.leaf.opacity(0.55))
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                VStack(alignment: .leading, spacing: 2) {
                    Text(title).font(.headline).foregroundStyle(AppTheme.darkGreen)
                    Text(subtitle).font(.caption).foregroundStyle(.secondary)
                }
                Spacer()
                Image(systemName: "chevron.right").foregroundStyle(.secondary)
            }
            .padding(.vertical, 4)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

struct CropRow: View {
    @EnvironmentObject private var model: AppModel
    let crop: CropAllocation

    var body: some View {
        VStack(spacing: 7) {
            HStack {
                Text(model.contentText(crop.nameEnglish)).font(.subheadline.bold())
                Spacer()
                Text("\(PilotContract.acresText(crop.acres)) \(model.text("ఎకరాలు", "एकड़", "ஏக்கர்", "acres"))").font(.subheadline)
            }
            ProgressView(
                value: NSDecimalNumber(decimal: crop.acres).doubleValue,
                total: NSDecimalNumber(decimal: PilotContract.totalAcres).doubleValue
            )
                .tint(crop.code == "PADDY" ? AppTheme.green : (crop.code == "CHILLI" ? AppTheme.gold : Color.indigo))
        }
    }
}

enum VerificationBadgeState {
    case pending
    case verified
    case sandboxVerified
    case syntheticActive

    @MainActor
    func title(using model: AppModel) -> String {
        switch self {
        case .pending: return model.text("పెండింగ్", "लंबित", "நிலுவையில்", "Pending")
        case .verified: return model.text("ధృవీకరించబడింది", "सत्यापित", "சரிபார்க்கப்பட்டது", "Verified")
        case .sandboxVerified: return model.text("ధృవీకరించబడింది • శాండ్‌బాక్స్", "सत्यापित • सैंडबॉक्स", "சரிபார்க்கப்பட்டது • சாண்ட்பாக்ஸ்", "Verified • sandbox")
        case .syntheticActive: return model.text("యాక్టివ్ • సింథటిక్", "सक्रिय • सिंथेटिक", "செயலில் • செயற்கை", "Active • synthetic")
        }
    }

    var foreground: Color {
        switch self {
        case .pending: return .orange
        case .verified, .sandboxVerified, .syntheticActive: return AppTheme.green
        }
    }

    var background: Color { foreground.opacity(0.12) }
}

struct VerificationRow: View {
    @EnvironmentObject private var model: AppModel
    let icon: String
    let title: String
    let state: VerificationBadgeState

    var body: some View {
        HStack {
            Image(systemName: icon).frame(width: 24).foregroundStyle(AppTheme.green)
            Text(title)
            Spacer()
            Text(state.title(using: model)).font(.caption.bold()).foregroundStyle(state.foreground)
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
                PageBar(title: model.text("పొలం వివరాలు", "खेत का विवरण", "பண்ணை விவரங்கள்", "Farm details")) { model.screen = .home }
                VStack(alignment: .leading, spacing: 12) {
                    Label("\(PilotContract.acresText(PilotContract.totalAcres)) \(model.text("ఎకరాల సింథటిక్ స్నాప్‌షాట్", "एकड़ का सिंथेटिक स्नैपशॉट", "ஏக்கர் செயற்கை நிலைப்படம்", "acre synthetic snapshot"))", systemImage: "map.fill")
                        .font(.title3.bold())
                    Text("\(model.contentText(PilotContract.pilotDistrict)) • \(model.contentText(PilotContract.pilotState))")
                        .foregroundStyle(.secondary)
                    Text("\(model.text("గ్రామ కోడ్", "गाँव कोड", "கிராமக் குறியீடு", "Village code")): \(PilotContract.pilotVillageCode) • \(model.text("మండలం: నమోదు కాలేదు", "मंडल: दर्ज नहीं", "மண்டலம்: பதிவு செய்யப்படவில்லை", "Mandal: not recorded"))")
                        .font(.footnote).foregroundStyle(.secondary)
                    Divider()
                    ForEach(PilotContract.crops) { crop in
                        VStack(alignment: .leading, spacing: 4) {
                            HStack {
                                Text(model.contentText(crop.parcelName)).font(.headline)
                                Spacer()
                                Text("\(PilotContract.acresText(crop.acres)) \(model.text("ఎకరాలు", "एकड़", "ஏக்கர்", "acres"))").font(.subheadline.bold())
                            }
                            Text("\(model.contentText(crop.nameEnglish)) • \(crop.plotReference)")
                                .font(.subheadline).foregroundStyle(.secondary)
                            Text("\(model.text("కేంద్ర బిందువు", "केंद्र बिंदु", "மையப்புள்ளி", "Centroid")): \(crop.centroid)")
                                .font(.caption).foregroundStyle(.secondary)
                        }
                        if crop.id != PilotContract.crops.last?.id { Divider() }
                    }
                    Divider()
                    Text("\(model.text("నీటిపారుదల", "सिंचाई", "பாசனம்", "Irrigation")): \(model.contentText(PilotContract.irrigation)) • \(model.text("యాజమాన్యం", "स्वामित्व", "உரிமை", "Ownership")): \(model.contentText(PilotContract.ownership))")
                        .font(.footnote).foregroundStyle(.secondary)
                    Text("FPO: \(model.contentText(PilotContract.pilotFPO)) • \(PilotContract.pilotMembershipNumber)")
                        .font(.footnote).foregroundStyle(.secondary)
                    Divider()
                    Text(model.text("గ్రామం / క్లస్టర్ (డ్రాఫ్ట్)", "गाँव / क्लस्टर (ड्राफ्ट)", "கிராமம் / குழுமம் (வரைவு)", "Village / cluster (draft)")).font(.headline)
                    TextField(model.text("గ్రామం పేరు", "गाँव का नाम", "கிராமப் பெயர்", "Village name"), text: $model.villageDraft)
                        .padding(14).background(.white).clipShape(RoundedRectangle(cornerRadius: 12))
                    Text(model.text("ఫీల్డ్ నోట్ (డ్రాఫ్ట్)", "खेत नोट (ड्राफ्ट)", "புலக் குறிப்பு (வரைவு)", "Field note (draft)")).font(.headline)
                    TextField(model.text("పంట లేదా పొలం గురించి గమనిక", "फसल या खेत का नोट", "பயிர் அல்லது பண்ணை குறிப்பு", "Crop or farm note"), text: $model.farmNoteDraft, axis: .vertical)
                        .lineLimit(3...6)
                        .padding(14).background(.white).clipShape(RoundedRectangle(cornerRadius: 12))
                    if let message = model.draftSavedMessage {
                        Label(message, systemImage: "checkmark.circle.fill")
                            .font(.footnote).foregroundStyle(AppTheme.green)
                    }
                    PrimaryButton(title: model.text("ఆఫ్‌లైన్ డ్రాఫ్ట్ సేవ్ చేయండి", "ऑफ़लाइन ड्राफ्ट सहेजें", "இணையமற்ற வரைவைச் சேமிக்கவும்", "Save offline draft"), action: model.saveFarmDraft)
                }
                .cardStyle()
                VStack(alignment: .leading, spacing: 8) {
                    Label(model.text("భూమి హక్కు ధృవీకరణ పెండింగ్", "भूमि अधिकार सत्यापन लंबित", "நில உரிமை சரிபார்ப்பு நிலுவையில்", "Land-right verification pending"), systemImage: "clock.badge.exclamationmark")
                        .font(.headline).foregroundStyle(Color.orange)
                    Text(model.text("డ్రాఫ్ట్‌ను సేవ్ చేయడం అధికారిక భూమి రికార్డు లేదా యాజమాన్య నిర్ణయం కాదు.", "ड्राफ्ट सहेजना आधिकारिक भूमि रिकॉर्ड या स्वामित्व निर्णय नहीं है।", "வரைவைச் சேமிப்பது அதிகாரப்பூர்வ நிலப் பதிவு அல்லது உரிமை முடிவு அல்ல.", "Saving a draft is not an official land record or ownership decision."))
                        .font(.footnote).foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .cardStyle()
            }
            .padding(22)
        }
    }
}

struct MoreView: View {
    @EnvironmentObject private var model: AppModel
    private let columns = [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                HStack(spacing: 12) {
                    Image(systemName: "person.crop.circle.fill")
                        .font(.system(size: 46)).foregroundStyle(AppTheme.green)
                    VStack(alignment: .leading, spacing: 3) {
                        Text(model.farmerName).font(.title3.bold()).foregroundStyle(AppTheme.darkGreen)
                        Text(model.text("రైతు కార్యస్థలం • సింథటిక్", "किसान कार्यक्षेत्र • सिंथेटिक", "விவசாயி பணியிடம் • செயற்கை", "Farmer workspace • synthetic")).font(.caption).foregroundStyle(.secondary)
                    }
                }
                .cardStyle()

                Text(model.text("అన్ని సేవలు", "सभी सेवाएँ", "அனைத்து சேவைகள்", "All services")).font(.title2.bold()).foregroundStyle(AppTheme.darkGreen)
                LazyVGrid(columns: columns, spacing: 12) {
                    MoreServiceTile(icon: "person.text.rectangle", title: model.text("ప్రొఫైల్", "प्रोफ़ाइल", "சுயவிவரம்", "Profile"), subtitle: model.text("వివరాలు, భాష", "विवरण, भाषा", "விவரங்கள், மொழி", "Details, language")) { model.screen = .profile }
                    MoreServiceTile(icon: "checklist", title: model.text("ఆన్‌బోర్డింగ్", "ऑनबोर्डिंग", "சேர்க்கை", "Onboarding"), subtitle: model.text("దరఖాస్తు స్థితి", "आवेदन स्थिति", "விண்ணப்ப நிலை", "Application status")) { model.screen = .onboarding }
                    MoreServiceTile(icon: "clock.arrow.circlepath", title: model.text("పొలం చరిత్ర", "खेत इतिहास", "பண்ணை வரலாறு", "Farm history"), subtitle: model.text("గత పంటలు", "पिछली फसलें", "முந்தைய பயிர்கள்", "Past crops")) { model.screen = .farmHistory }
                    MoreServiceTile(icon: "cross.case.fill", title: model.text("ఇన్‌పుట్స్", "इनपुट", "இடுபொருட்கள்", "Inputs"), subtitle: model.text("పంట రక్షణ", "फसल सुरक्षा", "பயிர் பாதுகாப்பு", "Protection")) { model.screen = .inputs }
                    MoreServiceTile(icon: "leaf.fill", title: model.text("నేల సంరక్షణ", "मृदा देखभाल", "மண் பராமரிப்பு", "Soil care"), subtitle: model.text("నేల పద్ధతులు", "मृदा अभ्यास", "மண் முறைகள்", "Soil practices")) { model.screen = .soilCare }
                    MoreServiceTile(icon: "doc.text.magnifyingglass", title: model.text("పథకాలు", "योजनाएँ", "திட்டங்கள்", "Schemes"), subtitle: model.text("అర్హత, స్థితి", "पात्रता, स्थिति", "தகுதி, நிலை", "Eligibility, status")) { model.screen = .schemes }
                    MoreServiceTile(icon: "storefront.fill", title: model.text("మార్కెట్", "बाज़ार", "சந்தை", "Marketplace"), subtitle: model.text("కొనుగోలు, అమ్మకం", "खरीद और बिक्री", "வாங்கல், விற்பனை", "Buy and sell")) { model.screen = .marketplace }
                    MoreServiceTile(icon: "hand.raised.fill", title: model.text("అనుమతి", "सहमति", "ஒப்புதல்", "Consent"), subtitle: model.text("గోప్యత నియంత్రణలు", "गोपनीयता नियंत्रण", "தனியுரிமை கட்டுப்பாடுகள்", "Privacy controls")) { model.screen = .consentCenter }
                }
                Text(model.text("ప్రధాన విభాగాలు ఎప్పుడూ కిందనున్న నావిగేషన్ నుంచి ఒకే ట్యాప్‌లో అందుబాటులో ఉంటాయి.", "मुख्य भाग नीचे की नेविगेशन से एक टैप में उपलब्ध हैं।", "முக்கிய பகுதிகள் கீழ் வழிசெலுத்தலில் ஒரே தொடுதலில் கிடைக்கும்.", "Main sections are always one tap away in the bottom navigation."))
                    .font(.footnote).foregroundStyle(.secondary)
            }
            .padding(.horizontal, 18)
            .padding(.top, 18)
            .padding(.bottom, 10)
        }
    }
}

struct MoreServiceTile: View {
    let icon: String
    let title: String
    let subtitle: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 8) {
                Image(systemName: icon)
                    .font(.title3).foregroundStyle(AppTheme.green)
                    .frame(width: 38, height: 38)
                    .background(AppTheme.leaf.opacity(0.5))
                    .clipShape(RoundedRectangle(cornerRadius: 11))
                Text(title).font(.headline).foregroundStyle(AppTheme.darkGreen)
                Text(subtitle).font(.caption).foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity, minHeight: 108, alignment: .leading)
            .padding(14)
            .background(.white)
            .clipShape(RoundedRectangle(cornerRadius: 17))
            .overlay(RoundedRectangle(cornerRadius: 17).stroke(Color.black.opacity(0.06)))
        }
        .buttonStyle(.plain)
    }
}

struct OnboardingView: View {
    @EnvironmentObject private var model: AppModel

    var body: some View {
        SnapshotListView(
            title: model.text("నా ఆన్‌బోర్డింగ్", "मेरा ऑनबोर्डिंग", "என் சேர்க்கை", "My onboarding"),
            subtitle: model.text("వెబ్‌లో ఉన్న పాత్ర దరఖాస్తులు మరియు ప్రస్తుత స్థితి.", "वेब पर भूमिका आवेदन और उनकी वर्तमान स्थिति।", "வலையில் உள்ள பங்கு விண்ணப்பங்களும் தற்போதைய நிலையும்.", "Role applications and their current web status."),
            items: PilotContract.onboardingApplications,
            footer: model.text("ఆరు దరఖాస్తులు డ్రాఫ్ట్‌లో ఉన్నాయి; ఏదీ సమర్పించబడలేదు.", "छह आवेदन ड्राफ्ट में हैं; कोई जमा नहीं हुआ।", "ஆறு விண்ணப்பங்கள் வரைவில் உள்ளன; எதுவும் சமர்ப்பிக்கப்படவில்லை.", "Six applications are in draft; none has been submitted."),
            back: { model.screen = .home }
        )
    }
}

private enum FarmHistorySection: String, CaseIterable, Identifiable {
    case overview, fiveYears, area, nextSeason, insurance, services

    var id: String { rawValue }

    @MainActor
    func title(using model: AppModel) -> String {
        switch self {
        case .overview: return model.text("నిర్వహణ కేంద్రం", "कमांड सेंटर", "கட்டுப்பாட்டு மையம்", "Command centre")
        case .fiveYears: return model.text("నా 5 ఏళ్ల చరిత్ర", "मेरा 5-वर्ष इतिहास", "என் 5 ஆண்டு வரலாறு", "My 5-year history")
        case .area: return model.text("నా ప్రాంత పంటలు", "मेरे क्षेत्र की फसलें", "என் பகுதி பயிர்கள்", "What my area grows")
        case .nextSeason: return model.text("తదుపరి సీజన్", "अगला सीज़न", "அடுத்த பருவம்", "Next season plan")
        case .insurance: return model.text("బీమా", "बीमा", "காப்பீடு", "Insurance corner")
        case .services: return model.text("సమీప సేవలు", "नज़दीकी सेवाएँ", "அருகிலுள்ள சேவைகள்", "Services near me")
        }
    }
}

struct FarmHistoryView: View {
    @EnvironmentObject private var model: AppModel
    @State private var selectedSection: FarmHistorySection = .overview

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                PageBar(title: model.text("పొలం చరిత్ర", "खेत इतिहास", "பண்ணை வரலாறு", "Farm history")) { model.screen = .home }
                PageIntro(
                    eyebrow: model.text("B2A · నా పొలం చరిత్ర", "B2A · मेरा खेत इतिहास", "B2A · என் பண்ணை வரலாறு", "B2A · MY FARM HISTORY"),
                    title: model.text("నా పొలం రికార్డులు", "मेरे खेत के रिकॉर्ड", "என் பண்ணைப் பதிவுகள்", "My farm records"),
                    subtitle: model.text("సారాంశం, ఐదేళ్ల పంటలు, ప్రాంత పోలిక, ప్రణాళిక, బీమా మరియు సేవలను విభాగం వారీగా చూడండి.", "सारांश, पाँच वर्षों की फसलें, क्षेत्र तुलना, योजना, बीमा और सेवाएँ अलग-अलग देखें।", "சுருக்கம், ஐந்தாண்டுப் பயிர்கள், பகுதி ஒப்பீடு, திட்டம், காப்பீடு மற்றும் சேவைகளைப் பிரிவாகப் பார்க்கவும்.", "Explore the summary, five-year crops, area comparison, plan, insurance and services by section.")
                )
                farmHistoryPicker
                farmHistoryContent
                SourceDisclosure(text: model.text("ఈ విభాగంలోని రైతు మరియు ప్రాంత డేటా సింథటిక్ పైలట్ స్నాప్‌షాట్. ఇది ప్రభుత్వ రికార్డు కాదు.", "इस भाग का किसान और क्षेत्र डेटा सिंथेटिक पायलट स्नैपशॉट है; यह सरकारी रिकॉर्ड नहीं है।", "இந்தப் பிரிவின் விவசாயி மற்றும் பகுதி தரவு செயற்கை முன்னோட்ட நிலைப்படம்; இது அரசு பதிவு அல்ல.", "Farmer and area data in this section is a synthetic pilot snapshot, not a government record."))
            }
            .padding(22)
        }
    }

    private var farmHistoryPicker: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(FarmHistorySection.allCases) { section in
                    SectionPill(title: section.title(using: model), selected: selectedSection == section) {
                        withAnimation(.easeInOut(duration: 0.18)) { selectedSection = section }
                    }
                }
            }
        }
        .accessibilityIdentifier("farmHistorySubmenu")
    }

    @ViewBuilder
    private var farmHistoryContent: some View {
        switch selectedSection {
        case .overview:
            historyOverview
        case .fiveYears:
            historyRecords
        case .area:
            snapshotGroup(
                title: model.text("నా ప్రాంతం ఏమి పండిస్తుంది", "मेरा क्षेत्र क्या उगाता है", "என் பகுதி என்ன பயிரிடுகிறது", "What my area grows"),
                subtitle: model.text("గుంటూరు జిల్లా సింథటిక్ బేస్‌లైన్‌తో రైతు దిగుబడి పోలిక.", "गुंटूर जिला सिंथेटिक बेसलाइन से किसान उपज की तुलना।", "குண்டூர் மாவட்ட செயற்கை அடிப்படையுடன் விவசாயி விளைச்சல் ஒப்பீடு.", "Farmer yield compared with a synthetic Guntur district baseline."),
                items: PilotContract.areaCropComparison
            )
        case .nextSeason:
            snapshotGroup(
                title: model.text("తదుపరి సీజన్ ప్రణాళిక", "अगले सीज़न की योजना", "அடுத்த பருவத் திட்டம்", "Next season plan"),
                subtitle: model.text("రైతు నిర్ధారణకు ముందు సిద్ధత మరియు లోపాలను చూడండి.", "किसान की पुष्टि से पहले तैयारी और कमियाँ देखें।", "விவசாயி உறுதிப்படுத்துவதற்கு முன் தயார்நிலை மற்றும் குறைகளைப் பார்க்கவும்.", "Review readiness and gaps before farmer confirmation."),
                items: PilotContract.nextSeasonPlan
            )
        case .insurance:
            insuranceHistory
        case .services:
            NearbyFacilitiesContent(
                title: model.text("నా దగ్గర సేవలు", "मेरे पास सेवाएँ", "எனக்கு அருகிலுள்ள சேவைகள்", "Services near me"),
                subtitle: model.text("కనుగొనడానికి మాత్రమే; బుకింగ్ లేదా చెల్లింపు కాదు.", "केवल खोज के लिए; बुकिंग या भुगतान नहीं।", "கண்டறிதலுக்கு மட்டும்; முன்பதிவு அல்லது கட்டணம் அல்ல.", "Discovery only; this is not booking or payment.")
            )
        }
    }

    private var historyOverview: some View {
        VStack(spacing: 12) {
            HStack(spacing: 10) {
                CompactMetric(value: model.contentText("18.20 ac"), label: model.text("మొత్తం విస్తీర్ణం", "कुल क्षेत्र", "மொத்த பரப்பு", "Total extent"), icon: "map.fill")
                CompactMetric(value: "5", label: model.text("ఏళ్లు", "वर्ष", "ஆண்டுகள்", "Years covered"), icon: "calendar")
            }
            HStack(spacing: 10) {
                CompactMetric(value: "2025", label: model.text("ఉత్తమ సంవత్సరం", "सर्वश्रेष्ठ वर्ष", "சிறந்த ஆண்டு", "Best year"), icon: "star.fill")
                CompactMetric(value: "10", label: model.text("పంట రికార్డులు", "फसल रिकॉर्ड", "பயிர் பதிவுகள்", "Crop records"), icon: "list.bullet.rectangle")
            }
            VStack(alignment: .leading, spacing: 12) {
                Text(model.text("ఏడాది సారాంశం", "वर्ष सारांश", "ஆண்டு சுருக்கம்", "Year summary")).font(.title3.bold())
                ForEach(PilotContract.historyYearSummaries) { year in
                    VStack(alignment: .leading, spacing: 7) {
                        HStack {
                            Text(String(year.id)).font(.headline).foregroundStyle(AppTheme.green)
                            Spacer()
                            Text(model.contentText(year.crops)).font(.subheadline.bold())
                        }
                        HStack {
                            HistoryMetric(label: model.text("ఎకరాలు", "एकड़", "ஏக்கர்", "Acres"), value: model.contentText(year.acres))
                            HistoryMetric(label: model.text("నికర/ఎకరం", "शुद्ध/एकड़", "நிகர/ஏக்கர்", "Net/acre"), value: year.netPerAcre)
                        }
                        Text(model.text("ఖర్చు", "लागत", "செலவு", "Cost") + " " + year.cost + " • " + model.text("ఆదాయం", "आय", "வருவாய்", "Revenue") + " " + year.revenue)
                            .font(.caption).foregroundStyle(.secondary)
                    }
                    if year.id != PilotContract.historyYearSummaries.last?.id { Divider() }
                }
            }
            .cardStyle()
        }
    }

    private var historyRecords: some View {
        VStack(spacing: 12) {
            ForEach(PilotContract.farmHistory) { item in
                VStack(alignment: .leading, spacing: 9) {
                    HStack(alignment: .firstTextBaseline) {
                        VStack(alignment: .leading, spacing: 3) {
                            Text(model.contentText(item.season)).font(.caption.bold()).foregroundStyle(AppTheme.green)
                            Text(model.contentText(item.crop)).font(.title3.bold())
                        }
                        Spacer()
                        Text(model.contentText(item.acres)).font(.subheadline.bold())
                    }
                    HStack {
                        HistoryMetric(label: model.text("ఖర్చు", "लागत", "செலவு", "Cost"), value: item.cost)
                        HistoryMetric(label: model.text("దిగుబడి", "उपज", "விளைச்சல்", "Yield"), value: model.contentText(item.yield))
                    }
                    HStack {
                        HistoryMetric(label: model.text("ధర", "मूल्य", "விலை", "Price"), value: model.contentText(item.price))
                        HistoryMetric(label: model.text("ఆదాయం", "आय", "வருவாய்", "Revenue"), value: item.revenue)
                    }
                    Text(model.contentText(item.note)).font(.footnote).foregroundStyle(.secondary)
                }
                .cardStyle()
            }
        }
    }

    private var insuranceHistory: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(model.text("బీమా మూల", "बीमा कॉर्नर", "காப்பீட்டு பகுதி", "Insurance corner")).font(.title3.bold())
            ForEach(PilotContract.insuranceSnapshots) { item in
                SnapshotRow(item: item)
                if item.id != PilotContract.insuranceSnapshots.last?.id { Divider() }
            }
            Divider()
            Text(model.text("2026 సూచన", "2026 संकेत", "2026 குறிப்பு", "2026 indication")).font(.headline)
            Text(model.text("8.40 ఎకరాల వరికి అంచనా బీమా మొత్తం ₹3,78,000; రైతు వాటా ₹7,560.", "8.40 एकड़ धान के लिए अनुमानित बीमित राशि ₹3,78,000; किसान हिस्सा ₹7,560।", "8.40 ஏக்கர் நெல்லுக்கான மதிப்பிடப்பட்ட காப்பீடு ₹3,78,000; விவசாயி பங்கு ₹7,560.", "For 8.40 acres of paddy: indicative sum insured ₹3,78,000; farmer share ₹7,560."))
                .font(.subheadline)
            Text(model.text("అధీకృత బీమా డెస్క్ వద్ద నోటిఫైడ్ పంట, తేదీలు మరియు ప్రీమియంను నిర్ధారించండి.", "अधिकृत बीमा डेस्क पर अधिसूचित फसल, तारीख और प्रीमियम की पुष्टि करें।", "அங்கீகரிக்கப்பட்ட காப்பீட்டு மையத்தில் அறிவிக்கப்பட்ட பயிர், தேதி மற்றும் பிரீமியத்தை உறுதிப்படுத்தவும்.", "Confirm the notified crop, dates and premium with an authorised insurance desk."))
                .font(.caption).foregroundStyle(.secondary)
        }
        .cardStyle()
    }

    private func snapshotGroup(title: String, subtitle: String, items: [SnapshotItem]) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title).font(.title3.bold())
            Text(subtitle).font(.subheadline).foregroundStyle(.secondary)
            Divider()
            ForEach(items) { item in
                SnapshotRow(item: item)
                if item.id != items.last?.id { Divider() }
            }
        }
        .cardStyle()
    }
}

struct HistoryMetric: View {
    let label: String
    let value: String

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label).font(.caption).foregroundStyle(.secondary)
            Text(value).font(.subheadline.bold()).foregroundStyle(AppTheme.darkGreen)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private enum IntelligenceSection: String, CaseIterable, Identifiable {
    case location, weather, soil, cropPlanning, market, valueAdd, outcome, nearby

    var id: String { rawValue }

    @MainActor
    func title(using model: AppModel) -> String {
        switch self {
        case .location: return model.text("స్థానం & సీజన్", "स्थान और सीज़न", "இடம் & பருவம்", "Location & season")
        case .weather: return model.text("వాతావరణం", "मौसम", "வானிலை", "Weather")
        case .soil: return model.text("నేల", "मिट्टी", "மண்", "Soil")
        case .cropPlanning: return model.text("పంట ప్రణాళిక", "फसल योजना", "பயிர்த் திட்டம்", "Crop planning")
        case .market: return model.text("మార్కెట్", "बाज़ार", "சந்தை", "Market")
        case .valueAdd: return model.text("విలువ జోడింపు", "मूल्य-वर्धन", "மதிப்பூட்டல்", "Value-add")
        case .outcome: return model.text("ఫలిత ప్రణాళిక", "परिणाम योजना", "விளைவு திட்டம்", "Outcome planner")
        case .nearby: return model.text("సమీప సహాయం", "नज़दीकी मदद", "அருகிலுள்ள உதவி", "Nearby & help")
        }
    }
}

struct IntelligenceView: View {
    @EnvironmentObject private var model: AppModel
    @State private var selectedSection: IntelligenceSection = .location
    @State private var selectedParcelID = PilotContract.crops.first?.id ?? "PADDY"

    private var selectedParcel: CropAllocation {
        PilotContract.crops.first(where: { $0.id == selectedParcelID }) ?? PilotContract.crops[0]
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                PageBar(title: model.text("పొలం సమాచారం", "खेत की जानकारी", "பண்ணை தகவல்", "Farm intelligence")) { model.screen = .home }
                PageIntro(
                    eyebrow: model.text("B2A · నా పొలం సమాచారం", "B2A · मेरे खेत की जानकारी", "B2A · என் பண்ணை தகவல்", "B2A · MY FARM INTELLIGENCE"),
                    title: model.text("మీ పొలం గురించి ఒకే చోట", "आपके खेत की जानकारी एक जगह", "உங்கள் பண்ணை பற்றி ஒரே இடத்தில்", "Everything about your farm, in one place"),
                    subtitle: model.text("విభాగాన్ని ఎంచుకుని స్థానం, వాతావరణం, నేల, పంట, మార్కెట్ మరియు సహాయ డేటాను చూడండి.", "स्थान, मौसम, मिट्टी, फसल, बाज़ार और सहायता डेटा देखने के लिए भाग चुनें।", "இடம், வானிலை, மண், பயிர், சந்தை மற்றும் உதவித் தரவைப் பார்க்கப் பிரிவைத் தேர்ந்தெடுக்கவும்.", "Choose a section to view location, weather, soil, crop, market and help data.")
                )
                intelligencePicker
                parcelPicker
                intelligenceContent
                SourceDisclosure(text: model.text("OBSERVED, FORECAST లేదా DERIVED లేబుళ్లను చూడండి. పైలట్ డేటా సింథటిక్; స్థానిక నిపుణుడి నిర్ణయానికి ప్రత్యామ్నాయం కాదు.", "OBSERVED, FORECAST या DERIVED लेबल देखें। पायलट डेटा सिंथेटिक है और स्थानीय विशेषज्ञ के निर्णय का विकल्प नहीं है।", "OBSERVED, FORECAST அல்லது DERIVED குறிச்சொற்களைப் பார்க்கவும். முன்னோட்டத் தரவு செயற்கையானது; உள்ளூர் நிபுணரின் முடிவுக்கு மாற்றல்ல.", "Check the OBSERVED, FORECAST or DERIVED label. Pilot data is synthetic and does not replace a local expert decision."))
            }
            .padding(22)
        }
    }

    private var intelligencePicker: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(IntelligenceSection.allCases) { section in
                    SectionPill(title: section.title(using: model), selected: selectedSection == section) {
                        withAnimation(.easeInOut(duration: 0.18)) { selectedSection = section }
                    }
                }
            }
        }
        .accessibilityIdentifier("intelligenceSubmenu")
    }

    private var parcelPicker: some View {
        VStack(alignment: .leading, spacing: 7) {
            Text(model.text("పార్సెల్", "पार्सल", "நிலத்துண்டு", "Parcel")).font(.caption.bold()).foregroundStyle(.secondary)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(PilotContract.crops) { crop in
                        SectionPill(title: "\(model.contentText(crop.nameEnglish)) · \(crop.plotReference)", selected: selectedParcelID == crop.id) {
                            selectedParcelID = crop.id
                        }
                    }
                }
            }
        }
    }

    @ViewBuilder
    private var intelligenceContent: some View {
        switch selectedSection {
        case .location:
            locationContent
        case .weather:
            weatherContent
        case .soil:
            snapshotGroup(title: model.text("నేల స్థితి", "मिट्टी की स्थिति", "மண் நிலை", "Soil status"), items: PilotContract.soilSnapshot)
        case .cropPlanning:
            snapshotGroup(title: model.text("పంట అనుకూలత", "फसल उपयुक्तता", "பயிர் பொருத்தம்", "Crop suitability"), items: PilotContract.cropPlanningSnapshot)
        case .market:
            marketContent
        case .valueAdd:
            valueAddContent
        case .outcome:
            outcomeContent
        case .nearby:
            NearbyFacilitiesContent(
                title: model.text("సమీపంలో & సహాయం", "आस-पास और मदद", "அருகில் & உதவி", "Nearby & help"),
                subtitle: model.text("నేల పరీక్ష, విస్తరణ, యంత్రాలు మరియు లాజిస్టిక్స్ కోసం సింథటిక్ డైరెక్టరీ.", "मिट्टी जाँच, विस्तार, मशीनरी और लॉजिस्टिक्स की सिंथेटिक डायरेक्टरी।", "மண் சோதனை, விரிவாக்கம், இயந்திரங்கள் மற்றும் போக்குவரத்துக்கான செயற்கை அடைவு.", "Synthetic directory for soil testing, extension, machinery and logistics.")
            )
        }
    }

    private var locationContent: some View {
        VStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 10) {
                Text(model.text("ఎంచుకున్న పొలం", "चुना हुआ खेत", "தேர்ந்தெடுத்த பண்ணை", "Selected parcel")).font(.title3.bold())
                DetailRow(label: model.text("పార్సెల్", "पार्सल", "நிலத்துண்டு", "Parcel"), value: model.contentText(selectedParcel.parcelName))
                DetailRow(label: model.text("పంట / విస్తీర్ణం", "फसल / क्षेत्र", "பயிர் / பரப்பு", "Crop / extent"), value: model.contentText("\(selectedParcel.nameEnglish) • \(PilotContract.acresText(selectedParcel.acres)) ac"))
                DetailRow(label: model.text("ప్లాట్ సూచన", "प्लॉट संदर्भ", "நிலக் குறிப்பு", "Plot reference"), value: selectedParcel.plotReference)
                DetailRow(label: model.text("కేంద్ర బిందువు", "केंद्र बिंदु", "மையப்புள்ளி", "Centroid"), value: selectedParcel.centroid)
            }
            .cardStyle()
            snapshotGroup(title: model.text("పరిష్కరించిన స్థానం", "निर्धारित स्थान", "தீர்மானிக்கப்பட்ட இடம்", "Resolved location"), items: PilotContract.locationDetails.filter { $0.id != "centroid" })
            snapshotGroup(title: model.text("సీజన్ ఆధారం", "सीज़न आधार", "பருவ அடிப்படை", "Season basis"), items: PilotContract.seasonDetails)
        }
    }

    private var weatherContent: some View {
        VStack(spacing: 12) {
            WeatherDashboardCard()
            VStack(alignment: .leading, spacing: 10) {
                Label(model.text("పొలం సూచనలు", "खेत सलाह", "பண்ணை ஆலோசனைகள்", "Field advisories"), systemImage: "exclamationmark.triangle.fill")
                    .font(.title3.bold()).foregroundStyle(AppTheme.darkGreen)
                AdvisoryRow(text: model.text("ఇటీవలి వర్షం నమోదైంది—నీటిపారుదలను ఆపి డ్రైనేజీని తనిఖీ చేయండి.", "हाल की वर्षा दर्ज हुई—सिंचाई रोकें और जल निकासी जाँचें।", "சமீப மழை பதிவானது—பாசனத்தை நிறுத்தி வடிகாலைச் சரிபார்க்கவும்.", "Recent rainfall recorded—hold irrigation and check drainage."))
                AdvisoryRow(text: model.text("భారీ వర్షం సంభవించవచ్చు; కోత లేదా స్ప్రే పనులను స్థానిక సూచనతో ప్లాన్ చేయండి.", "भारी वर्षा संभव है; कटाई या छिड़काव स्थानीय सलाह से तय करें।", "கனமழை வாய்ப்பு உள்ளது; அறுவடை அல்லது தெளிப்பை உள்ளூர் ஆலோசனையுடன் திட்டமிடவும்.", "Heavy rain is possible; plan harvest or spraying with local advice."))
                AdvisoryRow(text: model.text("38°C పైగా వేడి ఒత్తిడి ఉండవచ్చు; ఉదయం పొలం పరిశీలించండి.", "38°C से ऊपर गर्मी का तनाव हो सकता है; सुबह खेत देखें।", "38°C மேல் வெப்ப அழுத்தம் இருக்கலாம்; காலையில் வயலைப் பார்வையிடவும்.", "Heat stress is possible above 38°C; inspect the field in the morning."))
                Text(model.text("జిల్లా/బ్లాక్ స్థాయి సింథటిక్ అంచనా—KVK లేదా విస్తరణ కేంద్రంతో నిర్ధారించండి.", "जिला/ब्लॉक स्तर का सिंथेटिक पूर्वानुमान—KVK या विस्तार केंद्र से पुष्टि करें।", "மாவட்ட/வட்டார செயற்கை முன்னறிவிப்பு—KVK அல்லது விரிவாக்க மையத்துடன் உறுதிப்படுத்தவும்.", "District/block-level synthetic forecast—confirm with the KVK or extension centre."))
                    .font(.caption).foregroundStyle(.secondary)
            }
            .cardStyle()
        }
    }

    private var marketContent: some View {
        VStack(spacing: 12) {
            ForEach(PilotContract.marketQuotes) { quote in
                VStack(alignment: .leading, spacing: 10) {
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(model.contentText(quote.crop)).font(.title3.bold())
                            Text("\(model.contentText(quote.variety)) • \(model.contentText(quote.grade))").font(.caption).foregroundStyle(.secondary)
                        }
                        Spacer()
                        DataBadge(text: model.contentText("OBSERVED"), color: AppTheme.green)
                    }
                    HStack {
                        HistoryMetric(label: model.text("కనిష్టం", "न्यूनतम", "குறைந்தபட்சம்", "Minimum"), value: model.contentText(quote.minimumPrice))
                        HistoryMetric(label: model.text("మోడల్", "मॉडल", "மாதிரி", "Modal"), value: model.contentText(quote.modalPrice))
                    }
                    HStack {
                        HistoryMetric(label: model.text("గరిష్టం", "अधिकतम", "அதிகபட்சம்", "Maximum"), value: model.contentText(quote.maximumPrice))
                        HistoryMetric(label: model.text("రాకలు", "आवक", "வரத்து", "Arrivals"), value: model.contentText(quote.arrivals))
                    }
                    Text(model.text("గుంటూరు మార్కెట్ • 17-08-2026 • మూలం: \(quote.source)", "गुंटूर मंडी • 17-08-2026 • स्रोत: \(quote.source)", "குண்டூர் சந்தை • 17-08-2026 • மூலம்: \(quote.source)", "Guntur Mandi • 17-08-2026 • source: \(quote.source)")).font(.caption).foregroundStyle(.secondary)
                }
                .cardStyle()
            }
        }
    }

    private var valueAddContent: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text(model.text("వరి ప్రాసెసింగ్ మార్గం", "धान प्रसंस्करण मार्ग", "நெல் செயலாக்கப் பாதை", "Paddy processing path")).font(.title3.bold())
                Spacer()
                DataBadge(text: model.contentText("DERIVED"), color: AppTheme.gold)
            }
            ForEach(PilotContract.valueAddSteps) { step in
                HStack(alignment: .top, spacing: 12) {
                    Text(String(step.id)).font(.headline).foregroundStyle(.white)
                        .frame(width: 32, height: 32).background(AppTheme.green).clipShape(Circle())
                    VStack(alignment: .leading, spacing: 5) {
                        Text("\(model.contentText(step.input)) → \(model.contentText(step.output))").font(.headline)
                        Text("\(model.text("రికవరీ", "रिकवरी", "மீட்பு", "Recovery")) \(step.recovery) • \(model.text("ఖర్చు", "लागत", "செலவு", "Cost")) \(model.contentText(step.processingCost))")
                            .font(.subheadline)
                        Text(model.contentText(step.byProducts)).font(.caption).foregroundStyle(.secondary)
                    }
                }
                if step.id != PilotContract.valueAddSteps.last?.id { Divider() }
            }
            Text(model.text("రికవరీ, ఖర్చు మరియు ఉప ఉత్పత్తి ధరలు సన్నివేశ అనుమానాలు; ప్రాసెసర్‌తో ధృవీకరించండి.", "रिकवरी, लागत और उप-उत्पाद मूल्य परिदृश्य मान्यताएँ हैं; प्रोसेसर से पुष्टि करें।", "மீட்பு, செலவு மற்றும் துணைத் தயாரிப்பு விலைகள் நிலைமைக் கணிப்புகள்; செயலாக்குநருடன் உறுதிப்படுத்தவும்.", "Recovery, cost and by-product prices are scenario assumptions; confirm with a processor."))
                .font(.caption).foregroundStyle(.secondary)
        }
        .cardStyle()
    }

    private var outcomeContent: some View {
        VStack(spacing: 12) {
            ForEach(PilotContract.outcomeScenarios) { scenario in
                VStack(alignment: .leading, spacing: 9) {
                    HStack {
                        Text(model.contentText("\(scenario.label) · Paddy 8.40 ac")).font(.title3.bold())
                        Spacer()
                        DataBadge(text: model.contentText("DERIVED"), color: AppTheme.gold)
                    }
                    HStack {
                        HistoryMetric(label: model.text("దిగుబడి", "उपज", "விளைச்சல்", "Yield"), value: model.contentText(scenario.yield))
                        HistoryMetric(label: model.text("అమ్మకం ధర", "बिक्री मूल्य", "விற்பனை விலை", "Selling price"), value: model.contentText(scenario.sellingPrice))
                    }
                    HStack {
                        HistoryMetric(label: model.text("మొత్తం ఖర్చు", "कुल लागत", "மொத்த செலவு", "Total cost"), value: scenario.totalCost)
                        HistoryMetric(label: model.text("స్థూల ఆదాయం", "सकल आय", "மொத்த வருவாய்", "Gross income"), value: scenario.grossIncome)
                    }
                    HStack {
                        HistoryMetric(label: model.text("నికర ఆదాయం", "शुद्ध आय", "நிகர வருவாய்", "Net income"), value: scenario.netIncome)
                        HistoryMetric(label: model.text("బ్రేక్-ఈవెన్", "ब्रेक-ईवन", "சமநிலை", "Break-even"), value: model.contentText(scenario.breakEven))
                    }
                }
                .cardStyle()
            }
            Text(model.text("ఇవి హామీలు కావు. వాస్తవ ఖర్చులు, దిగుబడి, మార్కెట్ ధర మరియు రైతు నిర్ణయాన్ని ఉపయోగించండి.", "ये गारंटी नहीं हैं। वास्तविक लागत, उपज, बाज़ार मूल्य और किसान के निर्णय का उपयोग करें।", "இவை உத்தரவாதங்கள் அல்ல. உண்மை செலவு, விளைச்சல், சந்தை விலை மற்றும் விவசாயி முடிவைப் பயன்படுத்தவும்.", "These are not guarantees. Use actual costs, yield, market price and the farmer's decision."))
                .font(.footnote).foregroundStyle(.secondary)
        }
    }

    private func snapshotGroup(title: String, items: [SnapshotItem]) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title).font(.title3.bold())
            ForEach(items) { item in
                SnapshotRow(item: item)
                if item.id != items.last?.id { Divider() }
            }
        }
        .cardStyle()
    }
}

struct SectionPill: View {
    let title: String
    let selected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title).font(.subheadline.bold()).lineLimit(1)
                .padding(.horizontal, 13).padding(.vertical, 9)
                .foregroundStyle(selected ? Color.white : AppTheme.darkGreen)
                .background(selected ? AppTheme.green : Color.white)
                .clipShape(Capsule())
                .overlay(Capsule().stroke(AppTheme.green.opacity(selected ? 0 : 0.25)))
        }
        .buttonStyle(.plain)
    }
}

struct CompactMetric: View {
    let value: String
    let label: String
    let icon: String

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Image(systemName: icon).foregroundStyle(AppTheme.green)
            Text(value).font(.title3.bold()).foregroundStyle(AppTheme.darkGreen)
            Text(label).font(.caption).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .cardStyle()
    }
}

struct AdvisoryRow: View {
    let text: String

    var body: some View {
        HStack(alignment: .top, spacing: 9) {
            Image(systemName: "leaf.fill").foregroundStyle(AppTheme.green)
            Text(text).font(.subheadline)
        }
    }
}

struct DataBadge: View {
    let text: String
    let color: Color

    var body: some View {
        Text(text).font(.caption2.bold()).tracking(0.7).foregroundStyle(color)
            .padding(.horizontal, 8).padding(.vertical, 5)
            .background(color.opacity(0.12)).clipShape(Capsule())
    }
}

struct SourceDisclosure: View {
    let text: String

    var body: some View {
        Label(text, systemImage: "info.circle.fill")
            .font(.caption).foregroundStyle(.secondary)
            .frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct NearbyFacilitiesContent: View {
    @EnvironmentObject private var model: AppModel
    let title: String
    let subtitle: String

    var body: some View {
        VStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 5) {
                Text(title).font(.title3.bold())
                Text(subtitle).font(.subheadline).foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            ForEach(PilotContract.nearbyFacilities) { facility in
                VStack(alignment: .leading, spacing: 7) {
                    HStack(alignment: .top) {
                        VStack(alignment: .leading, spacing: 3) {
                            Text(model.contentText(facility.category).uppercased()).font(.caption.bold()).tracking(0.7).foregroundStyle(AppTheme.green)
                            Text(model.contentText(facility.name)).font(.headline)
                        }
                        Spacer()
                        Text(facility.distance).font(.caption.bold()).foregroundStyle(AppTheme.darkGreen)
                    }
                    Label(model.contentText(facility.contact), systemImage: "person.crop.circle").font(.subheadline)
                    Text(model.contentText(facility.source)).font(.caption).foregroundStyle(.secondary)
                }
                .cardStyle()
            }
            Text(model.text("దూరాలు సుమారుగా మాత్రమే చూపబడ్డాయి. సేవా వివరాలను నేరుగా నిర్ధారించండి.", "दूरी केवल अनुमानित है। सेवा विवरण सीधे सत्यापित करें।", "தூரங்கள் தோராயமானவை. சேவை விவரங்களை நேரடியாக உறுதிப்படுத்தவும்.", "Distances are approximate. Verify service details directly."))
                .font(.caption).foregroundStyle(.secondary)
        }
    }
}

struct TrainingView: View {
    @EnvironmentObject private var model: AppModel

    var body: some View {
        ScrollView {
            VStack(spacing: 18) {
                PageBar(title: model.text("రైతు శిక్షణ", "किसान प्रशिक्षण", "விவசாயி பயிற்சி", "Farmer training")) { model.screen = .home }
                PageIntro(
                    eyebrow: model.text("B2B · రైతు అభ్యాస గ్రంథాలయం", "B2B · किसान अभ्यास पुस्तकालय", "B2B · விவசாயி பயிற்சி நூலகம்", "B2B · FARMER PRACTICE LIBRARY"),
                    title: model.text("రైతు శిక్షణ", "किसान प्रशिक्षण", "விவசாயி பயிற்சி", "Farmer training"),
                    subtitle: model.text("విత్తడం నుంచి విలువ సృష్టి వరకు దశల వారీ మార్గదర్శనం. పూర్తి చేసిన పాఠాన్ని గుర్తించండి.", "बुवाई से मूल्य सृजन तक चरणबद्ध मार्गदर्शन। पूरा पाठ चिन्हित करें।", "விதைப்பிலிருந்து மதிப்பூட்டல் வரை படிப்படியான வழிகாட்டல். முடித்த பாடத்தைக் குறிக்கவும்.", "Step-by-step guidance from sowing to value creation. Mark completed lessons.")
                )
                ForEach(PilotContract.trainingModules) { module in
                    VStack(alignment: .leading, spacing: 10) {
                        Text(model.contentText(module.stage)).font(.caption.bold()).tracking(1).foregroundStyle(AppTheme.green)
                        Text(model.contentText(module.title)).font(.title3.bold())
                        Text(model.contentText(module.summary)).font(.subheadline).foregroundStyle(.secondary)
                        Divider()
                        ForEach(Array(module.lessons.enumerated()), id: \.offset) { index, lesson in
                            let lessonID = "\(module.id)-\(index)"
                            Button {
                                model.toggleTrainingLesson(moduleID: module.id, index: index)
                            } label: {
                                HStack(alignment: .top, spacing: 10) {
                                    Image(systemName: model.completedTrainingLessonIDs.contains(lessonID) ? "checkmark.circle.fill" : "circle")
                                        .foregroundStyle(AppTheme.green)
                                    Text(model.contentText(lesson)).foregroundStyle(.primary)
                                    Spacer()
                                }
                                .contentShape(Rectangle())
                            }
                            .buttonStyle(.plain)
                        }
                        let completed = module.lessons.indices.filter { model.completedTrainingLessonIDs.contains("\(module.id)-\($0)") }.count
                        Text("\(completed)/\(module.lessons.count) \(model.text("పూర్తి", "पूर्ण", "முடிந்தது", "completed")) • \(completed == module.lessons.count ? model.text("ముగిసింది", "पूरा", "நிறைவு", "complete") : model.text("కొనసాగుతోంది", "प्रगति में", "நடைபெறுகிறது", "in progress"))")
                            .font(.caption.bold()).foregroundStyle(completed == module.lessons.count ? AppTheme.green : .secondary)
                    }
                    .cardStyle()
                }
                Text(model.text("ఈ పైలట్ బిల్డ్‌లో పూర్తి చేసిన పాఠాల మార్పులు పరికరం-స్థాయి మాత్రమే; బ్యాక్‌ఎండ్ సమకాలీకరణ ఇంకా అమలు కాలేదు.", "इस पायलट में पाठ-पूर्णता बदलाव केवल डिवाइस पर हैं; बैकएंड सिंक अभी लागू नहीं है।", "இந்த முன்னோட்டத்தில் பாட நிறைவு மாற்றங்கள் சாதனத்தில் மட்டுமே; பின்தள ஒத்திசைவு இன்னும் செயல்படுத்தப்படவில்லை.", "Lesson completion changes are device-only in this pilot; backend sync is not yet implemented."))
                    .font(.footnote).foregroundStyle(.secondary)
            }
            .padding(22)
        }
    }
}

struct InputsView: View {
    @EnvironmentObject private var model: AppModel

    var body: some View {
        SnapshotListView(
            title: model.text("ఇన్‌పుట్స్ & రక్షణ", "इनपुट और सुरक्षा", "இடுபொருட்கள் & பாதுகாப்பு", "Inputs & protection"),
            subtitle: model.text("వరి, మిరప మరియు పత్తి కోసం పోషకాలు మరియు రక్షణ మార్గదర్శనం.", "धान, मिर्च और कपास के लिए पोषण और सुरक्षा मार्गदर्शन।", "நெல், மிளகாய் மற்றும் பருத்திக்கான ஊட்டச்சத்து மற்றும் பாதுகாப்பு வழிகாட்டல்.", "Nutrient and protection guidance for Paddy, Chilli and Cotton."),
            items: PilotContract.inputGuidance,
            footer: model.text("మోతాదులు హెక్టారుకు సూచన విలువలు. నేల పరీక్ష, పంట దశ, స్థానిక లేబుల్ మరియు అధీకృత నిపుణుడి నిర్ణయం లేకుండా ఉపయోగించవద్దు.", "मात्राएँ प्रति हेक्टेयर संदर्भ मान हैं। मिट्टी परीक्षण, फसल अवस्था, स्थानीय लेबल और अधिकृत विशेषज्ञ के निर्णय के बिना उपयोग न करें।", "அளவுகள் ஹெக்டேருக்கான குறிப்புகள். மண் பரிசோதனை, பயிர் நிலை, உள்ளூர் லேபிள் மற்றும் அங்கீகரிக்கப்பட்ட நிபுணர் முடிவு இல்லாமல் பயன்படுத்த வேண்டாம்.", "Rates are per-hectare reference values. Do not apply without a soil test, crop-stage check, local label and authorised expert decision."),
            back: { model.screen = .home }
        )
    }
}

struct SoilCareView: View {
    @EnvironmentObject private var model: AppModel

    var body: some View {
        SnapshotListView(
            title: model.text("నేల సంరక్షణ", "मृदा देखभाल", "மண் பராமரிப்பு", "Soil care"),
            subtitle: model.text("వెబ్ నేల సంరక్షణ జాబితాలోని ఎనిమిది నిలుపుదల పద్ధతులు.", "वेब मृदा-देखभाल सूची की आठ संरक्षण विधियाँ।", "வலை மண் பராமரிப்பு பட்டியலில் உள்ள எட்டு பாதுகாப்பு முறைகள்.", "Eight retention practices from the web soil-care catalogue."),
            items: PilotContract.soilPractices,
            footer: model.text("జిప్సం లేదా సున్నం వంటి సవరణలకు నేల ప్రయోగశాల ఫలితం తప్పనిసరి.", "जिप्सम या चूना जैसे संशोधनों के लिए मिट्टी प्रयोगशाला परिणाम अनिवार्य है।", "ஜிப்சம் அல்லது சுண்ணாம்பு போன்ற திருத்தங்களுக்கு மண் ஆய்வு முடிவு அவசியம்.", "A soil-lab result is mandatory before amendments such as gypsum or lime."),
            back: { model.screen = .home }
        )
    }
}

struct SchemesView: View {
    @EnvironmentObject private var model: AppModel

    var body: some View {
        SnapshotListView(
            title: model.text("పథకాలు", "योजनाएँ", "திட்டங்கள்", "Schemes"),
            subtitle: model.text("వెబ్ పథకాల జాబితా మరియు రైతు దరఖాస్తు స్థితి.", "वेब योजना सूची और किसान आवेदन स्थिति।", "வலைத் திட்டப் பட்டியலும் விவசாயியின் விண்ணப்ப நிலையும்.", "Web scheme catalogue and farmer application status."),
            items: PilotContract.schemes,
            footer: model.text("అర్హత తనిఖీలు సింథటిక్/ప్రాథమికం మాత్రమే; ప్రభుత్వ అర్హత లేదా ఆమోదంగా పరిగణించవద్దు.", "पात्रता जाँच केवल सिंथेटिक/प्रारंभिक है; इसे सरकारी पात्रता या स्वीकृति न मानें।", "தகுதிச் சரிபார்ப்புகள் செயற்கை/ஆரம்ப நிலை மட்டுமே; அரசு தகுதி அல்லது ஒப்புதலாக கருத வேண்டாம்.", "Eligibility checks are synthetic/preliminary and are not government eligibility or approval."),
            back: { model.screen = .home }
        )
    }
}

struct MarketplaceView: View {
    @EnvironmentObject private var model: AppModel

    var body: some View {
        SnapshotListView(
            title: model.text("మార్కెట్‌ప్లేస్", "मार्केटप्लेस", "சந்தை", "Marketplace"),
            subtitle: model.text("రైతు మార్కెట్ ప్రొఫైల్, జాబితాలు, ధర అభ్యర్థనలు, కోట్స్, ఆర్డర్లు మరియు వివాదాలు.", "किसान बाज़ार प्रोफ़ाइल, सूचियाँ, मूल्य अनुरोध, कोट, ऑर्डर और विवाद।", "விவசாயி சந்தை சுயவிவரம், பட்டியல்கள், விலை கோரிக்கைகள், மேற்கோள்கள், ஆர்டர்கள் மற்றும் சர்ச்சைகள்.", "Farmer marketplace profile, listings, RFQs, quotes, orders and disputes."),
            items: PilotContract.marketplaceState,
            footer: model.text("ప్రస్తుత వెబ్ రైతు ఖాతాలో మార్కెట్ కార్యకలాపం లేదు; మొబైల్ యాప్ కూడా ఖాళీ స్థితినే చూపుతుంది.", "वर्तमान वेब किसान खाते में बाज़ार गतिविधि नहीं है; मोबाइल ऐप भी खाली स्थिति दिखाता है।", "தற்போதைய வலை விவசாயி கணக்கில் சந்தைச் செயல்பாடு இல்லை; கைபேசி செயலியும் காலியான நிலையைக் காட்டுகிறது.", "The current web farmer account has no marketplace activity; the mobile app shows the same empty state."),
            back: { model.screen = .home }
        )
    }
}

struct SnapshotListView: View {
    let title: String
    let subtitle: String
    let items: [SnapshotItem]
    let footer: String
    let back: () -> Void

    var body: some View {
        ScrollView {
            VStack(spacing: 18) {
                PageBar(title: title, back: back)
                PageIntro(eyebrow: "AGRIVAH · WEB PARITY", title: title, subtitle: subtitle)
                ForEach(items) { item in
                    SnapshotCard(item: item)
                }
                Text(footer).font(.footnote).foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(22)
        }
    }
}

struct PageIntro: View {
    let eyebrow: String
    let title: String
    let subtitle: String

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(eyebrow).font(.caption.bold()).tracking(1).foregroundStyle(AppTheme.green)
            Text(title).font(.largeTitle.bold()).foregroundStyle(AppTheme.darkGreen)
            Text(subtitle).font(.subheadline).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct SnapshotCard: View {
    @EnvironmentObject private var model: AppModel
    let item: SnapshotItem

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(model.contentText(item.title)).font(.title3.bold()).foregroundStyle(AppTheme.darkGreen)
            Text(model.contentText(item.detail)).font(.subheadline)
            Text(model.contentText(item.meta)).font(.footnote).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .cardStyle()
    }
}

struct SnapshotRow: View {
    @EnvironmentObject private var model: AppModel
    let item: SnapshotItem

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(alignment: .firstTextBaseline) {
                Text(model.contentText(item.title)).font(.subheadline.bold())
                Spacer()
                Text(model.contentText(item.detail)).font(.subheadline).multilineTextAlignment(.trailing)
            }
            Text(model.contentText(item.meta)).font(.caption).foregroundStyle(.secondary)
        }
    }
}

struct ConsentCenterView: View {
    @EnvironmentObject private var model: AppModel
    @State private var confirmWithdrawal = false

    var body: some View {
        ScrollView {
            VStack(spacing: 18) {
                PageBar(title: model.text("అనుమతి కేంద్రం", "सहमति केंद्र", "ஒப்புதல் மையம்", "Consent centre")) { model.screen = .home }
                VStack(alignment: .leading, spacing: 13) {
                    Text(model.text("ప్రస్తుత అనుమతి", "वर्तमान सहमति", "தற்போதைய ஒப்புதல்", "Current consent")).font(.title3.bold())
                    DetailRow(label: model.text("ఫోన్", "फ़ोन", "தொலைபேசி", "Phone"), value: model.maskedPhone)
                    DetailRow(label: model.text("కాంట్రాక్ట్", "अनुबंध", "ஒப்பந்தம்", "Contract"), value: PilotContract.consentVersion)
                    DetailRow(label: model.text("విధానం", "नीति", "கொள்கை", "Policy"), value: PilotContract.policyVersion)
                    Label(model.text("ప్రయోజన-పరిమిత, డిఫాల్ట్-నిరాకరణ", "उद्देश्य-सीमित, डिफ़ॉल्ट-अस्वीकृति", "நோக்கம்-வரையறுக்கப்பட்டது, இயல்பாக மறுப்பு", "Purpose-limited, deny by default"), systemImage: "lock.fill")
                        .font(.footnote.bold()).foregroundStyle(AppTheme.green)
                }
                .cardStyle()
                VStack(alignment: .leading, spacing: 10) {
                    Text(model.text("అనుమతి వెనక్కి తీసుకోవడం", "सहमति वापस लेना", "ஒப்புதலைத் திரும்பப் பெறுதல்", "Withdraw consent")).font(.headline)
                    Text(model.text("ఇది ఈ పరికరంలోని ప్రొఫైల్, అనుమతి మరియు ఆఫ్‌లైన్ డ్రాఫ్ట్‌ను తొలగించి సైన్-ఇన్ పేజీకి తీసుకెళ్తుంది.", "यह इस डिवाइस से प्रोफ़ाइल, सहमति और ऑफ़लाइन ड्राफ्ट मिटाकर साइन-इन पर लौटाता है।", "இது இந்தச் சாதனத்தின் சுயவிவரம், ஒப்புதல் மற்றும் இணையமற்ற வரைவை நீக்கி உள்நுழைவுக்கு திரும்பும்.", "This removes the profile, consent and offline draft from this device and returns to sign-in."))
                        .font(.footnote).foregroundStyle(.secondary)
                    Button(role: .destructive) {
                        confirmWithdrawal = true
                    } label: {
                        Text(model.text("అనుమతి వెనక్కి తీసుకోండి", "सहमति वापस लें", "ஒப்புதலைத் திரும்பப் பெறவும்", "Withdraw consent")).font(.headline).frame(maxWidth: .infinity).padding(.vertical, 12)
                    }
                    .buttonStyle(.bordered)
                }
                .cardStyle()
            }
            .padding(22)
        }
        .alert(model.text("అనుమతి వెనక్కి తీసుకోవాలా?", "सहमति वापस लें?", "ஒப்புதலைத் திரும்பப் பெறவா?", "Withdraw consent?"), isPresented: $confirmWithdrawal) {
            Button(model.text("రద్దు", "रद्द करें", "ரத்து", "Cancel"), role: .cancel) { }
            Button(model.text("తీసుకోండి", "वापस लें", "திரும்பப் பெறவும்", "Withdraw"), role: .destructive, action: model.withdrawConsent)
        } message: {
            Text(model.text("ఈ పరికరంలోని పైలట్ డేటా తొలగించబడుతుంది.", "इस डिवाइस का पायलट डेटा मिट जाएगा।", "இந்தச் சாதனத்தின் முன்னோட்டத் தரவு நீக்கப்படும்.", "Pilot data on this device will be removed."))
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
    let background: Color

    func body(content: Content) -> some View {
        content
            .padding(16)
            .background(background)
            .clipShape(RoundedRectangle(cornerRadius: 18))
            .overlay(RoundedRectangle(cornerRadius: 18).stroke(Color.black.opacity(0.05)))
    }
}

private extension View {
    func cardStyle(background: Color = Color.white.opacity(0.88)) -> some View {
        modifier(CardModifier(background: background))
    }
}
