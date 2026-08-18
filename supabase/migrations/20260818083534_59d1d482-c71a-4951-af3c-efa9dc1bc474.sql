-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM (
  'platform_admin','auditor','tenant_admin','onboarding_officer','field_agent','consumer_api_manager','viewer'
);

CREATE TYPE public.tenant_type AS ENUM (
  'fpo','govt_dept','bank','insurer','agri_business','platform_ops'
);

CREATE TYPE public.consumer_tier AS ENUM ('sandbox','standard','premium');

CREATE TYPE public.membership_status AS ENUM ('active','suspended','revoked');

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  locale TEXT NOT NULL DEFAULT 'en-IN',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- ============ TENANTS ============
CREATE TABLE public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  tenant_type public.tenant_type NOT NULL,
  region_code TEXT,
  status public.membership_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.tenants TO authenticated;
GRANT ALL ON public.tenants TO service_role;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.tenant_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.membership_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id)
);
GRANT SELECT ON public.tenant_members TO authenticated;
GRANT ALL ON public.tenant_members TO service_role;
ALTER TABLE public.tenant_members ENABLE ROW LEVEL SECURITY;

-- ============ ROLES (separate table, never on profiles) ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX user_roles_unique_scope
  ON public.user_roles (user_id, role, COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid));
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ============ SECURITY DEFINER AUTHORIZATION FUNCTIONS ============
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role AND tenant_id IS NULL
  );
$$;

CREATE OR REPLACE FUNCTION public.has_tenant_role(_user_id UUID, _tenant_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.tenant_members tm
      ON tm.user_id = ur.user_id AND tm.tenant_id = _tenant_id AND tm.status = 'active'
    WHERE ur.user_id = _user_id AND ur.role = _role AND ur.tenant_id = _tenant_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_tenant_member(_user_id UUID, _tenant_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_members
    WHERE user_id = _user_id AND tenant_id = _tenant_id AND status = 'active'
  );
$$;

-- tenants / members / roles policies (tenant type never grants authority)
CREATE POLICY "tenants_select_member_or_admin" ON public.tenants FOR SELECT TO authenticated
USING (public.is_tenant_member(auth.uid(), id) OR public.has_role(auth.uid(), 'platform_admin') OR public.has_role(auth.uid(), 'auditor'));

CREATE POLICY "tenant_members_select_scoped" ON public.tenant_members FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_tenant_role(auth.uid(), tenant_id, 'tenant_admin')
  OR public.has_role(auth.uid(), 'platform_admin')
  OR public.has_role(auth.uid(), 'auditor')
);

CREATE POLICY "user_roles_select_scoped" ON public.user_roles FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR (tenant_id IS NOT NULL AND public.has_tenant_role(auth.uid(), tenant_id, 'tenant_admin'))
  OR public.has_role(auth.uid(), 'platform_admin')
  OR public.has_role(auth.uid(), 'auditor')
);

-- ============ CONFIGURATION OVER FORKS ============
CREATE TABLE public.platform_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  config_key TEXT NOT NULL,
  config_value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX platform_config_unique_key
  ON public.platform_config (config_key, COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid));
GRANT SELECT ON public.platform_config TO authenticated;
GRANT ALL ON public.platform_config TO service_role;
ALTER TABLE public.platform_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "platform_config_select" ON public.platform_config FOR SELECT TO authenticated
USING (tenant_id IS NULL OR public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "platform_config_write_admin" ON public.platform_config FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'platform_admin'))
WITH CHECK (public.has_role(auth.uid(), 'platform_admin'));

-- ============ API CONSUMERS (neutral access path) ============
CREATE TABLE public.api_consumers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  tier public.consumer_tier NOT NULL DEFAULT 'sandbox',
  -- observability/reporting only: authorization MUST NOT branch on this column
  is_first_party BOOLEAN NOT NULL DEFAULT false,
  status public.membership_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.api_consumers TO authenticated;
GRANT ALL ON public.api_consumers TO service_role;
ALTER TABLE public.api_consumers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "api_consumers_select_scoped" ON public.api_consumers FOR SELECT TO authenticated
USING (
  (tenant_id IS NOT NULL AND public.is_tenant_member(auth.uid(), tenant_id))
  OR public.has_role(auth.uid(), 'platform_admin')
  OR public.has_role(auth.uid(), 'auditor')
);

-- ============ PURPOSE-SCOPED CONSENT (default deny) ============
CREATE TABLE public.data_purposes (
  code TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  description TEXT NOT NULL,
  requires_explicit_consent BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.data_purposes TO authenticated;
GRANT ALL ON public.data_purposes TO service_role;
ALTER TABLE public.data_purposes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "data_purposes_select_authenticated" ON public.data_purposes FOR SELECT TO authenticated USING (true);

CREATE TABLE public.consent_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  purpose_code TEXT NOT NULL REFERENCES public.data_purposes(code) ON DELETE RESTRICT,
  consumer_id UUID NOT NULL REFERENCES public.api_consumers(id) ON DELETE CASCADE,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  UNIQUE (subject_user_id, purpose_code, consumer_id)
);
GRANT SELECT, INSERT, UPDATE ON public.consent_grants TO authenticated;
GRANT ALL ON public.consent_grants TO service_role;
ALTER TABLE public.consent_grants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "consent_subject_select_own" ON public.consent_grants FOR SELECT TO authenticated
USING (subject_user_id = auth.uid() OR public.has_role(auth.uid(), 'auditor') OR public.has_role(auth.uid(), 'platform_admin'));
CREATE POLICY "consent_subject_insert_own" ON public.consent_grants FOR INSERT TO authenticated
WITH CHECK (subject_user_id = auth.uid());
CREATE POLICY "consent_subject_update_own" ON public.consent_grants FOR UPDATE TO authenticated
USING (subject_user_id = auth.uid()) WITH CHECK (subject_user_id = auth.uid());

