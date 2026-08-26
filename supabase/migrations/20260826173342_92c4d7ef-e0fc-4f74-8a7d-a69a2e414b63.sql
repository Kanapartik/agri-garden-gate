-- Phase 8: FPO notifications & tasks
CREATE TYPE public.fpo_notice_audience AS ENUM ('all_members','segment','staff','single_member');
CREATE TYPE public.fpo_notice_category AS ENUM ('scheme','procurement','produce','payment','meeting','compliance','general');
CREATE TYPE public.fpo_notice_channel AS ENUM ('in_app','sms','whatsapp','voice');
CREATE TYPE public.fpo_notice_state AS ENUM ('draft','scheduled','sending','sent','cancelled');
CREATE TYPE public.fpo_delivery_state AS ENUM ('queued','delivered','withheld','failed');
CREATE TYPE public.fpo_task_status AS ENUM ('open','in_progress','blocked','done','cancelled');
CREATE TYPE public.fpo_task_priority AS ENUM ('low','normal','high','urgent');

CREATE TABLE public.fpo_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  category public.fpo_notice_category NOT NULL DEFAULT 'general',
  audience public.fpo_notice_audience NOT NULL DEFAULT 'all_members',
  segment_id uuid REFERENCES public.fpo_member_segments(id) ON DELETE SET NULL,
  member_id uuid REFERENCES public.fpo_members(id) ON DELETE SET NULL,
  language_code text NOT NULL DEFAULT 'en',
  requested_channels public.fpo_notice_channel[] NOT NULL DEFAULT ARRAY['in_app']::public.fpo_notice_channel[],
  state public.fpo_notice_state NOT NULL DEFAULT 'draft',
  scheduled_for timestamptz,
  sent_at timestamptz,
  recipient_count integer NOT NULL DEFAULT 0 CHECK (recipient_count >= 0),
  withheld_count integer NOT NULL DEFAULT 0 CHECK (withheld_count >= 0),
  application_id uuid REFERENCES public.fpo_scheme_applications(id) ON DELETE SET NULL,
  campaign_id uuid REFERENCES public.fpo_procurement_campaigns(id) ON DELETE SET NULL,
  lot_id uuid REFERENCES public.fpo_produce_lots(id) ON DELETE SET NULL,
  created_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  is_synthetic boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.fpo_notification_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid NOT NULL REFERENCES public.fpo_notifications(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  member_id uuid REFERENCES public.fpo_members(id) ON DELETE SET NULL,
  recipient_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  recipient_label text NOT NULL,
  channel public.fpo_notice_channel NOT NULL DEFAULT 'in_app',
  state public.fpo_delivery_state NOT NULL DEFAULT 'queued',
  withheld_reason text,
  read_at timestamptz,
  is_synthetic boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.fpo_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  category public.fpo_notice_category NOT NULL DEFAULT 'general',
  priority public.fpo_task_priority NOT NULL DEFAULT 'normal',
  status public.fpo_task_status NOT NULL DEFAULT 'open',
  due_date date,
  assigned_to_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assignee_label text,
  member_id uuid REFERENCES public.fpo_members(id) ON DELETE SET NULL,
  application_id uuid REFERENCES public.fpo_scheme_applications(id) ON DELETE SET NULL,
  campaign_id uuid REFERENCES public.fpo_procurement_campaigns(id) ON DELETE SET NULL,
  lot_id uuid REFERENCES public.fpo_produce_lots(id) ON DELETE SET NULL,
  completed_at timestamptz,
  created_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  is_synthetic boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.fpo_task_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.fpo_tasks(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  body text NOT NULL,
  author_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  is_synthetic boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_fpo_notifications_tenant ON public.fpo_notifications(tenant_id, created_at DESC);
CREATE INDEX idx_fpo_notifications_state ON public.fpo_notifications(tenant_id, state);
CREATE INDEX idx_fpo_deliveries_notification ON public.fpo_notification_deliveries(notification_id);
CREATE INDEX idx_fpo_deliveries_tenant ON public.fpo_notification_deliveries(tenant_id, state);
CREATE INDEX idx_fpo_tasks_tenant ON public.fpo_tasks(tenant_id, status, due_date);
CREATE INDEX idx_fpo_tasks_assignee ON public.fpo_tasks(assigned_to_user_id);
CREATE INDEX idx_fpo_task_comments_task ON public.fpo_task_comments(task_id, created_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fpo_notifications TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fpo_notification_deliveries TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fpo_tasks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fpo_task_comments TO authenticated;
GRANT ALL ON public.fpo_notifications TO service_role;
GRANT ALL ON public.fpo_notification_deliveries TO service_role;
GRANT ALL ON public.fpo_tasks TO service_role;
GRANT ALL ON public.fpo_task_comments TO service_role;

ALTER TABLE public.fpo_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fpo_notification_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fpo_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fpo_task_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fpo members read notifications" ON public.fpo_notifications
  FOR SELECT TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'platform_admin'));
CREATE POLICY "fpo admins write notifications" ON public.fpo_notifications
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'platform_admin') OR public.has_tenant_role(auth.uid(), tenant_id, 'tenant_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'platform_admin') OR public.has_tenant_role(auth.uid(), tenant_id, 'tenant_admin'));

CREATE POLICY "fpo members read deliveries" ON public.fpo_notification_deliveries
  FOR SELECT TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id) OR recipient_user_id = auth.uid() OR public.has_role(auth.uid(), 'platform_admin'));
