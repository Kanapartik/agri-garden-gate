CREATE TABLE public.fpo_scheme_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scheme_id text NOT NULL UNIQUE,
  scheme_name text NOT NULL,
  level text,
  applicable_state text,
  beneficiary text,
  category text,
  fpo_relevance text,
  key_benefit text,
  indicative_limit text,
  eligibility_trigger text,
  implementer text,
  application_window text,
  source_url text,
  data_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.fpo_scheme_catalog TO authenticated;
GRANT ALL ON public.fpo_scheme_catalog TO service_role;
ALTER TABLE public.fpo_scheme_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scheme catalog readable by signed-in users" ON public.fpo_scheme_catalog FOR SELECT TO authenticated USING (true);
CREATE POLICY "platform admins manage scheme catalog" ON public.fpo_scheme_catalog FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'platform_admin')) WITH CHECK (public.has_role(auth.uid(), 'platform_admin'));
CREATE TRIGGER touch_fpo_scheme_catalog BEFORE UPDATE ON public.fpo_scheme_catalog FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.fpo_opportunity_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registry_id uuid REFERENCES public.fpo_registry(id) ON DELETE SET NULL,
  registration_number text NOT NULL UNIQUE,
  state_name text NOT NULL,
  district text,
  block_mandal text,
  fpo_name text NOT NULL,
  cbbo text,
  primary_commodity text,
  commodity_group text,
  member_count integer,
  annual_turnover_lakh numeric,
  priority_need text,
  existing_infrastructure text,
  enam_status text,
  benefits_10k_status text,
  loan_requirement_lakh numeric,
  gst_status text,
  fssai_status text,
  udyam_status text,
  data_readiness_score integer,
  opportunity_score integer,
  top_scheme_1 text,
  top_scheme_2 text,
  top_scheme_3 text,
  recommended_next_action text,
  verification_status text,
  last_verified date,
  owner_name text,
  notes text,
  source_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.fpo_opportunity_profiles TO authenticated;
GRANT ALL ON public.fpo_opportunity_profiles TO service_role;
ALTER TABLE public.fpo_opportunity_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "opportunity profiles readable by signed-in users" ON public.fpo_opportunity_profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "platform admins manage opportunity profiles" ON public.fpo_opportunity_profiles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'platform_admin')) WITH CHECK (public.has_role(auth.uid(), 'platform_admin'));
CREATE TRIGGER touch_fpo_opportunity_profiles BEFORE UPDATE ON public.fpo_opportunity_profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX fpo_opportunity_profiles_state_district_idx ON public.fpo_opportunity_profiles (state_name, district);

CREATE TABLE public.fpo_scheme_matrix (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registry_id uuid REFERENCES public.fpo_registry(id) ON DELETE SET NULL,
  registration_number text NOT NULL UNIQUE,
  state_name text NOT NULL,
  district text,
  fpo_name text NOT NULL,
  commodity_group text,
  priority_need text,
  flag_10k_benefits text,
  flag_enam text,
  flag_aif text,
  flag_pmfme text,
  flag_midh text,
  flag_mechanisation_chc text,
  flag_pm_rkvy text,
  flag_sampada text,
  flag_nmeo_op text,
  flag_pmmsy text,
  flag_state_micro_irrigation text,
  flag_state_income_support text,
  flag_state_other_benefit text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.fpo_scheme_matrix TO authenticated;
GRANT ALL ON public.fpo_scheme_matrix TO service_role;
ALTER TABLE public.fpo_scheme_matrix ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scheme matrix readable by signed-in users" ON public.fpo_scheme_matrix FOR SELECT TO authenticated USING (true);
CREATE POLICY "platform admins manage scheme matrix" ON public.fpo_scheme_matrix FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'platform_admin')) WITH CHECK (public.has_role(auth.uid(), 'platform_admin'));
CREATE TRIGGER touch_fpo_scheme_matrix BEFORE UPDATE ON public.fpo_scheme_matrix FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();