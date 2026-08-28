UPDATE public.feature_flags
SET enabled = true,
    environments = '["development","sandbox"]'::jsonb
WHERE key IN (
  'role.farmer','role.fpo','role.field_agent','role.bank_officer','role.insurer_officer',
  'role.govt_officer','state.tenant_configuration','knowledge.contribution',
  'research.aggregate_access','policy.aggregate_dashboard','service.warehouse_storage',
  'talent.domain','talent.candidate_profiles','talent.training_partners','talent.employers',
  'talent.exchange_integration'
);

UPDATE public.role_definitions
SET is_public_selectable = true
WHERE is_active = true AND code <> 'employer_recruiter';
