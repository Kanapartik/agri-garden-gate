-- role_definitions: allow super admin to define new roles bound to a base authority
ALTER TABLE public.role_definitions
  ADD COLUMN IF NOT EXISTS app_role_binding app_role,
  ADD COLUMN IF NOT EXISTS tenant_type_scope tenant_type,
  ADD COLUMN IF NOT EXISTS is_custom boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

GRANT SELECT ON public.role_definitions TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.role_definitions TO authenticated;
GRANT ALL ON public.role_definitions TO service_role;

UPDATE public.role_definitions SET app_role_binding = 'field_agent' WHERE code = 'field_agent' AND app_role_binding IS NULL;
UPDATE public.role_definitions SET app_role_binding = 'tenant_admin' WHERE code IN ('fpo','bank_officer','insurer_officer','training_partner_admin','postharvest_provider_admin') AND app_role_binding IS NULL;
UPDATE public.role_definitions SET app_role_binding = 'scheme_publisher' WHERE code = 'govt_officer' AND app_role_binding IS NULL;
UPDATE public.role_definitions SET app_role_binding = 'state_admin' WHERE code = 'state_admin' AND app_role_binding IS NULL;
UPDATE public.role_definitions SET app_role_binding = 'knowledge_contributor' WHERE code = 'knowledge_contributor' AND app_role_binding IS NULL;
UPDATE public.role_definitions SET app_role_binding = 'knowledge_reviewer' WHERE code = 'knowledge_reviewer' AND app_role_binding IS NULL;
UPDATE public.role_definitions SET app_role_binding = 'researcher' WHERE code = 'researcher' AND app_role_binding IS NULL;
UPDATE public.role_definitions SET app_role_binding = 'policymaker' WHERE code = 'policymaker' AND app_role_binding IS NULL;
UPDATE public.role_definitions SET app_role_binding = 'talent_candidate' WHERE code = 'talent_candidate' AND app_role_binding IS NULL;
UPDATE public.role_definitions SET app_role_binding = 'employer_recruiter' WHERE code = 'employer_recruiter' AND app_role_binding IS NULL;
UPDATE public.role_definitions SET app_role_binding = 'employment_exchange_admin' WHERE code = 'employment_exchange_admin' AND app_role_binding IS NULL;
UPDATE public.role_definitions SET app_role_binding = 'talent_operator' WHERE code = 'talent_operator' AND app_role_binding IS NULL;

-- Geography: Andhra Pradesh + additional Telangana districts (synthetic)
WITH ind AS (SELECT id FROM public.geographies WHERE code = 'IN')
INSERT INTO public.geographies (code, name, level, parent_id)
SELECT 'IN-AP', 'Andhra Pradesh (synthetic)', 'state', ind.id FROM ind
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.geographies (code, name, level, parent_id)
SELECT v.code, v.name, 'district', g.id
FROM (VALUES
  ('IN-AP-GNT','Guntur (synthetic)','IN-AP'),
  ('IN-AP-KRI','Krishna (synthetic)','IN-AP'),
  ('IN-AP-KNL','Kurnool (synthetic)','IN-AP'),
  ('IN-AP-ATP','Anantapur (synthetic)','IN-AP'),
  ('IN-AP-SPSR','Nellore (synthetic)','IN-AP'),
  ('IN-TS-NZB','Nizamabad (synthetic)','IN-TS'),
  ('IN-TS-MDK','Medak (synthetic)','IN-TS'),
  ('IN-TS-HYD','Hyderabad (synthetic)','IN-TS')
) AS v(code, name, parent)
JOIN public.geographies g ON g.code = v.parent
ON CONFLICT (code) DO NOTHING;

