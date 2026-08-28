ALTER TABLE public.service_subtypes
  ADD COLUMN IF NOT EXISTS profile_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS activation_trigger text,
  ADD COLUMN IF NOT EXISTS validate_note text;

INSERT INTO public.feature_flags (key, label, description, enabled, environments)
VALUES
  ('service.packaging_provider', 'Packaging provider', 'Packaging provider service subtype', false, '{"development": false, "sandbox": false, "production": false}'::jsonb),
  ('service.certification_agency', 'Certification agency', 'Certification agency service subtype', false, '{"development": false, "sandbox": false, "production": false}'::jsonb),
  ('service.testing_soil_lab', 'Testing / soil lab', 'Testing / soil lab service subtype', false, '{"development": false, "sandbox": false, "production": false}'::jsonb),
  ('service.drone_operator', 'Drone operator', 'Drone operator service subtype', false, '{"development": false, "sandbox": false, "production": false}'::jsonb),
  ('service.export_facilitator', 'Export facilitator', 'Export facilitator service subtype', false, '{"development": false, "sandbox": false, "production": false}'::jsonb)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.service_subtypes
  (code, label, domain, description, feature_flag_key, evidence_gate, evidence_note,
   verification_checks, dispute_categories, requires_human_decision, is_active, sort_order,
   profile_fields, activation_trigger, validate_note)
VALUES
  ('packaging_provider', 'Packaging provider', 'logistics',
   'Supplies packaging materials and packing capacity to farmers, FPOs and buyers.',
   'service.packaging_provider', 'not_evaluated', 'Awaiting expansion-manager evidence decision.',
   '[{"code":"entity_proof","label":"Registered entity proof"},{"code":"packaging_capacity","label":"Packaging types and capacity evidence"},{"code":"food_grade_certification","label":"Food-grade / quality certification (as applicable)"}]'::jsonb,
   '["order_not_delivered","material_quality","billing_dispute"]'::jsonb,
   true, false, 50,
   '[{"key":"service_regions","label":"Service regions","required":true},{"key":"packaging_types","label":"Packaging types and capacity","required":true},{"key":"certification_evidence","label":"Evidence / certifications as applicable","required":false}]'::jsonb,
   'Approved service listing', NULL),

  ('certification_agency', 'Certification agency', 'advisory_service',
   'Issues organic, GAP, residue or process certifications to farmers and enterprises.',
   'service.certification_agency', 'not_evaluated', 'Awaiting expansion-manager evidence decision.',
   '[{"code":"entity_proof","label":"Registered entity proof"},{"code":"accreditation_authority","label":"Accreditation / authority evidence"},{"code":"scope_of_certification","label":"Certification domain scope review"},{"code":"conflict_disclosure","label":"Commercial conflict disclosure"}]'::jsonb,
   '["certificate_not_issued","scope_misrepresented","undisclosed_conflict","billing_dispute"]'::jsonb,
   true, false, 51,
   '[{"key":"accreditation_evidence","label":"Accreditation / authority evidence","required":true},{"key":"certification_domains","label":"Certification domains","required":true},{"key":"service_regions","label":"Regions covered","required":true}]'::jsonb,
   'Verified certification service', NULL),

  ('testing_soil_lab', 'Testing / soil lab', 'advisory_service',
   'Runs soil, water, residue or produce quality tests and contributes results back to the farmer record.',
   'service.testing_soil_lab', 'not_evaluated', 'Awaiting expansion-manager evidence decision.',
   '[{"code":"entity_proof","label":"Registered entity proof"},{"code":"lab_accreditation","label":"Quality / accreditation evidence"},{"code":"test_catalog_review","label":"Test catalogue review"},{"code":"data_contribution_consent","label":"Purpose-scoped data contribution path review"}]'::jsonb,
   '["result_not_delivered","sample_mishandled","result_disputed","billing_dispute"]'::jsonb,
   true, false, 52,
   '[{"key":"lab_capability","label":"Lab capability","required":true},{"key":"test_catalog","label":"Test catalogue","required":true},{"key":"evidence_submission_method","label":"Evidence submission method","required":true},{"key":"accreditation_evidence","label":"Quality / accreditation evidence","required":true},{"key":"data_contribution_path","label":"Data contribution path","required":true}]'::jsonb,
   'Test/referral profile plus an approved data contribution path',
   '[VALIDATE] Lab result write-back must remain purpose-scoped and consent-gated; confirm the purpose code before activation.'),

  ('drone_operator', 'Drone operator', 'chc_equipment_rental',
   'Provides drone spraying, survey and imaging services on hire.',
   'service.drone_operator', 'not_evaluated', 'Awaiting expansion-manager evidence decision.',
   '[{"code":"entity_proof","label":"Registered entity proof"},{"code":"pilot_credentials","label":"Pilot credentials and permissions"},{"code":"airspace_permission","label":"Airspace / regulatory permission evidence"},{"code":"insurance_cover","label":"Third-party insurance cover"}]'::jsonb,
   '["job_not_performed","crop_damage","safety_incident","billing_dispute"]'::jsonb,
   true, false, 53,
   '[{"key":"coverage_regions","label":"Coverage","required":true},{"key":"equipment_service_class","label":"Equipment / service class","required":true},{"key":"credentials_permissions","label":"Credentials / permissions as applicable","required":true}]'::jsonb,
   'Service job eligibility',
   '[VALIDATE] Regulatory permission set for drone operations varies by state; confirm the required evidence list per state before activation.'),

  ('export_facilitator', 'Export facilitator', 'advisory_service',
   'Supports export documentation, certification and logistics coordination. Advisory and facilitation only.',
   'service.export_facilitator', 'not_evaluated', 'Awaiting expansion-manager evidence decision.',
   '[{"code":"entity_proof","label":"Registered entity proof"},{"code":"export_credentials","label":"Export code / credential evidence"},{"code":"scope_disclosure","label":"Support scope and fee disclosure"},{"code":"conflict_disclosure","label":"Commercial conflict disclosure"}]'::jsonb,
   '["service_not_delivered","documentation_error","fee_dispute","misleading_claim"]'::jsonb,
   true, false, 54,
   '[{"key":"target_markets","label":"Markets / services","required":true},{"key":"support_scope","label":"Documentation / certification / logistics support scope","required":true},{"key":"service_regions","label":"Regions covered","required":true}]'::jsonb,
   'Service listing / referral flow',
   '[VALIDATE] Export facilitation must not activate an export marketplace; keep it a referral flow only.')
