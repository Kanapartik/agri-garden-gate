-- ============ Phase 3: FPO opportunities & scheme intelligence ============

CREATE TYPE public.fpo_opportunity_category AS ENUM (
  'scheme','input_procurement','collective_sale','credit','insurance','training',
  'infrastructure','processing','storage','equipment','export','certification','market_linkage'
);

CREATE TYPE public.fpo_opportunity_track_status AS ENUM (
  'new','reviewing','shortlisted','applied','not_relevant','closed'
);

CREATE TYPE public.fpo_eligibility_bucket AS ENUM (
  'likely_eligible','needs_verification','not_eligible','applied','approved','rejected','benefit_received','closed'
);

-- catalogue: tenant_id NULL = shared platform catalogue
CREATE TABLE public.fpo_opportunities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  category public.fpo_opportunity_category NOT NULL,
  title TEXT NOT NULL,
  provider_name TEXT NOT NULL,
  benefit_summary TEXT NOT NULL,
  eligibility_summary TEXT NOT NULL,
  required_documents TEXT[] NOT NULL DEFAULT '{}',
  commodities TEXT[] NOT NULL DEFAULT '{}',
  state_code TEXT,
  district_code TEXT,
  geography_note TEXT,
  application_deadline DATE,
  source_name TEXT NOT NULL DEFAULT 'synthetic_catalogue',
  source_url TEXT,
  last_verified_at TIMESTAMPTZ,
  scheme_id UUID REFERENCES public.schemes(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_synthetic BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fpo_opportunities TO authenticated;
GRANT ALL ON public.fpo_opportunities TO service_role;
ALTER TABLE public.fpo_opportunities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Shared catalogue readable by signed-in users"
ON public.fpo_opportunities FOR SELECT TO authenticated
USING (tenant_id IS NULL OR public.is_tenant_member(auth.uid(), tenant_id));

CREATE POLICY "FPO admins manage their own catalogue entries"
ON public.fpo_opportunities FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'platform_admin')
  OR (tenant_id IS NOT NULL AND public.has_tenant_role(auth.uid(), tenant_id, 'tenant_admin'))
)
WITH CHECK (
  public.has_role(auth.uid(), 'platform_admin')
  OR (tenant_id IS NOT NULL AND public.has_tenant_role(auth.uid(), tenant_id, 'tenant_admin'))
);

CREATE INDEX idx_fpo_opportunities_tenant ON public.fpo_opportunities(tenant_id);
CREATE INDEX idx_fpo_opportunities_category ON public.fpo_opportunities(category);
CREATE INDEX idx_fpo_opportunities_state ON public.fpo_opportunities(state_code, district_code);

-- per-FPO tracking of an opportunity
CREATE TABLE public.fpo_opportunity_tracking (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  opportunity_id UUID NOT NULL REFERENCES public.fpo_opportunities(id) ON DELETE CASCADE,
  status public.fpo_opportunity_track_status NOT NULL DEFAULT 'new',
  owner_user_id UUID,
  note TEXT,
  is_synthetic BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, opportunity_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fpo_opportunity_tracking TO authenticated;
GRANT ALL ON public.fpo_opportunity_tracking TO service_role;
ALTER TABLE public.fpo_opportunity_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "FPO members read their opportunity tracking"
ON public.fpo_opportunity_tracking FOR SELECT TO authenticated
USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'platform_admin'));

CREATE POLICY "FPO admins manage opportunity tracking"
ON public.fpo_opportunity_tracking FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'platform_admin') OR public.has_tenant_role(auth.uid(), tenant_id, 'tenant_admin'))
WITH CHECK (public.has_role(auth.uid(), 'platform_admin') OR public.has_tenant_role(auth.uid(), tenant_id, 'tenant_admin'));

CREATE INDEX idx_fpo_opp_tracking_tenant ON public.fpo_opportunity_tracking(tenant_id, status);

-- advisory scheme eligibility assessments per FPO
CREATE TABLE public.fpo_scheme_eligibility (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  scheme_id UUID NOT NULL REFERENCES public.schemes(id) ON DELETE CASCADE,
  bucket public.fpo_eligibility_bucket NOT NULL DEFAULT 'needs_verification',
  reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
  missing_information TEXT[] NOT NULL DEFAULT '{}',
  advisory_note TEXT,
  source_name TEXT NOT NULL DEFAULT 'synthetic_rule_engine',
  assessed_by UUID,
  assessed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_synthetic BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, scheme_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fpo_scheme_eligibility TO authenticated;
GRANT ALL ON public.fpo_scheme_eligibility TO service_role;
ALTER TABLE public.fpo_scheme_eligibility ENABLE ROW LEVEL SECURITY;

CREATE POLICY "FPO members read their scheme eligibility"
ON public.fpo_scheme_eligibility FOR SELECT TO authenticated
USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'platform_admin'));

