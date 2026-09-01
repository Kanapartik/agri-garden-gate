import { createFileRoute } from "@tanstack/react-router";
import { maskIndianMobile, mobileOnboardingStatus } from "@/lib/mobile/mobileApi";

export const Route = createFileRoute("/mobile/v1/me")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const correlationId = crypto.randomUUID();
        const { mobileError, mobileJson, requireMobileUser } =
          await import("@/lib/mobile/mobileApi.server");
        try {
          const { supabase, user, userId } = await requireMobileUser(request);
          const [
            { data: farmer },
            { data: publicProfile },
            { data: consents },
            { data: verification },
          ] = await Promise.all([
            supabase
              .from("farmer_profiles")
              .select("full_name, gender, total_extent_acres, village_code, updated_at")
              .eq("farmer_user_id", userId)
              .maybeSingle(),
            supabase
              .from("profiles")
              .select("full_name, updated_at")
              .eq("id", userId)
              .maybeSingle(),
            supabase
              .from("baseline_consents")
              .select("policy_version, revoked_at")
              .eq("subject_user_id", userId)
              .eq("policy_version", "2026-08-baseline-v1")
              .is("revoked_at", null),
            supabase
              .from("identity_verification_checks")
              .select(
                "id, status, adapter_name, reason_category, is_synthetic, created_at, decided_at",
              )
              .eq("subject_user_id", userId)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle(),
          ]);

          const fullName =
            farmer?.full_name ??
            publicProfile?.full_name ??
            user.user_metadata?.["full_name"] ??
            "";
          const gender = [
            "female",
            "male",
            "non_binary",
            "prefer_not_to_say",
            "self_described",
          ].includes(farmer?.gender ?? "")
            ? farmer?.gender
            : "prefer_not_to_say";
          const baselineAccepted = (consents ?? []).length > 0;
          const updatedAt =
            farmer?.updated_at ??
            publicProfile?.updated_at ??
            user.updated_at ??
            new Date().toISOString();
          const phoneMasked = user.phone ? maskIndianMobile(user.phone) : "+91******----";

          return mobileJson({
            id: userId,
            fullName,
            gender,
            preferredLocale: "te-IN",
            geography: {
              countryCode: "IN",
              stateCode: "IN-TG",
              district: "Siddipet",
              mandal: "Raipole",
              villageCode: farmer?.village_code ?? null,
            },
            phoneMasked,
            onboardingStatus: mobileOnboardingStatus({
              hasProfile: Boolean(farmer?.full_name),
              baselineAccepted,
            }),
            updatedAt,
            totalExtentAcres:
              farmer?.total_extent_acres === null ? null : Number(farmer?.total_extent_acres),
            identityVerification: verification
              ? {
                  id: verification.id,
                  status: verification.status,
                  adapter: verification.adapter_name,
                  reasonCategory: verification.reason_category,
                  isSynthetic: verification.is_synthetic,
                  requestedAt: verification.created_at,
                  decidedAt: verification.decided_at,
                }
              : null,
          });
        } catch (error) {
          if (error instanceof Error && error.message === "mobile_unauthorized") {
            return mobileError("unauthorized", 401, correlationId);
          }
          console.error("mobile_profile_error", correlationId, error);
          return mobileError("mobile_service_unavailable", 503, correlationId);
        }
      },
    },
  },
});
