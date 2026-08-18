DO $$ BEGIN
  CREATE TYPE public.service_domain AS ENUM ('chc_equipment_rental','logistics','ngo_csr_program','advisory_service','custom_hiring_labour');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.evidence_gate_state AS ENUM ('not_evaluated','evidence_pending','approved','rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.service_provider_state AS ENUM ('draft','submitted','verification','approved','rejected','suspended');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.certification_state AS ENUM ('draft','submitted','in_review','certified','declined','revoked');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.support_case_status AS ENUM ('new','triaged','in_progress','waiting_customer','resolved','closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE public.district_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  label text NOT NULL,
  description text NOT NULL DEFAULT '',
  default_locale text NOT NULL DEFAULT 'en',
  locales jsonb NOT NULL DEFAULT '["en"]'::jsonb,
  scheme_codes jsonb NOT NULL DEFAULT '[]'::jsonb,
  local_roles jsonb NOT NULL DEFAULT '[]'::jsonb,
  checklist jsonb NOT NULL DEFAULT '[]'::jsonb,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  version integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.district_templates TO authenticated;
GRANT ALL ON public.district_templates TO service_role;
ALTER TABLE public.district_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY dt_read ON public.district_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY dt_admin_write ON public.district_templates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'platform_admin') OR public.has_role(auth.uid(),'expansion_manager'))
  WITH CHECK (public.has_role(auth.uid(),'platform_admin') OR public.has_role(auth.uid(),'expansion_manager'));
CREATE TRIGGER touch_district_templates BEFORE UPDATE ON public.district_templates
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.district_template_clones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.district_templates(id) ON DELETE CASCADE,
  template_version integer NOT NULL,
  rollout_id uuid NOT NULL REFERENCES public.district_rollouts(id) ON DELETE CASCADE,
  geography_id uuid NOT NULL REFERENCES public.geographies(id),
  locale text NOT NULL DEFAULT 'en',
  applied_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  config_overrides jsonb NOT NULL DEFAULT '{}'::jsonb,
  cloned_scheme_codes jsonb NOT NULL DEFAULT '[]'::jsonb,
  local_roles jsonb NOT NULL DEFAULT '[]'::jsonb,
  forked_code boolean NOT NULL DEFAULT false,
  sequence_index integer NOT NULL DEFAULT 1,
  is_synthetic boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.district_template_clones TO authenticated;
GRANT ALL ON public.district_template_clones TO service_role;
ALTER TABLE public.district_template_clones ENABLE ROW LEVEL SECURITY;
CREATE POLICY dtc_read ON public.district_template_clones FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'platform_admin') OR public.has_role(auth.uid(),'auditor') OR public.has_role(auth.uid(),'expansion_manager'));
CREATE POLICY dtc_insert ON public.district_template_clones FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'platform_admin') OR public.has_role(auth.uid(),'expansion_manager'));

CREATE TABLE public.onboarding_effort_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rollout_id uuid NOT NULL REFERENCES public.district_rollouts(id) ON DELETE CASCADE,
  clone_id uuid REFERENCES public.district_template_clones(id) ON DELETE SET NULL,
  phase text NOT NULL,
  person_days numeric NOT NULL DEFAULT 0,
  cost_amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'INR',
  onboarded_count integer NOT NULL DEFAULT 0,
  notes text NOT NULL DEFAULT '',
  is_operational boolean NOT NULL DEFAULT false,
  is_synthetic boolean NOT NULL DEFAULT false,
  recorded_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.onboarding_effort_metrics TO authenticated;
GRANT ALL ON public.onboarding_effort_metrics TO service_role;
ALTER TABLE public.onboarding_effort_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY oem_read ON public.onboarding_effort_metrics FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'platform_admin') OR public.has_role(auth.uid(),'auditor') OR public.has_role(auth.uid(),'expansion_manager'));
CREATE POLICY oem_insert ON public.onboarding_effort_metrics FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'platform_admin') OR public.has_role(auth.uid(),'expansion_manager'));

