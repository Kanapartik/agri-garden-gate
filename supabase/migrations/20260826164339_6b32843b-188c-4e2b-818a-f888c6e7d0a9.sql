-- Phase 6: FPO produce aggregation & market linkage
CREATE TYPE public.fpo_produce_lot_status AS ENUM (
  'planned','collecting','aggregated','listed','offers_received','buyer_selected',
  'dispatched','delivered','settled','closed','cancelled'
);
CREATE TYPE public.fpo_enquiry_status AS ENUM (
  'received','under_review','negotiating','accepted','declined','withdrawn','expired'
);
CREATE TYPE public.fpo_price_basis AS ENUM ('observed','forecast','derived_scenario');
CREATE TYPE public.fpo_logistics_kind AS ENUM (
  'transport','cold_storage','warehouse','grading','processing'
);

CREATE TABLE public.fpo_produce_lots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  lot_code text,
  commodity text NOT NULL,
  variety text,
  grade text,
  season text,
  harvest_window_start date,
  harvest_window_end date,
  expected_quantity numeric NOT NULL DEFAULT 0 CHECK (expected_quantity >= 0),
  aggregated_quantity numeric NOT NULL DEFAULT 0 CHECK (aggregated_quantity >= 0),
  unit text NOT NULL DEFAULT 'quintal',
  reserve_price_per_unit numeric CHECK (reserve_price_per_unit >= 0),
  storage_location text,
  status public.fpo_produce_lot_status NOT NULL DEFAULT 'planned',
  marketplace_listing_id uuid REFERENCES public.marketplace_listings(id) ON DELETE SET NULL,
  marketplace_rfq_id uuid REFERENCES public.marketplace_rfqs(id) ON DELETE SET NULL,
  note text,
  created_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  is_synthetic boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.fpo_produce_contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_id uuid NOT NULL REFERENCES public.fpo_produce_lots(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  member_id uuid REFERENCES public.fpo_members(id) ON DELETE SET NULL,
  expected_quantity numeric NOT NULL DEFAULT 0 CHECK (expected_quantity >= 0),
  confirmed_quantity numeric NOT NULL DEFAULT 0 CHECK (confirmed_quantity >= 0),
  delivered_quantity numeric NOT NULL DEFAULT 0 CHECK (delivered_quantity >= 0),
  unit text NOT NULL DEFAULT 'quintal',
  grade text,
  note text,
  is_synthetic boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.fpo_buyer_enquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  lot_id uuid REFERENCES public.fpo_produce_lots(id) ON DELETE CASCADE,
  buyer_name text NOT NULL,
  buyer_type text NOT NULL DEFAULT 'buyer',
  buyer_org_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  offered_price_per_unit numeric CHECK (offered_price_per_unit >= 0),
  quantity numeric CHECK (quantity >= 0),
  unit text NOT NULL DEFAULT 'quintal',
  payment_terms text,
  delivery_terms text,
  pickup_location text,
  status public.fpo_enquiry_status NOT NULL DEFAULT 'received',
  responded_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  responded_at timestamptz,
  note text,
  is_synthetic boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.fpo_market_price_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  commodity text NOT NULL,
  variety text,
  market_name text NOT NULL,
  district_code text,
  state_code text,
  price_per_unit numeric NOT NULL CHECK (price_per_unit >= 0),
  unit text NOT NULL DEFAULT 'quintal',
  basis public.fpo_price_basis NOT NULL DEFAULT 'observed',
  source text,
  observed_on date NOT NULL DEFAULT CURRENT_DATE,
  note text,
  is_synthetic boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.fpo_logistics_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  kind public.fpo_logistics_kind NOT NULL,
  provider_name text NOT NULL,
  provider_org_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  location text,
  capacity numeric,
  capacity_unit text,
  rate numeric CHECK (rate >= 0),
  rate_basis text,
  contact text,
  note text,
  is_active boolean NOT NULL DEFAULT true,
  is_synthetic boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_fpo_produce_lots_tenant ON public.fpo_produce_lots(tenant_id, status);
CREATE INDEX idx_fpo_produce_contrib_lot ON public.fpo_produce_contributions(lot_id);
CREATE INDEX idx_fpo_buyer_enquiries_tenant ON public.fpo_buyer_enquiries(tenant_id, status);
CREATE INDEX idx_fpo_prices_tenant ON public.fpo_market_price_observations(tenant_id, commodity, observed_on DESC);
CREATE INDEX idx_fpo_logistics_tenant ON public.fpo_logistics_options(tenant_id, kind);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fpo_produce_lots TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fpo_produce_contributions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fpo_buyer_enquiries TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fpo_market_price_observations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fpo_logistics_options TO authenticated;
GRANT ALL ON public.fpo_produce_lots TO service_role;
GRANT ALL ON public.fpo_produce_contributions TO service_role;
GRANT ALL ON public.fpo_buyer_enquiries TO service_role;
GRANT ALL ON public.fpo_market_price_observations TO service_role;
GRANT ALL ON public.fpo_logistics_options TO service_role;

ALTER TABLE public.fpo_produce_lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fpo_produce_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fpo_buyer_enquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fpo_market_price_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fpo_logistics_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fpo members read produce lots" ON public.fpo_produce_lots
  FOR SELECT TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'platform_admin'));
