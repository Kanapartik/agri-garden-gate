-- Slice I1: insurer revenue intelligence (sales) ------------------------------

CREATE TYPE public.insurer_funnel_stage AS ENUM (
  'lead','contacted','interested','documents_initiated','verified',
  'quote_generated','premium_pending','enrolled','dropped'
);

CREATE TYPE public.insurer_campaign_state AS ENUM (
  'draft','active','paused','completed','cancelled'
);

/* ---------------------------------------------------- market cells (ref) */

CREATE TABLE public.insurer_market_cells (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  state_name text NOT NULL,
  district text NOT NULL,
  crop text NOT NULL,
  potential_farmers integer NOT NULL DEFAULT 0,
  cultivated_acres numeric NOT NULL DEFAULT 0,
  insured_farmers integer NOT NULL DEFAULT 0,
  insured_acres numeric NOT NULL DEFAULT 0,
  premium_per_acre numeric NOT NULL DEFAULT 0,
  source text NOT NULL DEFAULT 'synthetic_baseline',
  last_verified date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (state_name, district, crop)
);

GRANT SELECT ON public.insurer_market_cells TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.insurer_market_cells TO authenticated;
GRANT ALL ON public.insurer_market_cells TO service_role;
ALTER TABLE public.insurer_market_cells ENABLE ROW LEVEL SECURITY;

CREATE POLICY "market cells readable by signed-in users"
  ON public.insurer_market_cells FOR SELECT TO authenticated USING (true);
CREATE POLICY "market cells managed by platform admin"
  ON public.insurer_market_cells FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'platform_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'platform_admin'));

CREATE TRIGGER touch_insurer_market_cells BEFORE UPDATE ON public.insurer_market_cells
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

/* ------------------------------------------------------- fpo channel */

CREATE TABLE public.insurer_fpo_channel (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  insurer_tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  registry_id uuid REFERENCES public.fpo_registry(id) ON DELETE SET NULL,
  registration_number text NOT NULL,
  fpo_name text NOT NULL,
  state_name text NOT NULL,
  district text,
  block_mandal text,
  commodity_group text,
  primary_commodity text,
  member_count integer,
  cultivated_acres numeric,
  insured_members integer NOT NULL DEFAULT 0,
  policies_count integer NOT NULL DEFAULT 0,
  premium_inr numeric NOT NULL DEFAULT 0,
  potential_premium_inr numeric NOT NULL DEFAULT 0,
  accessibility text,
  owner_name text,
  opportunity_score integer NOT NULL DEFAULT 0,
  score_drivers jsonb NOT NULL DEFAULT '[]'::jsonb,
  internal_notes text,
  last_reviewed date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (insurer_tenant_id, registration_number)
);

CREATE INDEX insurer_fpo_channel_tenant_idx ON public.insurer_fpo_channel (insurer_tenant_id);
CREATE INDEX insurer_fpo_channel_reg_idx ON public.insurer_fpo_channel (registration_number);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.insurer_fpo_channel TO authenticated;
GRANT ALL ON public.insurer_fpo_channel TO service_role;
ALTER TABLE public.insurer_fpo_channel ENABLE ROW LEVEL SECURITY;

-- Insurer staff read their own tenant rows; platform admin / auditor read all;
-- FPO members read only rows that point at their own FPO registration.
CREATE POLICY "channel readable by insurer, oversight or own fpo"
  ON public.insurer_fpo_channel FOR SELECT TO authenticated
  USING (
    public.is_tenant_member(auth.uid(), insurer_tenant_id)
    OR public.has_role(auth.uid(), 'platform_admin')
    OR public.has_role(auth.uid(), 'auditor')
    OR registration_number IN (
      SELECT p.registration_number FROM public.fpo_profiles p
      WHERE public.is_tenant_member(auth.uid(), p.tenant_id)
      UNION SELECT p.cin FROM public.fpo_profiles p
      WHERE public.is_tenant_member(auth.uid(), p.tenant_id)
    )
  );

CREATE POLICY "channel managed by insurer admin"
  ON public.insurer_fpo_channel FOR ALL TO authenticated
  USING (
    public.has_tenant_role(auth.uid(), insurer_tenant_id, 'tenant_admin')
    OR public.has_role(auth.uid(), 'platform_admin')
  )
  WITH CHECK (
    public.has_tenant_role(auth.uid(), insurer_tenant_id, 'tenant_admin')
    OR public.has_role(auth.uid(), 'platform_admin')
  );

CREATE TRIGGER touch_insurer_fpo_channel BEFORE UPDATE ON public.insurer_fpo_channel
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

/* ------------------------------------------------------ funnel entries */

