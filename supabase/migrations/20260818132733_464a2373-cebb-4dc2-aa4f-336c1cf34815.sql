CREATE TYPE public.talent_visibility AS ENUM ('hidden', 'platform_only', 'employers_optin');
CREATE TYPE public.talent_entity_state AS ENUM ('draft', 'submitted', 'in_review', 'approved', 'rejected', 'suspended');
CREATE TYPE public.talent_employer_kind AS ENUM ('employer', 'recruiter', 'government_exchange');
CREATE TYPE public.job_listing_status AS ENUM ('draft', 'open', 'closed', 'filled', 'withdrawn');
CREATE TYPE public.enrollment_status AS ENUM ('enrolled', 'in_progress', 'completed', 'dropped', 'cancelled');
CREATE TYPE public.certification_verification AS ENUM ('pending', 'verified', 'failed', 'revoked');
CREATE TYPE public.referral_status AS ENUM ('proposed', 'candidate_consent_pending', 'shared', 'declined_by_candidate', 'withdrawn', 'closed');

-- 1. Evidence gate ---------------------------------------------------------
CREATE TABLE public.talent_evidence_gates (
  code TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  status public.gate_status NOT NULL DEFAULT 'pending',
  demand_validated BOOLEAN NOT NULL DEFAULT false,
  policy_validated BOOLEAN NOT NULL DEFAULT false,
  commercial_validated BOOLEAN NOT NULL DEFAULT false,
  notes TEXT NOT NULL DEFAULT '',
  decided_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.talent_evidence_gates TO authenticated;
GRANT ALL ON public.talent_evidence_gates TO service_role;
ALTER TABLE public.talent_evidence_gates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gate readable by authenticated" ON public.talent_evidence_gates
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "gate decided by platform admin" ON public.talent_evidence_gates
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'platform_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'platform_admin'));
CREATE TRIGGER touch_talent_gates BEFORE UPDATE ON public.talent_evidence_gates
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.talent_evidence_gates (code, label, notes)
VALUES ('D-16', 'Talent & skills domain activation (demand, policy, commercial model)',
        'Leadership must validate demand, policy and commercial model before any talent feature is usable.');

-- 2. Candidate profiles ---------------------------------------------------
CREATE TABLE public.talent_candidate_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  headline TEXT NOT NULL DEFAULT '',
  skills TEXT[] NOT NULL DEFAULT '{}',
  qualifications JSONB NOT NULL DEFAULT '[]'::jsonb,
  district_geo_id UUID REFERENCES public.geographies(id) ON DELETE SET NULL,
  visibility public.talent_visibility NOT NULL DEFAULT 'hidden',
  visibility_consent_at TIMESTAMPTZ,
  seeking BOOLEAN NOT NULL DEFAULT true,
  is_synthetic BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.talent_candidate_profiles TO authenticated;
GRANT ALL ON public.talent_candidate_profiles TO service_role;
ALTER TABLE public.talent_candidate_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "candidate reads own profile" ON public.talent_candidate_profiles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'platform_admin') OR public.has_role(auth.uid(), 'auditor'));
CREATE POLICY "candidate writes own profile" ON public.talent_candidate_profiles
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "candidate updates own profile" ON public.talent_candidate_profiles
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER touch_talent_candidates BEFORE UPDATE ON public.talent_candidate_profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 3. Training partners & catalog -----------------------------------------
CREATE TABLE public.talent_training_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  accreditation_ref TEXT NOT NULL DEFAULT '',
  certification_issuer_name TEXT NOT NULL,
  state public.talent_entity_state NOT NULL DEFAULT 'draft',
  decision_note TEXT NOT NULL DEFAULT '',
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.talent_training_partners TO authenticated;
GRANT ALL ON public.talent_training_partners TO service_role;
ALTER TABLE public.talent_training_partners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "training partners readable" ON public.talent_training_partners
  FOR SELECT TO authenticated
  USING (state = 'approved' OR created_by = auth.uid()
         OR public.has_role(auth.uid(), 'platform_admin') OR public.has_role(auth.uid(), 'auditor')
         OR public.has_role(auth.uid(), 'talent_operator'));
CREATE POLICY "training partner staff inserts" ON public.talent_training_partners
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "training partner staff updates" ON public.talent_training_partners
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'platform_admin') OR public.has_role(auth.uid(), 'talent_operator'))
  WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(), 'platform_admin') OR public.has_role(auth.uid(), 'talent_operator'));
