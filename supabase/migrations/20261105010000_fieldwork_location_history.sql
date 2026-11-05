-- Durable, idempotent foreground location evidence with server-side team scope.
create table if not exists public.fieldwork_location_events (
 id uuid primary key, account_id uuid not null references public.fieldwork_accounts(id), session_id text not null,
 event_kind text not null, record_id text, captured_at timestamptz not null, received_at timestamptz not null default now(),
 latitude double precision not null check(latitude between -90 and 90), longitude double precision not null check(longitude between -180 and 180),
 accuracy_m double precision not null check(accuracy_m between 0 and 100000), provider text, mock boolean not null default false
);
create index if not exists fieldwork_location_actor_time on public.fieldwork_location_events(account_id,captured_at);
alter table public.fieldwork_location_events enable row level security;
revoke all on public.fieldwork_location_events from anon,authenticated;
-- Retain the previously audited dispatcher behind a private wrapper.
do $$ begin
 if to_regprocedure('public.fieldwork_dispatch_core(text,text,jsonb)') is null then
 alter function public.fieldwork_dispatch(text,text,jsonb) rename to fieldwork_dispatch_core;
 end if;
end $$;
revoke all on function public.fieldwork_dispatch_core(text,text,jsonb) from public,anon,authenticated;
create or replace function public.fieldwork_dispatch(p_token_hash text,p_action text,p_payload jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare a public.fieldwork_accounts; s public.fieldwork_sessions; e jsonb; res jsonb; ids jsonb:='[]'; start_at timestamptz; end_at timestamptz; selected uuid; ct integer;
begin
 select * into s from public.fieldwork_sessions where token_hash=p_token_hash and revoked_at is null and expires_at>now();
 if not found then return jsonb_build_object('error','unauthorized'); end if;
 select * into a from public.fieldwork_accounts where id=s.account_id and active;
 if not found then return jsonb_build_object('error','unauthorized'); end if;
 if p_action in ('append_locations','locations') then
 if a.must_change_password then return jsonb_build_object('error','password_change_required'); end if;
 update public.fieldwork_sessions set last_seen_at=now() where token_hash=p_token_hash;
 if p_action='append_locations' then
  if jsonb_typeof(p_payload->'events') is distinct from 'array' or jsonb_array_length(p_payload->'events')>200 then return jsonb_build_object('error','invalid_location'); end if;
  for e in select value from jsonb_array_elements(p_payload->'events') loop
   if e->>'kind' is null or e->>'id' is null or e->>'sessionId' is null or length(e->>'sessionId')>80 or e->>'kind' not in ('login','track','resume','pause','report','answer','manual','permission') or e->>'lat' is null or e->>'lng' is null or e->>'accuracy' is null or e->>'at' is null then return jsonb_build_object('error','invalid_location'); end if;
   if (e->>'lat')::float not between -90 and 90 or (e->>'lng')::float not between -180 and 180 or (e->>'accuracy')::float not between 0 and 100000 or (e->>'at')::timestamptz>now()+interval '10 minutes' or (e->>'at')::timestamptz<now()-interval '30 days' then return jsonb_build_object('error','invalid_location'); end if;
  end loop;
  for e in select value from jsonb_array_elements(p_payload->'events') loop
   if exists(select 1 from public.fieldwork_location_events where id=(e->>'id')::uuid and account_id<>a.id) then return jsonb_build_object('error','forbidden'); end if;
   insert into public.fieldwork_location_events(id,account_id,session_id,event_kind,record_id,captured_at,latitude,longitude,accuracy_m,provider,mock)
   values((e->>'id')::uuid,a.id,e->>'sessionId',e->>'kind',left(e->>'recordId',80),(e->>'at')::timestamptz,(e->>'lat')::float,(e->>'lng')::float,(e->>'accuracy')::float,left(e->>'provider',40),coalesce((e->>'mock')::boolean,false)) on conflict(id) do nothing;
   if e->>'kind'='login' then update public.fieldwork_accounts set initial_location=coalesce(initial_location,e),last_location=case when last_location is null or (last_location->>'at')::timestamptz<(e->>'at')::timestamptz then e else last_location end where id=a.id; end if;
   ids:=ids||jsonb_build_array(e->>'id');
  end loop;
  return jsonb_build_object('accepted',ids,'receivedAt',now());
 end if;
 start_at:=coalesce((p_payload->>'from')::timestamptz,date_trunc('day',now() at time zone 'Africa/Lagos') at time zone 'Africa/Lagos');
 end_at:=coalesce((p_payload->>'to')::timestamptz,start_at+interval '1 day');
 if end_at<=start_at or end_at-start_at>interval '31 days' then return jsonb_build_object('error','invalid_request'); end if;
 selected:=nullif(p_payload->>'userId','')::uuid;
 if selected is not null and not exists(select 1 from public.fieldwork_accounts x where x.id=selected and (a.role='leadership' or x.id=a.id or (a.role='supervisor' and x.supervisor_id=a.id))) then return jsonb_build_object('error','forbidden'); end if;
 select count(*) into ct from public.fieldwork_location_events x where x.captured_at>=start_at and x.captured_at<end_at and (selected is null or x.account_id=selected) and (a.role='leadership' or x.account_id=a.id or (a.role='supervisor' and exists(select 1 from public.fieldwork_accounts u where u.id=x.account_id and u.supervisor_id=a.id)));
 select coalesce(jsonb_agg(q.event order by q.at),'[]') into res from (
 select x.captured_at as at,jsonb_build_object('id',x.id,'userId',x.account_id,'name',u.full_name,'zone',u.zone,'sessionId',x.session_id,'kind',x.event_kind,'recordId',x.record_id,'at',x.captured_at,'receivedAt',x.received_at,'lat',x.latitude,'lng',x.longitude,'accuracy',x.accuracy_m,'provider',x.provider,'mock',x.mock) as event
 from public.fieldwork_location_events x join public.fieldwork_accounts u on u.id=x.account_id where x.captured_at>=start_at and x.captured_at<end_at and (selected is null or x.account_id=selected) and (a.role='leadership' or x.account_id=a.id or (a.role='supervisor' and u.supervisor_id=a.id)) order by x.captured_at desc limit 10000) q;
 return jsonb_build_object('events',res,'total',ct,'truncated',ct>10000,'serverTime',now());
 end if;
 res:=public.fieldwork_dispatch_core(p_token_hash,p_action,p_payload);
 if p_action='bootstrap' and res->>'error' is null then return res||jsonb_build_object('offlineUntil',case when a.role='leadership' then s.expires_at else now()+interval '7 days' end); end if;
 return res;
exception when invalid_text_representation or datetime_field_overflow or invalid_datetime_format or numeric_value_out_of_range then return jsonb_build_object('error','invalid_request');
end $$;
revoke all on function public.fieldwork_dispatch(text,text,jsonb) from public;
grant execute on function public.fieldwork_dispatch(text,text,jsonb) to anon,authenticated;
