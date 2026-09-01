import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/mobile/v1/bootstrap")({
  server: {
    handlers: {
      GET: async () => {
        const { mobileJson } = await import("@/lib/mobile/mobileApi.server");
        return mobileJson({
          apiVersion: "mobile-v1",
          pilotId: "pilot-siddipet-raipole-001",
          primaryLocale: "te-IN",
          fallbackLocale: "en-IN",
          minimumAndroidSdk: 31,
          consentContractVersion: "mobile-consent-2026-08-v1",
          baselinePolicyVersion: "2026-08-baseline-v1",
          maintenanceMessage: null,
        });
      },
    },
  },
});
