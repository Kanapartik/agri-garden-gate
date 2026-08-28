CREATE TYPE public.insurer_claim_stage AS ENUM (
  'reported','documents_pending','survey_assigned','assessment_review','approved','rejected','payout_initiated','settled','withdrawn'
);
CREATE TYPE public.insurer_claim_doc_status AS ENUM ('pending','received','verified','rejected');

CREATE TABLE public.insurer_claims (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  insurer_tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  claim_reference TEXT NOT NULL,
  registration_number TEXT NOT NULL,
  fpo_name TEXT NOT NULL,
  state_name TEXT,
  district TEXT,
  crop TEXT,
  season TEXT NOT NULL DEFAULT 'Kharif 2026',
  peril public.insurer_risk_event NOT NULL,
  stage public.insurer_claim_stage NOT NULL DEFAULT 'reported',
  risk_cell_id UUID REFERENCES public.insurer_risk_cells(id) ON DELETE SET NULL,
  affected_members INTEGER NOT NULL DEFAULT 0,
  reported_acres NUMERIC,
  assessed_loss_pct NUMERIC,
  claimed_amount_inr NUMERIC NOT NULL DEFAULT 0,
  approved_amount_inr NUMERIC,
  surveyor_name TEXT,
  internal_notes TEXT,
  decision_note TEXT,
  decided_by UUID REFERENCES auth.users(id),
  decided_at TIMESTAMPTZ,
  reported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  response_due_at TIMESTAMPTZ,
  synthetic BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (insurer_tenant_id, claim_reference)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.insurer_claims TO authenticated;
GRANT ALL ON public.insurer_claims TO service_role;
ALTER TABLE public.insurer_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Insurer members read own claims" ON public.insurer_claims FOR SELECT TO authenticated
  USING (insurer_tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid())
         OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('platform_admin','auditor'))
         OR registration_number IN (
             SELECT p.registration_number FROM public.fpo_profiles p
             WHERE p.tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid())));
CREATE POLICY "Insurer members manage own claims" ON public.insurer_claims FOR ALL TO authenticated
  USING (insurer_tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid())
         OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'platform_admin'))
  WITH CHECK (insurer_tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid())
         OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'platform_admin'));

CREATE TABLE public.insurer_claim_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  claim_id UUID NOT NULL REFERENCES public.insurer_claims(id) ON DELETE CASCADE,
  insurer_tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  from_stage public.insurer_claim_stage,
  to_stage public.insurer_claim_stage NOT NULL,
  note TEXT,
  actor_user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.insurer_claim_events TO authenticated;
GRANT ALL ON public.insurer_claim_events TO service_role;
ALTER TABLE public.insurer_claim_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read claim events for readable claims" ON public.insurer_claim_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.insurer_claims c WHERE c.id = claim_id));
CREATE POLICY "Insurer members append claim events" ON public.insurer_claim_events FOR INSERT TO authenticated
  WITH CHECK (insurer_tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid())
         OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'platform_admin'));

CREATE TABLE public.insurer_claim_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  claim_id UUID NOT NULL REFERENCES public.insurer_claims(id) ON DELETE CASCADE,
  insurer_tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL,
  label TEXT NOT NULL,
  required BOOLEAN NOT NULL DEFAULT true,
  status public.insurer_claim_doc_status NOT NULL DEFAULT 'pending',
  received_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (claim_id, doc_type)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.insurer_claim_documents TO authenticated;
GRANT ALL ON public.insurer_claim_documents TO service_role;
ALTER TABLE public.insurer_claim_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read claim documents for readable claims" ON public.insurer_claim_documents FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.insurer_claims c WHERE c.id = claim_id));
CREATE POLICY "Insurer members manage claim documents" ON public.insurer_claim_documents FOR ALL TO authenticated
  USING (insurer_tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid())
         OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'platform_admin'))
  WITH CHECK (insurer_tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid())
         OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'platform_admin'));

CREATE INDEX idx_insurer_claims_tenant_stage ON public.insurer_claims (insurer_tenant_id, stage);
CREATE INDEX idx_insurer_claims_reg ON public.insurer_claims (registration_number);
CREATE INDEX idx_insurer_claim_events_claim ON public.insurer_claim_events (claim_id);
CREATE INDEX idx_insurer_claim_documents_claim ON public.insurer_claim_documents (claim_id);

CREATE TRIGGER update_insurer_claims_updated_at BEFORE UPDATE ON public.insurer_claims FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER update_insurer_claim_documents_updated_at BEFORE UPDATE ON public.insurer_claim_documents FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Synthetic claims: two per insurer tenant channel sample, deterministic and aggregate-only
INSERT INTO public.insurer_claims (
  insurer_tenant_id, claim_reference, registration_number, fpo_name, state_name, district, crop, season,
  peril, stage, affected_members, reported_acres, assessed_loss_pct, claimed_amount_inr, approved_amount_inr,
  reported_at, response_due_at
)
SELECT c.insurer_tenant_id,
  'CLM-2026-' || lpad((row_number() OVER (PARTITION BY c.insurer_tenant_id ORDER BY c.registration_number))::text, 5, '0'),
  c.registration_number, c.fpo_name, c.state_name, c.district,
  COALESCE(c.primary_commodity, 'Paddy'), 'Kharif 2026',
  (ARRAY['drought','excess_rain','flood','hail','pest_outbreak']::public.insurer_risk_event[])[1 + (abs(hashtext(c.registration_number || 'peril')) % 5)],
  (ARRAY['reported','documents_pending','survey_assigned','assessment_review','approved','payout_initiated','settled']::public.insurer_claim_stage[])[1 + (abs(hashtext(c.registration_number || 'stage')) % 7)],
  10 + (abs(hashtext(c.registration_number || 'mem')) % 240),
  20 + (abs(hashtext(c.registration_number || 'acr')) % 600),
  10 + (abs(hashtext(c.registration_number || 'loss')) % 70),
  50000 + (abs(hashtext(c.registration_number || 'amt')) % 1450000),
  NULL,
  now() - ((abs(hashtext(c.registration_number || 'rep')) % 40) || ' days')::interval,
  now() + ((abs(hashtext(c.registration_number || 'due')) % 25) || ' days')::interval
FROM (
  SELECT ch.*, row_number() OVER (PARTITION BY ch.insurer_tenant_id ORDER BY ch.opportunity_score DESC NULLS LAST, ch.registration_number) AS rn
  FROM public.insurer_fpo_channel ch
) c
WHERE c.rn <= 24;

UPDATE public.insurer_claims
SET approved_amount_inr = round(claimed_amount_inr * 0.75)
WHERE stage IN ('approved','payout_initiated','settled');

INSERT INTO public.insurer_claim_events (claim_id, insurer_tenant_id, from_stage, to_stage, note)
SELECT id, insurer_tenant_id, NULL, 'reported', 'Synthetic seed: claim intimated by FPO office bearer.'
FROM public.insurer_claims;

INSERT INTO public.insurer_claim_documents (claim_id, insurer_tenant_id, doc_type, label, required, status)
SELECT c.id, c.insurer_tenant_id, d.doc_type, d.label, d.required,
  CASE WHEN c.stage IN ('reported','documents_pending') AND d.required THEN 'pending'::public.insurer_claim_doc_status
       ELSE 'verified'::public.insurer_claim_doc_status END
FROM public.insurer_claims c
CROSS JOIN (VALUES
  ('intimation_form','Loss intimation form', true),
  ('sowing_certificate','Sowing certificate', true),
  ('survey_report','Field survey report', true),
  ('fpo_resolution','FPO board resolution', false)
) AS d(doc_type, label, required);