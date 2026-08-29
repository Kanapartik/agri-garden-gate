ALTER TABLE public.farm_season_records
  ADD COLUMN IF NOT EXISTS client_op_id text;

CREATE UNIQUE INDEX IF NOT EXISTS farm_season_records_client_op_uniq
  ON public.farm_season_records (farmer_user_id, client_op_id)
  WHERE client_op_id IS NOT NULL;