-- Default-deny consent check. Note: no branch on tier or is_first_party.
CREATE OR REPLACE FUNCTION public.has_consent(_subject_user_id UUID, _purpose_code TEXT, _consumer_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.consent_grants cg
    JOIN public.api_consumers ac ON ac.id = cg.consumer_id AND ac.status = 'active'
    WHERE cg.subject_user_id = _subject_user_id
      AND cg.purpose_code = _purpose_code
      AND cg.consumer_id = _consumer_id
      AND cg.revoked_at IS NULL
      AND (cg.expires_at IS NULL OR cg.expires_at > now())
  );
$$;

-- ============ AUDIT (append only) ============
CREATE TABLE public.audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  subject_type TEXT,
  subject_id TEXT,
  purpose_code TEXT,
  decision TEXT NOT NULL DEFAULT 'allow',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_events TO authenticated;
GRANT SELECT, INSERT ON public.audit_events TO service_role;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_insert_authenticated" ON public.audit_events FOR INSERT TO authenticated
WITH CHECK (actor_user_id = auth.uid() OR actor_user_id IS NULL);
CREATE POLICY "audit_read_privileged" ON public.audit_events FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'auditor') OR public.has_role(auth.uid(), 'platform_admin'));

CREATE OR REPLACE FUNCTION public.audit_events_immutable()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'audit_events is append-only';
END;
$$;
CREATE TRIGGER audit_events_no_update BEFORE UPDATE ON public.audit_events
FOR EACH ROW EXECUTE FUNCTION public.audit_events_immutable();
CREATE TRIGGER audit_events_no_delete BEFORE DELETE ON public.audit_events
FOR EACH ROW EXECUTE FUNCTION public.audit_events_immutable();

-- ============ PROFILE AUTOCREATE ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'full_name')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ SYNTHETIC FIXTURES (development) ============
INSERT INTO public.tenants (id, name, slug, tenant_type, region_code) VALUES
  ('11111111-1111-1111-1111-111111111111','AgriGhar Platform Ops','agrighar-platform-ops','platform_ops','IN'),
  ('22222222-2222-2222-2222-222222222222','Sunrise Farmer Producer Org (synthetic)','sunrise-fpo','fpo','IN-MH'),
  ('33333333-3333-3333-3333-333333333333','State Dept of Agriculture (synthetic)','state-agri-dept','govt_dept','IN-MH'),
  ('44444444-4444-4444-4444-444444444444','Green Valley Bank (synthetic)','green-valley-bank','bank','IN'),
  ('55555555-5555-5555-5555-555555555555','SafeHarvest Insurance (synthetic)','safeharvest-insurance','insurer','IN');

INSERT INTO public.data_purposes (code, label, description) VALUES
  ('onboarding_verification','Onboarding verification','Verify farmer identity and land evidence during onboarding.'),
  ('credit_assessment','Credit assessment','Share minimal farm profile with a lender for a credit decision by an authorized human role.'),
  ('crop_insurance','Crop insurance','Share plot and crop data with an insurer for policy underwriting or claims.'),
  ('advisory','Agronomy advisory','Provide crop advisory content based on plot and crop attributes.'),
  ('scheme_eligibility','Government scheme eligibility','Check eligibility for a government scheme via an authorized department role.');

INSERT INTO public.api_consumers (id, name, tenant_id, tier, is_first_party) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001','AgriGhar First-Party App','11111111-1111-1111-1111-111111111111','standard',true),
  ('aaaaaaaa-0000-0000-0000-000000000002','Third-Party Agritech Partner (synthetic)','22222222-2222-2222-2222-222222222222','standard',false),
  ('aaaaaaaa-0000-0000-0000-000000000003','Sandbox Test Consumer','11111111-1111-1111-1111-111111111111','sandbox',false);

INSERT INTO public.platform_config (config_key, config_value, description) VALUES
  ('role_catalog','["platform_admin","auditor","tenant_admin","onboarding_officer","field_agent","consumer_api_manager","viewer"]','Configurable role catalog surfaced in the UI.'),
  ('geography_levels','["country","state","district","block","village"]','Configurable administrative geography hierarchy.'),
  ('feature_flags','{"onboarding":false,"marketplace":false,"advertising":false,"talent":false,"ai_decisioning":false}','Domain activation flags; later domains stay off until a slice needs them.'),
  ('consumer_tiers','{"sandbox":{"rate_limit_per_min":30},"standard":{"rate_limit_per_min":300},"premium":{"rate_limit_per_min":3000}}','Tier limits applied identically to first-party and third-party consumers.');
