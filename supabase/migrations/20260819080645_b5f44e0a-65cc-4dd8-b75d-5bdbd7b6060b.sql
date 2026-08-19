-- B2B: farmer practice library, input advisory catalogue, soil care, i18n

CREATE TABLE public.practice_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  stage text NOT NULL CHECK (stage IN ('land_prep_sowing','crop_protection','harvest_cutting','post_harvest_preservation','value_creation')),
  title text NOT NULL,
  summary text NOT NULL DEFAULT '',
  crop_tags text[] NOT NULL DEFAULT '{}',
  season_codes text[] NOT NULL DEFAULT '{}',
  source_attribution text,
  sort_order integer NOT NULL DEFAULT 0,
  published boolean NOT NULL DEFAULT true,
  is_synthetic boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.practice_modules TO authenticated;
GRANT ALL ON public.practice_modules TO service_role;
ALTER TABLE public.practice_modules ENABLE ROW LEVEL SECURITY;
CREATE POLICY practice_modules_read ON public.practice_modules FOR SELECT TO authenticated USING (true);
CREATE POLICY practice_modules_write ON public.practice_modules FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'platform_admin') OR public.has_role(auth.uid(),'state_admin') OR public.has_role(auth.uid(),'knowledge_contributor'))
  WITH CHECK (public.has_role(auth.uid(),'platform_admin') OR public.has_role(auth.uid(),'state_admin') OR public.has_role(auth.uid(),'knowledge_contributor'));
CREATE TRIGGER touch_practice_modules BEFORE UPDATE ON public.practice_modules FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.practice_lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid NOT NULL REFERENCES public.practice_modules(id) ON DELETE CASCADE,
  lesson_key text NOT NULL,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  do_notes text[] NOT NULL DEFAULT '{}',
  dont_notes text[] NOT NULL DEFAULT '{}',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (module_id, lesson_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.practice_lessons TO authenticated;
GRANT ALL ON public.practice_lessons TO service_role;
ALTER TABLE public.practice_lessons ENABLE ROW LEVEL SECURITY;
CREATE POLICY practice_lessons_read ON public.practice_lessons FOR SELECT TO authenticated USING (true);
CREATE POLICY practice_lessons_write ON public.practice_lessons FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'platform_admin') OR public.has_role(auth.uid(),'state_admin') OR public.has_role(auth.uid(),'knowledge_contributor'))
  WITH CHECK (public.has_role(auth.uid(),'platform_admin') OR public.has_role(auth.uid(),'state_admin') OR public.has_role(auth.uid(),'knowledge_contributor'));

CREATE TABLE public.practice_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_user_id uuid NOT NULL,
  module_id uuid NOT NULL REFERENCES public.practice_modules(id) ON DELETE CASCADE,
  lesson_key text NOT NULL,
  completed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subject_user_id, module_id, lesson_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.practice_progress TO authenticated;
GRANT ALL ON public.practice_progress TO service_role;
ALTER TABLE public.practice_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY practice_progress_read ON public.practice_progress FOR SELECT TO authenticated
  USING (subject_user_id = auth.uid() OR public.has_role(auth.uid(),'platform_admin'));
CREATE POLICY practice_progress_write ON public.practice_progress FOR ALL TO authenticated
  USING (subject_user_id = auth.uid()) WITH CHECK (subject_user_id = auth.uid());

CREATE TABLE public.input_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  generic_name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('fertilizer','bio_fertilizer','pesticide','bio_pesticide','soil_amendment')),
  category text NOT NULL CHECK (category IN ('conventional','organic')),
  nutrient_or_active text NOT NULL,
  unit text NOT NULL DEFAULT 'kg',
  cost_min_minor integer NOT NULL DEFAULT 0,
  cost_max_minor integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'INR',
  brand_names text[] NOT NULL DEFAULT '{}',
  preparation_notes text,
  is_synthetic boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.input_products TO authenticated;
