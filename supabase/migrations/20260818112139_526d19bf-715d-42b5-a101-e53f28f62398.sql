-- B7: state, knowledge, research & post-harvest expansion (additive)

CREATE TYPE public.knowledge_kind AS ENUM ('university','kvk','extension_centre','state_training_cell');
CREATE TYPE public.knowledge_status AS ENUM ('draft','submitted','in_review','approved','published','rejected','withdrawn');
CREATE TYPE public.research_request_status AS ENUM ('draft','submitted','ethics_review','approved','rejected','expired','revoked');
CREATE TYPE public.postharvest_kind AS ENUM ('warehouse','cold_storage','processor');
CREATE TYPE public.contract_status AS ENUM ('draft','proposed','accepted','active','completed','cancelled','disputed');

-- ---------------------------------------------------------------- state config
CREATE TABLE public.state_configurations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  geography_id uuid REFERENCES public.geographies(id),
  label text NOT NULL,
  default_locale text NOT NULL DEFAULT 'en',
  locales text[] NOT NULL DEFAULT ARRAY['en'],
  governance jsonb NOT NULL DEFAULT '{}'::jsonb,
  enabled_flags text[] NOT NULL DEFAULT ARRAY[]::text[],
  aggregation_min_cohort integer NOT NULL DEFAULT 10 CHECK (aggregation_min_cohort >= 5),
  allows_raw_farmer_access boolean NOT NULL DEFAULT false CHECK (allows_raw_farmer_access = false),
  status text NOT NULL DEFAULT 'draft',
  is_synthetic boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, geography_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.state_configurations TO authenticated;
GRANT ALL ON public.state_configurations TO service_role;
ALTER TABLE public.state_configurations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "state config readable by oversight and own tenant" ON public.state_configurations
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(),'platform_admin') OR public.has_role(auth.uid(),'auditor')
    OR public.is_tenant_member(auth.uid(), tenant_id)
  );
CREATE POLICY "state config written by platform or state admin" ON public.state_configurations
  FOR INSERT TO authenticated WITH CHECK (
    public.has_role(auth.uid(),'platform_admin')
    OR public.has_tenant_role(auth.uid(), tenant_id, 'state_admin')
  );
CREATE POLICY "state config updated by platform or state admin" ON public.state_configurations
  FOR UPDATE TO authenticated USING (
    public.has_role(auth.uid(),'platform_admin')
    OR public.has_tenant_role(auth.uid(), tenant_id, 'state_admin')
  );
CREATE TRIGGER touch_state_configurations BEFORE UPDATE ON public.state_configurations
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ------------------------------------------------------- knowledge institutions
CREATE TABLE public.knowledge_institutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  kind public.knowledge_kind NOT NULL,
  name text NOT NULL,
  contact_email text NOT NULL,
  geography_id uuid REFERENCES public.geographies(id),
  state public.service_provider_state NOT NULL DEFAULT 'draft',
  topics text[] NOT NULL DEFAULT ARRAY[]::text[],
  decision_note text,
  decided_by uuid,
  decided_at timestamptz,
  is_synthetic boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.knowledge_institutions TO authenticated;
GRANT ALL ON public.knowledge_institutions TO service_role;
ALTER TABLE public.knowledge_institutions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "institutions readable" ON public.knowledge_institutions
  FOR SELECT TO authenticated USING (
    state = 'approved'
    OR created_by = auth.uid()
    OR public.has_role(auth.uid(),'platform_admin') OR public.has_role(auth.uid(),'auditor')
    OR public.has_role(auth.uid(),'knowledge_reviewer')
    OR (tenant_id IS NOT NULL AND public.is_tenant_member(auth.uid(), tenant_id))
  );
CREATE POLICY "institutions created by self" ON public.knowledge_institutions
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "institutions updated by owner or oversight" ON public.knowledge_institutions
  FOR UPDATE TO authenticated USING (
    created_by = auth.uid()
    OR public.has_role(auth.uid(),'platform_admin')
    OR public.has_role(auth.uid(),'knowledge_reviewer')
  );
