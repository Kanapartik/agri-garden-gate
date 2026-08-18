-- B3 step 2: FPO & government district MVP. Additive only.

CREATE TYPE public.invitation_status AS ENUM ('pending','accepted','revoked','expired');
CREATE TYPE public.member_status AS ENUM ('invited','active','suspended','removed');
CREATE TYPE public.scheme_status AS ENUM ('draft','published','closed');
CREATE TYPE public.scheme_application_status AS ENUM ('draft','submitted','in_review','approved','rejected','withdrawn');
CREATE TYPE public.rollout_status AS ENUM ('planned','configuring','piloting','live','paused');

/* ------------------------------------------------ staff invites / delegations */
CREATE TABLE public.tenant_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  invited_email text NOT NULL,
  invited_role public.app_role NOT NULL,
  status public.invitation_status NOT NULL DEFAULT 'pending',
  token_hash text NOT NULL,
  invited_by uuid NOT NULL REFERENCES auth.users(id),
  accepted_by uuid REFERENCES auth.users(id),
  accepted_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '14 days',
  is_synthetic boolean NOT NULL DEFAULT true,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX tenant_invitations_tenant_idx ON public.tenant_invitations(tenant_id, status);
GRANT SELECT, INSERT, UPDATE ON public.tenant_invitations TO authenticated;
GRANT ALL ON public.tenant_invitations TO service_role;
ALTER TABLE public.tenant_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invites readable by tenant admins and oversight"
  ON public.tenant_invitations FOR SELECT TO authenticated
  USING (
    public.has_tenant_role(auth.uid(), tenant_id, 'tenant_admin')
    OR public.has_role(auth.uid(), 'platform_admin')
    OR public.has_role(auth.uid(), 'auditor')
    OR accepted_by = auth.uid()
  );
CREATE POLICY "invites created by tenant admins"
  ON public.tenant_invitations FOR INSERT TO authenticated
  WITH CHECK (
    invited_by = auth.uid()
    AND (
      public.has_tenant_role(auth.uid(), tenant_id, 'tenant_admin')
      OR public.has_role(auth.uid(), 'platform_admin')
    )
  );
CREATE POLICY "invites updated by tenant admins or invitee"
  ON public.tenant_invitations FOR UPDATE TO authenticated
  USING (
    public.has_tenant_role(auth.uid(), tenant_id, 'tenant_admin')
    OR public.has_role(auth.uid(), 'platform_admin')
    OR accepted_by = auth.uid()
  );

/* ------------------------------------------------------------- FPO members */
CREATE TABLE public.member_import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  uploaded_by uuid NOT NULL REFERENCES auth.users(id),
  source_label text NOT NULL,
  row_count integer NOT NULL DEFAULT 0,
  accepted_count integer NOT NULL DEFAULT 0,
  rejected_count integer NOT NULL DEFAULT 0,
  errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_synthetic boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.member_import_batches TO authenticated;
GRANT ALL ON public.member_import_batches TO service_role;
ALTER TABLE public.member_import_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "batches readable by own tenant staff"
  ON public.member_import_batches FOR SELECT TO authenticated
  USING (
    public.has_tenant_role(auth.uid(), tenant_id, 'tenant_admin')
    OR public.has_tenant_role(auth.uid(), tenant_id, 'onboarding_officer')
    OR public.has_role(auth.uid(), 'platform_admin')
    OR public.has_role(auth.uid(), 'auditor')
  );
CREATE POLICY "batches inserted by own tenant staff"
  ON public.member_import_batches FOR INSERT TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid()
    AND (
      public.has_tenant_role(auth.uid(), tenant_id, 'tenant_admin')
      OR public.has_tenant_role(auth.uid(), tenant_id, 'onboarding_officer')
      OR public.has_role(auth.uid(), 'platform_admin')
    )
  );

CREATE TABLE public.fpo_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  member_ref text NOT NULL,
  display_name text NOT NULL,
  contact_hint text,
  village_code text,
  geography_id uuid REFERENCES public.geographies(id),
  farmer_user_id uuid REFERENCES auth.users(id),
  status public.member_status NOT NULL DEFAULT 'invited',
  import_batch_id uuid REFERENCES public.member_import_batches(id) ON DELETE SET NULL,
  added_by uuid REFERENCES auth.users(id),
  is_synthetic boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, member_ref)
);
CREATE INDEX fpo_members_tenant_idx ON public.fpo_members(tenant_id, status);
GRANT SELECT, INSERT, UPDATE ON public.fpo_members TO authenticated;
GRANT ALL ON public.fpo_members TO service_role;
ALTER TABLE public.fpo_members ENABLE ROW LEVEL SECURITY;

