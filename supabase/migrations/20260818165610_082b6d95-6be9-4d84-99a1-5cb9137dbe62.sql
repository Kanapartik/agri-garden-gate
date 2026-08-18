-- ============ helper: farm ownership visible to RLS ============
CREATE OR REPLACE FUNCTION public.can_read_farm(_farm_id uuid)
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
REVOKE ALL ON FUNCTION public.can_read_farm(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_read_farm(uuid) TO authenticated, service_role;

-- ============ enums ============
CREATE TYPE public.facility_kind AS ENUM ('fpo','kvk','soil_lab','chc','warehouse','cold_storage','processor','logistics','extension_centre');
CREATE TYPE public.soil_lab_kind AS ENUM ('government','mobile','mini','village','registered_private','icar_kvk');
CREATE TYPE public.observation_kind AS ENUM ('weather','agromet','soil_general','soil_health_card','price','facility','district_profile');
CREATE TYPE public.price_label AS ENUM ('observed','forecast','derived_scenario');
CREATE TYPE public.soil_basis AS ENUM ('inferred_from_location','lab_tested');
CREATE TYPE public.escalation_kind AS ENUM ('talk_to_fpo','talk_to_kvk','talk_to_agronomist','book_soil_test','request_processor_quote');
CREATE TYPE public.escalation_status AS ENUM ('requested','acknowledged','in_progress','closed','cancelled');

-- ============ location context ============
CREATE TABLE public.location_context_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id uuid NOT NULL REFERENCES public.farm_records(id) ON DELETE CASCADE,
  subject_user_id uuid NOT NULL,
  village_code text,
  village_name text,
  block_name text,
  district_name text,
  state_name text,
  geography_id uuid REFERENCES public.geographies(id),
  centroid_lat numeric,
  centroid_lng numeric,
  agro_climatic_zone text,
  season_code text,
  season_label text,
  source_key text NOT NULL DEFAULT 'synthetic',
  is_synthetic boolean NOT NULL DEFAULT true,
  resolved_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.location_context_snapshots TO authenticated;
GRANT ALL ON public.location_context_snapshots TO service_role;
ALTER TABLE public.location_context_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "loc_read_own_farm" ON public.location_context_snapshots FOR SELECT TO authenticated USING (public.can_read_farm(farm_id));
CREATE POLICY "loc_insert_own_farm" ON public.location_context_snapshots FOR INSERT TO authenticated WITH CHECK (public.can_read_farm(farm_id));

-- ============ external observations ============
CREATE TABLE public.external_data_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id uuid REFERENCES public.farm_records(id) ON DELETE CASCADE,
  geography_id uuid REFERENCES public.geographies(id),
  kind public.observation_kind NOT NULL,
  source_key text NOT NULL,
  adapter_name text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  observed_at timestamptz NOT NULL DEFAULT now(),
  fetched_at timestamptz NOT NULL DEFAULT now(),
  freshness_seconds integer,
  confidence numeric,
  is_synthetic boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_obs_farm_kind ON public.external_data_observations (farm_id, kind, observed_at DESC);
GRANT SELECT, INSERT ON public.external_data_observations TO authenticated;
GRANT ALL ON public.external_data_observations TO service_role;
ALTER TABLE public.external_data_observations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "obs_read" ON public.external_data_observations FOR SELECT TO authenticated USING (farm_id IS NULL OR public.can_read_farm(farm_id));
CREATE POLICY "obs_insert" ON public.external_data_observations FOR INSERT TO authenticated WITH CHECK (farm_id IS NULL OR public.can_read_farm(farm_id));

-- ============ market price observations (reference data) ============
CREATE TABLE public.market_price_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  market_name text NOT NULL,
  market_code text,
  district_name text,
  state_name text,
  latitude numeric,
  longitude numeric,
  commodity text NOT NULL,
  variety text,
  grade text,
  unit text NOT NULL DEFAULT 'quintal',
  min_price numeric,
  modal_price numeric,
  max_price numeric,
  arrivals_quantity numeric,
  arrivals_unit text,
  price_date date NOT NULL,
  label public.price_label NOT NULL DEFAULT 'observed',
  source_key text NOT NULL,
  adapter_name text NOT NULL,
  is_synthetic boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_price_commodity_date ON public.market_price_observations (commodity, price_date DESC);
GRANT SELECT ON public.market_price_observations TO authenticated;
GRANT ALL ON public.market_price_observations TO service_role;
ALTER TABLE public.market_price_observations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "price_read_authenticated" ON public.market_price_observations FOR SELECT TO authenticated USING (true);
CREATE POLICY "price_admin_write" ON public.market_price_observations FOR ALL TO authenticated USING (public.has_role(auth.uid(),'platform_admin')) WITH CHECK (public.has_role(auth.uid(),'platform_admin'));

-- ============ nearby facilities (reference data) ============
CREATE TABLE public.nearby_service_facilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind public.facility_kind NOT NULL,
  soil_lab_kind public.soil_lab_kind,
  name text NOT NULL,
  organization_id uuid REFERENCES public.organizations(id),
  tenant_id uuid REFERENCES public.tenants(id),
  geography_id uuid REFERENCES public.geographies(id),
  district_name text,
  state_name text,
  latitude numeric NOT NULL,
  longitude numeric NOT NULL,
  contact_label text,
  source_key text NOT NULL,
  is_synthetic boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.nearby_service_facilities TO authenticated;
GRANT ALL ON public.nearby_service_facilities TO service_role;
ALTER TABLE public.nearby_service_facilities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fac_read_authenticated" ON public.nearby_service_facilities FOR SELECT TO authenticated USING (true);
CREATE POLICY "fac_admin_write" ON public.nearby_service_facilities FOR ALL TO authenticated USING (public.has_role(auth.uid(),'platform_admin')) WITH CHECK (public.has_role(auth.uid(),'platform_admin'));

-- ============ crop suitability ============
CREATE TABLE public.crop_suitability_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id uuid NOT NULL REFERENCES public.farm_records(id) ON DELETE CASCADE,
  season_code text NOT NULL,
  crop text NOT NULL,
  variety text,
  score numeric NOT NULL,
  confidence numeric NOT NULL DEFAULT 0.5,
  soil_basis public.soil_basis NOT NULL DEFAULT 'inferred_from_location',
  factors jsonb NOT NULL DEFAULT '[]'::jsonb,
  change_factors jsonb NOT NULL DEFAULT '[]'::jsonb,
  sowing_window text,
  sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_synthetic boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.crop_suitability_assessments TO authenticated;
GRANT ALL ON public.crop_suitability_assessments TO service_role;
ALTER TABLE public.crop_suitability_assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crop_read_own_farm" ON public.crop_suitability_assessments FOR SELECT TO authenticated USING (public.can_read_farm(farm_id));
CREATE POLICY "crop_insert_own_farm" ON public.crop_suitability_assessments FOR INSERT TO authenticated WITH CHECK (public.can_read_farm(farm_id));

-- ============ processing paths (configurable assumptions) ============
CREATE TABLE public.processing_path_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  label text NOT NULL,
  commodity text NOT NULL,
  owner_scope text NOT NULL DEFAULT 'platform',
  tenant_id uuid REFERENCES public.tenants(id),
  organization_id uuid REFERENCES public.organizations(id),
  assumption_source text NOT NULL DEFAULT 'platform_default',
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  is_synthetic boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (code, tenant_id)
);
CREATE TABLE public.processing_path_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  path_id uuid NOT NULL REFERENCES public.processing_path_definitions(id) ON DELETE CASCADE,
  step_order integer NOT NULL,
  from_product text NOT NULL,
  to_product text NOT NULL,
  recovery_pct numeric NOT NULL,
  byproducts jsonb NOT NULL DEFAULT '[]'::jsonb,
  cost_per_quintal numeric NOT NULL DEFAULT 0,
  cost_breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  assumption_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (path_id, step_order)
);
GRANT SELECT ON public.processing_path_definitions TO authenticated;
GRANT SELECT ON public.processing_path_steps TO authenticated;
GRANT ALL ON public.processing_path_definitions TO service_role;
GRANT ALL ON public.processing_path_steps TO service_role;
GRANT INSERT, UPDATE ON public.processing_path_definitions TO authenticated;
GRANT INSERT, UPDATE ON public.processing_path_steps TO authenticated;
ALTER TABLE public.processing_path_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processing_path_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "path_read" ON public.processing_path_definitions FOR SELECT TO authenticated USING (is_active);
CREATE POLICY "path_admin_insert" ON public.processing_path_definitions FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'platform_admin') OR (tenant_id IS NOT NULL AND public.has_tenant_role(auth.uid(), tenant_id, 'tenant_admin')));
CREATE POLICY "path_admin_update" ON public.processing_path_definitions FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'platform_admin') OR (tenant_id IS NOT NULL AND public.has_tenant_role(auth.uid(), tenant_id, 'tenant_admin')))
  WITH CHECK (public.has_role(auth.uid(),'platform_admin') OR (tenant_id IS NOT NULL AND public.has_tenant_role(auth.uid(), tenant_id, 'tenant_admin')));
