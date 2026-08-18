-- ============ enums ============
CREATE TYPE public.org_status AS ENUM ('draft','pending','approved','rejected','suspended');
CREATE TYPE public.tenant_relationship_type AS ENUM ('parent','affiliation','service_provider','data_partner');
CREATE TYPE public.contact_channel AS ENUM ('email','sms','whatsapp');
CREATE TYPE public.contact_verification_status AS ENUM ('pending','verified','failed','expired');
CREATE TYPE public.case_status AS ENUM ('open','in_review','approved','rejected','escalated');
CREATE TYPE public.record_status AS ENUM ('pending','active','verified','rejected','revoked');
CREATE TYPE public.workflow_status AS ENUM ('active','completed','cancelled');
CREATE TYPE public.privilege_request_status AS ENUM ('pending','approved','denied','expired','revoked');

-- ============ organization_subtypes (config) ============
CREATE TABLE public.organization_subtypes (
  code TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  tenant_type public.tenant_type NOT NULL,
  requires_approval BOOLEAN NOT NULL DEFAULT true,
  evidence_required JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.organization_subtypes TO anon, authenticated;
GRANT ALL ON public.organization_subtypes TO service_role;
ALTER TABLE public.organization_subtypes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "subtypes readable" ON public.organization_subtypes FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "subtypes admin write" ON public.organization_subtypes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'platform_admin')) WITH CHECK (public.has_role(auth.uid(),'platform_admin'));

-- ============ organizations ============
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  subtype_code TEXT NOT NULL REFERENCES public.organization_subtypes(code),
  registration_number TEXT,
  region_code TEXT,
  geography_id UUID REFERENCES public.geographies(id),
  status public.org_status NOT NULL DEFAULT 'draft',
  tenant_id UUID REFERENCES public.tenants(id),
  created_by UUID REFERENCES auth.users(id),
  decided_by UUID REFERENCES auth.users(id),
  decided_at TIMESTAMPTZ,
  decision_note TEXT,
  is_synthetic BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX organizations_reg_unique ON public.organizations (subtype_code, registration_number)
  WHERE registration_number IS NOT NULL;
GRANT SELECT, INSERT, UPDATE ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "orgs creator read" ON public.organizations FOR SELECT TO authenticated
  USING (created_by = auth.uid());
CREATE POLICY "orgs tenant read" ON public.organizations FOR SELECT TO authenticated
  USING (tenant_id IS NOT NULL AND public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "orgs oversight read" ON public.organizations FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'platform_admin') OR public.has_role(auth.uid(),'auditor'));
CREATE POLICY "orgs applicant create" ON public.organizations FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND status = 'draft' AND tenant_id IS NULL);
CREATE POLICY "orgs admin write" ON public.organizations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'platform_admin')) WITH CHECK (public.has_role(auth.uid(),'platform_admin'));
CREATE TRIGGER touch_organizations BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ tenant_relationships ============
CREATE TABLE public.tenant_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  to_tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  relationship_type public.tenant_relationship_type NOT NULL,
  status public.membership_status NOT NULL DEFAULT 'active',
  note TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT tenant_relationship_not_self CHECK (from_tenant_id <> to_tenant_id),
  CONSTRAINT tenant_relationship_unique UNIQUE (from_tenant_id, to_tenant_id, relationship_type)
);
GRANT SELECT ON public.tenant_relationships TO authenticated;
GRANT ALL ON public.tenant_relationships TO service_role;
ALTER TABLE public.tenant_relationships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant rel member read" ON public.tenant_relationships FOR SELECT TO authenticated
  USING (public.is_tenant_member(auth.uid(), from_tenant_id) OR public.is_tenant_member(auth.uid(), to_tenant_id));
CREATE POLICY "tenant rel oversight read" ON public.tenant_relationships FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'platform_admin') OR public.has_role(auth.uid(),'auditor'));

-- ============ contact_verifications ============
CREATE TABLE public.contact_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  channel public.contact_channel NOT NULL,
  target TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'synthetic',
  provider_ref TEXT,
  code_hash TEXT,
  status public.contact_verification_status NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ,
  verified_at TIMESTAMPTZ,
  is_synthetic BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.contact_verifications TO authenticated;
GRANT ALL ON public.contact_verifications TO service_role;
ALTER TABLE public.contact_verifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contact own read" ON public.contact_verifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "contact oversight read" ON public.contact_verifications FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'platform_admin') OR public.has_role(auth.uid(),'auditor'));

-- ============ verification_cases ============
CREATE TABLE public.verification_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_type TEXT NOT NULL,
  subject_type TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  tenant_id UUID REFERENCES public.tenants(id),
  status public.case_status NOT NULL DEFAULT 'open',
  assigned_to UUID REFERENCES auth.users(id),
  opened_by UUID REFERENCES auth.users(id),
  evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
  decision_note TEXT,
  decided_by UUID REFERENCES auth.users(id),
  decided_at TIMESTAMPTZ,
  is_synthetic BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.verification_cases TO authenticated;
