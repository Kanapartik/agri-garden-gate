-- B4: Bank, insurer & agritech developer onboarding (additive)

DO $$ BEGIN
  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'partner_developer';
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.partner_kind AS ENUM ('bank','insurer','agritech');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.partner_env AS ENUM ('sandbox','production');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.partner_reg_state AS ENUM ('draft','submitted','legal_review','security_review','approved','rejected','suspended');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.gate_status AS ENUM ('pending','approved','rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.partner_case_kind AS ENUM ('credit_signal','loan','claim','advisory');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.partner_case_status AS ENUM ('open','awaiting_evidence','awaiting_human_decision','approved','declined','withdrawn');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.partner_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  sandbox_tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  partner_kind public.partner_kind NOT NULL,
  display_name text NOT NULL,
  contact_email text NOT NULL,
  intended_use text NOT NULL DEFAULT '',
  requested_purposes text[] NOT NULL DEFAULT '{}',
  state public.partner_reg_state NOT NULL DEFAULT 'draft',
  legal_status public.gate_status NOT NULL DEFAULT 'pending',
  legal_note text,
  legal_decided_by uuid,
  legal_decided_at timestamptz,
  security_status public.gate_status NOT NULL DEFAULT 'pending',
  security_note text,
  security_decided_by uuid,
  security_decided_at timestamptz,
  created_by uuid,
  is_synthetic boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.partner_apps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id uuid NOT NULL REFERENCES public.partner_registrations(id) ON DELETE CASCADE,
  consumer_id uuid REFERENCES public.api_consumers(id) ON DELETE SET NULL,
  name text NOT NULL,
  environment public.partner_env NOT NULL DEFAULT 'sandbox',
  tier public.consumer_tier NOT NULL DEFAULT 'sandbox',
  scopes text[] NOT NULL DEFAULT '{}',
  redirect_uris text[] NOT NULL DEFAULT '{}',
  rate_limit_per_min integer NOT NULL DEFAULT 30,
  status text NOT NULL DEFAULT 'active',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.partner_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id uuid NOT NULL REFERENCES public.partner_apps(id) ON DELETE CASCADE,
  environment public.partner_env NOT NULL,
  client_id text NOT NULL UNIQUE,
  secret_prefix text NOT NULL,
  secret_hash text NOT NULL,
  scopes text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'active',
  issued_by uuid,
  issued_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.partner_production_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id uuid NOT NULL REFERENCES public.partner_registrations(id) ON DELETE CASCADE,
  app_id uuid NOT NULL REFERENCES public.partner_apps(id) ON DELETE CASCADE,
  requested_scopes text[] NOT NULL DEFAULT '{}',
  requested_tier public.consumer_tier NOT NULL DEFAULT 'standard',
  justification text NOT NULL DEFAULT '',
  status public.gate_status NOT NULL DEFAULT 'pending',
  decision_note text,
  requested_by uuid,
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.consent_broker_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id uuid NOT NULL REFERENCES public.partner_apps(id) ON DELETE CASCADE,
  consumer_id uuid REFERENCES public.api_consumers(id) ON DELETE SET NULL,
  subject_user_id uuid NOT NULL,
  purpose_code text NOT NULL REFERENCES public.data_purposes(code),
  environment public.partner_env NOT NULL DEFAULT 'sandbox',
  requested_scopes text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending',
  reason text NOT NULL DEFAULT '',
  grant_id uuid REFERENCES public.consent_grants(id) ON DELETE SET NULL,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.partner_workflow_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id uuid NOT NULL REFERENCES public.partner_apps(id) ON DELETE CASCADE,
  registration_id uuid NOT NULL REFERENCES public.partner_registrations(id) ON DELETE CASCADE,
  kind public.partner_case_kind NOT NULL,
  environment public.partner_env NOT NULL DEFAULT 'sandbox',
  subject_user_id uuid,
  purpose_code text REFERENCES public.data_purposes(code),
  status public.partner_case_status NOT NULL DEFAULT 'open',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  signals jsonb NOT NULL DEFAULT '{}'::jsonb,
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  requires_human_decision boolean NOT NULL DEFAULT true,
  decided_by uuid,
  decided_at timestamptz,
  decision_note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.partner_webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id uuid NOT NULL REFERENCES public.partner_apps(id) ON DELETE CASCADE,
  environment public.partner_env NOT NULL DEFAULT 'sandbox',
  target_url text NOT NULL,
  event_types text[] NOT NULL DEFAULT '{}',
  secret_prefix text NOT NULL DEFAULT '',
  secret_hash text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.partner_api_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id uuid NOT NULL REFERENCES public.partner_apps(id) ON DELETE CASCADE,
  registration_id uuid NOT NULL REFERENCES public.partner_registrations(id) ON DELETE CASCADE,
  environment public.partner_env NOT NULL,
  endpoint text NOT NULL,
  purpose_code text,
  subject_user_id uuid,
  outcome text NOT NULL,
  deny_reason text,
  status_code integer NOT NULL DEFAULT 200,
  latency_ms integer NOT NULL DEFAULT 0,
  is_first_party boolean NOT NULL DEFAULT false,
  tier public.consumer_tier NOT NULL DEFAULT 'sandbox',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS partner_api_calls_app_idx ON public.partner_api_calls(app_id, created_at DESC);
CREATE INDEX IF NOT EXISTS partner_apps_reg_idx ON public.partner_apps(registration_id);
CREATE INDEX IF NOT EXISTS consent_broker_subject_idx ON public.consent_broker_requests(subject_user_id, status);

DROP TRIGGER IF EXISTS touch_partner_registrations ON public.partner_registrations;
CREATE TRIGGER touch_partner_registrations BEFORE UPDATE ON public.partner_registrations
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS touch_partner_apps ON public.partner_apps;
CREATE TRIGGER touch_partner_apps BEFORE UPDATE ON public.partner_apps
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS touch_partner_prod_requests ON public.partner_production_requests;
CREATE TRIGGER touch_partner_prod_requests BEFORE UPDATE ON public.partner_production_requests
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS touch_partner_cases ON public.partner_workflow_cases;
CREATE TRIGGER touch_partner_cases BEFORE UPDATE ON public.partner_workflow_cases
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS touch_partner_webhooks ON public.partner_webhooks;
CREATE TRIGGER touch_partner_webhooks BEFORE UPDATE ON public.partner_webhooks
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

GRANT SELECT, INSERT, UPDATE ON public.partner_registrations TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.partner_apps TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.partner_credentials TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.partner_production_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.consent_broker_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.partner_workflow_cases TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.partner_webhooks TO authenticated;
GRANT SELECT, INSERT ON public.partner_api_calls TO authenticated;
GRANT ALL ON public.partner_registrations, public.partner_apps, public.partner_credentials,
  public.partner_production_requests, public.consent_broker_requests,
  public.partner_workflow_cases, public.partner_webhooks, public.partner_api_calls TO service_role;

ALTER TABLE public.partner_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_apps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_production_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consent_broker_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_workflow_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_api_calls ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_partner_staff(_user_id uuid, _registration_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.partner_registrations pr
    WHERE pr.id = _registration_id
      AND (
        pr.created_by = _user_id
        OR (pr.tenant_id IS NOT NULL AND public.is_tenant_member(_user_id, pr.tenant_id))
        OR (pr.sandbox_tenant_id IS NOT NULL AND public.is_tenant_member(_user_id, pr.sandbox_tenant_id))
      )
  );
$$;
REVOKE ALL ON FUNCTION public.is_partner_staff(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_partner_staff(uuid, uuid) TO authenticated, service_role;

CREATE POLICY "partner_reg_read" ON public.partner_registrations FOR SELECT TO authenticated
  USING (public.is_partner_staff(auth.uid(), id) OR public.has_role(auth.uid(),'platform_admin') OR public.has_role(auth.uid(),'auditor'));
CREATE POLICY "partner_reg_insert" ON public.partner_registrations FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());
CREATE POLICY "partner_reg_update" ON public.partner_registrations FOR UPDATE TO authenticated
  USING (public.is_partner_staff(auth.uid(), id) OR public.has_role(auth.uid(),'platform_admin'))
  WITH CHECK (public.is_partner_staff(auth.uid(), id) OR public.has_role(auth.uid(),'platform_admin'));

CREATE POLICY "partner_apps_read" ON public.partner_apps FOR SELECT TO authenticated
  USING (public.is_partner_staff(auth.uid(), registration_id) OR public.has_role(auth.uid(),'platform_admin') OR public.has_role(auth.uid(),'auditor'));
CREATE POLICY "partner_apps_write" ON public.partner_apps FOR INSERT TO authenticated
  WITH CHECK (public.is_partner_staff(auth.uid(), registration_id));
CREATE POLICY "partner_apps_update" ON public.partner_apps FOR UPDATE TO authenticated
  USING (public.is_partner_staff(auth.uid(), registration_id) OR public.has_role(auth.uid(),'platform_admin'))
  WITH CHECK (public.is_partner_staff(auth.uid(), registration_id) OR public.has_role(auth.uid(),'platform_admin'));

CREATE POLICY "partner_cred_read" ON public.partner_credentials FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.partner_apps a WHERE a.id = app_id
    AND (public.is_partner_staff(auth.uid(), a.registration_id) OR public.has_role(auth.uid(),'platform_admin') OR public.has_role(auth.uid(),'auditor'))));

