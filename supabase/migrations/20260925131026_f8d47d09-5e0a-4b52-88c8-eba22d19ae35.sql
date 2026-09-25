CREATE TYPE public.fpo_voucher_stage AS ENUM ('draft','pending_check','checked','approved','returned');

ALTER TABLE public.fpo_ledger_entries
  ADD COLUMN workflow_stage public.fpo_voucher_stage NOT NULL DEFAULT 'approved',
  ADD COLUMN voucher_number text,
  ADD COLUMN maker_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN maker_at timestamptz,
  ADD COLUMN checker_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN checker_at timestamptz,
  ADD COLUMN approver_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN approver_at timestamptz,
  ADD COLUMN returned_reason text;

CREATE INDEX idx_fpo_ledger_stage ON public.fpo_ledger_entries(tenant_id, workflow_stage);
CREATE UNIQUE INDEX idx_fpo_ledger_voucher ON public.fpo_ledger_entries(tenant_id, voucher_number)
  WHERE voucher_number IS NOT NULL;

CREATE SEQUENCE IF NOT EXISTS public.fpo_voucher_seq;
GRANT USAGE, SELECT ON SEQUENCE public.fpo_voucher_seq TO authenticated;
GRANT ALL ON SEQUENCE public.fpo_voucher_seq TO service_role;

CREATE OR REPLACE FUNCTION public.fpo_assign_voucher_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.voucher_number IS NULL THEN
    NEW.voucher_number :=
      CASE WHEN NEW.direction = 'inflow' THEN 'COL-' ELSE 'EXP-' END
      || to_char(COALESCE(NEW.entry_date, CURRENT_DATE), 'YYYY')
      || '-'
      || lpad(nextval('public.fpo_voucher_seq')::text, 5, '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER assign_fpo_voucher_number
  BEFORE INSERT ON public.fpo_ledger_entries
  FOR EACH ROW EXECUTE FUNCTION public.fpo_assign_voucher_number();
