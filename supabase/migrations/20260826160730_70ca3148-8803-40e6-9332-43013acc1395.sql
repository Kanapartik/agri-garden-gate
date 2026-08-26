-- Phase 5: FPO procurement
CREATE TYPE public.fpo_procurement_status AS ENUM (
  'draft','collecting_demand','aggregated','rfq_open','quotes_received',
  'supplier_selected','member_authorization','ordered','distributing',
  'payment_pending','closed','cancelled'
);
CREATE TYPE public.fpo_input_category AS ENUM (
  'seed','fertilizer','crop_protection','equipment','irrigation','packaging','farm_service'
);
CREATE TYPE public.fpo_payment_state AS ENUM ('pending','partial','paid','waived');

CREATE TABLE public.fpo_procurement_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  input_category public.fpo_input_category NOT NULL,
  season text,
  status public.fpo_procurement_status NOT NULL DEFAULT 'draft',
  demand_window_start date,
  demand_window_end date,
  required_by date,
  note text,
  created_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  is_synthetic boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.fpo_procurement_demand (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.fpo_procurement_campaigns(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  member_id uuid REFERENCES public.fpo_members(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  generic_name text,
  quantity numeric NOT NULL CHECK (quantity > 0),
  unit text NOT NULL DEFAULT 'kg',
  indicative_price_per_unit numeric,
  member_authorized boolean NOT NULL DEFAULT false,
  authorization_recorded_at timestamptz,
  note text,
  is_synthetic boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.fpo_procurement_rfqs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.fpo_procurement_campaigns(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  marketplace_rfq_id uuid REFERENCES public.marketplace_rfqs(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  aggregated_quantity numeric NOT NULL CHECK (aggregated_quantity > 0),
  unit text NOT NULL DEFAULT 'kg',
  delivery_by date,
  specification text,
  is_open boolean NOT NULL DEFAULT true,
  is_synthetic boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.fpo_supplier_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id uuid NOT NULL REFERENCES public.fpo_procurement_rfqs(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  supplier_name text NOT NULL,
  supplier_org_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  certification_label text,
  unit_price numeric NOT NULL CHECK (unit_price >= 0),
  transport_cost numeric NOT NULL DEFAULT 0 CHECK (transport_cost >= 0),
  min_order_quantity numeric,
  available_quantity numeric,
  availability_date date,
  delivery_days integer,
  supplier_rating numeric,
  note text,
  is_selected boolean NOT NULL DEFAULT false,
  selected_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  selected_at timestamptz,
  is_synthetic boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.fpo_procurement_distributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.fpo_procurement_campaigns(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  member_id uuid REFERENCES public.fpo_members(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  quantity numeric NOT NULL CHECK (quantity > 0),
  unit text NOT NULL DEFAULT 'kg',
  amount_due numeric NOT NULL DEFAULT 0,
  amount_collected numeric NOT NULL DEFAULT 0,
  payment_state public.fpo_payment_state NOT NULL DEFAULT 'pending',
  distributed_at timestamptz,
  note text,
  is_synthetic boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_fpo_proc_campaigns_tenant ON public.fpo_procurement_campaigns(tenant_id, status);
CREATE INDEX idx_fpo_proc_demand_campaign ON public.fpo_procurement_demand(campaign_id);
CREATE INDEX idx_fpo_proc_rfqs_campaign ON public.fpo_procurement_rfqs(campaign_id);
CREATE INDEX idx_fpo_supplier_quotes_rfq ON public.fpo_supplier_quotes(rfq_id);
CREATE INDEX idx_fpo_proc_dist_campaign ON public.fpo_procurement_distributions(campaign_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fpo_procurement_campaigns TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fpo_procurement_demand TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fpo_procurement_rfqs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fpo_supplier_quotes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fpo_procurement_distributions TO authenticated;
GRANT ALL ON public.fpo_procurement_campaigns TO service_role;
GRANT ALL ON public.fpo_procurement_demand TO service_role;
GRANT ALL ON public.fpo_procurement_rfqs TO service_role;
GRANT ALL ON public.fpo_supplier_quotes TO service_role;
GRANT ALL ON public.fpo_procurement_distributions TO service_role;

ALTER TABLE public.fpo_procurement_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fpo_procurement_demand ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fpo_procurement_rfqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fpo_supplier_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fpo_procurement_distributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fpo members read procurement campaigns" ON public.fpo_procurement_campaigns
  FOR SELECT TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'platform_admin'));
CREATE POLICY "fpo admins write procurement campaigns" ON public.fpo_procurement_campaigns
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'platform_admin') OR public.has_tenant_role(auth.uid(), tenant_id, 'tenant_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'platform_admin') OR public.has_tenant_role(auth.uid(), tenant_id, 'tenant_admin'));

CREATE POLICY "fpo members read procurement demand" ON public.fpo_procurement_demand
  FOR SELECT TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'platform_admin'));
CREATE POLICY "fpo admins write procurement demand" ON public.fpo_procurement_demand
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'platform_admin') OR public.has_tenant_role(auth.uid(), tenant_id, 'tenant_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'platform_admin') OR public.has_tenant_role(auth.uid(), tenant_id, 'tenant_admin'));

CREATE POLICY "fpo members read procurement rfqs" ON public.fpo_procurement_rfqs
  FOR SELECT TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'platform_admin'));
CREATE POLICY "fpo admins write procurement rfqs" ON public.fpo_procurement_rfqs
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'platform_admin') OR public.has_tenant_role(auth.uid(), tenant_id, 'tenant_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'platform_admin') OR public.has_tenant_role(auth.uid(), tenant_id, 'tenant_admin'));

CREATE POLICY "fpo members read supplier quotes" ON public.fpo_supplier_quotes
  FOR SELECT TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'platform_admin'));
CREATE POLICY "fpo admins write supplier quotes" ON public.fpo_supplier_quotes
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'platform_admin') OR public.has_tenant_role(auth.uid(), tenant_id, 'tenant_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'platform_admin') OR public.has_tenant_role(auth.uid(), tenant_id, 'tenant_admin'));

CREATE POLICY "fpo members read distributions" ON public.fpo_procurement_distributions
  FOR SELECT TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'platform_admin'));