CREATE TRIGGER touch_knowledge_institutions BEFORE UPDATE ON public.knowledge_institutions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ------------------------------------------------------ knowledge contributions
CREATE TABLE public.knowledge_contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid REFERENCES public.knowledge_institutions(id) ON DELETE SET NULL,
  title text NOT NULL,
  summary text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  language text NOT NULL DEFAULT 'en',
  topic text NOT NULL DEFAULT 'general',
  status public.knowledge_status NOT NULL DEFAULT 'draft',
  is_training_content boolean NOT NULL DEFAULT false,
  ai_grounding_enabled boolean NOT NULL DEFAULT false,
  version integer NOT NULL DEFAULT 1,
  citations text[] NOT NULL DEFAULT ARRAY[]::text[],
  author_user_id uuid NOT NULL,
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_note text,
  published_at timestamptz,
  is_synthetic boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT knowledge_reviewer_separation CHECK (reviewed_by IS NULL OR reviewed_by <> author_user_id),
  CONSTRAINT knowledge_grounding_requires_approval CHECK (
    ai_grounding_enabled = false OR status IN ('approved','published')
  ),
  CONSTRAINT knowledge_publish_requires_review CHECK (
    status <> 'published' OR (reviewed_by IS NOT NULL AND published_at IS NOT NULL)
  )
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.knowledge_contributions TO authenticated;
GRANT ALL ON public.knowledge_contributions TO service_role;
ALTER TABLE public.knowledge_contributions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contributions readable" ON public.knowledge_contributions
  FOR SELECT TO authenticated USING (
    status = 'published'
    OR author_user_id = auth.uid()
    OR public.has_role(auth.uid(),'knowledge_reviewer')
    OR public.has_role(auth.uid(),'platform_admin') OR public.has_role(auth.uid(),'auditor')
  );
CREATE POLICY "contributions authored by self" ON public.knowledge_contributions
  FOR INSERT TO authenticated WITH CHECK (author_user_id = auth.uid());
CREATE POLICY "contributions updated by author or reviewer" ON public.knowledge_contributions
  FOR UPDATE TO authenticated USING (
    author_user_id = auth.uid()
    OR public.has_role(auth.uid(),'knowledge_reviewer')
    OR public.has_role(auth.uid(),'platform_admin')
  );
CREATE TRIGGER touch_knowledge_contributions BEFORE UPDATE ON public.knowledge_contributions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.knowledge_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contribution_id uuid NOT NULL REFERENCES public.knowledge_contributions(id) ON DELETE CASCADE,
  reviewer_user_id uuid NOT NULL,
  decision text NOT NULL,
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.knowledge_reviews TO authenticated;
GRANT ALL ON public.knowledge_reviews TO service_role;
ALTER TABLE public.knowledge_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reviews readable by oversight and author" ON public.knowledge_reviews
  FOR SELECT TO authenticated USING (
    reviewer_user_id = auth.uid()
    OR public.has_role(auth.uid(),'platform_admin') OR public.has_role(auth.uid(),'auditor')
    OR EXISTS (
      SELECT 1 FROM public.knowledge_contributions kc
      WHERE kc.id = contribution_id AND kc.author_user_id = auth.uid()
    )
  );
CREATE POLICY "reviews inserted by reviewer" ON public.knowledge_reviews
  FOR INSERT TO authenticated WITH CHECK (
    reviewer_user_id = auth.uid()
    AND (public.has_role(auth.uid(),'knowledge_reviewer') OR public.has_role(auth.uid(),'platform_admin'))
  );

-- ------------------------------------------------------------ research access
CREATE TABLE public.research_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  researcher_user_id uuid NOT NULL,
  institution_id uuid REFERENCES public.knowledge_institutions(id) ON DELETE SET NULL,
  title text NOT NULL,
  purpose_code text REFERENCES public.data_purposes(code),
  abstract text NOT NULL DEFAULT '',
  requested_datasets text[] NOT NULL DEFAULT ARRAY[]::text[],
  dua_reference text,
  ethics_reference text,
  aggregation_min_cohort integer NOT NULL DEFAULT 10 CHECK (aggregation_min_cohort >= 5),
  raw_row_access boolean NOT NULL DEFAULT false CHECK (raw_row_access = false),
  status public.research_request_status NOT NULL DEFAULT 'draft',
  decision_note text,
  decided_by uuid,
  decided_at timestamptz,
  expires_at timestamptz,
  is_synthetic boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.research_requests TO authenticated;
GRANT ALL ON public.research_requests TO service_role;
ALTER TABLE public.research_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "research requests readable by owner and oversight" ON public.research_requests
  FOR SELECT TO authenticated USING (
    researcher_user_id = auth.uid()
    OR public.has_role(auth.uid(),'platform_admin') OR public.has_role(auth.uid(),'auditor')
  );