CREATE TABLE public.insurer_funnel_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  insurer_tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  registry_id uuid REFERENCES public.fpo_registry(id) ON DELETE SET NULL,
  registration_number text NOT NULL,
  fpo_name text NOT NULL,
  state_name text NOT NULL,
  district text,
  stage public.insurer_funnel_stage NOT NULL DEFAULT 'lead',
  farmer_count integer NOT NULL DEFAULT 0,
  acres numeric NOT NULL DEFAULT 0,
  premium_opportunity_inr numeric NOT NULL DEFAULT 0,
  owner_name text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (insurer_tenant_id, registration_number)
);

CREATE INDEX insurer_funnel_tenant_idx ON public.insurer_funnel_entries (insurer_tenant_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.insurer_funnel_entries TO authenticated;
GRANT ALL ON public.insurer_funnel_entries TO service_role;
ALTER TABLE public.insurer_funnel_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "funnel readable by insurer, oversight or own fpo"
  ON public.insurer_funnel_entries FOR SELECT TO authenticated
  USING (
    public.is_tenant_member(auth.uid(), insurer_tenant_id)
    OR public.has_role(auth.uid(), 'platform_admin')
    OR public.has_role(auth.uid(), 'auditor')
    OR registration_number IN (
      SELECT p.registration_number FROM public.fpo_profiles p
      WHERE public.is_tenant_member(auth.uid(), p.tenant_id)
      UNION SELECT p.cin FROM public.fpo_profiles p
      WHERE public.is_tenant_member(auth.uid(), p.tenant_id)
    )
  );

CREATE POLICY "funnel managed by insurer admin"
  ON public.insurer_funnel_entries FOR ALL TO authenticated
  USING (
    public.has_tenant_role(auth.uid(), insurer_tenant_id, 'tenant_admin')
    OR public.has_role(auth.uid(), 'platform_admin')
  )
  WITH CHECK (
    public.has_tenant_role(auth.uid(), insurer_tenant_id, 'tenant_admin')
    OR public.has_role(auth.uid(), 'platform_admin')
  );

CREATE TRIGGER touch_insurer_funnel_entries BEFORE UPDATE ON public.insurer_funnel_entries
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

/* ---------------------------------------------------------- campaigns */

CREATE TABLE public.insurer_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  insurer_tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  season text,
  state_name text,
  district text,
  commodity text,
  target_farmers integer NOT NULL DEFAULT 0,
  target_acres numeric NOT NULL DEFAULT 0,
  premium_opportunity_inr numeric NOT NULL DEFAULT 0,
  owner_name text,
  state public.insurer_campaign_state NOT NULL DEFAULT 'draft',
  starts_on date,
  ends_on date,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX insurer_campaigns_tenant_idx ON public.insurer_campaigns (insurer_tenant_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.insurer_campaigns TO authenticated;
GRANT ALL ON public.insurer_campaigns TO service_role;
ALTER TABLE public.insurer_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "campaigns readable by insurer or oversight"
  ON public.insurer_campaigns FOR SELECT TO authenticated
  USING (
    public.is_tenant_member(auth.uid(), insurer_tenant_id)
    OR public.has_role(auth.uid(), 'platform_admin')
    OR public.has_role(auth.uid(), 'auditor')
  );

CREATE POLICY "campaigns managed by insurer admin"
  ON public.insurer_campaigns FOR ALL TO authenticated
  USING (
    public.has_tenant_role(auth.uid(), insurer_tenant_id, 'tenant_admin')
    OR public.has_role(auth.uid(), 'platform_admin')
  )
  WITH CHECK (
    public.has_tenant_role(auth.uid(), insurer_tenant_id, 'tenant_admin')
    OR public.has_role(auth.uid(), 'platform_admin')
  );

CREATE TRIGGER touch_insurer_campaigns BEFORE UPDATE ON public.insurer_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.insurer_campaign_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.insurer_campaigns(id) ON DELETE CASCADE,
  registry_id uuid REFERENCES public.fpo_registry(id) ON DELETE SET NULL,
  registration_number text NOT NULL,
  fpo_name text NOT NULL,
  target_farmers integer NOT NULL DEFAULT 0,
  premium_opportunity_inr numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, registration_number)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.insurer_campaign_targets TO authenticated;
GRANT ALL ON public.insurer_campaign_targets TO service_role;
ALTER TABLE public.insurer_campaign_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "campaign targets follow campaign read"
  ON public.insurer_campaign_targets FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.insurer_campaigns c
    WHERE c.id = campaign_id
      AND (
        public.is_tenant_member(auth.uid(), c.insurer_tenant_id)
        OR public.has_role(auth.uid(), 'platform_admin')
        OR public.has_role(auth.uid(), 'auditor')
      )
  ));

CREATE POLICY "campaign targets managed by insurer admin"
  ON public.insurer_campaign_targets FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.insurer_campaigns c
    WHERE c.id = campaign_id
      AND (
        public.has_tenant_role(auth.uid(), c.insurer_tenant_id, 'tenant_admin')
        OR public.has_role(auth.uid(), 'platform_admin')
      )
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.insurer_campaigns c
    WHERE c.id = campaign_id
      AND (
        public.has_tenant_role(auth.uid(), c.insurer_tenant_id, 'tenant_admin')
        OR public.has_role(auth.uid(), 'platform_admin')
      )
  ));