-- Tenants across Andhra Pradesh and Telangana (synthetic)
INSERT INTO public.tenants (id, name, slug, tenant_type, region_code, status) VALUES
  ('aaaa1111-0000-4000-8000-000000000001','Guntur Chilli Growers FPO','guntur-chilli-fpo','fpo','IN-AP-GNT','active'),
  ('aaaa1111-0000-4000-8000-000000000002','Karimnagar Paddy Producers FPO','karimnagar-paddy-fpo','fpo','IN-TS-KRM','active'),
  ('bbbb2222-0000-4000-8000-000000000001','Krishna Grameena Bank','krishna-grameena-bank','bank','IN-AP-KRI','active'),
  ('cccc3333-0000-4000-8000-000000000001','Telangana Agri Suraksha Insurance','telangana-agri-suraksha','insurer','IN-TS','active'),
  ('dddd4444-0000-4000-8000-000000000001','AP Department of Agriculture','ap-dept-agriculture','govt_dept','IN-AP','active'),
  ('dddd4444-0000-4000-8000-000000000002','Telangana Department of Agriculture','ts-dept-agriculture','govt_dept','IN-TS','active'),
  ('eeee5555-0000-4000-8000-000000000001','Deccan AgriTech Labs, Hyderabad','deccan-agritech-labs','agri_business','IN-TS-HYD','active'),
  ('eeee5555-0000-4000-8000-000000000002','Nellore Cold Chain Services','nellore-cold-chain','agri_business','IN-AP-SPSR','active'),
  ('eeee5555-0000-4000-8000-000000000003','Medak Custom Hiring Centre','medak-chc','agri_business','IN-TS-MDK','active'),
  ('eeee5555-0000-4000-8000-000000000004','Hyderabad Agri Skills Academy','hyd-agri-skills','agri_business','IN-TS-HYD','active')
ON CONFLICT (id) DO NOTHING;

-- Organizations already approved and mapped to those tenants
INSERT INTO public.organizations (legal_name, display_name, subtype_code, region_code, status, tenant_id, is_synthetic, geography_id)
SELECT v.legal, v.display, v.subtype, v.region, 'approved'::org_status, v.tenant::uuid, true, g.id
FROM (VALUES
  ('Guntur Chilli Growers Producer Company Ltd','Guntur Chilli Growers FPO','fpo_registered','IN-AP-GNT','aaaa1111-0000-4000-8000-000000000001'),
  ('Karimnagar Paddy Producers Company Ltd','Karimnagar Paddy Producers FPO','fpo_registered','IN-TS-KRM','aaaa1111-0000-4000-8000-000000000002'),
  ('Krishna Grameena Bank Ltd','Krishna Grameena Bank','bank_branch','IN-AP-KRI','bbbb2222-0000-4000-8000-000000000001'),
  ('Telangana Agri Suraksha General Insurance Ltd','Telangana Agri Suraksha Insurance','insurer','IN-TS','cccc3333-0000-4000-8000-000000000001'),
  ('Government of Andhra Pradesh, Dept of Agriculture','AP Department of Agriculture','govt_dept','IN-AP','dddd4444-0000-4000-8000-000000000001'),
  ('Government of Telangana, Dept of Agriculture','Telangana Department of Agriculture','govt_dept','IN-TS','dddd4444-0000-4000-8000-000000000002'),
  ('Deccan AgriTech Labs Pvt Ltd','Deccan AgriTech Labs, Hyderabad','agri_business','IN-TS-HYD','eeee5555-0000-4000-8000-000000000001')
) AS v(legal, display, subtype, region, tenant)
LEFT JOIN public.geographies g ON g.code = v.region
WHERE NOT EXISTS (SELECT 1 FROM public.organizations o WHERE o.tenant_id = v.tenant::uuid);

