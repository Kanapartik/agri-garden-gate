package com.agrighar.farmer;

import java.math.BigDecimal;
import java.util.List;
import java.util.Set;

public final class PilotContract {
    public static final int MIN_ANDROID_SDK = 31;
    public static final String PRIMARY_LOCALE = "te-IN";
    public static final String PILOT_ID = "pilot-guntur-kaza-synthetic-001";
    public static final String SNAPSHOT_VERSION = "guntur-kaza-web-parity-2026-09-02-v1";
    public static final String SNAPSHOT_FARMER_NAME = "Ramesh Naidu Vemuri";
    public static final String SNAPSHOT_FARMER_GENDER = "male";
    public static final String CONSENT_CONTRACT_VERSION = "mobile-consent-2026-08-v1";
    public static final String BASELINE_POLICY_VERSION = "2026-08-baseline-v1";

    public static final Set<String> BASELINE_PURPOSES = Set.of(
        "account_service",
        "profile_and_farm_record_management",
        "security_and_audit"
    );

    public static final List<CropAllocation> PILOT_CROPS = List.of(
        new CropAllocation(
            "paddy", "వరి", "Paddy", new BigDecimal("8.40"),
            "Paddy field east", "GNT-KAZA-114/2", "16.3072, 80.4482"
        ),
        new CropAllocation(
            "chilli", "మిరప", "Chilli", new BigDecimal("5.60"),
            "Chilli block A", "GNT-KAZA-98/1", "16.2951, 80.4715"
        ),
        new CropAllocation(
            "cotton", "పత్తి", "Cotton", new BigDecimal("4.20"),
            "Cotton stretch (west)", "GNT-KAZA-77/4", "16.3216, 80.4103"
        )
    );

    public static final List<SnapshotItem> PROFILE_DETAILS = List.of(
        item("dob", "పుట్టిన తేదీ", "12-04-1979", "Farmer confirmed"),
        item("category", "సామాజిక వర్గం", "OBC", "Farmer entered"),
        item("ownership", "యాజమాన్యం", "Owner", "Farmer confirmed"),
        item("irrigation", "నీటిపారుదల", "Borewell + canal", "Farmer entered"),
        item("bank", "బ్యాంక్", "Andhra Grameena Vikas Bank (synthetic) • Kaza", "A/c •••• 4821 • IFSC ANDB0001234")
    );

    public static final List<SnapshotItem> PROFILE_DOCUMENTS = List.of(
        item("bank-passbook", "Bank passbook", "Confirmed", "Synthetic • image/jpeg"),
        item("land-record", "Land record", "Confirmed", "Synthetic • image/jpeg"),
        item("id-proof", "Identity proof", "Confirmed", "Synthetic • image/jpeg")
    );

    public static final List<SnapshotItem> ONBOARDING_APPLICATIONS = List.of(
        item("farmer", "Farmer", "Draft", "Identity step"),
        item("fpo", "FPO", "Draft", "Organisation step"),
        item("field-agent", "Field agent", "Draft", "Identity step"),
        item("bank-officer", "Bank officer", "Draft", "Institution step"),
        item("insurer-officer", "Insurer officer", "Draft", "Institution step"),
        item("knowledge-reviewer", "Knowledge reviewer", "Draft", "Institution step")
    );

    public static final List<FarmHistoryItem> FARM_HISTORY = List.of(
        history("2026-kharif-paddy", "2026 Kharif", "Paddy", "8.40 ac", "₹55,300", "198 q", "₹2,320/q", "₹4,59,360", "Direct-seeded on two acres to save labour."),
        history("2026-kharif-cotton", "2026 Kharif", "Cotton", "4.20 ac", "₹52,600", "42 q", "₹7,480/q", "₹3,14,160", "Drone spraying trialled through the FPO."),
        history("2025-kharif-cotton", "2025 Kharif", "Cotton", "4.20 ac", "₹50,000", "39 q", "₹7,250/q", "₹2,82,750", "Pink bollworm scouting from flowering."),
        history("2025-kharif-chilli", "2025 Kharif", "Chilli", "5.60 ac", "₹99,400", "112 q", "₹13,100/q", "₹14,67,200", "Held stock for three weeks; price improved."),
        history("2024-kharif-paddy", "2024 Kharif", "Paddy", "8.40 ac", "₹52,100", "189 q", "₹2,180/q", "₹4,12,020", "Best paddy season so far."),
        history("2024-rabi-maize", "2024 Rabi", "Maize", "4.20 ac", "₹26,400", "104 q", "₹2,060/q", "₹2,14,240", "Grown on the cotton block after harvest."),
        history("2023-kharif-paddy", "2023 Kharif", "Paddy", "8.40 ac", "₹49,800", "168 q", "₹2,100/q", "₹3,52,800", "Late-season inundation cut the yield."),
        history("2023-kharif-chilli", "2023 Kharif", "Chilli", "5.60 ac", "₹94,000", "96 q", "₹11,800/q", "₹11,32,800", "Thrips pressure managed with two extra sprays."),
        history("2022-kharif-paddy", "2022 Kharif", "Paddy", "8.40 ac", "₹47,400", "176 q", "₹2,040/q", "₹3,59,040", "Good canal supply through the season."),
        history("2022-rabi-maize", "2022 Rabi", "Maize", "5.60 ac", "₹34,400", "132 q", "₹1,980/q", "₹2,61,360", "Sold to local trader.")
    );

