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

enum LifecycleUrgency: Int, Equatable {
    case overdue = 0
    case today = 1
    case upcoming = 2
    case later = 3
}

enum LifecycleDestination: Equatable {
    case farm, intelligence, training, inputs, soilCare, schemes, farmHistory
}

struct LifecycleStage: Identifiable, Equatable {
    let id: String
    let title: String
    let summary: String
    let icon: String
}

struct LifecycleAction: Identifiable, Equatable {
    let id: String
    let stageID: String
    let title: String
    let detail: String
    let urgency: LifecycleUrgency
    let icon: String
    let cropCodes: [String]
    let destination: LifecycleDestination
    let trainingModuleID: String?

    init(
        id: String,
        stageID: String,
        title: String,
        detail: String,
        urgency: LifecycleUrgency,
        icon: String,
        cropCodes: [String] = [],
        destination: LifecycleDestination,
        trainingModuleID: String? = nil
    ) {
        self.id = id
        self.stageID = stageID
        self.title = title
        self.detail = detail
        self.urgency = urgency
        self.icon = icon
        self.cropCodes = cropCodes
        self.destination = destination
        self.trainingModuleID = trainingModuleID
    }
}

struct MarketQuote: Identifiable, Equatable {
    let id: String
    let crop: String
    let variety: String
    let grade: String
    let minimumPrice: String
    let modalPrice: String
    let maximumPrice: String
    let arrivals: String
    let source: String
}

struct ValueAddStep: Identifiable, Equatable {
    let id: Int
    let input: String
    let output: String
    let recovery: String
    let processingCost: String
    let byProducts: String
}

struct OutcomeScenario: Identifiable, Equatable {
    let id: String
    let label: String
    let yield: String
    let sellingPrice: String
    let totalCost: String
    let grossIncome: String
    let netIncome: String
    let breakEven: String
}

struct NearbyFacility: Identifiable, Equatable {
    let id: String
    let category: String
    let name: String
    let distance: String
    let contact: String
    let source: String
}