GRANT ALL ON public.verification_cases TO service_role;
ALTER TABLE public.verification_cases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cases tenant read" ON public.verification_cases FOR SELECT TO authenticated
  USING (tenant_id IS NOT NULL AND (
    public.has_tenant_role(auth.uid(), tenant_id, 'tenant_admin')
    OR public.has_tenant_role(auth.uid(), tenant_id, 'onboarding_officer')));
CREATE POLICY "cases oversight read" ON public.verification_cases FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'platform_admin') OR public.has_role(auth.uid(),'auditor'));
CREATE TRIGGER touch_verification_cases BEFORE UPDATE ON public.verification_cases
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ agreement_records ============
CREATE TABLE public.agreement_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agreement_code TEXT NOT NULL,
  version TEXT NOT NULL,
  party_type TEXT NOT NULL,
  party_id TEXT NOT NULL,
  tenant_id UUID REFERENCES public.tenants(id),
  signed_by UUID REFERENCES auth.users(id),
  signed_at TIMESTAMPTZ,
  status public.record_status NOT NULL DEFAULT 'pending',
  document_id UUID,
  is_synthetic BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.agreement_records TO authenticated;
GRANT ALL ON public.agreement_records TO service_role;
ALTER TABLE public.agreement_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agreements own read" ON public.agreement_records FOR SELECT TO authenticated
  USING (signed_by = auth.uid());
CREATE POLICY "agreements tenant read" ON public.agreement_records FOR SELECT TO authenticated
  USING (tenant_id IS NOT NULL AND public.has_tenant_role(auth.uid(), tenant_id, 'tenant_admin'));
CREATE POLICY "agreements oversight read" ON public.agreement_records FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'platform_admin') OR public.has_role(auth.uid(),'auditor'));

-- ============ terms_acceptances ============
CREATE TABLE public.terms_acceptances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  terms_code TEXT NOT NULL,
  version TEXT NOT NULL,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT terms_acceptance_unique UNIQUE (user_id, terms_code, version)
);
GRANT SELECT, INSERT ON public.terms_acceptances TO authenticated;
GRANT ALL ON public.terms_acceptances TO service_role;
ALTER TABLE public.terms_acceptances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "terms own read" ON public.terms_acceptances FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "terms own insert" ON public.terms_acceptances FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "terms oversight read" ON public.terms_acceptances FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'platform_admin') OR public.has_role(auth.uid(),'auditor'));

-- ============ document_records ============
CREATE TABLE public.document_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  tenant_id UUID REFERENCES public.tenants(id),
  doc_type TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'synthetic',
  storage_path TEXT,
  checksum TEXT,
  status public.record_status NOT NULL DEFAULT 'pending',
  uploaded_by UUID REFERENCES auth.users(id),
  reviewed_by UUID REFERENCES auth.users(id),
  is_synthetic BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.document_records TO authenticated;
GRANT ALL ON public.document_records TO service_role;
ALTER TABLE public.document_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "documents own read" ON public.document_records FOR SELECT TO authenticated
  USING (uploaded_by = auth.uid());
CREATE POLICY "documents tenant read" ON public.document_records FOR SELECT TO authenticated
  USING (tenant_id IS NOT NULL AND (
    public.has_tenant_role(auth.uid(), tenant_id, 'tenant_admin')
    OR public.has_tenant_role(auth.uid(), tenant_id, 'onboarding_officer')));
CREATE POLICY "documents oversight read" ON public.document_records FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'platform_admin') OR public.has_role(auth.uid(),'auditor'));

-- ============ onboarding_workflows ============
CREATE TABLE public.onboarding_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_key TEXT NOT NULL,
  subject_type TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  tenant_id UUID REFERENCES public.tenants(id),
  current_state TEXT NOT NULL,
  status public.workflow_status NOT NULL DEFAULT 'active',
  state_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID REFERENCES auth.users(id),
  is_synthetic BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.onboarding_workflows TO authenticated;
GRANT ALL ON public.onboarding_workflows TO service_role;
ALTER TABLE public.onboarding_workflows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workflows own read" ON public.onboarding_workflows FOR SELECT TO authenticated
  USING (created_by = auth.uid());
CREATE POLICY "workflows tenant read" ON public.onboarding_workflows FOR SELECT TO authenticated
  USING (tenant_id IS NOT NULL AND (
    public.has_tenant_role(auth.uid(), tenant_id, 'tenant_admin')
    OR public.has_tenant_role(auth.uid(), tenant_id, 'onboarding_officer')));