GRANT ALL ON public.input_products TO service_role;
ALTER TABLE public.input_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY input_products_read ON public.input_products FOR SELECT TO authenticated USING (true);
CREATE POLICY input_products_write ON public.input_products FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'platform_admin') OR public.has_role(auth.uid(),'state_admin') OR public.has_role(auth.uid(),'knowledge_contributor'))
  WITH CHECK (public.has_role(auth.uid(),'platform_admin') OR public.has_role(auth.uid(),'state_admin') OR public.has_role(auth.uid(),'knowledge_contributor'));
CREATE TRIGGER touch_input_products BEFORE UPDATE ON public.input_products FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.nutrient_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  crop text NOT NULL,
  growth_stage text NOT NULL,
  soil_type text,
  nutrient text NOT NULL,
  product_code text NOT NULL REFERENCES public.input_products(code) ON DELETE CASCADE,
  dose_per_hectare numeric(10,2) NOT NULL,
  unit text NOT NULL DEFAULT 'kg',
  notes text,
  is_synthetic boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nutrient_recommendations TO authenticated;
GRANT ALL ON public.nutrient_recommendations TO service_role;
ALTER TABLE public.nutrient_recommendations ENABLE ROW LEVEL SECURITY;
CREATE POLICY nutrient_recs_read ON public.nutrient_recommendations FOR SELECT TO authenticated USING (true);
CREATE POLICY nutrient_recs_write ON public.nutrient_recommendations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'platform_admin') OR public.has_role(auth.uid(),'state_admin') OR public.has_role(auth.uid(),'knowledge_contributor'))
  WITH CHECK (public.has_role(auth.uid(),'platform_admin') OR public.has_role(auth.uid(),'state_admin') OR public.has_role(auth.uid(),'knowledge_contributor'));

CREATE TABLE public.infestation_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  crop text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('pest','disease','weed')),
  name text NOT NULL,
  symptoms text[] NOT NULL DEFAULT '{}',
  severity text NOT NULL DEFAULT 'moderate' CHECK (severity IN ('low','moderate','high')),
  is_synthetic boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.infestation_types TO authenticated;
GRANT ALL ON public.infestation_types TO service_role;
ALTER TABLE public.infestation_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY infestation_types_read ON public.infestation_types FOR SELECT TO authenticated USING (true);
CREATE POLICY infestation_types_write ON public.infestation_types FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'platform_admin') OR public.has_role(auth.uid(),'state_admin') OR public.has_role(auth.uid(),'knowledge_contributor'))
  WITH CHECK (public.has_role(auth.uid(),'platform_admin') OR public.has_role(auth.uid(),'state_admin') OR public.has_role(auth.uid(),'knowledge_contributor'));

CREATE TABLE public.infestation_treatments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  infestation_id uuid NOT NULL REFERENCES public.infestation_types(id) ON DELETE CASCADE,
  product_code text NOT NULL REFERENCES public.input_products(code) ON DELETE CASCADE,
  dose_per_hectare numeric(10,2) NOT NULL,
  unit text NOT NULL DEFAULT 'l',
  safety_interval_days integer NOT NULL DEFAULT 0,
  reentry_note text,
  is_organic boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.infestation_treatments TO authenticated;
GRANT ALL ON public.infestation_treatments TO service_role;
ALTER TABLE public.infestation_treatments ENABLE ROW LEVEL SECURITY;
CREATE POLICY infestation_treatments_read ON public.infestation_treatments FOR SELECT TO authenticated USING (true);
CREATE POLICY infestation_treatments_write ON public.infestation_treatments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'platform_admin') OR public.has_role(auth.uid(),'state_admin') OR public.has_role(auth.uid(),'knowledge_contributor'))
  WITH CHECK (public.has_role(auth.uid(),'platform_admin') OR public.has_role(auth.uid(),'state_admin') OR public.has_role(auth.uid(),'knowledge_contributor'));

