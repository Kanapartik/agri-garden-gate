-- B2 hardening: no anonymous privileges on farmer-scoped tables; defense in depth
-- alongside RLS. Also drop destructive privileges no app path needs.
REVOKE ALL ON public.farm_records FROM anon;
REVOKE ALL ON public.baseline_consents FROM anon;
REVOKE ALL ON public.identity_verification_checks FROM anon;
REVOKE ALL ON public.onboarding_funnel_events FROM anon;

REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.farm_records FROM authenticated;
REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.baseline_consents FROM authenticated;
REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.identity_verification_checks FROM authenticated;
REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER, UPDATE ON public.onboarding_funnel_events FROM authenticated;

GRANT SELECT, INSERT, UPDATE ON public.farm_records TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.baseline_consents TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.identity_verification_checks TO authenticated;
GRANT SELECT, INSERT ON public.onboarding_funnel_events TO authenticated;

GRANT ALL ON public.farm_records TO service_role;
GRANT ALL ON public.baseline_consents TO service_role;
GRANT ALL ON public.identity_verification_checks TO service_role;
GRANT ALL ON public.onboarding_funnel_events TO service_role;