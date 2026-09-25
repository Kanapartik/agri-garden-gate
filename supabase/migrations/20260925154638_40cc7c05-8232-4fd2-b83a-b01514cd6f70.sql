CREATE OR REPLACE FUNCTION public.fpo_has_member_consent(_member_id uuid, _purpose text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.fpo_members m
    JOIN public.fpo_farmer_consents c
      ON c.tenant_id = m.tenant_id AND c.farmer_user_id = m.farmer_user_id
    WHERE m.id = _member_id AND c.purpose_code = _purpose
      AND c.revoked_at IS NULL AND (c.expires_at IS NULL OR c.expires_at > now())
  )
$$;

CREATE OR REPLACE FUNCTION public.fpo_monitoring_role(_user_id uuid, _tenant_id uuid, _write boolean)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles r WHERE r.user_id = _user_id AND (
      (r.role = 'platform_admin' AND r.tenant_id IS NULL)
      OR (r.tenant_id = _tenant_id AND r.role IN ('tenant_admin','onboarding_officer','field_agent'))
      OR (NOT _write AND ((r.tenant_id = _tenant_id AND r.role = 'viewer') OR (r.role = 'auditor' AND r.tenant_id IS NULL)))
    )
  )
$$;

CREATE TABLE public.fpo_monitoring_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.fpo_members(id) ON DELETE CASCADE,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  observed_on date NOT NULL DEFAULT current_date,
  crop text,
  category text NOT NULL,
  severity text NOT NULL DEFAULT 'low',
  body text NOT NULL,
  is_synthetic boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.fpo_monitoring_notes TO authenticated;
GRANT ALL ON public.fpo_monitoring_notes TO service_role;
ALTER TABLE public.fpo_monitoring_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "monitoring notes read" ON public.fpo_monitoring_notes FOR SELECT TO authenticated
  USING (public.fpo_monitoring_role(auth.uid(), tenant_id, false) AND public.fpo_has_member_consent(member_id, 'fpo_member_management'));
CREATE POLICY "monitoring notes write" ON public.fpo_monitoring_notes FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND public.fpo_monitoring_role(auth.uid(), tenant_id, true) AND public.fpo_has_member_consent(member_id, 'fpo_member_management'));
CREATE INDEX ON public.fpo_monitoring_notes (member_id, observed_on DESC);

CREATE TABLE public.fpo_monitoring_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.fpo_members(id) ON DELETE CASCADE,
  summary text NOT NULL,
  questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  model text NOT NULL,
  note_ids uuid[] NOT NULL DEFAULT '{}',
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.fpo_monitoring_summaries TO authenticated;
GRANT ALL ON public.fpo_monitoring_summaries TO service_role;
ALTER TABLE public.fpo_monitoring_summaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "monitoring summaries read" ON public.fpo_monitoring_summaries FOR SELECT TO authenticated
  USING (public.fpo_monitoring_role(auth.uid(), tenant_id, false) AND public.fpo_has_member_consent(member_id, 'fpo_member_management'));
CREATE POLICY "monitoring summaries write" ON public.fpo_monitoring_summaries FOR INSERT TO authenticated
  WITH CHECK (reviewed_by = auth.uid() AND public.fpo_monitoring_role(auth.uid(), tenant_id, true) AND public.fpo_has_member_consent(member_id, 'fpo_member_management'));

CREATE TRIGGER trg_mon_notes_updated BEFORE UPDATE ON public.fpo_monitoring_notes FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_mon_sum_updated BEFORE UPDATE ON public.fpo_monitoring_summaries FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.fpo_monitoring_notes (tenant_id, member_id, observed_on, crop, category, severity, body, is_synthetic)
SELECT m.tenant_id, m.id, current_date - v.d, v.crop, v.cat, v.sev, v.body, true
FROM public.fpo_members m
JOIN auth.users u ON u.id = m.farmer_user_id AND u.email = 'farmer@agrivah.com'
CROSS JOIN (VALUES
  (62, 'Chilli', 'pest', 'medium', 'Thrips seen on young chilli leaves in the north plot, leaf curl on about 10% of plants.'),
  (48, 'Chilli', 'water', 'low', 'Canal water arriving late; farmer irrigating every 6 days instead of 4.'),
  (35, 'Chilli', 'pest', 'high', 'Thrips spread to the second plot, leaf curl now around 25%. Farmer sprayed once without advice.'),
  (21, 'Cotton', 'disease', 'medium', 'Yellowing on lower cotton leaves, possible nutrient deficiency or early wilt.'),
  (12, 'Chilli', 'input', 'medium', 'Farmer could not get recommended insecticide at the village shop; used a substitute.'),
  (4, 'Chilli', 'market', 'low', 'Farmer asking about expected dry chilli price at Guntur yard for next month.')
) AS v(d, crop, cat, sev, body);