CREATE POLICY "fpo admins write deliveries" ON public.fpo_notification_deliveries
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'platform_admin') OR public.has_tenant_role(auth.uid(), tenant_id, 'tenant_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'platform_admin') OR public.has_tenant_role(auth.uid(), tenant_id, 'tenant_admin'));

CREATE POLICY "fpo members read tasks" ON public.fpo_tasks
  FOR SELECT TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'platform_admin'));
CREATE POLICY "fpo admins write tasks" ON public.fpo_tasks
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'platform_admin') OR public.has_tenant_role(auth.uid(), tenant_id, 'tenant_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'platform_admin') OR public.has_tenant_role(auth.uid(), tenant_id, 'tenant_admin'));

CREATE POLICY "fpo members read task comments" ON public.fpo_task_comments
  FOR SELECT TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'platform_admin'));
CREATE POLICY "fpo members add task comments" ON public.fpo_task_comments
  FOR INSERT TO authenticated
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'platform_admin'));
CREATE POLICY "fpo authors update task comments" ON public.fpo_task_comments
  FOR UPDATE TO authenticated
  USING (author_user_id = auth.uid() OR public.has_role(auth.uid(), 'platform_admin') OR public.has_tenant_role(auth.uid(), tenant_id, 'tenant_admin'))
  WITH CHECK (author_user_id = auth.uid() OR public.has_role(auth.uid(), 'platform_admin') OR public.has_tenant_role(auth.uid(), tenant_id, 'tenant_admin'));
CREATE POLICY "fpo authors delete task comments" ON public.fpo_task_comments
  FOR DELETE TO authenticated
  USING (author_user_id = auth.uid() OR public.has_role(auth.uid(), 'platform_admin') OR public.has_tenant_role(auth.uid(), tenant_id, 'tenant_admin'));

CREATE TRIGGER touch_fpo_notifications BEFORE UPDATE ON public.fpo_notifications
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER touch_fpo_notification_deliveries BEFORE UPDATE ON public.fpo_notification_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER touch_fpo_tasks BEFORE UPDATE ON public.fpo_tasks
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER touch_fpo_task_comments BEFORE UPDATE ON public.fpo_task_comments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Synthetic AP/Telangana notifications and tasks
INSERT INTO public.fpo_notifications (tenant_id, title, body, category, audience, language_code, requested_channels, state, sent_at, recipient_count, withheld_count, is_synthetic)
SELECT p.tenant_id, n.title, n.body, n.cat::public.fpo_notice_category, n.aud::public.fpo_notice_audience,
       n.lang, ARRAY['in_app']::public.fpo_notice_channel[], n.st::public.fpo_notice_state,
       CASE WHEN n.st = 'sent' THEN now() - (n.days_ago || ' days')::interval ELSE NULL END,
       n.recipients, n.withheld, true
