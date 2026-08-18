-- B2: Farmer & assisted onboarding. Additive only; no existing object dropped.

CREATE TYPE public.onboarding_channel AS ENUM (
  'self_service', 'fpo_assisted', 'govt_camp_assisted', 'field_agent_assisted'
);
CREATE TYPE public.identity_check_status AS ENUM (
  'pending', 'verified', 'failed', 'manual_review', 'duplicate_hold'
);
CREATE TYPE public.farm_sync_state AS ENUM ('local_draft', 'synced', 'conflict');
CREATE TYPE public.consent_kind AS ENUM ('baseline_platform', 'optional_partner');

-- assisted mode on existing applications (actor / subject separation)
ALTER TABLE public.onboarding_applications
  ADD COLUMN IF NOT EXISTS channel public.onboarding_channel NOT NULL DEFAULT 'self_service',
  ADD COLUMN IF NOT EXISTS assisted_by_user_id uuid REFERENCES auth.users(id);

-- ------------------------------------------------------------------ farms
CREATE TABLE public.farm_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  application_id uuid REFERENCES public.onboarding_applications(id),
  captured_by_user_id uuid REFERENCES auth.users(id),
  channel public.onboarding_channel NOT NULL DEFAULT 'self_service',
  client_draft_id text NOT NULL,
  label text NOT NULL,
  village_code text,
  geography_id uuid REFERENCES public.geographies(id),
  plot_ref text NOT NULL,
  area_acres numeric(10,2),
  primary_crop text,
  boundary jsonb NOT NULL DEFAULT '[]'::jsonb,
  centroid_lat numeric(9,6),
  centroid_lng numeric(9,6),
  baseline_profile jsonb NOT NULL DEFAULT '{}'::jsonb,
  sync_state public.farm_sync_state NOT NULL DEFAULT 'synced',
  client_updated_at timestamptz,
  is_synthetic boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (farmer_user_id, client_draft_id),
  UNIQUE (farmer_user_id, plot_ref)
);
GRANT SELECT, INSERT, UPDATE ON public.farm_records TO authenticated;
GRANT ALL ON public.farm_records TO service_role;
ALTER TABLE public.farm_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY farm_select_own_or_capturer ON public.farm_records FOR SELECT TO authenticated
  USING (
    farmer_user_id = auth.uid()
    OR captured_by_user_id = auth.uid()
    OR public.has_role(auth.uid(), 'platform_admin')
    OR public.has_role(auth.uid(), 'auditor')
  );
CREATE POLICY farm_insert_own_or_capturer ON public.farm_records FOR INSERT TO authenticated
  WITH CHECK (farmer_user_id = auth.uid() OR captured_by_user_id = auth.uid());
CREATE POLICY farm_update_own_or_capturer ON public.farm_records FOR UPDATE TO authenticated
  USING (farmer_user_id = auth.uid() OR captured_by_user_id = auth.uid())
  WITH CHECK (farmer_user_id = auth.uid() OR captured_by_user_id = auth.uid());

CREATE TRIGGER touch_farm_records BEFORE UPDATE ON public.farm_records
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ----------------------------------------------- identity verification
CREATE TABLE public.identity_verification_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  application_id uuid REFERENCES public.onboarding_applications(id),
  requested_by_user_id uuid REFERENCES auth.users(id),
  jurisdiction_code text NOT NULL DEFAULT 'IN-TG',
  adapter_name text NOT NULL,
  status public.identity_check_status NOT NULL DEFAULT 'pending',
  reference_hash text,
  evidence_ref text,
  reason_category text,
  manual_review_note text,
  decided_by uuid REFERENCES auth.users(id),
  decided_at timestamptz,
  is_synthetic boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.identity_verification_checks TO authenticated;
GRANT ALL ON public.identity_verification_checks TO service_role;
ALTER TABLE public.identity_verification_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY idcheck_select_scoped ON public.identity_verification_checks FOR SELECT TO authenticated
  USING (
    subject_user_id = auth.uid()
    OR requested_by_user_id = auth.uid()
    OR public.has_role(auth.uid(), 'platform_admin')
    OR public.has_role(auth.uid(), 'auditor')
  );
CREATE POLICY idcheck_insert_scoped ON public.identity_verification_checks FOR INSERT TO authenticated
  WITH CHECK (subject_user_id = auth.uid() OR requested_by_user_id = auth.uid());
CREATE POLICY idcheck_update_reviewer ON public.identity_verification_checks FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'platform_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'platform_admin'));

