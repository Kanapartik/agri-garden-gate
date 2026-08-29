CREATE TABLE public.official_msp_rates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  crop text NOT NULL,
  crop_year integer NOT NULL,
  season_code text NOT NULL DEFAULT 'kharif',
  variety_label text NOT NULL DEFAULT 'common',
  msp_per_quintal numeric(12,2) NOT NULL,
  source text NOT NULL,
  notification_ref text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (crop, crop_year, season_code, variety_label)
);

GRANT SELECT ON public.official_msp_rates TO authenticated;
GRANT ALL ON public.official_msp_rates TO service_role;
ALTER TABLE public.official_msp_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users read MSP rates" ON public.official_msp_rates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Platform admins manage MSP rates" ON public.official_msp_rates FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'platform_admin')) WITH CHECK (public.has_role(auth.uid(), 'platform_admin'));
CREATE TRIGGER touch_official_msp_rates BEFORE UPDATE ON public.official_msp_rates FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.official_insurance_rates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  scheme_code text NOT NULL,
  season_code text NOT NULL,
  crop_category text NOT NULL,
  farmer_share_pct numeric(5,2) NOT NULL,
  source text NOT NULL,
  notification_ref text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (scheme_code, season_code, crop_category)
);

GRANT SELECT ON public.official_insurance_rates TO authenticated;
GRANT ALL ON public.official_insurance_rates TO service_role;
ALTER TABLE public.official_insurance_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users read notified insurance rates" ON public.official_insurance_rates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Platform admins manage notified insurance rates" ON public.official_insurance_rates FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'platform_admin')) WITH CHECK (public.has_role(auth.uid(), 'platform_admin'));
CREATE TRIGGER touch_official_insurance_rates BEFORE UPDATE ON public.official_insurance_rates FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.official_data_loads (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dataset_code text NOT NULL,
  dataset_label text NOT NULL,
  source_citation text NOT NULL,
  row_count integer NOT NULL DEFAULT 0,
  coverage_note text,
  validate_notes text,
  loaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  loaded_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.official_data_loads TO authenticated;
GRANT ALL ON public.official_data_loads TO service_role;
ALTER TABLE public.official_data_loads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users read official data loads" ON public.official_data_loads FOR SELECT TO authenticated USING (true);
CREATE POLICY "Platform admins manage official data loads" ON public.official_data_loads FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'platform_admin')) WITH CHECK (public.has_role(auth.uid(), 'platform_admin'));
CREATE TRIGGER touch_official_data_loads BEFORE UPDATE ON public.official_data_loads FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.official_msp_rates (crop, crop_year, season_code, variety_label, msp_per_quintal, source, notification_ref) VALUES
  ('Paddy', 2021, 'kharif', 'common', 1940, 'cacp_msp', 'CACP MSP 2021-22 Kharif'),
  ('Paddy', 2022, 'kharif', 'common', 2040, 'cacp_msp', 'CACP MSP 2022-23 Kharif'),
  ('Paddy', 2023, 'kharif', 'common', 2183, 'cacp_msp', 'CACP MSP 2023-24 Kharif'),
  ('Paddy', 2024, 'kharif', 'common', 2300, 'cacp_msp', 'CACP MSP 2024-25 Kharif'),
  ('Paddy', 2025, 'kharif', 'common', 2369, 'cacp_msp', 'CACP MSP 2025-26 Kharif'),
  ('Cotton', 2021, 'kharif', 'medium_staple', 5726, 'cacp_msp', 'CACP MSP 2021-22 Kharif'),
  ('Cotton', 2022, 'kharif', 'medium_staple', 6080, 'cacp_msp', 'CACP MSP 2022-23 Kharif'),
  ('Cotton', 2023, 'kharif', 'medium_staple', 6620, 'cacp_msp', 'CACP MSP 2023-24 Kharif'),
  ('Cotton', 2024, 'kharif', 'medium_staple', 7121, 'cacp_msp', 'CACP MSP 2024-25 Kharif'),
  ('Cotton', 2025, 'kharif', 'medium_staple', 7710, 'cacp_msp', 'CACP MSP 2025-26 Kharif'),
  ('Maize', 2021, 'kharif', 'common', 1870, 'cacp_msp', 'CACP MSP 2021-22 Kharif'),
  ('Maize', 2022, 'kharif', 'common', 1962, 'cacp_msp', 'CACP MSP 2022-23 Kharif'),
  ('Maize', 2023, 'kharif', 'common', 2090, 'cacp_msp', 'CACP MSP 2023-24 Kharif'),
  ('Maize', 2024, 'kharif', 'common', 2225, 'cacp_msp', 'CACP MSP 2024-25 Kharif'),
  ('Maize', 2025, 'kharif', 'common', 2400, 'cacp_msp', 'CACP MSP 2025-26 Kharif'),
  ('Groundnut', 2021, 'kharif', 'common', 5550, 'cacp_msp', 'CACP MSP 2021-22 Kharif'),
  ('Groundnut', 2022, 'kharif', 'common', 5850, 'cacp_msp', 'CACP MSP 2022-23 Kharif'),
  ('Groundnut', 2023, 'kharif', 'common', 6377, 'cacp_msp', 'CACP MSP 2023-24 Kharif'),
  ('Groundnut', 2024, 'kharif', 'common', 6783, 'cacp_msp', 'CACP MSP 2024-25 Kharif'),
  ('Groundnut', 2025, 'kharif', 'common', 7263, 'cacp_msp', 'CACP MSP 2025-26 Kharif'),
  ('Redgram', 2021, 'kharif', 'common', 6300, 'cacp_msp', 'CACP MSP 2021-22 Kharif (Tur/Arhar)'),
  ('Redgram', 2022, 'kharif', 'common', 6600, 'cacp_msp', 'CACP MSP 2022-23 Kharif (Tur/Arhar)'),
  ('Redgram', 2023, 'kharif', 'common', 7000, 'cacp_msp', 'CACP MSP 2023-24 Kharif (Tur/Arhar)'),
  ('Redgram', 2024, 'kharif', 'common', 7550, 'cacp_msp', 'CACP MSP 2024-25 Kharif (Tur/Arhar)'),
  ('Redgram', 2025, 'kharif', 'common', 8000, 'cacp_msp', 'CACP MSP 2025-26 Kharif (Tur/Arhar)');