struct HistoryYearSummary: Identifiable, Equatable {
    let id: Int
    let crops: String
    let acres: String
    let cost: String
    let revenue: String
    let netPerAcre: String
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

enum PilotContentLocalization {
    private static let telugu: [String: String] = [
        "Paddy field east": "తూర్పు వరి పొలం",
        "Chilli block A": "మిరప బ్లాక్ A",
        "Cotton stretch (west)": "పశ్చిమ పత్తి విభాగం",
        "Guntur Chilli Growers FPO": "గుంటూరు మిరప రైతు ఉత్పత్తిదారుల సంస్థ",
        "Borewell + canal": "బోరుబావి + కాలువ",
        "owner": "యజమాని",
        "Date of birth": "పుట్టిన తేదీ",
        "Social category": "సామాజిక వర్గం",
        "Ownership": "యాజమాన్యం",
        "Irrigation": "నీటిపారుదల",
        "Bank": "బ్యాంక్",
        "Farmer confirmed": "రైతు నిర్ధారించారు",
        "Farmer entered": "రైతు నమోదు చేశారు",
        "Owner": "యజమాని",
        "Andhra Grameena Vikas Bank (synthetic) • Kaza": "ఆంధ్ర గ్రామీణ వికాస్ బ్యాంక్ (సింథటిక్) • కాజా",
        "A/c •••• 4821 • IFSC ANDB0001234": "ఖాతా •••• 4821 • IFSC ANDB0001234",
        "Bank passbook": "బ్యాంక్ పాస్‌బుక్",
        "Land record": "భూమి రికార్డు",
        "Identity proof": "గుర్తింపు రుజువు",
        "Confirmed": "నిర్ధారించబడింది",
        "Synthetic • image/jpeg": "సింథటిక్ • image/jpeg",
        "Farmer": "రైతు",
        "Draft": "డ్రాఫ్ట్",
        "Identity step": "గుర్తింపు దశ",
        "Organisation step": "సంస్థ దశ",
        "Field agent": "క్షేత్ర ప్రతినిధి",
        "Bank officer": "బ్యాంక్ అధికారి",
        "Insurer officer": "బీమా అధికారి",
        "Knowledge reviewer": "విజ్ఞాన సమీక్షకుడు",
        "Institution step": "సంస్థాగత దశ",
        "Direct-seeded on two acres to save labour.": "కూలి ఖర్చు తగ్గించేందుకు రెండు ఎకరాల్లో నేరుగా విత్తారు.",
        "Drone spraying trialled through the FPO.": "FPO ద్వారా డ్రోన్ స్ప్రేయింగ్‌ను ప్రయోగించారు.",
        "Pink bollworm scouting from flowering.": "పూత దశ నుంచి గులాబీ రంగు పురుగు పరిశీలన చేశారు.",
        "Held stock for three weeks; price improved.": "మూడు వారాలు నిల్వ ఉంచడంతో ధర మెరుగుపడింది.",
        "Best paddy season so far.": "ఇప్పటివరకు ఉత్తమ వరి సీజన్.",
        "Grown on the cotton block after harvest.": "పత్తి కోత తర్వాత అదే బ్లాక్‌లో పండించారు.",
        "Late-season inundation cut the yield.": "సీజన్ చివర్లో నీరు నిలవడంతో దిగుబడి తగ్గింది.",
        "Thrips pressure managed with two extra sprays.": "రెండు అదనపు స్ప్రేలతో తామర పురుగు ఒత్తిడిని నియంత్రించారు.",
        "Good canal supply through the season.": "సీజన్ అంతా కాలువ నీటి సరఫరా బాగుంది.",
        "Sold to local trader.": "స్థానిక వ్యాపారికి విక్రయించారు.",
        "Covered • PMFBY": "బీమా ఉంది • PMFBY",
        "Partially covered • PMFBY": "పాక్షిక బీమా • PMFBY",
        "Premium ₹3,600/ac • insured ₹45,000/ac • farmer share ₹900/ac": "ప్రీమియం ₹3,600/ఎకరం • బీమా ₹45,000/ఎకరం • రైతు వాటా ₹900/ఎకరం",
        "Premium ₹3,400/ac • insured ₹42,500/ac • farmer share ₹850/ac": "ప్రీమియం ₹3,400/ఎకరం • బీమా ₹42,500/ఎకరం • రైతు వాటా ₹850/ఎకరం",
        "Village": "గ్రామం",
        "Synthetic location code": "సింథటిక్ స్థానం కోడ్",
        "Block / mandal": "బ్లాక్ / మండలం",
        "Not recorded": "నమోదు కాలేదు",
        "Farmer profile gap": "రైతు ప్రొఫైల్‌లో లోపం",
        "District": "జిల్లా",
        "Guntur (synthetic)": "గుంటూరు (సింథటిక్)",
        "State": "రాష్ట్రం",
        "Andhra Pradesh (synthetic)": "ఆంధ్రప్రదేశ్ (సింథటిక్)",
        "Centroid": "కేంద్ర బిందువు",
        "Selected parcel: GNT-KAZA-114/2": "ఎంచుకున్న పార్సెల్: GNT-KAZA-114/2",
        "Agro-climatic zone": "వ్యవసాయ-వాతావరణ మండలం",
        "Andhra Pradesh synthetic agro-climatic zone": "ఆంధ్రప్రదేశ్ సింథటిక్ వ్యవసాయ-వాతావరణ మండలం",
        "VALIDATE mapping before field use": "పొలంలో ఉపయోగించే ముందు మ్యాపింగ్‌ను ధృవీకరించండి",
        "Season basis": "సీజన్ ఆధారం",
        "Kharif (monsoon)": "ఖరీఫ్ (వర్షాకాలం)",
        "Sowing Jun–Jul • harvest Oct–Nov": "విత్తడం జూన్–జూలై • కోత అక్టోబర్–నవంబర్",
        "Major soils": "ప్రధాన నేలలు",
        "Mixed red and black soils": "మిశ్రమ ఎర్ర మరియు నల్ల నేలలు",
        "Location-derived synthetic district reference": "స్థానం ఆధారంగా పొందిన సింథటిక్ జిల్లా సూచన",
        "Common irrigation": "సాధారణ నీటిపారుదల",
        "Borewell, rainfed": "బోరుబావి, వర్షాధారం",
        "District reference; farmer record says borewell + canal": "జిల్లా సూచన; రైతు రికార్డులో బోరుబావి + కాలువ",
        "Farmer soil test": "రైతు నేల పరీక్ష",
        "Not linked": "అనుసంధానం కాలేదు",
        "No Soil Health Card or laboratory result is available": "నేల ఆరోగ్య కార్డు లేదా ప్రయోగశాల ఫలితం అందుబాటులో లేదు",
        "Major soil types": "ప్రధాన నేల రకాలు",
        "Location-derived": "స్థానం నుంచి పొందినది",
        "Typical texture": "సాధారణ నేల స్వభావం",
        "Loam": "లోమ్",
        "Synthetic district reference; confirm by lab test": "సింథటిక్ జిల్లా సూచన; ప్రయోగశాల పరీక్షతో నిర్ధారించండి",
        "Typical pH range": "సాధారణ pH పరిధి",
        "Reference range, not a parcel reading": "ఇది సూచన పరిధి మాత్రమే; పార్సెల్ కొలత కాదు",
        "Organic carbon": "సేంద్రీయ కార్బన్",
        "Paddy • GNT-KAZA-114/2": "వరి • GNT-KAZA-114/2",
        "Chilli • GNT-KAZA-98/1": "మిరప • GNT-KAZA-98/1",
        "Cotton • GNT-KAZA-77/4": "పత్తి • GNT-KAZA-77/4",
        "8.40 ac • suitability 86/100": "8.40 ఎకరాలు • అనుకూలత 86/100",
        "5.60 ac • suitability 78/100": "5.60 ఎకరాలు • అనుకూలత 78/100",
        "4.20 ac • suitability 74/100": "4.20 ఎకరాలు • అనుకూలత 74/100",
        "DERIVED: climate, soil, irrigation and market factors": "ఉత్పన్నం: వాతావరణం, నేల, నీటిపారుదల మరియు మార్కెట్ అంశాలు",
        "Area adoption 34% • farmer 23.6 q/ac": "ప్రాంత స్వీకరణ 34% • రైతు 23.6 క్వింటాళ్లు/ఎకరం",
        "Area adoption 12% • farmer 20.0 q/ac": "ప్రాంత స్వీకరణ 12% • రైతు 20.0 క్వింటాళ్లు/ఎకరం",
        "Area adoption 22% • farmer 10.0 q/ac": "ప్రాంత స్వీకరణ 22% • రైతు 10.0 క్వింటాళ్లు/ఎకరం",
        "Typical 22 q/ac • ₹31–32k/ac • ₹2,050–2,150/q": "సాధారణం 22 క్వింటాళ్లు/ఎకరం • ₹31–32వేలు/ఎకరం • ₹2,050–2,150/క్వింటాల్",
        "Typical 20 q/ac • ₹78k/ac • about ₹12,500/q": "సాధారణం 20 క్వింటాళ్లు/ఎకరం • ₹78వేలు/ఎకరం • సుమారు ₹12,500/క్వింటాల్",
        "Typical 9 q/ac • ₹34–36k/ac • about ₹7,200/q": "సాధారణం 9 క్వింటాళ్లు/ఎకరం • ₹34–36వేలు/ఎకరం • సుమారు ₹7,200/క్వింటాల్",
        "Draft allocation": "డ్రాఫ్ట్ కేటాయింపు",
        "Paddy 8.40 ac • Chilli 5.60 ac • Cotton 4.20 ac": "వరి 8.40 ఎకరాలు • మిరప 5.60 ఎకరాలు • పత్తి 4.20 ఎకరాలు",
        "18.20 acres allocated; farmer confirmation required": "18.20 ఎకరాలు కేటాయించబడ్డాయి; రైతు నిర్ధారణ అవసరం",
        "Soil-test readiness": "నేల పరీక్ష సిద్ధత",
        "Action needed": "చర్య అవసరం",
        "No parcel-level laboratory result is linked": "పార్సెల్ స్థాయి ప్రయోగశాల ఫలితం అనుసంధానం కాలేదు",
        "Water plan": "నీటి ప్రణాళిక",
        "Borewell + canal recorded": "బోరుబావి + కాలువ నమోదైంది",
        "Confirm seasonal availability before sowing": "విత్తే ముందు సీజనల్ లభ్యతను నిర్ధారించండి",
        "Insurance review": "బీమా సమీక్ష",
        "Pending": "పెండింగ్",
        "Check notified crop, dates and sum insured with an authorised desk": "అధీకృత డెస్క్ వద్ద నోటిఫైడ్ పంట, తేదీలు మరియు బీమా మొత్తాన్ని తనిఖీ చేయండి",
        "Market reference": "మార్కెట్ సూచన",
        "Guntur Mandi snapshot available": "గుంటూరు మార్కెట్ స్నాప్‌షాట్ అందుబాటులో ఉంది",
        "Synthetic observed prices dated 17-08-2026": "17-08-2026 తేదీ సింథటిక్ పరిశీలిత ధరలు",
        "LAND PREPARATION & SOWING": "భూమి తయారీ & విత్తడం",
        "Land preparation and sowing": "భూమి తయారీ మరియు విత్తడం",
        "Field preparation, seed selection, seed treatment, spacing and sowing windows for AP/Telangana conditions.": "ఏపీ/తెలంగాణ పరిస్థితులకు పొలం తయారీ, విత్తన ఎంపిక, విత్తన శుద్ధి, దూరం మరియు విత్తే సమయం.",
        "Prepare the field": "పొలాన్ని సిద్ధం చేయండి",
        "Choose and treat the seed": "విత్తనాన్ని ఎంచుకుని శుద్ధి చేయండి",
        "Sow at the right time and spacing": "సరైన సమయం మరియు దూరంలో విత్తండి",
        "CROP PROTECTION": "పంట రక్షణ",
        "Crop protection methods": "పంట రక్షణ పద్ధతులు",
        "Scouting, thresholds, integrated pest management and safe spraying practice.": "పొలం పరిశీలన, పరిమితులు, సమగ్ర పురుగు నిర్వహణ మరియు సురక్షిత స్ప్రేయింగ్ పద్ధతి.",
        "Scout the field weekly": "ప్రతి వారం పొలాన్ని పరిశీలించండి",
        "Use integrated pest management first": "ముందుగా సమగ్ర పురుగు నిర్వహణను ఉపయోగించండి",
        "Spray safely": "సురక్షితంగా స్ప్రే చేయండి",
        "HARVEST & CROP CUTTING": "కోత & పంట కోయడం",
        "Harvest and crop cutting": "కోత మరియు పంట కోయడం",
        "Maturity signs, cutting method, moisture at harvest and threshing losses.": "పక్వత లక్షణాలు, కోత పద్ధతి, కోత సమయంలో తేమ మరియు నూర్పిడి నష్టాలు.",
        "Judge maturity correctly": "పక్వతను సరిగ్గా అంచనా వేయండి",
        "Cut and thresh with low loss": "తక్కువ నష్టంతో కోసి నూర్పిడి చేయండి",
        "POST-HARVEST": "కోత అనంతరం",
        "Drying, storage and preservation": "ఎండబెట్టడం, నిల్వ మరియు సంరక్షణ",
        "Drying to safe moisture, grading, bagging, aeration and pest-free storage.": "సురక్షిత తేమ వరకు ఎండబెట్టడం, గ్రేడింగ్, బస్తాల్లో నింపడం, గాలి ప్రసరణ మరియు పురుగులేని నిల్వ.",
        "Dry to safe moisture": "సురక్షిత తేమ వరకు ఎండబెట్టండి",
        "Store pest-free": "పురుగులు లేకుండా నిల్వ చేయండి",
        "VALUE CREATION": "విలువ సృష్టి",
        "Value creation from produce": "పంట ఉత్పత్తి నుంచి విలువ సృష్టి",
        "Cleaning, grading, primary processing and by-product value.": "శుభ్రపరచడం, గ్రేడింగ్, ప్రాథమిక ప్రాసెసింగ్ మరియు ఉప ఉత్పత్తుల విలువ.",
        "Clean and grade": "శుభ్రపరచి గ్రేడ్ చేయండి",
        "Primary processing and by-products": "ప్రాథమిక ప్రాసెసింగ్ మరియు ఉప ఉత్పత్తులు",
        "Paddy • nutrient plan": "వరి • పోషక ప్రణాళిక",
        "Chilli • nutrient plan": "మిరప • పోషక ప్రణాళిక",
        "Cotton • nutrient plan": "పత్తి • పోషక ప్రణాళిక",
        "Paddy • high-priority protection": "వరి • అధిక ప్రాధాన్య రక్షణ",
        "Chilli • high-priority protection": "మిరప • అధిక ప్రాధాన్య రక్షణ",
        "Cotton • high-priority protection": "పత్తి • అధిక ప్రాధాన్య రక్షణ",
        "Basal: urea 65, DAP 125, MOP 50 kg/ha; zinc sulphate 25 kg/ha only after deficiency/lab confirmation": "బేసల్ మోతాదు: యూరియా 65, DAP 125, MOP 50 kg/ha; లోపం లేదా ప్రయోగశాల నిర్ధారణ తర్వాత మాత్రమే జింక్ సల్ఫేట్ 25 kg/ha",
        "Tillering + panicle initiation: urea 65 kg/ha each • organic: Azospirillum 5 kg/ha / vermicompost 2,500 kg/ha": "పిలకలు + కంకి ఏర్పడే దశ: ప్రతి దశలో యూరియా 65 kg/ha • సేంద్రీయం: అజోస్పిరిల్లం 5 kg/ha / వర్మీకంపోస్ట్ 2,500 kg/ha",
        "Basal: urea 90, SSP 375, MOP 100 kg/ha": "బేసల్ మోతాదు: యూరియా 90, SSP 375, MOP 100 kg/ha",
        "Flowering: boron 5 kg/ha • organic: vermicompost 5,000 kg/ha / Jeevamrutham 500 l/ha": "పూత దశ: బోరాన్ 5 kg/ha • సేంద్రీయం: వర్మీకంపోస్ట్ 5,000 kg/ha / జీవామృతం 500 l/ha",
        "Basal: urea 90 and DAP 130 kg/ha": "బేసల్ మోతాదు: యూరియా 90 మరియు DAP 130 kg/ha",
        "Square formation: MOP 85 kg/ha • organic: neem cake 500 kg/ha": "స్క్వేర్ ఏర్పడే దశ: MOP 85 kg/ha • సేంద్రీయం: వేప పిండి 500 kg/ha",
        "Rice blast, brown plant hopper and yellow stem borer": "వరి అగ్గితెగులు, గోధుమ రంగు దోమ మరియు పసుపు కాండం తొలిచే పురుగు",
        "Thrips and anthracnose/die-back; yellow mite is moderate": "తామర పురుగు మరియు ఆంత్రాక్నోస్/డై-బ్యాక్; పసుపు మైట్ మోస్తరు",
        "Pink bollworm": "గులాబీ రంగు పురుగు",
        "Use thresholds and approved labels; safety intervals apply.": "పరిమితులు మరియు ఆమోదిత లేబుళ్లను పాటించండి; భద్రతా విరామాలు వర్తిస్తాయి.",
        "Scout weekly; IPM first. Example options include neem oil, Trichoderma or label-approved chemistry.": "ప్రతి వారం పరిశీలించండి; ముందుగా IPM పాటించండి. వేపనూనె, ట్రైకోడెర్మా లేదా లేబుల్ ఆమోదిత మందులు ఉదాహరణలు.",
        "Rosette flowers, exit holes and damaged lint; use scouting thresholds before treatment.": "రోజెట్ పూలు, బయటకు వచ్చిన రంధ్రాలు మరియు దెబ్బతిన్న పింజను చూడండి; చికిత్సకు ముందు పరిశీలన పరిమితులు పాటించండి.",
        "Build organic matter every season": "ప్రతి సీజన్‌లో సేంద్రీయ పదార్థాన్ని పెంచండి",
        "2 t/ac vermicompost or 5 t/ac FYM": "ఎకరానికి 2 టన్నుల వర్మీకంపోస్ట్ లేదా 5 టన్నుల పశువుల ఎరువు",
        "Moderate effort • benefit in 2–3 seasons": "మోస్తరు శ్రమ • 2–3 సీజన్లలో ప్రయోజనం",
        "Green manure and cover crops": "పచ్చి ఎరువు మరియు కవర్ పంటలు",
        "Sow sunhemp/daincha; incorporate at about 45 days": "జనుము/జీలుగ విత్తి సుమారు 45 రోజులకు నేలలో కలపండి",
        "Moderate • adds about 20–25 kg N/ac": "మోస్తరు • ఎకరానికి సుమారు 20–25 kg నత్రజని చేరుతుంది",
        "Mulch the surface": "నేలపై మల్చింగ్ చేయండి",
        "Retain clean crop residue where suitable": "అనుకూలమైన చోట శుభ్రమైన పంట అవశేషాలను ఉంచండి",
        "Low effort • reduces evaporation and weeds": "తక్కువ శ్రమ • ఆవిరీభవనం మరియు కలుపును తగ్గిస్తుంది",
        "Rotate with a legume": "పప్పు పంటతో మార్పిడి చేయండి",
        "Include a locally suitable pulse in the rotation": "పంట మార్పిడిలో స్థానికంగా అనుకూలమైన పప్పు పంటను చేర్చండి",
        "Low effort • can reduce nitrogen need and pest pressure": "తక్కువ శ్రమ • నత్రజని అవసరం మరియు పురుగు ఒత్తిడి తగ్గవచ్చు",
        "Correct sodic soil with gypsum": "సోడిక్ నేలను జిప్సంతో సరిచేయండి",
        "Apply only at a soil-lab recommended rate": "నేల ప్రయోగశాల సూచించిన మోతాదులో మాత్రమే వేయండి",
        "High effort • laboratory confirmation required": "అధిక శ్రమ • ప్రయోగశాల నిర్ధారణ అవసరం",
        "Correct acidic soil with lime": "ఆమ్ల నేలను సున్నంతో సరిచేయండి",
        "Use the laboratory rate 3–4 weeks before sowing": "విత్తడానికి 3–4 వారాల ముందు ప్రయోగశాల సూచించిన మోతాదును ఉపయోగించండి",
        "Irrigate to hold nutrients": "పోషకాలు నిలిచేలా నీరు పెట్టండి",
        "Lighter/frequent on sandy soils; avoid overwatering heavy soils": "ఇసుక నేలల్లో తక్కువ మోతాదులో తరచుగా నీరు పెట్టండి; బరువైన నేలల్లో అధిక నీటిని నివారించండి",
        "Low effort": "తక్కువ శ్రమ",
        "Bunds and contour cultivation on slopes": "వాలుల్లో గట్లు మరియు కాంటూర్ సాగు",
        "Slow runoff and retain topsoil": "నీటి ప్రవాహాన్ని తగ్గించి పైమట్టిని కాపాడండి",
        "High effort": "అధిక శ్రమ",
        "Crop insurance enrolment support (synthetic)": "పంట బీమా నమోదు సహాయం (సింథటిక్)",
        "Input support for small and marginal farmers (synthetic)": "చిన్న మరియు సన్నకారు రైతులకు ఇన్‌పుట్ సహాయం (సింథటిక్)",
        "Micro irrigation (drip) subsidy (synthetic)": "సూక్ష్మ నీటిపారుదల (డ్రిప్) సబ్సిడీ (సింథటిక్)",
        "Credit linkage for tenant and leased-land farmers (synthetic)": "కౌలు మరియు లీజు రైతులకు రుణ అనుసంధానం (సింథటిక్)",
        "Submitted • eligible": "సమర్పించబడింది • అర్హత ఉంది",
        "Telangana premium assistance • version 1": "తెలంగాణ ప్రీమియం సహాయం • వెర్షన్ 1",
        "In review • needs review": "సమీక్షలో ఉంది • మరింత సమీక్ష అవసరం",
        "AP support up to 5 acres • version 1": "ఏపీలో 5 ఎకరాల వరకు సహాయం • వెర్షన్ 1",
        "AP owner-cultivator capital subsidy • version 1": "ఏపీ యజమాని-సాగుదారు మూలధన సబ్సిడీ • వెర్షన్ 1",
        "Not applied": "దరఖాస్తు చేయలేదు",
        "Telangana tenant/share-cropper linkage • version 1": "తెలంగాణ కౌలు/భాగస్వామ్య సాగుదారు అనుసంధానం • వెర్షన్ 1",
        "Marketplace profile": "మార్కెట్‌ప్లేస్ ప్రొఫైల్",
        "Not activated": "సక్రియం కాలేదు",
        "No farmer seller/buyer profile exists.": "రైతు విక్రేత/కొనుగోలుదారు ప్రొఫైల్ లేదు.",
        "Listings": "జాబితాలు",
        "No published or draft farmer listings.": "ప్రచురించిన లేదా డ్రాఫ్ట్ రైతు జాబితాలు లేవు.",
        "RFQs and quotes": "ధర అభ్యర్థనలు మరియు కోట్స్",
        "No requests or quotes.": "అభ్యర్థనలు లేదా కోట్స్ లేవు.",
        "Orders and disputes": "ఆర్డర్లు మరియు వివాదాలు",
        "No orders or disputes.": "ఆర్డర్లు లేదా వివాదాలు లేవు.",
        "Minimum Staple": "మధ్యస్థ పింజ",
        "Medium Staple": "మధ్యస్థ పింజ",
        "Grade-1": "గ్రేడ్-1",
        "Teja": "తేజ",
        "Low": "తక్కువ",
        "Base": "ప్రాథమిక",
        "High": "అధిక",
        "Paddy": "వరి",
        "Chilli": "మిరప",
        "Cotton": "పత్తి",
        "Maize": "మొక్కజొన్న",
        "Cleaned & dried paddy": "శుభ్రపరచి ఎండబెట్టిన వరి",
        "Brown rice": "బ్రౌన్ రైస్",
        "Polished rice": "పాలిష్ చేసిన బియ్యం",
        "Chaff 4%": "తాలు 4%",
        "Husk 20% • ₹180/q": "పొట్టు 20% • ₹180/క్వింటాల్",
        "Bran 6% • ₹2,200/q; broken rice 2% • ₹1,900/q": "తవుడు 6% • ₹2,200/క్వింటాల్; నూకలు 2% • ₹1,900/క్వింటాల్",
        "FPO": "రైతు ఉత్పత్తిదారుల సంస్థ",
        "Soil testing": "నేల పరీక్ష",
        "Extension": "వ్యవసాయ విస్తరణ",
        "Machinery": "యంత్రాలు",
        "Logistics": "రవాణా సేవలు",
        "Guntur Chilli FPO": "గుంటూరు మిరప FPO",
        "District Soil Testing Lab, Guntur": "జిల్లా నేల పరీక్ష ప్రయోగశాల, గుంటూరు",
        "KVK Lam, Guntur": "కృషి విజ్ఞాన కేంద్రం లాం, గుంటూరు",
        "Guntur Custom Hiring Centre": "గుంటూరు కస్టమ్ హైరింగ్ కేంద్రం",
        "Guntur Agri Logistics": "గుంటూరు వ్యవసాయ రవాణా సేవలు",
        "FPO CEO desk": "FPO సీఈఓ డెస్క్",
        "Lab in-charge": "ప్రయోగశాల ఇన్‌చార్జి",
        "Extension scientist": "వ్యవసాయ విస్తరణ శాస్త్రవేత్త",
        "CHC manager": "CHC మేనేజర్",
        "Dispatch desk": "పంపిణీ డెస్క్",
        "Synthetic directory": "సింథటిక్ డైరెక్టరీ",
        "Plan & insure": "ప్రణాళిక మరియు బీమా",
        "Confirm coverage and prepare evidence": "బీమాను నిర్ధారించి ఆధారాలు సిద్ధం చేయండి",
        "Sow & establish": "విత్తడం మరియు స్థాపన",
        "Start every parcel correctly": "ప్రతి పొలాన్ని సరిగ్గా ప్రారంభించండి",
        "Water & nourish": "నీరు మరియు పోషణ",
        "Apply water and nutrients on time": "నీరు, పోషకాలను సమయానికి అందించండి",
        "Protect crop": "పంట రక్షణ",
        "Scout early and act safely": "ముందుగానే పరిశీలించి సురక్షితంగా చర్య తీసుకోండి",
        "Protect soil": "నేల పరిరక్షణ",
        "Preserve moisture and topsoil": "తేమను, పైమట్టిని కాపాడండి",
        "Harvest & preserve": "కోత మరియు నిల్వ",
        "Protect quality after maturity": "పక్వం తర్వాత నాణ్యతను కాపాడండి",
        "Verify paddy insurance cover": "వరి పంట బీమాను నిర్ధారించండి",
        "PMFBY record is available; confirm dates and sum insured with the authorised desk.": "PMFBY రికార్డు అందుబాటులో ఉంది; తేదీలు మరియు బీమా మొత్తాన్ని అధీకృత డెస్క్ వద్ద నిర్ధారించండి.",
        "Review chilli and cotton insurance": "మిరప, పత్తి బీమాను సమీక్షించండి",
        "Confirm whether both crops are notified before the enrolment window closes.": "నమోదు గడువు ముగిసేలోపు రెండు పంటలు నోటిఫై అయ్యాయో నిర్ధారించండి.",
        "Complete parcel soil test": "ప్రతి పొలానికి నేల పరీక్ష పూర్తి చేయండి",
        "No parcel-level laboratory result is linked; collect and submit a representative sample.": "పొలం స్థాయి ప్రయోగశాల ఫలితం జత కాలేదు; సరైన నమూనాను సేకరించి సమర్పించండి.",
        "Confirm crop and input plan": "పంట మరియు ఇన్‌పుట్ ప్రణాళికను నిర్ధారించండి",
        "The three-parcel allocation is recorded for the current season.": "ప్రస్తుత సీజన్‌కు మూడు పొలాల కేటాయింపు నమోదైంది.",
        "Prepare land and drainage": "భూమి మరియు నీటి పారుదల సిద్ధం చేయండి",
        "Field preparation is recorded; keep drainage channels open before forecast rain.": "పొలం తయారీ నమోదైంది; అంచనా వర్షానికి ముందు పారుదల కాలువలను తెరిచి ఉంచండి.",
        "Treat seed before sowing": "విత్తే ముందు విత్తన శుద్ధి చేయండి",
        "Seed-treatment activity is recorded for the pilot.": "పైలట్ కోసం విత్తన శుద్ధి చర్య నమోదైంది.",
        "Record sowing date and spacing": "విత్తిన తేదీ మరియు దూరాన్ని నమోదు చేయండి",
        "Sowing is recorded; exact dates still need farmer confirmation.": "విత్తడం నమోదైంది; ఖచ్చితమైన తేదీలను రైతు ఇంకా నిర్ధారించాలి.",
        "Complete sowing-stage training": "విత్తే దశ శిక్షణ పూర్తి చేయండి",
        "Finish all three land-preparation and sowing lessons.": "భూమి తయారీ మరియు విత్తడంపై మూడు పాఠాలను పూర్తి చేయండి.",
        "Check irrigation and field moisture": "నీటిపారుదల మరియు పొలం తేమను పరిశీలించండి",
        "Inspect each parcel today; avoid watering where forecast rain is adequate.": "ఈరోజు ప్రతి పొలాన్ని పరిశీలించండి; అంచనా వర్షం సరిపోతే నీరు పెట్టవద్దు.",
        "Apply organic manure": "సేంద్రియ ఎరువు వేయండి",
        "Organic-manure application is recorded; retain the field receipt or note.": "సేంద్రియ ఎరువు వాడకం నమోదైంది; పొలం రసీదు లేదా నోటును భద్రపరచండి.",
        "Adjust top-dressing after rain": "వర్షం తర్వాత పై ఎరువును సర్దుబాటు చేయండి",
        "Recheck field moisture and postpone nitrogen application during heavy rain.": "పొలం తేమను మళ్లీ చూసి భారీ వర్షంలో నత్రజని వాడకాన్ని వాయిదా వేయండి.",
        "Scout every parcel": "ప్రతి పొలాన్ని పరిశీలించండి",
        "Check paddy, chilli and cotton for pest or disease signs and record observations.": "వరి, మిరప, పత్తిలో తెగులు లేదా వ్యాధి లక్షణాలను చూసి వివరాలు నమోదు చేయండి.",
        "Prepare an IPM response": "సమగ్ర సస్యరక్షణ చర్య సిద్ధం చేయండి",
        "Use thresholds and authorised guidance before any crop-protection treatment.": "ఏ పంట రక్షణ చర్యకైనా ముందు పరిమితులు మరియు అధీకృత మార్గదర్శకాన్ని పాటించండి.",
        "Complete crop-protection training": "పంట రక్షణ శిక్షణ పూర్తి చేయండి",
        "Finish scouting, IPM and safe-spraying lessons.": "పరిశీలన, సమగ్ర సస్యరక్షణ మరియు సురక్షిత స్ప్రేయింగ్ పాఠాలను పూర్తి చేయండి.",
        "Inspect bunds and runoff paths": "గట్లు మరియు నీటి ప్రవాహ మార్గాలను పరిశీలించండి",
        "Repair weak bunds and prevent topsoil loss before the next rainfall.": "తదుపరి వర్షానికి ముందు బలహీన గట్లను బాగుచేసి పైమట్టి నష్టాన్ని నివారించండి.",
        "Mulch or retain suitable residue": "మల్చింగ్ చేయండి లేదా తగిన పంట అవశేషాలను ఉంచండి",
        "Cover exposed soil where agronomically appropriate to reduce evaporation.": "ఆవిరీభవనం తగ్గేందుకు వ్యవసాయపరంగా అనుకూలమైన చోట బహిర్గత నేలను కప్పండి.",
        "Prepare harvest and moisture checks": "కోత మరియు తేమ తనిఖీలను సిద్ధం చేయండి",
        "Open this stage when the crop approaches maturity.": "పంట పక్వానికి చేరుకునే సమయంలో ఈ దశను ప్రారంభించండి.",
        "Complete harvest training": "కోత శిక్షణ పూర్తి చేయండి",
        "Finish maturity, cutting and low-loss threshing lessons.": "పక్వం, కోత మరియు తక్కువ నష్టంతో నూర్పిడి పాఠాలను పూర్తి చేయండి.",
        "Create produce storage plan": "పంట ఉత్పత్తి నిల్వ ప్రణాళికను రూపొందించండి",
        "Plan drying, grading, bags, ventilation and pest-free storage before harvest.": "కోతకు ముందు ఎండబెట్టడం, గ్రేడింగ్, సంచులు, గాలి ప్రసరణ మరియు పురుగులు లేని నిల్వను ప్రణాళిక చేయండి.",
        "Complete preservation training": "నిల్వ పరిరక్షణ శిక్షణ పూర్తి చేయండి",
        "Finish the drying, storage and preservation lessons.": "ఎండబెట్టడం, నిల్వ మరియు పరిరక్షణ పాఠాలను పూర్తి చేయండి.",
        "Complete value-creation training": "విలువ సృష్టి శిక్షణ పూర్తి చేయండి",
        "Learn cleaning, grading, processing and by-product options.": "శుభ్రపరచడం, గ్రేడింగ్, ప్రాసెసింగ్ మరియు ఉప ఉత్పత్తుల అవకాశాలను నేర్చుకోండి.",
        "OBSERVED": "పరిశీలితం",
        "DERIVED": "ఉత్పన్నం"
    ]

