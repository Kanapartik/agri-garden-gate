-- B5: Inputs & Produce base marketplace onboarding (additive)

CREATE TYPE public.market_party_kind AS ENUM ('input_supplier','equipment_supplier','buyer_trader','processor','fpo_aggregator');
CREATE TYPE public.market_side AS ENUM ('seller','buyer');
CREATE TYPE public.market_profile_state AS ENUM ('draft','submitted','approved','rejected','suspended');
CREATE TYPE public.listing_status AS ENUM ('draft','pending_review','published','delisted');
CREATE TYPE public.rfq_status AS ENUM ('draft','open','quoted','ordered','cancelled');
CREATE TYPE public.market_order_status AS ENUM ('created','accepted','fulfilled','cancelled','disputed','closed');
CREATE TYPE public.dispute_status AS ENUM ('open','human_review','resolved','rejected');

-- ---------------------------------------------------------------- profiles
CREATE TABLE public.marketplace_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  party_kind public.market_party_kind NOT NULL,
  side public.market_side NOT NULL,
  display_name text NOT NULL,
  tenant_id uuid REFERENCES public.tenants(id),
  organization_id uuid REFERENCES public.organizations(id),
  contact_email text NOT NULL DEFAULT '',
  categories text[] NOT NULL DEFAULT '{}',
  regions text[] NOT NULL DEFAULT '{}',
  profile_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  state public.market_profile_state NOT NULL DEFAULT 'draft',
  decision_note text,
  decided_by uuid REFERENCES auth.users(id),
  decided_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  is_synthetic boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.marketplace_profiles TO authenticated;
GRANT ALL ON public.marketplace_profiles TO service_role;
ALTER TABLE public.marketplace_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY market_profiles_select ON public.marketplace_profiles FOR SELECT TO authenticated
USING (
  created_by = auth.uid()
  OR (tenant_id IS NOT NULL AND public.is_tenant_member(auth.uid(), tenant_id))
  OR state = 'approved'
  OR public.has_role(auth.uid(),'platform_admin') OR public.has_role(auth.uid(),'auditor')
  OR public.has_role(auth.uid(),'market_operator')
);
CREATE POLICY market_profiles_insert ON public.marketplace_profiles FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid() AND state = 'draft');
CREATE POLICY market_profiles_update ON public.marketplace_profiles FOR UPDATE TO authenticated
USING (created_by = auth.uid() OR public.has_role(auth.uid(),'platform_admin') OR public.has_role(auth.uid(),'market_operator'));

-- ---------------------------------------------------------------- listings
CREATE TABLE public.marketplace_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_profile_id uuid NOT NULL REFERENCES public.marketplace_profiles(id),
  category text NOT NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  unit text NOT NULL DEFAULT 'kg',
  price_min numeric,
  price_max numeric,
  min_order_qty numeric,
  region_code text,
  geography_id uuid REFERENCES public.geographies(id),
  quality jsonb NOT NULL DEFAULT '{}'::jsonb,
  quality_score integer NOT NULL DEFAULT 0,
  status public.listing_status NOT NULL DEFAULT 'draft',
  review_note text,
  published_at timestamptz,
  -- Sponsored placement columns exist for schema readiness only. Activation is
  -- blocked by the marketplace.sponsored_placement flag (off until D-15).
  is_sponsored boolean NOT NULL DEFAULT false,
  sponsored_slot text,
  is_synthetic boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.marketplace_listings TO authenticated;
GRANT ALL ON public.marketplace_listings TO service_role;
ALTER TABLE public.marketplace_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY market_listings_select ON public.marketplace_listings FOR SELECT TO authenticated
USING (
  status = 'published'
  OR created_by = auth.uid()
  OR public.has_role(auth.uid(),'platform_admin') OR public.has_role(auth.uid(),'auditor')
  OR public.has_role(auth.uid(),'market_operator')
);
CREATE POLICY market_listings_insert ON public.marketplace_listings FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid());
CREATE POLICY market_listings_update ON public.marketplace_listings FOR UPDATE TO authenticated
USING (created_by = auth.uid() OR public.has_role(auth.uid(),'platform_admin') OR public.has_role(auth.uid(),'market_operator'));

-- -------------------------------------------------------------------- RFQs
CREATE TABLE public.marketplace_rfqs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_profile_id uuid NOT NULL REFERENCES public.marketplace_profiles(id),
  category text NOT NULL,
  title text NOT NULL,
  quantity numeric NOT NULL,
  unit text NOT NULL DEFAULT 'kg',
  needed_by date,
  delivery_region text,
  notes text NOT NULL DEFAULT '',
  -- FPO aggregated demand requires an approved delegated-authority rule.
  is_aggregated boolean NOT NULL DEFAULT false,
  aggregating_tenant_id uuid REFERENCES public.tenants(id),
  aggregation_authority_ref text,
  status public.rfq_status NOT NULL DEFAULT 'draft',
  is_synthetic boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.marketplace_rfqs TO authenticated;
