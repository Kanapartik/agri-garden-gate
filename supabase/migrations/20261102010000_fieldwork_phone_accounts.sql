-- Fieldwork identities are separate from platform/FPO roles. No client may select
-- credential/session tables. Narrow RPCs authenticate an opaque, hashed session.
create table if not exists public.fieldwork_accounts (
 id uuid primary key default gen_random_uuid(), login_id text not null unique check(login_id ~ '^[0-9]{10}$'),
 full_name text not null, role text not null check(role in ('enumerator','supervisor','consultant','liaison','leadership')),
 zone text, lgas text[] not null default '{}', wards text[] not null default '{}', communities text[] not null default '{}',
 supervisor_id uuid references public.fieldwork_accounts(id), sources jsonb not null default '[]', active boolean not null default true,
 password_hash text not null, must_change_password boolean not null default true, password_changed_at timestamptz,
 failed_attempts integer not null default 0, locked_until timestamptz, first_login_at timestamptz, last_login_at timestamptz,
 initial_location jsonb, last_location jsonb, created_at timestamptz not null default now(),
 constraint fieldwork_named_leadership_only check(role <> 'leadership' or lower(trim(full_name)) in ('muhammad halliru','dahiru baba','buhari alkasim','sunkara','puligilla'))
);
create table if not exists public.fieldwork_sessions (
 token_hash text primary key check(token_hash ~ '^[a-f0-9]{64}$'), account_id uuid not null references public.fieldwork_accounts(id),
 created_at timestamptz not null default now(), expires_at timestamptz not null, last_seen_at timestamptz not null default now(), revoked_at timestamptz
);
create index if not exists fieldwork_sessions_account on public.fieldwork_sessions(account_id);
create table if not exists public.fieldwork_auth_events (
 id bigint generated always as identity primary key, account_id uuid references public.fieldwork_accounts(id), event text not null,
 occurred_at timestamptz not null default now(), metadata jsonb not null default '{}'
);
create table if not exists public.fieldwork_login_limits(ip_hash text primary key, attempts integer not null, window_start timestamptz not null default now());
create table if not exists public.fieldwork_form_definitions(type text primary key, version text not null, fields jsonb not null);
create table if not exists public.fieldwork_records (
 id text primary key check(length(id) between 5 and 80), author_id uuid not null references public.fieldwork_accounts(id),
 lga text not null, zone text, type text not null check(type in ('HH','FGD','KII','ENT')),
 status text not null check(status in ('Draft','Submitted','Returned','Approved','Rejected')),
 server_version integer not null default 1, payload jsonb not null, updated_at timestamptz not null default now()
);
create index if not exists fieldwork_records_author on public.fieldwork_records(author_id);
create table if not exists public.fieldwork_record_audit (
 id bigint generated always as identity primary key, record_id text not null, actor_id uuid not null references public.fieldwork_accounts(id),
 action text not null, server_version integer, note text, occurred_at timestamptz not null default now()
);
alter table public.fieldwork_accounts enable row level security;
alter table public.fieldwork_sessions enable row level security;
alter table public.fieldwork_auth_events enable row level security;
alter table public.fieldwork_login_limits enable row level security;
alter table public.fieldwork_form_definitions enable row level security;
alter table public.fieldwork_records enable row level security;
alter table public.fieldwork_record_audit enable row level security;
revoke all on public.fieldwork_accounts,public.fieldwork_sessions,public.fieldwork_auth_events,public.fieldwork_login_limits,public.fieldwork_form_definitions,public.fieldwork_records,public.fieldwork_record_audit from anon,authenticated;

create or replace function public.fieldwork_public_account(a public.fieldwork_accounts) returns jsonb
 language sql stable security definer set search_path=public,pg_temp as $$
 select jsonb_build_object('id',a.id,'loginId',a.login_id,'name',a.full_name,'role',a.role,'zone',a.zone,'lgas',to_jsonb(a.lgas),'wards',to_jsonb(a.wards),'communities',to_jsonb(a.communities),'supervisorId',a.supervisor_id,'mustChangePassword',a.must_change_password,'firstLoginAt',a.first_login_at,'lastLoginAt',a.last_login_at,'lastActivityAt',(select max(last_seen_at) from public.fieldwork_sessions where account_id=a.id and revoked_at is null and expires_at>now()),'initialLocation',a.initial_location,'active',a.active);
