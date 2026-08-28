-- 1. Activation flags (development + sandbox only)
UPDATE public.feature_flags
SET enabled = true, environments = '["development","sandbox"]'::jsonb
WHERE key IN ('talent.domain','talent.candidate_profiles','talent.training_partners','talent.employers');

-- 2. Role catalogue: candidate + training partner wording
UPDATE public.role_definitions
SET label = 'Agri Student / Job Seeker',
    description = 'Talent individual. Self-service profile; no institutional verification required. Tenancy is not provisioned at this stage.',
    authority_note = 'Complete when profile, training/certification interest and job preference are captured. Profile stays hidden until the candidate consents to visibility.',
    is_public_selectable = true,
    is_active = true
WHERE code = 'talent_candidate';

UPDATE public.role_definitions
SET label = 'Training / Certification Partner',
    description = 'Talent institution. Institution verification required. Tenancy is provisioned later, separately from this profile.',
    authority_note = 'Complete on an approved course/certification listing. Approval is a human decision by the talent operator or platform admin; certifications may be issued only for its own approved courses.',
    is_public_selectable = true,
    is_active = true
WHERE code = 'training_partner_admin';

-- Retire the combined employer/recruiter card (kept for existing references)
UPDATE public.role_definitions
SET is_public_selectable = false,
    is_active = false,
    description = 'Retired: replaced by the separate Recruiter / HR Agency and Employer / Company / Startup journeys.'
WHERE code = 'employer_recruiter';

-- 3. Two new cards bound to the existing employer_recruiter authority
INSERT INTO public.role_definitions
  (code, label, description, journey_kind, app_role_binding, tenant_type_scope,
   is_public_selectable, feature_flag_key, authority_note, sort_order, is_custom, is_active)
VALUES
  ('recruiter_agency', 'Recruiter / HR Agency',
   'Talent intermediary. Institution verification required. Tenancy is provisioned later, separately from this profile.',
   'onboarding', 'employer_recruiter', NULL, true, 'talent.employers',
   'Complete on a verified recruiter plus at least one role listing. No direct access to candidate profiles; consented referrals only.',
   631, false, true),
  ('employer_company', 'Employer / Company / Startup',
   'Talent employer. Institution verification required. Tenancy is provisioned later, separately from this profile.',
   'onboarding', 'employer_recruiter', NULL, true, 'talent.employers',
   'Complete on a verified employer plus a job requisition. No direct access to candidate profiles; consented referrals only.',
   632, false, true)
ON CONFLICT (code) DO UPDATE
SET label = EXCLUDED.label,
    description = EXCLUDED.description,
    app_role_binding = EXCLUDED.app_role_binding,
    is_public_selectable = EXCLUDED.is_public_selectable,
    feature_flag_key = EXCLUDED.feature_flag_key,
    authority_note = EXCLUDED.authority_note,
    sort_order = EXCLUDED.sort_order,
    is_active = true;

-- 4. Configured onboarding steps
INSERT INTO public.onboarding_step_definitions
  (role_code, step_key, label, help_text, sort_order, is_required, fields, evidence_required)
VALUES
-- Agri Student / Job Seeker (self-service)
('talent_candidate','identity','About you','Self-service. No institutional verification at this stage.',10,true,
 '[{"name":"full_name","type":"text","label":"Full name","required":true,"maxLength":100},
   {"name":"phone","type":"tel","label":"Mobile number","pattern":"^[0-9]{10}$","required":true},
   {"name":"district_code","type":"geography","label":"District","level":"district","required":true},
   {"name":"preferred_language","type":"select","label":"Preferred language","options":["English","Telugu","Hindi"],"required":true}]'::jsonb,'[]'::jsonb),
('talent_candidate','education','Education','Highest qualification and institution.',20,true,
 '[{"name":"qualification","type":"select","label":"Highest qualification","options":["10th","12th","ITI/Diploma","B.Sc Agriculture","M.Sc Agriculture","Other"],"required":true},
   {"name":"institution_name","type":"text","label":"Institution","required":true,"maxLength":150},
   {"name":"year_of_completion","type":"number","label":"Year of completion","min":1980,"max":2035,"required":false}]'::jsonb,'[]'::jsonb),
('talent_candidate','skills','Skills and certifications held',NULL,30,false,
 '[{"name":"skills","type":"multiselect","label":"Skills","options":["Agronomy","Soil testing","Farm machinery","Post-harvest handling","Cold chain","Agri sales","Data entry","Extension outreach"],"required":false},
   {"name":"certifications_held","type":"textarea","label":"Certifications already held","required":false,"maxLength":300}]'::jsonb,
 '[{"code":"certificate","label":"Certificate copy","optional_in_sandbox":true}]'::jsonb),
