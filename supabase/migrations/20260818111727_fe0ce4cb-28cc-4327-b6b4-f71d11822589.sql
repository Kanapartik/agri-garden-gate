ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'state_admin';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'knowledge_contributor';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'knowledge_reviewer';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'researcher';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'policymaker';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'postharvest_provider_admin';