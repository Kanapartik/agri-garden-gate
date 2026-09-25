ALTER FUNCTION public.fpo_has_member_consent(uuid, text) SET SCHEMA app_private;
ALTER FUNCTION public.fpo_monitoring_role(uuid, uuid, boolean) SET SCHEMA app_private;
REVOKE ALL ON FUNCTION app_private.fpo_has_member_consent(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION app_private.fpo_monitoring_role(uuid, uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION app_private.fpo_has_member_consent(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION app_private.fpo_monitoring_role(uuid, uuid, boolean) TO authenticated;