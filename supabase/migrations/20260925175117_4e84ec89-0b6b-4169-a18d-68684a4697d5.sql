CREATE TABLE public.fpo_performance_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  fpo_name text NOT NULL,
  district text NOT NULL,
  state text NOT NULL DEFAULT 'Andhra Pradesh',
  period text NOT NULL,
  members integer NOT NULL DEFAULT 0,
  financial_discipline numeric(5,1) NOT NULL,
  scheme_coverage numeric(5,1) NOT NULL,
  best_practices numeric(5,1) NOT NULL,
  loan_repayment numeric(5,1) NOT NULL,
  governance numeric(5,1) NOT NULL,
  member_engagement numeric(5,1) NOT NULL,
  is_synthetic boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (fpo_name, period)
);
GRANT SELECT ON public.fpo_performance_scores TO authenticated;
GRANT ALL ON public.fpo_performance_scores TO service_role;
ALTER TABLE public.fpo_performance_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own FPO or oversight can read scores" ON public.fpo_performance_scores
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'platform_admin') OR public.has_role(auth.uid(), 'auditor')
    OR (tenant_id IS NOT NULL AND public.is_tenant_member(auth.uid(), tenant_id))
  );
CREATE TRIGGER touch_fpo_performance_scores BEFORE UPDATE ON public.fpo_performance_scores
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.fpo_performance_scores (tenant_id, fpo_name, district, state, period, members, financial_discipline, scheme_coverage, best_practices, loan_repayment, governance, member_engagement, is_synthetic)
SELECT f.tid, f.name, f.district, f.state, p.period, f.members + p.i*6,
  least(100, f.fin + p.i*f.tr), least(100, f.sch + p.i*f.tr), least(100, f.bp + p.i*f.tr),
  least(100, f.loan + p.i*f.tr), least(100, f.gov + p.i*f.tr*0.5), least(100, f.eng + p.i*f.tr), true
FROM (VALUES
  ('aaaa1111-0000-4000-8000-000000000001'::uuid,'Guntur Chilli Growers FPO','Guntur','Andhra Pradesh',412,68.0,54.0,61.0,72.0,70.0,63.0,3.0),
  (NULL::uuid,'Krishna Delta Paddy FPO','Krishna','Andhra Pradesh',655,82.0,78.0,74.0,88.0,85.0,76.0,1.5),
  (NULL,'Prakasam Pulses Producers','Prakasam','Andhra Pradesh',298,59.0,41.0,52.0,61.0,58.0,49.0,2.5),
  (NULL,'Palnadu Cotton FPO','Palnadu','Andhra Pradesh',380,71.0,66.0,58.0,69.0,74.0,60.0,1.0),
  (NULL,'Bapatla Coastal Farmers FPO','Bapatla','Andhra Pradesh',240,48.0,37.0,45.0,52.0,50.0,44.0,4.0),
  (NULL,'Khammam Chilli Collective','Khammam','Telangana',510,77.0,70.0,80.0,81.0,79.0,83.0,1.2),
  (NULL,'Nalgonda Millets FPO','Nalgonda','Telangana',325,63.0,72.0,67.0,58.0,62.0,70.0,2.0),
  (NULL,'Warangal Turmeric Growers','Hanumakonda','Telangana',270,55.0,49.0,63.0,47.0,57.0,55.0,3.5)
) f(tid,name,district,state,members,fin,sch,bp,loan,gov,eng,tr)
CROSS JOIN (VALUES (0,'2025-Q4'),(1,'2026-Q1'),(2,'2026-Q2'),(3,'2026-Q3')) p(i,period);