CREATE POLICY "fpo admins write produce lots" ON public.fpo_produce_lots
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'platform_admin') OR public.has_tenant_role(auth.uid(), tenant_id, 'tenant_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'platform_admin') OR public.has_tenant_role(auth.uid(), tenant_id, 'tenant_admin'));

CREATE POLICY "fpo members read produce contributions" ON public.fpo_produce_contributions
  FOR SELECT TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'platform_admin'));
CREATE POLICY "fpo admins write produce contributions" ON public.fpo_produce_contributions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'platform_admin') OR public.has_tenant_role(auth.uid(), tenant_id, 'tenant_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'platform_admin') OR public.has_tenant_role(auth.uid(), tenant_id, 'tenant_admin'));

CREATE POLICY "fpo members read buyer enquiries" ON public.fpo_buyer_enquiries
  FOR SELECT TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'platform_admin'));
CREATE POLICY "fpo admins write buyer enquiries" ON public.fpo_buyer_enquiries
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'platform_admin') OR public.has_tenant_role(auth.uid(), tenant_id, 'tenant_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'platform_admin') OR public.has_tenant_role(auth.uid(), tenant_id, 'tenant_admin'));

CREATE POLICY "fpo members read price observations" ON public.fpo_market_price_observations
  FOR SELECT TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'platform_admin'));
CREATE POLICY "fpo admins write price observations" ON public.fpo_market_price_observations
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'platform_admin') OR public.has_tenant_role(auth.uid(), tenant_id, 'tenant_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'platform_admin') OR public.has_tenant_role(auth.uid(), tenant_id, 'tenant_admin'));

CREATE POLICY "fpo members read logistics options" ON public.fpo_logistics_options
  FOR SELECT TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'platform_admin'));
