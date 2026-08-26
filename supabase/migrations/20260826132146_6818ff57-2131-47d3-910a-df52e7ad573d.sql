CREATE POLICY "Farmers can see FPOs holding their consent"
ON public.tenants
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.fpo_farmer_consents c
    WHERE c.tenant_id = tenants.id
      AND c.farmer_user_id = auth.uid()
      AND c.revoked_at IS NULL
  )
);