    private static let hindi: [String: String] = [
        "Paddy field east": "पूर्वी धान खेत",
        "Chilli block A": "मिर्च ब्लॉक A",
        "Cotton stretch (west)": "पश्चिमी कपास क्षेत्र",
        "Guntur Chilli Growers FPO": "गुंटूर मिर्च उत्पादक FPO",
        "Borewell + canal": "बोरवेल + नहर",
        "owner": "मालिक",
        "Date of birth": "जन्म तिथि",
        "Social category": "सामाजिक वर्ग",
        "Ownership": "स्वामित्व",
        "Irrigation": "सिंचाई",
        "Bank": "बैंक",
        "Farmer confirmed": "किसान द्वारा पुष्टि",
        "Farmer entered": "किसान द्वारा दर्ज",
        "Owner": "मालिक",
        "Bank passbook": "बैंक पासबुक",
        "Land record": "भूमि रिकॉर्ड",
        "Identity proof": "पहचान प्रमाण",
        "Confirmed": "पुष्टि हुई",
        "Farmer": "किसान",
        "Draft": "मसौदा",
        "Identity step": "पहचान चरण",
        "Organisation step": "संगठन चरण",
        "Field agent": "क्षेत्र प्रतिनिधि",
        "Bank officer": "बैंक अधिकारी",
        "Insurer officer": "बीमा अधिकारी",
        "Knowledge reviewer": "ज्ञान समीक्षक",
        "Institution step": "संस्थान चरण",
        "Direct-seeded on two acres to save labour.": "मजदूरी बचाने के लिए दो एकड़ में सीधी बुवाई की।",
        "Drone spraying trialled through the FPO.": "FPO के माध्यम से ड्रोन छिड़काव का परीक्षण किया।",
        "Pink bollworm scouting from flowering.": "फूल आने से गुलाबी सुंडी की निगरानी की।",
        "Held stock for three weeks; price improved.": "तीन सप्ताह भंडारण से मूल्य बेहतर हुआ।",
        "Best paddy season so far.": "अब तक का सबसे अच्छा धान सीज़न।",
        "Grown on the cotton block after harvest.": "कपास कटाई के बाद उसी ब्लॉक में उगाया।",
        "Late-season inundation cut the yield.": "सीज़न के अंत में जलभराव से उपज घटी।",
        "Thrips pressure managed with two extra sprays.": "दो अतिरिक्त छिड़काव से थ्रिप्स नियंत्रित किए।",
        "Good canal supply through the season.": "पूरे सीज़न नहर आपूर्ति अच्छी रही।",
        "Sold to local trader.": "स्थानीय व्यापारी को बेचा।",
        "Covered • PMFBY": "बीमित • PMFBY",
        "Partially covered • PMFBY": "आंशिक बीमा • PMFBY",
        "Village": "गाँव",
        "Synthetic location code": "सिंथेटिक स्थान कोड",
        "Block / mandal": "ब्लॉक / मंडल",
        "Not recorded": "दर्ज नहीं",
        "Farmer profile gap": "किसान प्रोफ़ाइल में कमी",
        "District": "जिला",
        "Guntur (synthetic)": "गुंटूर (सिंथेटिक)",
        "State": "राज्य",
        "Andhra Pradesh (synthetic)": "आंध्र प्रदेश (सिंथेटिक)",
        "Centroid": "केंद्र बिंदु",
        "Agro-climatic zone": "कृषि-जलवायु क्षेत्र",
        "Andhra Pradesh synthetic agro-climatic zone": "आंध्र प्रदेश सिंथेटिक कृषि-जलवायु क्षेत्र",
        "VALIDATE mapping before field use": "खेत में उपयोग से पहले मैपिंग सत्यापित करें",
        "Season basis": "सीज़न आधार",
        "Kharif (monsoon)": "खरीफ (मानसून)",
        "Sowing Jun–Jul • harvest Oct–Nov": "बुवाई जून–जुलाई • कटाई अक्टूबर–नवंबर",
        "Major soils": "प्रमुख मिट्टियाँ",
        "Mixed red and black soils": "मिश्रित लाल और काली मिट्टी",
        "Location-derived synthetic district reference": "स्थान-आधारित सिंथेटिक जिला संदर्भ",
        "Common irrigation": "सामान्य सिंचाई",
        "Borewell, rainfed": "बोरवेल, वर्षा आधारित",
        "Farmer soil test": "किसान मिट्टी परीक्षण",
        "Not linked": "जुड़ा नहीं",
        "No Soil Health Card or laboratory result is available": "मृदा स्वास्थ्य कार्ड या प्रयोगशाला परिणाम उपलब्ध नहीं है",
        "Major soil types": "प्रमुख मिट्टी प्रकार",
        "Location-derived": "स्थान से प्राप्त",
        "Typical texture": "सामान्य बनावट",
        "Loam": "दोमट",
        "Typical pH range": "सामान्य pH सीमा",
        "Reference range, not a parcel reading": "संदर्भ सीमा; पार्सल माप नहीं",
        "Organic carbon": "जैविक कार्बन",
        "Draft allocation": "मसौदा आवंटन",
        "Soil-test readiness": "मिट्टी परीक्षण तैयारी",
        "Action needed": "कार्रवाई आवश्यक",
        "Water plan": "जल योजना",
        "Insurance review": "बीमा समीक्षा",
        "Pending": "लंबित",
        "Market reference": "बाज़ार संदर्भ",
        "LAND PREPARATION & SOWING": "भूमि तैयारी और बुवाई",
        "Land preparation and sowing": "भूमि तैयारी और बुवाई",
        "Field preparation, seed selection, seed treatment, spacing and sowing windows for AP/Telangana conditions.": "एपी/तेलंगाना के लिए खेत तैयारी, बीज चयन, बीज उपचार, दूरी और बुवाई समय।",
        "Prepare the field": "खेत तैयार करें",
        "Choose and treat the seed": "बीज चुनें और उपचार करें",
        "Sow at the right time and spacing": "सही समय और दूरी पर बोएँ",
        "CROP PROTECTION": "फसल सुरक्षा",
        "Crop protection methods": "फसल सुरक्षा विधियाँ",
        "Scouting, thresholds, integrated pest management and safe spraying practice.": "निगरानी, सीमा, समेकित कीट प्रबंधन और सुरक्षित छिड़काव।",
        "Scout the field weekly": "हर सप्ताह खेत देखें",
        "Use integrated pest management first": "पहले समेकित कीट प्रबंधन अपनाएँ",
        "Spray safely": "सुरक्षित छिड़काव करें",
        "HARVEST & CROP CUTTING": "कटाई और फसल काटना",
        "Harvest and crop cutting": "कटाई और फसल काटना",
        "Maturity signs, cutting method, moisture at harvest and threshing losses.": "पकने के संकेत, कटाई विधि, कटाई की नमी और मड़ाई हानि।",
        "Judge maturity correctly": "पकाव सही पहचानें",
        "Cut and thresh with low loss": "कम हानि से काटें और मड़ाई करें",
        "POST-HARVEST": "कटाई के बाद",
        "Drying, storage and preservation": "सुखाना, भंडारण और संरक्षण",
        "Drying to safe moisture, grading, bagging, aeration and pest-free storage.": "सुरक्षित नमी तक सुखाना, ग्रेडिंग, बोरी भरना, वायु संचार और कीट-मुक्त भंडारण।",
        "Dry to safe moisture": "सुरक्षित नमी तक सुखाएँ",
        "Store pest-free": "कीट-मुक्त भंडारण करें",
        "VALUE CREATION": "मूल्य सृजन",
        "Value creation from produce": "उपज से मूल्य सृजन",
        "Cleaning, grading, primary processing and by-product value.": "सफाई, ग्रेडिंग, प्राथमिक प्रसंस्करण और उप-उत्पाद मूल्य।",
        "Clean and grade": "साफ और ग्रेड करें",
        "Primary processing and by-products": "प्राथमिक प्रसंस्करण और उप-उत्पाद",
        "Paddy • nutrient plan": "धान • पोषण योजना",
        "Chilli • nutrient plan": "मिर्च • पोषण योजना",
        "Cotton • nutrient plan": "कपास • पोषण योजना",
        "Paddy • high-priority protection": "धान • उच्च प्राथमिकता सुरक्षा",
        "Chilli • high-priority protection": "मिर्च • उच्च प्राथमिकता सुरक्षा",
        "Cotton • high-priority protection": "कपास • उच्च प्राथमिकता सुरक्षा",
        "Build organic matter every season": "हर सीज़न जैविक पदार्थ बढ़ाएँ",
        "Green manure and cover crops": "हरी खाद और आवरण फसलें",
        "Mulch the surface": "सतह पर मल्च करें",
        "Rotate with a legume": "दलहनी फसल से चक्र बदलें",
        "Correct sodic soil with gypsum": "सोडिक मिट्टी को जिप्सम से सुधारें",
        "Correct acidic soil with lime": "अम्लीय मिट्टी को चूने से सुधारें",
        "Irrigate to hold nutrients": "पोषक तत्व रोकने हेतु सिंचाई करें",
        "Bunds and contour cultivation on slopes": "ढलान पर मेड़ और कंटूर खेती",
        "Paddy": "धान",
        "Chilli": "मिर्च",
        "Cotton": "कपास",
        "Maize": "मक्का",
        "Cleaned & dried paddy": "साफ और सूखा धान",
        "Brown rice": "भूरा चावल",
        "Polished rice": "पॉलिश चावल",
        "Low": "कम",
        "Base": "आधार",
        "High": "उच्च",
        "Soil testing": "मिट्टी परीक्षण",
        "Extension": "कृषि विस्तार",
        "Machinery": "मशीनरी",
        "Logistics": "परिवहन सेवाएँ",
        "FPO CEO desk": "FPO सीईओ डेस्क",
        "Lab in-charge": "प्रयोगशाला प्रभारी",
        "Extension scientist": "कृषि विस्तार वैज्ञानिक",
        "CHC manager": "CHC प्रबंधक",
        "Dispatch desk": "प्रेषण डेस्क",
        "Synthetic directory": "सिंथेटिक निर्देशिका",
        "Plan & insure": "योजना और बीमा",
        "Confirm coverage and prepare evidence": "बीमा की पुष्टि करें और प्रमाण तैयार रखें",
        "Sow & establish": "बुवाई और स्थापना",
        "Start every parcel correctly": "हर खेत की सही शुरुआत करें",
        "Water & nourish": "सिंचाई और पोषण",
        "Apply water and nutrients on time": "पानी और पोषक तत्व समय पर दें",
        "Protect crop": "फसल सुरक्षा",
        "Scout early and act safely": "जल्दी निरीक्षण करें और सुरक्षित कार्रवाई करें",
        "Protect soil": "मिट्टी संरक्षण",
        "Preserve moisture and topsoil": "नमी और ऊपरी मिट्टी बचाएँ",
        "Harvest & preserve": "कटाई और संरक्षण",
        "Protect quality after maturity": "पकने के बाद गुणवत्ता बचाएँ",
        "Verify paddy insurance cover": "धान बीमा कवर सत्यापित करें",
        "PMFBY record is available; confirm dates and sum insured with the authorised desk.": "PMFBY रिकॉर्ड उपलब्ध है; अधिकृत केंद्र पर तारीख और बीमित राशि की पुष्टि करें।",
        "Review chilli and cotton insurance": "मिर्च और कपास बीमा की समीक्षा करें",
        "Confirm whether both crops are notified before the enrolment window closes.": "नामांकन अवधि बंद होने से पहले दोनों फसलों की अधिसूचना जाँचें।",
        "Complete parcel soil test": "हर खेत की मिट्टी जाँच पूरी करें",
        "No parcel-level laboratory result is linked; collect and submit a representative sample.": "खेत-स्तर की प्रयोगशाला रिपोर्ट जुड़ी नहीं है; उचित नमूना लेकर जमा करें।",
        "Confirm crop and input plan": "फसल और इनपुट योजना की पुष्टि करें",
        "The three-parcel allocation is recorded for the current season.": "वर्तमान मौसम के लिए तीन खेतों का आवंटन दर्ज है।",
        "Prepare land and drainage": "भूमि और जल निकासी तैयार करें",
        "Field preparation is recorded; keep drainage channels open before forecast rain.": "खेत तैयारी दर्ज है; अनुमानित वर्षा से पहले नालियाँ खुली रखें।",
        "Treat seed before sowing": "बुवाई से पहले बीज उपचार करें",
        "Seed-treatment activity is recorded for the pilot.": "पायलट के लिए बीज उपचार दर्ज है।",
        "Record sowing date and spacing": "बुवाई की तारीख और दूरी दर्ज करें",
        "Sowing is recorded; exact dates still need farmer confirmation.": "बुवाई दर्ज है; सही तारीखों की किसान पुष्टि बाकी है।",
        "Complete sowing-stage training": "बुवाई चरण का प्रशिक्षण पूरा करें",
        "Finish all three land-preparation and sowing lessons.": "भूमि तैयारी और बुवाई के तीनों पाठ पूरे करें।",
        "Check irrigation and field moisture": "सिंचाई और खेत की नमी जाँचें",
        "Inspect each parcel today; avoid watering where forecast rain is adequate.": "आज हर खेत जाँचें; पर्याप्त वर्षा अनुमान हो तो सिंचाई न करें।",
        "Apply organic manure": "जैविक खाद डालें",
        "Organic-manure application is recorded; retain the field receipt or note.": "जैविक खाद का उपयोग दर्ज है; खेत की रसीद या नोट सुरक्षित रखें।",
        "Adjust top-dressing after rain": "बारिश के बाद ऊपरी खाद समायोजित करें",
        "Recheck field moisture and postpone nitrogen application during heavy rain.": "नमी फिर जाँचें और भारी वर्षा में नाइट्रोजन का प्रयोग टालें।",
        "Scout every parcel": "हर खेत का निरीक्षण करें",
        "Check paddy, chilli and cotton for pest or disease signs and record observations.": "धान, मिर्च और कपास में कीट या रोग के संकेत देखकर दर्ज करें।",
        "Prepare an IPM response": "समेकित कीट प्रबंधन कार्रवाई तैयार करें",
        "Use thresholds and authorised guidance before any crop-protection treatment.": "किसी भी फसल-सुरक्षा उपचार से पहले सीमा और अधिकृत मार्गदर्शन अपनाएँ।",
        "Complete crop-protection training": "फसल-सुरक्षा प्रशिक्षण पूरा करें",
        "Finish scouting, IPM and safe-spraying lessons.": "निरीक्षण, IPM और सुरक्षित छिड़काव के पाठ पूरे करें।",
        "Inspect bunds and runoff paths": "मेड़ों और बहाव मार्गों की जाँच करें",
        "Repair weak bunds and prevent topsoil loss before the next rainfall.": "अगली वर्षा से पहले कमजोर मेड़ सुधारें और ऊपरी मिट्टी बचाएँ।",
        "Mulch or retain suitable residue": "मल्च करें या उचित अवशेष रखें",
        "Cover exposed soil where agronomically appropriate to reduce evaporation.": "वाष्पीकरण घटाने के लिए उचित स्थान पर खुली मिट्टी ढकें।",
        "Prepare harvest and moisture checks": "कटाई और नमी जाँच की तैयारी करें",
        "Open this stage when the crop approaches maturity.": "फसल पकने के करीब हो तब यह चरण शुरू करें।",
        "Complete harvest training": "कटाई प्रशिक्षण पूरा करें",
        "Finish maturity, cutting and low-loss threshing lessons.": "पकाव, कटाई और कम-हानि मड़ाई के पाठ पूरे करें।",
        "Create produce storage plan": "उपज भंडारण योजना बनाएँ",
        "Plan drying, grading, bags, ventilation and pest-free storage before harvest.": "कटाई से पहले सुखाने, ग्रेडिंग, बोरे, हवा और कीट-मुक्त भंडारण की योजना बनाएँ।",
        "Complete preservation training": "संरक्षण प्रशिक्षण पूरा करें",
        "Finish the drying, storage and preservation lessons.": "सुखाने, भंडारण और संरक्षण के पाठ पूरे करें।",
        "Complete value-creation training": "मूल्य-सृजन प्रशिक्षण पूरा करें",
        "Learn cleaning, grading, processing and by-product options.": "सफाई, ग्रेडिंग, प्रसंस्करण और उप-उत्पाद विकल्प सीखें।",
        "OBSERVED": "अवलोकित",
        "DERIVED": "व्युत्पन्न"
    ]

