CREATE TYPE public.insurer_policy_status AS ENUM ('draft','pending_enrolment','issued','active','expired','cancelled');
CREATE TYPE public.insurer_enrolment_state AS ENUM ('draft','submitted','under_verification','verified','rejected','withdrawn','policy_linked');
CREATE TYPE public.insurer_remittance_state AS ENUM ('expected','received','reconciled','short','excess','refunded');

-- ============================ policies ============================
CREATE TABLE public.insurer_policies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  insurer_tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  policy_reference TEXT NOT NULL,
  registration_number TEXT NOT NULL,
  fpo_name TEXT NOT NULL,
  state_name TEXT,
  district TEXT,
  scheme_code TEXT NOT NULL DEFAULT 'PMFBY',
  scheme_name TEXT NOT NULL DEFAULT 'Pradhan Mantri Fasal Bima Yojana',
  crop TEXT,
  season TEXT NOT NULL DEFAULT 'Kharif 2026',
  status public.insurer_policy_status NOT NULL DEFAULT 'draft',
  coverage_start DATE,
  coverage_end DATE,
  enrolment_cutoff DATE,
  sum_insured_per_acre_inr NUMERIC NOT NULL DEFAULT 0,
  actuarial_rate_pct NUMERIC NOT NULL DEFAULT 0,
  farmer_share_pct NUMERIC NOT NULL DEFAULT 2,
  centre_share_pct NUMERIC NOT NULL DEFAULT 49,
  state_share_pct NUMERIC NOT NULL DEFAULT 49,
  insured_acres NUMERIC NOT NULL DEFAULT 0,
  insured_members INTEGER NOT NULL DEFAULT 0,
  gross_premium_inr NUMERIC NOT NULL DEFAULT 0,
  internal_notes TEXT,
  decision_note TEXT,
  decided_by UUID REFERENCES auth.users(id),
  decided_at TIMESTAMPTZ,
  synthetic BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (insurer_tenant_id, policy_reference)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.insurer_policies TO authenticated;
GRANT ALL ON public.insurer_policies TO service_role;
ALTER TABLE public.insurer_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read insurer policies in scope" ON public.insurer_policies FOR SELECT TO authenticated
  USING (insurer_tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('platform_admin','auditor'))
    OR registration_number IN (
      SELECT p.registration_number FROM public.fpo_profiles p
      WHERE p.tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid())));
CREATE POLICY "Insurer members manage own policies" ON public.insurer_policies FOR ALL TO authenticated
  USING (insurer_tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'platform_admin'))
  WITH CHECK (insurer_tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'platform_admin'));
CREATE TRIGGER touch_insurer_policies BEFORE UPDATE ON public.insurer_policies
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX idx_insurer_policies_tenant ON public.insurer_policies (insurer_tenant_id, season);
CREATE INDEX idx_insurer_policies_reg ON public.insurer_policies (registration_number);

-- ======================= enrolment batches =======================
CREATE TABLE public.insurer_enrolment_batches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  insurer_tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  policy_id UUID REFERENCES public.insurer_policies(id) ON DELETE SET NULL,
  batch_reference TEXT NOT NULL,
  registration_number TEXT NOT NULL,
  fpo_name TEXT NOT NULL,
  state_name TEXT,
  district TEXT,
  crop TEXT,
  season TEXT NOT NULL DEFAULT 'Kharif 2026',
  state public.insurer_enrolment_state NOT NULL DEFAULT 'draft',
  member_count INTEGER NOT NULL DEFAULT 0,
  acres NUMERIC NOT NULL DEFAULT 0,
  premium_due_inr NUMERIC NOT NULL DEFAULT 0,
  farmer_premium_inr NUMERIC NOT NULL DEFAULT 0,
  subsidy_premium_inr NUMERIC NOT NULL DEFAULT 0,
  submitted_at TIMESTAMPTZ,
  verified_at TIMESTAMPTZ,
  verification_note TEXT,
  internal_notes TEXT,
  decision_note TEXT,
  decided_by UUID REFERENCES auth.users(id),
  synthetic BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (insurer_tenant_id, batch_reference)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.insurer_enrolment_batches TO authenticated;
GRANT ALL ON public.insurer_enrolment_batches TO service_role;
ALTER TABLE public.insurer_enrolment_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read enrolment batches in scope" ON public.insurer_enrolment_batches FOR SELECT TO authenticated
  USING (insurer_tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('platform_admin','auditor'))
    OR registration_number IN (
      SELECT p.registration_number FROM public.fpo_profiles p
      WHERE p.tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid())));
CREATE POLICY "Insurer members manage own batches" ON public.insurer_enrolment_batches FOR ALL TO authenticated
  USING (insurer_tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'platform_admin'))
  WITH CHECK (insurer_tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'platform_admin'));
CREATE POLICY "FPO admins submit own batches" ON public.insurer_enrolment_batches FOR INSERT TO authenticated
  WITH CHECK (registration_number IN (
      SELECT p.registration_number FROM public.fpo_profiles p
      WHERE p.tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()))
    AND public.has_role(auth.uid(), 'tenant_admin'));
CREATE TRIGGER touch_insurer_enrolment_batches BEFORE UPDATE ON public.insurer_enrolment_batches
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX idx_insurer_batches_tenant ON public.insurer_enrolment_batches (insurer_tenant_id, season);
CREATE INDEX idx_insurer_batches_reg ON public.insurer_enrolment_batches (registration_number);

