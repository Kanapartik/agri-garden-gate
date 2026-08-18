CREATE TYPE public.geo_level AS ENUM ('country','state','district','block','village');
CREATE TYPE public.onboarding_status AS ENUM ('draft','pending','activated','rejected','withdrawn');
CREATE TYPE public.step_status AS ENUM ('not_started','in_progress','complete');

-- ============ feature_flags ============
CREATE TABLE public.feature_flags (
  key text PRIMARY KEY,
  label text NOT NULL,
  description text,
  enabled boolean NOT NULL DEFAULT false,
  environments jsonb NOT NULL DEFAULT '["development","sandbox"]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.feature_flags TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.feature_flags TO authenticated;
GRANT ALL ON public.feature_flags TO service_role;
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY feature_flags_read_all ON public.feature_flags FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY feature_flags_write_admin ON public.feature_flags FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'platform_admin')) WITH CHECK (public.has_role(auth.uid(),'platform_admin'));

-- ============ geographies ============
CREATE TABLE public.geographies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  level public.geo_level NOT NULL,
  parent_id uuid REFERENCES public.geographies(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX geographies_parent_idx ON public.geographies(parent_id);
GRANT SELECT ON public.geographies TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.geographies TO authenticated;
GRANT ALL ON public.geographies TO service_role;
ALTER TABLE public.geographies ENABLE ROW LEVEL SECURITY;
CREATE POLICY geographies_read_all ON public.geographies FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY geographies_write_admin ON public.geographies FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'platform_admin')) WITH CHECK (public.has_role(auth.uid(),'platform_admin'));

-- ============ role_definitions ============
CREATE TABLE public.role_definitions (
  code text PRIMARY KEY,
  label text NOT NULL,
  description text NOT NULL,
  journey_kind text NOT NULL DEFAULT 'onboarding',
  is_public_selectable boolean NOT NULL DEFAULT false,
  feature_flag_key text REFERENCES public.feature_flags(key) ON DELETE SET NULL,
  authority_note text,
  sort_order integer NOT NULL DEFAULT 100,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.role_definitions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.role_definitions TO authenticated;
GRANT ALL ON public.role_definitions TO service_role;
ALTER TABLE public.role_definitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY role_definitions_read_all ON public.role_definitions FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY role_definitions_write_admin ON public.role_definitions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'platform_admin')) WITH CHECK (public.has_role(auth.uid(),'platform_admin'));

-- ============ onboarding_step_definitions ============
CREATE TABLE public.onboarding_step_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_code text NOT NULL REFERENCES public.role_definitions(code) ON DELETE CASCADE,
  step_key text NOT NULL,
  label text NOT NULL,
  help_text text,
  sort_order integer NOT NULL DEFAULT 100,
  is_required boolean NOT NULL DEFAULT true,
  fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  evidence_required jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (role_code, step_key)
);
GRANT SELECT ON public.onboarding_step_definitions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.onboarding_step_definitions TO authenticated;
GRANT ALL ON public.onboarding_step_definitions TO service_role;
ALTER TABLE public.onboarding_step_definitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY step_definitions_read_all ON public.onboarding_step_definitions FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY step_definitions_write_admin ON public.onboarding_step_definitions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'platform_admin')) WITH CHECK (public.has_role(auth.uid(),'platform_admin'));

-- ============ onboarding_applications ============
CREATE TABLE public.onboarding_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_code text NOT NULL REFERENCES public.role_definitions(code),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  geography_id uuid REFERENCES public.geographies(id) ON DELETE SET NULL,
  status public.onboarding_status NOT NULL DEFAULT 'draft',
  current_step_key text,
  form_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_synthetic boolean NOT NULL DEFAULT true,
  submitted_at timestamptz,
  decided_at timestamptz,
  decided_by uuid REFERENCES auth.users(id),
  decision_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX onboarding_apps_applicant_idx ON public.onboarding_applications(applicant_user_id);