CREATE POLICY "step_read" ON public.processing_path_steps FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.processing_path_definitions d WHERE d.id = path_id AND d.is_active)
);
CREATE POLICY "step_write" ON public.processing_path_steps FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.processing_path_definitions d WHERE d.id = path_id
    AND (public.has_role(auth.uid(),'platform_admin') OR (d.tenant_id IS NOT NULL AND public.has_tenant_role(auth.uid(), d.tenant_id, 'tenant_admin'))))
);
CREATE POLICY "step_update" ON public.processing_path_steps FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.processing_path_definitions d WHERE d.id = path_id
    AND (public.has_role(auth.uid(),'platform_admin') OR (d.tenant_id IS NOT NULL AND public.has_tenant_role(auth.uid(), d.tenant_id, 'tenant_admin'))))
) WITH CHECK (true);
CREATE TRIGGER touch_processing_paths BEFORE UPDATE ON public.processing_path_definitions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ derived scenarios ============
CREATE TABLE public.value_add_scenarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id uuid NOT NULL REFERENCES public.farm_records(id) ON DELETE CASCADE,
  path_id uuid REFERENCES public.processing_path_definitions(id),
  commodity text NOT NULL,
  label public.price_label NOT NULL DEFAULT 'derived_scenario',
  raw_price_per_quintal numeric,
  raw_price_label public.price_label,
  raw_price_source text,
  assumptions jsonb NOT NULL DEFAULT '{}'::jsonb,
  steps_result jsonb NOT NULL DEFAULT '[]'::jsonb,
  byproduct_value numeric NOT NULL DEFAULT 0,
  processing_cost numeric NOT NULL DEFAULT 0,
  estimated_realization numeric,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.crop_outcome_scenarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id uuid NOT NULL REFERENCES public.farm_records(id) ON DELETE CASCADE,
  crop text NOT NULL,
  season_code text NOT NULL,
  scenario text NOT NULL,
  label public.price_label NOT NULL DEFAULT 'derived_scenario',
  expected_yield_quintal numeric NOT NULL,
  selling_price numeric NOT NULL,
  selling_price_label public.price_label NOT NULL DEFAULT 'observed',
  total_cost numeric NOT NULL,
  gross_realization numeric NOT NULL,
  net_contribution numeric NOT NULL,
  break_even_price numeric NOT NULL,
  break_even_yield numeric NOT NULL,
  harvest_window text,
  target_market text,
  value_add_alternative text,
  risks jsonb NOT NULL DEFAULT '[]'::jsonb,
  assumptions jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.value_add_scenarios TO authenticated;
