import { describe, expect, it } from "vitest";
import {
  buildPromptPayload,
  canReadMonitoring,
  canWriteMonitoring,
  hasMonitoringConsent,
  parseAiSummary,
} from "./fpoMonitoring";

describe("fpo monitoring", () => {
  it("gates roles", () => {
    expect(canWriteMonitoring(["field_agent"])).toBe(true);
    expect(canWriteMonitoring(["viewer"])).toBe(false);
    expect(canReadMonitoring(["viewer"])).toBe(true);
    expect(canReadMonitoring(["scheme_reviewer"])).toBe(false);
  });
  it("requires member-management consent", () => {
    expect(hasMonitoringConsent(["fpo_market_linkage"])).toBe(false);
    expect(hasMonitoringConsent(["fpo_member_management"])).toBe(true);
  });
  it("redacts contacts from the prompt", () => {
    const p = buildPromptPayload("M-001", [
      {
        observed_on: "2026-09-01",
        crop: "Chilli",
        category: "pest",
        severity: "high",
        body: "Call +91 98480 10467 or a@b.com about thrips",
      },
    ]);
    expect(p).not.toContain("98480");
    expect(p).not.toContain("a@b.com");
    expect(p).toContain("thrips");
  });
  it("parses and clamps output", () => {
    const r = parseAiSummary(
      'x {"summary":"Thrips rising","questions":["a","b","c","d","e","f"]} y',
    );
    expect(r.summary).toBe("Thrips rising");
    expect(r.questions).toHaveLength(5);
    expect(parseAiSummary("plain text").summary).toBe("plain text");
  });
});