CREATE TRIGGER touch_talent_partners BEFORE UPDATE ON public.talent_training_partners
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.talent_courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES public.talent_training_partners(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  skills TEXT[] NOT NULL DEFAULT '{}',
  hours INTEGER NOT NULL DEFAULT 0,
  fee_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'INR',
  certification_issuer_name TEXT NOT NULL,
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (partner_id, code)
);
GRANT SELECT, INSERT, UPDATE ON public.talent_courses TO authenticated;
GRANT ALL ON public.talent_courses TO service_role;
ALTER TABLE public.talent_courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "courses readable" ON public.talent_courses
  FOR SELECT TO authenticated
  USING (is_published OR created_by = auth.uid()
         OR public.has_role(auth.uid(), 'platform_admin') OR public.has_role(auth.uid(), 'auditor')
         OR public.has_role(auth.uid(), 'talent_operator'));
CREATE POLICY "courses inserted by staff" ON public.talent_courses
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "courses updated by staff" ON public.talent_courses
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'platform_admin'))
  WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(), 'platform_admin'));
CREATE TRIGGER touch_talent_courses BEFORE UPDATE ON public.talent_courses
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 4. Enrollments & certifications ---------------------------------------
CREATE TABLE public.talent_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.talent_courses(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES public.talent_candidate_profiles(id) ON DELETE CASCADE,
  status public.enrollment_status NOT NULL DEFAULT 'enrolled',
  fee_paid BOOLEAN NOT NULL DEFAULT false,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (course_id, candidate_id)
);
GRANT SELECT, INSERT, UPDATE ON public.talent_enrollments TO authenticated;
GRANT ALL ON public.talent_enrollments TO service_role;
ALTER TABLE public.talent_enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "enrollments readable by candidate or issuing partner" ON public.talent_enrollments
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.talent_candidate_profiles c WHERE c.id = candidate_id AND c.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.talent_courses co WHERE co.id = course_id AND co.created_by = auth.uid())
    OR public.has_role(auth.uid(), 'platform_admin') OR public.has_role(auth.uid(), 'auditor')
  );
CREATE POLICY "candidate enrolls self" ON public.talent_enrollments
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.talent_candidate_profiles c WHERE c.id = candidate_id AND c.user_id = auth.uid()));
CREATE POLICY "enrollment progress updated by partner or candidate" ON public.talent_enrollments
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.talent_candidate_profiles c WHERE c.id = candidate_id AND c.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.talent_courses co WHERE co.id = course_id AND co.created_by = auth.uid())
    OR public.has_role(auth.uid(), 'platform_admin')
  )
  WITH CHECK (true);
CREATE TRIGGER touch_talent_enrollments BEFORE UPDATE ON public.talent_enrollments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.talent_certifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL UNIQUE REFERENCES public.talent_enrollments(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES public.talent_candidate_profiles(id) ON DELETE CASCADE,
  issuer_partner_id UUID NOT NULL REFERENCES public.talent_training_partners(id) ON DELETE RESTRICT,
  issuer_name TEXT NOT NULL,
  credential_ref TEXT NOT NULL,
  provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  verification_status public.certification_verification NOT NULL DEFAULT 'pending',
  verified_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.talent_certifications TO authenticated;
GRANT ALL ON public.talent_certifications TO service_role;
ALTER TABLE public.talent_certifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "certifications readable by candidate or issuer" ON public.talent_certifications
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.talent_candidate_profiles c WHERE c.id = candidate_id AND c.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.talent_training_partners p WHERE p.id = issuer_partner_id AND p.created_by = auth.uid())
    OR public.has_role(auth.uid(), 'platform_admin') OR public.has_role(auth.uid(), 'auditor')
    OR public.has_role(auth.uid(), 'talent_operator')
  );
CREATE POLICY "certifications issued by partner" ON public.talent_certifications
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.talent_training_partners p WHERE p.id = issuer_partner_id AND (p.created_by = auth.uid() OR public.has_role(auth.uid(), 'platform_admin'))));
CREATE POLICY "certifications verified by issuer or operator" ON public.talent_certifications
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.talent_training_partners p WHERE p.id = issuer_partner_id AND p.created_by = auth.uid())
    OR public.has_role(auth.uid(), 'platform_admin') OR public.has_role(auth.uid(), 'talent_operator')
  )
  WITH CHECK (true);