CREATE POLICY "FPO admins manage scheme eligibility"
ON public.fpo_scheme_eligibility FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'platform_admin') OR public.has_tenant_role(auth.uid(), tenant_id, 'tenant_admin'))
WITH CHECK (public.has_role(auth.uid(), 'platform_admin') OR public.has_tenant_role(auth.uid(), tenant_id, 'tenant_admin'));

CREATE INDEX idx_fpo_scheme_elig_tenant ON public.fpo_scheme_eligibility(tenant_id, bucket);

CREATE TRIGGER trg_fpo_opportunities_updated_at BEFORE UPDATE ON public.fpo_opportunities
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_fpo_opp_tracking_updated_at BEFORE UPDATE ON public.fpo_opportunity_tracking
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_fpo_scheme_elig_updated_at BEFORE UPDATE ON public.fpo_scheme_eligibility
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ---------------------------------------------- synthetic demo catalogue
INSERT INTO public.fpo_opportunities
  (category, title, provider_name, benefit_summary, eligibility_summary, required_documents,
   commodities, state_code, district_code, geography_note, application_deadline,
   source_name, last_verified_at, is_synthetic)
VALUES
 ('scheme','FPO Working Capital Support (synthetic)','NABARD (synthetic)','Interest subvention on working capital up to Rs 25 lakh for aggregation cycles.','Registered FPO with audited accounts for at least one full year and 100+ active members.',
  ARRAY['Registration certificate','Audited financials','Board resolution','Bank statement'],
  ARRAY['paddy','chilli','maize'],'TG',NULL,'Telangana districts',CURRENT_DATE + 45,'synthetic_catalogue',now(),true),
 ('infrastructure','Custom Hiring Centre Grant (synthetic)','State Agriculture Department (synthetic)','Up to 40% capital subsidy for farm machinery hiring centre.','FPO with own or leased premises and 200+ members in the mandal.',
  ARRAY['Registration certificate','Land lease deed','Machinery quotation','Board resolution'],
  ARRAY['paddy','cotton'],'TG','KARIMNAGAR','Karimnagar district',CURRENT_DATE + 30,'synthetic_catalogue',now(),true),
 ('storage','Post-Harvest Storage Assistance (synthetic)','State Horticulture Mission (synthetic)','Subsidy for cold storage / dry warehouse of 500 MT capacity.','Horticulture / spice focused FPO with verified produce aggregation history.',
  ARRAY['Registration certificate','Site plan','Aggregation records'],
  ARRAY['chilli','turmeric'],'AP','GUNTUR','Guntur district',CURRENT_DATE + 60,'synthetic_catalogue',now(),true),
 ('market_linkage','Chilli Export Buyer Linkage (synthetic)','APEDA-registered exporter pool (synthetic)','Assured offtake for graded chilli lots with quality premium.','FPO able to aggregate 50 MT graded lots with traceability records.',
  ARRAY['Produce grading report','Member list','Traceability sheet'],
  ARRAY['chilli'],'AP','GUNTUR','Guntur & Prakasam',CURRENT_DATE + 20,'synthetic_catalogue',now(),true),
 ('input_procurement','Bulk Fertiliser Procurement Window (synthetic)','Registered input suppliers (synthetic)','Volume discount of 6-9% on bulk urea, DAP and micronutrients.','FPO with pooled member demand of at least 200 MT and valid dealer tie-up.',
  ARRAY['Member demand sheet','GST certificate','Board resolution'],
  ARRAY['paddy','maize','chilli'],NULL,NULL,'Andhra Pradesh & Telangana',CURRENT_DATE + 15,'synthetic_catalogue',now(),true),
 ('credit','FPO Term Loan Facility (synthetic)','Partner bank pool (synthetic)','Term loan up to Rs 50 lakh for aggregation infrastructure.','Two years of audited accounts and no default history.',
  ARRAY['Audited financials','KYC of signatories','Project report'],
  ARRAY['paddy','chilli','cotton'],NULL,NULL,'All districts',CURRENT_DATE + 75,'synthetic_catalogue',now(),true),
 ('insurance','Crop Insurance Group Enrolment (synthetic)','Partner insurer pool (synthetic)','Facilitated group enrolment of members with premium remittance support.','FPO with recorded member authorization for scheme facilitation.',
  ARRAY['Member consent records','Membership register'],
  ARRAY['paddy','maize'],NULL,NULL,'All districts',CURRENT_DATE + 25,'synthetic_catalogue',now(),true),
 ('training','FPO Board Governance Training (synthetic)','State Rural Livelihoods Mission (synthetic)','Fully funded 3-day governance and compliance training for board members.','Active FPO with constituted board.',
  ARRAY['Board member list'],
  ARRAY[]::TEXT[],NULL,NULL,'Andhra Pradesh & Telangana',CURRENT_DATE + 12,'synthetic_catalogue',now(),true),
 ('certification','Organic Cluster Certification Support (synthetic)','Regional certification agency (synthetic)','Group certification cost sharing for organic clusters.','Minimum 50 members practising organic methods for two seasons.',
  ARRAY['Field records','Input purchase records','Member list'],
  ARRAY['paddy','turmeric'],NULL,NULL,'Andhra Pradesh & Telangana',CURRENT_DATE + 90,'synthetic_catalogue',now(),true),
 ('processing','Primary Processing Unit Support (synthetic)','State Food Processing Cell (synthetic)','Capital support for grading, drying and packing line.','FPO with produce aggregation of at least 300 MT in the previous year.',
  ARRAY['Registration certificate','Machinery quotation','Aggregation records'],
  ARRAY['chilli','paddy'],NULL,NULL,'Andhra Pradesh & Telangana',CURRENT_DATE + 50,'synthetic_catalogue',now(),true),
 ('equipment','Drone Spraying Service Pilot (synthetic)','Agritech service partners (synthetic)','Subsidised drone spraying rounds for member fields.','FPO with contiguous member clusters of 100+ acres.',
  ARRAY['Cluster map','Member list'],
  ARRAY['paddy','cotton','chilli'],NULL,NULL,'Andhra Pradesh & Telangana',CURRENT_DATE + 18,'synthetic_catalogue',now(),true),
 ('collective_sale','Kharif Paddy Collective Sale Window (synthetic)','Registered buyers pool (synthetic)','Better-than-mandi realisation for aggregated graded paddy.','Aggregation of 100 MT with moisture within buyer specification.',
  ARRAY['Lot grading sheet','Member delivery records'],
  ARRAY['paddy'],'TG','KARIMNAGAR','Karimnagar district',CURRENT_DATE + 22,'synthetic_catalogue',now(),true),
 ('export','Turmeric Export Consignment Pool (synthetic)','Exporter consortium (synthetic)','Participation in pooled export consignment with quality premium.','Curcumin-tested lots with residue compliance.',
  ARRAY['Lab test report','Traceability sheet'],
  ARRAY['turmeric'],'TG',NULL,'Telangana districts',CURRENT_DATE + 40,'synthetic_catalogue',now(),true);