CREATE POLICY "research requests created by researcher" ON public.research_requests
  FOR INSERT TO authenticated WITH CHECK (researcher_user_id = auth.uid());
CREATE POLICY "research requests updated by owner or platform admin" ON public.research_requests
  FOR UPDATE TO authenticated USING (
    researcher_user_id = auth.uid() OR public.has_role(auth.uid(),'platform_admin')
  );
CREATE TRIGGER touch_research_requests BEFORE UPDATE ON public.research_requests
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.research_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.research_requests(id) ON DELETE CASCADE,
  dataset_code text NOT NULL,
  geography_id uuid REFERENCES public.geographies(id),
  cohort_size integer NOT NULL DEFAULT 0,
  aggregation_min_applied integer NOT NULL DEFAULT 10,
  allowed boolean NOT NULL DEFAULT false,
  denial_reason text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  requested_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.research_exports TO authenticated;
GRANT ALL ON public.research_exports TO service_role;
ALTER TABLE public.research_exports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "exports readable by requester and oversight" ON public.research_exports
  FOR SELECT TO authenticated USING (
    requested_by = auth.uid()
    OR public.has_role(auth.uid(),'platform_admin') OR public.has_role(auth.uid(),'auditor')
  );
CREATE POLICY "exports inserted by requester" ON public.research_exports
  FOR INSERT TO authenticated WITH CHECK (requested_by = auth.uid());

-- -------------------------------------------------- de-identified policy metrics
CREATE TABLE public.policy_metric_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  geography_id uuid REFERENCES public.geographies(id),
  metric_code text NOT NULL,
  period text NOT NULL,
  value numeric NOT NULL DEFAULT 0,
  cohort_size integer NOT NULL DEFAULT 0,
  is_deidentified boolean NOT NULL DEFAULT true CHECK (is_deidentified = true),
  is_synthetic boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, geography_id, metric_code, period)
);
GRANT SELECT ON public.policy_metric_snapshots TO authenticated;
GRANT ALL ON public.policy_metric_snapshots TO service_role;
ALTER TABLE public.policy_metric_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "aggregate metrics readable by policy roles" ON public.policy_metric_snapshots
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(),'platform_admin') OR public.has_role(auth.uid(),'auditor')
    OR public.has_role(auth.uid(),'policymaker') OR public.has_role(auth.uid(),'researcher')
    OR (tenant_id IS NOT NULL AND public.is_tenant_member(auth.uid(), tenant_id))
  );

-- ------------------------------------------------------- post-harvest providers
CREATE TABLE public.postharvest_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  subtype_code text REFERENCES public.service_subtypes(code),
  kind public.postharvest_kind NOT NULL,
  display_name text NOT NULL,
  contact_email text NOT NULL,
  geography_id uuid REFERENCES public.geographies(id),
  service_regions text[] NOT NULL DEFAULT ARRAY[]::text[],
  state public.service_provider_state NOT NULL DEFAULT 'draft',
  decision_note text,
  decided_by uuid,
  decided_at timestamptz,
  is_synthetic boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.postharvest_providers TO authenticated;
GRANT ALL ON public.postharvest_providers TO service_role;
ALTER TABLE public.postharvest_providers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "postharvest providers readable" ON public.postharvest_providers
  FOR SELECT TO authenticated USING (
    state = 'approved'
    OR created_by = auth.uid()
    OR public.has_role(auth.uid(),'platform_admin') OR public.has_role(auth.uid(),'auditor')
    OR public.has_role(auth.uid(),'expansion_manager')
    OR (tenant_id IS NOT NULL AND public.is_tenant_member(auth.uid(), tenant_id))
  );
CREATE POLICY "postharvest providers created by self" ON public.postharvest_providers
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "postharvest providers updated by owner or oversight" ON public.postharvest_providers
  FOR UPDATE TO authenticated USING (
    created_by = auth.uid()
    OR public.has_role(auth.uid(),'platform_admin')
    OR public.has_role(auth.uid(),'expansion_manager')
  );