CREATE TRIGGER touch_talent_certifications BEFORE UPDATE ON public.talent_certifications
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 5. Employers / recruiters / employment exchange ------------------------
CREATE TABLE public.talent_employers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  kind public.talent_employer_kind NOT NULL,
  name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  agreement_ref TEXT NOT NULL DEFAULT '',
  data_scope TEXT[] NOT NULL DEFAULT '{}',
  data_scope_approved BOOLEAN NOT NULL DEFAULT false,
  state public.talent_entity_state NOT NULL DEFAULT 'draft',
  decision_note TEXT NOT NULL DEFAULT '',
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.talent_employers TO authenticated;
GRANT ALL ON public.talent_employers TO service_role;
ALTER TABLE public.talent_employers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "employers readable" ON public.talent_employers
  FOR SELECT TO authenticated
  USING (state = 'approved' OR created_by = auth.uid()
         OR public.has_role(auth.uid(), 'platform_admin') OR public.has_role(auth.uid(), 'auditor')
         OR public.has_role(auth.uid(), 'talent_operator'));
CREATE POLICY "employers inserted by staff" ON public.talent_employers
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "employers updated by staff or operator" ON public.talent_employers
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'platform_admin') OR public.has_role(auth.uid(), 'talent_operator'))
  WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(), 'platform_admin') OR public.has_role(auth.uid(), 'talent_operator'));
CREATE TRIGGER touch_talent_employers BEFORE UPDATE ON public.talent_employers
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.talent_job_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employer_id UUID NOT NULL REFERENCES public.talent_employers(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  skills TEXT[] NOT NULL DEFAULT '{}',
  location_geo_id UUID REFERENCES public.geographies(id) ON DELETE SET NULL,
  compensation_min NUMERIC(12,2),
  compensation_max NUMERIC(12,2),
  positions INTEGER NOT NULL DEFAULT 1,
  status public.job_listing_status NOT NULL DEFAULT 'draft',
  is_sponsored BOOLEAN NOT NULL DEFAULT false,
  sponsored_label TEXT NOT NULL DEFAULT '',
  no_placement_guarantee BOOLEAN NOT NULL DEFAULT true CHECK (no_placement_guarantee),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.talent_job_listings TO authenticated;
GRANT ALL ON public.talent_job_listings TO service_role;
ALTER TABLE public.talent_job_listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "jobs readable" ON public.talent_job_listings
  FOR SELECT TO authenticated
  USING (status IN ('open', 'filled', 'closed') OR created_by = auth.uid()
         OR public.has_role(auth.uid(), 'platform_admin') OR public.has_role(auth.uid(), 'auditor')
         OR public.has_role(auth.uid(), 'talent_operator'));
CREATE POLICY "jobs inserted by employer staff" ON public.talent_job_listings
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "jobs updated by employer staff" ON public.talent_job_listings
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'platform_admin') OR public.has_role(auth.uid(), 'talent_operator'))
  WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(), 'platform_admin') OR public.has_role(auth.uid(), 'talent_operator'));
CREATE TRIGGER touch_talent_jobs BEFORE UPDATE ON public.talent_job_listings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 6. Consent-gated referrals --------------------------------------------
CREATE TABLE public.talent_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.talent_job_listings(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES public.talent_candidate_profiles(id) ON DELETE CASCADE,
  status public.referral_status NOT NULL DEFAULT 'candidate_consent_pending',
  shared_fields TEXT[] NOT NULL DEFAULT '{}',
  match_reason TEXT NOT NULL DEFAULT '',
  requested_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  candidate_decision_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (job_id, candidate_id)
);
GRANT SELECT, INSERT, UPDATE ON public.talent_referrals TO authenticated;
GRANT ALL ON public.talent_referrals TO service_role;
ALTER TABLE public.talent_referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "referrals readable by candidate, consented employer, oversight" ON public.talent_referrals
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.talent_candidate_profiles c WHERE c.id = candidate_id AND c.user_id = auth.uid())
    OR (status = 'shared' AND EXISTS (
      SELECT 1 FROM public.talent_job_listings j WHERE j.id = job_id AND j.created_by = auth.uid()))
    OR public.has_role(auth.uid(), 'platform_admin') OR public.has_role(auth.uid(), 'auditor')
    OR public.has_role(auth.uid(), 'talent_operator')
  );