    private static let tamil: [String: String] = [
        "Paddy field east": "கிழக்கு நெல் வயல்",
        "Chilli block A": "மிளகாய் பகுதி A",
        "Cotton stretch (west)": "மேற்கு பருத்திப் பகுதி",
        "Guntur Chilli Growers FPO": "குண்டூர் மிளகாய் உற்பத்தியாளர் FPO",
        "Borewell + canal": "ஆழ்துளைக் கிணறு + கால்வாய்",
        "owner": "உரிமையாளர்",
        "Date of birth": "பிறந்த தேதி",
        "Social category": "சமூகப் பிரிவு",
        "Ownership": "உரிமை",
        "Irrigation": "பாசனம்",
        "Bank": "வங்கி",
        "Farmer confirmed": "விவசாயி உறுதிப்படுத்தியது",
        "Farmer entered": "விவசாயி பதிவு செய்தது",
        "Owner": "உரிமையாளர்",
        "Bank passbook": "வங்கி கணக்குப் புத்தகம்",
        "Land record": "நிலப் பதிவு",
        "Identity proof": "அடையாளச் சான்று",
        "Confirmed": "உறுதிப்படுத்தப்பட்டது",
        "Farmer": "விவசாயி",
        "Draft": "வரைவு",
        "Identity step": "அடையாள நிலை",
        "Organisation step": "அமைப்பு நிலை",
        "Field agent": "களப் பிரதிநிதி",
        "Bank officer": "வங்கி அதிகாரி",
        "Insurer officer": "காப்பீட்டு அதிகாரி",
        "Knowledge reviewer": "அறிவு மதிப்பாய்வாளர்",
        "Institution step": "நிறுவன நிலை",
        "Direct-seeded on two acres to save labour.": "தொழிலாளர் செலவைக் குறைக்க இரண்டு ஏக்கரில் நேரடி விதைப்பு செய்யப்பட்டது.",
        "Drone spraying trialled through the FPO.": "FPO மூலம் ட்ரோன் தெளிப்பு சோதிக்கப்பட்டது.",
        "Pink bollworm scouting from flowering.": "பூக்கும் பருவத்திலிருந்து இளஞ்சிவப்பு காய்ப்புழு கண்காணிக்கப்பட்டது.",
        "Held stock for three weeks; price improved.": "மூன்று வாரம் சேமித்ததால் விலை உயர்ந்தது.",
        "Best paddy season so far.": "இதுவரை சிறந்த நெல் பருவம்.",
        "Grown on the cotton block after harvest.": "பருத்தி அறுவடைக்குப் பிறகு அதே பகுதியில் பயிரிடப்பட்டது.",
        "Late-season inundation cut the yield.": "பருவ இறுதி நீர்த்தேக்கத்தால் விளைச்சல் குறைந்தது.",
        "Thrips pressure managed with two extra sprays.": "இரண்டு கூடுதல் தெளிப்புகளால் த்ரிப்ஸ் கட்டுப்படுத்தப்பட்டது.",
        "Good canal supply through the season.": "பருவம் முழுவதும் கால்வாய் நீர் நன்றாகக் கிடைத்தது.",
        "Sold to local trader.": "உள்ளூர் வணிகரிடம் விற்கப்பட்டது.",
        "Covered • PMFBY": "காப்பீடு உள்ளது • PMFBY",
        "Partially covered • PMFBY": "பகுதி காப்பீடு • PMFBY",
        "Village": "கிராமம்",
        "Synthetic location code": "செயற்கை இடக் குறியீடு",
        "Block / mandal": "வட்டாரம் / மண்டலம்",
        "Not recorded": "பதிவு செய்யப்படவில்லை",
        "Farmer profile gap": "விவசாயி சுயவிவரக் குறை",
        "District": "மாவட்டம்",
        "Guntur (synthetic)": "குண்டூர் (செயற்கை)",
        "State": "மாநிலம்",
        "Andhra Pradesh (synthetic)": "ஆந்திரப் பிரதேசம் (செயற்கை)",
        "Centroid": "மையப்புள்ளி",
        "Agro-climatic zone": "வேளாண்-காலநிலை மண்டலம்",
        "Andhra Pradesh synthetic agro-climatic zone": "ஆந்திரப் பிரதேச செயற்கை வேளாண்-காலநிலை மண்டலம்",
        "VALIDATE mapping before field use": "வயலில் பயன்படுத்தும் முன் வரைபடத்தைச் சரிபார்க்கவும்",
        "Season basis": "பருவ அடிப்படை",
        "Kharif (monsoon)": "காரிஃப் (பருவமழை)",
        "Sowing Jun–Jul • harvest Oct–Nov": "விதைப்பு ஜூன்–ஜூலை • அறுவடை அக்டோபர்–நவம்பர்",
        "Major soils": "முக்கிய மண் வகைகள்",
        "Mixed red and black soils": "கலப்பு சிவப்பு மற்றும் கருப்பு மண்",
        "Location-derived synthetic district reference": "இடம் சார்ந்த செயற்கை மாவட்டக் குறிப்பு",
        "Common irrigation": "பொதுவான பாசனம்",
        "Borewell, rainfed": "ஆழ்துளைக் கிணறு, மானாவாரி",
        "Farmer soil test": "விவசாயி மண் பரிசோதனை",
        "Not linked": "இணைக்கப்படவில்லை",
        "No Soil Health Card or laboratory result is available": "மண் ஆரோக்கிய அட்டை அல்லது ஆய்வக முடிவு இல்லை",
        "Major soil types": "முக்கிய மண் வகைகள்",
        "Location-derived": "இடத்திலிருந்து பெறப்பட்டது",
        "Typical texture": "வழக்கமான மண் தன்மை",
        "Loam": "வண்டல் மண்",
        "Typical pH range": "வழக்கமான pH வரம்பு",
        "Reference range, not a parcel reading": "குறிப்பு வரம்பு; நிலத்துண்டு அளவீடு அல்ல",
        "Organic carbon": "கரிம கார்பன்",
        "Draft allocation": "வரைவு ஒதுக்கீடு",
        "Soil-test readiness": "மண் பரிசோதனை தயார்நிலை",
        "Action needed": "நடவடிக்கை தேவை",
        "Water plan": "நீர்த் திட்டம்",
        "Insurance review": "காப்பீட்டு மதிப்பாய்வு",
        "Pending": "நிலுவையில்",
        "Market reference": "சந்தைக் குறிப்பு",
        "LAND PREPARATION & SOWING": "நிலத் தயாரிப்பு & விதைப்பு",
        "Land preparation and sowing": "நிலத் தயாரிப்பு மற்றும் விதைப்பு",
        "Field preparation, seed selection, seed treatment, spacing and sowing windows for AP/Telangana conditions.": "ஆந்திரா/தெலங்கானா நிலைக்கு வயல் தயாரிப்பு, விதைத் தேர்வு, விதை நேர்த்தி, இடைவெளி மற்றும் விதைப்புக் காலம்.",
        "Prepare the field": "வயலைத் தயார் செய்யவும்",
        "Choose and treat the seed": "விதையைத் தேர்ந்து நேர்த்தி செய்யவும்",
        "Sow at the right time and spacing": "சரியான நேரம் மற்றும் இடைவெளியில் விதைக்கவும்",
        "CROP PROTECTION": "பயிர்ப் பாதுகாப்பு",
        "Crop protection methods": "பயிர்ப் பாதுகாப்பு முறைகள்",
        "Scouting, thresholds, integrated pest management and safe spraying practice.": "களக் கண்காணிப்பு, வரம்புகள், ஒருங்கிணைந்த பூச்சி மேலாண்மை மற்றும் பாதுகாப்பான தெளிப்பு.",
        "Scout the field weekly": "வாரந்தோறும் வயலைக் கண்காணிக்கவும்",
        "Use integrated pest management first": "முதலில் ஒருங்கிணைந்த பூச்சி மேலாண்மையைப் பயன்படுத்தவும்",
        "Spray safely": "பாதுகாப்பாகத் தெளிக்கவும்",
        "HARVEST & CROP CUTTING": "அறுவடை & பயிர் வெட்டுதல்",
        "Harvest and crop cutting": "அறுவடை மற்றும் பயிர் வெட்டுதல்",
        "Maturity signs, cutting method, moisture at harvest and threshing losses.": "முதிர்ச்சி அறிகுறிகள், வெட்டும் முறை, அறுவடை ஈரம் மற்றும் கதிரடிப்பு இழப்புகள்.",
        "Judge maturity correctly": "முதிர்ச்சியைச் சரியாக மதிப்பிடவும்",
        "Cut and thresh with low loss": "குறைந்த இழப்புடன் வெட்டி கதிரடிக்கவும்",
        "POST-HARVEST": "அறுவடைக்குப் பின்",
        "Drying, storage and preservation": "உலர்த்தல், சேமிப்பு மற்றும் பாதுகாப்பு",
        "Drying to safe moisture, grading, bagging, aeration and pest-free storage.": "பாதுகாப்பான ஈரம் வரை உலர்த்தல், தரப்படுத்தல், மூட்டையிடல், காற்றோட்டம் மற்றும் பூச்சியற்ற சேமிப்பு.",
        "Dry to safe moisture": "பாதுகாப்பான ஈரம் வரை உலர்த்தவும்",
        "Store pest-free": "பூச்சியின்றி சேமிக்கவும்",
        "VALUE CREATION": "மதிப்பு உருவாக்கம்",
        "Value creation from produce": "விளைபொருளிலிருந்து மதிப்பு உருவாக்கம்",
        "Cleaning, grading, primary processing and by-product value.": "சுத்தம் செய்தல், தரப்படுத்தல், முதன்மை செயலாக்கம் மற்றும் துணைப் பொருள் மதிப்பு.",
        "Clean and grade": "சுத்தம் செய்து தரப்படுத்தவும்",
        "Primary processing and by-products": "முதன்மை செயலாக்கம் மற்றும் துணைப் பொருட்கள்",
        "Paddy • nutrient plan": "நெல் • ஊட்டச்சத்துத் திட்டம்",
        "Chilli • nutrient plan": "மிளகாய் • ஊட்டச்சத்துத் திட்டம்",
        "Cotton • nutrient plan": "பருத்தி • ஊட்டச்சத்துத் திட்டம்",
        "Paddy • high-priority protection": "நெல் • உயர் முன்னுரிமைப் பாதுகாப்பு",
        "Chilli • high-priority protection": "மிளகாய் • உயர் முன்னுரிமைப் பாதுகாப்பு",
        "Cotton • high-priority protection": "பருத்தி • உயர் முன்னுரிமைப் பாதுகாப்பு",
        "Build organic matter every season": "ஒவ்வொரு பருவத்திலும் கரிமப் பொருளை அதிகரிக்கவும்",
        "Green manure and cover crops": "பசுந்தாள் உரம் மற்றும் மூடாக்குப் பயிர்கள்",
        "Mulch the surface": "மேற்பரப்பில் மூடாக்கு இடவும்",
        "Rotate with a legume": "பயறு வகையுடன் பயிர்ச் சுழற்சி செய்யவும்",
        "Correct sodic soil with gypsum": "சோடிக் மண்ணை ஜிப்சம் கொண்டு திருத்தவும்",
        "Correct acidic soil with lime": "அமில மண்ணை சுண்ணாம்பு கொண்டு திருத்தவும்",
        "Irrigate to hold nutrients": "ஊட்டச்சத்தைத் தக்கவைக்கப் பாசனம் செய்யவும்",
        "Bunds and contour cultivation on slopes": "சரிவுகளில் வரப்பு மற்றும் சமமட்டச் சாகுபடி",
        "Paddy": "நெல்",
        "Chilli": "மிளகாய்",
        "Cotton": "பருத்தி",
        "Maize": "மக்காச்சோளம்",
        "Cleaned & dried paddy": "சுத்தம் செய்து உலர்த்திய நெல்",
        "Brown rice": "பழுப்பு அரிசி",
        "Polished rice": "தீட்டிய அரிசி",
        "Low": "குறைவு",
        "Base": "அடிப்படை",
        "High": "அதிகம்",
        "Soil testing": "மண் பரிசோதனை",
        "Extension": "வேளாண் விரிவாக்கம்",
        "Machinery": "இயந்திரங்கள்",
        "Logistics": "போக்குவரத்துச் சேவைகள்",
        "FPO CEO desk": "FPO தலைமை அலுவலகம்",
        "Lab in-charge": "ஆய்வகப் பொறுப்பாளர்",
        "Extension scientist": "வேளாண் விரிவாக்க விஞ்ஞானி",
        "CHC manager": "CHC மேலாளர்",
        "Dispatch desk": "அனுப்புகை மையம்",
        "Synthetic directory": "செயற்கை அடைவு",
        "Plan & insure": "திட்டம் மற்றும் காப்பீடு",
        "Confirm coverage and prepare evidence": "காப்பீட்டை உறுதி செய்து ஆதாரங்களைத் தயாரிக்கவும்",
        "Sow & establish": "விதைப்பு மற்றும் நிலைநிறுத்தம்",
        "Start every parcel correctly": "ஒவ்வொரு வயலையும் சரியாகத் தொடங்கவும்",
        "Water & nourish": "நீர்ப்பாசனம் மற்றும் ஊட்டம்",
        "Apply water and nutrients on time": "நீர் மற்றும் ஊட்டச்சத்துகளை நேரத்தில் அளிக்கவும்",
        "Protect crop": "பயிர் பாதுகாப்பு",
        "Scout early and act safely": "முன்கூட்டியே கண்காணித்து பாதுகாப்பாகச் செயல்படவும்",
        "Protect soil": "மண் பாதுகாப்பு",
        "Preserve moisture and topsoil": "ஈரப்பதத்தையும் மேல் மண்ணையும் பாதுகாக்கவும்",
        "Harvest & preserve": "அறுவடை மற்றும் பாதுகாப்பு",
        "Protect quality after maturity": "முதிர்ச்சிக்குப் பிறகு தரத்தைப் பாதுகாக்கவும்",
        "Verify paddy insurance cover": "நெல் காப்பீட்டை உறுதிப்படுத்தவும்",
        "PMFBY record is available; confirm dates and sum insured with the authorised desk.": "PMFBY பதிவு உள்ளது; தேதிகளையும் காப்பீட்டுத் தொகையையும் அங்கீகரிக்கப்பட்ட மையத்தில் உறுதிப்படுத்தவும்.",
        "Review chilli and cotton insurance": "மிளகாய் மற்றும் பருத்தி காப்பீட்டை ஆய்வு செய்யவும்",
        "Confirm whether both crops are notified before the enrolment window closes.": "பதிவுக் காலம் முடிவதற்கு முன் இரு பயிர்களும் அறிவிக்கப்பட்டுள்ளனவா என உறுதிப்படுத்தவும்.",
        "Complete parcel soil test": "ஒவ்வொரு வயலின் மண் பரிசோதனையையும் முடிக்கவும்",
        "No parcel-level laboratory result is linked; collect and submit a representative sample.": "வயல் அளவிலான ஆய்வக முடிவு இணைக்கப்படவில்லை; சரியான மாதிரியைச் சேகரித்து சமர்ப்பிக்கவும்.",
        "Confirm crop and input plan": "பயிர் மற்றும் இடுபொருள் திட்டத்தை உறுதிப்படுத்தவும்",
        "The three-parcel allocation is recorded for the current season.": "நடப்பு பருவத்திற்கான மூன்று வயல் ஒதுக்கீடு பதிவாகியுள்ளது.",
        "Prepare land and drainage": "நிலத்தையும் வடிகாலையும் தயாரிக்கவும்",
        "Field preparation is recorded; keep drainage channels open before forecast rain.": "வயல் தயாரிப்பு பதிவாகியுள்ளது; மழைக்கு முன் வடிகால்களைத் திறந்துவைக்கவும்.",
        "Treat seed before sowing": "விதைப்பதற்கு முன் விதை நேர்த்தி செய்யவும்",
        "Seed-treatment activity is recorded for the pilot.": "முன்னோட்டத்திற்கான விதை நேர்த்தி பதிவு செய்யப்பட்டுள்ளது.",
        "Record sowing date and spacing": "விதைத்த தேதி மற்றும் இடைவெளியைப் பதிவு செய்யவும்",
        "Sowing is recorded; exact dates still need farmer confirmation.": "விதைப்பு பதிவாகியுள்ளது; சரியான தேதிகளை விவசாயி உறுதிப்படுத்த வேண்டும்.",
        "Complete sowing-stage training": "விதைப்புக் கட்டப் பயிற்சியை முடிக்கவும்",
        "Finish all three land-preparation and sowing lessons.": "நிலத் தயாரிப்பு மற்றும் விதைப்பின் மூன்று பாடங்களையும் முடிக்கவும்.",
        "Check irrigation and field moisture": "பாசனம் மற்றும் வயல் ஈரப்பதத்தைச் சரிபார்க்கவும்",
        "Inspect each parcel today; avoid watering where forecast rain is adequate.": "இன்று ஒவ்வொரு வயலையும் பாருங்கள்; போதிய மழை இருந்தால் நீர்ப்பாசனம் செய்ய வேண்டாம்.",
        "Apply organic manure": "இயற்கை உரம் இடவும்",
        "Organic-manure application is recorded; retain the field receipt or note.": "இயற்கை உரப் பயன்பாடு பதிவாகியுள்ளது; ரசீது அல்லது குறிப்பை வைத்திருக்கவும்.",
        "Adjust top-dressing after rain": "மழைக்குப் பிறகு மேலுரத்தைச் சரிசெய்யவும்",
        "Recheck field moisture and postpone nitrogen application during heavy rain.": "மண் ஈரத்தை மீண்டும் பார்த்து கனமழையில் நைட்ரஜன் இடுவதைத் தள்ளிவைக்கவும்.",
        "Scout every parcel": "ஒவ்வொரு வயலையும் கண்காணிக்கவும்",
        "Check paddy, chilli and cotton for pest or disease signs and record observations.": "நெல், மிளகாய், பருத்தியில் பூச்சி அல்லது நோய் அறிகுறிகளைப் பார்த்துப் பதிவு செய்யவும்.",
        "Prepare an IPM response": "ஒருங்கிணைந்த பூச்சி மேலாண்மை நடவடிக்கையைத் தயாரிக்கவும்",
        "Use thresholds and authorised guidance before any crop-protection treatment.": "எந்தப் பயிர் பாதுகாப்பு நடவடிக்கைக்கும் முன் வரம்புகளையும் அங்கீகரிக்கப்பட்ட வழிகாட்டுதலையும் பின்பற்றவும்.",
        "Complete crop-protection training": "பயிர் பாதுகாப்புப் பயிற்சியை முடிக்கவும்",
        "Finish scouting, IPM and safe-spraying lessons.": "கண்காணிப்பு, IPM மற்றும் பாதுகாப்பான தெளிப்பு பாடங்களை முடிக்கவும்.",
        "Inspect bunds and runoff paths": "வரப்புகளையும் நீரோட்டப் பாதைகளையும் சரிபார்க்கவும்",
        "Repair weak bunds and prevent topsoil loss before the next rainfall.": "அடுத்த மழைக்கு முன் பலவீனமான வரப்புகளைச் சரிசெய்து மேல் மண் இழப்பைத் தடுக்கவும்.",
        "Mulch or retain suitable residue": "மூடாக்கு இடவும் அல்லது தகுந்த பயிர் எச்சத்தை வைத்திருக்கவும்",
        "Cover exposed soil where agronomically appropriate to reduce evaporation.": "ஆவியாதலைக் குறைக்க ஏற்ற இடங்களில் வெளிப்பட்ட மண்ணை மூடவும்.",
        "Prepare harvest and moisture checks": "அறுவடை மற்றும் ஈரப்பதச் சோதனையைத் தயாரிக்கவும்",
        "Open this stage when the crop approaches maturity.": "பயிர் முதிர்ச்சியை அணுகும்போது இந்தக் கட்டத்தைத் தொடங்கவும்.",
        "Complete harvest training": "அறுவடைப் பயிற்சியை முடிக்கவும்",
        "Finish maturity, cutting and low-loss threshing lessons.": "முதிர்ச்சி, அறுவடை மற்றும் குறைந்த இழப்பு கதிரடிப்பு பாடங்களை முடிக்கவும்.",
        "Create produce storage plan": "விளைபொருள் சேமிப்புத் திட்டத்தை உருவாக்கவும்",
        "Plan drying, grading, bags, ventilation and pest-free storage before harvest.": "அறுவடைக்கு முன் உலர்த்தல், தரப்படுத்தல், மூட்டைகள், காற்றோட்டம் மற்றும் பூச்சியற்ற சேமிப்பைத் திட்டமிடவும்.",
        "Complete preservation training": "பாதுகாப்புப் பயிற்சியை முடிக்கவும்",
        "Finish the drying, storage and preservation lessons.": "உலர்த்தல், சேமிப்பு மற்றும் பாதுகாப்புப் பாடங்களை முடிக்கவும்.",
        "Complete value-creation training": "மதிப்பூட்டல் பயிற்சியை முடிக்கவும்",
        "Learn cleaning, grading, processing and by-product options.": "சுத்தம் செய்தல், தரப்படுத்தல், செயலாக்கம் மற்றும் துணைப் பொருள் வாய்ப்புகளை கற்கவும்.",
        "OBSERVED": "கண்காணிக்கப்பட்டது",
        "DERIVED": "பெறப்பட்டது"
    ]