CREATE TRIGGER touch_postharvest_providers BEFORE UPDATE ON public.postharvest_providers
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.storage_capacity_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.postharvest_providers(id) ON DELETE CASCADE,
  commodity text NOT NULL,
  capacity_tonnes numeric NOT NULL CHECK (capacity_tonnes > 0),
  available_tonnes numeric NOT NULL DEFAULT 0 CHECK (available_tonnes >= 0),
  temperature_min_c numeric,
  temperature_max_c numeric,
  price_per_tonne_month numeric,
  currency text NOT NULL DEFAULT 'INR',
  geography_id uuid REFERENCES public.geographies(id),
  status public.listing_status NOT NULL DEFAULT 'draft',
  quality_score integer NOT NULL DEFAULT 0,
  review_note text,
  is_synthetic boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.storage_capacity_listings TO authenticated;
GRANT ALL ON public.storage_capacity_listings TO service_role;
ALTER TABLE public.storage_capacity_listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "capacity listings readable" ON public.storage_capacity_listings
  FOR SELECT TO authenticated USING (
    status = 'published'
    OR created_by = auth.uid()
    OR public.has_role(auth.uid(),'platform_admin') OR public.has_role(auth.uid(),'auditor')
    OR public.has_role(auth.uid(),'market_operator')
    OR EXISTS (
      SELECT 1 FROM public.postharvest_providers p
      WHERE p.id = provider_id
        AND (p.created_by = auth.uid()
             OR (p.tenant_id IS NOT NULL AND public.is_tenant_member(auth.uid(), p.tenant_id)))
    )
  );
CREATE POLICY "capacity listings created by provider staff" ON public.storage_capacity_listings
  FOR INSERT TO authenticated WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.postharvest_providers p
      WHERE p.id = provider_id
        AND (p.created_by = auth.uid()
             OR (p.tenant_id IS NOT NULL AND public.is_tenant_member(auth.uid(), p.tenant_id)))
    )
  );
CREATE POLICY "capacity listings updated by provider staff or operator" ON public.storage_capacity_listings
  FOR UPDATE TO authenticated USING (
    created_by = auth.uid()
    OR public.has_role(auth.uid(),'platform_admin')
    OR public.has_role(auth.uid(),'market_operator')
  );
CREATE TRIGGER touch_storage_capacity_listings BEFORE UPDATE ON public.storage_capacity_listings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.processor_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.postharvest_providers(id) ON DELETE CASCADE,
  counterparty_profile_id uuid REFERENCES public.marketplace_profiles(id) ON DELETE SET NULL,
  commodity text NOT NULL,
  quantity_tonnes numeric NOT NULL CHECK (quantity_tonnes > 0),
  price_per_tonne numeric NOT NULL CHECK (price_per_tonne >= 0),
  currency text NOT NULL DEFAULT 'INR',
  delivery_window text NOT NULL DEFAULT '',
  terms jsonb NOT NULL DEFAULT '{}'::jsonb,
  status public.contract_status NOT NULL DEFAULT 'draft',
  requires_human_decision boolean NOT NULL DEFAULT true,
  decided_by uuid,
  decided_at timestamptz,
  decision_note text,
  is_synthetic boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.processor_contracts TO authenticated;
GRANT ALL ON public.processor_contracts TO service_role;
ALTER TABLE public.processor_contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contracts readable by parties and oversight" ON public.processor_contracts
  FOR SELECT TO authenticated USING (
    created_by = auth.uid()
    OR public.has_role(auth.uid(),'platform_admin') OR public.has_role(auth.uid(),'auditor')
    OR public.has_role(auth.uid(),'market_operator')
    OR EXISTS (
      SELECT 1 FROM public.postharvest_providers p
      WHERE p.id = provider_id
        AND (p.created_by = auth.uid()
             OR (p.tenant_id IS NOT NULL AND public.is_tenant_member(auth.uid(), p.tenant_id)))
    )
    OR EXISTS (
      SELECT 1 FROM public.marketplace_profiles mp
      WHERE mp.id = counterparty_profile_id AND mp.created_by = auth.uid()
    )
  );
CREATE POLICY "contracts created by party" ON public.processor_contracts
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "contracts updated by party or oversight" ON public.processor_contracts
  FOR UPDATE TO authenticated USING (
    created_by = auth.uid()
    OR public.has_role(auth.uid(),'platform_admin')
    OR public.has_role(auth.uid(),'market_operator')
  );
