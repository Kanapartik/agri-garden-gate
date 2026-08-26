-- 1. Membership lifecycle additions -------------------------------------
ALTER TYPE public.member_status ADD VALUE IF NOT EXISTS 'approval_pending';
ALTER TYPE public.member_status ADD VALUE IF NOT EXISTS 'exited';

ALTER TABLE public.fpo_members
  ADD COLUMN IF NOT EXISTS membership_number text,
  ADD COLUMN IF NOT EXISTS member_type text,
  ADD COLUMN IF NOT EXISTS crops text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS acreage numeric,
  ADD COLUMN IF NOT EXISTS village_cluster text,
  ADD COLUMN IF NOT EXISTS field_officer_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS joined_on date,
  ADD COLUMN IF NOT EXISTS exited_on date,
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS notes text;

CREATE UNIQUE INDEX IF NOT EXISTS fpo_members_tenant_membership_number_key
  ON public.fpo_members (tenant_id, membership_number)
  WHERE membership_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS fpo_members_farmer_idx ON public.fpo_members (farmer_user_id);
CREATE INDEX IF NOT EXISTS fpo_members_field_officer_idx ON public.fpo_members (field_officer_user_id);

-- 2. Tag catalogue -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fpo_member_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  code text NOT NULL,
  label text NOT NULL,
  color text,
  description text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fpo_member_tags TO authenticated;
GRANT ALL ON public.fpo_member_tags TO service_role;
ALTER TABLE public.fpo_member_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fpo_member_tags_read" ON public.fpo_member_tags
  FOR SELECT TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'platform_admin'));
CREATE POLICY "fpo_member_tags_write" ON public.fpo_member_tags
  FOR ALL TO authenticated
  USING (public.has_tenant_role(auth.uid(), tenant_id, 'tenant_admin') OR public.has_role(auth.uid(), 'platform_admin'))
  WITH CHECK (public.has_tenant_role(auth.uid(), tenant_id, 'tenant_admin') OR public.has_role(auth.uid(), 'platform_admin'));

CREATE TRIGGER touch_fpo_member_tags BEFORE UPDATE ON public.fpo_member_tags
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 3. Tag assignments -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fpo_member_tag_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.fpo_members(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.fpo_member_tags(id) ON DELETE CASCADE,
  assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (member_id, tag_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fpo_member_tag_assignments TO authenticated;
GRANT ALL ON public.fpo_member_tag_assignments TO service_role;
ALTER TABLE public.fpo_member_tag_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fpo_member_tag_assign_read" ON public.fpo_member_tag_assignments
  FOR SELECT TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'platform_admin'));
CREATE POLICY "fpo_member_tag_assign_write" ON public.fpo_member_tag_assignments
  FOR ALL TO authenticated
  USING (public.has_tenant_role(auth.uid(), tenant_id, 'tenant_admin') OR public.has_role(auth.uid(), 'platform_admin'))
  WITH CHECK (public.has_tenant_role(auth.uid(), tenant_id, 'tenant_admin') OR public.has_role(auth.uid(), 'platform_admin'));

CREATE INDEX IF NOT EXISTS fpo_member_tag_assign_member_idx ON public.fpo_member_tag_assignments (member_id);

-- 4. Saved segments ------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fpo_member_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_smart boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fpo_member_segments TO authenticated;
GRANT ALL ON public.fpo_member_segments TO service_role;
ALTER TABLE public.fpo_member_segments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fpo_member_segments_read" ON public.fpo_member_segments
  FOR SELECT TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'platform_admin'));
CREATE POLICY "fpo_member_segments_write" ON public.fpo_member_segments
  FOR ALL TO authenticated
  USING (public.has_tenant_role(auth.uid(), tenant_id, 'tenant_admin') OR public.has_role(auth.uid(), 'platform_admin'))
  WITH CHECK (public.has_tenant_role(auth.uid(), tenant_id, 'tenant_admin') OR public.has_role(auth.uid(), 'platform_admin'));

CREATE TRIGGER touch_fpo_member_segments BEFORE UPDATE ON public.fpo_member_segments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 5. FPO-scoped farmer consents -----------------------------------------
CREATE TABLE IF NOT EXISTS public.fpo_farmer_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  farmer_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  purpose_code text NOT NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at timestamptz,
  revoked_at timestamptz,
  evidence text,
  is_synthetic boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS fpo_farmer_consents_active_key
  ON public.fpo_farmer_consents (tenant_id, farmer_user_id, purpose_code)
  WHERE revoked_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fpo_farmer_consents TO authenticated;
GRANT ALL ON public.fpo_farmer_consents TO service_role;
ALTER TABLE public.fpo_farmer_consents ENABLE ROW LEVEL SECURITY;

-- FPO team can see consents granted to their own FPO; farmers always see their own.
CREATE POLICY "fpo_farmer_consents_read" ON public.fpo_farmer_consents
  FOR SELECT TO authenticated
  USING (
    farmer_user_id = auth.uid()
    OR public.is_tenant_member(auth.uid(), tenant_id)
    OR public.has_role(auth.uid(), 'platform_admin')
  );

-- Only the farmer, or an FPO admin recording documented authorization, may create a consent.
CREATE POLICY "fpo_farmer_consents_insert" ON public.fpo_farmer_consents
  FOR INSERT TO authenticated
  WITH CHECK (
    farmer_user_id = auth.uid()
    OR public.has_tenant_role(auth.uid(), tenant_id, 'tenant_admin')
    OR public.has_role(auth.uid(), 'platform_admin')
  );

-- Revocation: the farmer always; FPO admins may revoke consents held by their FPO.
CREATE POLICY "fpo_farmer_consents_update" ON public.fpo_farmer_consents
  FOR UPDATE TO authenticated
  USING (
    farmer_user_id = auth.uid()
    OR public.has_tenant_role(auth.uid(), tenant_id, 'tenant_admin')
    OR public.has_role(auth.uid(), 'platform_admin')
  )
  WITH CHECK (
    farmer_user_id = auth.uid()
    OR public.has_tenant_role(auth.uid(), tenant_id, 'tenant_admin')
    OR public.has_role(auth.uid(), 'platform_admin')
  );

CREATE TRIGGER touch_fpo_farmer_consents BEFORE UPDATE ON public.fpo_farmer_consents
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS fpo_farmer_consents_farmer_idx ON public.fpo_farmer_consents (farmer_user_id);

-- 6. Purpose catalogue entries for FPO membership work ------------------
INSERT INTO public.data_purposes (code, label, description)
VALUES
  ('fpo_member_management', 'FPO membership management', 'Allows an FPO to view a member''s farm and crop details for roster and planning work.'),
  ('fpo_scheme_assistance', 'FPO scheme assistance', 'Allows an FPO to view scheme-relevant profile details and assist the farmer with applications.'),
  ('fpo_market_linkage', 'FPO market linkage', 'Allows an FPO to use a member''s produce and harvest details for collective sales.')
ON CONFLICT (code) DO NOTHING;