GRANT SELECT, INSERT ON public.crop_outcome_scenarios TO authenticated;
GRANT ALL ON public.value_add_scenarios TO service_role;
GRANT ALL ON public.crop_outcome_scenarios TO service_role;
ALTER TABLE public.value_add_scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crop_outcome_scenarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vas_read" ON public.value_add_scenarios FOR SELECT TO authenticated USING (public.can_read_farm(farm_id));
CREATE POLICY "vas_insert" ON public.value_add_scenarios FOR INSERT TO authenticated WITH CHECK (public.can_read_farm(farm_id));
CREATE POLICY "cos_read" ON public.crop_outcome_scenarios FOR SELECT TO authenticated USING (public.can_read_farm(farm_id));
CREATE POLICY "cos_insert" ON public.crop_outcome_scenarios FOR INSERT TO authenticated WITH CHECK (public.can_read_farm(farm_id));

-- ============ advisory evidence + escalation ============
CREATE TABLE public.advisory_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id uuid NOT NULL REFERENCES public.farm_records(id) ON DELETE CASCADE,
  advisory_kind text NOT NULL,
  advisory_ref text,
  observation_id uuid REFERENCES public.external_data_observations(id) ON DELETE SET NULL,
  knowledge_contribution_id uuid REFERENCES public.knowledge_contributions(id) ON DELETE SET NULL,
  source_key text NOT NULL,
  freshness_seconds integer,
  confidence numeric,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.advisory_evidence TO authenticated;
