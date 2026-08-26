-- Phase 9: FPO team & permissions

CREATE TYPE public.fpo_staff_status AS ENUM ('invited', 'active', 'suspended', 'removed');
CREATE TYPE public.fpo_permission_level AS ENUM ('none', 'read', 'write', 'manage');
CREATE TYPE public.fpo_access_review_decision AS ENUM ('retained', 'role_changed', 'scope_changed', 'suspended', 'removed');

CREATE TABLE public.fpo_staff_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  display_name text NOT NULL,
  designation text,
  contact_hint text,
  staff_role public.app_role NOT NULL,
  status public.fpo_staff_status NOT NULL DEFAULT 'invited',
  district_scope text[] NOT NULL DEFAULT '{}',
  mandal_scope text[] NOT NULL DEFAULT '{}',
  invitation_id uuid REFERENCES public.tenant_invitations(id) ON DELETE SET NULL,
  notes text,
  last_reviewed_at timestamptz,
  suspended_reason text,
  created_by uuid,
  is_synthetic boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_fpo_staff_members_tenant ON public.fpo_staff_members(tenant_id, status);
CREATE INDEX idx_fpo_staff_members_user ON public.fpo_staff_members(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fpo_staff_members TO authenticated;
GRANT ALL ON public.fpo_staff_members TO service_role;
ALTER TABLE public.fpo_staff_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members read fpo staff"
  ON public.fpo_staff_members FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'platform_admin')
    OR public.has_role(auth.uid(), 'auditor')
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.tenant_id = fpo_staff_members.tenant_id
    )
  );

CREATE POLICY "Tenant admins write fpo staff"
  ON public.fpo_staff_members FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'platform_admin')
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.tenant_id = fpo_staff_members.tenant_id
        AND ur.role = 'tenant_admin'
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'platform_admin')
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.tenant_id = fpo_staff_members.tenant_id
        AND ur.role = 'tenant_admin'
    )
  );

CREATE TRIGGER touch_fpo_staff_members
  BEFORE UPDATE ON public.fpo_staff_members
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.fpo_role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  staff_role public.app_role NOT NULL,
  section text NOT NULL,
  level public.fpo_permission_level NOT NULL DEFAULT 'none',
  rationale text,
  updated_by uuid,
  is_synthetic boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_fpo_role_permissions_tenant_unique
  ON public.fpo_role_permissions(tenant_id, staff_role, section)
  WHERE tenant_id IS NOT NULL;
CREATE UNIQUE INDEX idx_fpo_role_permissions_default_unique
  ON public.fpo_role_permissions(staff_role, section)
  WHERE tenant_id IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fpo_role_permissions TO authenticated;
GRANT ALL ON public.fpo_role_permissions TO service_role;
ALTER TABLE public.fpo_role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read fpo role permissions"
  ON public.fpo_role_permissions FOR SELECT TO authenticated
  USING (
    tenant_id IS NULL
    OR public.has_role(auth.uid(), 'platform_admin')
    OR public.has_role(auth.uid(), 'auditor')
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.tenant_id = fpo_role_permissions.tenant_id
    )
  );

CREATE POLICY "Tenant admins write fpo role permissions"
  ON public.fpo_role_permissions FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'platform_admin')
    OR (
      tenant_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid() AND ur.tenant_id = fpo_role_permissions.tenant_id
          AND ur.role = 'tenant_admin'
      )
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'platform_admin')
    OR (
      tenant_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid() AND ur.tenant_id = fpo_role_permissions.tenant_id
          AND ur.role = 'tenant_admin'
      )
    )
  );

CREATE TRIGGER touch_fpo_role_permissions
  BEFORE UPDATE ON public.fpo_role_permissions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.fpo_access_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  staff_member_id uuid NOT NULL REFERENCES public.fpo_staff_members(id) ON DELETE CASCADE,
  decision public.fpo_access_review_decision NOT NULL,
  previous_role public.app_role,
  new_role public.app_role,
  notes text,
  reviewed_by uuid,
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  is_synthetic boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_fpo_access_reviews_tenant ON public.fpo_access_reviews(tenant_id, reviewed_at DESC);
CREATE INDEX idx_fpo_access_reviews_staff ON public.fpo_access_reviews(staff_member_id, reviewed_at DESC);

GRANT SELECT, INSERT ON public.fpo_access_reviews TO authenticated;
GRANT ALL ON public.fpo_access_reviews TO service_role;
ALTER TABLE public.fpo_access_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members read fpo access reviews"
  ON public.fpo_access_reviews FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'platform_admin')
    OR public.has_role(auth.uid(), 'auditor')
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.tenant_id = fpo_access_reviews.tenant_id
    )
  );

