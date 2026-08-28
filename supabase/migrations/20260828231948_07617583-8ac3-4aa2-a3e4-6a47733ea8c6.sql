
CREATE TYPE public.insurer_risk_event AS ENUM ('drought','excess_rain','flood','hail','pest_outbreak','heatwave','cyclone');
CREATE TYPE public.insurer_risk_severity AS ENUM ('watch','advisory','severe');
CREATE TYPE public.insurer_alert_status AS ENUM ('open','acknowledged','dismissed');

CREATE TABLE public.insurer_watchlist (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  insurer_tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  state_name TEXT NOT NULL,
  district TEXT NOT NULL,
  crop TEXT NOT NULL,
  season TEXT NOT NULL,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (insurer_tenant_id, district, crop, season)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.insurer_watchlist TO authenticated;
GRANT ALL ON public.insurer_watchlist TO service_role;
ALTER TABLE public.insurer_watchlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Insurer members read own watchlist" ON public.insurer_watchlist FOR SELECT TO authenticated
  USING (insurer_tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid())
         OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'platform_admin'));
CREATE POLICY "Insurer members manage own watchlist" ON public.insurer_watchlist FOR ALL TO authenticated
  USING (insurer_tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid())
         OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'platform_admin'))
  WITH CHECK (insurer_tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid())
         OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'platform_admin'));

CREATE TABLE public.insurer_risk_cells (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  state_name TEXT NOT NULL,
  district TEXT NOT NULL,
  crop TEXT NOT NULL,
  season TEXT NOT NULL,
  event_type public.insurer_risk_event NOT NULL,
  severity public.insurer_risk_severity NOT NULL,
  rainfall_deviation_pct NUMERIC,
  affected_acres NUMERIC,
  affected_fpos INTEGER NOT NULL DEFAULT 0,
  observed_at DATE NOT NULL,
  source TEXT NOT NULL DEFAULT 'synthetic_weather_feed',
  synthetic BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.insurer_risk_cells TO authenticated;
GRANT ALL ON public.insurer_risk_cells TO service_role;
ALTER TABLE public.insurer_risk_cells ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users read risk cells" ON public.insurer_risk_cells FOR SELECT TO authenticated USING (true);
CREATE POLICY "Platform admins manage risk cells" ON public.insurer_risk_cells FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'platform_admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'platform_admin'));

CREATE TABLE public.insurer_alert_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  insurer_tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  event_type public.insurer_risk_event,
  min_severity public.insurer_risk_severity NOT NULL DEFAULT 'advisory',
  rainfall_deviation_threshold_pct NUMERIC,
  active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.insurer_alert_rules TO authenticated;
GRANT ALL ON public.insurer_alert_rules TO service_role;
ALTER TABLE public.insurer_alert_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Insurer members read own rules" ON public.insurer_alert_rules FOR SELECT TO authenticated
  USING (insurer_tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid())
         OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'platform_admin'));
CREATE POLICY "Insurer members manage own rules" ON public.insurer_alert_rules FOR ALL TO authenticated
  USING (insurer_tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid())
         OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'platform_admin'))
  WITH CHECK (insurer_tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid())
         OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'platform_admin'));

CREATE TABLE public.insurer_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  insurer_tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  rule_id UUID REFERENCES public.insurer_alert_rules(id) ON DELETE SET NULL,
  risk_cell_id UUID NOT NULL REFERENCES public.insurer_risk_cells(id) ON DELETE CASCADE,
  severity public.insurer_risk_severity NOT NULL,
  title TEXT NOT NULL,
  detail TEXT,
  status public.insurer_alert_status NOT NULL DEFAULT 'open',
  acknowledged_by UUID REFERENCES auth.users(id),
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (insurer_tenant_id, risk_cell_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.insurer_alerts TO authenticated;
GRANT ALL ON public.insurer_alerts TO service_role;
ALTER TABLE public.insurer_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Insurer members read own alerts" ON public.insurer_alerts FOR SELECT TO authenticated
  USING (insurer_tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid())
         OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'platform_admin'));
CREATE POLICY "Insurer members manage own alerts" ON public.insurer_alerts FOR ALL TO authenticated
  USING (insurer_tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid())
         OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'platform_admin'))
  WITH CHECK (insurer_tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid())
         OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'platform_admin'));

CREATE TRIGGER update_insurer_watchlist_updated_at BEFORE UPDATE ON public.insurer_watchlist FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER update_insurer_risk_cells_updated_at BEFORE UPDATE ON public.insurer_risk_cells FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER update_insurer_alert_rules_updated_at BEFORE UPDATE ON public.insurer_alert_rules FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER update_insurer_alerts_updated_at BEFORE UPDATE ON public.insurer_alerts FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Synthetic risk cells for AP/Telangana districts (deterministic, aggregate-only)
INSERT INTO public.insurer_risk_cells (state_name, district, crop, season, event_type, severity, rainfall_deviation_pct, affected_acres, affected_fpos, observed_at)
SELECT d.state_name, d.district,
  (ARRAY['Paddy','Cotton','Chilli','Maize','Turmeric','Groundnut'])[1 + (abs(hashtext(d.district || 'crop')) % 6)],
  'Kharif 2026',
  (ARRAY['drought','excess_rain','flood','hail','pest_outbreak','heatwave']::public.insurer_risk_event[])[1 + (abs(hashtext(d.district || 'evt')) % 6)],
  (ARRAY['watch','advisory','severe']::public.insurer_risk_severity[])[1 + (abs(hashtext(d.district || 'sev')) % 3)],
  -60 + (abs(hashtext(d.district || 'rain')) % 130),
  500 + (abs(hashtext(d.district || 'acr')) % 9500),
  abs(hashtext(d.district || 'fpo')) % 12,
  CURRENT_DATE - (abs(hashtext(d.district || 'dt')) % 21)
FROM (SELECT DISTINCT state_name, district FROM public.fpo_registry) d;