CREATE POLICY "fpo admins write logistics options" ON public.fpo_logistics_options
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'platform_admin') OR public.has_tenant_role(auth.uid(), tenant_id, 'tenant_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'platform_admin') OR public.has_tenant_role(auth.uid(), tenant_id, 'tenant_admin'));

CREATE TRIGGER touch_fpo_produce_lots BEFORE UPDATE ON public.fpo_produce_lots
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER touch_fpo_produce_contrib BEFORE UPDATE ON public.fpo_produce_contributions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER touch_fpo_buyer_enquiries BEFORE UPDATE ON public.fpo_buyer_enquiries
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER touch_fpo_prices BEFORE UPDATE ON public.fpo_market_price_observations
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER touch_fpo_logistics BEFORE UPDATE ON public.fpo_logistics_options
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Synthetic AP/Telangana demo produce & market data
INSERT INTO public.fpo_produce_lots (tenant_id, lot_code, commodity, variety, grade, season, harvest_window_start, harvest_window_end, expected_quantity, aggregated_quantity, unit, reserve_price_per_unit, storage_location, status, note, is_synthetic)
SELECT p.tenant_id, 'LOT-PADDY-K26', 'Paddy', 'MTU-1010', 'FAQ', 'Kharif 2026',
       CURRENT_DATE + 12, CURRENT_DATE + 34, 1850, 1240, 'quintal', 2320,
       'FPO godown, mandal headquarters', 'offers_received',
       'Aggregated from member harvest declarations; grading at godown before dispatch.', true
FROM public.fpo_profiles p WHERE p.tenant_id IS NOT NULL LIMIT 2;

INSERT INTO public.fpo_produce_lots (tenant_id, lot_code, commodity, variety, grade, season, harvest_window_start, harvest_window_end, expected_quantity, aggregated_quantity, unit, reserve_price_per_unit, storage_location, status, note, is_synthetic)
SELECT p.tenant_id, 'LOT-MAIZE-K26', 'Maize', 'Hybrid', 'Grade A', 'Kharif 2026',
       CURRENT_DATE + 26, CURRENT_DATE + 52, 940, 0, 'quintal', 2100,
       'Village collection centre', 'collecting',
       'Harvest declarations still being collected from village clusters.', true
FROM public.fpo_profiles p WHERE p.tenant_id IS NOT NULL LIMIT 2;

INSERT INTO public.fpo_produce_contributions (lot_id, tenant_id, member_id, expected_quantity, confirmed_quantity, delivered_quantity, unit, grade, is_synthetic)
SELECT l.id, l.tenant_id, m.id,
       (18 + (row_number() OVER (PARTITION BY l.id ORDER BY m.created_at)) * 4)::numeric,
       CASE WHEN l.status = 'offers_received' THEN (14 + (row_number() OVER (PARTITION BY l.id ORDER BY m.created_at)) * 3)::numeric ELSE 0 END,
       0, 'quintal', l.grade, true
FROM public.fpo_produce_lots l
JOIN public.fpo_members m ON m.tenant_id = l.tenant_id AND m.status = 'active'
WHERE l.is_synthetic;

INSERT INTO public.fpo_buyer_enquiries (tenant_id, lot_id, buyer_name, buyer_type, offered_price_per_unit, quantity, unit, payment_terms, delivery_terms, pickup_location, status, note, is_synthetic)
SELECT l.tenant_id, l.id, b.name, b.btype, b.price, b.qty, 'quintal', b.pay, b.deliv, 'FPO godown', b.st::public.fpo_enquiry_status, b.note, true
FROM public.fpo_produce_lots l
CROSS JOIN (VALUES
  ('Sri Venkateswara Rice Industries, Nellore', 'processor', 2385, 800, '15 days after delivery', 'Buyer arranges transport', 'under_review', 'Requires moisture below 14%.'),
  ('Kisan Bulk Traders, Guntur', 'buyer', 2340, 1200, '50% advance, balance on weighment', 'FPO delivers to mandi yard', 'negotiating', 'Asked for uniform grading across the lot.'),
  ('Deccan Agro Exports, Hyderabad', 'exporter', 2410, 500, '30 days credit', 'Buyer pickup with quality inspection', 'received', 'Export-grade sampling requested.')
) AS b(name, btype, price, qty, pay, deliv, st, note)
WHERE l.is_synthetic AND l.status = 'offers_received';

INSERT INTO public.fpo_market_price_observations (tenant_id, commodity, variety, market_name, district_code, state_code, price_per_unit, unit, basis, source, observed_on, note, is_synthetic)
SELECT p.tenant_id, o.commodity, o.variety, o.market, p.district_code, p.state_code, o.price, 'quintal', o.basis::public.fpo_price_basis, o.source, CURRENT_DATE - o.days_ago, o.note, true
FROM public.fpo_profiles p
CROSS JOIN (VALUES
  ('Paddy', 'MTU-1010', 'Guntur mandi', 2345, 'observed', 'Synthetic mandi feed adapter', 1, 'Modal price for FAQ paddy arrivals.'),
  ('Paddy', 'MTU-1010', 'Karimnagar mandi', 2378, 'observed', 'Synthetic mandi feed adapter', 2, 'Arrivals steady this week.'),
  ('Paddy', 'MTU-1010', 'Guntur mandi', 2420, 'forecast', 'Synthetic price model', 0, 'Indicative only; not a price guarantee.'),
  ('Maize', 'Hybrid', 'Warangal mandi', 2090, 'observed', 'Synthetic mandi feed adapter', 1, 'Feed-grade demand firm.'),
  ('Maize', 'Hybrid', 'Warangal mandi', 2180, 'derived_scenario', 'Synthetic scenario engine', 0, 'Scenario assumes 5% arrival drop; illustrative only.')
) AS o(commodity, variety, market, price, basis, source, days_ago, note)
WHERE p.tenant_id IS NOT NULL;

INSERT INTO public.fpo_logistics_options (tenant_id, kind, provider_name, location, capacity, capacity_unit, rate, rate_basis, contact, note, is_synthetic)
SELECT p.tenant_id, g.kind::public.fpo_logistics_kind, g.provider, g.loc, g.cap, g.cap_unit, g.rate, g.basis, g.contact, g.note, true
FROM public.fpo_profiles p
CROSS JOIN (VALUES
  ('warehouse', 'AP State Warehousing Corporation godown', 'Mandal headquarters', 2500, 'quintal', 12, 'per quintal per month', 'Godown manager', 'Scientific storage with fumigation.'),
  ('cold_storage', 'Krishna Cold Chain', 'Vijayawada', 800, 'quintal', 34, 'per quintal per month', 'Operations desk', 'Suitable for vegetables and seed stock.'),
  ('transport', 'Sai Balaji Transport', 'Guntur', 16, 'tonne per trip', 3800, 'per trip within 100 km', 'Fleet supervisor', 'Tarpaulin covered trucks available in season.'),
  ('grading', 'FPO grading unit', 'FPO godown', 300, 'quintal per day', 8, 'per quintal', 'Godown in-charge', 'Manual grading with moisture meter.')
) AS g(kind, provider, loc, cap, cap_unit, rate, basis, contact, note)
WHERE p.tenant_id IS NOT NULL;