CREATE TABLE public.service_subtypes (
  code text PRIMARY KEY,
  label text NOT NULL,
  domain service_domain NOT NULL,
  description text NOT NULL DEFAULT '',
  feature_flag_key text REFERENCES public.feature_flags(key),
  evidence_gate evidence_gate_state NOT NULL DEFAULT 'not_evaluated',
  evidence_note text,
  evidence_decided_by uuid REFERENCES auth.users(id),
  evidence_decided_at timestamptz,
  verification_checks jsonb NOT NULL DEFAULT '[]'::jsonb,
  dispute_categories jsonb NOT NULL DEFAULT '[]'::jsonb,
  requires_human_decision boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.service_subtypes TO authenticated;
GRANT ALL ON public.service_subtypes TO service_role;
ALTER TABLE public.service_subtypes ENABLE ROW LEVEL SECURITY;
CREATE POLICY sst_read ON public.service_subtypes FOR SELECT TO authenticated USING (true);
CREATE POLICY sst_admin_write ON public.service_subtypes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'platform_admin') OR public.has_role(auth.uid(),'expansion_manager'))
  WITH CHECK (public.has_role(auth.uid(),'platform_admin') OR public.has_role(auth.uid(),'expansion_manager'));
CREATE TRIGGER touch_service_subtypes BEFORE UPDATE ON public.service_subtypes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.service_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subtype_code text NOT NULL REFERENCES public.service_subtypes(code),
  organization_id uuid REFERENCES public.organizations(id),
  tenant_id uuid REFERENCES public.tenants(id),
  display_name text NOT NULL,
  contact_email text NOT NULL,
  service_regions jsonb NOT NULL DEFAULT '[]'::jsonb,
  geography_id uuid REFERENCES public.geographies(id),
  capacity jsonb NOT NULL DEFAULT '{}'::jsonb,
  state service_provider_state NOT NULL DEFAULT 'draft',
  decision_note text,
  decided_by uuid REFERENCES auth.users(id),
  decided_at timestamptz,
  is_synthetic boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.service_providers TO authenticated;
GRANT ALL ON public.service_providers TO service_role;
ALTER TABLE public.service_providers ENABLE ROW LEVEL SECURITY;
CREATE POLICY sp_owner_read ON public.service_providers FOR SELECT TO authenticated
  USING (created_by = auth.uid()
    OR state = 'approved'
    OR public.has_role(auth.uid(),'platform_admin')
    OR public.has_role(auth.uid(),'auditor')
    OR public.has_role(auth.uid(),'expansion_manager'));
CREATE POLICY sp_owner_insert ON public.service_providers FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());
CREATE POLICY sp_write ON public.service_providers FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(),'platform_admin') OR public.has_role(auth.uid(),'expansion_manager'))
  WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(),'platform_admin') OR public.has_role(auth.uid(),'expansion_manager'));
CREATE TRIGGER touch_service_providers BEFORE UPDATE ON public.service_providers
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.service_provider_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.service_providers(id) ON DELETE CASCADE,
  check_code text NOT NULL,
  label text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  evidence_ref text,
  note text,
  adapter_name text NOT NULL DEFAULT 'synthetic',
  decided_by uuid REFERENCES auth.users(id),
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider_id, check_code)
);
GRANT SELECT, INSERT, UPDATE ON public.service_provider_checks TO authenticated;
GRANT ALL ON public.service_provider_checks TO service_role;
ALTER TABLE public.service_provider_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY spc_read ON public.service_provider_checks FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.service_providers p WHERE p.id = provider_id AND p.created_by = auth.uid())
    OR public.has_role(auth.uid(),'platform_admin') OR public.has_role(auth.uid(),'auditor') OR public.has_role(auth.uid(),'expansion_manager'));
CREATE POLICY spc_insert ON public.service_provider_checks FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.service_providers p WHERE p.id = provider_id AND p.created_by = auth.uid())
    OR public.has_role(auth.uid(),'platform_admin') OR public.has_role(auth.uid(),'expansion_manager'));
CREATE POLICY spc_update ON public.service_provider_checks FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'platform_admin') OR public.has_role(auth.uid(),'expansion_manager'))
  WITH CHECK (public.has_role(auth.uid(),'platform_admin') OR public.has_role(auth.uid(),'expansion_manager'));