-- advisory eligibility assessments for the two demo FPO tenants
INSERT INTO public.fpo_scheme_eligibility
  (tenant_id, scheme_id, bucket, reasons, missing_information, advisory_note, source_name, is_synthetic)
SELECT t.id, s.id,
  CASE (row_number() OVER (PARTITION BY t.id ORDER BY s.code)) % 3
    WHEN 0 THEN 'likely_eligible'::public.fpo_eligibility_bucket
    WHEN 1 THEN 'needs_verification'::public.fpo_eligibility_bucket
    ELSE 'applied'::public.fpo_eligibility_bucket END,
  jsonb_build_array(
    'FPO is registered and active in ' || COALESCE(p.district_code,'the district') || '.',
    'Primary commodities recorded for this FPO overlap the scheme focus.',
    'Active member base is above the indicative minimum for this scheme.'
  ),
  ARRAY['Latest audited financial statement','Board resolution for this application'],
  'Advisory only. A government or partner officer verifies eligibility before any benefit decision.',
  'synthetic_rule_engine', true
FROM public.tenants t
JOIN public.fpo_profiles p ON p.tenant_id = t.id
CROSS JOIN public.schemes s
WHERE s.status = 'published'
ON CONFLICT (tenant_id, scheme_id) DO NOTHING;

-- opportunity tracking demo rows
INSERT INTO public.fpo_opportunity_tracking (tenant_id, opportunity_id, status, note, is_synthetic)
SELECT p.tenant_id, o.id,
  CASE (row_number() OVER (PARTITION BY p.tenant_id ORDER BY o.title)) % 4
    WHEN 0 THEN 'shortlisted'::public.fpo_opportunity_track_status
    WHEN 1 THEN 'reviewing'::public.fpo_opportunity_track_status
    WHEN 2 THEN 'applied'::public.fpo_opportunity_track_status
    ELSE 'new'::public.fpo_opportunity_track_status END,
  'Synthetic demo tracking entry.', true
FROM public.fpo_profiles p
CROSS JOIN public.fpo_opportunities o
WHERE o.tenant_id IS NULL
ON CONFLICT (tenant_id, opportunity_id) DO NOTHING;