GRANT ALL ON public.advisory_evidence TO service_role;
ALTER TABLE public.advisory_evidence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "evidence_read" ON public.advisory_evidence FOR SELECT TO authenticated USING (public.can_read_farm(farm_id));
CREATE POLICY "evidence_insert" ON public.advisory_evidence FOR INSERT TO authenticated WITH CHECK (public.can_read_farm(farm_id));

CREATE TABLE public.advisory_escalations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id uuid NOT NULL REFERENCES public.farm_records(id) ON DELETE CASCADE,
  requester_user_id uuid NOT NULL,
  subject_user_id uuid NOT NULL,
  kind public.escalation_kind NOT NULL,
  facility_id uuid REFERENCES public.nearby_service_facilities(id),
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  message text,
  status public.escalation_status NOT NULL DEFAULT 'requested',
  handled_by uuid,
  resolution_note text,
  is_synthetic boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.advisory_escalations TO authenticated;
GRANT ALL ON public.advisory_escalations TO service_role;
ALTER TABLE public.advisory_escalations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "esc_read" ON public.advisory_escalations FOR SELECT TO authenticated USING (public.can_read_farm(farm_id));
CREATE POLICY "esc_insert" ON public.advisory_escalations FOR INSERT TO authenticated WITH CHECK (public.can_read_farm(farm_id) AND requester_user_id = auth.uid());
CREATE POLICY "esc_update_handler" ON public.advisory_escalations FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'platform_admin') OR public.has_role(auth.uid(),'support_agent'))
  WITH CHECK (public.has_role(auth.uid(),'platform_admin') OR public.has_role(auth.uid(),'support_agent'));
