-- Phase 7: FPO accounts, ledgers & grant funds
CREATE TYPE public.fpo_ledger_direction AS ENUM ('inflow','outflow');
CREATE TYPE public.fpo_ledger_category AS ENUM (
  'procurement','produce_sale','membership_fee','scheme_grant','expense','loan','other'
);
CREATE TYPE public.fpo_uc_state AS ENUM ('not_due','pending','submitted','accepted','rejected');

CREATE TABLE public.fpo_ledger_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  direction public.fpo_ledger_direction NOT NULL,
  category public.fpo_ledger_category NOT NULL DEFAULT 'other',
  description text NOT NULL,
  party_name text,
  member_id uuid REFERENCES public.fpo_members(id) ON DELETE SET NULL,
  amount numeric NOT NULL CHECK (amount >= 0),
  amount_settled numeric NOT NULL DEFAULT 0 CHECK (amount_settled >= 0),
  payment_state public.fpo_payment_state NOT NULL DEFAULT 'pending',
  due_date date,
  reference text,
  bank_reference text,
  is_reconciled boolean NOT NULL DEFAULT false,
  reconciled_at timestamptz,
  reconciled_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  campaign_id uuid REFERENCES public.fpo_procurement_campaigns(id) ON DELETE SET NULL,
  lot_id uuid REFERENCES public.fpo_produce_lots(id) ON DELETE SET NULL,
  note text,
  created_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  is_synthetic boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.fpo_grant_funds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  title text NOT NULL,
  funder_name text NOT NULL,
  scheme_id uuid REFERENCES public.schemes(id) ON DELETE SET NULL,
  application_id uuid REFERENCES public.fpo_scheme_applications(id) ON DELETE SET NULL,
  sanctioned_amount numeric NOT NULL DEFAULT 0 CHECK (sanctioned_amount >= 0),
  received_amount numeric NOT NULL DEFAULT 0 CHECK (received_amount >= 0),
  utilized_amount numeric NOT NULL DEFAULT 0 CHECK (utilized_amount >= 0),
  sanctioned_on date,
  next_installment_due date,
  next_installment_amount numeric CHECK (next_installment_amount >= 0),
  uc_state public.fpo_uc_state NOT NULL DEFAULT 'not_due',
  reporting_deadline date,
  note text,
  is_synthetic boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.fpo_grant_utilizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grant_id uuid NOT NULL REFERENCES public.fpo_grant_funds(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  purpose text NOT NULL,
  amount numeric NOT NULL CHECK (amount >= 0),
  spent_on date NOT NULL DEFAULT CURRENT_DATE,
  voucher_reference text,
  note text,
  recorded_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  is_synthetic boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_fpo_ledger_tenant ON public.fpo_ledger_entries(tenant_id, entry_date DESC);
CREATE INDEX idx_fpo_ledger_member ON public.fpo_ledger_entries(member_id);
CREATE INDEX idx_fpo_ledger_state ON public.fpo_ledger_entries(tenant_id, payment_state);
CREATE INDEX idx_fpo_grants_tenant ON public.fpo_grant_funds(tenant_id);
CREATE INDEX idx_fpo_grant_util_grant ON public.fpo_grant_utilizations(grant_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fpo_ledger_entries TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fpo_grant_funds TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fpo_grant_utilizations TO authenticated;
GRANT ALL ON public.fpo_ledger_entries TO service_role;
GRANT ALL ON public.fpo_grant_funds TO service_role;
GRANT ALL ON public.fpo_grant_utilizations TO service_role;

ALTER TABLE public.fpo_ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fpo_grant_funds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fpo_grant_utilizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fpo members read ledger" ON public.fpo_ledger_entries
  FOR SELECT TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'platform_admin'));
CREATE POLICY "fpo admins write ledger" ON public.fpo_ledger_entries
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'platform_admin') OR public.has_tenant_role(auth.uid(), tenant_id, 'tenant_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'platform_admin') OR public.has_tenant_role(auth.uid(), tenant_id, 'tenant_admin'));

CREATE POLICY "fpo members read grants" ON public.fpo_grant_funds
  FOR SELECT TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'platform_admin'));
CREATE POLICY "fpo admins write grants" ON public.fpo_grant_funds
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'platform_admin') OR public.has_tenant_role(auth.uid(), tenant_id, 'tenant_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'platform_admin') OR public.has_tenant_role(auth.uid(), tenant_id, 'tenant_admin'));

CREATE POLICY "fpo members read grant utilizations" ON public.fpo_grant_utilizations
  FOR SELECT TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'platform_admin'));
