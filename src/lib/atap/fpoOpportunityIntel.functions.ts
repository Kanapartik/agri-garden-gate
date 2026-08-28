/**
 * FPO opportunity intelligence reads. Reference data (scheme catalogue, FPO
 * opportunity layer, scheme matrix) is readable by any signed-in user; it holds
 * no farmer personal data. Writes are platform-admin only and stay in SQL.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  OPPORTUNITY_ADVISORY,
  type OpportunityProfileRow,
  type SchemeCatalogRow,
  type SchemeMatrixRow,
} from "@/lib/atap/fpoOpportunityIntel";

export interface OpportunityIntelPayload {
  advisory: string;
  profiles: OpportunityProfileRow[];
  matrix: SchemeMatrixRow[];
  catalog: SchemeCatalogRow[];
}

export const getFpoOpportunityIntel = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<OpportunityIntelPayload> => {
    const supabase = context.supabase;

    const [profiles, matrix, catalog] = await Promise.all([
      supabase
        .from("fpo_opportunity_profiles")
        .select(
          "registration_number, state_name, district, block_mandal, fpo_name, cbbo, primary_commodity, commodity_group, member_count, annual_turnover_lakh, priority_need, existing_infrastructure, enam_status, benefits_10k_status, loan_requirement_lakh, gst_status, fssai_status, udyam_status, data_readiness_score, opportunity_score, top_scheme_1, top_scheme_2, top_scheme_3, recommended_next_action, verification_status, last_verified, owner_name, notes, source_url",
        )
        .order("opportunity_score", { ascending: false })
        .order("fpo_name", { ascending: true }),
      supabase
        .from("fpo_scheme_matrix")
        .select(
          "registration_number, state_name, district, fpo_name, commodity_group, priority_need, flag_10k_benefits, flag_enam, flag_aif, flag_pmfme, flag_midh, flag_mechanisation_chc, flag_pm_rkvy, flag_sampada, flag_nmeo_op, flag_pmmsy, flag_state_micro_irrigation, flag_state_income_support, flag_state_other_benefit",
        ),
      supabase
        .from("fpo_scheme_catalog")
        .select(
          "scheme_id, scheme_name, level, applicable_state, beneficiary, category, fpo_relevance, key_benefit, indicative_limit, eligibility_trigger, implementer, application_window, source_url, data_note",
        )
        .order("scheme_id", { ascending: true }),
    ]);

    const failure = profiles.error ?? matrix.error ?? catalog.error;
    if (failure) throw new Error(failure.message);

    return {
      advisory: OPPORTUNITY_ADVISORY,
      profiles: (profiles.data ?? []) as OpportunityProfileRow[],
      matrix: (matrix.data ?? []) as SchemeMatrixRow[],
      catalog: (catalog.data ?? []) as SchemeCatalogRow[],
    };
  });