CREATE POLICY "fpo admins write distributions" ON public.fpo_procurement_distributions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'platform_admin') OR public.has_tenant_role(auth.uid(), tenant_id, 'tenant_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'platform_admin') OR public.has_tenant_role(auth.uid(), tenant_id, 'tenant_admin'));

CREATE TRIGGER touch_fpo_proc_campaigns BEFORE UPDATE ON public.fpo_procurement_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER touch_fpo_proc_demand BEFORE UPDATE ON public.fpo_procurement_demand
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER touch_fpo_proc_rfqs BEFORE UPDATE ON public.fpo_procurement_rfqs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER touch_fpo_supplier_quotes BEFORE UPDATE ON public.fpo_supplier_quotes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER touch_fpo_proc_dist BEFORE UPDATE ON public.fpo_procurement_distributions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Synthetic AP/Telangana demo procurement
INSERT INTO public.fpo_procurement_campaigns (tenant_id, name, input_category, season, status, demand_window_start, demand_window_end, required_by, note, is_synthetic)
SELECT p.tenant_id,
       'Kharif 2026 paddy seed procurement',
       'seed', 'Kharif 2026', 'quotes_received',
       CURRENT_DATE - 18, CURRENT_DATE - 4, CURRENT_DATE + 20,
       'Aggregated demand from active members across village clusters.', true
FROM public.fpo_profiles p
WHERE p.tenant_id IS NOT NULL
LIMIT 2;

INSERT INTO public.fpo_procurement_demand (campaign_id, tenant_id, member_id, product_name, generic_name, quantity, unit, indicative_price_per_unit, member_authorized, authorization_recorded_at, is_synthetic)
SELECT c.id, c.tenant_id, m.id,
       'Certified paddy seed (MTU-1010)', 'Paddy seed',
       (30 + (row_number() OVER (PARTITION BY c.id ORDER BY m.created_at)) * 10)::numeric,
       'kg', 48, true, now() - interval '6 days', true
FROM public.fpo_procurement_campaigns c
JOIN public.fpo_members m ON m.tenant_id = c.tenant_id AND m.status = 'active'
WHERE c.is_synthetic;

INSERT INTO public.fpo_procurement_rfqs (campaign_id, tenant_id, product_name, aggregated_quantity, unit, delivery_by, specification, is_open, is_synthetic)
SELECT c.id, c.tenant_id, 'Certified paddy seed (MTU-1010)',
       COALESCE((SELECT SUM(d.quantity) FROM public.fpo_procurement_demand d WHERE d.campaign_id = c.id), 500),
       'kg', CURRENT_DATE + 15,
       'Certified seed, germination >= 85%, packed in 30 kg bags, delivered to FPO godown.', true, true
FROM public.fpo_procurement_campaigns c WHERE c.is_synthetic;

INSERT INTO public.fpo_supplier_quotes (rfq_id, tenant_id, supplier_name, certification_label, unit_price, transport_cost, min_order_quantity, available_quantity, availability_date, delivery_days, supplier_rating, note, is_synthetic)
SELECT r.id, r.tenant_id, s.name, s.cert, s.price, s.transport, 300, r.aggregated_quantity, CURRENT_DATE + s.days, s.days, s.rating, s.note, true
FROM public.fpo_procurement_rfqs r
CROSS JOIN (VALUES
  ('Krishna Seeds & Agri Inputs, Vijayawada', 'State certified', 46.50, 4200, 6, 4.4, 'Bulk discount above 800 kg.'),
  ('Telangana Agri Seed Corporation, Warangal', 'Government certified', 48.00, 2600, 4, 4.6, 'Delivery to FPO godown included.'),
  ('Sri Lakshmi Agro Traders, Guntur', 'Truthfully labelled', 43.75, 6900, 9, 3.8, 'Certification pending renewal.')
) AS s(name, cert, price, transport, days, rating, note)
WHERE r.is_synthetic;

INSERT INTO public.fpo_procurement_distributions (campaign_id, tenant_id, member_id, product_name, quantity, unit, amount_due, amount_collected, payment_state, distributed_at, is_synthetic)
SELECT d.campaign_id, d.tenant_id, d.member_id, d.product_name, d.quantity, d.unit,
       ROUND(d.quantity * 48, 2), 0, 'pending', NULL, true
FROM public.fpo_procurement_demand d
WHERE d.is_synthetic AND d.member_authorized
LIMIT 8;