-- Profiles for the synthetic personas (names from AP/Telangana)
INSERT INTO public.profiles (id, full_name, phone) VALUES
  ('46efd841-da89-4edc-9d4b-c983b359754c','Kalyan Kanaparti','+91-90000-00001'),
  ('69225c73-6a44-41af-87ef-5ddc97dfd059','Sarojini Devi Yerram','+91-90000-00002'),
  ('1dcb411e-6d03-4af3-9d81-aca126342911','Rajasekhar Reddy Bandi','+91-90000-00003'),
  ('cd943648-c375-41ca-ab82-1a971425459f','Anusha Pothuraju','+91-90000-00004'),
  ('bd8d6bdf-a168-41ce-b1a4-fcc1586d68df','Venkata Ramana Chowdary','+91-90000-00005'),
  ('45a39d31-57a6-4cd6-a33f-62952ca33f7a','Lakshmi Prasanna Gadde','+91-90000-00006'),
  ('0b5af7d4-f305-48c5-b5aa-c21e040bedcf','Srinivas Rao Kolli','+91-90000-00007'),
  ('0fd06fa6-8d56-4cf7-85b3-a3b467a26072','Bhoomaiah Gollapally','+91-90000-00008'),
  ('019af305-3d2b-4a28-be80-254793b3afac','Naga Malleswari Vemuri','+91-90000-00009'),
  ('0a5fae8d-99ad-43f3-9647-bb0c7ed59ba5','Harish Chandra Adusumilli','+91-90000-00010'),
  ('497cfc69-615f-49c3-bd69-5e2cd593726d','Sridhar Reddy Mekala','+91-90000-00011'),
  ('6e3919d0-77f9-4bb5-85f1-1dc7e7cbda64','Padmavathi Ganta','+91-90000-00012'),
  ('f08699b1-5a97-4de2-8cb7-29fe4b84b507','Kishore Kumar Nalla','+91-90000-00013'),
  ('ee0b9a5b-6ff7-4231-ab99-409625231bfb','Subba Rao Pinnamaneni','+91-90000-00014'),
  ('5f1d2e33-2020-41fb-8701-5ba9aa1ad994','Sai Krishna Boddu','+91-90000-00015'),
  ('d41ed2ca-7d53-49d7-aa3a-9965217d86bd','Ramadevi Chintala','+91-90000-00016'),
  ('da1e380a-409b-43c3-84b2-9d4011e3b15d','Dr. Mohan Rao Sanka','+91-90000-00017'),
  ('9650169e-25d3-4f47-8bc8-e064129bb84f','Dr. Swapna Yadlapalli','+91-90000-00018'),
  ('af5b690b-9c2f-4014-80b6-9811c252b752','Ravi Kumar Yalamanchili','+91-90000-00019'),
  ('7ace9bcf-5077-4576-bde8-fe16c001e60a','Anjaneyulu Mudigonda','+91-90000-00020'),
  ('64bee8f0-2a6b-470d-b9a6-439e8b9a79f6','Sujatha Bhoomireddy','+91-90000-00021'),
  ('5de13aed-acac-4a3d-b8da-ad12b31bbb85','Narsimha Rao Kandukuri','+91-90000-00022'),
  ('d2ca404c-2be8-4cc4-93db-f5fb6002cc57','Kiran Kumar Peddineni','+91-90000-00023'),
  ('12076b01-085e-4c82-aede-74652f5aee5a','Vijaya Lakshmi Rachakonda','+91-90000-00024'),
  ('40b4424c-a650-46e4-99c3-91f6046b1332','Prasad Babu Tammineni','+91-90000-00025'),
  ('ec34e01e-1f47-44bd-8f9d-efb1138dc3b0','Ganesh Varma Chodavarapu','+91-90000-00026'),
  ('998bf5c1-b863-4eb5-b40c-e343f86e9973','Yadagiri Boinapally','+91-90000-00027')
ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;