-- Membership records are FPO roster data, NOT farmer profile data. Roster
-- visibility never implies access to the member's farm or consented data.
CREATE POLICY "members readable by own tenant staff or the member"
  ON public.fpo_members FOR SELECT TO authenticated
  USING (
    farmer_user_id = auth.uid()
    OR public.has_tenant_role(auth.uid(), tenant_id, 'tenant_admin')
    OR public.has_tenant_role(auth.uid(), tenant_id, 'onboarding_officer')
    OR public.has_tenant_role(auth.uid(), tenant_id, 'field_agent')
    OR public.has_role(auth.uid(), 'platform_admin')
    OR public.has_role(auth.uid(), 'auditor')
  );
CREATE POLICY "members inserted by own tenant staff"
  ON public.fpo_members FOR INSERT TO authenticated
  WITH CHECK (
    public.has_tenant_role(auth.uid(), tenant_id, 'tenant_admin')
    OR public.has_tenant_role(auth.uid(), tenant_id, 'onboarding_officer')
    OR public.has_role(auth.uid(), 'platform_admin')
  );
CREATE POLICY "members updated by own tenant admins"
  ON public.fpo_members FOR UPDATE TO authenticated
  USING (
    public.has_tenant_role(auth.uid(), tenant_id, 'tenant_admin')
    OR public.has_tenant_role(auth.uid(), tenant_id, 'onboarding_officer')
    OR public.has_role(auth.uid(), 'platform_admin')
  );

/* ---------------------------------------------------------- scheme catalog */
CREATE TABLE public.schemes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  title text NOT NULL,
  summary text NOT NULL,
  geography_id uuid REFERENCES public.geographies(id),
  status public.scheme_status NOT NULL DEFAULT 'draft',
  current_version integer NOT NULL DEFAULT 0,
  requires_human_decision boolean NOT NULL DEFAULT true,
  is_synthetic boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.schemes TO authenticated;
GRANT ALL ON public.schemes TO service_role;
ALTER TABLE public.schemes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "published schemes are discoverable"
  ON public.schemes FOR SELECT TO authenticated
  USING (
    status = 'published'
    OR public.is_tenant_member(auth.uid(), tenant_id)
    OR public.has_role(auth.uid(), 'platform_admin')
    OR public.has_role(auth.uid(), 'auditor')
  );
CREATE POLICY "schemes authored by scheme publishers"
  ON public.schemes FOR INSERT TO authenticated
  WITH CHECK (
    public.has_tenant_role(auth.uid(), tenant_id, 'scheme_publisher')
    OR public.has_role(auth.uid(), 'platform_admin')
  );
CREATE POLICY "schemes updated by scheme publishers"
  ON public.schemes FOR UPDATE TO authenticated
  USING (
    public.has_tenant_role(auth.uid(), tenant_id, 'scheme_publisher')
    OR public.has_role(auth.uid(), 'platform_admin')
  );

CREATE TABLE public.scheme_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scheme_id uuid NOT NULL REFERENCES public.schemes(id) ON DELETE CASCADE,
  version integer NOT NULL,
  rules jsonb NOT NULL DEFAULT '[]'::jsonb,
  form_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  changelog text NOT NULL,
  created_by uuid REFERENCES auth.users(id),
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scheme_id, version)
);
GRANT SELECT, INSERT ON public.scheme_versions TO authenticated;
GRANT ALL ON public.scheme_versions TO service_role;
ALTER TABLE public.scheme_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scheme versions follow scheme visibility"
  ON public.scheme_versions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.schemes s
      WHERE s.id = scheme_versions.scheme_id
        AND (
          (s.status = 'published' AND scheme_versions.published_at IS NOT NULL)
          OR public.is_tenant_member(auth.uid(), s.tenant_id)
          OR public.has_role(auth.uid(), 'platform_admin')
          OR public.has_role(auth.uid(), 'auditor')
        )
    )
  );
CREATE POLICY "scheme versions written by scheme publishers"
  ON public.scheme_versions FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.schemes s
      WHERE s.id = scheme_versions.scheme_id
        AND (
          public.has_tenant_role(auth.uid(), s.tenant_id, 'scheme_publisher')
          OR public.has_role(auth.uid(), 'platform_admin')
        )
    )
  );

/* ----------------------------------------------------- scheme applications */
CREATE TABLE public.scheme_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scheme_id uuid NOT NULL REFERENCES public.schemes(id) ON DELETE CASCADE,
  scheme_version integer NOT NULL,
  applicant_user_id uuid NOT NULL REFERENCES auth.users(id),
  submitted_via_tenant_id uuid REFERENCES public.tenants(id),
  prefill_source text NOT NULL DEFAULT 'none',
  prefill_consent_ok boolean NOT NULL DEFAULT false,
  form_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  rule_evaluation jsonb NOT NULL DEFAULT '{}'::jsonb,
  status public.scheme_application_status NOT NULL DEFAULT 'draft',
  reviewer_user_id uuid REFERENCES auth.users(id),
  decision_note text,
  decided_at timestamptz,
  is_synthetic boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX scheme_applications_scheme_idx ON public.scheme_applications(scheme_id, status);
