CREATE TYPE public.fpo_application_status AS ENUM (
  'draft','documents_pending','ready_to_submit','submitted','under_review',
  'additional_info_requested','approved','rejected','benefit_pending','benefit_received','closed'
);

CREATE TYPE public.fpo_campaign_status AS ENUM ('draft','active','paused','closed');

CREATE TYPE public.fpo_facilitation_state AS ENUM (
  'identified','notified','authorization_pending','authorized',
  'application_started','application_submitted','declined','not_eligible'
);

-- 1. FPO scheme applications ------------------------------------------------
CREATE TABLE public.fpo_scheme_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  scheme_id uuid NOT NULL REFERENCES public.schemes(id) ON DELETE CASCADE,
  status public.fpo_application_status NOT NULL DEFAULT 'draft',
  reference_no text,
  title text NOT NULL,
  assigned_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  requires_signatory boolean NOT NULL DEFAULT true,
  pending_documents text[] NOT NULL DEFAULT '{}',
  requested_amount numeric(14,2),
  benefit_amount numeric(14,2),
  submitted_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  submitted_at timestamptz,
  decided_at timestamptz,
  note text,
  is_synthetic boolean NOT NULL DEFAULT false,
  created_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX fpo_scheme_applications_tenant_idx ON public.fpo_scheme_applications(tenant_id, status);
CREATE INDEX fpo_scheme_applications_scheme_idx ON public.fpo_scheme_applications(scheme_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fpo_scheme_applications TO authenticated;
GRANT ALL ON public.fpo_scheme_applications TO service_role;
ALTER TABLE public.fpo_scheme_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "FPO members read their scheme applications"
ON public.fpo_scheme_applications FOR SELECT TO authenticated
USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'platform_admin'));

CREATE POLICY "FPO admins manage their scheme applications"
ON public.fpo_scheme_applications FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'platform_admin') OR public.has_tenant_role(auth.uid(), tenant_id, 'tenant_admin'))
WITH CHECK (public.has_role(auth.uid(), 'platform_admin') OR public.has_tenant_role(auth.uid(), tenant_id, 'tenant_admin'));

CREATE TRIGGER touch_fpo_scheme_applications
BEFORE UPDATE ON public.fpo_scheme_applications
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2. Append-only application history --------------------------------------
CREATE TABLE public.fpo_application_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.fpo_scheme_applications(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  from_status public.fpo_application_status,
  to_status public.fpo_application_status NOT NULL,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX fpo_application_events_app_idx ON public.fpo_application_events(application_id, created_at DESC);

GRANT SELECT, INSERT ON public.fpo_application_events TO authenticated;
GRANT ALL ON public.fpo_application_events TO service_role;
ALTER TABLE public.fpo_application_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "FPO members read application history"
ON public.fpo_application_events FOR SELECT TO authenticated
USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'platform_admin'));

CREATE POLICY "FPO admins append application history"
ON public.fpo_application_events FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'platform_admin') OR public.has_tenant_role(auth.uid(), tenant_id, 'tenant_admin'));

CREATE OR REPLACE FUNCTION public.fpo_application_events_immutable()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  RAISE EXCEPTION 'fpo_application_events is append-only';
END;
$$;

CREATE TRIGGER fpo_application_events_no_update
BEFORE UPDATE ON public.fpo_application_events
FOR EACH ROW EXECUTE FUNCTION public.fpo_application_events_immutable();

CREATE TRIGGER fpo_application_events_no_delete
BEFORE DELETE ON public.fpo_application_events
FOR EACH ROW EXECUTE FUNCTION public.fpo_application_events_immutable();

-- 3. Member scheme campaigns ----------------------------------------------
CREATE TABLE public.fpo_member_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  scheme_id uuid REFERENCES public.schemes(id) ON DELETE SET NULL,
  name text NOT NULL,
  status public.fpo_campaign_status NOT NULL DEFAULT 'draft',
  note text,
  is_synthetic boolean NOT NULL DEFAULT false,
  created_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX fpo_member_campaigns_tenant_idx ON public.fpo_member_campaigns(tenant_id, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fpo_member_campaigns TO authenticated;
GRANT ALL ON public.fpo_member_campaigns TO service_role;
ALTER TABLE public.fpo_member_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "FPO members read their campaigns"
ON public.fpo_member_campaigns FOR SELECT TO authenticated
USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'platform_admin'));

