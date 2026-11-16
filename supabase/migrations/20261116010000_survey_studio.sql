-- Independent survey design/client-response tenancy. Existing fieldwork/FPO tables are not repurposed.
begin;
create table public.studio_roles(account_id uuid primary key references public.fieldwork_accounts(id),can_create boolean not null default false,can_review boolean not null default false,can_publish boolean not null default false,is_admin boolean not null default false);
create table public.studio_clients(id uuid primary key default gen_random_uuid(),name text not null check(length(trim(name)) between 2 and 150),active boolean not null default true,created_by uuid not null references public.fieldwork_accounts(id),created_at timestamptz not null default now());
create table public.studio_members(client_id uuid not null references public.studio_clients(id),account_id uuid not null references public.fieldwork_accounts(id),role text not null check(role in ('admin','leadership','collector')),active boolean not null default true,primary key(client_id,account_id));
create table public.studio_surveys(id uuid primary key default gen_random_uuid(),owner_id uuid not null references public.fieldwork_accounts(id),created_at timestamptz not null default now());
create table public.studio_versions(id uuid primary key default gen_random_uuid(),survey_id uuid not null references public.studio_surveys(id),version integer not null,state text not null default 'draft' check(state in ('draft','in_review','approved','published')),definition jsonb not null,revision integer not null default 1,reviewer_id uuid references public.fieldwork_accounts(id),review_note text,reviewed_at timestamptz,publisher_id uuid references public.fieldwork_accounts(id),published_at timestamptz,updated_at timestamptz not null default now(),unique(survey_id,version));
create table public.studio_assignments(id uuid primary key default gen_random_uuid(),client_id uuid not null references public.studio_clients(id),version_id uuid not null references public.studio_versions(id),assigned_by uuid not null references public.fieldwork_accounts(id),active boolean not null default true,assigned_at timestamptz not null default now(),unique(client_id,version_id));
create table public.studio_campaigns(id uuid primary key default gen_random_uuid(),assignment_id uuid not null references public.studio_assignments(id),name text not null check(length(trim(name)) between 2 and 150),active boolean not null default true,created_by uuid not null references public.fieldwork_accounts(id),created_at timestamptz not null default now());
create table public.studio_responses(id uuid primary key,client_id uuid not null references public.studio_clients(id),campaign_id uuid not null references public.studio_campaigns(id),version_id uuid not null references public.studio_versions(id),collector_id uuid not null references public.fieldwork_accounts(id),answers jsonb not null,captured_at timestamptz not null,capture_date date not null,submitted_at timestamptz not null default now());
create index studio_responses_client_time on public.studio_responses(client_id,submitted_at desc);
create table public.studio_audit(id bigint generated always as identity primary key,actor_id uuid not null references public.fieldwork_accounts(id),client_id uuid references public.studio_clients(id),version_id uuid references public.studio_versions(id),action text not null,note text,occurred_at timestamptz not null default now());
do $$declare t text;begin foreach t in array array['studio_roles','studio_clients','studio_members','studio_surveys','studio_versions','studio_assignments','studio_campaigns','studio_responses','studio_audit'] loop execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from anon,authenticated',t);end loop;end $$;
create function public.studio_client_manager(actor uuid,client uuid) returns boolean language sql stable security definer set search_path=public,pg_temp as $$select exists(select 1 from studio_members m join studio_clients c on c.id=m.client_id where m.account_id=actor and m.client_id=client and m.active and c.active and m.role in ('admin','leadership'))$$;
create function public.studio_can_author(actor uuid) returns boolean language sql stable security definer set search_path=public,pg_temp as $$select exists(select 1 from studio_roles where account_id=actor and (can_create or is_admin)) or exists(select 1 from studio_members m join studio_clients c on c.id=m.client_id where m.account_id=actor and m.active and c.active and m.role in ('admin','leadership'))$$;
create function public.studio_visible_version(actor uuid,vid uuid) returns boolean language sql stable security definer set search_path=public,pg_temp as $$select exists(select 1 from studio_versions v join studio_surveys s on s.id=v.survey_id where v.id=vid and (s.owner_id=actor or exists(select 1 from studio_roles where account_id=actor and (can_review or can_publish or is_admin)) or (v.state='published' and exists(select 1 from studio_assignments x join studio_members m on m.client_id=x.client_id join studio_clients c on c.id=m.client_id where x.version_id=v.id and x.active and c.active and m.account_id=actor and m.active))))$$;
create function public.studio_definition_error(d jsonb) returns text language plpgsql immutable set search_path=public,pg_temp as $$
declare sec jsonb;q jsonb;cond jsonb;ids text[]:='{}';sid text[]:='{}';ct integer:=0;typ text;vals jsonb;v text;prior jsonb;
begin
 if jsonb_typeof(d) is distinct from 'object' or length(trim(coalesce(d->>'title','')))<2 or length(d->>'title')>200 or length(coalesce(d->>'description',''))>10000 then return 'Add a survey title (2–200 characters).';end if;
 if jsonb_typeof(d->'sections') is distinct from 'array' or jsonb_array_length(d->'sections') not between 1 and 30 then return 'Use between 1 and 30 sections.';end if;
 for sec in select value from jsonb_array_elements(d->'sections') loop
  if sec->>'id' is null or sec->>'id'=any(sid) or length(trim(coalesce(sec->>'title','')))=0 or length(sec->>'title')>200 or length(coalesce(sec->>'description',''))>10000 then return 'Each section needs a unique ID and a title.';end if;sid:=array_append(sid,sec->>'id');
  if jsonb_typeof(sec->'questions') is distinct from 'array' then return 'Invalid question list.';end if;
  for q in select value from jsonb_array_elements(sec->'questions') loop
   ct:=ct+1;typ:=q->>'type';
   if ct>500 then return 'A survey may contain up to 500 questions.';end if;
   if coalesce(q->>'id','') !~ '^[A-Za-z][A-Za-z0-9_-]{0,79}$' or q->>'id'=any(ids) then return 'Question IDs must be unique.';end if;
   if length(trim(coalesce(q->>'label','')))=0 or length(q->>'label')>1000 or length(coalesce(q->>'help',''))>5000 then return 'Every question needs a label (up to 1000 characters).';end if;
   if typ is null or typ not in ('short_text','long_text','number','date','email','phone','single_choice','multiple_choice','dropdown','yes_no','rating','single_choice_grid','multiple_choice_grid','statement') then return 'Unsupported question type.';end if;
   if q ? 'required' and jsonb_typeof(q->'required')<>'boolean' then return 'Invalid required setting.';end if;
   if typ in ('single_choice','multiple_choice','dropdown','single_choice_grid','multiple_choice_grid') then
    vals:=q->'options';if jsonb_typeof(vals) is distinct from 'array' or jsonb_array_length(vals) not between 2 and 80 then return 'Choice questions need 2–80 options.';end if;
    if exists(select 1 from jsonb_array_elements(vals) e where jsonb_typeof(e)<>'string' or length(trim(e#>>'{}'))=0 or length(e#>>'{}')>300) or (select count(distinct x) from jsonb_array_elements_text(vals) x)<>jsonb_array_length(vals) then return 'Options must be unique, non-empty text.';end if;
   end if;
   if typ in ('single_choice_grid','multiple_choice_grid') then vals:=q->'rows';if jsonb_typeof(vals) is distinct from 'array' or jsonb_array_length(vals) not between 1 and 40 or exists(select 1 from jsonb_array_elements(vals) e where jsonb_typeof(e)<>'string' or length(trim(e#>>'{}'))=0 or length(e#>>'{}')>300) or (select count(distinct x) from jsonb_array_elements_text(vals) x)<>jsonb_array_length(vals) then return 'Grids need 1–40 unique row labels.';end if;end if;
   if typ in ('number','rating') then
    if q ? 'integer' and jsonb_typeof(q->'integer')<>'boolean' then return 'Invalid whole-number setting.';end if;
    if q ? 'min' and jsonb_typeof(q->'min')<>'number' or q ? 'max' and jsonb_typeof(q->'max')<>'number' then return 'Numeric limits must be numbers.';end if;
    if coalesce((q->>'min')::numeric,-1000000000000) not between -1000000000000 and 1000000000000 or coalesce((q->>'max')::numeric,1000000000000) not between -1000000000000 and 1000000000000 or coalesce((q->>'min')::numeric,-1000000000000)>coalesce((q->>'max')::numeric,1000000000000) then return 'Check the numeric limits.';end if;
    if typ='rating' and ((coalesce((q->>'min')::numeric,1)<>1) or coalesce((q->>'max')::numeric,5) not between 2 and 10 or trunc(coalesce((q->>'max')::numeric,5))<>coalesce((q->>'max')::numeric,5)) then return 'Rating scales run from 1 to a whole number between 2 and 10.';end if;
   end if;
   if q ? 'conditions' then
    if jsonb_typeof(q->'conditions')<>'array' or jsonb_array_length(q->'conditions')>10 then return 'Invalid display conditions.';end if;
    for cond in select value from jsonb_array_elements(q->'conditions') loop
     if not(coalesce(cond->>'questionId'=any(ids),false)) or jsonb_typeof(cond->'values') is distinct from 'array' or jsonb_array_length(cond->'values') not between 1 and 80 then return 'A display condition must refer to an earlier question and specify an answer.';end if;
     if exists(select 1 from jsonb_array_elements(cond->'values') e where jsonb_typeof(e)<>'string' or length(e#>>'{}')>300) then return 'Invalid condition answer.';end if;
     select x into prior from jsonb_array_elements(d->'sections') ss cross join lateral jsonb_array_elements(ss->'questions') x where x->>'id'=cond->>'questionId';
     if prior->>'type' not in ('single_choice','multiple_choice','dropdown','yes_no') or exists(select 1 from jsonb_array_elements(cond->'values') cv where not(coalesce((case when prior->>'type'='yes_no' then '["Yes","No"]'::jsonb else prior->'options' end) @> jsonb_build_array(cv),false))) then return 'Display conditions must match an option in an earlier choice question.';end if;
    end loop;
   end if;
   ids:=array_append(ids,q->>'id');
  end loop;
 end loop;
 if ct<1 then return 'Add at least one question.';end if;
 return null;
exception when others then return 'Invalid survey definition.';
end $$;
create function public.studio_check_answers(d jsonb,a jsonb) returns jsonb language plpgsql immutable set search_path=public,pg_temp as $$
declare sec jsonb;q jsonb;cond jsonb;v jsonb;wanted jsonb;choice jsonb;rowlabel text;key text;typ text;num numeric;shown boolean;matched boolean;required boolean;known text[]:='{}';visibility jsonb:='{}';clean jsonb:='{}';message text;
begin
 if jsonb_typeof(a) is distinct from 'object' then return jsonb_build_object('error','invalid_answers','message','Invalid response answers.');end if;
 for sec in select value from jsonb_array_elements(d->'sections') loop for q in select value from jsonb_array_elements(sec->'questions') loop
  key:=q->>'id';known:=array_append(known,key);typ:=q->>'type';shown:=true;
  for cond in select value from jsonb_array_elements(coalesce(q->'conditions','[]')) loop
   if visibility->>(cond->>'questionId') is distinct from 'true' then shown:=false;end if;
   wanted:=a->(cond->>'questionId');matched:=false;
   for choice in select value from jsonb_array_elements(cond->'values') loop if wanted=choice or (jsonb_typeof(wanted)='array' and wanted @> jsonb_build_array(choice)) then matched:=true;end if;end loop;
   if not matched then shown:=false;end if;
  end loop;
  visibility:=visibility||jsonb_build_object(key,shown);
  if not shown or typ='statement' then continue;end if;
  v:=a->key;required:=coalesce((q->>'required')::boolean,false);message:=null;
  if v is null or v='null'::jsonb or v='""'::jsonb or v='[]'::jsonb or v='{}'::jsonb then
   if required then return jsonb_build_object('error','invalid_answers','questionId',key,'message','Answer this required question: '||(q->>'label'));else continue;end if;
  end if;
  if typ in ('short_text','long_text','email','phone','date') then
   if jsonb_typeof(v)<>'string' or length(trim(v#>>'{}'))=0 or length(v#>>'{}')>(case when typ='long_text' then 10000 else 1000 end) then message:='Enter valid text.';
   elsif typ='email' and (v#>>'{}') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then message:='Enter a valid email address.';
   elsif typ='phone' and (v#>>'{}') !~ '^\+?[0-9 ()-]{7,25}$' then message:='Enter a valid phone number.';
   elsif typ='date' then begin if (v#>>'{}') !~ '^\d{4}-\d{2}-\d{2}$' then message:='Enter a valid date.';else perform (v#>>'{}')::date;end if;exception when others then message:='Enter a valid date.';end;
   end if;
  elsif typ in ('number','rating') then
   begin num:=(v#>>'{}')::numeric;if num::text in ('NaN','Infinity','-Infinity') or num<coalesce((q->>'min')::numeric,case when typ='rating' then 1 else -1000000000000 end) or num>coalesce((q->>'max')::numeric,case when typ='rating' then 5 else 1000000000000 end) or (typ='rating' or coalesce((q->>'integer')::boolean,false)) and trunc(num)<>num then message:='Enter a number within the allowed range.';else v:=to_jsonb(num);end if;exception when others then message:='Enter a valid number.';end;
  elsif typ in ('single_choice','dropdown','yes_no') then if jsonb_typeof(v)<>'string' or not(coalesce(case when typ='yes_no' then '["Yes","No"]'::jsonb else q->'options' end @> jsonb_build_array(v),false)) then message:='Choose an available answer.';end if;
  elsif typ='multiple_choice' then
   if jsonb_typeof(v)<>'array' then message:='Choose one or more available answers.';else
    for choice in select value from jsonb_array_elements(v) loop if not(coalesce(q->'options' @> jsonb_build_array(choice),false)) then message:='Choose only available answers.';end if;end loop;
    if (select count(distinct value) from jsonb_array_elements(v))<>jsonb_array_length(v) then message:='Answers cannot be repeated.';end if;
   end if;
  elsif typ in ('single_choice_grid','multiple_choice_grid') then
   if jsonb_typeof(v)<>'object' then message:='Complete the grid.';else
    if exists(select 1 from jsonb_object_keys(v) k where not(q->'rows' @> jsonb_build_array(k))) then message:='Invalid grid row.';end if;
    for rowlabel in select jsonb_array_elements_text(q->'rows') loop
     wanted:=v->rowlabel;
     if wanted is null or wanted='""'::jsonb or wanted='[]'::jsonb then if required then message:='Complete every required grid row.';end if;continue;end if;
     if typ='single_choice_grid' then if jsonb_typeof(wanted)<>'string' or not(coalesce(q->'options' @> jsonb_build_array(wanted),false)) then message:='Choose an available grid answer.';end if;
     elsif jsonb_typeof(wanted)<>'array' then message:='Choose available answers in each row.';
     else for choice in select value from jsonb_array_elements(wanted) loop if not(coalesce(q->'options' @> jsonb_build_array(choice),false)) then message:='Choose only available grid answers.';end if;end loop;end if;
    end loop;
   end if;
  end if;
  if message is not null then return jsonb_build_object('error','invalid_answers','questionId',key,'message',message);end if;
  clean:=clean||jsonb_build_object(key,v);
 end loop;end loop;
 if exists(select 1 from jsonb_object_keys(a) k where not(k=any(known))) then return jsonb_build_object('error','invalid_answers','message','The response contains unknown question IDs.');end if;
 return jsonb_build_object('answers',clean);
exception when others then return jsonb_build_object('error','invalid_answers','message','Check the response format.');
end $$;
-- Invariants also hold for owner-side SQL and future write paths.
create function public.studio_version_guard() returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
 if tg_op='DELETE' then if old.state='published' then raise exception 'Published versions cannot be deleted';end if;return old;end if;
 if tg_op='UPDATE' and old.state='published' then raise exception 'Published versions are immutable';end if;
 if new.state in ('approved','published') and (new.reviewer_id is null or new.reviewer_id=(select owner_id from studio_surveys where id=new.survey_id)) then raise exception 'Independent review required';end if;
 if new.state='published' and (tg_op<>'UPDATE' or old.state<>'approved' or new.publisher_id is null) then raise exception 'Approval required before publication';end if;
 return new;
end $$;
create trigger studio_version_guard before insert or update or delete on public.studio_versions for each row execute function public.studio_version_guard();
create function public.studio_assignment_guard() returns trigger language plpgsql set search_path=public,pg_temp as $$begin if not exists(select 1 from studio_versions where id=new.version_id and state='published') then raise exception 'Only published versions can be assigned';end if;return new;end $$;
create trigger studio_assignment_guard before insert or update on public.studio_assignments for each row execute function public.studio_assignment_guard();
create function public.studio_response_guard() returns trigger language plpgsql set search_path=public,pg_temp as $$begin raise exception 'Submitted responses are immutable';end $$;
create trigger studio_response_guard before update or delete on public.studio_responses for each row execute function public.studio_response_guard();
create table public.studio_response_flags(response_id uuid primary key references public.studio_responses(id),excluded boolean not null default false,note text not null,changed_by uuid not null references public.fieldwork_accounts(id),changed_at timestamptz not null default now());
alter table public.studio_response_flags enable row level security;revoke all on public.studio_response_flags from anon,authenticated;
alter table public.studio_versions add column source_version_id uuid references public.studio_versions(id);
create function public.studio_draft_safe(d jsonb) returns boolean language plpgsql immutable set search_path=public,pg_temp as $$
declare s jsonb;q jsonb;ids text[]:='{}';ct integer:=0;
begin
 if jsonb_typeof(d)<>'object' or length(d::text)>300000 or jsonb_typeof(d->'title') is distinct from 'string' or length(d->>'title')>200 or length(coalesce(d->>'description',''))>10000 or jsonb_typeof(d->'sections') is distinct from 'array' or jsonb_array_length(d->'sections') not between 1 and 30 then return false;end if;
 for s in select value from jsonb_array_elements(d->'sections') loop
  if jsonb_typeof(s->'questions') is distinct from 'array' or length(coalesce(s->>'title',''))>200 or length(coalesce(s->>'description',''))>10000 then return false;end if;
  for q in select value from jsonb_array_elements(s->'questions') loop ct:=ct+1;
   if ct>500 or coalesce(q->>'id','') !~ '^[A-Za-z][A-Za-z0-9_-]{0,79}$' or q->>'id'=any(ids) or jsonb_typeof(q->'label') is distinct from 'string' or length(q->>'label')>1000 or length(coalesce(q->>'help',''))>5000 or q->>'type' is null or q->>'type' not in ('short_text','long_text','number','date','email','phone','single_choice','multiple_choice','dropdown','yes_no','rating','single_choice_grid','multiple_choice_grid','statement') then return false;end if;
   if q ? 'options' and jsonb_typeof(q->'options')<>'array' or q ? 'rows' and jsonb_typeof(q->'rows')<>'array' or q ? 'conditions' and jsonb_typeof(q->'conditions')<>'array' then return false;end if;
   ids:=array_append(ids,q->>'id');
  end loop;
 end loop;return true;
exception when others then return false;
end $$;
create function public.survey_studio_dispatch(p_token_hash text,p_action text default 'studio',p_payload jsonb default '{}'::jsonb) returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare actor public.fieldwork_accounts;sess public.fieldwork_sessions;perms public.studio_roles;v public.studio_versions;sur public.studio_surveys;cl public.studio_clients;ass public.studio_assignments;camp public.studio_campaigns;resp public.studio_responses;target public.fieldwork_accounts;
 op text:=coalesce(p_payload->>'op','bootstrap');vid uuid;cid uuid;rid uuid;note text;problem text;new_definition jsonb;result jsonb;items jsonb;members jsonb;allowed boolean;offset_n integer;total_n integer;started timestamptz;role_name text;desired boolean;
begin
 select * into sess from fieldwork_sessions where token_hash=p_token_hash and revoked_at is null and expires_at>now();if not found then return jsonb_build_object('error','unauthorized');end if;
 select * into actor from fieldwork_accounts where id=sess.account_id and active;if not found then return jsonb_build_object('error','unauthorized');end if;
 if actor.must_change_password then return jsonb_build_object('error','password_change_required');end if;
 select * into perms from studio_roles where account_id=actor.id;
 if op='bootstrap' then
  select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'role',m.role,'canViewResults',coalesce(m.role in ('admin','leadership'),false)) order by c.name),'[]') into items from studio_clients c left join studio_members m on m.client_id=c.id and m.account_id=actor.id and m.active where c.active and (coalesce(perms.is_admin,false) or m.account_id is not null);
  select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'surveyId',x.survey_id,'version',x.version,'state',x.state,'title',x.definition->>'title','description',x.definition->>'description','revision',x.revision,'ownerId',owner.id,'ownerName',owner.full_name,'updatedAt',x.updated_at,'publishedAt',x.published_at,'reviewNote',x.review_note) order by x.updated_at desc),'[]') into result from studio_versions x join studio_surveys z on z.id=x.survey_id join fieldwork_accounts owner on owner.id=z.owner_id where studio_visible_version(actor.id,x.id);
  return jsonb_build_object('account',jsonb_build_object('id',actor.id,'name',actor.full_name),'permissions',jsonb_build_object('create',studio_can_author(actor.id),'review',coalesce(perms.can_review or perms.is_admin,false),'publish',coalesce(perms.can_publish or perms.is_admin,false),'admin',coalesce(perms.is_admin,false)),'clients',items,'versions',result,'people',case when coalesce(perms.is_admin,false) then (select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',full_name) order by full_name),'[]') from fieldwork_accounts where active) else '[]'::jsonb end,'roles',case when coalesce(perms.is_admin,false) then (select coalesce(jsonb_agg(to_jsonb(r)),'[]') from studio_roles r) else '[]'::jsonb end);
 end if;
 if op='create' then
  if not studio_can_author(actor.id) then return jsonb_build_object('error','forbidden');end if;
  new_definition:=p_payload->'definition';if not studio_draft_safe(new_definition) then return jsonb_build_object('error','invalid_definition','message','Check the draft structure and field lengths.');end if;
  insert into studio_surveys(owner_id) values(actor.id) returning * into sur;
  insert into studio_versions(survey_id,version,definition) values(sur.id,1,new_definition) returning * into v;
  insert into studio_audit(actor_id,version_id,action) values(actor.id,v.id,'draft_created');return jsonb_build_object('version',to_jsonb(v),'ownerId',actor.id);
 end if;
 if op in ('version','save','request_review','cancel_review','review','publish','fork') then
  vid:=(p_payload->>'versionId')::uuid;select * into v from studio_versions where id=vid for update;if not found or not studio_visible_version(actor.id,vid) then return jsonb_build_object('error','forbidden');end if;
  select * into sur from studio_surveys where id=v.survey_id;
  if op='version' then return jsonb_build_object('version',to_jsonb(v),'ownerId',sur.owner_id,'history',(select coalesce(jsonb_agg(jsonb_build_object('action',a.action,'note',a.note,'at',a.occurred_at,'actor',u.full_name) order by a.occurred_at desc),'[]') from studio_audit a join fieldwork_accounts u on u.id=a.actor_id where a.version_id=v.id and a.client_id is null));end if;
  if op='fork' then
   if not studio_can_author(actor.id) or (sur.owner_id<>actor.id and v.state<>'published') then return jsonb_build_object('error','forbidden');end if;
   new_definition:=v.definition;vid:=v.id;
   if sur.owner_id=actor.id then perform 1 from studio_surveys where id=sur.id for update;insert into studio_versions(survey_id,version,definition,source_version_id) select sur.id,coalesce(max(version),0)+1,new_definition,vid from studio_versions where survey_id=sur.id returning * into v;
   else insert into studio_surveys(owner_id) values(actor.id) returning * into sur;insert into studio_versions(survey_id,version,definition,source_version_id) values(sur.id,1,new_definition,vid) returning * into v;end if;
   insert into studio_audit(actor_id,version_id,action,note) values(actor.id,v.id,'draft_copied','Copied from published/owned version '||vid::text);return jsonb_build_object('version',to_jsonb(v),'ownerId',actor.id);
  end if;
  if coalesce((p_payload->>'revision')::integer,0)<>v.revision then return jsonb_build_object('error','conflict');end if;
  note:=trim(coalesce(p_payload->>'note',''));if length(note)>5000 then return jsonb_build_object('error','invalid_request');end if;
  if op='save' then
   if sur.owner_id<>actor.id or v.state<>'draft' or not studio_can_author(actor.id) then return jsonb_build_object('error','forbidden');end if;
   new_definition:=p_payload->'definition';if not studio_draft_safe(new_definition) then return jsonb_build_object('error','invalid_definition','message','Check the draft structure and field lengths.');end if;
   update studio_versions set definition=new_definition,revision=revision+1,updated_at=now() where id=v.id;
  elsif op='request_review' then
   if sur.owner_id<>actor.id or v.state<>'draft' or not studio_can_author(actor.id) then return jsonb_build_object('error','forbidden');end if;
   problem:=studio_definition_error(v.definition);if problem is not null then return jsonb_build_object('error','invalid_definition','message',problem);end if;
   update studio_versions set state='in_review',reviewer_id=null,reviewed_at=null,review_note=null,revision=revision+1,updated_at=now() where id=v.id;
  elsif op='cancel_review' then
   if sur.owner_id<>actor.id or v.state<>'in_review' then return jsonb_build_object('error','forbidden');end if;
   update studio_versions set state='draft',revision=revision+1,updated_at=now() where id=v.id;
  elsif op='review' then
   if not coalesce(perms.can_review or perms.is_admin,false) or sur.owner_id=actor.id or v.state<>'in_review' then return jsonb_build_object('error','forbidden');end if;
   if note='' or p_payload->>'decision' is null or p_payload->>'decision' not in ('approve','return') then return jsonb_build_object('error','review_note_required');end if;
   problem:=studio_definition_error(v.definition);if problem is not null then return jsonb_build_object('error','invalid_definition','message',problem);end if;
   update studio_versions set state=case when p_payload->>'decision'='approve' then 'approved' else 'draft' end,reviewer_id=case when p_payload->>'decision'='approve' then actor.id else null end,reviewed_at=now(),review_note=note,revision=revision+1,updated_at=now() where id=v.id;
  elsif op='publish' then
   if not coalesce(perms.can_publish or perms.is_admin,false) or v.state<>'approved' then return jsonb_build_object('error','forbidden');end if;
   problem:=studio_definition_error(v.definition);if problem is not null then return jsonb_build_object('error','invalid_definition','message',problem);end if;
   update studio_versions set state='published',publisher_id=actor.id,published_at=now(),revision=revision+1,updated_at=now() where id=v.id;
  end if;
  insert into studio_audit(actor_id,version_id,action,note) values(actor.id,v.id,case when op='review' then 'review_'||(p_payload->>'decision') else op end,note);
  select * into v from studio_versions where id=v.id;return jsonb_build_object('version',to_jsonb(v),'ownerId',sur.owner_id);
 end if;
 if op='create_client' then
  if not coalesce(perms.is_admin,false) then return jsonb_build_object('error','forbidden');end if;
  select * into target from fieldwork_accounts where id=(p_payload->>'adminId')::uuid and active;if not found then return jsonb_build_object('error','invalid_request','message','Select an existing account as client admin.');end if;
  insert into studio_clients(name,created_by) values(trim(p_payload->>'name'),actor.id) returning * into cl;
  insert into studio_members(client_id,account_id,role) values(cl.id,target.id,'admin');insert into studio_audit(actor_id,client_id,action,note) values(actor.id,cl.id,'client_created','Client admin: '||target.id::text);return jsonb_build_object('client',to_jsonb(cl));
 end if;
 if op='set_role' then
  perform pg_advisory_xact_lock(20261116,1);
  if not coalesce(perms.is_admin,false) then return jsonb_build_object('error','forbidden');end if;
  select * into target from fieldwork_accounts where id=(p_payload->>'accountId')::uuid and active;if not found then return jsonb_build_object('error','invalid_request');end if;
  if target.id=actor.id and not coalesce((p_payload->>'admin')::boolean,false) and (select count(*) from studio_roles r join fieldwork_accounts u on u.id=r.account_id where r.is_admin and u.active)<=1 then return jsonb_build_object('error','invalid_request','message','Keep at least one Studio administrator.');end if;
  insert into studio_roles(account_id,can_create,can_review,can_publish,is_admin) values(target.id,coalesce((p_payload->>'create')::boolean,false),coalesce((p_payload->>'review')::boolean,false),coalesce((p_payload->>'publish')::boolean,false),coalesce((p_payload->>'admin')::boolean,false)) on conflict(account_id) do update set can_create=excluded.can_create,can_review=excluded.can_review,can_publish=excluded.can_publish,is_admin=excluded.is_admin;
  insert into studio_audit(actor_id,action,note) values(actor.id,'studio_role_changed','Account: '||target.id::text);return jsonb_build_object('ok',true);
 end if;
 if op in ('client','member','assign','assignment_status','campaign','campaign_status','results','response','flag_response') then
  cid:=(p_payload->>'clientId')::uuid;
  select * into cl from studio_clients where id=cid and active;if not found then return jsonb_build_object('error','forbidden');end if;
  allowed:=studio_client_manager(actor.id,cid);
  if op in ('results','response','flag_response') and not allowed then return jsonb_build_object('error','forbidden');end if;
  if op not in ('results','response','flag_response') and not allowed and not coalesce(perms.is_admin,false) then return jsonb_build_object('error','forbidden');end if;
  if op='client' then
   return jsonb_build_object('client',jsonb_build_object('id',cl.id,'name',cl.name),'canViewResults',allowed,
    'members',(select coalesce(jsonb_agg(jsonb_build_object('accountId',m.account_id,'name',u.full_name,'loginId',u.login_id,'role',m.role,'active',m.active) order by u.full_name),'[]') from studio_members m join fieldwork_accounts u on u.id=m.account_id where m.client_id=cid),
    'assignments',(select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'versionId',x.version_id,'active',x.active,'title',ver.definition->>'title','version',ver.version,'assignedAt',x.assigned_at) order by x.assigned_at desc),'[]') from studio_assignments x join studio_versions ver on ver.id=x.version_id where x.client_id=cid),
    'campaigns',(select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'assignmentId',c.assignment_id,'active',c.active,'versionId',x.version_id,'title',ver.definition->>'title','version',ver.version) order by c.created_at desc),'[]') from studio_campaigns c join studio_assignments x on x.id=c.assignment_id join studio_versions ver on ver.id=x.version_id where x.client_id=cid));
  elsif op='member' then
   if not coalesce(perms.is_admin,false) and not exists(select 1 from studio_members where client_id=cid and account_id=actor.id and role='admin' and active) then return jsonb_build_object('error','forbidden');end if;
   select * into target from fieldwork_accounts where login_id=p_payload->>'loginId' and active;if not found then return jsonb_build_object('error','invalid_request','message','No active account has that 10-digit login ID.');end if;
   role_name:=p_payload->>'role';desired:=coalesce((p_payload->>'active')::boolean,true);
   if role_name is null or role_name not in ('admin','leadership','collector') then return jsonb_build_object('error','invalid_request');end if;
   perform 1 from studio_clients where id=cid for update;
   if exists(select 1 from studio_members where client_id=cid and account_id=target.id and role='admin' and active) and (role_name<>'admin' or not desired) and (select count(*) from studio_members sm join fieldwork_accounts ua on ua.id=sm.account_id where sm.client_id=cid and sm.role='admin' and sm.active and ua.active)<=1 then return jsonb_build_object('error','invalid_request','message','Keep at least one client admin.');end if;
   insert into studio_members(client_id,account_id,role,active) values(cid,target.id,role_name,desired) on conflict(client_id,account_id) do update set role=excluded.role,active=excluded.active;
   note:='Account '||target.id::text||' / '||role_name||case when desired then ' active' else ' inactive' end;
  elsif op='assign' then
   if not coalesce(perms.can_publish or perms.is_admin,false) then return jsonb_build_object('error','forbidden');end if;
   select * into v from studio_versions where id=(p_payload->>'versionId')::uuid and state='published';if not found then return jsonb_build_object('error','not_published','message','Only published survey versions may be assigned to clients.');end if;
   insert into studio_assignments(client_id,version_id,assigned_by) values(cid,v.id,actor.id) on conflict(client_id,version_id) do update set active=true returning * into ass;note:='Version '||v.id::text;
  elsif op='assignment_status' then
   if not coalesce(perms.can_publish or perms.is_admin,false) then return jsonb_build_object('error','forbidden');end if;
   update studio_assignments set active=coalesce((p_payload->>'active')::boolean,false) where id=(p_payload->>'assignmentId')::uuid and client_id=cid returning * into ass;if not found then return jsonb_build_object('error','forbidden');end if;note:='Assignment '||ass.id::text;
  elsif op='campaign' then
   if not allowed then return jsonb_build_object('error','forbidden');end if;
   select * into ass from studio_assignments where id=(p_payload->>'assignmentId')::uuid and client_id=cid and active;if not found then return jsonb_build_object('error','forbidden');end if;
   insert into studio_campaigns(assignment_id,name,created_by) values(ass.id,trim(p_payload->>'name'),actor.id) returning * into camp;note:='Campaign '||camp.id::text;
  elsif op='campaign_status' then
   if not allowed then return jsonb_build_object('error','forbidden');end if;
   update studio_campaigns set active=coalesce((p_payload->>'active')::boolean,false) where id=(p_payload->>'campaignId')::uuid and assignment_id in (select id from studio_assignments where client_id=cid) returning * into camp;if not found then return jsonb_build_object('error','forbidden');end if;note:='Campaign '||camp.id::text;
  elsif op='results' then
   offset_n:=greatest(0,least(coalesce((p_payload->>'offset')::integer,0),1000000));vid:=nullif(p_payload->>'versionId','')::uuid;desired:=coalesce((p_payload->>'includeExcluded')::boolean,false);
   select count(*) into total_n from studio_responses r left join studio_response_flags f on f.response_id=r.id where r.client_id=cid and (vid is null or r.version_id=vid) and (desired or not coalesce(f.excluded,false));
   select coalesce(jsonb_agg(q.data order by q.submitted_at desc),'[]') into items from (select r.submitted_at,jsonb_build_object('id',r.id,'versionId',r.version_id,'title',ver.definition->>'title','version',ver.version,'campaign',c.name,'collector',u.full_name,'capturedAt',r.captured_at,'captureDate',r.capture_date,'submittedAt',r.submitted_at,'excluded',coalesce(f.excluded,false),'exclusionReason',f.note,'answers',r.answers) as data from studio_responses r join studio_versions ver on ver.id=r.version_id join studio_campaigns c on c.id=r.campaign_id join fieldwork_accounts u on u.id=r.collector_id left join studio_response_flags f on f.response_id=r.id where r.client_id=cid and (vid is null or r.version_id=vid) and (desired or not coalesce(f.excluded,false)) order by r.submitted_at desc,r.id limit 25 offset offset_n) q;
   return jsonb_build_object('responses',items,'total',total_n,'offset',offset_n,'pageSize',25);
  elsif op='response' then
   select * into resp from studio_responses where id=(p_payload->>'responseId')::uuid and client_id=cid;if not found then return jsonb_build_object('error','forbidden');end if;
   return jsonb_build_object('response',to_jsonb(resp),'definition',(select definition from studio_versions where id=resp.version_id),'excluded',coalesce((select excluded from studio_response_flags where response_id=resp.id),false));
  elsif op='flag_response' then
   select * into resp from studio_responses where id=(p_payload->>'responseId')::uuid and client_id=cid;if not found then return jsonb_build_object('error','forbidden');end if;
   note:=trim(coalesce(p_payload->>'note',''));if length(note) not between 1 and 5000 then return jsonb_build_object('error','review_note_required');end if;
   insert into studio_response_flags(response_id,excluded,note,changed_by) values(resp.id,coalesce((p_payload->>'excluded')::boolean,false),note,actor.id) on conflict(response_id) do update set excluded=excluded.excluded,note=excluded.note,changed_by=excluded.changed_by,changed_at=now();
  end if;
  insert into studio_audit(actor_id,client_id,version_id,action,note) values(actor.id,cid,v.id,op,note);return jsonb_build_object('ok',true,'assignmentId',ass.id,'campaignId',camp.id);
 end if;
 if op in ('collection_list','campaign_form','submit') then
  if op='collection_list' then
   select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'clientId',client_row.id,'clientName',client_row.name,'title',ver.definition->>'title','version',ver.version,'versionId',ver.id) order by c.created_at desc),'[]') into items from studio_campaigns c join studio_assignments x on x.id=c.assignment_id join studio_clients client_row on client_row.id=x.client_id join studio_members m on m.client_id=client_row.id and m.account_id=actor.id and m.active join studio_versions ver on ver.id=x.version_id where c.active and x.active and client_row.active and ver.state='published';return jsonb_build_object('campaigns',items);
  end if;
  select * into camp from studio_campaigns where id=(p_payload->>'campaignId')::uuid and active;if not found then return jsonb_build_object('error','forbidden');end if;
  select * into ass from studio_assignments where id=camp.assignment_id and active;if not found or not exists(select 1 from studio_clients where id=ass.client_id and active) or not exists(select 1 from studio_members where client_id=ass.client_id and account_id=actor.id and active) then return jsonb_build_object('error','forbidden');end if;
  select * into v from studio_versions where id=ass.version_id and state='published';if not found then return jsonb_build_object('error','forbidden');end if;
  if op='campaign_form' then return jsonb_build_object('campaign',jsonb_build_object('id',camp.id,'name',camp.name,'clientId',ass.client_id,'clientName',(select name from studio_clients where id=ass.client_id)),'version',to_jsonb(v),'offlineUntil',now()+interval '7 days');end if;
  result:=studio_check_answers(v.definition,p_payload->'answers');if result ? 'error' then return result;end if;
  rid:=(p_payload->>'responseId')::uuid;perform pg_advisory_xact_lock(hashtextextended(rid::text,11));select * into resp from studio_responses where id=rid;
  if found then if resp.collector_id=actor.id and resp.campaign_id=camp.id and resp.answers=result->'answers' then return jsonb_build_object('receipt',jsonb_build_object('id',resp.id,'submittedAt',resp.submitted_at));else return jsonb_build_object('error','conflict');end if;end if;
  begin started:=(p_payload->>'capturedAt')::timestamptz;exception when others then started:=now();end;if started is null or started>now()+interval '1 day' then started:=now();end if;
  insert into studio_responses(id,client_id,campaign_id,version_id,collector_id,answers,captured_at,capture_date) values(rid,ass.client_id,camp.id,v.id,actor.id,result->'answers',started,(started at time zone 'Africa/Lagos')::date) returning * into resp;
  insert into studio_audit(actor_id,client_id,version_id,action,note) values(actor.id,ass.client_id,v.id,'response_received',resp.id::text);return jsonb_build_object('receipt',jsonb_build_object('id',resp.id,'submittedAt',resp.submitted_at));
 end if;
 if op='audit' then
  cid:=nullif(p_payload->>'clientId','')::uuid;
  if cid is not null and not studio_client_manager(actor.id,cid) then return jsonb_build_object('error','forbidden');end if;
  select coalesce(jsonb_agg(q.data order by q.at desc),'[]') into items from (select a.occurred_at as at,jsonb_build_object('action',a.action,'note',a.note,'at',a.occurred_at,'actor',u.full_name,'clientId',a.client_id,'versionId',a.version_id) as data from studio_audit a join fieldwork_accounts u on u.id=a.actor_id where (cid is not null and a.client_id=cid) or (cid is null and a.client_id is null and (a.actor_id=actor.id or coalesce(perms.is_admin,false))) order by a.occurred_at desc limit 100) q;return jsonb_build_object('events',items);
 end if;
 return jsonb_build_object('error','invalid_action');
exception when invalid_text_representation or numeric_value_out_of_range or check_violation or not_null_violation or foreign_key_violation then return jsonb_build_object('error','invalid_request','message','Check the supplied IDs, values and field lengths.');
end $$;
-- Existing named programme leadership initialise Studio administration and the Jigawa client.
insert into public.studio_roles(account_id,can_create,can_review,can_publish,is_admin) select id,true,true,true,true from fieldwork_accounts where active and role='leadership';
insert into public.studio_clients(id,name,created_by) select '42b48779-a53b-4740-8b10-bd4be1df7901','State of Jigawa',id from fieldwork_accounts where active and role='leadership' order by case when lower(trim(full_name))='muhammad halliru' then 0 else 1 end,full_name limit 1;
insert into public.studio_members(client_id,account_id,role) select '42b48779-a53b-4740-8b10-bd4be1df7901',a.id,case when a.id=c.created_by then 'admin' else 'leadership' end from fieldwork_accounts a join studio_clients c on c.id='42b48779-a53b-4740-8b10-bd4be1df7901' where a.active and a.role='leadership';
do $$declare f regprocedure;begin for f in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and (p.proname like 'studio_%' or p.proname='survey_studio_dispatch') loop execute format('revoke all on function %s from public,anon,authenticated',f);end loop;end $$;
grant execute on function public.survey_studio_dispatch(text,text,jsonb) to anon,authenticated;
commit;