    static func text(_ source: String, language: AppLanguage) -> String {
        guard language != .english else { return source }
        let table: [String: String]
        switch language {
        case .telugu: table = telugu
        case .hindi: table = hindi
        case .tamil: table = tamil
        case .english: return source
        }

        var value = table[source] ?? source
        let wordReplacements: [(String, String)]
        switch language {
        case .telugu:
            wordReplacements = [
                ("Paddy", "వరి"), ("Chilli", "మిరప"), ("Cotton", "పత్తి"), ("Maize", "మొక్కజొన్న"),
                ("Kharif", "ఖరీఫ్"), ("Rabi", "రబీ"), (" ac", " ఎకరాలు"), ("/ac", "/ఎకరం"), ("/q", "/క్వింటాల్"), (" q", " క్వింటాళ్లు")
            ]
        case .hindi:
            wordReplacements = [
                ("Paddy", "धान"), ("Chilli", "मिर्च"), ("Cotton", "कपास"), ("Maize", "मक्का"),
                ("Kharif", "खरीफ"), ("Rabi", "रबी"), (" ac", " एकड़"), ("/ac", "/एकड़"), ("/q", "/क्विंटल"), (" q", " क्विंटल")
            ]
        case .tamil:
            wordReplacements = [
                ("Paddy", "நெல்"), ("Chilli", "மிளகாய்"), ("Cotton", "பருத்தி"), ("Maize", "மக்காச்சோளம்"),
                ("Kharif", "காரிஃப்"), ("Rabi", "ரபி"), (" ac", " ஏக்கர்"), ("/ac", "/ஏக்கர்"), ("/q", "/குவிண்டால்"), (" q", " குவிண்டால்")
            ]
        case .english:
            wordReplacements = []
        }
        for (english, localized) in wordReplacements {
            value = value.replacingOccurrences(of: english, with: localized)
        }
        return value
    }
}

enum PilotContract {
    static let localeIdentifier = "te-IN"
    static let minimumIOSVersion = "17.0"
    static let apiPrefix = "/mobile/v1"
    static let consentVersion = "mobile-consent-2026-08-v1"
    static let policyVersion = "2026-08-baseline-v1"
    static let snapshotVersion = "guntur-kaza-ios-intelligence-history-2026-09-03-v1"
    static let snapshotCapturedAt = "01-09-2026"
    static let totalAcres = Decimal(string: "18.20")!
    static let sandboxStaticOTP = "123456"
    static let sandboxFarmerName = "Ramesh Naidu Vemuri"
    static let sandboxFarmerGender = "male"
    static let pilotDistrict = "Guntur (synthetic)"
    static let pilotState = "Andhra Pradesh (synthetic)"
    static let pilotCluster = "Kaza cluster"
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
        SnapshotItem(id: "dob", title: "Date of birth", detail: "12-04-1979", meta: "Farmer confirmed"),
        SnapshotItem(id: "category", title: "Social category", detail: "OBC", meta: "Farmer entered"),
        SnapshotItem(id: "ownership", title: "Ownership", detail: "Owner", meta: "Farmer confirmed"),
        SnapshotItem(id: "irrigation", title: "Irrigation", detail: irrigation, meta: "Farmer entered"),
        SnapshotItem(id: "bank", title: "Bank", detail: "Andhra Grameena Vikas Bank (synthetic) • Kaza", meta: "A/c •••• 4821 • IFSC ANDB0001234")
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