CREATE POLICY "fpo admins write grant utilizations" ON public.fpo_grant_utilizations
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'platform_admin') OR public.has_tenant_role(auth.uid(), tenant_id, 'tenant_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'platform_admin') OR public.has_tenant_role(auth.uid(), tenant_id, 'tenant_admin'));

CREATE TRIGGER touch_fpo_ledger_entries BEFORE UPDATE ON public.fpo_ledger_entries
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER touch_fpo_grant_funds BEFORE UPDATE ON public.fpo_grant_funds
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER touch_fpo_grant_utilizations BEFORE UPDATE ON public.fpo_grant_utilizations
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Synthetic AP/Telangana finance data
INSERT INTO public.fpo_ledger_entries (tenant_id, entry_date, direction, category, description, party_name, amount, amount_settled, payment_state, due_date, reference, bank_reference, is_reconciled, reconciled_at, note, is_synthetic)
SELECT p.tenant_id, CURRENT_DATE - e.days_ago, e.dir::public.fpo_ledger_direction, e.cat::public.fpo_ledger_category,
       e.descr, e.party, e.amount, e.settled, e.state::public.fpo_payment_state,
       CASE WHEN e.due_in IS NULL THEN NULL ELSE CURRENT_DATE + e.due_in END,
       e.ref, e.bank_ref, e.bank_ref IS NOT NULL,
       CASE WHEN e.bank_ref IS NOT NULL THEN now() ELSE NULL END, e.note, true
FROM public.fpo_profiles p
CROSS JOIN (VALUES
  (4, 'inflow', 'produce_sale', 'Paddy lot LOT-PADDY-K26 part payment received', 'Kisan Bulk Traders, Guntur', 1404000, 1404000, 'paid', NULL, 'INV/PS/2026/014', 'UTR2608260014', 'Advance 50% against weighment.'),
  (2, 'inflow', 'produce_sale', 'Paddy lot balance receivable on weighment', 'Kisan Bulk Traders, Guntur', 1404000, 0, 'pending', 18, 'INV/PS/2026/015', NULL, 'Balance due after final weighment at mandi yard.'),
  (9, 'outflow', 'procurement', 'Fertilizer procurement — supplier payment', 'Coromandel authorised dealer, Guntur', 892500, 892500, 'paid', NULL, 'PO/PR/2026/007', 'UTR2608260007', 'Bulk urea and DAP for kharif demand.'),
  (6, 'inflow', 'membership_fee', 'Member collection against input distribution', 'Member collections (village clusters)', 512000, 341000, 'partial', 10, 'COL/2026/031', NULL, 'Balance collection in progress at village level.'),
  (12, 'outflow', 'expense', 'Godown rent, grading labour and transport', 'AP State Warehousing Corporation', 148000, 148000, 'paid', NULL, 'EXP/2026/022', 'UTR2608260022', 'Includes fumigation charges.'),
  (3, 'outflow', 'expense', 'Field staff honorarium and mobility', 'FPO field officers', 96000, 0, 'pending', 7, 'EXP/2026/026', NULL, 'Payable at month end.')
) AS e(days_ago, dir, cat, descr, party, amount, settled, state, due_in, ref, bank_ref, note)
WHERE p.tenant_id IS NOT NULL;

INSERT INTO public.fpo_ledger_entries (tenant_id, entry_date, direction, category, description, member_id, amount, amount_settled, payment_state, due_date, reference, note, is_synthetic)
SELECT m.tenant_id, CURRENT_DATE - 5, 'outflow', 'produce_sale',
       'Produce settlement payable to member', m.id,
       (14000 + (row_number() OVER (PARTITION BY m.tenant_id ORDER BY m.created_at)) * 1500)::numeric,
       CASE WHEN (row_number() OVER (PARTITION BY m.tenant_id ORDER BY m.created_at)) % 2 = 0 THEN (14000 + (row_number() OVER (PARTITION BY m.tenant_id ORDER BY m.created_at)) * 1500)::numeric ELSE 0 END,
       CASE WHEN (row_number() OVER (PARTITION BY m.tenant_id ORDER BY m.created_at)) % 2 = 0 THEN 'paid'::public.fpo_payment_state ELSE 'pending'::public.fpo_payment_state END,
       CURRENT_DATE + 9, 'SET/2026/PADDY', 'Pro-rata share of paddy lot proceeds after deductions.', true
FROM public.fpo_members m
WHERE m.status = 'active';

INSERT INTO public.fpo_grant_funds (tenant_id, title, funder_name, sanctioned_amount, received_amount, utilized_amount, sanctioned_on, next_installment_due, next_installment_amount, uc_state, reporting_deadline, note, is_synthetic)
SELECT p.tenant_id, g.title, g.funder, g.sanctioned, g.received, g.utilized,
       CURRENT_DATE - g.sanctioned_days_ago, CURRENT_DATE + g.next_in, g.next_amount,
       g.uc::public.fpo_uc_state, CURRENT_DATE + g.report_in, g.note, true
FROM public.fpo_profiles p
CROSS JOIN (VALUES
  ('Equity grant support under FPO promotion', 'Central nodal agency (synthetic)', 1500000, 750000, 512000, 210, 45, 750000, 'pending', 30, 'Utilization certificate for first installment due before next release.'),
  ('Godown and grading infrastructure assistance', 'State horticulture / agriculture department (synthetic)', 2400000, 2400000, 1985000, 380, 0, NULL, 'submitted', 60, 'Civil work completed; final utilization statement under department review.')
) AS g(title, funder, sanctioned, received, utilized, sanctioned_days_ago, next_in, next_amount, uc, report_in, note)
WHERE p.tenant_id IS NOT NULL;

INSERT INTO public.fpo_grant_utilizations (grant_id, tenant_id, purpose, amount, spent_on, voucher_reference, note, is_synthetic)
SELECT f.id, f.tenant_id, u.purpose, u.amount, CURRENT_DATE - u.days_ago, u.voucher, u.note, true
FROM public.fpo_grant_funds f
CROSS JOIN (VALUES
  ('Working capital for input procurement', 320000, 120, 'VCH/GR/2026/003', 'Deployed for kharif fertilizer aggregation.'),
  ('Grading and weighing equipment', 192000, 75, 'VCH/GR/2026/009', 'Moisture meters and platform weighing scales.')
) AS u(purpose, amount, days_ago, voucher, note)
WHERE f.is_synthetic AND f.uc_state = 'pending';