('talent_candidate','preferences','Training and job preferences','Both a training/certification interest and a job preference are needed to complete the profile.',40,true,
 '[{"name":"training_interest","type":"multiselect","label":"Training / certification interest","options":["Agronomy practices","Soil health","Farm mechanisation","Post-harvest management","Agri business","Agri data and digital tools"],"required":true},
   {"name":"job_preference","type":"multiselect","label":"Preferred roles","options":["Field officer","Agronomist","Sales/BD","Warehouse and post-harvest","Quality inspection","Data and MIS","Internship/apprenticeship"],"required":true},
   {"name":"preferred_locations","type":"text","label":"Preferred work locations","required":false,"maxLength":150}]'::jsonb,'[]'::jsonb),
('talent_candidate','visibility_consent','Profile visibility','Your profile stays hidden until you choose who may see it.',50,true,
 '[{"name":"visibility","type":"select","label":"Who may see your profile","options":["hidden","platform_only","employers_optin"],"required":true},
   {"name":"purposes","type":"multiselect","label":"Purposes you consent to","options":["talent_profile_visibility","training_enrolment","employer_referral"],"required":true}]'::jsonb,'[]'::jsonb),
('talent_candidate','review','Review and submit',NULL,60,true,'[]'::jsonb,'[]'::jsonb),

-- Training / Certification Partner (partner onboarding, institution verification)
('training_partner_admin','institution','Institution details',NULL,10,true,
 '[{"name":"institution_name","type":"text","label":"Institution name","required":true,"maxLength":150},
   {"name":"institution_kind","type":"select","label":"Institution type","options":["University","KVK","Skill development centre","Private training institute","Certification body"],"required":true},
   {"name":"registration_no","type":"text","label":"Registration number","required":true,"maxLength":50},
   {"name":"district_code","type":"geography","label":"District","level":"district","required":true}]'::jsonb,'[]'::jsonb),
('training_partner_admin','accreditation','Accreditation and approvals','Institution verification is a human decision; submission does not approve the partner.',20,true,
 '[{"name":"accreditation_body","type":"text","label":"Accrediting body","required":true,"maxLength":150},
   {"name":"accreditation_ref","type":"text","label":"Accreditation reference","required":true,"maxLength":80}]'::jsonb,
 '[{"code":"registration_certificate","label":"Registration certificate","optional_in_sandbox":true},
   {"code":"accreditation_certificate","label":"Accreditation certificate","optional_in_sandbox":true}]'::jsonb),
('training_partner_admin','signatory','Authorised signatory',NULL,30,true,
 '[{"name":"signatory_name","type":"text","label":"Authorised signatory","required":true,"maxLength":100},
   {"name":"signatory_designation","type":"text","label":"Designation","required":true,"maxLength":80},
   {"name":"signatory_phone","type":"tel","label":"Signatory mobile","pattern":"^[0-9]{10}$","required":true}]'::jsonb,'[]'::jsonb),
('training_partner_admin','course_listing','Course / certification listing','Completion criterion: at least one course or certification listing approved by a reviewer.',40,true,
 '[{"name":"course_title","type":"text","label":"Course / certification title","required":true,"maxLength":150},
   {"name":"mode","type":"select","label":"Delivery mode","options":["Classroom","Online","Blended","On-farm"],"required":true},
   {"name":"duration_hours","type":"number","label":"Duration (hours)","min":1,"max":2000,"required":true},
   {"name":"certification_offered","type":"select","label":"Certification offered","options":["Yes","No"],"required":true},
   {"name":"course_outline","type":"textarea","label":"Course outline","required":true,"maxLength":600}]'::jsonb,
 '[{"code":"course_syllabus","label":"Course syllabus","optional_in_sandbox":true}]'::jsonb),
('training_partner_admin','review','Review and submit',NULL,50,true,'[]'::jsonb,'[]'::jsonb),

-- Recruiter / HR Agency (business onboarding, institution verification)
('recruiter_agency','business','Agency details',NULL,10,true,
 '[{"name":"agency_name","type":"text","label":"Agency name","required":true,"maxLength":150},
   {"name":"registration_no","type":"text","label":"Business registration number","required":true,"maxLength":50},
   {"name":"gstin","type":"text","label":"GSTIN (optional)","required":false,"maxLength":20},
   {"name":"district_code","type":"geography","label":"District","level":"district","required":true}]'::jsonb,'[]'::jsonb),
('recruiter_agency','verification','Verification evidence','Recruiter verification is a human decision; submission does not verify the agency.',20,true,
 '[{"name":"years_in_operation","type":"number","label":"Years in operation","min":0,"max":100,"required":true},
   {"name":"sectors_served","type":"multiselect","label":"Sectors served","options":["Agri inputs","Agri processing","Agri logistics","Agri retail","Agri technology"],"required":true}]'::jsonb,
 '[{"code":"registration_certificate","label":"Business registration certificate","optional_in_sandbox":true}]'::jsonb),