CREATE TABLE public.service_engagements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.service_providers(id) ON DELETE CASCADE,
  subtype_code text NOT NULL REFERENCES public.service_subtypes(code),
  requester_user_id uuid REFERENCES auth.users(id),
  requester_tenant_id uuid REFERENCES public.tenants(id),
  title text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  scheduled_for timestamptz,
  status text NOT NULL DEFAULT 'requested',
  status_note text,
  is_synthetic boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.service_engagements TO authenticated;
GRANT ALL ON public.service_engagements TO service_role;
ALTER TABLE public.service_engagements ENABLE ROW LEVEL SECURITY;
CREATE POLICY se_read ON public.service_engagements FOR SELECT TO authenticated
  USING (requester_user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.service_providers p WHERE p.id = provider_id AND p.created_by = auth.uid())
    OR public.has_role(auth.uid(),'platform_admin') OR public.has_role(auth.uid(),'auditor') OR public.has_role(auth.uid(),'expansion_manager'));
CREATE POLICY se_insert ON public.service_engagements FOR INSERT TO authenticated
  WITH CHECK (requester_user_id = auth.uid());
CREATE POLICY se_update ON public.service_engagements FOR UPDATE TO authenticated
  USING (requester_user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.service_providers p WHERE p.id = provider_id AND p.created_by = auth.uid())
    OR public.has_role(auth.uid(),'platform_admin'))
  WITH CHECK (requester_user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.service_providers p WHERE p.id = provider_id AND p.created_by = auth.uid())
    OR public.has_role(auth.uid(),'platform_admin'));
CREATE TRIGGER touch_service_engagements BEFORE UPDATE ON public.service_engagements
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.service_disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  engagement_id uuid NOT NULL REFERENCES public.service_engagements(id) ON DELETE CASCADE,
  subtype_code text NOT NULL REFERENCES public.service_subtypes(code),
  raised_by uuid REFERENCES auth.users(id),
  category text NOT NULL,
  summary text NOT NULL,
  status text NOT NULL DEFAULT 'human_review',
  resolution_note text,
  decided_by uuid REFERENCES auth.users(id),
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.service_disputes TO authenticated;
GRANT ALL ON public.service_disputes TO service_role;
ALTER TABLE public.service_disputes ENABLE ROW LEVEL SECURITY;
CREATE POLICY sd_read ON public.service_disputes FOR SELECT TO authenticated
  USING (raised_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.service_engagements e JOIN public.service_providers p ON p.id = e.provider_id
               WHERE e.id = engagement_id AND p.created_by = auth.uid())
    OR public.has_role(auth.uid(),'platform_admin') OR public.has_role(auth.uid(),'auditor')
    OR public.has_role(auth.uid(),'support_agent'));
CREATE POLICY sd_insert ON public.service_disputes FOR INSERT TO authenticated
  WITH CHECK (raised_by = auth.uid());
CREATE POLICY sd_decide ON public.service_disputes FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'platform_admin') OR public.has_role(auth.uid(),'support_agent'))
  WITH CHECK (public.has_role(auth.uid(),'platform_admin') OR public.has_role(auth.uid(),'support_agent'));
CREATE TRIGGER touch_service_disputes BEFORE UPDATE ON public.service_disputes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.partner_certifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_type text NOT NULL,
  subject_id uuid NOT NULL,
  programme_code text NOT NULL,
  criteria jsonb NOT NULL DEFAULT '[]'::jsonb,
  state certification_state NOT NULL DEFAULT 'draft',
  badge_awarded_at timestamptz,
  badge_expires_at timestamptz,
  decision_note text,
  decided_by uuid REFERENCES auth.users(id),
  decided_at timestamptz,
  is_synthetic boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.partner_certifications TO authenticated;
GRANT ALL ON public.partner_certifications TO service_role;
ALTER TABLE public.partner_certifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY pc_read ON public.partner_certifications FOR SELECT TO authenticated
  USING (created_by = auth.uid() OR state = 'certified'
    OR public.has_role(auth.uid(),'platform_admin') OR public.has_role(auth.uid(),'auditor')
    OR public.has_role(auth.uid(),'expansion_manager'));
