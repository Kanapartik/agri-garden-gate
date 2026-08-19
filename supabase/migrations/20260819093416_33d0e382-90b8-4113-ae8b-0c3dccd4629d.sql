-- B2C: farmer portal profile + document intelligence

CREATE TYPE public.land_ownership_type AS ENUM ('owner','leased','share_cropped','mixed','landless');
CREATE TYPE public.social_category AS ENUM ('general','obc','sc','st','ews','not_disclosed');
CREATE TYPE public.farmer_doc_kind AS ENUM ('photo','bank_passbook','land_record','id_proof','other');
CREATE TYPE public.extraction_state AS ENUM ('pending','extracted','failed','confirmed');
CREATE TYPE public.field_provenance AS ENUM ('farmer_entered','ai_extracted','farmer_confirmed');

CREATE TABLE public.farmer_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  captured_by_user_id uuid REFERENCES auth.users(id),
  full_name text,
  photo_path text,
  date_of_birth date,
  gender text,
  social_category public.social_category,
  ownership_type public.land_ownership_type,
  total_extent_acres numeric(10,2),
  irrigation_source text,
  state_geography_id uuid REFERENCES public.geographies(id),
  district_geography_id uuid REFERENCES public.geographies(id),
  village_code text,
  centroid_lat numeric(9,6),
  centroid_lng numeric(9,6),
  bank_account_holder text,
  bank_name text,
  bank_branch text,
  bank_ifsc text,
  bank_account_last4 text,
  bank_account_hash text,
  land_record_ref_hash text,
  field_provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_synthetic boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.farmer_profiles TO authenticated;
GRANT ALL ON public.farmer_profiles TO service_role;
ALTER TABLE public.farmer_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "farmer_profile_select_own_or_capturer" ON public.farmer_profiles
  FOR SELECT TO authenticated
  USING (farmer_user_id = auth.uid() OR captured_by_user_id = auth.uid());
CREATE POLICY "farmer_profile_insert_own_or_capturer" ON public.farmer_profiles
  FOR INSERT TO authenticated
  WITH CHECK (farmer_user_id = auth.uid() OR captured_by_user_id = auth.uid());
CREATE POLICY "farmer_profile_update_own_or_capturer" ON public.farmer_profiles
  FOR UPDATE TO authenticated
  USING (farmer_user_id = auth.uid() OR captured_by_user_id = auth.uid())
  WITH CHECK (farmer_user_id = auth.uid() OR captured_by_user_id = auth.uid());

CREATE TRIGGER touch_farmer_profiles BEFORE UPDATE ON public.farmer_profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.farmer_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  uploaded_by_user_id uuid REFERENCES auth.users(id),
  doc_kind public.farmer_doc_kind NOT NULL,
  storage_path text NOT NULL,
  mime_type text,
  state public.extraction_state NOT NULL DEFAULT 'pending',
  extraction_error text,
  is_synthetic boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.farmer_documents TO authenticated;
GRANT ALL ON public.farmer_documents TO service_role;
ALTER TABLE public.farmer_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "farmer_docs_select_own_or_uploader" ON public.farmer_documents
  FOR SELECT TO authenticated
  USING (farmer_user_id = auth.uid() OR uploaded_by_user_id = auth.uid());
CREATE POLICY "farmer_docs_insert_own_or_uploader" ON public.farmer_documents
  FOR INSERT TO authenticated
  WITH CHECK (farmer_user_id = auth.uid() OR uploaded_by_user_id = auth.uid());
CREATE POLICY "farmer_docs_update_own_or_uploader" ON public.farmer_documents
  FOR UPDATE TO authenticated
  USING (farmer_user_id = auth.uid() OR uploaded_by_user_id = auth.uid())
  WITH CHECK (farmer_user_id = auth.uid() OR uploaded_by_user_id = auth.uid());
CREATE POLICY "farmer_docs_delete_own" ON public.farmer_documents
  FOR DELETE TO authenticated USING (farmer_user_id = auth.uid());

CREATE TRIGGER touch_farmer_documents BEFORE UPDATE ON public.farmer_documents
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.document_extractions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.farmer_documents(id) ON DELETE CASCADE,
  farmer_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  adapter_code text NOT NULL,
  model_code text,
  suggested_fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  confidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  provenance public.field_provenance NOT NULL DEFAULT 'ai_extracted',
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.document_extractions TO authenticated;
GRANT ALL ON public.document_extractions TO service_role;
ALTER TABLE public.document_extractions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "doc_extractions_select_own" ON public.document_extractions
  FOR SELECT TO authenticated USING (farmer_user_id = auth.uid());
CREATE POLICY "doc_extractions_insert_own" ON public.document_extractions
  FOR INSERT TO authenticated WITH CHECK (farmer_user_id = auth.uid());
CREATE POLICY "doc_extractions_update_own" ON public.document_extractions
  FOR UPDATE TO authenticated USING (farmer_user_id = auth.uid())
  WITH CHECK (farmer_user_id = auth.uid());

CREATE INDEX idx_farmer_docs_farmer ON public.farmer_documents(farmer_user_id);
CREATE INDEX idx_doc_extractions_doc ON public.document_extractions(document_id);