CREATE TRIGGER touch_advisory_escalations BEFORE UPDATE ON public.advisory_escalations
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ feature flags ============
INSERT INTO public.feature_flags (key, label, description, enabled, environments) VALUES
 ('farm_intelligence.workspace','My Farm Intelligence workspace','Collated location, weather, soil, crop, market and value-add intelligence for a farmer parcel.', true, '{"development":true,"sandbox":true,"production":false}'::jsonb),
 ('farm_intelligence.weather_adapter','Agromet weather adapter','Synthetic IMD Mausam/SANKALP-shaped agromet adapter. Real provider is [VALIDATE].', true, '{"development":true,"sandbox":true,"production":false}'::jsonb),
 ('farm_intelligence.market_prices','Mandi price intelligence','Synthetic e-NAM/AGMARKNET-shaped min/modal/max mandi prices. Real provider is [VALIDATE].', true, '{"development":true,"sandbox":true,"production":false}'::jsonb),
 ('farm_intelligence.value_add_planner','Value-add & outcome planner','Derived raw vs processed comparison and low/base/high outcome scenarios with visible assumptions.', true, '{"development":true,"sandbox":true,"production":false}'::jsonb),
 ('farm_intelligence.soil_health_card','Soil Health Card lookup','Soil Health Card / laboratory result lookup with nearest soil-testing-laboratory directory.', true, '{"development":true,"sandbox":true,"production":false}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ============ synthetic reference data ============
INSERT INTO public.nearby_service_facilities (kind, soil_lab_kind, name, district_name, state_name, latitude, longitude, contact_label, source_key) VALUES
 ('fpo', NULL, 'Guntur Chilli FPO (synthetic)', 'Guntur', 'Andhra Pradesh', 16.3067, 80.4365, 'FPO CEO desk', 'synthetic:sfac-fpo-registry'),
 ('fpo', NULL, 'Kurnool Millets FPO (synthetic)', 'Kurnool', 'Andhra Pradesh', 15.8281, 78.0373, 'FPO CEO desk', 'synthetic:sfac-fpo-registry'),
 ('fpo', NULL, 'Warangal Paddy FPO (synthetic)', 'Warangal', 'Telangana', 17.9784, 79.5941, 'FPO CEO desk', 'synthetic:sfac-fpo-registry'),
 ('kvk', NULL, 'KVK Lam, Guntur (synthetic)', 'Guntur', 'Andhra Pradesh', 16.3200, 80.4100, 'Extension scientist', 'synthetic:icar-kvk-directory'),
 ('kvk', NULL, 'KVK Malyal, Warangal (synthetic)', 'Warangal', 'Telangana', 17.9500, 79.6200, 'Extension scientist', 'synthetic:icar-kvk-directory'),
 ('extension_centre', NULL, 'Nizamabad Extension Centre (synthetic)', 'Nizamabad', 'Telangana', 18.6725, 78.0941, 'Agriculture officer', 'synthetic:state-extension'),
 ('soil_lab', 'government', 'District Soil Testing Lab, Guntur (synthetic)', 'Guntur', 'Andhra Pradesh', 16.3010, 80.4560, 'Lab in-charge', 'synthetic:soil-health-card'),
 ('soil_lab', 'mobile', 'Mobile Soil Testing Van, Kurnool (synthetic)', 'Kurnool', 'Andhra Pradesh', 15.8100, 78.0500, 'Van coordinator', 'synthetic:soil-health-card'),
 ('soil_lab', 'village', 'Village Level Soil Lab, Warangal (synthetic)', 'Warangal', 'Telangana', 17.9900, 79.5800, 'Village entrepreneur', 'synthetic:soil-health-card'),
 ('soil_lab', 'icar_kvk', 'ICAR/KVK Soil Lab, Nizamabad (synthetic)', 'Nizamabad', 'Telangana', 18.6600, 78.1000, 'Lab scientist', 'synthetic:soil-health-card'),
 ('chc', NULL, 'Medak Custom Hiring Centre (synthetic)', 'Medak', 'Telangana', 18.0460, 78.2600, 'CHC manager', 'synthetic:state-chc-directory'),
 ('chc', NULL, 'Guntur Custom Hiring Centre (synthetic)', 'Guntur', 'Andhra Pradesh', 16.2900, 80.4200, 'CHC manager', 'synthetic:state-chc-directory'),
 ('warehouse', NULL, 'Warangal Warehouse (synthetic)', 'Warangal', 'Telangana', 17.9600, 79.6000, 'Warehouse keeper', 'synthetic:warehouse-directory'),
 ('cold_storage', NULL, 'Nellore Cold Chain (synthetic)', 'Nellore', 'Andhra Pradesh', 14.4426, 79.9865, 'Plant manager', 'synthetic:cold-chain-directory'),
 ('processor', NULL, 'Warangal Rice Mill (synthetic)', 'Warangal', 'Telangana', 17.9700, 79.5700, 'Mill operations', 'synthetic:processor-directory'),
 ('logistics', NULL, 'Guntur Agri Logistics (synthetic)', 'Guntur', 'Andhra Pradesh', 16.3150, 80.4500, 'Dispatch desk', 'synthetic:logistics-directory');

INSERT INTO public.market_price_observations (market_name, district_name, state_name, latitude, longitude, commodity, variety, grade, unit, min_price, modal_price, max_price, arrivals_quantity, arrivals_unit, price_date, source_key, adapter_name) VALUES
 ('Warangal Mandi','Warangal','Telangana',17.9784,79.5941,'Paddy','MTU-1010','FAQ','quintal',2050,2180,2260,1450,'quintal', CURRENT_DATE - 1, 'synthetic:agmarknet','synthetic-market-price'),
 ('Nizamabad Mandi','Nizamabad','Telangana',18.6725,78.0941,'Paddy','BPT-5204','FAQ','quintal',2100,2240,2320,980,'quintal', CURRENT_DATE - 1, 'synthetic:enam','synthetic-market-price'),
 ('Guntur Mandi','Guntur','Andhra Pradesh',16.3067,80.4365,'Paddy','MTU-1061','FAQ','quintal',2020,2150,2230,1720,'quintal', CURRENT_DATE - 1, 'synthetic:agmarknet','synthetic-market-price'),
 ('Guntur Mandi','Guntur','Andhra Pradesh',16.3067,80.4365,'Chilli','Teja','Grade-1','quintal',14500,16200,17800,620,'quintal', CURRENT_DATE - 1, 'synthetic:enam','synthetic-market-price'),
 ('Kurnool Mandi','Kurnool','Andhra Pradesh',15.8281,78.0373,'Bengal Gram','Desi','FAQ','quintal',5400,5750,5980,410,'quintal', CURRENT_DATE - 1, 'synthetic:agmarknet','synthetic-market-price'),
 ('Kurnool Mandi','Kurnool','Andhra Pradesh',15.8281,78.0373,'Groundnut','Bold','FAQ','quintal',5800,6150,6400,530,'quintal', CURRENT_DATE - 2, 'synthetic:agmarknet','synthetic-market-price'),
 ('Warangal Mandi','Warangal','Telangana',17.9784,79.5941,'Rice (polished)','Sona Masoori','Grade-1','quintal',4150,4400,4650,220,'quintal', CURRENT_DATE - 2, 'synthetic:enam','synthetic-market-price'),
 ('Warangal Mandi','Warangal','Telangana',17.9784,79.5941,'Maize','Hybrid','FAQ','quintal',1950,2080,2180,880,'quintal', CURRENT_DATE - 1, 'synthetic:agmarknet','synthetic-market-price'),
 ('Nizamabad Mandi','Nizamabad','Telangana',18.6725,78.0941,'Turmeric','Nizamabad Bulb','FAQ','quintal',12800,13900,15100,300,'quintal', CURRENT_DATE - 3, 'synthetic:enam','synthetic-market-price'),
 ('Guntur Mandi','Guntur','Andhra Pradesh',16.3067,80.4365,'Cotton','Medium Staple','FAQ','quintal',6900,7350,7700,760,'quintal', CURRENT_DATE - 1, 'synthetic:agmarknet','synthetic-market-price');

WITH p AS (
  INSERT INTO public.processing_path_definitions (code, label, commodity, owner_scope, assumption_source, notes)
  VALUES ('paddy_to_polished_rice','Paddy to polished rice','Paddy','platform','platform_default',
    'Recovery percentages are configurable assumptions, not universal constants. Conversion varies by variety, moisture, mill and quality — replace with processor/FPO assumptions or an actual quotation.')
  RETURNING id
)
INSERT INTO public.processing_path_steps (path_id, step_order, from_product, to_product, recovery_pct, byproducts, cost_per_quintal, cost_breakdown, assumption_note)
SELECT p.id, s.step_order, s.from_product, s.to_product, s.recovery_pct, s.byproducts::jsonb, s.cost, s.cost_breakdown::jsonb, s.note
FROM p, (VALUES
  (1,'Paddy','Cleaned & dried paddy', 96.0, '[{"name":"Chaff & foreign matter","yield_pct":4.0,"price_per_quintal":0}]', 120, '{"cleaning":60,"drying":40,"handling":20}', 'Assumes 20% incoming moisture brought to 14%. [VALIDATE assumption]'),
  (2,'Cleaned & dried paddy','Brown (unpolished) rice', 78.0, '[{"name":"Husk","yield_pct":20.0,"price_per_quintal":180}]', 150, '{"dehusking":110,"handling":40}', 'Dehusking recovery varies by variety. [VALIDATE assumption]'),
  (3,'Brown (unpolished) rice','Polished rice', 92.0, '[{"name":"Bran","yield_pct":6.0,"price_per_quintal":2200},{"name":"Broken rice","yield_pct":2.0,"price_per_quintal":1900}]', 210, '{"polishing":120,"grading":40,"packaging":50}', 'Broken-rice share depends on grain quality and mill settings. [VALIDATE assumption]')
) AS s(step_order, from_product, to_product, recovery_pct, byproducts, cost, cost_breakdown, note);