    public static final List<SnapshotItem> INSURANCE_SNAPSHOTS = List.of(
        item("insurance-2026", "2026 Kharif • Paddy", "Covered • PMFBY", "Premium ₹3,600/ac • insured ₹45,000/ac • farmer share ₹900/ac"),
        item("insurance-2025", "2025 Kharif • Paddy", "Partially covered • PMFBY", "Premium ₹3,400/ac • insured ₹42,500/ac • farmer share ₹850/ac")
    );

    public static final List<SnapshotItem> INTELLIGENCE_SECTIONS = List.of(
        item("location", "Location & season", "Guntur (synthetic) • IN-AP-GNT • 16.3072, 80.4482", "Kharif: sow Jun–Jul, harvest Oct–Nov • mixed red and black soils • borewell/rainfed"),
        item("weather", "Weather", "No current authoritative observation in this snapshot", "Refresh requires a configured weather adapter."),
        item("soil", "Soil", "Mixed red and black soils (location-derived)", "No farmer soil-test result is linked; validate before applying inputs."),
        item("crop-planning", "Crop planning", "Paddy 8.40 ac • Chilli 5.60 ac • Cotton 4.20 ac", "18.20 acres allocated; suitability remains a derived scenario."),
        item("market", "Market", "Guntur Mandi • observed 17-08-2026", "Paddy ₹2,150/q • Chilli ₹16,200/q • Cotton ₹7,350/q (synthetic modal prices)"),
        item("value-add", "Value-add", "Paddy → cleaned/dried paddy → brown rice → polished rice", "Recovery 96% → 78% → 92%; assumptions require validation."),
        item("outcome", "Outcome planner", "Costs, yield and price scenarios are derived", "No recommendation replaces an authorised human decision."),
        item("nearby", "Nearby & help", "Soil lab • logistics • drone service • machinery hiring", "Four synthetic Guntur service records; contacts are service-desk labels only.")
    );

    public static final List<TrainingModule> TRAINING_MODULES = List.of(
        training("sowing-basics", "LAND PREPARATION & SOWING", "Land preparation and sowing", "Field preparation, seed selection, seed treatment, spacing and sowing windows for AP/Telangana conditions.", "Prepare the field", "Choose and treat the seed", "Sow at the right time and spacing"),
        training("crop-protection", "CROP PROTECTION", "Crop protection methods", "Scouting, thresholds, integrated pest management and safe spraying practice.", "Scout the field weekly", "Use integrated pest management first", "Spray safely"),
        training("crop-cutting", "HARVEST & CROP CUTTING", "Harvest and crop cutting", "Maturity signs, cutting method, moisture at harvest and threshing losses.", "Judge maturity correctly", "Cut and thresh with low loss"),
        training("preservation", "POST-HARVEST", "Drying, storage and preservation", "Drying to safe moisture, grading, bagging, aeration and pest-free storage.", "Dry to safe moisture", "Store pest-free"),
        training("value-creation", "VALUE CREATION", "Value creation from produce", "Cleaning, grading, primary processing and by-product value.", "Clean and grade", "Primary processing and by-products")
    );

    public static final List<SnapshotItem> INPUT_GUIDANCE = List.of(
        item("paddy-nutrients", "Paddy • nutrient plan", "Basal: urea 65, DAP 125, MOP 50 kg/ha; zinc sulphate 25 kg/ha only after deficiency/lab confirmation", "Tillering + panicle initiation: urea 65 kg/ha each • organic: Azospirillum 5 kg/ha / vermicompost 2,500 kg/ha"),
        item("chilli-nutrients", "Chilli • nutrient plan", "Basal: urea 90, SSP 375, MOP 100 kg/ha", "Flowering: boron 5 kg/ha • organic: vermicompost 5,000 kg/ha / Jeevamrutham 500 l/ha"),
        item("cotton-nutrients", "Cotton • nutrient plan", "Basal: urea 90 and DAP 130 kg/ha", "Square formation: MOP 85 kg/ha • organic: neem cake 500 kg/ha"),
        item("paddy-protection", "Paddy • high-priority protection", "Rice blast, brown plant hopper and yellow stem borer", "Use thresholds and approved labels; safety intervals apply."),
        item("chilli-protection", "Chilli • high-priority protection", "Thrips and anthracnose/die-back; yellow mite is moderate", "Scout weekly; IPM first. Example options include neem oil, Trichoderma or label-approved chemistry."),
        item("cotton-protection", "Cotton • high-priority protection", "Pink bollworm", "Rosette flowers, exit holes and damaged lint; use scouting thresholds before treatment.")
    );