-- ========================= remittances =========================
CREATE TABLE public.insurer_premium_remittances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  insurer_tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  batch_id UUID NOT NULL REFERENCES public.insurer_enrolment_batches(id) ON DELETE CASCADE,
  remittance_reference TEXT NOT NULL,
  amount_inr NUMERIC NOT NULL DEFAULT 0,
  method TEXT NOT NULL DEFAULT 'neft',
  state public.insurer_remittance_state NOT NULL DEFAULT 'expected',
  received_at TIMESTAMPTZ,
  reconciled_at TIMESTAMPTZ,
  reconciliation_note TEXT,
  adapter_source TEXT NOT NULL DEFAULT 'synthetic_payment_adapter',
  synthetic BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (insurer_tenant_id, remittance_reference)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.insurer_premium_remittances TO authenticated;
GRANT ALL ON public.insurer_premium_remittances TO service_role;
ALTER TABLE public.insurer_premium_remittances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read remittances for readable batches" ON public.insurer_premium_remittances FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.insurer_enrolment_batches b WHERE b.id = batch_id));
CREATE POLICY "Insurer members manage own remittances" ON public.insurer_premium_remittances FOR ALL TO authenticated
  USING (insurer_tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'platform_admin'))
  WITH CHECK (insurer_tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'platform_admin'));
CREATE TRIGGER touch_insurer_remittances BEFORE UPDATE ON public.insurer_premium_remittances
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX idx_insurer_remittances_batch ON public.insurer_premium_remittances (batch_id);

-- ====================== synthetic seed data ======================
INSERT INTO public.insurer_policies (
  insurer_tenant_id, policy_reference, registration_number, fpo_name, state_name, district,
  crop, season, status, coverage_start, coverage_end, enrolment_cutoff,
  sum_insured_per_acre_inr, actuarial_rate_pct, insured_acres, insured_members, gross_premium_inr
)
SELECT c.insurer_tenant_id,
       'POL-' || upper(substr(md5(c.insurer_tenant_id::text || c.registration_number), 1, 8)),
       c.registration_number, c.fpo_name, c.state_name, c.district,
       (ARRAY['Paddy','Cotton','Chilli','Maize','Groundnut'])[1 + (abs(hashtext(c.registration_number)) % 5)],
       'Kharif 2026',
       (ARRAY['pending_enrolment','issued','active']::public.insurer_policy_status[])[1 + (abs(hashtext(c.registration_number || 'p')) % 3)],
       DATE '2026-06-15', DATE '2026-11-30', DATE '2026-07-31',
       35000 + (abs(hashtext(c.registration_number)) % 6) * 2500,
       8 + (abs(hashtext(c.registration_number || 'r')) % 5),
       200 + (abs(hashtext(c.registration_number || 'a')) % 800),
       40 + (abs(hashtext(c.registration_number || 'm')) % 260),
       0
FROM (
  SELECT insurer_tenant_id, registration_number, fpo_name, state_name, district,
         row_number() OVER (PARTITION BY insurer_tenant_id ORDER BY fpo_name) AS rn
  FROM public.insurer_fpo_channel
) c
WHERE c.rn <= 18
ON CONFLICT DO NOTHING;

UPDATE public.insurer_policies
SET gross_premium_inr = round(insured_acres * sum_insured_per_acre_inr * actuarial_rate_pct / 100)
WHERE gross_premium_inr = 0;

INSERT INTO public.insurer_enrolment_batches (
  insurer_tenant_id, policy_id, batch_reference, registration_number, fpo_name, state_name, district,
  crop, season, state, member_count, acres, premium_due_inr, farmer_premium_inr, subsidy_premium_inr,
  submitted_at, verified_at
)
SELECT p.insurer_tenant_id, p.id,
       'ENR-' || upper(substr(md5(p.id::text), 1, 8)),
       p.registration_number, p.fpo_name, p.state_name, p.district, p.crop, p.season,
       (ARRAY['submitted','under_verification','verified','policy_linked']::public.insurer_enrolment_state[])[1 + (abs(hashtext(p.id::text)) % 4)],
       p.insured_members, p.insured_acres,
       p.gross_premium_inr,
       round(p.gross_premium_inr * p.farmer_share_pct / 100),
       round(p.gross_premium_inr * (p.centre_share_pct + p.state_share_pct) / 100),
       now() - ((abs(hashtext(p.id::text)) % 30) || ' days')::interval,
       CASE WHEN abs(hashtext(p.id::text)) % 4 >= 2 THEN now() - ((abs(hashtext(p.id::text)) % 10) || ' days')::interval END
FROM public.insurer_policies p
ON CONFLICT DO NOTHING;

INSERT INTO public.insurer_premium_remittances (
  insurer_tenant_id, batch_id, remittance_reference, amount_inr, method, state, received_at
)
SELECT b.insurer_tenant_id, b.id,
       'RMT-' || upper(substr(md5(b.id::text || 'r'), 1, 8)),
       round(b.farmer_premium_inr * (CASE abs(hashtext(b.id::text)) % 3 WHEN 0 THEN 1.0 WHEN 1 THEN 0.85 ELSE 1.05 END)),
       'neft',
       (ARRAY['received','reconciled','short','excess']::public.insurer_remittance_state[])[1 + (abs(hashtext(b.id::text || 's')) % 4)],
       now() - ((abs(hashtext(b.id::text)) % 15) || ' days')::interval
FROM public.insurer_enrolment_batches b
WHERE b.state IN ('verified','policy_linked')
ON CONFLICT DO NOTHING;