CREATE POLICY pc_insert ON public.partner_certifications FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());
CREATE POLICY pc_decide ON public.partner_certifications FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(),'platform_admin') OR public.has_role(auth.uid(),'expansion_manager'))
  WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(),'platform_admin') OR public.has_role(auth.uid(),'expansion_manager'));
CREATE TRIGGER touch_partner_certifications BEFORE UPDATE ON public.partner_certifications
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.support_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_type text NOT NULL DEFAULT 'managed_onboarding',
  subject_type text NOT NULL,
  subject_id text NOT NULL,
  tenant_id uuid REFERENCES public.tenants(id),
  rollout_id uuid REFERENCES public.district_rollouts(id) ON DELETE SET NULL,
  requester_user_id uuid REFERENCES auth.users(id),
  severity text NOT NULL DEFAULT 'normal',
  queue text NOT NULL DEFAULT 'tier1_support',
  sla_hours integer NOT NULL DEFAULT 48,
  summary text NOT NULL,
  status support_case_status NOT NULL DEFAULT 'new',
  assigned_to uuid REFERENCES auth.users(id),
  resolution_note text,
  is_synthetic boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.support_cases TO authenticated;
GRANT ALL ON public.support_cases TO service_role;
ALTER TABLE public.support_cases ENABLE ROW LEVEL SECURITY;
CREATE POLICY sc_read ON public.support_cases FOR SELECT TO authenticated
  USING (requester_user_id = auth.uid() OR assigned_to = auth.uid()
    OR public.has_role(auth.uid(),'platform_admin') OR public.has_role(auth.uid(),'auditor')
    OR public.has_role(auth.uid(),'support_agent') OR public.has_role(auth.uid(),'expansion_manager'));
CREATE POLICY sc_insert ON public.support_cases FOR INSERT TO authenticated
  WITH CHECK (requester_user_id = auth.uid()
    OR public.has_role(auth.uid(),'support_agent') OR public.has_role(auth.uid(),'platform_admin'));
CREATE POLICY sc_update ON public.support_cases FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'platform_admin') OR public.has_role(auth.uid(),'support_agent'))
  WITH CHECK (public.has_role(auth.uid(),'platform_admin') OR public.has_role(auth.uid(),'support_agent'));