    public static final List<SnapshotItem> SOIL_PRACTICES = List.of(
        item("organic-matter", "Build organic matter every season", "2 t/ac vermicompost or 5 t/ac FYM", "Moderate effort • benefit in 2–3 seasons"),
        item("green-manure", "Green manure and cover crops", "Sow sunhemp/daincha; incorporate at about 45 days", "Moderate • adds about 20–25 kg N/ac"),
        item("mulch", "Mulch the surface", "Retain clean crop residue where suitable", "Low effort • reduces evaporation and weeds"),
        item("rotate", "Rotate with a legume", "Include a locally suitable pulse in the rotation", "Low effort • can reduce nitrogen need and pest pressure"),
        item("gypsum", "Correct sodic soil with gypsum", "Apply only at a soil-lab recommended rate", "High effort • laboratory confirmation required"),
        item("lime", "Correct acidic soil with lime", "Use the laboratory rate 3–4 weeks before sowing", "High effort • laboratory confirmation required"),
        item("irrigate", "Irrigate to hold nutrients", "Lighter/frequent on sandy soils; avoid overwatering heavy soils", "Low effort"),
        item("bunds", "Bunds and contour cultivation on slopes", "Slow runoff and retain topsoil", "High effort")
    );

    public static final List<SnapshotItem> SCHEMES = List.of(
        item("insurance", "Crop insurance enrolment support (synthetic)", "Submitted • eligible", "Telangana premium assistance • version 1"),
        item("input-support", "Input support for small and marginal farmers (synthetic)", "In review • needs review", "AP support up to 5 acres • version 1"),
        item("drip", "Micro irrigation (drip) subsidy (synthetic)", "Draft", "AP owner-cultivator capital subsidy • version 1"),
        item("tenant-credit", "Credit linkage for tenant and leased-land farmers (synthetic)", "Not applied", "Telangana tenant/share-cropper linkage • version 1")
    );

    public static final List<SnapshotItem> MARKETPLACE_STATE = List.of(
        item("profile", "Marketplace profile", "Not activated", "No farmer seller/buyer profile exists."),
        item("listings", "Listings", "0", "No published or draft farmer listings."),
        item("rfqs", "RFQs and quotes", "0", "No requests or quotes."),
        item("orders", "Orders and disputes", "0", "No orders or disputes.")
    );

    public static final BigDecimal PILOT_TOTAL_ACRES = new BigDecimal("18.20");

    private PilotContract() {
    }

    private static SnapshotItem item(String id, String title, String detail, String meta) {
        return new SnapshotItem(id, title, detail, meta);
    }

    private static FarmHistoryItem history(String id, String season, String crop, String acres,
                                           String cost, String yieldAmount, String price, String revenue,
                                           String note) {
        return new FarmHistoryItem(id, season, crop, acres, cost, yieldAmount, price, revenue, note);
    }

    private static TrainingModule training(String id, String stage, String title, String summary,
                                           String... lessons) {
        return new TrainingModule(id, stage, title, summary, List.of(lessons));
    }

    public static String normalizeIndianPhone(String raw) {
        if (raw == null) {
            return null;
        }
        String digits = raw.replaceAll("[^0-9]", "");
        if (digits.length() == 10 && digits.matches("[6-9][0-9]{9}")) {
            return "+91" + digits;
        }
        if (digits.length() == 12 && digits.matches("91[6-9][0-9]{9}")) {
            return "+" + digits;
        }
        return null;
    }

    public static String maskPhone(String normalizedPhone) {
        if (normalizedPhone == null || !normalizedPhone.matches("\\+91[6-9][0-9]{9}")) {
            return "";
        }
        return "+91******" + normalizedPhone.substring(normalizedPhone.length() - 4);
    }

    public static boolean isOtpShapeValid(String otp) {
        return otp != null && otp.matches("[0-9]{6}");
    }

    public static BigDecimal allocatedAcres() {
        return PILOT_CROPS.stream()
            .map(CropAllocation::areaAcres)
            .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    public static boolean isPilotCropPlanBalanced() {
        return PILOT_TOTAL_ACRES.compareTo(allocatedAcres()) == 0;
    }

    public record CropAllocation(
        String code,
        String teluguName,
        String englishName,
        BigDecimal areaAcres,
        String parcelName,
        String plotReference,
        String centroid
    ) {
    }

    public record SnapshotItem(String id, String title, String detail, String meta) {
    }

    public record FarmHistoryItem(
        String id,
        String season,
        String crop,
        String acres,
        String cost,
        String yieldAmount,
        String price,
        String revenue,
        String note
    ) {
    }

    public record TrainingModule(
        String id,
        String stage,
        String title,
        String summary,
        List<String> lessons
    ) {
    }
}