    static let locationDetails: [SnapshotItem] = [
        SnapshotItem(id: "village", title: "Village", detail: pilotVillageCode, meta: "Synthetic location code"),
        SnapshotItem(id: "mandal", title: "Block / mandal", detail: "Not recorded", meta: "Farmer profile gap"),
        SnapshotItem(id: "district", title: "District", detail: "Guntur (synthetic)", meta: "synthetic:icar-crida-district-profile"),
        SnapshotItem(id: "state", title: "State", detail: "Andhra Pradesh (synthetic)", meta: "synthetic:icar-crida-district-profile"),
        SnapshotItem(id: "centroid", title: "Centroid", detail: "16.3072, 80.4482", meta: "Selected parcel: GNT-KAZA-114/2"),
        SnapshotItem(id: "zone", title: "Agro-climatic zone", detail: "Andhra Pradesh synthetic agro-climatic zone", meta: "VALIDATE mapping before field use")
    ]

    static let seasonDetails: [SnapshotItem] = [
        SnapshotItem(id: "season", title: "Season basis", detail: "Kharif (monsoon)", meta: "Sowing Jun–Jul • harvest Oct–Nov"),
        SnapshotItem(id: "major-soils", title: "Major soils", detail: "Mixed red and black soils", meta: "Location-derived synthetic district reference"),
        SnapshotItem(id: "common-irrigation", title: "Common irrigation", detail: "Borewell, rainfed", meta: "District reference; farmer record says borewell + canal")
    ]

