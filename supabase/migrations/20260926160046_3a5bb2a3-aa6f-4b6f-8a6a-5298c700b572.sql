DO $security$
DECLARE item record; predicate text;
BEGIN
  FOR item IN SELECT * FROM (VALUES
    ('practice_lessons','practice_lessons_read','reference'),
    ('fpo_scheme_catalog','scheme catalog readable by signed-in users','fpo'),
    ('fpo_opportunity_profiles','opportunity profiles readable by signed-in users','fpo_record'),
    ('district_templates','dt_read','planning'),
    ('insurer_risk_cells','Signed-in users read risk cells','insurer'),
    ('data_purposes','data_purposes_select_authenticated','reference'),
    ('geographies','geographies_read_all','reference'),
    ('role_definitions','role_definitions_read_all','reference'),
    ('service_subtypes','sst_read','reference'),
    ('content_translations','content_translations_read','reference'),
    ('official_data_loads','Signed-in users read official data loads','oversight'),
    ('practice_modules','practice_modules_read','reference'),
    ('organization_subtypes','subtypes readable','reference'),
    ('feature_flags','feature_flags_read_all','oversight'),
    ('talent_evidence_gates','gate readable by authenticated','talent'),
    ('infestation_treatments','infestation_treatments_read','reference'),
    ('onboarding_step_definitions','step_definitions_read_all','reference'),
    ('soil_retention_practices','soil_practices_read','reference'),
    ('fpo_registry','Registry is publicly readable','fpo_record'),
    ('nutrient_recommendations','nutrient_recs_read','reference'),
    ('official_insurance_rates','Signed-in users read notified insurance rates','reference'),
    ('insurer_market_cells','market cells readable by signed-in users','insurer'),
    ('area_crop_benchmarks','Signed-in users read area benchmarks','reference'),
    ('input_products','input_products_read','reference'),
    ('nearby_service_facilities','fac_read_authenticated','reference'),
    ('market_price_observations','price_read_authenticated','reference'),
    ('official_msp_rates','Signed-in users read MSP rates','reference'),
    ('consent_policies','consent policies readable','reference'),
    ('synthetic_actors','synthetic_actors_read','oversight'),
    ('infestation_types','infestation_types_read','reference'),
    ('fpo_scheme_matrix','scheme matrix readable by signed-in users','fpo_record')
  ) AS v(tbl, pol, kind) LOOP
    predicate := CASE item.kind
      WHEN 'reference' THEN '(EXISTS (SELECT 1 FROM public.farmer_profiles fp WHERE fp.farmer_user_id = (SELECT auth.uid())) OR public.has_role((SELECT auth.uid()), ''platform_admin'') OR EXISTS (SELECT 1 FROM public.tenant_members tm WHERE tm.user_id = (SELECT auth.uid()) AND tm.status = ''active''))'
      WHEN 'fpo' THEN '(public.has_role((SELECT auth.uid()), ''platform_admin'') OR EXISTS (SELECT 1 FROM public.tenant_members tm JOIN public.tenants t ON t.id = tm.tenant_id WHERE tm.user_id = (SELECT auth.uid()) AND tm.status = ''active'' AND t.tenant_type = ''fpo''))'
      WHEN 'fpo_record' THEN format('(public.has_role((SELECT auth.uid()), ''platform_admin'') OR EXISTS (SELECT 1 FROM public.fpo_profiles fp JOIN public.tenant_members tm ON tm.tenant_id = fp.tenant_id WHERE fp.registration_number = %I.registration_number AND tm.user_id = (SELECT auth.uid()) AND tm.status = ''active''))', item.tbl)
      WHEN 'insurer' THEN '(public.has_role((SELECT auth.uid()), ''platform_admin'') OR EXISTS (SELECT 1 FROM public.tenant_members tm JOIN public.tenants t ON t.id = tm.tenant_id WHERE tm.user_id = (SELECT auth.uid()) AND tm.status = ''active'' AND t.tenant_type = ''insurer''))'
      WHEN 'planning' THEN '(public.has_role((SELECT auth.uid()), ''platform_admin'') OR public.has_role((SELECT auth.uid()), ''expansion_manager''))'
      WHEN 'oversight' THEN 'public.has_role((SELECT auth.uid()), ''platform_admin'')'
      WHEN 'talent' THEN '(public.has_role((SELECT auth.uid()), ''platform_admin'') OR public.has_role((SELECT auth.uid()), ''talent_operator'') OR public.has_role((SELECT auth.uid()), ''training_partner_admin''))'
    END;
    EXECUTE format('ALTER POLICY %I ON public.%I TO authenticated USING (%s)', item.pol, item.tbl, predicate);
  END LOOP;
  FOR item IN SELECT * FROM (VALUES
    ('processing_path_steps','step_update'),
    ('talent_certifications','certifications verified by issuer or operator'),
    ('talent_referrals','referrals decided by candidate or operator'),
    ('talent_enrollments','enrollment progress updated by partner or candidate')
  ) AS v(tbl, pol) LOOP
    SELECT qual INTO predicate FROM pg_policies WHERE schemaname = 'public' AND tablename = item.tbl AND policyname = item.pol;
    IF predicate IS NULL THEN RAISE EXCEPTION 'Missing policy %.%', item.tbl, item.pol; END IF;
    EXECUTE format('ALTER POLICY %I ON public.%I WITH CHECK (%s)', item.pol, item.tbl, predicate);
  END LOOP;
END $security$;