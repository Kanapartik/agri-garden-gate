import { createFileRoute } from "@tanstack/react-router";
import { MOBILE_LOCALE, maskIndianMobile, normalizeIndianMobile } from "@/lib/mobile/mobileApi";

export const Route = createFileRoute("/mobile/v1/auth/otp/request")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const correlationId = crypto.randomUUID();
        const { createMobilePublicClient, mobileError, mobileJson, readJsonObject } =
          await import("@/lib/mobile/mobileApi.server");
        const body = await readJsonObject(request);
        const phone = normalizeIndianMobile(body?.["phone"]);
        if (!body || !phone || body["channel"] !== "sms" || body["locale"] !== MOBILE_LOCALE) {
          return mobileError("invalid_otp_request", 400, correlationId);
        }

        try {
          const supabase = createMobilePublicClient();
          const { error } = await supabase.auth.signInWithOtp({
            phone,
            options: { shouldCreateUser: false },
          });
          if (error?.status === 429) return mobileError("otp_rate_limited", 429, correlationId);
          // Keep the response generic for unknown accounts and provider-safe 4xx failures.
          if (error && (error.status ?? 500) >= 500) {
            console.error("mobile_otp_provider_error", correlationId, error.code);
            return mobileError("otp_delivery_unavailable", 503, correlationId);
          }
          const now = Date.now();
          return mobileJson(
            {
              challengeId: crypto.randomUUID(),
              delivery: { channel: "sms", maskedDestination: maskIndianMobile(phone) },
              expiresAt: new Date(now + 10 * 60 * 1000).toISOString(),
              resendAfterSeconds: 60,
            },
            202,
          );
        } catch (error) {
          console.error("mobile_otp_request_error", correlationId, error);
          return mobileError("mobile_service_unavailable", 503, correlationId);
        }
      },
    },
  },
});
