-- Preserve submitted evidence; review draft deletion and dashboard eligibility separately.
begin;
alter table public.fieldwork_records add column ever_submitted boolean not null default false;
alter table public.fieldwork_records add column capture_date date;
alter table public.fieldwork_records add column submitted_at timestamptz;
alter table public.fieldwork_records add column deletion_request jsonb;
alter table public.fieldwork_records add column dashboard_excluded boolean not null default false;
alter table public.fieldwork_records add column exclusion_reason text;
update public.fieldwork_records set ever_submitted=status<>'Draft' or exists(select 1 from jsonb_array_elements(coalesce(payload->'history','[]')) h where h->>'status' in ('Submitted','Returned','Approved','Rejected')),
 capture_date=case when payload->'answers'->>'date' ~ '^\d{4}-\d{2}-\d{2}$' then (payload->'answers'->>'date')::date else (updated_at at time zone 'Africa/Lagos')::date end;
update public.fieldwork_records set submitted_at=coalesce((select min(occurred_at) from public.fieldwork_record_audit a where a.record_id=fieldwork_records.id and a.action='Submitted'),updated_at) where ever_submitted;
create table public.fieldwork_deleted_records(id text primary key,author_id uuid not null references public.fieldwork_accounts(id),deleted_at timestamptz not null default now(),reviewer_id uuid not null references public.fieldwork_accounts(id));
alter table public.fieldwork_deleted_records enable row level security;
revoke all on public.fieldwork_deleted_records from anon,authenticated;
create function public.fieldwork_record_guard() returns trigger language plpgsql set search_path=public as $$
begin
 if tg_op='DELETE' then if old.ever_submitted then raise exception 'Submitted surveys cannot be deleted'; end if;return old;end if;
 if tg_op='UPDATE' then new.ever_submitted:=old.ever_submitted or new.ever_submitted;new.capture_date:=old.capture_date;new.submitted_at:=coalesce(old.submitted_at,new.submitted_at);end if;
 new.ever_submitted:=new.ever_submitted or new.status<>'Draft';
 if new.ever_submitted then new.submitted_at:=coalesce(new.submitted_at,now());end if;
 new.capture_date:=coalesce(new.capture_date,(new.payload->>'captureDate')::date,(now() at time zone 'Africa/Lagos')::date);
 new.payload:=jsonb_set(new.payload,'{answers,date}',to_jsonb(new.capture_date::text))||jsonb_build_object('captureDate',new.capture_date,'everSubmitted',new.ever_submitted,'submittedAt',new.submitted_at,'deletionRequest',new.deletion_request,'dashboardExcluded',new.dashboard_excluded,'exclusionReason',new.exclusion_reason);
 return new;