-- Tenant memberships
INSERT INTO public.tenant_members (tenant_id, user_id, status) VALUES
  ('11111111-1111-1111-1111-111111111111','46efd841-da89-4edc-9d4b-c983b359754c','active'),
  ('11111111-1111-1111-1111-111111111111','69225c73-6a44-41af-87ef-5ddc97dfd059','active'),
  ('11111111-1111-1111-1111-111111111111','1dcb411e-6d03-4af3-9d81-aca126342911','active'),
  ('11111111-1111-1111-1111-111111111111','cd943648-c375-41ca-ab82-1a971425459f','active'),
  ('11111111-1111-1111-1111-111111111111','d41ed2ca-7d53-49d7-aa3a-9965217d86bd','active'),
  ('aaaa1111-0000-4000-8000-000000000001','bd8d6bdf-a168-41ce-b1a4-fcc1586d68df','active'),
  ('aaaa1111-0000-4000-8000-000000000001','45a39d31-57a6-4cd6-a33f-62952ca33f7a','active'),
  ('aaaa1111-0000-4000-8000-000000000001','0b5af7d4-f305-48c5-b5aa-c21e040bedcf','active'),
  ('aaaa1111-0000-4000-8000-000000000002','0fd06fa6-8d56-4cf7-85b3-a3b467a26072','active'),
  ('bbbb2222-0000-4000-8000-000000000001','019af305-3d2b-4a28-be80-254793b3afac','active'),
  ('bbbb2222-0000-4000-8000-000000000001','0a5fae8d-99ad-43f3-9647-bb0c7ed59ba5','active'),
  ('cccc3333-0000-4000-8000-000000000001','497cfc69-615f-49c3-bd69-5e2cd593726d','active'),
  ('dddd4444-0000-4000-8000-000000000001','6e3919d0-77f9-4bb5-85f1-1dc7e7cbda64','active'),
  ('dddd4444-0000-4000-8000-000000000001','ee0b9a5b-6ff7-4231-ab99-409625231bfb','active'),
  ('dddd4444-0000-4000-8000-000000000002','f08699b1-5a97-4de2-8cb7-29fe4b84b507','active'),
  ('eeee5555-0000-4000-8000-000000000001','5f1d2e33-2020-41fb-8701-5ba9aa1ad994','active'),
  ('eeee5555-0000-4000-8000-000000000002','ec34e01e-1f47-44bd-8f9d-efb1138dc3b0','active'),
  ('eeee5555-0000-4000-8000-000000000003','998bf5c1-b863-4eb5-b40c-e343f86e9973','active'),
  ('eeee5555-0000-4000-8000-000000000004','12076b01-085e-4c82-aede-74652f5aee5a','active'),
  ('eeee5555-0000-4000-8000-000000000004','40b4424c-a650-46e4-99c3-91f6046b1332','active')
ON CONFLICT (tenant_id, user_id) DO NOTHING;

-- Role grants: one live persona per available role
INSERT INTO public.user_roles (user_id, tenant_id, role) VALUES
  ('46efd841-da89-4edc-9d4b-c983b359754c', NULL, 'platform_admin'),
  ('69225c73-6a44-41af-87ef-5ddc97dfd059', NULL, 'auditor'),
  ('1dcb411e-6d03-4af3-9d81-aca126342911', NULL, 'expansion_manager'),
  ('cd943648-c375-41ca-ab82-1a971425459f', NULL, 'support_agent'),
  ('d41ed2ca-7d53-49d7-aa3a-9965217d86bd', NULL, 'market_operator'),
  ('da1e380a-409b-43c3-84b2-9d4011e3b15d', NULL, 'knowledge_contributor'),
  ('9650169e-25d3-4f47-8bc8-e064129bb84f', NULL, 'researcher'),
  ('ee0b9a5b-6ff7-4231-ab99-409625231bfb', NULL, 'state_admin'),
  ('d2ca404c-2be8-4cc4-93db-f5fb6002cc57', NULL, 'talent_candidate'),
  ('bd8d6bdf-a168-41ce-b1a4-fcc1586d68df','aaaa1111-0000-4000-8000-000000000001','tenant_admin'),
  ('45a39d31-57a6-4cd6-a33f-62952ca33f7a','aaaa1111-0000-4000-8000-000000000001','onboarding_officer'),
  ('0b5af7d4-f305-48c5-b5aa-c21e040bedcf','aaaa1111-0000-4000-8000-000000000001','field_agent'),
  ('0fd06fa6-8d56-4cf7-85b3-a3b467a26072','aaaa1111-0000-4000-8000-000000000002','tenant_admin'),
  ('019af305-3d2b-4a28-be80-254793b3afac','bbbb2222-0000-4000-8000-000000000001','tenant_admin'),
  ('019af305-3d2b-4a28-be80-254793b3afac','bbbb2222-0000-4000-8000-000000000001','consumer_api_manager'),
  ('0a5fae8d-99ad-43f3-9647-bb0c7ed59ba5','bbbb2222-0000-4000-8000-000000000001','partner_developer'),
  ('497cfc69-615f-49c3-bd69-5e2cd593726d','cccc3333-0000-4000-8000-000000000001','tenant_admin'),
  ('6e3919d0-77f9-4bb5-85f1-1dc7e7cbda64','dddd4444-0000-4000-8000-000000000001','scheme_publisher'),
  ('f08699b1-5a97-4de2-8cb7-29fe4b84b507','dddd4444-0000-4000-8000-000000000002','scheme_reviewer'),
  ('5f1d2e33-2020-41fb-8701-5ba9aa1ad994','eeee5555-0000-4000-8000-000000000001','partner_developer'),
  ('ec34e01e-1f47-44bd-8f9d-efb1138dc3b0','eeee5555-0000-4000-8000-000000000002','postharvest_provider_admin'),
  ('998bf5c1-b863-4eb5-b40c-e343f86e9973','eeee5555-0000-4000-8000-000000000003','service_provider_admin'),
  ('12076b01-085e-4c82-aede-74652f5aee5a','eeee5555-0000-4000-8000-000000000004','training_partner_admin'),
  ('40b4424c-a650-46e4-99c3-91f6046b1332','eeee5555-0000-4000-8000-000000000004','employer_recruiter'),
  ('f08699b1-5a97-4de2-8cb7-29fe4b84b507', NULL, 'knowledge_reviewer'),
  ('ee0b9a5b-6ff7-4231-ab99-409625231bfb', NULL, 'policymaker')
