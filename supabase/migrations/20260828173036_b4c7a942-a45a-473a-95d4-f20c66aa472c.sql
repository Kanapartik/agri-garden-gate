CREATE TABLE public.fpo_registry (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  state_name text NOT NULL,
  state_code text,
  sfac_serial integer,
  district text,
  block_mandal text,
  fpo_name text NOT NULL,
  registration_number text NOT NULL,
  registration_act text,
  incorporation_date date,
  cbbo text,
  scheme text,
  source_as_of date,
  source_url text,
  qa_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fpo_registry_registration_unique UNIQUE (registration_number)
);

GRANT SELECT ON public.fpo_registry TO anon;
GRANT SELECT ON public.fpo_registry TO authenticated;
GRANT ALL ON public.fpo_registry TO service_role;

ALTER TABLE public.fpo_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Registry is publicly readable"
  ON public.fpo_registry FOR SELECT
  USING (true);

CREATE POLICY "Platform admins manage registry"
  ON public.fpo_registry FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'platform_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'platform_admin'));

CREATE INDEX fpo_registry_state_district_idx ON public.fpo_registry (state_name, district);
CREATE INDEX fpo_registry_name_idx ON public.fpo_registry (fpo_name);

CREATE TRIGGER fpo_registry_touch_updated_at
  BEFORE UPDATE ON public.fpo_registry
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();