CREATE POLICY "Tenant admins record fpo access reviews"
  ON public.fpo_access_reviews FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'platform_admin')
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.tenant_id = fpo_access_reviews.tenant_id
        AND ur.role = 'tenant_admin'
    )
  );

-- Platform default permission matrix (tenant_id IS NULL)
INSERT INTO public.fpo_role_permissions (tenant_id, staff_role, section, level, rationale, is_synthetic)
SELECT NULL, p.role::public.app_role, s.section, p.level::public.fpo_permission_level, p.rationale, false
FROM (
  VALUES
    ('tenant_admin', 'manage', 'Organization admin manages the full workspace.'),
    ('onboarding_officer', 'write', 'Onboarding staff maintain farmer and application records.'),
    ('field_agent', 'read', 'Field staff record field data only; approvals stay with admins.'),
    ('viewer', 'read', 'Read-only workspace access.')
) AS p(role, level, rationale)
CROSS JOIN (
  VALUES ('overview'),('farmers'),('schemes'),('applications'),('procurement'),
         ('produce'),('accounts'),('opportunities'),('documents'),
         ('notifications'),('tasks'),('insights'),('team'),('settings')
) AS s(section);

UPDATE public.fpo_role_permissions
SET level = 'none', rationale = 'Financial and team administration stay with organization admins.'
WHERE tenant_id IS NULL
  AND staff_role = 'field_agent'
  AND section IN ('accounts', 'team', 'settings');

UPDATE public.fpo_role_permissions
SET level = 'read', rationale = 'Team and settings changes stay with organization admins.'
WHERE tenant_id IS NULL
  AND staff_role = 'onboarding_officer'
  AND section IN ('team', 'settings', 'accounts');

-- Synthetic staff for development tenants
INSERT INTO public.fpo_staff_members
  (tenant_id, display_name, designation, contact_hint, staff_role, status, district_scope, mandal_scope, notes, is_synthetic)
SELECT t.id, v.display_name, v.designation, v.contact_hint, v.staff_role::public.app_role,
       v.status::public.fpo_staff_status, v.districts, v.mandals, v.notes, true
FROM public.tenants t
JOIN (
  VALUES
    ('Guntur', 'Sailaja Rao', 'CEO', '+91 ..... ..210', 'tenant_admin', 'active', ARRAY['guntur'], ARRAY['tadikonda'], 'Synthetic development record.'),
    ('Guntur', 'Ramesh Naidu', 'Onboarding officer', '+91 ..... ..455', 'onboarding_officer', 'active', ARRAY['guntur'], ARRAY['tadikonda','mangalagiri'], 'Synthetic development record.'),
    ('Guntur', 'Lavanya P', 'Field agent', '+91 ..... ..871', 'field_agent', 'invited', ARRAY['guntur'], ARRAY['mangalagiri'], 'Synthetic development record.'),
    ('Karimnagar', 'Anil Kumar', 'Board secretary', '+91 ..... ..334', 'tenant_admin', 'active', ARRAY['karimnagar'], ARRAY['huzurabad'], 'Synthetic development record.'),
    ('Karimnagar', 'Deepa Reddy', 'Field agent', '+91 ..... ..902', 'field_agent', 'suspended', ARRAY['karimnagar'], ARRAY['jammikunta'], 'Synthetic development record.')
) AS v(tenant_hint, display_name, designation, contact_hint, staff_role, status, districts, mandals, notes)
  ON t.name ILIKE '%' || v.tenant_hint || '%'
WHERE t.tenant_type = 'fpo';

-- Synthetic tenant-level override
INSERT INTO public.fpo_role_permissions (tenant_id, staff_role, section, level, rationale, is_synthetic)
SELECT t.id, 'field_agent'::public.app_role, 'produce', 'write'::public.fpo_permission_level,
       'Synthetic override: field agents record produce collection at village level.', true
FROM public.tenants t
WHERE t.tenant_type = 'fpo' AND t.name ILIKE '%Guntur%'
ON CONFLICT DO NOTHING;

-- Synthetic access review trail
INSERT INTO public.fpo_access_reviews (tenant_id, staff_member_id, decision, previous_role, new_role, notes, is_synthetic)
SELECT s.tenant_id, s.id,
       CASE WHEN s.status = 'suspended' THEN 'suspended'::public.fpo_access_review_decision
            ELSE 'retained'::public.fpo_access_review_decision END,
       s.staff_role, s.staff_role,
       'Synthetic quarterly access review.', true
FROM public.fpo_staff_members s
WHERE s.is_synthetic = true;