CREATE TABLE public.soil_retention_practices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  soil_types text[] NOT NULL DEFAULT '{}',
  body text NOT NULL DEFAULT '',
  effort text NOT NULL DEFAULT 'moderate' CHECK (effort IN ('low','moderate','high')),
  expected_benefit text NOT NULL DEFAULT '',
  cost_min_minor integer NOT NULL DEFAULT 0,
  cost_max_minor integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'INR',
  sort_order integer NOT NULL DEFAULT 0,
  is_synthetic boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.soil_retention_practices TO authenticated;
GRANT ALL ON public.soil_retention_practices TO service_role;
ALTER TABLE public.soil_retention_practices ENABLE ROW LEVEL SECURITY;
CREATE POLICY soil_practices_read ON public.soil_retention_practices FOR SELECT TO authenticated USING (true);
CREATE POLICY soil_practices_write ON public.soil_retention_practices FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'platform_admin') OR public.has_role(auth.uid(),'state_admin') OR public.has_role(auth.uid(),'knowledge_contributor'))
  WITH CHECK (public.has_role(auth.uid(),'platform_admin') OR public.has_role(auth.uid(),'state_admin') OR public.has_role(auth.uid(),'knowledge_contributor'));
CREATE TRIGGER touch_soil_practices BEFORE UPDATE ON public.soil_retention_practices FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.farmer_input_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id uuid NOT NULL REFERENCES public.farm_records(id) ON DELETE CASCADE,
  subject_user_id uuid NOT NULL,
  created_by_user_id uuid NOT NULL,
  crop text NOT NULL,
  growth_stage text NOT NULL,
  mode text NOT NULL DEFAULT 'conventional' CHECK (mode IN ('conventional','organic')),
  area_hectares numeric(10,3) NOT NULL DEFAULT 1,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.farmer_input_plans TO authenticated;
GRANT ALL ON public.farmer_input_plans TO service_role;
ALTER TABLE public.farmer_input_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY farmer_input_plans_read ON public.farmer_input_plans FOR SELECT TO authenticated
  USING (public.can_read_farm(farm_id));
CREATE POLICY farmer_input_plans_insert ON public.farmer_input_plans FOR INSERT TO authenticated
  WITH CHECK (public.can_read_farm(farm_id) AND created_by_user_id = auth.uid());
CREATE POLICY farmer_input_plans_update ON public.farmer_input_plans FOR UPDATE TO authenticated
  USING (subject_user_id = auth.uid() OR created_by_user_id = auth.uid())
  WITH CHECK (subject_user_id = auth.uid() OR created_by_user_id = auth.uid());
CREATE TRIGGER touch_farmer_input_plans BEFORE UPDATE ON public.farmer_input_plans FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.content_translations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity text NOT NULL,
  entity_id uuid NOT NULL,
  locale text NOT NULL,
  field text NOT NULL,
  value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entity, entity_id, locale, field)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_translations TO authenticated;
GRANT ALL ON public.content_translations TO service_role;
ALTER TABLE public.content_translations ENABLE ROW LEVEL SECURITY;
CREATE POLICY content_translations_read ON public.content_translations FOR SELECT TO authenticated USING (true);
CREATE POLICY content_translations_write ON public.content_translations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'platform_admin') OR public.has_role(auth.uid(),'state_admin') OR public.has_role(auth.uid(),'knowledge_contributor'))
  WITH CHECK (public.has_role(auth.uid(),'platform_admin') OR public.has_role(auth.uid(),'state_admin') OR public.has_role(auth.uid(),'knowledge_contributor'));

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS preferred_locale text NOT NULL DEFAULT 'en';

CREATE INDEX idx_practice_lessons_module ON public.practice_lessons(module_id, sort_order);
CREATE INDEX idx_nutrient_recs_crop ON public.nutrient_recommendations(crop, growth_stage);
CREATE INDEX idx_infestation_crop ON public.infestation_types(crop, kind);
CREATE INDEX idx_content_translations_lookup ON public.content_translations(entity, entity_id, locale);