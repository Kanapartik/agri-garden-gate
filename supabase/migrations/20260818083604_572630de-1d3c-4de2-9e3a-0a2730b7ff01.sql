-- Lock down direct execution of security-definer helpers.
REVOKE ALL ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_tenant_role(UUID, UUID, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_tenant_member(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_tenant_role(UUID, UUID, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_tenant_member(UUID, UUID) TO authenticated, service_role;

-- Consent evaluation is a server-side decision only.
REVOKE ALL ON FUNCTION public.has_consent(UUID, TEXT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_consent(UUID, TEXT, UUID) TO service_role;

-- Trigger-only helpers must not be app-callable.
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.audit_events_immutable() FROM PUBLIC, anon, authenticated;
