import { describe, expect, it } from "vitest";
import { adapters } from "./index";

describe("external system adapters", () => {
  it("are synthetic in development and never decide high-stakes outcomes", async () => {
    const kyc = await adapters.identityKyc.verify({ referenceId: "SYN-1234" });
    expect(kyc.synthetic).toBe(true);

    const plot = await adapters.gis.resolvePlot({ plotRef: "SYN-PLOT-1" });
    expect(plot.synthetic).toBe(true);

    const quote = await adapters.payments.quote({ amountMinor: 10_000, currency: "INR" });
    expect(quote.synthetic).toBe(true);

    const scheme = await adapters.govtRegistry.lookupScheme({ schemeCode: "PMFBY" });
    expect(scheme.decision).toBe("requires_human_review");
  });
});
