insert into public.onboarding_step_definitions (role_code, step_key, label, sort_order, is_required, fields, evidence_required, help_text) values

-- bank officer
('bank_officer','institution','Bank and branch details',10,true,
 '[{"name":"bank_name","label":"Bank / institution name","type":"text","required":true,"maxLength":150},{"name":"branch_name","label":"Branch","type":"text","required":true,"maxLength":120},{"name":"ifsc","label":"IFSC","type":"text","required":true,"maxLength":11},{"name":"district_code","label":"District","type":"geography","level":"district","required":true}]'::jsonb,
 '[]'::jsonb,null),
('bank_officer','officer','Officer identity and mandate',20,true,
 '[{"name":"officer_name","label":"Officer name","type":"text","required":true,"maxLength":100},{"name":"designation","label":"Designation","type":"text","required":true,"maxLength":80},{"name":"official_email","label":"Official email","type":"text","required":true,"maxLength":120},{"name":"officer_phone","label":"Mobile","type":"tel","required":true,"pattern":"^[0-9]{10}$"}]'::jsonb,
 '[{"code":"employment_letter","label":"Employer authorisation letter","optional_in_sandbox":true}]'::jsonb,
 'Credit decisions always remain with the authorised bank role; onboarding grants workspace access only.'),
('bank_officer','review','Review and submit',30,true,'[]'::jsonb,'[]'::jsonb,null),

-- insurer officer
('insurer_officer','institution','Insurer details',10,true,
 '[{"name":"insurer_name","label":"Insurer name","type":"text","required":true,"maxLength":150},{"name":"irdai_registration","label":"IRDAI registration number","type":"text","required":true,"maxLength":50},{"name":"district_code","label":"Operating district","type":"geography","level":"district","required":true}]'::jsonb,
 '[]'::jsonb,null),
('insurer_officer','mandate','Scheme mandate',20,true,
 '[{"name":"officer_name","label":"Officer name","type":"text","required":true,"maxLength":100},{"name":"designation","label":"Designation","type":"text","required":true,"maxLength":80},{"name":"schemes","label":"Schemes handled","type":"select","required":true,"options":["PMFBY","RWBCIS","Both","Other"]},{"name":"officer_phone","label":"Mobile","type":"tel","required":true,"pattern":"^[0-9]{10}$"}]'::jsonb,
 '[{"code":"authorisation_letter","label":"Insurer authorisation letter","optional_in_sandbox":true}]'::jsonb,
 'Claim and enrolment decisions stay with the authorised insurer role.'),
('insurer_officer','review','Review and submit',30,true,'[]'::jsonb,'[]'::jsonb,null),

-- government officer
('govt_officer','office','Office details',10,true,
 '[{"name":"department","label":"Department","type":"text","required":true,"maxLength":150},{"name":"office_name","label":"Office / posting","type":"text","required":true,"maxLength":150},{"name":"district_code","label":"District","type":"geography","level":"district","required":true}]'::jsonb,
 '[]'::jsonb,null),
('govt_officer','officer','Officer identity',20,true,
 '[{"name":"officer_name","label":"Officer name","type":"text","required":true,"maxLength":100},{"name":"designation","label":"Designation","type":"text","required":true,"maxLength":80},{"name":"employee_code","label":"Employee code","type":"text","required":true,"maxLength":40},{"name":"official_email","label":"Official email","type":"text","required":true,"maxLength":120}]'::jsonb,
 '[{"code":"posting_order","label":"Posting / authorisation order","optional_in_sandbox":true}]'::jsonb,
 'Technical tenancy does not confer government authority; a human reviewer verifies the posting.'),
('govt_officer','review','Review and submit',30,true,'[]'::jsonb,'[]'::jsonb,null),

-- state administrator
('state_admin','office','State office details',10,true,
 '[{"name":"state_code","label":"State","type":"geography","level":"state","required":true},{"name":"department","label":"Department","type":"text","required":true,"maxLength":150},{"name":"admin_name","label":"Administrator name","type":"text","required":true,"maxLength":100},{"name":"designation","label":"Designation","type":"text","required":true,"maxLength":80}]'::jsonb,
 '[{"code":"authorisation_order","label":"State authorisation order","optional_in_sandbox":true}]'::jsonb,
 'State configuration rights are granted only after human verification.'),
('state_admin','scope','Configuration scope',20,true,
 '[{"name":"config_scope","label":"Requested configuration scope","type":"select","required":true,"options":["Onboarding steps","Scheme catalogue","Geography","Feature activation","All of the above"]},{"name":"justification","label":"Justification","type":"textarea","required":true,"maxLength":600}]'::jsonb,
 '[]'::jsonb,null),
