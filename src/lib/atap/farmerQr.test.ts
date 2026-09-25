import { describe, expect, it } from "vitest";
import { formatCode, newFarmerCode, nextQrMemberRef, parseFarmerQr, qrPayload } from "./farmerQr";

describe("farmer QR", () => {
  it("round-trips a code through the QR payload", () => {
    const code = newFarmerCode();
    expect(parseFarmerQr(qrPayload(code))).toBe(code);
  });
  it("accepts typed codes with dashes removed by caller-agnostic formatting", () => {
    const code = newFarmerCode();
    expect(parseFarmerQr(formatCode(code).replaceAll("-", "").toLowerCase())).toBe(code);
  });
  it("rejects anything else", () => {
    expect(parseFarmerQr("https://evil.example")).toBeNull();
    expect(parseFarmerQr("AGRIVAH-FARMER:123")).toBeNull();
  });
  it("numbers QR members sequentially", () => {
    expect(nextQrMemberRef(["GNT-0001", "QR-0002"])).toBe("QR-0003");
    expect(nextQrMemberRef([])).toBe("QR-0001");
  });
});
