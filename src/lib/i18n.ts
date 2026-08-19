/**
 * Lightweight multilingual layer (B2B).
 *
 * Two separate concerns:
 *  1. UI labels — a static dictionary keyed by locale, with English fallback.
 *  2. Content rows — configuration content stored in the database, translated
 *     through `content_translations` and resolved with `localizedField`.
 *
 * Nothing here is a security boundary; language is a presentation choice.
 */

export const LOCALES = ["en", "te", "hi", "ta", "kn"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

export const LOCALE_LABEL: Record<Locale, string> = {
  en: "English",
  te: "తెలుగు",
  hi: "हिन्दी",
  ta: "தமிழ்",
  kn: "ಕನ್ನಡ",
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

export function normalizeLocale(value: unknown): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

type Dict = Record<string, string>;

const en: Dict = {
  "nav.overview": "Overview",
  "nav.dashboard": "Access console",
  "nav.onboarding": "My onboarding",
  "nav.farm": "My farm",
  "nav.intelligence": "Farm intelligence",
  "nav.practices": "Training",
  "nav.inputs": "Inputs & protection",
  "nav.soilCare": "Soil care",
  "nav.consent": "Consent",
  "nav.schemes": "Schemes",
  "nav.market": "Marketplace",
  "nav.profile": "My profile",
  "nav.roles": "Roles",
  "nav.architecture": "Architecture",
  "nav.fpo": "FPO workspace",
  "nav.government": "Government",
  "nav.district": "District",
  "nav.review": "Review queue",
  "nav.access": "Access & roles",
  "nav.admin": "Admin",
  "nav.configuration": "Configuration",
  "shell.signIn": "Sign in",
  "shell.signOut": "Sign out",
  "shell.footer":
    "AgriGhar ATAP · synthetic data only · marketplace, advertising and talent domains are deactivated.",
  "discovery.title": "Scheme discovery",
  "discovery.description":
    "Published district schemes you can apply to. Applying shares only the fields on the form with the publishing department — nothing else from your farm profile.",
  "discovery.prefillTitle": "Prefill from your farm profile",
  "discovery.prefillAvailable":
    "Your baseline consent is active, so we can prefill land area, plot reference and village from your own farm record. You can edit every field before submitting.",
  "discovery.prefillBlocked": "Prefill unavailable",
  "discovery.prefillBlockedHelp": "You can still apply and type the values yourself.",
  "discovery.reviewConsent": "Review consent",
  "discovery.addParcel": "add a farm parcel",
  "discovery.empty": "No published schemes are open in your district yet.",
  "discovery.apply": "Apply",
  "discovery.applyPrefill": "Apply with prefill",
  "discovery.cancel": "Cancel",
  "discovery.continueReview": "Review before submitting",
  "discovery.reviewTitle": "Review your application",
  "discovery.reviewHelp":
    "Read every value in your language before submitting. Nothing is sent until you confirm.",
  "discovery.backToEdit": "Back to edit",
  "discovery.confirmSubmit": "Confirm and submit",
  "discovery.notProvided": "Not provided",
  "discovery.submitHint":
    "Submitting records the scheme version your application was checked against. Eligibility hints never decide the outcome.",
  "discovery.advisorySuffix": "(helps, not required)",
  "discovery.appliedOn": "You applied on",
  "discovery.humanReview": "A government reviewer decides this application.",
  "discovery.note": "Note",
  "discovery.submitted": "Application submitted for human government review",

  "language.label": "Language",
  "common.loading": "Loading…",
  "common.synthetic": "Synthetic demo content",
  "common.askKvk": "Confirm with your KVK or agronomist",
  "common.saved": "Saved",
  "common.cost": "Indicative cost",
  "common.quantity": "Quantity",
  "common.unit": "Unit",
  "common.crop": "Crop",
  "common.stage": "Growth stage",
  "common.area": "Area (hectares)",
  "practices.title": "Farmer training",
  "practices.description":
    "Step-by-step practice guidance for sowing, crop protection, harvest, preservation and value creation. Mark what you have completed.",
  "practices.progress": "completed",
  "practices.ready": "ready",
  "practices.inProgress": "in progress",
  "practices.empty": "No training modules are published yet.",
  "practices.do": "Do",
  "practices.dont": "Do not",
  "practices.source": "Source",
  "inputs.title": "Inputs & crop protection",
  "inputs.description":
    "Nutrient plan and infestation guidance for your parcel, with generic names, doses, indicative cost and brands that carry the same generic. Advisory only.",
  "inputs.mode.conventional": "Conventional",
  "inputs.mode.organic": "Organic / bio-inputs",
  "inputs.nutrientPlan": "Nutrient plan",
  "inputs.generic": "Generic name",
  "inputs.nutrient": "Nutrient",
  "inputs.brands": "Brands carrying this generic",
  "inputs.sellers": "Sellers on the marketplace",
  "inputs.noSellers": "No published listing matches this input right now.",
  "inputs.infestation": "Crop infestation",
  "inputs.symptoms": "Symptoms",
  "inputs.treatments": "Options",
  "inputs.safetyInterval": "Days before harvest",
  "inputs.reentry": "Re-entry",
  "inputs.compare": "Conventional vs organic",
  "inputs.savePlan": "Save this plan",
  "inputs.advisoryNote":
    "This is advisory only. AgriGhar never prescribes a chemical application — confirm the dose and product with your KVK or agronomist before spraying.",
  "soil.title": "Soil nutrient retention",
  "soil.description":
    "Practices that keep nutrients in your soil, filtered to the soil type on record for this parcel.",
  "soil.basisInferred": "Based on soil inferred from location",
  "soil.basisLab": "Based on a laboratory result for this farm",
  "soil.effort": "Effort",
  "soil.benefit": "Expected benefit",
  "soil.bookTest": "Book a soil test",
  "soil.empty": "No practice is recorded for this soil type yet.",
};

const te: Dict = {
  "nav.overview": "ముఖ్య పేజీ",
  "nav.profile": "నా వివరాలు",
  "nav.onboarding": "నా నమోదు",
  "nav.consent": "సమ్మతి",
  "nav.schemes": "పథకాలు",
  "nav.market": "మార్కెట్",
  "nav.dashboard": "యాక్సెస్ కన్సోల్",
  "shell.signIn": "సైన్ ఇన్",
  "shell.signOut": "సైన్ అవుట్",
  "discovery.title": "పథకాల అన్వేషణ",
  "discovery.description":
    "మీ జిల్లాలో ప్రచురించిన పథకాలు. దరఖాస్తు చేసినప్పుడు ఫారంలో ఉన్న వివరాలు మాత్రమే శాఖకు వెళ్తాయి.",
  "discovery.prefillTitle": "మీ క్షేత్ర వివరాల నుండి ముందస్తు నింపడం",
  "discovery.prefillBlocked": "ముందస్తు నింపడం అందుబాటులో లేదు",
  "discovery.prefillBlockedHelp": "మీరు వివరాలు స్వయంగా టైప్ చేసి దరఖాస్తు చేయవచ్చు.",
  "discovery.reviewConsent": "సమ్మతిని చూడండి",
  "discovery.addParcel": "క్షేత్రం జోడించండి",
  "discovery.empty": "మీ జిల్లాలో ప్రచురించిన పథకాలు ఇంకా లేవు.",
  "discovery.apply": "దరఖాస్తు",
  "discovery.applyPrefill": "ముందస్తు నింపి దరఖాస్తు",
  "discovery.cancel": "రద్దు",
  "discovery.continueReview": "సమర్పించే ముందు పరిశీలించండి",
  "discovery.reviewTitle": "మీ దరఖాస్తును పరిశీలించండి",
  "discovery.reviewHelp":
    "సమర్పించే ముందు ప్రతి వివరాన్ని మీ భాషలో చదవండి. మీరు నిర్ధారించే వరకు ఏమీ పంపబడదు.",
  "discovery.backToEdit": "సవరించడానికి వెనక్కి",
  "discovery.confirmSubmit": "నిర్ధారించి సమర్పించండి",
  "discovery.notProvided": "ఇవ్వలేదు",
  "discovery.note": "గమనిక",
  "discovery.humanReview": "ఈ దరఖాస్తుపై ప్రభుత్వ అధికారి నిర్ణయం తీసుకుంటారు.",
  "discovery.appliedOn": "మీరు దరఖాస్తు చేసిన తేదీ",

  "nav.practices": "శిక్షణ",
  "nav.inputs": "ఎరువులు & రక్షణ",
  "nav.soilCare": "నేల సంరక్షణ",
  "nav.farm": "నా వ్యవసాయ క్షేత్రం",
  "nav.intelligence": "క్షేత్ర సమాచారం",
  "language.label": "భాష",
  "common.askKvk": "మీ కేవీకే లేదా వ్యవసాయ నిపుణుడిని సంప్రదించండి",
  "common.cost": "సూచనాత్మక ఖర్చు",
  "common.quantity": "పరిమాణం",
  "common.crop": "పంట",
  "common.stage": "పంట దశ",
  "common.area": "విస్తీర్ణం (హెక్టార్లు)",
  "practices.title": "రైతు శిక్షణ",
  "practices.do": "చేయాలి",
  "practices.dont": "చేయకూడదు",
  "inputs.title": "ఎరువులు & పంట రక్షణ",
  "inputs.mode.conventional": "రసాయన",
  "inputs.mode.organic": "సేంద్రియ / జీవ ఎరువులు",
  "inputs.nutrientPlan": "పోషక ప్రణాళిక",
  "inputs.generic": "సాధారణ పేరు",
  "inputs.nutrient": "పోషకం",
  "inputs.brands": "ఈ సాధారణ పేరుతో ఉన్న బ్రాండ్లు",
  "inputs.infestation": "పంట తెగులు",
  "inputs.symptoms": "లక్షణాలు",
  "soil.title": "నేలలో పోషకాల నిలుపుదల",
  "soil.effort": "శ్రమ",
  "soil.benefit": "ఆశించిన ప్రయోజనం",
  "soil.bookTest": "నేల పరీక్ష కోరండి",
};

const hi: Dict = {
  "nav.practices": "प्रशिक्षण",
  "nav.inputs": "उर्वरक और सुरक्षा",
  "nav.soilCare": "मृदा देखभाल",
  "nav.farm": "मेरा खेत",
  "nav.intelligence": "खेत जानकारी",
  "language.label": "भाषा",
  "common.askKvk": "अपने केवीके या कृषि विशेषज्ञ से पुष्टि करें",
  "common.cost": "अनुमानित लागत",
  "common.quantity": "मात्रा",
  "common.crop": "फसल",
  "common.stage": "फसल अवस्था",
  "common.area": "क्षेत्र (हेक्टेयर)",
  "practices.title": "किसान प्रशिक्षण",
  "practices.do": "करें",
  "practices.dont": "न करें",
  "inputs.title": "उर्वरक और फसल सुरक्षा",
  "inputs.mode.conventional": "रासायनिक",
  "inputs.mode.organic": "जैविक / जैव उर्वरक",
  "inputs.nutrientPlan": "पोषक योजना",
  "inputs.generic": "सामान्य नाम",
  "inputs.nutrient": "पोषक तत्व",
  "inputs.brands": "इस सामान्य नाम के ब्रांड",
  "inputs.infestation": "फसल संक्रमण",
  "inputs.symptoms": "लक्षण",
  "soil.title": "मृदा पोषक संरक्षण",
  "soil.effort": "श्रम",
  "soil.benefit": "अपेक्षित लाभ",
  "soil.bookTest": "मृदा परीक्षण का अनुरोध करें",
};

const ta: Dict = {
  "nav.practices": "பயிற்சி",
  "nav.inputs": "உரங்கள் & பாதுகாப்பு",
  "nav.soilCare": "மண் பரிபாலனம்",
  "nav.farm": "எனது நிலம்",
  "nav.intelligence": "நில தகவல்",
  "language.label": "மொழி",
  "common.askKvk": "உங்கள் கே.வி.கே அல்லது வேளாண் நிபுணரிடம் உறுதிப்படுத்துங்கள்",
  "common.cost": "தோராயமான செலவு",
  "common.quantity": "அளவு",
  "common.crop": "பயிர்",
  "common.stage": "வளர்ச்சி நிலை",
  "common.area": "பரப்பு (ஹெக்டேர்)",
  "practices.title": "விவசாயி பயிற்சி",
  "practices.do": "செய்யவும்",
  "practices.dont": "செய்ய வேண்டாம்",
  "inputs.title": "உரங்கள் & பயிர் பாதுகாப்பு",
  "inputs.mode.conventional": "இரசாயன",
  "inputs.mode.organic": "இயற்கை / உயிர் உரங்கள்",
  "inputs.nutrientPlan": "ஊட்டச் திட்டம்",
  "inputs.generic": "பொதுப் பெயர்",
  "inputs.nutrient": "ஊட்டச்சத்து",
  "inputs.brands": "இதே பொதுப் பெயருள்ள பிராண்டுகள்",
  "inputs.infestation": "பயிர் தாக்குதல்",
  "inputs.symptoms": "அறிகுறிகள்",
  "soil.title": "மண் ஊட்டச்சத்து தக்கவைப்பு",
  "soil.effort": "உழைப்பு",
  "soil.benefit": "எதிர்பார்க்கும் நன்மை",
  "soil.bookTest": "மண் பரிசோதனை கோரவும்",
};

const kn: Dict = {
  "nav.practices": "ತರಬೇತಿ",
  "nav.inputs": "ಗೊಬ್ಬರ & ರಕ್ಷಣೆ",
  "nav.soilCare": "ಮಣ್ಣಿನ ಆರೈಕೆ",
  "nav.farm": "ನನ್ನ ಹೊಲ",
  "nav.intelligence": "ಹೊಲದ ಮಾಹಿತಿ",
  "language.label": "ಭಾಷೆ",
  "common.askKvk": "ನಿಮ್ಮ ಕೆವಿಕೆ ಅಥವಾ ಕೃಷಿ ತಜ್ಞರೊಂದಿಗೆ ದೃಢಪಡಿಸಿಕೊಳ್ಳಿ",
  "common.cost": "ಸೂಚಕ ವೆಚ್ಚ",
  "common.quantity": "ಪ್ರಮಾಣ",
  "common.crop": "ಬೆಳೆ",
  "common.stage": "ಬೆಳೆ ಹಂತ",
  "common.area": "ವಿಸ್ತೀರ್ಣ (ಹೆಕ್ಟೇರ್)",
  "practices.title": "ರೈತ ತರಬೇತಿ",
  "practices.do": "ಮಾಡಿ",
  "practices.dont": "ಮಾಡಬೇಡಿ",
  "inputs.title": "ಗೊಬ್ಬರ & ಬೆಳೆ ರಕ್ಷಣೆ",
  "inputs.mode.conventional": "ರಾಸಾಯನಿಕ",
  "inputs.mode.organic": "ಸಾವಯವ / ಜೈವಿಕ ಗೊಬ್ಬರ",
  "inputs.nutrientPlan": "ಪೋಷಕಾಂಶ ಯೋಜನೆ",
  "inputs.generic": "ಸಾಮಾನ್ಯ ಹೆಸರು",
  "inputs.nutrient": "ಪೋಷಕಾಂಶ",
  "inputs.brands": "ಇದೇ ಸಾಮಾನ್ಯ ಹೆಸರಿನ ಬ್ರಾಂಡ್‌ಗಳು",
  "inputs.infestation": "ಬೆಳೆ ಬಾಧೆ",
  "inputs.symptoms": "ಲಕ್ಷಣಗಳು",
  "soil.title": "ಮಣ್ಣಿನ ಪೋಷಕಾಂಶ ಉಳಿಸುವಿಕೆ",
  "soil.effort": "ಶ್ರಮ",
  "soil.benefit": "ನಿರೀಕ್ಷಿತ ಲಾಭ",
  "soil.bookTest": "ಮಣ್ಣಿನ ಪರೀಕ್ಷೆಗೆ ವಿನಂತಿಸಿ",
};

export const DICTIONARIES: Record<Locale, Dict> = { en, te, hi, ta, kn };

/**
 * Resolves a UI label. Missing translations fall back to English rather than
 * showing a key, so a partially translated locale is still usable.
 */
export function translate(locale: Locale, key: string): string {
  const dict = DICTIONARIES[locale] ?? DICTIONARIES[DEFAULT_LOCALE];
  return dict[key] ?? DICTIONARIES[DEFAULT_LOCALE][key] ?? key;
}

export interface TranslationRow {
  entity: string;
  entity_id: string;
  locale: string;
  field: string;
  value: string;
}

/** Index `content_translations` rows for O(1) lookup. */
export function indexTranslations(rows: readonly TranslationRow[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const row of rows) {
    map.set(`${row.entity}:${row.entity_id}:${row.locale}:${row.field}`, row.value);
  }
  return map;
}

/** Content-row translation with graceful fallback to the stored English value. */
export function localizedField(
  index: Map<string, string>,
  entity: string,
  entityId: string,
  field: string,
  locale: Locale,
  fallback: string,
): string {
  if (locale === DEFAULT_LOCALE) return fallback;
  return index.get(`${entity}:${entityId}:${locale}:${field}`) ?? fallback;
}

export const LOCALE_STORAGE_KEY = "agrighar.locale";