$$;
revoke all on function public.fieldwork_public_account(public.fieldwork_accounts) from public,anon,authenticated;

create or replace function public.fieldwork_login(p_login_id text,p_password text,p_token_hash text,p_ip_hash text) returns jsonb
 language plpgsql security definer set search_path=public,pg_temp as $$
declare a public.fieldwork_accounts; limiter public.fieldwork_login_limits; dummy text;
begin
 if p_login_id !~ '^[0-9]{10}$' or (length(p_password) not between 1 and 72 or octet_length(p_password)>72) or p_token_hash !~ '^[a-f0-9]{64}$' or p_ip_hash !~ '^[a-f0-9]{64}$' then return jsonb_build_object('error','invalid_credentials'); end if;
 insert into public.fieldwork_login_limits(ip_hash,attempts) values(p_ip_hash,0) on conflict do nothing;
 select * into limiter from public.fieldwork_login_limits where ip_hash=p_ip_hash for update;
 if limiter.window_start < now()-interval '15 minutes' then update public.fieldwork_login_limits set attempts=0,window_start=now() where ip_hash=p_ip_hash; limiter.attempts:=0; end if;
 if limiter.attempts >= 120 then return jsonb_build_object('error','try_later'); end if;
 update public.fieldwork_login_limits set attempts=attempts+1 where ip_hash=p_ip_hash;
 select * into a from public.fieldwork_accounts where login_id=p_login_id for update;
 if not found then
  dummy:=extensions.crypt(p_password,extensions.gen_salt('bf',12));
  insert into public.fieldwork_auth_events(event) values('login_denied');
  return jsonb_build_object('error','invalid_credentials');
 end if;
 if not a.active or a.locked_until>now() then return jsonb_build_object('error','invalid_credentials'); end if;
 if extensions.crypt(p_password,a.password_hash)<>a.password_hash then
  update public.fieldwork_accounts set failed_attempts=case when locked_until<now() then 1 else failed_attempts+1 end,
   locked_until=case when locked_until<now() then null when failed_attempts>=4 then now()+interval '15 minutes' else locked_until end where id=a.id;
  insert into public.fieldwork_auth_events(account_id,event) values(a.id,'login_denied');
  return jsonb_build_object('error','invalid_credentials');
 end if;
 update public.fieldwork_accounts set failed_attempts=0,locked_until=null,first_login_at=coalesce(first_login_at,now()),last_login_at=now() where id=a.id returning * into a;
 insert into public.fieldwork_sessions(token_hash,account_id,expires_at) values(p_token_hash,a.id,now()+case when a.must_change_password then interval '15 minutes' else interval '12 hours' end);
 insert into public.fieldwork_auth_events(account_id,event) values(a.id,'login_succeeded');
 return jsonb_build_object('account',public.fieldwork_public_account(a),'expiresAt',(select expires_at from public.fieldwork_sessions where token_hash=p_token_hash));
end $$;
revoke all on function public.fieldwork_login(text,text,text,text) from public;
grant execute on function public.fieldwork_login(text,text,text,text) to anon,authenticated;

create or replace function public.fieldwork_validate_answers(p_type text,p_answers jsonb) returns boolean
 language plpgsql stable security definer set search_path=public,pg_temp as $$