('state_admin','review','Review and submit',30,true,'[]'::jsonb,'[]'::jsonb,null),

-- policymaker
('policymaker','institution','Institution details',10,true,
 '[{"name":"institution_name","label":"Institution / ministry","type":"text","required":true,"maxLength":150},{"name":"official_name","label":"Your name","type":"text","required":true,"maxLength":100},{"name":"designation","label":"Designation","type":"text","required":true,"maxLength":80},{"name":"state_code","label":"State of interest","type":"geography","level":"state","required":true}]'::jsonb,
 '[]'::jsonb,'Policymaker access is aggregate-only; no farmer personal data is exposed.'),
('policymaker','purpose','Purpose of access',20,true,
 '[{"name":"purpose","label":"Purpose","type":"textarea","required":true,"maxLength":600},{"name":"reporting_cycle","label":"Reporting cycle","type":"select","required":true,"options":["Monthly","Quarterly","Seasonal","Annual"]}]'::jsonb,
 '[{"code":"authorisation_letter","label":"Authorisation letter","optional_in_sandbox":true}]'::jsonb,null),
('policymaker','review','Review and submit',30,true,'[]'::jsonb,'[]'::jsonb,null),

-- researcher
('researcher','affiliation','Academic affiliation',10,true,
 '[{"name":"institution_name","label":"University / institute","type":"text","required":true,"maxLength":150},{"name":"researcher_name","label":"Researcher name","type":"text","required":true,"maxLength":100},{"name":"academic_email","label":"Academic email","type":"text","required":true,"maxLength":120},{"name":"district_code","label":"Base district","type":"geography","level":"district","required":true}]'::jsonb,
 '[{"code":"institution_id","label":"Institutional ID / letter","optional_in_sandbox":true}]'::jsonb,null),
('researcher','study','Study and data request',20,true,
 '[{"name":"study_title","label":"Study title","type":"text","required":true,"maxLength":150},{"name":"data_scope","label":"Data scope requested","type":"select","required":true,"options":["Aggregate district data","Aggregate crop data","Aggregate scheme uptake","Other aggregate"]},{"name":"ethics_ref","label":"Ethics approval reference","type":"text","required":true,"maxLength":80},{"name":"abstract","label":"Abstract","type":"textarea","required":true,"maxLength":600}]'::jsonb,
 '[{"code":"ethics_approval","label":"Ethics approval","optional_in_sandbox":true}]'::jsonb,
 'Research access is aggregate and purpose-scoped; identified farmer data is never released through this journey.'),
('researcher','review','Review and submit',30,true,'[]'::jsonb,'[]'::jsonb,null),

-- knowledge contributor
('knowledge_contributor','institution','Institution details',10,true,
 '[{"name":"institution_name","label":"University / KVK / institute","type":"text","required":true,"maxLength":150},{"name":"institution_kind","label":"Institution type","type":"select","required":true,"options":["University","KVK","ICAR institute","State department","Private research body"]},{"name":"district_code","label":"District","type":"geography","level":"district","required":true}]'::jsonb,
 '[]'::jsonb,null),
('knowledge_contributor','expertise','Expertise and contribution area',20,true,
 '[{"name":"contributor_name","label":"Contributor name","type":"text","required":true,"maxLength":100},{"name":"designation","label":"Designation","type":"text","required":true,"maxLength":80},{"name":"domains","label":"Advisory domains","type":"select","required":true,"options":["Crop agronomy","Soil health","Pest and disease","Post-harvest","Agri-business"]},{"name":"credentials","label":"Credentials summary","type":"textarea","required":true,"maxLength":600}]'::jsonb,
 '[{"code":"credential_proof","label":"Credential proof","optional_in_sandbox":true}]'::jsonb,
 'Published advisories require reviewer approval; submission alone does not publish content.'),
('knowledge_contributor','review','Review and submit',30,true,'[]'::jsonb,'[]'::jsonb,null),

-- knowledge reviewer
('knowledge_reviewer','institution','Reviewer affiliation',10,true,
 '[{"name":"institution_name","label":"Institution","type":"text","required":true,"maxLength":150},{"name":"reviewer_name","label":"Reviewer name","type":"text","required":true,"maxLength":100},{"name":"designation","label":"Designation","type":"text","required":true,"maxLength":80},{"name":"district_code","label":"District","type":"geography","level":"district","required":true}]'::jsonb,
 '[{"code":"credential_proof","label":"Credential proof","optional_in_sandbox":true}]'::jsonb,null),