CREATE TRIGGER touch_insurer_campaign_targets BEFORE UPDATE ON public.insurer_campaign_targets
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

/* --------------------------------------------------- synthetic seeding */

-- Deterministic pseudo-random helper values from md5 so the synthetic baseline
-- is stable across environments. [VALIDATE] replace with official statistics.
INSERT INTO public.insurer_market_cells
  (state_name, district, crop, potential_farmers, cultivated_acres,
   insured_farmers, insured_acres, premium_per_acre, source, last_verified)
SELECT d.state_name,
       d.district,
       c.crop,
       (8000 + (('x' || substr(md5(d.district || c.crop || 'pf'), 1, 8))::bit(32)::bigint % 46000))::int,
       (12000 + (('x' || substr(md5(d.district || c.crop || 'ca'), 1, 8))::bit(32)::bigint % 68000))::numeric,
       0, 0,
       c.premium_per_acre,
       'synthetic_baseline',
       DATE '2026-08-28'
FROM (SELECT DISTINCT state_name, district FROM public.fpo_registry WHERE district IS NOT NULL) d
CROSS JOIN (VALUES
  ('Paddy', 1450), ('Cotton', 2100), ('Chilli', 2800),
  ('Maize', 1250), ('Turmeric', 2600), ('Groundnut', 1600)
) AS c(crop, premium_per_acre);

UPDATE public.insurer_market_cells
SET insured_farmers = (potential_farmers * (18 + (('x' || substr(md5(district || crop || 'pen'), 1, 8))::bit(32)::bigint % 45)) / 100)::int,
    insured_acres = ROUND(cultivated_acres * (18 + (('x' || substr(md5(district || crop || 'pen'), 1, 8))::bit(32)::bigint % 45)) / 100.0, 0);

-- One channel row per insurer tenant x registry FPO.
INSERT INTO public.insurer_fpo_channel
  (insurer_tenant_id, registry_id, registration_number, fpo_name, state_name, district,
   block_mandal, commodity_group, primary_commodity, member_count, cultivated_acres,
   insured_members, policies_count, premium_inr, potential_premium_inr, accessibility,
   owner_name, opportunity_score, score_drivers, last_reviewed)
SELECT t.id,
       r.id,
       r.registration_number,
       r.fpo_name,
       r.state_name,
       r.district,
       r.block_mandal,
       op.commodity_group,
       op.primary_commodity,
       COALESCE(op.member_count, (300 + (('x' || substr(md5(r.registration_number || 'mc'), 1, 8))::bit(32)::bigint % 1200))::int),
       (400 + (('x' || substr(md5(r.registration_number || 'ac'), 1, 8))::bit(32)::bigint % 2600))::numeric,
       0, 0, 0, 0,
       (ARRAY['easy','moderate','remote'])[1 + (('x' || substr(md5(r.registration_number || 'ax'), 1, 8))::bit(32)::bigint % 3)],
       NULL,
       0,
       '[]'::jsonb,
       DATE '2026-08-28'
FROM public.tenants t
CROSS JOIN public.fpo_registry r
LEFT JOIN public.fpo_opportunity_profiles op ON op.registration_number = r.registration_number
WHERE t.tenant_type = 'insurer';

UPDATE public.insurer_fpo_channel
SET insured_members = (member_count * (('x' || substr(md5(registration_number || 'ins'), 1, 8))::bit(32)::bigint % 55) / 100)::int
WHERE member_count IS NOT NULL;

UPDATE public.insurer_fpo_channel
SET policies_count = insured_members,
    premium_inr = ROUND(insured_members * (900 + (('x' || substr(md5(registration_number || 'pr'), 1, 8))::bit(32)::bigint % 900))::numeric, 0),
    potential_premium_inr = ROUND(GREATEST(COALESCE(member_count, 0) - insured_members, 0)
      * (900 + (('x' || substr(md5(registration_number || 'pr'), 1, 8))::bit(32)::bigint % 900))::numeric, 0);

-- Starter pipeline: every FPO enters as an unworked lead.
INSERT INTO public.insurer_funnel_entries
  (insurer_tenant_id, registry_id, registration_number, fpo_name, state_name, district,
   stage, farmer_count, acres, premium_opportunity_inr)
SELECT ch.insurer_tenant_id, ch.registry_id, ch.registration_number, ch.fpo_name,
       ch.state_name, ch.district, 'lead',
       GREATEST(COALESCE(ch.member_count, 0) - ch.insured_members, 0),
       COALESCE(ch.cultivated_acres, 0),
       ch.potential_premium_inr
FROM public.insurer_fpo_channel ch;