INSERT INTO public.official_insurance_rates (scheme_code, season_code, crop_category, farmer_share_pct, source, notification_ref) VALUES
  ('PMFBY', 'kharif', 'food_and_oilseed', 2.00, 'pmfby_operational_guidelines', 'PMFBY Operational Guidelines - farmer share cap'),
  ('PMFBY', 'rabi', 'food_and_oilseed', 1.50, 'pmfby_operational_guidelines', 'PMFBY Operational Guidelines - farmer share cap'),
  ('PMFBY', 'kharif', 'commercial_or_horticultural', 5.00, 'pmfby_operational_guidelines', 'PMFBY Operational Guidelines - farmer share cap'),
  ('PMFBY', 'rabi', 'commercial_or_horticultural', 5.00, 'pmfby_operational_guidelines', 'PMFBY Operational Guidelines - farmer share cap'),
  ('PMFBY', 'annual', 'commercial_or_horticultural', 5.00, 'pmfby_operational_guidelines', 'PMFBY Operational Guidelines - farmer share cap');

INSERT INTO public.official_data_loads (dataset_code, dataset_label, source_citation, row_count, coverage_note, validate_notes) VALUES
  ('cacp_msp_2021_2025', 'CACP Minimum Support Prices (crop years 2021-2025)', 'Commission for Agricultural Costs and Prices (CACP), Government of India - kharif MSP notifications', 25, 'Covers Paddy (common), Cotton (medium staple), Maize, Groundnut, Redgram. Chilli and Turmeric have no notified MSP and remain indicative.', 'Confirm variety-grade selection (Paddy Grade A, Cotton long staple) with the state marketing department before using MSP as a settlement reference.'),
  ('pmfby_farmer_share_caps', 'PMFBY notified farmer premium share caps', 'Pradhan Mantri Fasal Bima Yojana Operational Guidelines, Ministry of Agriculture & Farmers Welfare', 5, 'Farmer share caps only. District x crop sum insured and actuarial premium rates are not loaded.', 'Load state notified sum insured and season-wise actuarial premium rates per district x crop before showing premium amounts as official.');