CREATE TRIGGER touch_processor_contracts BEFORE UPDATE ON public.processor_contracts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ------------------------------------------------------------------ configuration
INSERT INTO public.feature_flags (key, label, description, environments, enabled)
VALUES
  ('state.tenant_configuration','State tenant configuration','State-level governance and feature configuration.', '["development","sandbox"]'::jsonb, true),
  ('knowledge.contribution','Knowledge contribution','University/KVK/extension knowledge contribution with reviewer separation.', '["development","sandbox"]'::jsonb, true),
  ('knowledge.ai_grounding','AI grounding on knowledge','Allows approved knowledge to ground assistive answers.', '["development","sandbox"]'::jsonb, false),
  ('research.aggregate_access','Research aggregate access','DUA/ethics gated aggregate-only research access.', '["development","sandbox"]'::jsonb, true),
  ('policy.aggregate_dashboard','Policymaker aggregate dashboard','De-identified aggregate dashboards for policy roles.', '["development","sandbox"]'::jsonb, true),
  ('service.warehouse_storage','Warehouse storage onboarding','Warehouse capacity onboarding and listings.', '["development","sandbox"]'::jsonb, false),
  ('service.cold_storage','Cold storage onboarding','Cold-chain capacity onboarding and listings.', '["development","sandbox"]'::jsonb, false),
  ('service.processor_sourcing','Processor sourcing contracts','Processor sourcing/contract workflow.', '["development","sandbox"]'::jsonb, false)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.role_definitions (code, label, description, journey_kind, feature_flag_key, is_public_selectable, authority_note, sort_order)
VALUES
  ('state_admin','State administrator','Configures state-level governance and features.','government','state.tenant_configuration', false,'Configures state-level governance and features for its own tenant only. Confers no farmer-data access.', 60),
  ('knowledge_contributor','Knowledge contributor (University/KVK)','Submits knowledge and training content.','knowledge','knowledge.contribution', false,'Cannot approve, publish or ground AI on its own content.', 61),
  ('knowledge_reviewer','Knowledge reviewer','Reviews knowledge authored by others.','knowledge','knowledge.contribution', false,'Separation of duties enforced in schema: cannot review own authorship.', 62),
  ('researcher','Researcher / academic','Requests aggregate research access.','research','research.aggregate_access', false,'Aggregate, de-identified access only under an approved DUA and ethics reference.', 63),
  ('policymaker','Policymaker','Reads de-identified aggregates.','research','policy.aggregate_dashboard', false,'No raw farmer records by default.', 64),
  ('postharvest_provider_admin','Post-harvest provider admin','Manages storage capacity or sourcing contracts.','service_provider','service.warehouse_storage', false,'Scoped to an approved post-harvest provider; no farmer-data authority.', 65)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.data_purposes (code, label, description)
VALUES
  ('research_aggregate','Research (aggregate)','Aggregate, de-identified research analysis under an approved DUA.'),
  ('policy_aggregate','Policy (aggregate)','Aggregate, de-identified policy monitoring.')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.service_subtypes (code, label, domain, description, feature_flag_key, evidence_gate, evidence_note, verification_checks, dispute_categories, requires_human_decision, is_active, sort_order)
VALUES
  ('warehouse_storage','Warehouse storage','logistics','Dry warehouse capacity for produce storage.','service.warehouse_storage','evidence_pending','Awaiting district pilot storage-utilisation evidence.',
   '[{"code":"entity_proof","label":"Entity registration proof"},{"code":"warehouse_licence","label":"Warehouse licence"},{"code":"weighbridge_calibration","label":"Weighbridge calibration"}]'::jsonb,
   '["capacity_not_available","quantity_shortfall","billing_dispute"]'::jsonb, true, false, 40),
  ('cold_storage','Cold storage','logistics','Temperature-controlled storage capacity.','service.cold_storage','evidence_pending','Awaiting cold-chain spoilage baseline evidence.',
   '[{"code":"entity_proof","label":"Entity registration proof"},{"code":"cold_chain_certificate","label":"Cold-chain certificate"},{"code":"temperature_log_capability","label":"Temperature logging capability"}]'::jsonb,
   '["temperature_excursion","spoilage_claim","billing_dispute"]'::jsonb, true, false, 41),
  ('processor_sourcing','Processor sourcing','logistics','Processor sourcing and contract workflow.','service.processor_sourcing','evidence_pending','Awaiting approved contract-dispute playbook.',
   '[{"code":"entity_proof","label":"Entity registration proof"},{"code":"processing_licence","label":"Processing licence"},{"code":"payment_track_record","label":"Payment track record"}]'::jsonb,
   '["contract_breach","quality_rejection","payment_delay"]'::jsonb, true, false, 42)
ON CONFLICT (code) DO NOTHING;