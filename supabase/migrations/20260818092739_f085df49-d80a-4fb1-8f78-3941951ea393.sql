-- B3 step 1: additive scoped government roles. New enum values must be
-- committed before they can be referenced, so this migration only adds them.
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'scheme_publisher';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'scheme_reviewer';