end $$;
create trigger fieldwork_record_guard before insert or update or delete on public.fieldwork_records for each row execute function public.fieldwork_record_guard();
-- Synchronize metadata without changing existing responses or dates.
update public.fieldwork_records set payload=payload;
alter function public.fieldwork_dispatch(text,text,jsonb) rename to fieldwork_dispatch_geo;
revoke all on function public.fieldwork_dispatch_geo(text,text,jsonb) from public,anon,authenticated;
create function public.fieldwork_dispatch(p_token_hash text,p_action text,p_payload jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path=public,extensions as $$
declare a public.fieldwork_accounts;s public.fieldwork_sessions;r public.fieldwork_records;res jsonb;rid text;note text;decision text;manager boolean;record jsonb;started timestamptz;
begin
 select * into s from public.fieldwork_sessions where token_hash=p_token_hash and revoked_at is null and expires_at>now();
 if not found then return jsonb_build_object('error','unauthorized');end if;
 select * into a from public.fieldwork_accounts where id=s.account_id and active;
 if not found then return jsonb_build_object('error','unauthorized');end if;
 if p_action not in ('save_record','deletion','exclusion','records','leadership','review_record') then return public.fieldwork_dispatch_geo(p_token_hash,p_action,p_payload);end if;
 if a.must_change_password then return jsonb_build_object('error','password_change_required');end if;
 rid:=case when p_action='save_record' then p_payload->'record'->>'id' else p_payload->>'id' end;
 if p_action in ('save_record','deletion','exclusion','review_record') then
  -- Serialize saves, review and deletion even when the row does not exist yet.
  perform pg_advisory_xact_lock(hashtextextended(coalesce(rid,''),0));
  if exists(select 1 from public.fieldwork_deleted_records where id=rid) then return jsonb_build_object('error','record_deleted');end if;
  select * into r from public.fieldwork_records where id=rid for update;
 end if;
 if p_action='save_record' then
  if r.deletion_request is not null then return jsonb_build_object('error','deletion_pending');end if;
  record:=p_payload->'record';
  if r.id is null then
   begin started:=(coalesce(record->>'captureStartedAt',record->>'created'))::timestamptz;exception when others then started:=now();end;
   if started is null or started>now()+interval '1 day' then started:=now();end if;
   record:=record||jsonb_build_object('captureDate',(started at time zone 'Africa/Lagos')::date);
  else record:=record||jsonb_build_object('captureDate',r.capture_date);end if;
  record:=jsonb_set(record,'{answers,date}',record->'captureDate');
  res:=public.fieldwork_dispatch_geo(p_token_hash,p_action,jsonb_build_object('record',record));
  if res->>'error' is not null then return res;end if;
  if r.id is null then update public.fieldwork_records set capture_date=(record->>'captureDate')::date where id=rid;end if;
  select payload into record from public.fieldwork_records where id=rid;
  return res||jsonb_build_object('record',record);
 end if;
 if p_action in ('deletion','exclusion') then
  manager:=r.author_id<>a.id and (a.role='leadership' or (a.role='supervisor' and exists(select 1 from public.fieldwork_accounts x where x.id=r.author_id and x.supervisor_id=a.id)));
  if r.id is null or not(r.author_id=a.id or manager) then return jsonb_build_object('error','forbidden');end if;
  if coalesce((p_payload->>'serverVersion')::integer,0)<>r.server_version then return jsonb_build_object('error','conflict');end if;
  note:=trim(coalesce(p_payload->>'note',''));decision:=p_payload->>'decision';
  if length(note)<1 or length(note)>5000 then return jsonb_build_object('error','review_note_required');end if;
  if p_action='exclusion' then
   if not manager then return jsonb_build_object('error','forbidden');end if;
   if not r.ever_submitted or jsonb_typeof(p_payload->'excluded') is distinct from 'boolean' then return jsonb_build_object('error','invalid_request');end if;
   decision:=case when (p_payload->>'excluded')::boolean then 'Dashboard excluded' else 'Dashboard restored' end;
   update public.fieldwork_records set dashboard_excluded=(p_payload->>'excluded')::boolean,exclusion_reason=note where id=rid;
  else
   if r.ever_submitted then return jsonb_build_object('error','submitted_protected');end if;
   if decision='request' then
    if r.author_id<>a.id then return jsonb_build_object('error','forbidden');end if;
    if r.deletion_request is not null then return jsonb_build_object('error','deletion_pending');end if;
    update public.fieldwork_records set deletion_request=jsonb_build_object('requester',a.id,'reason',note,'at',now()) where id=rid;
   elsif decision='cancel' then
    if r.author_id<>a.id then return jsonb_build_object('error','forbidden');end if;
    if r.deletion_request is null then return jsonb_build_object('error','conflict');end if;
    update public.fieldwork_records set deletion_request=null where id=rid;
   elsif decision in ('approve','reject') then
    if not manager then return jsonb_build_object('error','forbidden');end if;
    if r.deletion_request is null then return jsonb_build_object('error','conflict');end if;
    if decision='approve' then
     insert into public.fieldwork_deleted_records(id,author_id,reviewer_id) values(rid,r.author_id,a.id);
     delete from public.fieldwork_records where id=rid;
     insert into public.fieldwork_record_audit(record_id,actor_id,action,server_version,note) values(rid,a.id,'Deletion approved',r.server_version+1,note);
     return jsonb_build_object('deletedId',rid);
    end if;
    update public.fieldwork_records set deletion_request=null where id=rid;
   else return jsonb_build_object('error','invalid_action');end if;
   decision:='Deletion '||decision;
  end if;
  update public.fieldwork_records set server_version=server_version+1,updated_at=now(),payload=payload||jsonb_build_object('serverVersion',server_version+1,'updated',now(),'history',jsonb_build_array(jsonb_build_object('status',decision,'note',note,'actor',a.full_name,'at',now()))||coalesce(payload->'history','[]')) where id=rid returning payload into record;
  insert into public.fieldwork_record_audit(record_id,actor_id,action,server_version,note) values(rid,a.id,decision,r.server_version+1,note);
  return jsonb_build_object('record',record);
 end if;
 res:=public.fieldwork_dispatch_geo(p_token_hash,p_action,p_payload);
 if p_action in ('records','leadership') and res->>'error' is null then
  return res||jsonb_build_object('workflowVersion',1,'deletedIds',(select coalesce(jsonb_agg(d.id),'[]'::jsonb) from public.fieldwork_deleted_records d where a.role='leadership' or d.author_id=a.id or (a.role='supervisor' and exists(select 1 from public.fieldwork_accounts x where x.id=d.author_id and x.supervisor_id=a.id))));
 end if;
 if p_action='review_record' and res->>'error' is null then return res||jsonb_build_object('record',(select payload from public.fieldwork_records where id=rid));end if;
 return res;
end $$;
revoke all on function public.fieldwork_record_guard() from public,anon,authenticated;
revoke all on function public.fieldwork_dispatch(text,text,jsonb) from public;
grant execute on function public.fieldwork_dispatch(text,text,jsonb) to anon,authenticated;
commit;