ON CONFLICT (code) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  feature_flag_key = EXCLUDED.feature_flag_key,
  verification_checks = EXCLUDED.verification_checks,
  dispute_categories = EXCLUDED.dispute_categories,
  profile_fields = EXCLUDED.profile_fields,
  activation_trigger = EXCLUDED.activation_trigger,
  validate_note = EXCLUDED.validate_note;

UPDATE public.service_subtypes SET
  profile_fields = '[{"key":"service_regions","label":"Service regions","required":true},{"key":"vehicle_capacity_class","label":"Vehicle / capacity / service class","required":true},{"key":"tracking_integration","label":"Tracking integration capability","required":true}]'::jsonb,
  activation_trigger = 'Booking / lead endpoint ready',
  validate_note = '[VALIDATE] Tracking integration must sit behind the logistics adapter; no direct carrier calls.'
WHERE code = 'logistics';

UPDATE public.service_subtypes SET
  profile_fields = '[{"key":"facility_location","label":"Facility location","required":true},{"key":"storage_capacity","label":"Capacity","required":true},{"key":"storage_type","label":"Storage type","required":true},{"key":"booking_receipt_capability","label":"Booking / receipt capabilities","required":true}]'::jsonb,
  activation_trigger = 'Verified capacity listing'
WHERE code IN ('cold_storage', 'warehouse_storage');

UPDATE public.service_subtypes SET
  profile_fields = '[{"key":"equipment_inventory","label":"Equipment inventory","required":true},{"key":"facility_location","label":"Location","required":true},{"key":"availability","label":"Availability","required":true},{"key":"rental_terms","label":"Rental terms","required":true}]'::jsonb,
  activation_trigger = 'Rental listing'
WHERE code = 'chc_equipment_rental';