GRANT ALL ON public.marketplace_rfqs TO service_role;
ALTER TABLE public.marketplace_rfqs ENABLE ROW LEVEL SECURITY;

CREATE POLICY market_rfqs_select ON public.marketplace_rfqs FOR SELECT TO authenticated
USING (
  status IN ('open','quoted')
  OR created_by = auth.uid()
  OR public.has_role(auth.uid(),'platform_admin') OR public.has_role(auth.uid(),'auditor')
  OR public.has_role(auth.uid(),'market_operator')
);
CREATE POLICY market_rfqs_insert ON public.marketplace_rfqs FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid());
CREATE POLICY market_rfqs_update ON public.marketplace_rfqs FOR UPDATE TO authenticated
USING (created_by = auth.uid() OR public.has_role(auth.uid(),'platform_admin') OR public.has_role(auth.uid(),'market_operator'));

-- ------------------------------------------------------------------ quotes
CREATE TABLE public.marketplace_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id uuid NOT NULL REFERENCES public.marketplace_rfqs(id),
  listing_id uuid REFERENCES public.marketplace_listings(id),
  seller_profile_id uuid NOT NULL REFERENCES public.marketplace_profiles(id),
  price numeric NOT NULL,
  unit text NOT NULL DEFAULT 'kg',
  note text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'submitted',
  is_synthetic boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.marketplace_quotes TO authenticated;
GRANT ALL ON public.marketplace_quotes TO service_role;
ALTER TABLE public.marketplace_quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY market_quotes_select ON public.marketplace_quotes FOR SELECT TO authenticated
USING (
  created_by = auth.uid()
  OR EXISTS (SELECT 1 FROM public.marketplace_rfqs r WHERE r.id = rfq_id AND r.created_by = auth.uid())
  OR public.has_role(auth.uid(),'platform_admin') OR public.has_role(auth.uid(),'auditor')
  OR public.has_role(auth.uid(),'market_operator')
);
CREATE POLICY market_quotes_insert ON public.marketplace_quotes FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid());
CREATE POLICY market_quotes_update ON public.marketplace_quotes FOR UPDATE TO authenticated
USING (created_by = auth.uid() OR public.has_role(auth.uid(),'platform_admin') OR public.has_role(auth.uid(),'market_operator'));

-- ------------------------------------------------------------------ orders
CREATE TABLE public.marketplace_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id uuid REFERENCES public.marketplace_rfqs(id),
  quote_id uuid REFERENCES public.marketplace_quotes(id),
  buyer_profile_id uuid NOT NULL REFERENCES public.marketplace_profiles(id),
  seller_profile_id uuid NOT NULL REFERENCES public.marketplace_profiles(id),
  buyer_user_id uuid REFERENCES auth.users(id),
  seller_user_id uuid REFERENCES auth.users(id),
  quantity numeric NOT NULL,
  unit text NOT NULL DEFAULT 'kg',
  agreed_price numeric,
  terms jsonb NOT NULL DEFAULT '{}'::jsonb,
  status public.market_order_status NOT NULL DEFAULT 'created',
  status_note text,
  is_synthetic boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.marketplace_orders TO authenticated;
GRANT ALL ON public.marketplace_orders TO service_role;
ALTER TABLE public.marketplace_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY market_orders_select ON public.marketplace_orders FOR SELECT TO authenticated
USING (
  buyer_user_id = auth.uid() OR seller_user_id = auth.uid()
  OR public.has_role(auth.uid(),'platform_admin') OR public.has_role(auth.uid(),'auditor')
  OR public.has_role(auth.uid(),'market_operator')
);
CREATE POLICY market_orders_insert ON public.marketplace_orders FOR INSERT TO authenticated
WITH CHECK (buyer_user_id = auth.uid());
CREATE POLICY market_orders_update ON public.marketplace_orders FOR UPDATE TO authenticated
USING (
  buyer_user_id = auth.uid() OR seller_user_id = auth.uid()
  OR public.has_role(auth.uid(),'platform_admin') OR public.has_role(auth.uid(),'market_operator')
);

-- ---------------------------------------------------------------- disputes
CREATE TABLE public.marketplace_disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.marketplace_orders(id),
  raised_by uuid REFERENCES auth.users(id),
  category text NOT NULL,
  summary text NOT NULL,
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- Every dispute is routed to a human reviewer; there is no auto-resolution.
  status public.dispute_status NOT NULL DEFAULT 'human_review',
  assigned_to uuid REFERENCES auth.users(id),
  resolution_note text,
  decided_by uuid REFERENCES auth.users(id),
  decided_at timestamptz,
  is_synthetic boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.marketplace_disputes TO authenticated;