('recruiter_agency','authorisation','Recruiter authorisation','Named recruiter authorised to act for the agency.',30,true,
 '[{"name":"recruiter_name","type":"text","label":"Authorised recruiter","required":true,"maxLength":100},
   {"name":"recruiter_designation","type":"text","label":"Designation","required":true,"maxLength":80},
   {"name":"recruiter_phone","type":"tel","label":"Recruiter mobile","pattern":"^[0-9]{10}$","required":true},
   {"name":"client_authorisation","type":"select","label":"Authorised to recruit on behalf of client employers","options":["Yes","No"],"required":true}]'::jsonb,
 '[{"code":"authorisation_letter","label":"Client authorisation letter","optional_in_sandbox":true}]'::jsonb),
('recruiter_agency','role_listing','Role listing','Completion criterion: verified recruiter plus at least one role listing.',40,true,
 '[{"name":"role_title","type":"text","label":"Role title","required":true,"maxLength":150},
   {"name":"hiring_for","type":"text","label":"Hiring for (employer)","required":true,"maxLength":150},
   {"name":"positions","type":"number","label":"Number of positions","min":1,"max":500,"required":true},
   {"name":"location","type":"text","label":"Work location","required":true,"maxLength":150},
   {"name":"role_description","type":"textarea","label":"Role description","required":true,"maxLength":600}]'::jsonb,'[]'::jsonb),
('recruiter_agency','review','Review and submit',NULL,50,true,'[]'::jsonb,'[]'::jsonb),

-- Employer / Company / Startup (business onboarding, institution verification)
('employer_company','business','Company details',NULL,10,true,
 '[{"name":"company_name","type":"text","label":"Company name","required":true,"maxLength":150},
   {"name":"company_kind","type":"select","label":"Organisation type","options":["Company","Startup","FPO","Cooperative","NGO","Government body"],"required":true},
   {"name":"registration_no","type":"text","label":"Registration / CIN","required":true,"maxLength":50},
   {"name":"district_code","type":"geography","label":"District","level":"district","required":true}]'::jsonb,'[]'::jsonb),
('employer_company','verification','Verification evidence','Employer verification is a human decision; submission does not verify the employer.',20,true,
 '[{"name":"employee_count","type":"select","label":"Employee count","options":["1-10","11-50","51-200","201-1000","1000+"],"required":true},
   {"name":"business_lines","type":"multiselect","label":"Business lines","options":["Agri inputs","Agri processing","Agri logistics","Agri retail","Agri technology","Post-harvest and storage"],"required":true}]'::jsonb,
 '[{"code":"registration_certificate","label":"Registration certificate","optional_in_sandbox":true}]'::jsonb),
('employer_company','hiring_contact','Hiring contact',NULL,30,true,
 '[{"name":"contact_name","type":"text","label":"Hiring contact","required":true,"maxLength":100},
   {"name":"contact_designation","type":"text","label":"Designation","required":true,"maxLength":80},
   {"name":"contact_phone","type":"tel","label":"Contact mobile","pattern":"^[0-9]{10}$","required":true}]'::jsonb,'[]'::jsonb),
('employer_company','job_requisition','Job requisition','Completion criterion: verified employer plus a job requisition.',40,true,
 '[{"name":"job_title","type":"text","label":"Job title","required":true,"maxLength":150},
   {"name":"employment_type","type":"select","label":"Employment type","options":["Full time","Part time","Contract","Internship","Apprenticeship"],"required":true},
   {"name":"positions","type":"number","label":"Number of positions","min":1,"max":500,"required":true},
   {"name":"location","type":"text","label":"Work location","required":true,"maxLength":150},
   {"name":"skills_required","type":"multiselect","label":"Skills required","options":["Agronomy","Soil testing","Farm machinery","Post-harvest handling","Cold chain","Agri sales","Data entry","Extension outreach"],"required":true},
   {"name":"job_description","type":"textarea","label":"Job description","required":true,"maxLength":600}]'::jsonb,'[]'::jsonb),
('employer_company','review','Review and submit',NULL,50,true,'[]'::jsonb,'[]'::jsonb)
ON CONFLICT (role_code, step_key) DO UPDATE
SET label = EXCLUDED.label,
    help_text = EXCLUDED.help_text,
    sort_order = EXCLUDED.sort_order,
    is_required = EXCLUDED.is_required,
    fields = EXCLUDED.fields,
    evidence_required = EXCLUDED.evidence_required,
    updated_at = now();