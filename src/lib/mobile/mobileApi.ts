export const MOBILE_API_VERSION = "mobile-v1";
export const MOBILE_PILOT_ID = "pilot-siddipet-raipole-001";
export const MOBILE_LOCALE = "te-IN";

export function normalizeIndianMobile(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const digits = value.replace(/\D/g, "");
  const national =
    digits.length === 10
      ? digits
      : digits.length === 12 && digits.startsWith("91")
        ? digits.slice(2)
        : "";
  return /^[6-9]\d{9}$/.test(national) ? `+91${national}` : null;
}

export function maskIndianMobile(phone: string): string {
  return `+91******${phone.slice(-4)}`;
}

export function isSixDigitOtp(value: unknown): value is string {
  return typeof value === "string" && /^\d{6}$/.test(value);
}

export function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}

export function mobileOnboardingStatus(input: {
  hasProfile: boolean;
  baselineAccepted: boolean;
  suspended?: boolean;
}) {
  if (input.suspended) return "suspended" as const;
  if (!input.baselineAccepted) return "consent_pending" as const;
  if (!input.hasProfile) return "profile_pending" as const;
  return "verification_optional" as const;
}