CREATE TRIGGER touch_support_cases BEFORE UPDATE ON public.support_cases
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.feature_flags (key, label, description, enabled, environments) VALUES
  ('expansion.district_templates','District template cloning','Clone a configured district template into a new geography.', true, '{"development":true,"sandbox":true,"production":false}'::jsonb),
  ('expansion.effort_instrumentation','Onboarding effort instrumentation','Capture person-days and cost per rollout phase.', true, '{"development":true,"sandbox":true,"production":false}'::jsonb),
  ('expansion.service_framework','Generic service provider onboarding','Base service provider onboarding framework.', true, '{"development":true,"sandbox":true,"production":false}'::jsonb),
  ('service.chc_equipment_rental','CHC / equipment rental','Custom hiring centre and equipment rental services.', false, '{"development":false,"sandbox":false,"production":false}'::jsonb),
  ('service.logistics','Logistics services','Transport and haulage service onboarding.', false, '{"development":false,"sandbox":false,"production":false}'::jsonb),
  ('service.ngo_csr_program','NGO / CSR programmes','NGO and CSR programme onboarding.', false, '{"development":false,"sandbox":false,"production":false}'::jsonb),
  ('service.advisory_service','Advisory services','Paid or sponsored agronomy advisory services.', false, '{"development":false,"sandbox":false,"production":false}'::jsonb),
  ('service.custom_hiring_labour','Custom hiring labour','Labour crew services (talent domain remains out of scope).', false, '{"development":false,"sandbox":false,"production":false}'::jsonb),
  ('expansion.partner_certification','Partner certification programme','Certified badge workflow with human decision.', true, '{"development":true,"sandbox":true,"production":false}'::jsonb),
  ('expansion.managed_onboarding','Managed onboarding case type','Customer success / managed onboarding support cases.', true, '{"development":true,"sandbox":true,"production":false}'::jsonb)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.service_subtypes (code, label, domain, description, feature_flag_key, evidence_gate, verification_checks, dispute_categories, sort_order) VALUES
  ('chc_equipment_rental','CHC / equipment rental','chc_equipment_rental','Custom hiring centre renting equipment to farmers.','service.chc_equipment_rental','not_evaluated',
    '[{"code":"entity_proof","label":"Registered entity proof"},{"code":"equipment_inventory","label":"Verified equipment inventory"},{"code":"operator_safety","label":"Operator safety attestation"},{"code":"insurance_cover","label":"Third-party insurance cover"}]'::jsonb,
    '["equipment_not_delivered","equipment_unsafe","billing_dispute","damage_claim"]'::jsonb, 1),
  ('logistics','Logistics services','logistics','Transport of inputs and produce.','service.logistics','not_evaluated',
    '[{"code":"entity_proof","label":"Registered entity proof"},{"code":"fleet_permit","label":"Fleet permit and fitness"},{"code":"driver_licence","label":"Driver licence verification"},{"code":"goods_insurance","label":"Goods in transit insurance"}]'::jsonb,
    '["late_pickup","load_shortage","damage_in_transit","billing_dispute"]'::jsonb, 2),
  ('ngo_csr_program','NGO / CSR programme','ngo_csr_program','NGO or CSR-funded farmer programme delivery.','service.ngo_csr_program','not_evaluated',
    '[{"code":"entity_proof","label":"Registered NGO / trust proof"},{"code":"funding_disclosure","label":"Funding source disclosure"},{"code":"beneficiary_consent_policy","label":"Beneficiary consent policy review"},{"code":"programme_scope","label":"Programme scope approval"}]'::jsonb,
    '["beneficiary_exclusion","misreported_outcome","consent_violation"]'::jsonb, 3),
  ('advisory_service','Advisory service','advisory_service','Agronomy advisory provider.','service.advisory_service','not_evaluated',
    '[{"code":"entity_proof","label":"Registered entity proof"},{"code":"advisor_credentials","label":"Advisor credentials"},{"code":"conflict_disclosure","label":"Commercial conflict disclosure"}]'::jsonb,
    '["misleading_advice","undisclosed_conflict","service_not_delivered"]'::jsonb, 4),
  ('custom_hiring_labour','Custom hiring labour','custom_hiring_labour','Labour crew coordination for field operations.','service.custom_hiring_labour','not_evaluated',
    '[{"code":"entity_proof","label":"Registered entity proof"},{"code":"wage_compliance","label":"Wage compliance attestation"},{"code":"safety_policy","label":"Worker safety policy"}]'::jsonb,
    '["crew_no_show","wage_dispute","safety_incident"]'::jsonb, 5)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.district_templates (code, label, description, default_locale, locales, scheme_codes, local_roles, checklist, config, is_active) VALUES
  ('anchor_district_v1','Anchor district baseline','Configuration captured from the anchor district rollout: geography scope, languages, scheme set and local roles.','en',
   '["en","te","hi"]'::jsonb,
   '["seed_subsidy","drip_irrigation_support"]'::jsonb,
   '["tenant_admin","onboarding_officer","field_agent","scheme_reviewer"]'::jsonb,
   '[{"key":"geography_configured","label":"Geography tree configured","required":true},{"key":"languages_enabled","label":"Languages enabled","required":true},{"key":"schemes_published","label":"Schemes published","required":true},{"key":"local_roles_granted","label":"Local roles granted","required":true},{"key":"training_complete","label":"Role training complete","required":true},{"key":"support_routing","label":"Support routing configured","required":true}]'::jsonb,
   '{"assisted_channels":["fpo_assisted","govt_camp_assisted","field_agent_assisted"],"identity_adapter":"mock_jurisdiction","effort_baseline_person_days":120}'::jsonb,
   true)
ON CONFLICT (code) DO NOTHING;