-- ------------------------------------------------- baseline consent
CREATE TABLE public.baseline_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind public.consent_kind NOT NULL DEFAULT 'baseline_platform',
  policy_version text NOT NULL,
  locale text NOT NULL DEFAULT 'en',
  purposes jsonb NOT NULL DEFAULT '[]'::jsonb,
  channel public.onboarding_channel NOT NULL DEFAULT 'self_service',
  witnessed_by_user_id uuid REFERENCES auth.users(id),
  accepted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  UNIQUE (subject_user_id, kind, policy_version)
);
GRANT SELECT, INSERT, UPDATE ON public.baseline_consents TO authenticated;
GRANT ALL ON public.baseline_consents TO service_role;
ALTER TABLE public.baseline_consents ENABLE ROW LEVEL SECURITY;

CREATE POLICY baseline_consent_select ON public.baseline_consents FOR SELECT TO authenticated
  USING (
    subject_user_id = auth.uid()
    OR public.has_role(auth.uid(), 'platform_admin')
    OR public.has_role(auth.uid(), 'auditor')
  );
CREATE POLICY baseline_consent_insert_subject ON public.baseline_consents FOR INSERT TO authenticated
  WITH CHECK (subject_user_id = auth.uid());
CREATE POLICY baseline_consent_update_subject ON public.baseline_consents FOR UPDATE TO authenticated
  USING (subject_user_id = auth.uid())
  WITH CHECK (subject_user_id = auth.uid());

-- ------------------------------------------------------ funnel events
CREATE TABLE public.onboarding_funnel_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES auth.users(id),
  application_id uuid REFERENCES public.onboarding_applications(id),
  role_code text REFERENCES public.role_definitions(code),
  channel public.onboarding_channel NOT NULL DEFAULT 'self_service',
  event_code text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.onboarding_funnel_events TO authenticated;
GRANT ALL ON public.onboarding_funnel_events TO service_role;
ALTER TABLE public.onboarding_funnel_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY funnel_select_scoped ON public.onboarding_funnel_events FOR SELECT TO authenticated
  USING (
    subject_user_id = auth.uid()
    OR actor_user_id = auth.uid()
    OR public.has_role(auth.uid(), 'platform_admin')
    OR public.has_role(auth.uid(), 'auditor')
  );
CREATE POLICY funnel_insert_scoped ON public.onboarding_funnel_events FOR INSERT TO authenticated
  WITH CHECK (subject_user_id = auth.uid() OR actor_user_id = auth.uid());

CREATE INDEX idx_funnel_created ON public.onboarding_funnel_events (created_at DESC);
CREATE INDEX idx_farm_records_farmer ON public.farm_records (farmer_user_id);

-- ---------------------------------------------------------- config seed
INSERT INTO public.feature_flags (key, label, description, enabled, environments) VALUES
  ('onboarding.farmer_journey','Farmer journey (B2)','Self-service farmer onboarding loop', true, '["development","sandbox"]'::jsonb),
  ('onboarding.assisted_mode','Assisted onboarding','Field/FPO agent capture with actor/subject separation', true, '["development","sandbox"]'::jsonb),
  ('farm.offline_sync','Offline parcel drafts','Local draft capture with deferred, idempotent sync', true, '["development","sandbox"]'::jsonb),
  ('consent.partner_cards','Optional partner consent cards','Separate partner consent cards, never bundled with baseline', true, '["development","sandbox"]'::jsonb),
  ('onboarding.first_value_launcher','First-value launcher','Welcome / first meaningful action launcher', true, '["development","sandbox"]'::jsonb)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.platform_config (config_key, config_value, description) VALUES
  ('consent.baseline_policy_version','"2026-08-baseline-v1"'::jsonb,'Versioned baseline platform consent text in force'),
  ('identity.jurisdiction_default','"IN-TG"'::jsonb,'Default jurisdiction for the identity verification adapter');

-- optional baseline farm profile step: never blocks activation
INSERT INTO public.onboarding_step_definitions
  (role_code, step_key, label, help_text, sort_order, is_required, fields, evidence_required)
VALUES (
  'farmer','farm_profile','Farm profile (optional)',
  'Optional context. Leave anything blank if you do not have it — activation is never blocked on these.',
  35, false,
  '[{"name":"irrigation_source","label":"Irrigation source","type":"select","options":["Borewell","Canal","Rainfed","Tank","Other"],"required":false},
    {"name":"soil_type","label":"Soil type","type":"select","options":["Black","Red","Alluvial","Sandy","Unknown"],"required":false},
    {"name":"season","label":"Main season","type":"select","options":["Kharif","Rabi","Zaid","Year-round"],"required":false},
    {"name":"notes","label":"Anything else","type":"textarea","maxLength":300,"required":false}]'::jsonb,
  '[]'::jsonb
) ON CONFLICT (role_code, step_key) DO NOTHING;