ON CONFLICT DO NOTHING;

-- Farmer roster + farm records (AP/Telangana villages)
INSERT INTO public.fpo_members (tenant_id, member_ref, display_name, contact_hint, village_code, farmer_user_id, status, is_synthetic) VALUES
  ('aaaa1111-0000-4000-8000-000000000001','GNT-0001','Ravi Kumar Yalamanchili','+91-90000-00019','IN-AP-GNT','af5b690b-9c2f-4014-80b6-9811c252b752','active',true),
  ('aaaa1111-0000-4000-8000-000000000001','GNT-0002','Sujatha Bhoomireddy','+91-90000-00021','IN-AP-KNL','64bee8f0-2a6b-470d-b9a6-439e8b9a79f6','active',true),
  ('aaaa1111-0000-4000-8000-000000000002','KRM-0001','Anjaneyulu Mudigonda','+91-90000-00020','IN-TS-WGL','7ace9bcf-5077-4576-bde8-fe16c001e60a','active',true),
  ('aaaa1111-0000-4000-8000-000000000002','KRM-0002','Narsimha Rao Kandukuri','+91-90000-00022','IN-TS-NZB','5de13aed-acac-4a3d-b8da-ad12b31bbb85','active',true)
ON CONFLICT DO NOTHING;

INSERT INTO public.farm_records (farmer_user_id, channel, client_draft_id, label, village_code, plot_ref, area_acres, primary_crop, boundary, centroid_lat, centroid_lng, sync_state, is_synthetic)
VALUES
  ('af5b690b-9c2f-4014-80b6-9811c252b752','self_service','seed-gnt-1','Chilli block A','IN-AP-GNT','GNT/114/2A',3.4,'Chilli','[{"lat":16.31,"lng":80.44},{"lat":16.31,"lng":80.45},{"lat":16.30,"lng":80.45},{"lat":16.30,"lng":80.44}]'::jsonb,16.305,80.445,'synced',true),
  ('64bee8f0-2a6b-470d-b9a6-439e8b9a79f6','fpo_assisted','seed-knl-1','Groundnut plot','IN-AP-KNL','KNL/87/1',2.1,'Groundnut','[{"lat":15.83,"lng":78.04},{"lat":15.83,"lng":78.05},{"lat":15.82,"lng":78.05},{"lat":15.82,"lng":78.04}]'::jsonb,15.825,78.045,'synced',true),
  ('7ace9bcf-5077-4576-bde8-fe16c001e60a','field_agent_assisted','seed-wgl-1','Paddy field east','IN-TS-WGL','WGL/45/3B',4.8,'Paddy','[{"lat":17.98,"lng":79.59},{"lat":17.98,"lng":79.60},{"lat":17.97,"lng":79.60},{"lat":17.97,"lng":79.59}]'::jsonb,17.975,79.595,'synced',true),
  ('5de13aed-acac-4a3d-b8da-ad12b31bbb85','govt_camp_assisted','seed-nzb-1','Turmeric plot','IN-TS-NZB','NZB/12/5',1.6,'Turmeric','[{"lat":18.67,"lng":78.09},{"lat":18.67,"lng":78.10},{"lat":18.66,"lng":78.10},{"lat":18.66,"lng":78.09}]'::jsonb,18.665,78.095,'synced',true)
ON CONFLICT DO NOTHING;
