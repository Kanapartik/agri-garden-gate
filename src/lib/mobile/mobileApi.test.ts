import { describe, expect, it } from "vitest";
import {
  isSixDigitOtp,
  isSandboxStaticOtp,
  isUuid,
  maskIndianMobile,
  mobileOnboardingStatus,
  normalizeIndianMobile,
} from "./mobileApi";

describe("farmer mobile API boundary", () => {
  it("normalizes Indian mobile numbers and rejects invalid ranges", () => {
    expect(normalizeIndianMobile("98480 10467")).toBe("+919848010467");
    expect(normalizeIndianMobile("+91-98480-10467")).toBe("+919848010467");
    expect(normalizeIndianMobile("5123456789")).toBeNull();
  });

  it("masks phone numbers and validates OTP/challenge shapes", () => {
    expect(maskIndianMobile("+919848010467")).toBe("+91******0467");
    expect(isSixDigitOtp("123456")).toBe(true);
    expect(isSixDigitOtp("12345x")).toBe(false);
    expect(isUuid("49749000-9a8e-43ac-a8d3-8691c4122df8")).toBe(true);
    expect(isSandboxStaticOtp("123456")).toBe(true);
    expect(isSandboxStaticOtp("123455")).toBe(false);
  });

  it("keeps consent and profile gates fail-closed", () => {
    expect(mobileOnboardingStatus({ hasProfile: true, baselineAccepted: false })).toBe(
      "consent_pending",
    );
    expect(mobileOnboardingStatus({ hasProfile: false, baselineAccepted: true })).toBe(
      "profile_pending",
    );
    expect(mobileOnboardingStatus({ hasProfile: true, baselineAccepted: true })).toBe(
      "verification_optional",
    );
  });
});