CREATE POLICY "referrals proposed by operator or candidate" ON public.talent_referrals
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.talent_candidate_profiles c WHERE c.id = candidate_id AND c.user_id = auth.uid())
    OR public.has_role(auth.uid(), 'platform_admin') OR public.has_role(auth.uid(), 'talent_operator')
  );
CREATE POLICY "referrals decided by candidate or operator" ON public.talent_referrals
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.talent_candidate_profiles c WHERE c.id = candidate_id AND c.user_id = auth.uid())
    OR public.has_role(auth.uid(), 'platform_admin') OR public.has_role(auth.uid(), 'talent_operator')
  )
  WITH CHECK (true);
CREATE TRIGGER touch_talent_referrals BEFORE UPDATE ON public.talent_referrals
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 7. Commercial entitlements (only if approved) -------------------------
CREATE TABLE public.talent_entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_kind TEXT NOT NULL CHECK (subject_kind IN ('candidate_training_fee', 'employer_subscription', 'recruiter_subscription', 'training_partner_fee')),
  subject_id UUID NOT NULL,
  plan_code TEXT NOT NULL DEFAULT 'free',
  status public.membership_status NOT NULL DEFAULT 'active',
  fee_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'INR',
  grants_ranking_advantage BOOLEAN NOT NULL DEFAULT false CHECK (NOT grants_ranking_advantage),
  approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.talent_entitlements TO authenticated;
GRANT ALL ON public.talent_entitlements TO service_role;
ALTER TABLE public.talent_entitlements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "entitlements readable by oversight" ON public.talent_entitlements
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'platform_admin') OR public.has_role(auth.uid(), 'auditor')
         OR public.has_role(auth.uid(), 'talent_operator'));
CREATE POLICY "entitlements managed by platform admin" ON public.talent_entitlements
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'platform_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'platform_admin'));
CREATE TRIGGER touch_talent_entitlements BEFORE UPDATE ON public.talent_entitlements
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 8. Feature flags & role definitions (all talent flags off by default) --
INSERT INTO public.feature_flags (key, label, description, enabled, environments)
VALUES
  ('talent.domain', 'Talent & skills domain', 'Master switch; requires approved D-16 evidence gate.', false, '["sandbox"]'::jsonb),
  ('talent.candidate_profiles', 'Candidate profiles', 'Agri student/job-seeker profiles with visibility consent.', false, '["sandbox"]'::jsonb),
  ('talent.training_partners', 'Training partners', 'Training/certification partner onboarding and catalog.', false, '["sandbox"]'::jsonb),
  ('talent.employers', 'Employers & recruiters', 'Employer/recruiter onboarding and job listings.', false, '["sandbox"]'::jsonb),
  ('talent.exchange_integration', 'Employment exchange integration', 'Government employment-exchange integration; needs agreement and data-scope approval.', false, '["sandbox"]'::jsonb),
  ('talent.matching', 'Consent-gated matching', 'Candidate consent-gated matching and referral.', false, '["sandbox"]'::jsonb),
  ('talent.commercial_entitlements', 'Talent commercial entitlements', 'Training fee and employer/recruiter subscriptions.', false, '["sandbox"]'::jsonb)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.role_definitions (code, label, description, journey_kind, is_public_selectable, feature_flag_key, authority_note, sort_order)
VALUES
  ('talent_candidate', 'Agri student / job seeker', 'Owns their talent profile and controls its visibility.', 'onboarding', false, 'talent.candidate_profiles', 'Profile is hidden until the candidate consents to visibility.', 610),
  ('training_partner_admin', 'Training partner admin', 'Onboards a training/certification partner and issues certifications.', 'onboarding', false, 'talent.training_partners', 'May issue certifications only for its own approved courses.', 620),
  ('employer_recruiter', 'Employer / recruiter', 'Publishes job requisitions and receives consented referrals only.', 'onboarding', false, 'talent.employers', 'No direct access to candidate profiles; consented referrals only.', 630),
  ('employment_exchange_admin', 'Employment exchange admin', 'Government employment-exchange integration after formal agreement.', 'onboarding', false, 'talent.exchange_integration', 'Integration requires a formal agreement and approved data scope.', 640),
  ('talent_operator', 'Talent operator', 'Platform-side review of talent partners, employers and disputes.', 'onboarding', false, 'talent.domain', 'Reviews talent entities; cannot read hidden candidate profiles.', 650)
ON CONFLICT (code) DO NOTHING;