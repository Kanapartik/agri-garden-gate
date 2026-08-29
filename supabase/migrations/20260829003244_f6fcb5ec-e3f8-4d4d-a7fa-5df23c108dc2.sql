-- Slice B10: farmer history & farm command centre

ALTER TYPE public.facility_kind ADD VALUE IF NOT EXISTS 'drone_service';
ALTER TYPE public.facility_kind ADD VALUE IF NOT EXISTS 'farm_machinery';

-- 1. Farmer-owned season history -------------------------------------------
CREATE TABLE public.farm_season_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  farm_id uuid REFERENCES public.farm_records(id) ON DELETE SET NULL,
  crop_year integer NOT NULL,
  season_code text NOT NULL,
  crop text NOT NULL,
  area_acres numeric(10,2) NOT NULL DEFAULT 0,
  input_costs jsonb NOT NULL DEFAULT '{}'::jsonb,
  input_cost_total numeric(12,2) NOT NULL DEFAULT 0,
  yield_quintal numeric(12,2),
  price_per_quintal numeric(12,2),
  revenue_inr numeric(14,2),
  notes text,
  provenance public.field_provenance NOT NULL DEFAULT 'farmer_entered',
  is_synthetic boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (farmer_user_id, crop_year, season_code, crop, farm_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.farm_season_records TO authenticated;
GRANT ALL ON public.farm_season_records TO service_role;
ALTER TABLE public.farm_season_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Farmers read own season records"
  ON public.farm_season_records FOR SELECT TO authenticated
  USING (farmer_user_id = auth.uid());
CREATE POLICY "Farmers insert own season records"
  ON public.farm_season_records FOR INSERT TO authenticated
  WITH CHECK (farmer_user_id = auth.uid());
CREATE POLICY "Farmers update own season records"
  ON public.farm_season_records FOR UPDATE TO authenticated
  USING (farmer_user_id = auth.uid()) WITH CHECK (farmer_user_id = auth.uid());
CREATE POLICY "Farmers delete own season records"
  ON public.farm_season_records FOR DELETE TO authenticated
  USING (farmer_user_id = auth.uid());

CREATE TRIGGER touch_farm_season_records BEFORE UPDATE ON public.farm_season_records
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_farm_season_records_farmer ON public.farm_season_records (farmer_user_id, crop_year DESC);

-- 2. District x crop aggregate benchmarks ----------------------------------
CREATE TABLE public.area_crop_benchmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  state_name text NOT NULL,
  district text NOT NULL,
  crop text NOT NULL,
  crop_year integer NOT NULL,
  season_code text NOT NULL DEFAULT 'kharif',
  typical_yield_quintal_per_acre numeric(10,2) NOT NULL,
  yield_low_quintal_per_acre numeric(10,2) NOT NULL,
  yield_high_quintal_per_acre numeric(10,2) NOT NULL,
  typical_cost_per_acre numeric(12,2) NOT NULL,
  typical_price_per_quintal numeric(12,2) NOT NULL,
  price_low_per_quintal numeric(12,2) NOT NULL,
  price_high_per_quintal numeric(12,2) NOT NULL,
  adoption_share numeric(5,2) NOT NULL DEFAULT 0,
  source text NOT NULL DEFAULT 'synthetic_baseline',
  is_synthetic boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (state_name, district, crop, crop_year, season_code)
);

GRANT SELECT ON public.area_crop_benchmarks TO authenticated;
GRANT ALL ON public.area_crop_benchmarks TO service_role;
ALTER TABLE public.area_crop_benchmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed-in users read area benchmarks"
  ON public.area_crop_benchmarks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Platform admins manage area benchmarks"
  ON public.area_crop_benchmarks FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'platform_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'platform_admin'));

CREATE TRIGGER touch_area_crop_benchmarks BEFORE UPDATE ON public.area_crop_benchmarks
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_area_crop_benchmarks_lookup ON public.area_crop_benchmarks (district, crop, crop_year DESC);

-- 3. Farmer advisory insurance snapshot ------------------------------------
CREATE TABLE public.farmer_insurance_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  season_code text NOT NULL,
  crop_year integer NOT NULL,
  crop text,
  district text,
  state_name text,
  cover_state text NOT NULL DEFAULT 'not_covered',
  indicative_premium_per_acre numeric(12,2),
  sum_insured_per_acre numeric(12,2),
  farmer_share_per_acre numeric(12,2),
  scheme_code text,
  contact_label text,
  source text NOT NULL DEFAULT 'synthetic_baseline',
  is_synthetic boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (farmer_user_id, crop_year, season_code)
);

GRANT SELECT ON public.farmer_insurance_snapshots TO authenticated;
GRANT ALL ON public.farmer_insurance_snapshots TO service_role;
ALTER TABLE public.farmer_insurance_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Farmers read own insurance snapshot"
  ON public.farmer_insurance_snapshots FOR SELECT TO authenticated
  USING (farmer_user_id = auth.uid());
CREATE POLICY "Platform admins manage insurance snapshots"
  ON public.farmer_insurance_snapshots FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'platform_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'platform_admin'));

CREATE TRIGGER touch_farmer_insurance_snapshots BEFORE UPDATE ON public.farmer_insurance_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();