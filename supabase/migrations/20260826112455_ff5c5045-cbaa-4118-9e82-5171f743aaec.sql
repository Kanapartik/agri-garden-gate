-- Phase 2 demo data (synthetic, AP/Telangana) for the FPO workspace.

INSERT INTO public.fpo_profiles (
  tenant_id, fpo_code, legal_name, display_name, registration_number, incorporation_date,
  org_type, pan, phone, email, registered_address, state_code, district_code, mandal, village,
  pin_code, operational_districts, villages_served, registered_farmers, active_farmers,
  total_acres, primary_crops, secondary_crops, input_categories, produce_categories,
  onboarding_step, state, is_synthetic
) VALUES
 ('aaaa1111-0000-4000-8000-000000000001', 'GCG', 'Guntur Chilli Growers Farmer Producer Company Limited',
  'Guntur Chilli Growers FPO', 'U01100AP2019PTC110921', '2019-07-15', 'producer_company', 'AAGCG1234K',
  '+91 8632 240110', 'contact@guntur-chilli.test', 'Door 4-18, Market Yard Road, Guntur',
  'IN-AP', 'IN-AP-GNT', 'Guntur East', 'Nallapadu', '522005',
  ARRAY['IN-AP-GNT','IN-AP-KNL'], ARRAY['Nallapadu','Pedakakani','Thulluru'],
  412, 356, 2140, ARRAY['chilli','cotton'], ARRAY['maize','blackgram'],
  ARRAY['seed','fertilizer','crop_protection'], ARRAY['chilli','cotton_lint'],
  'commodities', 'in_progress', true),
 ('aaaa1111-0000-4000-8000-000000000002', 'KPP', 'Karimnagar Paddy Producers Farmer Producer Company Limited',
  'Karimnagar Paddy Producers FPO', 'U01100TS2020PTC142207', '2020-02-10', 'producer_company', 'AAKPP5678M',
  '+91 8782 231455', 'contact@karimnagar-paddy.test', 'Plot 22, Rythu Bazaar Lane, Karimnagar',
  'IN-TS', 'IN-TS-WGL', 'Karimnagar Rural', 'Alugunur', '505001',
  ARRAY['IN-TS-WGL','IN-TS-NZB'], ARRAY['Alugunur','Manakondur','Nustulapur'],
  418, 372, 2846, ARRAY['paddy','maize'], ARRAY['cotton'],
  ARRAY['seed','fertilizer'], ARRAY['paddy','maize'],
  'commodities', 'in_progress', true)
ON CONFLICT (tenant_id) DO NOTHING;

-- Enrich the existing linked members.
UPDATE public.fpo_members SET membership_number = 'GCG/M-000001', member_type = 'shareholder',
  crops = ARRAY['chilli','cotton'], acreage = 5.5, village_cluster = 'Nallapadu',
  joined_on = '2023-06-12', source = 'field_agent_assisted'
WHERE member_ref = 'GNT-0001';
UPDATE public.fpo_members SET membership_number = 'GCG/M-000002', member_type = 'shareholder',
  crops = ARRAY['chilli'], acreage = 3.2, village_cluster = 'Pedakakani',
  joined_on = '2023-08-04', source = 'fpo_assisted'
WHERE member_ref = 'GNT-0002';
UPDATE public.fpo_members SET membership_number = 'KPP/M-000001', member_type = 'shareholder',
  crops = ARRAY['paddy','maize'], acreage = 7.8, village_cluster = 'Alugunur',
  joined_on = '2022-11-20', source = 'field_agent_assisted'
WHERE member_ref = 'KRM-0001';
UPDATE public.fpo_members SET membership_number = 'KPP/M-000002', member_type = 'associate',
  crops = ARRAY['paddy'], acreage = 2.4, village_cluster = 'Nustulapur',
  joined_on = '2023-01-09', source = 'self_service'
WHERE member_ref = 'KRM-0002';