GRANT SELECT, INSERT, UPDATE ON public.scheme_applications TO authenticated;
GRANT ALL ON public.scheme_applications TO service_role;
ALTER TABLE public.scheme_applications ENABLE ROW LEVEL SECURITY;

-- Applicants see their own; only the publishing department's reviewers see
-- the queue. FPO staff get NO access to scheme application content.
CREATE POLICY "applications readable by applicant or scheme reviewers"
  ON public.scheme_applications FOR SELECT TO authenticated
  USING (
    applicant_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.schemes s
      WHERE s.id = scheme_applications.scheme_id
        AND (
          public.has_tenant_role(auth.uid(), s.tenant_id, 'scheme_reviewer')
          OR public.has_tenant_role(auth.uid(), s.tenant_id, 'scheme_publisher')
        )
    )
    OR public.has_role(auth.uid(), 'platform_admin')
    OR public.has_role(auth.uid(), 'auditor')
  );
CREATE POLICY "applications created by the applicant"
  ON public.scheme_applications FOR INSERT TO authenticated
  WITH CHECK (applicant_user_id = auth.uid());
CREATE POLICY "applications updated by applicant or scheme reviewers"
  ON public.scheme_applications FOR UPDATE TO authenticated
  USING (
    (applicant_user_id = auth.uid() AND status IN ('draft','submitted'))
    OR EXISTS (
      SELECT 1 FROM public.schemes s
      WHERE s.id = scheme_applications.scheme_id
        AND public.has_tenant_role(auth.uid(), s.tenant_id, 'scheme_reviewer')
    )
    OR public.has_role(auth.uid(), 'platform_admin')
  );

/* ------------------------------------------------------- district rollouts */
CREATE TABLE public.district_rollouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  geography_id uuid NOT NULL REFERENCES public.geographies(id),
  template_code text NOT NULL,
  label text NOT NULL,
  govt_tenant_id uuid REFERENCES public.tenants(id),
  fpo_tenant_id uuid REFERENCES public.tenants(id),
  status public.rollout_status NOT NULL DEFAULT 'planned',
  checklist jsonb NOT NULL DEFAULT '[]'::jsonb,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_synthetic boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (geography_id, template_code)
);
GRANT SELECT, INSERT, UPDATE ON public.district_rollouts TO authenticated;
GRANT ALL ON public.district_rollouts TO service_role;
ALTER TABLE public.district_rollouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rollouts readable by involved tenants and oversight"
  ON public.district_rollouts FOR SELECT TO authenticated
  USING (
    public.is_tenant_member(auth.uid(), govt_tenant_id)
    OR public.is_tenant_member(auth.uid(), fpo_tenant_id)
    OR public.has_role(auth.uid(), 'platform_admin')
    OR public.has_role(auth.uid(), 'auditor')
  );
CREATE POLICY "rollouts written by platform admins"
  ON public.district_rollouts FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'platform_admin'));
CREATE POLICY "rollouts updated by platform admins"
  ON public.district_rollouts FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'platform_admin'));

/* ---------------------------------------------------------- role training */
CREATE TABLE public.training_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  checklist_code text NOT NULL,
  item_key text NOT NULL,
  completed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, checklist_code, item_key)
);
GRANT SELECT, INSERT, DELETE ON public.training_completions TO authenticated;
GRANT ALL ON public.training_completions TO service_role;
ALTER TABLE public.training_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "training readable by self, own tenant admins, oversight"
  ON public.training_completions FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR (tenant_id IS NOT NULL AND public.has_tenant_role(auth.uid(), tenant_id, 'tenant_admin'))
    OR public.has_role(auth.uid(), 'platform_admin')
    OR public.has_role(auth.uid(), 'auditor')
  );
CREATE POLICY "training recorded by the learner"
  ON public.training_completions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "training cleared by the learner"
  ON public.training_completions FOR DELETE TO authenticated
  USING (user_id = auth.uid());

/* --------------------------------------------------------------- triggers */
CREATE TRIGGER touch_tenant_invitations BEFORE UPDATE ON public.tenant_invitations
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER touch_fpo_members BEFORE UPDATE ON public.fpo_members
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER touch_schemes BEFORE UPDATE ON public.schemes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER touch_scheme_applications BEFORE UPDATE ON public.scheme_applications
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER touch_district_rollouts BEFORE UPDATE ON public.district_rollouts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();