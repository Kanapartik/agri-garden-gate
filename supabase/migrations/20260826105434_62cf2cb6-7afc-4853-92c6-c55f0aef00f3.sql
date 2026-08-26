CREATE TYPE public.fpo_doc_status AS ENUM ('uploaded','under_review','verified','rejected','expired');
CREATE TYPE public.fpo_profile_state AS ENUM ('draft','in_progress','submitted','verified','active','suspended');

CREATE TABLE public.fpo_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  fpo_code text NOT NULL,
  legal_name text NOT NULL,
  display_name text NOT NULL,
  registration_number text,
  incorporation_date date,
  org_type text,
  cin text,
  pan text,
  gst text,
  promoting_org text,
  fpo_category text,
  website text,
  phone text,
  email text,
  registered_address text,
  state_code text,
  district_code text,
  mandal text,
  village text,
  pin_code text,
  gps_lat numeric,
  gps_lng numeric,
  operational_districts text[] NOT NULL DEFAULT '{}',
  villages_served text[] NOT NULL DEFAULT '{}',
  registered_farmers integer NOT NULL DEFAULT 0,
  active_farmers integer NOT NULL DEFAULT 0,
  total_acres numeric NOT NULL DEFAULT 0,
  primary_crops text[] NOT NULL DEFAULT '{}',
  secondary_crops text[] NOT NULL DEFAULT '{}',
  input_categories text[] NOT NULL DEFAULT '{}',
  produce_categories text[] NOT NULL DEFAULT '{}',
  annual_produce_tonnes numeric,
  storage_facilities text[] NOT NULL DEFAULT '{}',
  processing_facilities text[] NOT NULL DEFAULT '{}',
  equipment text[] NOT NULL DEFAULT '{}',
  warehouse_relationships text[] NOT NULL DEFAULT '{}',
  logistics_relationships text[] NOT NULL DEFAULT '{}',
  onboarding_step text NOT NULL DEFAULT 'basic_details',
  state public.fpo_profile_state NOT NULL DEFAULT 'draft',
  verified_at timestamptz,
  is_synthetic boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.fpo_profiles TO authenticated;
GRANT ALL ON public.fpo_profiles TO service_role;
ALTER TABLE public.fpo_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fpo_profiles_read_members" ON public.fpo_profiles FOR SELECT TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id)
    OR public.has_role(auth.uid(), 'platform_admin')
    OR public.has_role(auth.uid(), 'auditor'));
CREATE POLICY "fpo_profiles_insert_admin" ON public.fpo_profiles FOR INSERT TO authenticated
  WITH CHECK (public.has_tenant_role(auth.uid(), tenant_id, 'tenant_admin')
    OR public.has_role(auth.uid(), 'platform_admin'));
CREATE POLICY "fpo_profiles_update_admin" ON public.fpo_profiles FOR UPDATE TO authenticated
  USING (public.has_tenant_role(auth.uid(), tenant_id, 'tenant_admin')
    OR public.has_role(auth.uid(), 'platform_admin'))
  WITH CHECK (public.has_tenant_role(auth.uid(), tenant_id, 'tenant_admin')
    OR public.has_role(auth.uid(), 'platform_admin'));
CREATE TRIGGER touch_fpo_profiles BEFORE UPDATE ON public.fpo_profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.fpo_leadership (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  role_title text NOT NULL,
  person_name text NOT NULL,
  user_id uuid,
  is_signatory boolean NOT NULL DEFAULT false,
  phone text,
  email text,
  is_synthetic boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fpo_leadership TO authenticated;
GRANT ALL ON public.fpo_leadership TO service_role;
ALTER TABLE public.fpo_leadership ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fpo_leadership_read_members" ON public.fpo_leadership FOR SELECT TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id)
    OR public.has_role(auth.uid(), 'platform_admin')
    OR public.has_role(auth.uid(), 'auditor'));