CREATE POLICY "workflows oversight read" ON public.onboarding_workflows FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'platform_admin') OR public.has_role(auth.uid(),'auditor'));
CREATE TRIGGER touch_onboarding_workflows BEFORE UPDATE ON public.onboarding_workflows
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ privileged_access_requests ============
CREATE TABLE public.privileged_access_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requested_role public.app_role NOT NULL,
  tenant_id UUID REFERENCES public.tenants(id),
  justification TEXT NOT NULL,
  status public.privilege_request_status NOT NULL DEFAULT 'pending',
  mfa_verified BOOLEAN NOT NULL DEFAULT false,
  mfa_provider TEXT,
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.privileged_access_requests TO authenticated;
GRANT ALL ON public.privileged_access_requests TO service_role;
ALTER TABLE public.privileged_access_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "privilege own read" ON public.privileged_access_requests FOR SELECT TO authenticated
  USING (requester_user_id = auth.uid());
CREATE POLICY "privilege own insert" ON public.privileged_access_requests FOR INSERT TO authenticated
  WITH CHECK (requester_user_id = auth.uid() AND status = 'pending' AND approved_by IS NULL);
CREATE POLICY "privilege oversight read" ON public.privileged_access_requests FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'platform_admin') OR public.has_role(auth.uid(),'auditor'));

-- ============ consent_policies ============
CREATE TABLE public.consent_policies (
  code TEXT PRIMARY KEY,
  purpose_code TEXT NOT NULL REFERENCES public.data_purposes(code),
  description TEXT NOT NULL DEFAULT '',
  scope_template JSONB NOT NULL DEFAULT '[]'::jsonb,
  requires_explicit_consent BOOLEAN NOT NULL DEFAULT true,
  max_duration_days INTEGER NOT NULL DEFAULT 90,
  is_active BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.consent_policies TO anon, authenticated;
GRANT ALL ON public.consent_policies TO service_role;
ALTER TABLE public.consent_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "consent policies readable" ON public.consent_policies FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "consent policies admin write" ON public.consent_policies FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'platform_admin')) WITH CHECK (public.has_role(auth.uid(),'platform_admin'));

-- ============ tenant_entitlements (commercial only) ============
CREATE TABLE public.tenant_entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  plan_code TEXT NOT NULL,
  features JSONB NOT NULL DEFAULT '{}'::jsonb,
  status public.membership_status NOT NULL DEFAULT 'active',
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT tenant_entitlement_unique UNIQUE (tenant_id, plan_code)
);
GRANT SELECT ON public.tenant_entitlements TO authenticated;
GRANT ALL ON public.tenant_entitlements TO service_role;
ALTER TABLE public.tenant_entitlements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "entitlements tenant read" ON public.tenant_entitlements FOR SELECT TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id));
CREATE POLICY "entitlements oversight read" ON public.tenant_entitlements FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'platform_admin') OR public.has_role(auth.uid(),'auditor'));
CREATE TRIGGER touch_tenant_entitlements BEFORE UPDATE ON public.tenant_entitlements
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ seeds (configuration + synthetic) ============
INSERT INTO public.organization_subtypes (code, label, description, tenant_type, requires_approval, evidence_required, sort_order) VALUES
  ('fpo_registered','Registered FPO','Farmer Producer Organisation registered under company or cooperative law','fpo',true,'["registration_certificate","board_resolution"]',10),
  ('bank_branch','Bank / financial institution','Regulated lender participating in credit journeys','bank',true,'["regulator_licence","authorised_signatory"]',20),
  ('insurer','Insurer','Licensed crop or asset insurer','insurer',true,'["regulator_licence"]',30),
  ('govt_dept','Government department','Public department; tenancy alone confers no statutory authority','govt_dept',true,'["office_order"]',40),
  ('agri_business','Agri business','Input supplier, processor or agri service company','agri_business',true,'["incorporation_certificate"]',50),
  ('platform_ops','Platform operations','Internal AgriGhar operations tenant','platform_ops',true,'["internal_approval"]',60)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.consent_policies (code, purpose_code, description, scope_template, requires_explicit_consent, max_duration_days) VALUES
  ('advisory_basic','advisory','Non-identifying advisory context only','["geography_coarse","crop_calendar"]',true,180),
  ('onboarding_verification_basic','onboarding_verification','Verify identity/organisation claims during onboarding','["name","contact_verified_flag"]',true,30),
  ('credit_assessment_scoped','credit_assessment','Scoped credit assessment; the lender decides, never the platform','["name","landholding_summary"]',true,90),
  ('crop_insurance_scoped','crop_insurance','Scoped insurance underwriting inputs','["name","plot_summary"]',true,90),
  ('scheme_eligibility_scoped','scheme_eligibility','Scheme eligibility check by an authorised department','["name","geography"]',true,60)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.feature_flags (key, label, description, enabled, environments) VALUES
  ('admin_control_plane','Admin control plane','B1 admin queues for verification, org approval, tenant provisioning and role grants',true,'["development","sandbox"]'),
  ('privileged_access_workflow','Privileged access workflow','MFA-gated platform admin elevation requests',true,'["development","sandbox"]')
ON CONFLICT (key) DO NOTHING;