GRANT ALL ON public.marketplace_disputes TO service_role;
ALTER TABLE public.marketplace_disputes ENABLE ROW LEVEL SECURITY;

CREATE POLICY market_disputes_select ON public.marketplace_disputes FOR SELECT TO authenticated
USING (
  raised_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.marketplace_orders o
    WHERE o.id = order_id AND (o.buyer_user_id = auth.uid() OR o.seller_user_id = auth.uid())
  )
  OR public.has_role(auth.uid(),'platform_admin') OR public.has_role(auth.uid(),'auditor')
  OR public.has_role(auth.uid(),'market_operator')
);
CREATE POLICY market_disputes_insert ON public.marketplace_disputes FOR INSERT TO authenticated
WITH CHECK (raised_by = auth.uid());
CREATE POLICY market_disputes_update ON public.marketplace_disputes FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(),'platform_admin') OR public.has_role(auth.uid(),'market_operator'));

-- ----------------------------------------------------------- entitlements
CREATE TABLE public.commerce_entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES public.marketplace_profiles(id),
  tenant_id uuid REFERENCES public.tenants(id),
  plan_code text NOT NULL DEFAULT 'base',
  has_retainer boolean NOT NULL DEFAULT false,
  -- Pricing intentionally NULL: no commercial pricing is assumed in this slice.
  retainer_amount numeric,
  transaction_fee_bps integer,
  currency text,
  features jsonb NOT NULL DEFAULT '{}'::jsonb,
  status public.membership_status NOT NULL DEFAULT 'active',
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.commerce_entitlements TO authenticated;
GRANT ALL ON public.commerce_entitlements TO service_role;
ALTER TABLE public.commerce_entitlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY commerce_entitlements_select ON public.commerce_entitlements FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.marketplace_profiles p WHERE p.id = profile_id AND p.created_by = auth.uid())
  OR (tenant_id IS NOT NULL AND public.is_tenant_member(auth.uid(), tenant_id))
  OR public.has_role(auth.uid(),'platform_admin') OR public.has_role(auth.uid(),'auditor')
);

-- ---------------------------------------------- sponsored placements (off)
CREATE TABLE public.sponsored_placements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.marketplace_listings(id),
  slot text NOT NULL,
  starts_at timestamptz,
  ends_at timestamptz,
  -- Remains inactive and hidden from all UI until decision D-15.
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.sponsored_placements TO authenticated;
GRANT ALL ON public.sponsored_placements TO service_role;
ALTER TABLE public.sponsored_placements ENABLE ROW LEVEL SECURITY;

CREATE POLICY sponsored_placements_select ON public.sponsored_placements FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'platform_admin') OR public.has_role(auth.uid(),'auditor'));

CREATE TRIGGER touch_market_profiles BEFORE UPDATE ON public.marketplace_profiles
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER touch_market_listings BEFORE UPDATE ON public.marketplace_listings
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER touch_market_rfqs BEFORE UPDATE ON public.marketplace_rfqs
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER touch_market_orders BEFORE UPDATE ON public.marketplace_orders
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER touch_market_disputes BEFORE UPDATE ON public.marketplace_disputes
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_market_listings_status ON public.marketplace_listings(status, category);
CREATE INDEX idx_market_rfqs_status ON public.marketplace_rfqs(status, category);
CREATE INDEX idx_market_orders_parties ON public.marketplace_orders(buyer_user_id, seller_user_id);

INSERT INTO public.feature_flags (key, label, description, enabled, environments) VALUES
  ('marketplace.base_commerce','Base inputs & produce marketplace','Seller/buyer onboarding, listings, RFQ and order shell.', true, '["development","sandbox"]'::jsonb),
  ('marketplace.fpo_aggregated_rfq','FPO aggregated demand RFQ','Requires an approved delegated purchasing authority rule; off until that decision.', false, '["development"]'::jsonb),
  ('marketplace.sponsored_placement','Sponsored placement','Schema only. UI and activation blocked until decision D-15.', false, '[]'::jsonb),
  ('marketplace.dispute_workflow','Marketplace dispute workflow','Human-reviewed dispute escalation.', true, '["development","sandbox"]'::jsonb)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.synthetic_actors (persona_key, display_name, role_code, notes) VALUES
  ('b5_input_seller','Synthetic input supplier','tenant_admin','Seeds/fertiliser seller profile for B5 listing tests.'),
  ('b5_equipment_seller','Synthetic equipment supplier','tenant_admin','Equipment catalog seller (sale only, no rental).'),
  ('b5_buyer_trader','Synthetic buyer/trader','tenant_admin','Produce buyer creating RFQs and orders.'),
  ('b5_processor','Synthetic processor','tenant_admin','Processor sourcing profile.'),
  ('b5_market_operator','Synthetic market operator','market_operator','Reviews listings and human-reviews disputes.')
ON CONFLICT (persona_key) DO NOTHING;
