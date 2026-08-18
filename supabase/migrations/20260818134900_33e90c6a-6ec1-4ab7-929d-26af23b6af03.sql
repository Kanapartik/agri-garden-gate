-- 1. Scope onboarding step progress reads to the applicant, their assigned
--    tenant reviewers and platform oversight roles (mirrors onboarding_applications).
DROP POLICY IF EXISTS step_progress_select_scoped ON public.onboarding_step_progress;

CREATE POLICY step_progress_select_scoped
ON public.onboarding_step_progress
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.onboarding_applications a
    WHERE a.id = onboarding_step_progress.application_id
      AND (
        a.applicant_user_id = auth.uid()
        OR (
          a.tenant_id IS NOT NULL
          AND (
            public.has_tenant_role(auth.uid(), a.tenant_id, 'onboarding_officer'::app_role)
            OR public.has_tenant_role(auth.uid(), a.tenant_id, 'tenant_admin'::app_role)
          )
        )
        OR public.has_role(auth.uid(), 'platform_admin'::app_role)
        OR public.has_role(auth.uid(), 'auditor'::app_role)
      )
  )
);

-- 2. Move SECURITY DEFINER authorization helpers out of the API-exposed schema.
--    Policies depend on the function OIDs, so they keep working after the move.
CREATE SCHEMA IF NOT EXISTS app_private;
REVOKE ALL ON SCHEMA app_private FROM PUBLIC;
GRANT USAGE ON SCHEMA app_private TO authenticated, service_role;

ALTER FUNCTION public.has_role(uuid, app_role) SET SCHEMA app_private;
ALTER FUNCTION public.has_tenant_role(uuid, uuid, app_role) SET SCHEMA app_private;
ALTER FUNCTION public.is_tenant_member(uuid, uuid) SET SCHEMA app_private;
ALTER FUNCTION public.is_partner_staff(uuid, uuid) SET SCHEMA app_private;

REVOKE ALL ON FUNCTION app_private.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION app_private.has_tenant_role(uuid, uuid, app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION app_private.is_tenant_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION app_private.is_partner_staff(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION app_private.has_role(uuid, app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION app_private.has_tenant_role(uuid, uuid, app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION app_private.is_tenant_member(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION app_private.is_partner_staff(uuid, uuid) TO authenticated, service_role;

-- 3. Thin SECURITY INVOKER wrappers keep the app's role checks working, but a
--    caller may now only ask about their own roles — never another user's.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, app_private
AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL OR _user_id IS DISTINCT FROM auth.uid() THEN false
    ELSE app_private.has_role(auth.uid(), _role)
  END
$$;

CREATE OR REPLACE FUNCTION public.has_tenant_role(_user_id uuid, _tenant_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, app_private
AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL OR _user_id IS DISTINCT FROM auth.uid() THEN false
    ELSE app_private.has_tenant_role(auth.uid(), _tenant_id, _role)
  END
$$;

CREATE OR REPLACE FUNCTION public.is_tenant_member(_user_id uuid, _tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, app_private
AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL OR _user_id IS DISTINCT FROM auth.uid() THEN false
    ELSE app_private.is_tenant_member(auth.uid(), _tenant_id)
  END
$$;

CREATE OR REPLACE FUNCTION public.is_partner_staff(_user_id uuid, _registration_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, app_private
AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL OR _user_id IS DISTINCT FROM auth.uid() THEN false
    ELSE app_private.is_partner_staff(auth.uid(), _registration_id)
  END
$$;

REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_tenant_role(uuid, uuid, app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_tenant_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_partner_staff(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_tenant_role(uuid, uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_tenant_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_partner_staff(uuid, uuid) TO authenticated;