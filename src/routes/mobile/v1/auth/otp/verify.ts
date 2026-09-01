import { createFileRoute } from "@tanstack/react-router";
import { isSixDigitOtp, isUuid, normalizeIndianMobile } from "@/lib/mobile/mobileApi";

export const Route = createFileRoute("/mobile/v1/auth/otp/verify")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const correlationId = crypto.randomUUID();
        const { createMobilePublicClient, mobileError, mobileJson, readJsonObject } =
          await import("@/lib/mobile/mobileApi.server");
        const body = await readJsonObject(request);
        const phone = normalizeIndianMobile(body?.["phone"]);
        if (!body || !isUuid(body["challengeId"]) || !phone || !isSixDigitOtp(body["otp"])) {
          return mobileError("invalid_otp_verification", 400, correlationId);
        }

        try {
          const supabase = createMobilePublicClient();
          const { data, error } = await supabase.auth.verifyOtp({
            phone,
            token: body["otp"],
            type: "sms",
          });
          if (error?.status === 429) return mobileError("otp_rate_limited", 429, correlationId);
          if (error || !data.session || !data.user) {
            return mobileError("otp_invalid_or_expired", 401, correlationId);
          }
          const expiresAt = new Date(
            (data.session.expires_at ?? Math.floor(Date.now() / 1000) + 3600) * 1000,
          );
          return mobileJson({
            accessToken: data.session.access_token,
            refreshToken: data.session.refresh_token,
            expiresAt: expiresAt.toISOString(),
            userId: data.user.id,
            isNewAccount: false,
          });
        } catch (error) {
          console.error("mobile_otp_verify_error", correlationId, error);
          return mobileError("mobile_service_unavailable", 503, correlationId);
        }
      },
    },
  },
});