declare f jsonb; v jsonb; wanted jsonb; rowname text; opt jsonb; n numeric; rules jsonb; skip boolean;
begin
 if jsonb_typeof(p_answers)<>'object' then return false; end if;
 select fields into rules from public.fieldwork_form_definitions where type=p_type;
 if rules is null then return false; end if;
 for f in select value from jsonb_array_elements(rules) loop
  skip:=false;
  if f ? 'show' then
   wanted:=p_answers->(f->'show'->>0);
   if jsonb_typeof(wanted)='array' then skip:=not(wanted @> jsonb_build_array(f->'show'->1));
   else skip:=wanted is distinct from f->'show'->1; end if;
  end if;
  if f ? 'showIn' then skip:=skip or not(coalesce(f->'showIn'->1 @> jsonb_build_array(p_answers->(f->'showIn'->>0)),false)); end if;
  if skip then continue; end if;
  v:=p_answers->(f->>'id');
  if coalesce((f->>'required')::boolean,false) and (v is null or v='null'::jsonb or v='""'::jsonb or v='[]'::jsonb) then
   if f->>'type' not in ('matrix','fixedMatrix') then return false; end if;
  end if;
  if v is null or v='null'::jsonb or v='""'::jsonb then
   if f->>'type' not in ('matrix','fixedMatrix') then continue; end if;
  end if;
  if f->>'type'='number' then
   begin n:=(v#>>'{}')::numeric; exception when others then return false; end;
   if n::text in ('NaN','Infinity','-Infinity') then return false; end if;
   if f ? 'min' and n<(f->>'min')::numeric then return false; end if;
   if f ? 'max' and n>(f->>'max')::numeric then return false; end if;
   if coalesce((f->>'integer')::boolean,false) and trunc(n)<>n then return false; end if;
  elsif f->>'type'='select' then
   if jsonb_typeof(v)<>'string' or not(f->'options' @> jsonb_build_array(v)) then return false; end if;
  elsif f->>'type'='multi' then
   if jsonb_typeof(v)<>'array' then return false; end if;
   for opt in select value from jsonb_array_elements(v) loop if not(f->'options' @> jsonb_build_array(opt)) then return false; end if; end loop;
   if f ? 'maxSelections' and jsonb_array_length(v)>(f->>'maxSelections')::integer then return false; end if;
   if jsonb_array_length(v)>1 and (v @> '["None"]'::jsonb or v @> '["Not Applicable"]'::jsonb) then return false; end if;
   if jsonb_array_length(v)>1 and f ? 'exclusiveOptions' then for opt in select value from jsonb_array_elements(f->'exclusiveOptions') loop if v @> jsonb_build_array(opt) then return false; end if; end loop; end if;
  elsif f->>'type' in ('matrix','fixedMatrix') then
   wanted:=coalesce(f->'fixedRows',p_answers->(f->>'rows'),'[]'::jsonb);
   for rowname in select jsonb_array_elements_text(wanted) loop
    if rowname='Not Applicable' then continue; end if;
    if not(coalesce(f->'options' @> jsonb_build_array(v->rowname),false)) then return false; end if;
   end loop;
  elsif jsonb_typeof(v)<>'string' then return false;
  elsif length(v#>>'{}')>5000 then return false;
  end if;
 end loop;
 return coalesce(p_answers->>'consent'='Yes',false);
exception when others then return false;
end $$;
revoke all on function public.fieldwork_validate_answers(text,jsonb) from public,anon,authenticated;

create or replace function public.fieldwork_dispatch(p_token_hash text,p_action text,p_payload jsonb default '{}'::jsonb) returns jsonb
 language plpgsql security definer set search_path=public,pg_temp as $$
declare a public.fieldwork_accounts; s public.fieldwork_sessions; r public.fieldwork_records; result jsonb; record jsonb; rid text; typ text; loc jsonb; decision text; note text; newpass text; ver integer;
begin
 if p_token_hash !~ '^[a-f0-9]{64}$' or length(p_payload::text)>524288 then return jsonb_build_object('error','invalid_request'); end if;
 select * into s from public.fieldwork_sessions where token_hash=p_token_hash and revoked_at is null and expires_at>now();
 if not found then return jsonb_build_object('error','unauthorized'); end if;
 select * into a from public.fieldwork_accounts where id=s.account_id and active;
 if not found then return jsonb_build_object('error','unauthorized'); end if;
 if p_action='logout' then
  update public.fieldwork_sessions set revoked_at=now() where token_hash=p_token_hash;
  insert into public.fieldwork_auth_events(account_id,event) values(a.id,'logout');
  return jsonb_build_object('ok',true);
 end if;
 if p_action='session' then return jsonb_build_object('account',public.fieldwork_public_account(a),'expiresAt',s.expires_at); end if;
 if p_action='change_password' then
  newpass:=p_payload->>'password';
  if (length(newpass) not between 12 and 72 or octet_length(newpass)>72) or newpass !~ '[a-z]' or newpass !~ '[A-Z]' or newpass !~ '[0-9]' or newpass !~ '[^A-Za-z0-9]' or extensions.crypt(newpass,a.password_hash)=a.password_hash then return jsonb_build_object('error','password_requirements'); end if;
  update public.fieldwork_accounts set password_hash=extensions.crypt(newpass,extensions.gen_salt('bf',12)),must_change_password=false,password_changed_at=now() where id=a.id returning * into a;
  update public.fieldwork_sessions set revoked_at=now() where account_id=a.id and token_hash<>p_token_hash and revoked_at is null;
  update public.fieldwork_sessions set expires_at=now()+interval '12 hours' where token_hash=p_token_hash;
  insert into public.fieldwork_auth_events(account_id,event) values(a.id,'password_changed');
  return jsonb_build_object('account',public.fieldwork_public_account(a),'expiresAt',now()+interval '12 hours');
 end if;
 if a.must_change_password then return jsonb_build_object('error','password_change_required'); end if;
 update public.fieldwork_sessions set last_seen_at=now() where token_hash=p_token_hash;
 if p_action='bootstrap' then
  select coalesce(jsonb_agg(public.fieldwork_public_account(x) order by x.full_name),'[]'::jsonb) into result from public.fieldwork_accounts x where x.active and (a.role='leadership' or x.id=a.id or x.id=a.supervisor_id or (a.role='supervisor' and x.supervisor_id=a.id));
  return jsonb_build_object('account',public.fieldwork_public_account(a),'roster',result,'logins',(select coalesce(jsonb_agg(q.event order by q.at desc),'[]'::jsonb) from (select e.occurred_at as at,jsonb_build_object('userId',x.id,'name',x.full_name,'role',x.role,'zone',x.zone,'at',e.occurred_at) as event from public.fieldwork_auth_events e join public.fieldwork_accounts x on x.id=e.account_id where e.event='login_succeeded' and (a.role='leadership' or x.id=a.id or (a.role='supervisor' and x.supervisor_id=a.id)) order by e.occurred_at desc limit 100)q),'expiresAt',s.expires_at);
 end if;
 if p_action='leadership' and a.role<>'leadership' then return jsonb_build_object('error','forbidden'); end if;
 if p_action in ('records','leadership') then
  select coalesce(jsonb_agg(x.payload||jsonb_build_object('serverVersion',x.server_version,'status',x.status,'user',x.author_id::text,'zone',x.zone,'lga',x.lga,'demo',false) order by x.updated_at desc),'[]'::jsonb) into result
  from public.fieldwork_records x where a.role='leadership' or x.author_id=a.id or (a.role='supervisor' and exists(select 1 from public.fieldwork_accounts author where author.id=x.author_id and author.supervisor_id=a.id));
  return jsonb_build_object('records',result);
 end if;
 if p_action='save_record' then
  record:=p_payload->'record';rid:=record->>'id';typ:=record->>'type';
  if rid is null or rid !~ '^JG-[A-Za-z0-9-]{8,70}$' or typ is null or typ not in ('HH','FGD','KII','ENT') or coalesce((record->>'lga')=any(a.lgas),false)=false or record->>'status' is null or record->>'status' not in ('Draft','Submitted') or a.role='leadership' then return jsonb_build_object('error','invalid_record'); end if;
  if jsonb_typeof(record->'answers') is distinct from 'object' then return jsonb_build_object('error','invalid_record'); end if;
  if record->>'status'='Submitted' and (not public.fieldwork_validate_answers(typ,record->'answers') or ((record->'location' is null or record->'location'='null'::jsonb) and length(trim(coalesce(record->'answers'->>'locationReason','')))=0)) then return jsonb_build_object('error','incomplete_record'); end if;
  select * into r from public.fieldwork_records where id=rid for update;
  if found then
   if r.author_id<>a.id then return jsonb_build_object('error','forbidden'); end if;
   if r.status='Submitted' and record->>'status'='Submitted' and r.payload->'answers'=record->'answers' and r.lga=record->>'lga' and r.type=typ and r.server_version=coalesce((record->>'serverVersion')::integer,0)+1 then return jsonb_build_object('record',r.payload,'serverVersion',r.server_version); end if;
   if r.status not in ('Draft','Returned') then return jsonb_build_object('error','record_locked'); end if;
   if coalesce((record->>'serverVersion')::integer,0)<>r.server_version then return jsonb_build_object('error','conflict'); end if;
   ver:=r.server_version+1;
  else
   if coalesce((record->>'serverVersion')::integer,0)<>0 then return jsonb_build_object('error','conflict'); end if;ver:=1;
  end if;
  record:=(record-'syncError'-'pendingSync'-'serverConflict')||jsonb_build_object('reviewNote',coalesce(r.payload->>'reviewNote',''),'revision',case when r.id is null then 1 when r.status='Returned' then coalesce((r.payload->>'revision')::integer,1)+1 else coalesce((r.payload->>'revision')::integer,1) end,'history',case when r.id is null or r.status is distinct from record->>'status' then jsonb_build_array(jsonb_build_object('status',record->>'status','actor',a.full_name,'at',now(),'note','Server received'))||coalesce(r.payload->'history','[]'::jsonb) else coalesce(r.payload->'history','[]'::jsonb) end)||jsonb_build_object('user',a.id::text,'zone',a.zone,'lga',record->>'lga','demo',false,'updated',now(),'serverVersion',ver,'formVersion',(select version from public.fieldwork_form_definitions where type=typ));
  insert into public.fieldwork_records(id,author_id,lga,zone,type,status,server_version,payload) values(rid,a.id,record->>'lga',a.zone,typ,record->>'status',ver,record)
  on conflict(id) do update set payload=excluded.payload,status=excluded.status,lga=excluded.lga,type=excluded.type,zone=excluded.zone,server_version=excluded.server_version,updated_at=now();
  insert into public.fieldwork_record_audit(record_id,actor_id,action,server_version) values(rid,a.id,record->>'status',ver);
  return jsonb_build_object('record',record,'serverVersion',ver);
 end if;
 if p_action='review_record' then
  rid:=p_payload->>'id';decision:=p_payload->>'decision';note:=trim(coalesce(p_payload->>'note',''));
  select * into r from public.fieldwork_records where id=rid for update;
  if not found or r.author_id=a.id or (a.role<>'leadership' and not(a.role='supervisor' and exists(select 1 from public.fieldwork_accounts x where x.id=r.author_id and x.supervisor_id=a.id))) then return jsonb_build_object('error','forbidden'); end if;
  if r.status<>'Submitted' or coalesce((p_payload->>'serverVersion')::integer,0)<>r.server_version then return jsonb_build_object('error','conflict'); end if;
  if decision is null or decision not in ('Approved','Returned','Rejected') or (decision<>'Approved' and note='') or (decision='Approved' and (r.payload->'location' is null or r.payload->'location'='null'::jsonb) and note='') or length(note)>5000 then return jsonb_build_object('error','review_note_required'); end if;
  record:=r.payload||jsonb_build_object('status',decision,'reviewNote',note,'updated',now(),'serverVersion',r.server_version+1,'history',jsonb_build_array(jsonb_build_object('status',decision,'note',note,'actor',a.full_name,'at',now()))||coalesce(r.payload->'history','[]'::jsonb));
  update public.fieldwork_records set status=decision,payload=record,server_version=server_version+1,updated_at=now() where id=rid;
  insert into public.fieldwork_record_audit(record_id,actor_id,action,server_version,note) values(rid,a.id,decision,r.server_version+1,note);
  return jsonb_build_object('record',record);
 end if;
 if p_action='location' then
  loc:=p_payload->'location';
  if jsonb_typeof(loc)<>'object' or not(loc ? 'lat' and loc ? 'lng' and loc ? 'accuracy') or (loc->>'lat')::numeric not between -90 and 90 or (loc->>'lng')::numeric not between -180 and 180 or (loc->>'accuracy')::numeric<0 then return jsonb_build_object('error','invalid_location'); end if;
  update public.fieldwork_accounts set initial_location=coalesce(initial_location,loc),last_location=loc where id=a.id;
  insert into public.fieldwork_auth_events(account_id,event,metadata) values(a.id,'location_captured',jsonb_build_object('accuracy',loc->'accuracy','kind',loc->'kind'));
  return jsonb_build_object('ok',true);
 end if;
 return jsonb_build_object('error','invalid_action');
exception when invalid_text_representation or numeric_value_out_of_range then return jsonb_build_object('error','invalid_request');
end $$;
revoke all on function public.fieldwork_dispatch(text,text,jsonb) from public;
grant execute on function public.fieldwork_dispatch(text,text,jsonb) to anon,authenticated;
