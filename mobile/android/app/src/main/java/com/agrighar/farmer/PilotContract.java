package com.agrighar.farmer;

import java.math.BigDecimal;
import java.util.List;
import java.util.Set;

public final class PilotContract {
    public static final int MIN_ANDROID_SDK = 31;
    public static final String PRIMARY_LOCALE = "te-IN";
    public static final String PILOT_ID = "pilot-siddipet-raipole-001";
    public static final String CONSENT_CONTRACT_VERSION = "mobile-consent-2026-08-v1";
    public static final String BASELINE_POLICY_VERSION = "2026-08-baseline-v1";

    public static final Set<String> BASELINE_PURPOSES = Set.of(
        "account_service",
        "profile_and_farm_record_management",
        "security_and_audit"
    );

    public static final List<CropAllocation> PILOT_CROPS = List.of(
        new CropAllocation("paddy", "వరి", new BigDecimal("10.00")),
        new CropAllocation("maize", "మొక్కజొన్న", new BigDecimal("5.00")),
        new CropAllocation("cotton", "పత్తి", new BigDecimal("5.00"))
    );

    public static final BigDecimal PILOT_TOTAL_ACRES = new BigDecimal("20.00");

    private PilotContract() {
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

    public record CropAllocation(String code, String teluguName, BigDecimal areaAcres) {
    }
}

