CREATE OR REPLACE FUNCTION app_private.can_read_farm(_farm_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.farm_records f
    WHERE f.id = _farm_id
      AND (
        f.farmer_user_id = auth.uid()
        OR f.captured_by_user_id = auth.uid()
        OR public.has_role(auth.uid(), 'platform_admin')
        OR public.has_role(auth.uid(), 'auditor')
      )
  )
$$;
REVOKE ALL ON FUNCTION app_private.can_read_farm(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.can_read_farm(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.can_read_farm(_farm_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT app_private.can_read_farm(_farm_id)
$$;
REVOKE ALL ON FUNCTION public.can_read_farm(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_read_farm(uuid) TO authenticated, service_role;