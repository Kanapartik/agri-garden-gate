update feature_flags
set enabled = true,
    environments = '["development","sandbox","production"]'::jsonb
where key in (
  'role.farmer',
  'role.fpo',
  'role.field_agent',
  'role.bank_officer',
  'role.insurer_officer',
  'role.govt_officer',
  'state.tenant_configuration',
  'knowledge.contribution',
  'research.aggregate_access',
  'policy.aggregate_dashboard',
  'service.warehouse_storage',
  'talent.domain',
  'talent.candidate_profiles',
  'talent.training_partners',
  'talent.employers',
  'talent.exchange_integration'
);