CREATE POLICY "partner_prod_read" ON public.partner_production_requests FOR SELECT TO authenticated
  USING (public.is_partner_staff(auth.uid(), registration_id) OR public.has_role(auth.uid(),'platform_admin') OR public.has_role(auth.uid(),'auditor'));

CREATE POLICY "broker_subject_read" ON public.consent_broker_requests FOR SELECT TO authenticated
  USING (subject_user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.partner_apps a WHERE a.id = app_id AND public.is_partner_staff(auth.uid(), a.registration_id))
    OR public.has_role(auth.uid(),'platform_admin') OR public.has_role(auth.uid(),'auditor'));

CREATE POLICY "partner_cases_read" ON public.partner_workflow_cases FOR SELECT TO authenticated
  USING (public.is_partner_staff(auth.uid(), registration_id)
    OR subject_user_id = auth.uid()
    OR public.has_role(auth.uid(),'platform_admin') OR public.has_role(auth.uid(),'auditor'));

CREATE POLICY "partner_webhooks_read" ON public.partner_webhooks FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.partner_apps a WHERE a.id = app_id
    AND (public.is_partner_staff(auth.uid(), a.registration_id) OR public.has_role(auth.uid(),'platform_admin') OR public.has_role(auth.uid(),'auditor'))));

CREATE POLICY "partner_calls_read" ON public.partner_api_calls FOR SELECT TO authenticated
  USING (public.is_partner_staff(auth.uid(), registration_id) OR public.has_role(auth.uid(),'platform_admin') OR public.has_role(auth.uid(),'auditor'));

INSERT INTO public.feature_flags (key, label, description, enabled, environments)
VALUES
  ('partner.developer_portal','Partner developer portal','Partner org onboarding, app registration, sandbox credentials.', true, '["development","sandbox"]'::jsonb),
  ('partner.consent_broker','Consent broker','Partner-initiated consent request/check/revoke flow.', true, '["development","sandbox"]'::jsonb),
  ('partner.production_access','Partner production access','Production credentials only after legal + security approval.', true, '["development","sandbox"]'::jsonb),
  ('partner.webhooks','Partner webhooks','Webhook configuration for approved partners (P1).', false, '["development"]'::jsonb),
  ('partner.bank_loan_workflow','Bank credit signal & loan shell','Credit-signal API shell and human-decided loan workflow.', true, '["development","sandbox"]'::jsonb),
  ('partner.insurer_claims_workflow','Insurer evidence & claims shell','Evidence capture and human-decided claim workflow.', true, '["development","sandbox"]'::jsonb)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.data_purposes (code, label, description, requires_explicit_consent)
VALUES ('advisory','Advisory','Agronomic advisory using shared farm attributes.', true)
ON CONFLICT (code) DO NOTHING;