CREATE POLICY "FPO admins manage their campaigns"
ON public.fpo_member_campaigns FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'platform_admin') OR public.has_tenant_role(auth.uid(), tenant_id, 'tenant_admin'))
WITH CHECK (public.has_role(auth.uid(), 'platform_admin') OR public.has_tenant_role(auth.uid(), tenant_id, 'tenant_admin'));

CREATE TRIGGER touch_fpo_member_campaigns
BEFORE UPDATE ON public.fpo_member_campaigns
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 4. Campaign members ------------------------------------------------------
CREATE TABLE public.fpo_campaign_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.fpo_member_campaigns(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.fpo_members(id) ON DELETE CASCADE,
  state public.fpo_facilitation_state NOT NULL DEFAULT 'identified',
  assigned_agent_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  farmer_application_id uuid REFERENCES public.scheme_applications(id) ON DELETE SET NULL,
  authorization_recorded_at timestamptz,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, member_id)
);

CREATE INDEX fpo_campaign_members_tenant_idx ON public.fpo_campaign_members(tenant_id, state);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fpo_campaign_members TO authenticated;
GRANT ALL ON public.fpo_campaign_members TO service_role;
ALTER TABLE public.fpo_campaign_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "FPO members read campaign cohorts"
ON public.fpo_campaign_members FOR SELECT TO authenticated
USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'platform_admin'));

CREATE POLICY "FPO admins manage campaign cohorts"
ON public.fpo_campaign_members FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'platform_admin') OR public.has_tenant_role(auth.uid(), tenant_id, 'tenant_admin'))
WITH CHECK (public.has_role(auth.uid(), 'platform_admin') OR public.has_tenant_role(auth.uid(), tenant_id, 'tenant_admin'));

CREATE TRIGGER touch_fpo_campaign_members
BEFORE UPDATE ON public.fpo_campaign_members
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 5. Synthetic AP / Telangana demo data ------------------------------------
INSERT INTO public.fpo_scheme_applications
  (tenant_id, scheme_id, status, reference_no, title, requires_signatory, pending_documents, requested_amount, benefit_amount, submitted_at, note, is_synthetic)
SELECT p.tenant_id, s.id,
  (ARRAY['documents_pending','submitted','under_review','approved','benefit_received']::public.fpo_application_status[])[1 + (row_number() OVER (PARTITION BY p.tenant_id ORDER BY s.title))::int % 5],
  'APP-' || upper(p.fpo_code) || '-' || lpad((row_number() OVER (PARTITION BY p.tenant_id ORDER BY s.title))::text, 3, '0'),
  s.title || ' — ' || p.display_name,
  true,
  CASE WHEN (row_number() OVER (PARTITION BY p.tenant_id ORDER BY s.title))::int % 5 = 1
       THEN ARRAY['board_resolution','audited_financials'] ELSE '{}'::text[] END,
  450000, NULL, now() - interval '12 days',
  'Synthetic demo application for workspace review.', true
FROM public.fpo_profiles p
JOIN public.schemes s ON s.status = 'published'
LIMIT 20;

INSERT INTO public.fpo_application_events (application_id, tenant_id, from_status, to_status, note)
SELECT a.id, a.tenant_id, 'draft', a.status, 'Synthetic history entry.'
FROM public.fpo_scheme_applications a WHERE a.is_synthetic;

INSERT INTO public.fpo_member_campaigns (tenant_id, scheme_id, name, status, note, is_synthetic)
SELECT p.tenant_id, s.id,
  'Assisted enrolment — ' || s.title,
  'active',
  'Members identified from the FPO registry; farmer authorization required before any submission.', true
FROM public.fpo_profiles p
JOIN LATERAL (
  SELECT id, title FROM public.schemes WHERE status = 'published' ORDER BY title LIMIT 1
) s ON true;

INSERT INTO public.fpo_campaign_members (campaign_id, tenant_id, member_id, state, note)
SELECT c.id, c.tenant_id, m.id,
  (ARRAY['identified','notified','authorization_pending','authorized']::public.fpo_facilitation_state[])[1 + (row_number() OVER (PARTITION BY c.id ORDER BY m.created_at))::int % 4],
  'Synthetic cohort member.'
FROM public.fpo_member_campaigns c
JOIN public.fpo_members m ON m.tenant_id = c.tenant_id
WHERE c.is_synthetic
ON CONFLICT (campaign_id, member_id) DO NOTHING;