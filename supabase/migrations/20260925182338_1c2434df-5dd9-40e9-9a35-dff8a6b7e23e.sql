CREATE TABLE public.farmer_qr_codes (
  user_id uuid PRIMARY KEY,
  code text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.farmer_qr_codes TO authenticated;
GRANT ALL ON public.farmer_qr_codes TO service_role;
ALTER TABLE public.farmer_qr_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Farmer reads own QR" ON public.farmer_qr_codes FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Farmer creates own QR" ON public.farmer_qr_codes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Farmer rotates own QR" ON public.farmer_qr_codes FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER touch_farmer_qr_codes BEFORE UPDATE ON public.farmer_qr_codes FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();