    static let soilSnapshot: [SnapshotItem] = [
        SnapshotItem(id: "test", title: "Farmer soil test", detail: "Not linked", meta: "No Soil Health Card or laboratory result is available"),
        SnapshotItem(id: "soil-type", title: "Major soil types", detail: "Mixed red and black soils", meta: "Location-derived"),
        SnapshotItem(id: "texture", title: "Typical texture", detail: "Loam", meta: "Synthetic district reference; confirm by lab test"),
        SnapshotItem(id: "ph", title: "Typical pH range", detail: "6.5–8.2", meta: "Reference range, not a parcel reading"),
        SnapshotItem(id: "carbon", title: "Organic carbon", detail: "0.35–0.62%", meta: "Reference range, not a parcel reading")
    ]

    static let cropPlanningSnapshot: [SnapshotItem] = [
        SnapshotItem(id: "paddy-plan", title: "Paddy • GNT-KAZA-114/2", detail: "8.40 ac • suitability 86/100", meta: "DERIVED: climate, soil, irrigation and market factors"),
        SnapshotItem(id: "chilli-plan", title: "Chilli • GNT-KAZA-98/1", detail: "5.60 ac • suitability 78/100", meta: "DERIVED: climate, soil, irrigation and market factors"),
        SnapshotItem(id: "cotton-plan", title: "Cotton • GNT-KAZA-77/4", detail: "4.20 ac • suitability 74/100", meta: "DERIVED: climate, soil, irrigation and market factors")
    ]

    static let marketQuotes: [MarketQuote] = [
        MarketQuote(id: "paddy", crop: "Paddy", variety: "MTU-1061", grade: "FAQ", minimumPrice: "₹2,020/q", modalPrice: "₹2,150/q", maximumPrice: "₹2,230/q", arrivals: "1,720 q", source: "synthetic:agmarknet"),
        MarketQuote(id: "chilli", crop: "Chilli", variety: "Teja", grade: "Grade-1", minimumPrice: "₹14,500/q", modalPrice: "₹16,200/q", maximumPrice: "₹17,800/q", arrivals: "620 q", source: "synthetic:enam"),
        MarketQuote(id: "cotton", crop: "Cotton", variety: "Medium Staple", grade: "FAQ", minimumPrice: "₹6,900/q", modalPrice: "₹7,350/q", maximumPrice: "₹7,700/q", arrivals: "760 q", source: "synthetic:agmarknet")
    ]

    static let valueAddSteps: [ValueAddStep] = [
        ValueAddStep(id: 1, input: "Paddy", output: "Cleaned & dried paddy", recovery: "96%", processingCost: "₹120/q", byProducts: "Chaff 4%"),
        ValueAddStep(id: 2, input: "Cleaned & dried paddy", output: "Brown rice", recovery: "78%", processingCost: "₹150/q", byProducts: "Husk 20% • ₹180/q"),
        ValueAddStep(id: 3, input: "Brown rice", output: "Polished rice", recovery: "92%", processingCost: "₹210/q", byProducts: "Bran 6% • ₹2,200/q; broken rice 2% • ₹1,900/q")
    ]