('knowledge_reviewer','scope','Review scope',20,true,
 '[{"name":"review_domains","label":"Domains you can review","type":"select","required":true,"options":["Crop agronomy","Soil health","Pest and disease","Post-harvest","Agri-business"]},{"name":"experience_years","label":"Years of experience","type":"number","required":true,"min":1,"max":60}]'::jsonb,
 '[]'::jsonb,'Reviewer rights are granted by a platform human decision, not by submission.'),
('knowledge_reviewer','review','Review and submit',30,true,'[]'::jsonb,'[]'::jsonb,null),

-- post-harvest provider admin
('postharvest_provider_admin','business','Business details',10,true,
 '[{"name":"business_name","label":"Business name","type":"text","required":true,"maxLength":150},{"name":"registration_no","label":"Registration / GSTIN","type":"text","required":true,"maxLength":50},{"name":"district_code","label":"District","type":"geography","level":"district","required":true}]'::jsonb,
 '[{"code":"registration_certificate","label":"Registration certificate","optional_in_sandbox":true}]'::jsonb,null),
('postharvest_provider_admin','facility','Facility and service capability',20,true,
 '[{"name":"facility_kind","label":"Facility type","type":"select","required":true,"options":["Warehouse","Cold storage","Grading and sorting","Packhouse","Processing unit"]},{"name":"capacity_mt","label":"Capacity (MT)","type":"number","required":true,"min":1,"max":100000},{"name":"licence_no","label":"Licence number","type":"text","required":true,"maxLength":60},{"name":"contact_phone","label":"Contact mobile","type":"tel","required":true,"pattern":"^[0-9]{10}$"}]'::jsonb,
 '[{"code":"facility_licence","label":"Facility licence","optional_in_sandbox":true}]'::jsonb,
 'Listing goes live only after a human verification decision.'),
('postharvest_provider_admin','review','Review and submit',30,true,'[]'::jsonb,'[]'::jsonb,null),

-- talent operator
('talent_operator','operator','Operator details',10,true,
 '[{"name":"operator_name","label":"Your name","type":"text","required":true,"maxLength":100},{"name":"organisation","label":"Organisation","type":"text","required":true,"maxLength":150},{"name":"official_email","label":"Official email","type":"text","required":true,"maxLength":120},{"name":"district_code","label":"Base district","type":"geography","level":"district","required":true}]'::jsonb,
 '[]'::jsonb,null),
('talent_operator','scope','Operating scope',20,true,
 '[{"name":"scope","label":"Scope requested","type":"select","required":true,"options":["Course and certification review","Employer verification","Candidate support","All talent operations"]},{"name":"justification","label":"Justification","type":"textarea","required":true,"maxLength":600}]'::jsonb,
 '[{"code":"authorisation_letter","label":"Authorisation letter","optional_in_sandbox":true}]'::jsonb,
 'Talent operator rights are granted by a platform human decision.'),
('talent_operator','review','Review and submit',30,true,'[]'::jsonb,'[]'::jsonb,null),

-- employment exchange admin
('employment_exchange_admin','office','Exchange office details',10,true,
 '[{"name":"exchange_name","label":"Employment exchange / office","type":"text","required":true,"maxLength":150},{"name":"admin_name","label":"Administrator name","type":"text","required":true,"maxLength":100},{"name":"designation","label":"Designation","type":"text","required":true,"maxLength":80},{"name":"district_code","label":"District","type":"geography","level":"district","required":true}]'::jsonb,
 '[{"code":"posting_order","label":"Posting / authorisation order","optional_in_sandbox":true}]'::jsonb,null),
('employment_exchange_admin','integration','Integration scope',20,true,
 '[{"name":"integration_kind","label":"Integration required","type":"select","required":true,"options":["Job listing sync","Candidate referral sync","Training placement reporting","All of the above"]},{"name":"volume_estimate","label":"Estimated monthly records","type":"number","required":true,"min":1,"max":100000},{"name":"contact_phone","label":"Contact mobile","type":"tel","required":true,"pattern":"^[0-9]{10}$"}]'::jsonb,
 '[]'::jsonb,'Exchange integrations run through adapters; no live government system is connected in this baseline.'),
('employment_exchange_admin','review','Review and submit',30,true,'[]'::jsonb,'[]'::jsonb,null)

on conflict (role_code, step_key) do update set
  label = excluded.label,
  sort_order = excluded.sort_order,
  is_required = excluded.is_required,
  fields = excluded.fields,
  evidence_required = excluded.evidence_required,
  help_text = excluded.help_text;