INSERT INTO public.fpo_members (
  tenant_id, member_ref, membership_number, display_name, status, member_type, crops, acreage,
  village_code, village_cluster, contact_hint, source, joined_on, is_synthetic
) VALUES
 ('aaaa1111-0000-4000-8000-000000000001','GNT-0003','GCG/M-000003','Lakshmi Devi Chintalapudi','approval_pending','shareholder',ARRAY['chilli'],4.1,'IN-AP-GNT','Nallapadu','xxxxx43120','fpo_assisted',NULL,true),
 ('aaaa1111-0000-4000-8000-000000000001','GNT-0004','GCG/M-000004','Venkateswara Rao Bandi','invited','prospective',ARRAY['cotton'],6.0,'IN-AP-GNT','Thulluru','xxxxx77415','govt_camp_assisted',NULL,true),
 ('aaaa1111-0000-4000-8000-000000000001','GNT-0005','GCG/M-000005','Padmavathi Kolli','invited','women_shg',ARRAY['chilli','blackgram'],1.8,'IN-AP-KNL','Pedakakani','xxxxx90233','fpo_assisted',NULL,true),
 ('aaaa1111-0000-4000-8000-000000000001','GNT-0006','GCG/M-000006','Srinivas Reddy Pothuri','suspended','shareholder',ARRAY['cotton','maize'],9.4,'IN-AP-GNT','Thulluru','xxxxx41088','self_service','2022-09-15',true),
 ('aaaa1111-0000-4000-8000-000000000002','KRM-0003','KPP/M-000003','Sunitha Rao Gaddam','approval_pending','shareholder',ARRAY['paddy'],3.6,'IN-TS-WGL','Manakondur','xxxxx60177','field_agent_assisted',NULL,true),
 ('aaaa1111-0000-4000-8000-000000000002','KRM-0004','KPP/M-000004','Mallesh Yadav Bommena','invited','tenant_farmer',ARRAY['paddy','maize'],2.0,'IN-TS-NZB','Nustulapur','xxxxx35902','fpo_assisted',NULL,true),
 ('aaaa1111-0000-4000-8000-000000000002','KRM-0005','KPP/M-000005','Jyothi Bai Kotha','invited','women_shg',ARRAY['maize'],1.4,'IN-TS-WGL','Alugunur','xxxxx28461','govt_camp_assisted',NULL,true)
ON CONFLICT (tenant_id, member_ref) DO NOTHING;

INSERT INTO public.fpo_member_tags (tenant_id, code, label, description, color) VALUES
 ('aaaa1111-0000-4000-8000-000000000001','chilli_cluster','Chilli cluster','Members growing chilli in the Nallapadu belt','amber'),
 ('aaaa1111-0000-4000-8000-000000000001','kcc_pending','KCC pending','Kisan credit card renewal follow-up needed','red'),
 ('aaaa1111-0000-4000-8000-000000000001','women_group','Women farmers group','Members of a women SHG','violet'),
 ('aaaa1111-0000-4000-8000-000000000002','paddy_cluster','Paddy cluster','Paddy growers for collective procurement','green'),
 ('aaaa1111-0000-4000-8000-000000000002','soil_test_due','Soil test due','Soil health card older than three years','blue')
ON CONFLICT (tenant_id, code) DO NOTHING;

INSERT INTO public.fpo_member_tag_assignments (tenant_id, tag_id, member_id)
SELECT m.tenant_id, g.id, m.id
FROM public.fpo_members m
JOIN public.fpo_member_tags g ON g.tenant_id = m.tenant_id
WHERE (g.code = 'chilli_cluster' AND 'chilli' = ANY(m.crops))
   OR (g.code = 'paddy_cluster' AND 'paddy' = ANY(m.crops))
   OR (g.code = 'women_group' AND m.member_type = 'women_shg')
ON CONFLICT (tag_id, member_id) DO NOTHING;

INSERT INTO public.fpo_member_segments (tenant_id, name, description, filters, is_smart) VALUES
 ('aaaa1111-0000-4000-8000-000000000001','Active chilli growers','Active members with chilli in the crop mix','{"status":["active"],"crops":["chilli"]}'::jsonb,true),
 ('aaaa1111-0000-4000-8000-000000000001','Awaiting farmer approval','Memberships waiting on the farmer to confirm','{"status":["approval_pending","invited"]}'::jsonb,true),
 ('aaaa1111-0000-4000-8000-000000000002','Paddy above 3 acres','Paddy growers with more than three acres','{"crops":["paddy"],"minAcreage":3}'::jsonb,true)
ON CONFLICT DO NOTHING;

INSERT INTO public.fpo_farmer_consents (tenant_id, farmer_user_id, purpose_code, evidence, is_synthetic)
VALUES
 ('aaaa1111-0000-4000-8000-000000000001','af5b690b-9c2f-4014-80b6-9811c252b752','fpo_member_management','Signed membership form dated 12 Jun 2023 (synthetic demo record)',true),
 ('aaaa1111-0000-4000-8000-000000000001','af5b690b-9c2f-4014-80b6-9811c252b752','fpo_scheme_assistance','Verbal authorization recorded at Nallapadu camp, witnessed by field officer (synthetic)',true),
 ('aaaa1111-0000-4000-8000-000000000002','7ace9bcf-5077-4576-bde8-fe16c001e60a','fpo_member_management','Signed membership form dated 20 Nov 2022 (synthetic demo record)',true)
ON CONFLICT DO NOTHING;