FROM public.fpo_profiles p
CROSS JOIN (VALUES
  ('Kharif input distribution schedule', 'Urea and DAP distribution at the village collection point from Monday. Carry your membership number.', 'procurement', 'all_members', 'te', 'sent', 3, 48, 6),
  ('Paddy lot weighment on Thursday', 'Members contributing to lot LOT-PADDY-K26 must bring produce to the grading yard before 10 am.', 'produce', 'all_members', 'te', 'sent', 1, 32, 4),
  ('Scheme document collection drive', 'Aadhaar-linked bank passbook copies pending for scheme facilitation. Visit the FPO office this week.', 'scheme', 'segment', 'en', 'draft', 0, 0, 0),
  ('General body meeting notice', 'Annual general body meeting at the FPO office on the 12th at 11 am. Quorum requires 60% attendance.', 'meeting', 'all_members', 'en', 'scheduled', 0, 0, 0)
) AS n(title, body, cat, aud, lang, st, days_ago, recipients, withheld)
WHERE p.tenant_id IS NOT NULL;

INSERT INTO public.fpo_notification_deliveries (notification_id, tenant_id, member_id, recipient_label, channel, state, withheld_reason, is_synthetic)
SELECT n.id, n.tenant_id, m.id, COALESCE(m.display_name, 'Member'), 'in_app'::public.fpo_notice_channel,
       CASE WHEN row_number() OVER (PARTITION BY n.id ORDER BY m.created_at) % 7 = 0
            THEN 'withheld'::public.fpo_delivery_state ELSE 'delivered'::public.fpo_delivery_state END,
       CASE WHEN row_number() OVER (PARTITION BY n.id ORDER BY m.created_at) % 7 = 0
            THEN 'No active member-management authorization on record for this farmer' ELSE NULL END,
       true
FROM public.fpo_notifications n
JOIN public.fpo_members m ON m.tenant_id = n.tenant_id AND m.status = 'active'
WHERE n.is_synthetic AND n.state = 'sent';

INSERT INTO public.fpo_tasks (tenant_id, title, description, category, priority, status, due_date, assignee_label, is_synthetic)
SELECT p.tenant_id, t.title, t.descr, t.cat::public.fpo_notice_category, t.pri::public.fpo_task_priority,
       t.st::public.fpo_task_status, CURRENT_DATE + t.due_in, t.assignee, true
FROM public.fpo_profiles p
CROSS JOIN (VALUES
  ('Collect pending utilization vouchers', 'Grant utilization certificate needs vouchers for equipment purchase before the reporting deadline.', 'compliance', 'high', 'in_progress', 12, 'CEO / accountant'),
  ('Verify member bank details for settlement', 'Produce settlement payouts blocked for members with unverified account details.', 'payment', 'urgent', 'open', 4, 'Accountant'),
  ('Follow up on scheme application query', 'Department raised a clarification on the infrastructure application; response required.', 'scheme', 'high', 'open', 6, 'Board secretary'),
  ('Grading yard readiness check', 'Moisture meters and weighing scales calibration before the next paddy lot.', 'produce', 'normal', 'open', 9, 'Field officer'),
  ('Update member register for new joiners', 'Twelve new membership forms pending entry into the roster.', 'general', 'normal', 'done', -2, 'Field officer')
) AS t(title, descr, cat, pri, st, due_in, assignee)
WHERE p.tenant_id IS NOT NULL;

INSERT INTO public.fpo_task_comments (task_id, tenant_id, body, is_synthetic)
SELECT t.id, t.tenant_id, 'Progress noted during weekly review; awaiting document submission from two villages.', true
FROM public.fpo_tasks t
WHERE t.is_synthetic AND t.status = 'in_progress';