CREATE POLICY "fpo_leadership_write_admin" ON public.fpo_leadership FOR ALL TO authenticated
  USING (public.has_tenant_role(auth.uid(), tenant_id, 'tenant_admin')
    OR public.has_role(auth.uid(), 'platform_admin'))
  WITH CHECK (public.has_tenant_role(auth.uid(), tenant_id, 'tenant_admin')
    OR public.has_role(auth.uid(), 'platform_admin'));
CREATE TRIGGER touch_fpo_leadership BEFORE UPDATE ON public.fpo_leadership
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.fpo_bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  bank_name text NOT NULL,
  branch text,
  account_type text,
  account_last4 text,
  ifsc text,
  signatories text[] NOT NULL DEFAULT '{}',
  is_primary boolean NOT NULL DEFAULT true,
  is_synthetic boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.fpo_bank_accounts TO authenticated;
GRANT ALL ON public.fpo_bank_accounts TO service_role;
ALTER TABLE public.fpo_bank_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fpo_bank_read_admin" ON public.fpo_bank_accounts FOR SELECT TO authenticated
  USING (public.has_tenant_role(auth.uid(), tenant_id, 'tenant_admin')
    OR public.has_role(auth.uid(), 'platform_admin'));
CREATE POLICY "fpo_bank_insert_admin" ON public.fpo_bank_accounts FOR INSERT TO authenticated
  WITH CHECK (public.has_tenant_role(auth.uid(), tenant_id, 'tenant_admin')
    OR public.has_role(auth.uid(), 'platform_admin'));
CREATE POLICY "fpo_bank_update_admin" ON public.fpo_bank_accounts FOR UPDATE TO authenticated
  USING (public.has_tenant_role(auth.uid(), tenant_id, 'tenant_admin')
    OR public.has_role(auth.uid(), 'platform_admin'))
  WITH CHECK (public.has_tenant_role(auth.uid(), tenant_id, 'tenant_admin')
    OR public.has_role(auth.uid(), 'platform_admin'));
CREATE TRIGGER touch_fpo_bank_accounts BEFORE UPDATE ON public.fpo_bank_accounts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.fpo_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  doc_type text NOT NULL,
  title text NOT NULL,
  storage_path text,
  status public.fpo_doc_status NOT NULL DEFAULT 'uploaded',
  issued_on date,
  expires_at date,
  reviewer_user_id uuid,
  review_note text,
  reviewed_at timestamptz,
  uploaded_by uuid,
  is_synthetic boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.fpo_documents TO authenticated;
GRANT ALL ON public.fpo_documents TO service_role;
ALTER TABLE public.fpo_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fpo_documents_read_members" ON public.fpo_documents FOR SELECT TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id)
    OR public.has_role(auth.uid(), 'platform_admin')
    OR public.has_role(auth.uid(), 'auditor'));
CREATE POLICY "fpo_documents_insert_admin" ON public.fpo_documents FOR INSERT TO authenticated
  WITH CHECK (public.has_tenant_role(auth.uid(), tenant_id, 'tenant_admin')
    OR public.has_role(auth.uid(), 'platform_admin'));
CREATE POLICY "fpo_documents_update_admin" ON public.fpo_documents FOR UPDATE TO authenticated
  USING (public.has_tenant_role(auth.uid(), tenant_id, 'tenant_admin')
    OR public.has_role(auth.uid(), 'platform_admin'))
  WITH CHECK (public.has_tenant_role(auth.uid(), tenant_id, 'tenant_admin')
    OR public.has_role(auth.uid(), 'platform_admin'));
CREATE TRIGGER touch_fpo_documents BEFORE UPDATE ON public.fpo_documents
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX fpo_leadership_tenant_idx ON public.fpo_leadership(tenant_id);
CREATE INDEX fpo_documents_tenant_idx ON public.fpo_documents(tenant_id);
CREATE INDEX fpo_bank_tenant_idx ON public.fpo_bank_accounts(tenant_id);