    static let outcomeScenarios: [OutcomeScenario] = [
        OutcomeScenario(id: "low", label: "Low", yield: "176 q", sellingPrice: "₹2,020/q", totalCost: "₹2,68,800", grossIncome: "₹3,55,520", netIncome: "₹86,720", breakEven: "₹1,527/q • 133.1 q"),
        OutcomeScenario(id: "base", label: "Base", yield: "198 q", sellingPrice: "₹2,150/q", totalCost: "₹2,68,800", grossIncome: "₹4,25,700", netIncome: "₹1,56,900", breakEven: "₹1,358/q • 125.0 q"),
        OutcomeScenario(id: "high", label: "High", yield: "218 q", sellingPrice: "₹2,230/q", totalCost: "₹2,68,800", grossIncome: "₹4,86,140", netIncome: "₹2,17,340", breakEven: "₹1,233/q • 120.5 q")
    ]

    static let nearbyFacilities: [NearbyFacility] = [
        NearbyFacility(id: "fpo", category: "FPO", name: "Guntur Chilli FPO", distance: "~1 km", contact: "FPO CEO desk", source: "Synthetic directory"),
        NearbyFacility(id: "soil-lab", category: "Soil testing", name: "District Soil Testing Lab, Guntur", distance: "~1 km", contact: "Lab in-charge", source: "Synthetic directory"),
        NearbyFacility(id: "kvk", category: "Extension", name: "KVK Lam, Guntur", distance: "~4 km", contact: "Extension scientist", source: "Synthetic directory"),
        NearbyFacility(id: "machinery", category: "Machinery", name: "Guntur Custom Hiring Centre", distance: "~4 km", contact: "CHC manager", source: "Synthetic directory"),
        NearbyFacility(id: "logistics", category: "Logistics", name: "Guntur Agri Logistics", distance: "~1 km", contact: "Dispatch desk", source: "Synthetic directory")
    ]

    static let historyYearSummaries: [HistoryYearSummary] = [
        HistoryYearSummary(id: 2026, crops: "Paddy, Cotton", acres: "12.60 ac", cost: "₹1,07,900", revenue: "₹7,73,520", netPerAcre: "₹52,827"),
        HistoryYearSummary(id: 2025, crops: "Cotton, Chilli", acres: "9.80 ac", cost: "₹1,49,400", revenue: "₹17,49,950", netPerAcre: "₹1,63,321"),
        HistoryYearSummary(id: 2024, crops: "Paddy, Maize", acres: "12.60 ac", cost: "₹78,500", revenue: "₹6,26,260", netPerAcre: "₹43,473"),
        HistoryYearSummary(id: 2023, crops: "Paddy, Chilli", acres: "14.00 ac", cost: "₹1,43,800", revenue: "₹14,85,600", netPerAcre: "₹95,843"),
        HistoryYearSummary(id: 2022, crops: "Paddy, Maize", acres: "14.00 ac", cost: "₹81,800", revenue: "₹6,20,400", netPerAcre: "₹38,471")
    ]

    static let areaCropComparison: [SnapshotItem] = [
        SnapshotItem(id: "area-paddy", title: "Paddy", detail: "Area adoption 34% • farmer 23.6 q/ac", meta: "Typical 22 q/ac • ₹31–32k/ac • ₹2,050–2,150/q"),
        SnapshotItem(id: "area-chilli", title: "Chilli", detail: "Area adoption 12% • farmer 20.0 q/ac", meta: "Typical 20 q/ac • ₹78k/ac • about ₹12,500/q"),
        SnapshotItem(id: "area-cotton", title: "Cotton", detail: "Area adoption 22% • farmer 10.0 q/ac", meta: "Typical 9 q/ac • ₹34–36k/ac • about ₹7,200/q")
    ]

    static let nextSeasonPlan: [SnapshotItem] = [
        SnapshotItem(id: "allocation", title: "Draft allocation", detail: "Paddy 8.40 ac • Chilli 5.60 ac • Cotton 4.20 ac", meta: "18.20 acres allocated; farmer confirmation required"),
        SnapshotItem(id: "soil-readiness", title: "Soil-test readiness", detail: "Action needed", meta: "No parcel-level laboratory result is linked"),
        SnapshotItem(id: "water-readiness", title: "Water plan", detail: "Borewell + canal recorded", meta: "Confirm seasonal availability before sowing"),
        SnapshotItem(id: "insurance-readiness", title: "Insurance review", detail: "Pending", meta: "Check notified crop, dates and sum insured with an authorised desk"),
        SnapshotItem(id: "market-readiness", title: "Market reference", detail: "Guntur Mandi snapshot available", meta: "Synthetic observed prices dated 17-08-2026")
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

    static let lifecycleStages: [LifecycleStage] = [
        LifecycleStage(id: "plan", title: "Plan & insure", summary: "Confirm coverage and prepare evidence", icon: "checkmark.shield.fill"),
        LifecycleStage(id: "sow", title: "Sow & establish", summary: "Start every parcel correctly", icon: "leaf.fill"),
        LifecycleStage(id: "water", title: "Water & nourish", summary: "Apply water and nutrients on time", icon: "drop.fill"),
        LifecycleStage(id: "protect", title: "Protect crop", summary: "Scout early and act safely", icon: "cross.case.fill"),
        LifecycleStage(id: "soil", title: "Protect soil", summary: "Preserve moisture and topsoil", icon: "mountain.2.fill"),
        LifecycleStage(id: "harvest", title: "Harvest & preserve", summary: "Protect quality after maturity", icon: "shippingbox.fill")
    ]

    static let lifecycleActions: [LifecycleAction] = [
        LifecycleAction(id: "paddy-insurance", stageID: "plan", title: "Verify paddy insurance cover", detail: "PMFBY record is available; confirm dates and sum insured with the authorised desk.", urgency: .upcoming, icon: "checkmark.shield.fill", cropCodes: ["PADDY"], destination: .schemes),
        LifecycleAction(id: "other-insurance", stageID: "plan", title: "Review chilli and cotton insurance", detail: "Confirm whether both crops are notified before the enrolment window closes.", urgency: .overdue, icon: "exclamationmark.shield.fill", cropCodes: ["CHILLI", "COTTON"], destination: .schemes),
        LifecycleAction(id: "soil-test", stageID: "plan", title: "Complete parcel soil test", detail: "No parcel-level laboratory result is linked; collect and submit a representative sample.", urgency: .overdue, icon: "testtube.2", destination: .soilCare),
        LifecycleAction(id: "crop-plan", stageID: "plan", title: "Confirm crop and input plan", detail: "The three-parcel allocation is recorded for the current season.", urgency: .upcoming, icon: "map.fill", destination: .farm),
        LifecycleAction(id: "land-drainage", stageID: "sow", title: "Prepare land and drainage", detail: "Field preparation is recorded; keep drainage channels open before forecast rain.", urgency: .today, icon: "water.waves", destination: .intelligence),
        LifecycleAction(id: "seed-treatment", stageID: "sow", title: "Treat seed before sowing", detail: "Seed-treatment activity is recorded for the pilot.", urgency: .upcoming, icon: "leaf.circle.fill", destination: .training),
        LifecycleAction(id: "sowing-record", stageID: "sow", title: "Record sowing date and spacing", detail: "Sowing is recorded; exact dates still need farmer confirmation.", urgency: .upcoming, icon: "calendar.badge.checkmark", destination: .farmHistory),
        LifecycleAction(id: "training-sowing", stageID: "sow", title: "Complete sowing-stage training", detail: "Finish all three land-preparation and sowing lessons.", urgency: .upcoming, icon: "book.closed.fill", destination: .training, trainingModuleID: "sowing-basics"),
        LifecycleAction(id: "irrigation-check", stageID: "water", title: "Check irrigation and field moisture", detail: "Inspect each parcel today; avoid watering where forecast rain is adequate.", urgency: .today, icon: "drop.triangle.fill", destination: .intelligence),
        LifecycleAction(id: "organic-manure", stageID: "water", title: "Apply organic manure", detail: "Organic-manure application is recorded; retain the field receipt or note.", urgency: .upcoming, icon: "leaf.arrow.triangle.circlepath", destination: .inputs),
        LifecycleAction(id: "rain-nutrition", stageID: "water", title: "Adjust top-dressing after rain", detail: "Recheck field moisture and postpone nitrogen application during heavy rain.", urgency: .upcoming, icon: "cloud.rain.fill", destination: .inputs),
        LifecycleAction(id: "weekly-scout", stageID: "protect", title: "Scout every parcel", detail: "Check paddy, chilli and cotton for pest or disease signs and record observations.", urgency: .today, icon: "eye.fill", destination: .inputs),
        LifecycleAction(id: "ipm-response", stageID: "protect", title: "Prepare an IPM response", detail: "Use thresholds and authorised guidance before any crop-protection treatment.", urgency: .upcoming, icon: "ladybug.fill", destination: .inputs),
        LifecycleAction(id: "training-protection", stageID: "protect", title: "Complete crop-protection training", detail: "Finish scouting, IPM and safe-spraying lessons.", urgency: .upcoming, icon: "book.closed.fill", destination: .training, trainingModuleID: "crop-protection"),
        LifecycleAction(id: "bunds-runoff", stageID: "soil", title: "Inspect bunds and runoff paths", detail: "Repair weak bunds and prevent topsoil loss before the next rainfall.", urgency: .today, icon: "mountain.2.fill", destination: .soilCare),
        LifecycleAction(id: "mulch-residue", stageID: "soil", title: "Mulch or retain suitable residue", detail: "Cover exposed soil where agronomically appropriate to reduce evaporation.", urgency: .upcoming, icon: "square.stack.3d.up.fill", destination: .soilCare),
        LifecycleAction(id: "harvest-readiness", stageID: "harvest", title: "Prepare harvest and moisture checks", detail: "Open this stage when the crop approaches maturity.", urgency: .later, icon: "gauge.with.dots.needle.50percent", destination: .farmHistory),
        LifecycleAction(id: "training-harvest", stageID: "harvest", title: "Complete harvest training", detail: "Finish maturity, cutting and low-loss threshing lessons.", urgency: .later, icon: "book.closed.fill", destination: .training, trainingModuleID: "crop-cutting"),
        LifecycleAction(id: "storage-plan", stageID: "harvest", title: "Create produce storage plan", detail: "Plan drying, grading, bags, ventilation and pest-free storage before harvest.", urgency: .later, icon: "shippingbox.fill", destination: .farmHistory),
        LifecycleAction(id: "training-preservation", stageID: "harvest", title: "Complete preservation training", detail: "Finish the drying, storage and preservation lessons.", urgency: .later, icon: "book.closed.fill", destination: .training, trainingModuleID: "preservation"),
        LifecycleAction(id: "training-value", stageID: "harvest", title: "Complete value-creation training", detail: "Learn cleaning, grading, processing and by-product options.", urgency: .later, icon: "indianrupeesign.circle.fill", destination: .training, trainingModuleID: "value-creation")
    ]

    static let recordedLifecycleActionIDs: Set<String> = [
        "paddy-insurance", "crop-plan", "land-drainage", "seed-treatment", "sowing-record", "organic-manure"
    ]

    static var currentLifecycleActions: [LifecycleAction] {
        lifecycleActions.filter { $0.urgency != .later }
    }

    static var totalTrainingLessonCount: Int {
        trainingModules.reduce(0) { $0 + $1.lessons.count }
    }

    static func trainingLessonIDs(moduleID: String) -> Set<String> {
        guard let module = trainingModules.first(where: { $0.id == moduleID }) else { return [] }
        return Set(module.lessons.indices.map { "\(module.id)-\($0)" })
    }

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