CREATE INDEX onboarding_apps_tenant_idx ON public.onboarding_applications(tenant_id);
GRANT SELECT, INSERT, UPDATE ON public.onboarding_applications TO authenticated;
GRANT ALL ON public.onboarding_applications TO service_role;
ALTER TABLE public.onboarding_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY onboarding_apps_select_scoped ON public.onboarding_applications FOR SELECT TO authenticated
  USING (
    applicant_user_id = auth.uid()
    OR (tenant_id IS NOT NULL AND (
          public.has_tenant_role(auth.uid(), tenant_id, 'onboarding_officer')
       OR public.has_tenant_role(auth.uid(), tenant_id, 'tenant_admin')))
    OR public.has_role(auth.uid(),'platform_admin')
    OR public.has_role(auth.uid(),'auditor')
  );
CREATE POLICY onboarding_apps_insert_own ON public.onboarding_applications FOR INSERT TO authenticated
  WITH CHECK (applicant_user_id = auth.uid() AND status = 'draft');
CREATE POLICY onboarding_apps_update_own_draft ON public.onboarding_applications FOR UPDATE TO authenticated
  USING (applicant_user_id = auth.uid() AND status = 'draft')
  WITH CHECK (applicant_user_id = auth.uid() AND status IN ('draft','pending','withdrawn'));
CREATE POLICY onboarding_apps_update_reviewer ON public.onboarding_applications FOR UPDATE TO authenticated
  USING (
    (tenant_id IS NOT NULL AND (
          public.has_tenant_role(auth.uid(), tenant_id, 'onboarding_officer')
       OR public.has_tenant_role(auth.uid(), tenant_id, 'tenant_admin')))
    OR public.has_role(auth.uid(),'platform_admin')
  )
  WITH CHECK (
    (tenant_id IS NOT NULL AND (
          public.has_tenant_role(auth.uid(), tenant_id, 'onboarding_officer')
       OR public.has_tenant_role(auth.uid(), tenant_id, 'tenant_admin')))
    OR public.has_role(auth.uid(),'platform_admin')
  );

-- ============ onboarding_step_progress ============
CREATE TABLE public.onboarding_step_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.onboarding_applications(id) ON DELETE CASCADE,
  step_key text NOT NULL,
  status public.step_status NOT NULL DEFAULT 'not_started',
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (application_id, step_key)
);
GRANT SELECT, INSERT, UPDATE ON public.onboarding_step_progress TO authenticated;
GRANT ALL ON public.onboarding_step_progress TO service_role;
ALTER TABLE public.onboarding_step_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY step_progress_select_scoped ON public.onboarding_step_progress FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.onboarding_applications a WHERE a.id = application_id));
CREATE POLICY step_progress_insert_own ON public.onboarding_step_progress FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.onboarding_applications a
    WHERE a.id = application_id AND a.applicant_user_id = auth.uid() AND a.status = 'draft'
  ));
CREATE POLICY step_progress_update_own ON public.onboarding_step_progress FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.onboarding_applications a
    WHERE a.id = application_id AND a.applicant_user_id = auth.uid() AND a.status = 'draft'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.onboarding_applications a
    WHERE a.id = application_id AND a.applicant_user_id = auth.uid() AND a.status = 'draft'
  ));

-- ============ synthetic_actors ============
CREATE TABLE public.synthetic_actors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_key text NOT NULL UNIQUE,
  display_name text NOT NULL,
  role_code text NOT NULL,
  tenant_slug text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.synthetic_actors TO authenticated;
GRANT ALL ON public.synthetic_actors TO service_role;
ALTER TABLE public.synthetic_actors ENABLE ROW LEVEL SECURITY;
CREATE POLICY synthetic_actors_read ON public.synthetic_actors FOR SELECT TO authenticated USING (true);
CREATE POLICY synthetic_actors_write_admin ON public.synthetic_actors FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'platform_admin')) WITH CHECK (public.has_role(auth.uid(),'platform_admin'));

-- ============ updated_at ============
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
REVOKE ALL ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER touch_onboarding_apps BEFORE UPDATE ON public.onboarding_applications
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER touch_step_progress BEFORE UPDATE ON public.onboarding_step_progress
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
